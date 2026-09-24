import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import type { AppBindings, AppVariables, AuthUser } from '$lib/server/rbac';
import { getDb } from '$lib/server/db';
import { seedInitialData } from '$lib/db/seed-data';
import { users } from '$lib/db/schema';
import { eq } from 'drizzle-orm';

// Sub-routers
import { authRouter } from './routes/auth';
import { customersRouter } from './routes/customers';
import { inventoryRouter } from './routes/inventory';
import { ingestionRouter } from './routes/ingestion';
import { invoicesRouter } from './routes/invoices';
import { checksRouter } from './routes/checks';
import { complianceRouter } from './routes/compliance';
import { systemLogsRouter } from './routes/system-logs';

export const api = new Hono<{
	Bindings: AppBindings;
	Variables: AppVariables;
}>().basePath('/api');

// Logging & CORS
api.use('*', logger());
api.use(
	'*',
	cors({
		origin: '*',
		allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
		allowHeaders: ['Content-Type', 'Authorization', 'x-user-role', 'x-user-id']
	})
);

// Database auto-seeder & Session context middleware
api.use('*', async (c, next) => {
	const roleHeader = c.req.header('x-user-role')?.toLowerCase();
	const userIdHeader = c.req.header('x-user-id');

	let currentUser: AuthUser | null = null;

	if (c.env?.DB) {
		const db = getDb(c.env.DB);
		try {
			// Auto-seed baseline data if no users exist
			const anyUser = await db.query.users.findFirst();
			if (!anyUser) {
				await seedInitialData(db);
			}
		} catch (e) {
			console.warn('Auto-seed check error:', e);
		}

		if (userIdHeader) {
			const found = await db.query.users.findFirst({ where: eq(users.id, userIdHeader) });
			if (found) {
				currentUser = { id: found.id, name: found.name, email: found.email, role: found.role };
			}
		} else if (roleHeader && ['sales', 'manager', 'admin'].includes(roleHeader)) {
			const found = await db.query.users.findFirst({ where: eq(users.role, roleHeader as any) });
			if (found) {
				currentUser = { id: found.id, name: found.name, email: found.email, role: found.role };
			}
		}
	}

	// Fallback when DB is absent or role specified explicitly in headers for testing
	if (!currentUser && roleHeader && ['sales', 'manager', 'admin'].includes(roleHeader)) {
		currentUser = {
			id: `usr_${roleHeader}_test`,
			name: `Test ${roleHeader.toUpperCase()}`,
			email: `${roleHeader}@agpro.iowa`,
			role: roleHeader as any
		};
	} else if (!currentUser) {
		currentUser = {
			id: 'usr_admin_default',
			name: 'Curtis Vance (Admin)',
			email: 'admin@agpro.iowa',
			role: 'admin'
		};
	}

	c.set('user', currentUser);
	await next();
});

const healthHandler = (c: any) => {
	const user = c.get('user');
	return c.json({
		status: 'healthy',
		engine: 'AgPro Edge-Native Gateway (Hono on Cloudflare Workers)',
		region: 'Iowa, USA (Midwest Ag Corridor)',
		currentUser: user,
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
