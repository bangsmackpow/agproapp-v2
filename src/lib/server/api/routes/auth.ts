import { Hono } from 'hono';
import { setCookie, getCookie, deleteCookie } from 'hono/cookie';
import type { AppBindings, AppVariables } from '$lib/server/rbac';
import { getDb } from '$lib/server/db';
import { users, accounts, sessions } from '$lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { verifyPassword, hashPassword, generateSessionToken } from '$lib/server/crypto';
import type { UserRole } from '$lib/db/schema';

export const authRouter = new Hono<{
	Bindings: AppBindings;
	Variables: AppVariables;
}>();

// Get active session user
authRouter.get('/me', (c) => {
	const user = c.get('user');
	return c.json({
		authenticated: !!user,
		user: user || null
	});
});

// Production Email & Password Login
authRouter.post('/login', async (c) => {
	try {
		const { email, password } = await c.req.json<{ email?: string; password?: string }>();

		if (!email || !password) {
			return c.json({ error: 'Email and password are required' }, 400);
		}

		if (!c.env?.DB) {
			return c.json({ error: 'Database service unavailable' }, 503);
		}

		const db = getDb(c.env.DB);
		const normalizedEmail = email.trim().toLowerCase();

		// Find user
		const user = await db.query.users.findFirst({
			where: eq(users.email, normalizedEmail)
		});

		if (!user || user.status !== 'active') {
			return c.json({ error: 'Invalid email or password' }, 401);
		}

		// Find credential account
		const account = await db.query.accounts.findFirst({
			where: and(eq(accounts.userId, user.id), eq(accounts.providerId, 'credential'))
		});

		if (!account || !account.password) {
			return c.json({ error: 'Invalid email or password' }, 401);
		}

		// Verify cryptographic password hash
		const isValid = await verifyPassword(password, account.password);
		if (!isValid) {
			return c.json({ error: 'Invalid email or password' }, 401);
		}

		// Generate new cryptographically secure session token
		const token = generateSessionToken();
		const sessionId = crypto.randomUUID();
		const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30-day session

		const ipAddress = c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || 'direct';
		const userAgent = c.req.header('user-agent') || 'unknown';

		// Store session in D1
		await db.insert(sessions).values({
			id: sessionId,
			userId: user.id,
			token: token,
			expiresAt: expiresAt,
			ipAddress: ipAddress,
			userAgent: userAgent
		});

		// Set HTTP-only secure cookie
		const isLocalhost = c.req.url.includes('localhost') || c.req.url.includes('127.0.0.1');
		setCookie(c, 'agpro_session', token, {
			path: '/',
			httpOnly: true,
			secure: !isLocalhost,
			sameSite: 'Lax',
			maxAge: 30 * 24 * 60 * 60 // 30 days
		});

		return c.json({
			success: true,
			message: `Authenticated as ${user.name} (${user.role.toUpperCase()})`,
			user: {
				id: user.id,
				name: user.name,
				email: user.email,
				role: user.role
			},
			token: token
		});
	} catch (err: any) {
		console.error('Login error:', err);
		return c.json({ error: 'Authentication failed', details: err?.message }, 500);
	}
});

// Production Session Logout
authRouter.post('/logout', async (c) => {
	try {
		let token = getCookie(c, 'agpro_session');
		if (!token) {
			const authHeader = c.req.header('authorization');
			if (authHeader?.startsWith('Bearer ')) {
				token = authHeader.substring(7);
			}
		}

		if (token && c.env?.DB) {
			const db = getDb(c.env.DB);
			await db.delete(sessions).where(eq(sessions.token, token));
		}

		deleteCookie(c, 'agpro_session', { path: '/' });

		return c.json({
			success: true,
			message: 'Successfully logged out'
		});
	} catch (err: any) {
		console.error('Logout error:', err);
		deleteCookie(c, 'agpro_session', { path: '/' });
		return c.json({ success: true, message: 'Logged out' });
	}
});

// Update Password
authRouter.post('/change-password', async (c) => {
	const user = c.get('user');
	if (!user) {
		return c.json({ error: 'Unauthorized' }, 401);
	}

	const { currentPassword, newPassword } = await c.req.json<{
		currentPassword?: string;
		newPassword?: string;
	}>();

	if (!currentPassword || !newPassword) {
		return c.json({ error: 'Current password and new password are required' }, 400);
	}

	if (newPassword.length < 8) {
		return c.json({ error: 'New password must be at least 8 characters long' }, 400);
	}

	if (!c.env?.DB) {
		return c.json({ error: 'Database service unavailable' }, 503);
	}

	const db = getDb(c.env.DB);
	const account = await db.query.accounts.findFirst({
		where: and(eq(accounts.userId, user.id), eq(accounts.providerId, 'credential'))
	});

	if (!account || !account.password) {
		return c.json({ error: 'User credential account not found' }, 404);
	}

	const isValid = await verifyPassword(currentPassword, account.password);
	if (!isValid) {
		return c.json({ error: 'Current password does not match' }, 401);
	}

	const newHash = await hashPassword(newPassword);
	await db
		.update(accounts)
		.set({
			password: newHash,
			updatedAt: new Date()
		})
		.where(eq(accounts.id, account.id));

	return c.json({
		success: true,
		message: 'Password updated successfully'
	});
});

// Switch role (Allowed ONLY in dev mode; strictly blocked in production)
authRouter.post('/switch-persona', async (c) => {
	const isProd = c.env?.APP_ENV === 'production';
	if (isProd) {
		return c.json(
			{
				error: 'Forbidden',
				message: 'Persona switching is disabled in production. Please log in with authorized credentials.'
			},
			403
		);
	}

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
