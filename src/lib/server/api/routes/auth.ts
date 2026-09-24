import { Hono } from 'hono';
import type { AppBindings, AppVariables } from '$lib/server/rbac';
import { getDb } from '$lib/server/db';
import { users } from '$lib/db/schema';
import { eq } from 'drizzle-orm';
import type { UserRole } from '$lib/db/schema';

export const authRouter = new Hono<{
	Bindings: AppBindings;
	Variables: AppVariables;
}>();

// Get active session user
authRouter.get('/me', (c) => {
	const user = c.get('user');
	return c.json({
		user: user || null,
		authenticated: !!user
	});
});

// List all system personas (for testing and role switching in demo/development)
authRouter.get('/users', async (c) => {
	if (!c.env?.DB) return c.json({ users: [] });
	const db = getDb(c.env.DB);
	const allUsers = await db.query.users.findMany({
		columns: {
			id: true,
			name: true,
			email: true,
			role: true,
			status: true
		}
	});
	return c.json({ users: allUsers });
});

// Switch role (sets session cookie or returns user info for UI state)
authRouter.post('/switch-persona', async (c) => {
	const { role } = await c.req.json<{ role: UserRole }>();
	if (!['sales', 'manager', 'admin'].includes(role)) {
		return c.json({ error: 'Invalid role specified' }, 400);
	}

	if (!c.env?.DB) return c.json({ error: 'DB not available' }, 500);
	const db = getDb(c.env.DB);

	const targetUser = await db.query.users.findFirst({
		where: eq(users.role, role)
	});

	if (!targetUser) {
		return c.json({ error: `No active user found with role ${role}` }, 404);
	}

	return c.json({
		success: true,
		message: `Switched active persona to ${targetUser.name} (${role.toUpperCase()})`,
		user: {
			id: targetUser.id,
			name: targetUser.name,
			email: targetUser.email,
			role: targetUser.role
		}
	});
});
