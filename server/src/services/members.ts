import {
  memberCreateSchema,
  memberUpdateSchema,
  type Member,
  type MemberImpact,
  type MemberWithStats,
  type TaskWithProject,
} from '@gp/shared';
import { nowIso } from '../clock';
import { AppError, fieldError, notFound } from '../errors';
import * as members from '../repositories/members';
import { ownedProjects } from '../repositories/projects';
import { listTasksWithProject } from '../repositories/tasks';
import type { ServiceContext } from './context';

const memberNotFound = () => notFound('Membro non trovato');
const emailTaken = () => fieldError('email', 'Questa email è già usata da un altro membro', 'EMAIL_TAKEN', 409);

export function listMembers(ctx: ServiceContext): MemberWithStats[] {
  return members.listMembers(ctx.db);
}

export function getMember(ctx: ServiceContext, id: number): Member {
  const member = members.findMember(ctx.db, id);
  if (!member) throw memberNotFound();
  return member;
}

export function createMember(ctx: ServiceContext, input: unknown): Member {
  const data = memberCreateSchema.parse(input);
  return ctx.db.transaction(() => {
    if (members.findMemberIdByEmail(ctx.db, data.email) !== undefined) throw emailTaken();
    const id = members.insertMember(ctx.db, data, nowIso(ctx.clock));
    return members.findMember(ctx.db, id)!;
  });
}

export function updateMember(ctx: ServiceContext, id: number, input: unknown): Member {
  const data = memberUpdateSchema.parse(input);
  return ctx.db.transaction(() => {
    const current = members.findMember(ctx.db, id);
    if (!current) throw memberNotFound();
    const merged = { name: data.name ?? current.name, email: data.email ?? current.email, role: data.role ?? current.role };
    const owner = members.findMemberIdByEmail(ctx.db, merged.email);
    if (owner !== undefined && owner !== id) throw emailTaken();
    members.updateMember(ctx.db, id, merged, nowIso(ctx.clock));
    return members.findMember(ctx.db, id)!;
  });
}

export function getMemberImpact(ctx: ServiceContext, id: number): MemberImpact {
  const member = getMember(ctx, id);
  const counts = ctx.db.get<{ assigned: number; open: number; comments: number }>(
    `SELECT
       (SELECT COUNT(*) FROM tasks WHERE assignee_id = :id) AS assigned,
       (SELECT COUNT(*) FROM tasks WHERE assignee_id = :id AND status <> 'fatto') AS open,
       (SELECT COUNT(*) FROM comments WHERE author_id = :id) AS comments`,
    { id },
  )!;
  return {
    member,
    assignedTaskCount: counts.assigned,
    openTaskCount: counts.open,
    commentCount: counts.comments,
    ownedProjects: ownedProjects(ctx.db, id),
  };
}

/**
 * Deletes a member without breaking data:
 *  - their tasks become unassigned (also in archived projects: integrity wins over read-only);
 *  - their comments are kept with the author's name snapshot;
 *  - projects they own must be reassigned to another member (`reassignOwnerTo`).
 */
export function deleteMember(
  ctx: ServiceContext,
  id: number,
  reassignOwnerTo?: number,
): { unassignedTasks: number; reassignedProjects: number } {
  return ctx.db.transaction(() => {
    const member = members.findMember(ctx.db, id);
    if (!member) throw memberNotFound();
    const now = nowIso(ctx.clock);

    const owned = ownedProjects(ctx.db, id);
    if (owned.length > 0) {
      if (reassignOwnerTo === undefined) {
        throw new AppError(
          409,
          'MEMBER_OWNS_PROJECTS',
          owned.length === 1
            ? `${member.name} è responsabile del progetto "${owned[0]!.name}": scegli a chi assegnarlo prima di eliminarlo.`
            : `${member.name} è responsabile di ${owned.length} progetti: scegli a chi assegnarli prima di eliminarlo.`,
          { projects: owned.map((p) => ({ id: p.id, name: p.name })) },
          'reassignOwnerTo',
        );
      }
      if (reassignOwnerTo === id) {
        throw fieldError('reassignOwnerTo', 'Scegli un membro diverso da quello da eliminare', 'BAD_REQUEST', 400);
      }
      if (!members.memberExists(ctx.db, reassignOwnerTo)) {
        throw fieldError('reassignOwnerTo', 'Il nuovo responsabile selezionato non esiste', 'INVALID_REFERENCE');
      }
      ctx.db.run('UPDATE projects SET owner_id = :to, version = version + 1, updated_at = :now WHERE owner_id = :id', {
        to: reassignOwnerTo,
        now,
        id,
      });
    }

    const unassigned = ctx.db.run(
      'UPDATE tasks SET assignee_id = NULL, version = version + 1, updated_at = :now WHERE assignee_id = :id',
      { now, id },
    ).changes;
    // Refresh the name snapshot so comments keep showing the latest name.
    ctx.db.run('UPDATE comments SET author_name = :name WHERE author_id = :id', { name: member.name, id });
    members.deleteMember(ctx.db, id);
    return { unassignedTasks: unassigned, reassignedProjects: owned.length };
  });
}

/** Open tasks assigned to a member across non-archived projects, by due date then priority. */
export function listOpenTasksForMember(ctx: ServiceContext, id: number): TaskWithProject[] {
  getMember(ctx, id);
  return listTasksWithProject(ctx.db, "t.assignee_id = ? AND t.status <> 'fatto' AND p.status <> 'archiviato'", [id]);
}
