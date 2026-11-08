import type { Member, MemberWithStats } from '@gp/shared';
import type { Database } from '../db/database';

interface MemberRow {
  id: number;
  name: string;
  email: string;
  role: string;
  created_at: string;
  updated_at: string;
}

interface MemberStatsRow extends MemberRow {
  open_task_count: number;
  owned_project_count: number;
}

const collator = new Intl.Collator('it', { sensitivity: 'base' });

export function mapMember(row: MemberRow): Member {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function findMember(db: Database, id: number): Member | undefined {
  const row = db.get<MemberRow>('SELECT * FROM members WHERE id = ?', [id]);
  return row ? mapMember(row) : undefined;
}

export function memberExists(db: Database, id: number): boolean {
  return db.get('SELECT 1 FROM members WHERE id = ?', [id]) !== undefined;
}

export function findMemberIdByEmail(db: Database, email: string): number | undefined {
  return db.get<{ id: number }>('SELECT id FROM members WHERE email = ? COLLATE NOCASE', [email])?.id;
}

export function listMembers(db: Database): MemberWithStats[] {
  const rows = db.all<MemberStatsRow>(`
    SELECT m.*,
      (SELECT COUNT(*) FROM tasks t JOIN projects p ON p.id = t.project_id
        WHERE t.assignee_id = m.id AND t.status <> 'fatto' AND p.status <> 'archiviato') AS open_task_count,
      (SELECT COUNT(*) FROM projects p WHERE p.owner_id = m.id) AS owned_project_count
    FROM members m
  `);
  return rows
    .map((row) => ({ ...mapMember(row), openTaskCount: row.open_task_count, ownedProjectCount: row.owned_project_count }))
    .sort((a, b) => collator.compare(a.name, b.name));
}

export function insertMember(db: Database, input: { name: string; email: string; role: string }, now: string): number {
  return db.run(
    'INSERT INTO members (name, email, role, created_at, updated_at) VALUES (:name, :email, :role, :now, :now)',
    { name: input.name, email: input.email, role: input.role, now },
  ).lastInsertRowid;
}

export function updateMember(db: Database, id: number, input: { name: string; email: string; role: string }, now: string): void {
  db.run('UPDATE members SET name = :name, email = :email, role = :role, updated_at = :now WHERE id = :id', {
    id,
    name: input.name,
    email: input.email,
    role: input.role,
    now,
  });
}

export function deleteMember(db: Database, id: number): void {
  db.run('DELETE FROM members WHERE id = ?', [id]);
}
