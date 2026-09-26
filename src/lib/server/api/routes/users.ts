import { Hono } from 'hono';
import type { AppBindings, AppVariables } from '$lib/server/rbac';
import { requireAdmin } from '$lib/server/rbac';
import { getDb } from '$lib/server/db';
import { users, accounts, sessions, systemAuditLogs, type UserRole, type UserStatus } from '$lib/db/schema';
import { eq, desc } from 'drizzle-orm';
import { hashPassword } from '$lib/server/crypto';

export const usersRouter = new Hono<{
	Bindings: AppBindings;
	Variables: AppVariables;
}>();

// All staff management routes are strictly restricted to Admin users
usersRouter.use('*', requireAdmin());

// GET /api/users - List all staff accounts
usersRouter.get('/', async (c) => {
	if (!c.env?.DB) return c.json({ users: [] });
	const db = getDb(c.env.DB);

	const staffList = await db.query.users.findMany({
		columns: {
			id: true,
			name: true,
			email: true,
			role: true,
			status: true,
			createdAt: true,
			updatedAt: true
		},
		orderBy: [desc(users.createdAt)]
	});

	return c.json({ users: staffList });
});

// POST /api/users - Invite or create a new staff account
usersRouter.post('/', async (c) => {
	const currentUser = c.get('user');
	const { name, email, role, password, status } = await c.req.json<{
		name?: string;
		email?: string;
		role?: UserRole;
		password?: string;
		status?: UserStatus;
	}>();

	if (!name?.trim() || !email?.trim()) {
		return c.json({ error: 'Name and email are required' }, 400);
	}

	const normalizedEmail = email.trim().toLowerCase();
	const userRole: UserRole = role && ['sales', 'manager', 'admin'].includes(role) ? role : 'sales';
	const userStatus: UserStatus = status && ['active', 'suspended', 'invited'].includes(status) ? status : 'active';
	const rawPassword = password?.trim() || 'AgPro2026!Staff';

	if (rawPassword.length < 8) {
		return c.json({ error: 'Password must be at least 8 characters long' }, 400);
	}

	if (!c.env?.DB) return c.json({ error: 'Database unavailable' }, 503);
	const db = getDb(c.env.DB);

	// Check if user already exists
	const existing = await db.query.users.findFirst({
		where: eq(users.email, normalizedEmail)
	});

	if (existing) {
		return c.json({ error: `A user account with email '${normalizedEmail}' already exists` }, 409);
	}

	const newUserId = `usr_${crypto.randomUUID().slice(0, 8)}`;
	const passwordHash = await hashPassword(rawPassword);

	// 1. Insert user profile
	await db.insert(users).values({
		id: newUserId,
		name: name.trim(),
		email: normalizedEmail,
		role: userRole,
		status: userStatus
	});

	// 2. Insert credential account
	await db.insert(accounts).values({
		id: `acc_${crypto.randomUUID().slice(0, 8)}`,
		userId: newUserId,
		accountId: normalizedEmail,
		providerId: 'credential',
		password: passwordHash
	});

	// 3. Record audit log
	try {
		await db.insert(systemAuditLogs).values({
			id: `aud_${crypto.randomUUID().slice(0, 8)}`,
			userId: currentUser.id,
			userEmail: currentUser.email,
			action: 'STAFF_USER_CREATED',
			entity: 'user',
			entityId: newUserId,
			ipAddress: c.req.header('cf-connecting-ip') || 'direct',
			userAgent: c.req.header('user-agent') || 'edge-worker',
			metadata: JSON.stringify({
				newUserId,
				name: name.trim(),
				email: normalizedEmail,
				role: userRole,
				status: userStatus
			})
		});
	} catch (e) {
		console.warn('Failed to write staff creation audit log:', e);
	}

	return c.json(
		{
			success: true,
			message: `Staff member ${name} created successfully (${userRole.toUpperCase()})`,
			user: {
				id: newUserId,
				name: name.trim(),
				email: normalizedEmail,
				role: userRole,
				status: userStatus
			}
		},
		201
	);
});

// PATCH /api/users/:id - Update staff profile, role, status, or reset password
usersRouter.patch('/:id', async (c) => {
	const currentUser = c.get('user');
	const targetId = c.req.param('id');
	const { name, role, status, password } = await c.req.json<{
		name?: string;
		role?: UserRole;
		status?: UserStatus;
		password?: string;
	}>();

	if (!c.env?.DB) return c.json({ error: 'Database unavailable' }, 503);
	const db = getDb(c.env.DB);

	const targetUser = await db.query.users.findFirst({
		where: eq(users.id, targetId)
	});

	if (!targetUser) {
		return c.json({ error: 'User not found' }, 404);
	}

	// Prevent self-demotion or self-suspension of the sole active admin
	if (currentUser.id === targetId) {
		if (role && role !== 'admin') {
			return c.json({ error: 'You cannot demote your own admin account' }, 400);
		}
		if (status && status !== 'active') {
			return c.json({ error: 'You cannot suspend your own active account' }, 400);
		}
	}

	const userUpdates: any = { updatedAt: new Date() };
	if (name?.trim()) userUpdates.name = name.trim();
	if (role && ['sales', 'manager', 'admin'].includes(role)) userUpdates.role = role;
	if (status && ['active', 'suspended', 'invited'].includes(status)) userUpdates.status = status;

	await db.update(users).set(userUpdates).where(eq(users.id, targetId));

	// If password reset requested
	if (password?.trim()) {
		if (password.trim().length < 8) {
			return c.json({ error: 'New password must be at least 8 characters long' }, 400);
		}

		const newHash = await hashPassword(password.trim());
		const existingAccount = await db.query.accounts.findFirst({
			where: eq(accounts.userId, targetId)
		});

		if (existingAccount) {
			await db
				.update(accounts)
				.set({ password: newHash, updatedAt: new Date() })
				.where(eq(accounts.id, existingAccount.id));
		} else {
			await db.insert(accounts).values({
				id: `acc_${crypto.randomUUID().slice(0, 8)}`,
				userId: targetId,
				accountId: targetUser.email,
				providerId: 'credential',
				password: newHash
			});
		}

		// Invalidate existing sessions for security
		await db.delete(sessions).where(eq(sessions.userId, targetId));
	}

	// If status changed to suspended, revoke active sessions
	if (status === 'suspended') {
		await db.delete(sessions).where(eq(sessions.userId, targetId));
	}

	// Record audit log
	try {
		await db.insert(systemAuditLogs).values({
			id: `aud_${crypto.randomUUID().slice(0, 8)}`,
			userId: currentUser.id,
			userEmail: currentUser.email,
			action: 'STAFF_USER_UPDATED',
			entity: 'user',
			entityId: targetId,
			ipAddress: c.req.header('cf-connecting-ip') || 'direct',
			userAgent: c.req.header('user-agent') || 'edge-worker',
			metadata: JSON.stringify({
				targetId,
				updates: { ...userUpdates, passwordReset: !!password }
			})
		});
	} catch (e) {
		console.warn('Failed to write staff update audit log:', e);
	}

	const updatedUser = await db.query.users.findFirst({
		where: eq(users.id, targetId),
		columns: { id: true, name: true, email: true, role: true, status: true, updatedAt: true }
	});

	return c.json({
		success: true,
		message: `Staff member ${updatedUser?.name} updated successfully`,
		user: updatedUser
	});
});

// DELETE /api/users/:id - Deactivate / Suspend staff member
usersRouter.delete('/:id', async (c) => {
	const currentUser = c.get('user');
	const targetId = c.req.param('id');

	if (currentUser.id === targetId) {
		return c.json({ error: 'You cannot delete or suspend your own account' }, 400);
	}

	if (!c.env?.DB) return c.json({ error: 'Database unavailable' }, 503);
	const db = getDb(c.env.DB);

	const targetUser = await db.query.users.findFirst({
		where: eq(users.id, targetId)
	});

	if (!targetUser) {
		return c.json({ error: 'User not found' }, 404);
	}

	// Suspend user and terminate sessions
	await db.update(users).set({ status: 'suspended', updatedAt: new Date() }).where(eq(users.id, targetId));
	await db.delete(sessions).where(eq(sessions.userId, targetId));

	try {
		await db.insert(systemAuditLogs).values({
			id: `aud_${crypto.randomUUID().slice(0, 8)}`,
			userId: currentUser.id,
			userEmail: currentUser.email,
			action: 'STAFF_USER_SUSPENDED',
			entity: 'user',
			entityId: targetId,
			ipAddress: c.req.header('cf-connecting-ip') || 'direct',
			userAgent: c.req.header('user-agent') || 'edge-worker',
			metadata: JSON.stringify({ targetEmail: targetUser.email, targetName: targetUser.name })
		});
	} catch (e) {
		console.warn('Failed to write audit log:', e);
	}

	return c.json({
		success: true,
		message: `Staff member ${targetUser.name} has been suspended and all active sessions revoked`
	});
});
