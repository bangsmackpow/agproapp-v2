import { Hono } from 'hono';
import type { AppBindings, AppVariables } from '$lib/server/rbac';
import { requireSalesOrAbove } from '$lib/server/rbac';
import { getDb } from '$lib/server/db';
import { iowaComplianceLogs } from '$lib/db/schema';
import { eq, desc, like, or } from 'drizzle-orm';

export const complianceRouter = new Hono<{
	Bindings: AppBindings;
	Variables: AppVariables;
}>();

// Sales, Manager, Admin can search and inspect Iowa Compliance logs
complianceRouter.use('*', requireSalesOrAbove());

// Search compliance records by BOL, Order number, Customer, or Product
complianceRouter.get('/', async (c) => {
	if (!c.env?.DB) return c.json({ logs: [] });
	const db = getDb(c.env.DB);
	const q = c.req.query('q')?.trim();

	let list;
	if (q) {
		const pattern = `%${q}%`;
		list = await db.query.iowaComplianceLogs.findMany({
			where: or(
				like(iowaComplianceLogs.bolNumber, pattern),
				like(iowaComplianceLogs.orderNumber, pattern),
				like(iowaComplianceLogs.regulatedProduct, pattern),
				like(iowaComplianceLogs.lotNumber, pattern)
			),
			with: {
				customer: true,
				invoice: true,
				verifiedByUser: {
					columns: { id: true, name: true, email: true }
				}
			},
			orderBy: [desc(iowaComplianceLogs.verifiedAt)],
			limit: 100
		});
	} else {
		list = await db.query.iowaComplianceLogs.findMany({
			with: {
				customer: true,
				invoice: true,
				verifiedByUser: {
					columns: { id: true, name: true, email: true }
				}
			},
			orderBy: [desc(iowaComplianceLogs.verifiedAt)],
			limit: 100
		});
	}

	return c.json({ logs: list });
});
