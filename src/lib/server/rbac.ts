import type { Context, MiddlewareHandler } from 'hono';
import type { UserRole } from '$lib/db/schema';
import { systemAuditLogs } from '$lib/db/schema';
import { getDb } from './db';
import type { D1Database } from '@cloudflare/workers-types';

export interface AuthUser {
	id: string;
	name: string;
	email: string;
	role: UserRole;
}

export type AppBindings = {
	DB: D1Database;
	DOCUMENTS?: any;
	APP_NAME?: string;
	APP_ENV?: string;
	BETTER_AUTH_URL?: string;
	IOWA_SEED_AUDIT_ENABLED?: string;
	RESEND_API_KEY?: string;
	RESEND_FROM_EMAIL?: string;
};

export type AppVariables = {
	user: AuthUser;
};

/**
 * Access Matrix Rule:
 * - Sales: CRM, Invoice Creation, Inventory Read-Only
 * - Manager: CRM, Invoicing, Inventory Management (write/edit/import), Basic Reporting
 * - Admin: Full system access, System configuration logs, Exclusive Checkwriting
 */
export function requireRole(allowedRoles: UserRole[]): MiddlewareHandler<{
	Bindings: AppBindings;
	Variables: AppVariables;
}> {
	return async (c, next) => {
		const user = c.get('user');

		if (!user) {
			return c.json(
				{
					error: 'Unauthorized',
					message: 'Authentication session required.'
				},
				401
			);
		}

		if (!allowedRoles.includes(user.role)) {
			// Record security violation attempt in audit logs
			if (c.env?.DB) {
				try {
					const db = getDb(c.env.DB);
					await db.insert(systemAuditLogs).values({
						id: crypto.randomUUID(),
						userId: user.id,
						userEmail: user.email,
						action: 'SECURITY_RBAC_VIOLATION_BLOCKED',
						entity: 'route_access',
						entityId: c.req.path,
						ipAddress: c.req.header('cf-connecting-ip') || 'unknown',
						userAgent: c.req.header('user-agent') || 'unknown',
						metadata: JSON.stringify({
							userRole: user.role,
							requiredRoles: allowedRoles,
							path: c.req.path,
							method: c.req.method
						})
					});
				} catch (e) {
					console.error('Failed to log RBAC violation to DB:', e);
				}
			}

			return c.json(
				{
					error: 'Forbidden',
					message: `Role '${user.role}' is not authorized to access this resource. Required: [${allowedRoles.join(', ')}]`,
					requiredRoles: allowedRoles,
					userRole: user.role
				},
				403
			);
		}

		await next();
	};
}

export const requireAdmin = () => requireRole(['admin']);
export const requireManagerOrAdmin = () => requireRole(['manager', 'admin']);
export const requireSalesOrAbove = () => requireRole(['sales', 'manager', 'admin']);
