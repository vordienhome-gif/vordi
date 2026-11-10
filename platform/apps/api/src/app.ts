import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import type { Me, Role } from '@vordi/contracts';
import { DomainError } from '@vordi/domain';
import { and, eq, gt } from 'drizzle-orm';
import Fastify, { type FastifyReply, type FastifyRequest } from 'fastify';
import { ZodError } from 'zod';
import type { Db } from './db/index.ts';
import { employees, sessions } from './db/schema.ts';
import { tokenHash } from './lib/auth.ts';
import { forbidden, HttpError } from './lib/errors.ts';
import { registerRoutes } from './routes/index.ts';

declare module 'fastify' {
  interface FastifyRequest { user: Me | null }
}

export interface AppOptions {
  db: Db;
  corsOrigins?: string[];
  logger?: boolean;
  /** Girişte dakikada izin verilen deneme (kaba kuvvet saldırısına karşı). */
  loginRateLimit?: number;
}

export async function buildApp(opts: AppOptions) {
  const app = Fastify({ logger: opts.logger ?? false, bodyLimit: 5 * 1024 * 1024, trustProxy: true });
  await app.register(helmet);
  await app.register(cors, { origin: opts.corsOrigins?.length ? opts.corsOrigins : false });
  await app.register(rateLimit, { global: false });

  app.decorateRequest('user', null);
  app.addHook('onRequest', async (req) => {
    const h = req.headers.authorization;
    if (!h?.startsWith('Bearer ')) return;
    const [row] = await opts.db
      .select({ e: employees })
      .from(sessions).innerJoin(employees, eq(employees.id, sessions.employeeId))
      .where(and(eq(sessions.tokenHash, tokenHash(h.slice(7))), gt(sessions.expiresAt, new Date()), eq(employees.active, true)));
    if (row) req.user = { id: row.e.id, login: row.e.login, name: row.e.name, role: row.e.role as Role, warehouseIds: row.e.warehouseIds };
  });

  app.setErrorHandler((err, _req, reply) => {
    if (err instanceof ZodError) {
      return reply.status(400).send({ code: 'validation', message: err.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ') });
    }
    if (err instanceof DomainError) return reply.status(422).send({ code: err.code, message: err.message });
    if (err instanceof HttpError) return reply.status(err.statusCode).send({ code: err.code, message: err.message });
    const status = (err as { statusCode?: number }).statusCode;
    if (status && status < 500) return reply.status(status).send({ code: 'error', message: (err as Error).message });
    app.log.error(err);
    return reply.status(500).send({ code: 'internal', message: 'Внутренняя ошибка сервера' });
  });

  app.get('/health', async () => ({ ok: true }));
  await registerRoutes(app, opts);
  return app;
}

/** Rol kontrolü: giriş yapılmamışsa 401, rol uymuyorsa 403. */
export const requireRole = (...roles: Role[]) => async (req: FastifyRequest, reply: FastifyReply) => {
  if (!req.user) return reply.status(401).send({ code: 'unauthorized', message: 'Требуется вход' });
  if (roles.length && !roles.includes(req.user.role)) throw forbidden();
};
export const user = (req: FastifyRequest): Me => req.user!;
