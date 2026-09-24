import { Hono } from 'hono';
import type { AppBindings, AppVariables } from '$lib/server/rbac';
import { requireSalesOrAbove } from '$lib/server/rbac';
import { getDb } from '$lib/server/db';
import { customers, iowaComplianceLogs, invoices } from '$lib/db/schema';
import { eq, desc, like, or } from 'drizzle-orm';

export const customersRouter = new Hono<{
	Bindings: AppBindings;
	Variables: AppVariables;
}>();

// All authenticated roles (Sales, Manager, Admin) can access CRM
customersRouter.use('*', requireSalesOrAbove());

// List customers with optional search
customersRouter.get('/', async (c) => {
	if (!c.env?.DB) return c.json({ customers: [] });
	const db = getDb(c.env.DB);
	const q = c.req.query('q')?.trim();

	let list;
	if (q) {
		const searchPattern = `%${q}%`;
		list = await db.query.customers.findMany({
			where: or(
				like(customers.name, searchPattern),
				like(customers.farmName, searchPattern),
				like(customers.county, searchPattern),
				like(customers.phone, searchPattern)
			),
			orderBy: [desc(customers.createdAt)]
		});
	} else {
		list = await db.query.customers.findMany({
			orderBy: [desc(customers.createdAt)]
		});
	}

	return c.json({ customers: list });
});

// Get customer profile alongside purchase history and State of Iowa compliance logs
customersRouter.get('/:id', async (c) => {
	const id = c.req.param('id');
	if (!c.env?.DB) return c.json({ error: 'DB not available' }, 500);
	const db = getDb(c.env.DB);

	const customer = await db.query.customers.findFirst({
		where: eq(customers.id, id),
		with: {
			invoices: {
				orderBy: [desc(invoices.issueDate)],
				limit: 20
			},
			complianceLogs: {
				orderBy: [desc(iowaComplianceLogs.verifiedAt)],
				limit: 20
			}
		}
	});

	if (!customer) {
		return c.json({ error: 'Customer not found' }, 404);
	}

	return c.json({ customer });
});

// Create new customer
customersRouter.post('/', async (c) => {
	const body = await c.req.json();
	if (!c.env?.DB) return c.json({ error: 'DB not available' }, 500);
	const db = getDb(c.env.DB);

	if (!body.name) {
		return c.json({ error: 'Customer name or Farm name is required' }, 400);
	}

	const newId = `cst_${crypto.randomUUID().slice(0, 8)}`;
	await db.insert(customers).values({
		id: newId,
		name: body.name,
		farmName: body.farmName || body.name,
		contactPerson: body.contactPerson,
		email: body.email,
		phone: body.phone,
		billingAddress: body.billingAddress,
		shippingAddress: body.shippingAddress || body.billingAddress,
		county: body.county || 'Story',
		state: body.state || 'IA',
		zipCode: body.zipCode,
		taxExemptNumber: body.taxExemptNumber,
		creditLimit: parseFloat(body.creditLimit) || 0,
		balance: 0,
		notes: body.notes,
		status: 'active'
	});

	const created = await db.query.customers.findFirst({
		where: eq(customers.id, newId)
	});

	return c.json({ success: true, customer: created }, 201);
});

// Update customer profile
customersRouter.put('/:id', async (c) => {
	const id = c.req.param('id');
	const body = await c.req.json();
	if (!c.env?.DB) return c.json({ error: 'DB not available' }, 500);
	const db = getDb(c.env.DB);

	await db
		.update(customers)
		.set({
			name: body.name,
			farmName: body.farmName,
			contactPerson: body.contactPerson,
			email: body.email,
			phone: body.phone,
			billingAddress: body.billingAddress,
			shippingAddress: body.shippingAddress,
			county: body.county,
			taxExemptNumber: body.taxExemptNumber,
			creditLimit: body.creditLimit !== undefined ? parseFloat(body.creditLimit) : undefined,
			notes: body.notes,
			status: body.status,
			updatedAt: new Date()
		})
		.where(eq(customers.id, id));

	const updated = await db.query.customers.findFirst({
		where: eq(customers.id, id)
	});

	return c.json({ success: true, customer: updated });
});
