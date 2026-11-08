import fastifyStatic from '@fastify/static';
import Fastify, { type FastifyError, type FastifyInstance, type FastifyServerOptions } from 'fastify';
import { z } from 'zod';
import { zodFieldErrors, type ApiErrorBody } from '@gp/shared';
import { systemClock, type Clock } from './clock';
import type { Database } from './db/database';
import { AppError } from './errors';
import { registerApiRoutes } from './routes';

export interface AppOptions {
  db: Database;
  clock?: Clock;
  backupDir?: string | null;
  /** Directory with the built client; when set, the SPA is served from "/". */
  clientDist?: string | null;
  logger?: FastifyServerOptions['logger'];
}

function errorBody(error: ApiErrorBody['error']): ApiErrorBody {
  return { error };
}

export async function buildApp(options: AppOptions): Promise<FastifyInstance> {
  const app = Fastify({
    logger: options.logger ?? false,
    bodyLimit: 2 * 1024 * 1024,
    routerOptions: { ignoreTrailingSlash: true },
  });

  const ctx = { db: options.db, clock: options.clock ?? systemClock, backupDir: options.backupDir ?? null };

  app.addHook('onSend', async (_req, reply) => {
    reply.header('X-Content-Type-Options', 'nosniff');
    reply.header('X-Frame-Options', 'DENY');
    reply.header('Referrer-Policy', 'same-origin');
  });

  app.setErrorHandler((error: FastifyError | AppError | z.ZodError, request, reply) => {
    if (error instanceof AppError) {
      return reply.status(error.status).send(
        errorBody({
          code: error.code,
          message: error.message,
          ...(error.field ? { field: error.field } : {}),
          ...(error.fieldErrors ? { fieldErrors: error.fieldErrors } : {}),
          ...(error.details !== undefined ? { details: error.details } : {}),
        }),
      );
    }
    if (error instanceof z.ZodError) {
      return reply.status(400).send(
        errorBody({ code: 'VALIDATION_ERROR', message: 'Alcuni campi non sono validi.', fieldErrors: zodFieldErrors(error) }),
      );
    }
    if (error.code === 'FST_ERR_CTP_BODY_TOO_LARGE') {
      return reply.status(413).send(errorBody({ code: 'PAYLOAD_TOO_LARGE', message: 'Il contenuto inviato è troppo grande.' }));
    }
    if (typeof error.statusCode === 'number' && error.statusCode >= 400 && error.statusCode < 500) {
      return reply
        .status(400)
        .send(errorBody({ code: 'BAD_REQUEST', message: 'Richiesta non valida: il contenuto inviato non è leggibile.' }));
    }
    request.log.error(error);
    return reply
      .status(500)
      .send(errorBody({ code: 'INTERNAL_ERROR', message: 'Si è verificato un errore imprevisto. Riprova tra poco.' }));
  });

  await app.register(
    async (api) => {
      registerApiRoutes(api, ctx);
    },
    { prefix: '/api' },
  );

  if (options.clientDist) {
    await app.register(fastifyStatic, {
      root: options.clientDist,
      cacheControl: false,
      setHeaders(reply, filePath) {
        const isHashedAsset = /[\\/]assets[\\/]/.test(filePath);
        reply.header('Cache-Control', isHashedAsset ? 'public, max-age=31536000, immutable' : 'no-cache');
      },
    });
  }

  app.setNotFoundHandler((request, reply) => {
    const isApi = request.url === '/api' || request.url.startsWith('/api/');
    if (!isApi && options.clientDist && (request.method === 'GET' || request.method === 'HEAD')) {
      // SPA fallback: client-side routes are handled by React Router.
      return reply.sendFile('index.html');
    }
    return reply.status(404).send(errorBody({ code: 'NOT_FOUND', message: 'Risorsa non trovata' }));
  });

  return app;
}
