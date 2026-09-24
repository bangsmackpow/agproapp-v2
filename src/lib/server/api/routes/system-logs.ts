import { Hono } from 'hono';
import type { AppBindings, AppVariables } from '$lib/server/rbac';
import { requireAdmin } from '$lib/server/rbac';
import { getDb } from '$lib/server/db';
import { systemAuditLogs } from '$lib/db/schema';
import { desc } from 'drizzle-orm';

export const systemLogsRouter = new Hono<{
	Bindings: AppBindings;
	Variables: AppVariables;
}>();

// STRICT ADMIN LOCK
systemLogsRouter.use('*', requireAdmin());

// Get system configuration & security audit logs
systemLogsRouter.get('/', async (c) => {
	if (!c.env?.DB) return c.json({ logs: [] });
	const db = getDb(c.env.DB);

	const logs = await db.query.systemAuditLogs.findMany({
		orderBy: [desc(systemAuditLogs.createdAt)],
		limit: 100
	});

	return c.json({ logs });
});
