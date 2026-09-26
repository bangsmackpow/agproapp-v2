import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { getCookie } from 'hono/cookie';
import type { AppBindings, AppVariables, AuthUser } from '$lib/server/rbac';
import { getDb } from '$lib/server/db';
import { seedInitialData } from '$lib/db/seed-data';
import { users, sessions } from '$lib/db/schema';
import { eq, and, gt } from 'drizzle-orm';

// Sub-routers
import { authRouter } from './routes/auth';
import { customersRouter } from './routes/customers';
import { inventoryRouter } from './routes/inventory';
import { ingestionRouter } from './routes/ingestion';
import { invoicesRouter } from './routes/invoices';
import { checksRouter } from './routes/checks';
import { complianceRouter } from './routes/compliance';
import { systemLogsRouter } from './routes/system-logs';
import { usersRouter } from './routes/users';

export const api = new Hono<{
	Bindings: AppBindings;
	Variables: AppVariables;
}>().basePath('/api');

// Logging & CORS
api.use('*', logger());
api.use(
	'*',
	cors({
		origin: (origin) => origin || '*',
		allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
		allowHeaders: ['Content-Type', 'Authorization', 'x-user-role', 'x-user-id'],
		credentials: true
	})
);

// Database auto-seeder & Session verification middleware
api.use('*', async (c, next) => {
	const path = c.req.path;
	const isPublic =
		path === '/api' ||
		path === '/api/' ||
		path === '/api/auth/login' ||
		path === '/api/auth/logout' ||
		path === '/api/auth/me';

	let currentUser: AuthUser | null = null;

	// Extract session token from cookie or Authorization header
	let token = getCookie(c, 'agpro_session');
	if (!token) {
		const authHeader = c.req.header('authorization');
		if (authHeader?.startsWith('Bearer ')) {
			token = authHeader.substring(7);
		}
	}

	if (c.env?.DB) {
		const db = getDb(c.env.DB);
		try {
			// Auto-seed baseline data if products are missing
			const anyProduct = await db.query.products.findFirst();
			if (!anyProduct) {
				await seedInitialData(db);
			}
		} catch (e) {
			console.warn('Auto-seed check error:', e);
		}

		if (token) {
			try {
				const activeSession = await db.query.sessions.findFirst({
					where: and(
						eq(sessions.token, token),
						gt(sessions.expiresAt, new Date())
					)
				});

				if (activeSession) {
					const userRecord = await db.query.users.findFirst({
						where: eq(users.id, activeSession.userId)
					});
					if (userRecord && userRecord.status === 'active') {
						currentUser = {
							id: userRecord.id,
							name: userRecord.name,
							email: userRecord.email,
							role: userRecord.role
						};
					}
				}
			} catch (sessionErr) {
				console.error('Session lookup error:', sessionErr);
			}
		}
	}

	// Dev / test harness fallback: allow x-user-role ONLY in non-production environments
	const isProd = c.env?.APP_ENV === 'production';
	if (!isProd && !currentUser) {
		const roleHeader = c.req.header('x-user-role')?.toLowerCase();
		if (roleHeader && ['sales', 'manager', 'admin'].includes(roleHeader)) {
			currentUser = {
				id: `usr_${roleHeader}_test`,
				name: `Test ${roleHeader.toUpperCase()}`,
				email: `${roleHeader}@agpro.iowa`,
				role: roleHeader as any
			};
		}
	}

	c.set('user', currentUser as any);

	// Enforce strict authentication gate in production
	if (isProd && !currentUser && !isPublic && c.req.method !== 'OPTIONS') {
		return c.json(
			{
				error: 'Unauthorized',
				message: 'Authentication session required. Please log in with a valid AgPro account.'
			},
			401
		);
	}

	await next();
});

const healthHandler = (c: any) => {
	const user = c.get('user');
	return c.json({
		status: 'healthy',
		engine: 'AgPro Solutions Gateway (Hono on Cloudflare Workers)',
		region: 'Creston, Iowa (Southwest Ag Region)',
		currentUser: user || null,
		authenticated: !!user,
		modules: [
			'CRM & Iowa Seed Compliance',
			'Unified Multi-Category Inventory (Chemical, Seed, Drone, Misc)',
			'Dynamic 3-Tier Markup Calculation Engine',
			'Intelligent Vendor Ingestion (Channel BOL, Wickman, Atticus, I&B Ag)',
			'Protected Admin Checkwriting Ledger'
		],
		timestamp: new Date().toISOString()
	});
};

// Root API Health & Capabilities descriptor for both /api and /api/
api.get('/', healthHandler);
api.get('', healthHandler);

// Mount Routes
api.route('/auth', authRouter);
api.route('/customers', customersRouter);
api.route('/inventory', inventoryRouter);
api.route('/ingestion', ingestionRouter);
api.route('/invoices', invoicesRouter);
api.route('/checks', checksRouter);
api.route('/compliance', complianceRouter);
api.route('/system-logs', systemLogsRouter);
api.route('/users', usersRouter);

// Global Error Handling
api.onError((err, c) => {
	console.error('Hono Gateway API Error:', err);
	return c.json(
		{
			error: 'Internal_Server_Error',
			message: err.message || 'An unexpected error occurred in the gateway router.',
			path: c.req.path
		},
		500
	);
});
