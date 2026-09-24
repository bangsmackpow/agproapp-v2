import { Hono } from 'hono';
import type { AppBindings, AppVariables } from '$lib/server/rbac';
import { requireSalesOrAbove, requireManagerOrAdmin } from '$lib/server/rbac';
import { getDb } from '$lib/server/db';
import {
	products,
	droneUnits,
	inventoryTransactions,
	type ProductCategory,
	vendors
} from '$lib/db/schema';
import { eq, desc, like, and, or } from 'drizzle-orm';

export const inventoryRouter = new Hono<{
	Bindings: AppBindings;
	Variables: AppVariables;
}>();

// Read operations: Sales, Manager, Admin can view inventory
inventoryRouter.get('/', requireSalesOrAbove(), async (c) => {
	if (!c.env?.DB) return c.json({ products: [] });
	const db = getDb(c.env.DB);

	const category = c.req.query('category') as ProductCategory | undefined;
	const q = c.req.query('q')?.trim();

	const conditions = [];

	if (category && ['chemical', 'seed', 'drone', 'misc'].includes(category)) {
		conditions.push(eq(products.category, category));
	}

	if (q) {
		const searchPattern = `%${q}%`;
		conditions.push(
			or(
				like(products.name, searchPattern),
				like(products.sku, searchPattern),
				like(products.chemicalType, searchPattern),
				like(products.seedTrait, searchPattern),
				like(products.droneModel, searchPattern)
			)
		);
	}

	const list = await db.query.products.findMany({
		where: conditions.length > 0 ? and(...conditions) : undefined,
		with: {
			vendor: true
		},
		orderBy: [desc(products.createdAt)]
	});

	return c.json({ products: list });
});

// Single product details
inventoryRouter.get('/:id', requireSalesOrAbove(), async (c) => {
	const id = c.req.param('id');
	if (!c.env?.DB) return c.json({ error: 'DB not available' }, 500);
	const db = getDb(c.env.DB);

	const product = await db.query.products.findFirst({
		where: eq(products.id, id),
		with: {
			vendor: true,
			droneUnits: true,
			transactions: {
				orderBy: [desc(inventoryTransactions.createdAt)],
				limit: 25
			}
		}
	});

	if (!product) {
		return c.json({ error: 'Product not found' }, 404);
	}

	return c.json({ product });
});

// Serialized Drone Inventory List
inventoryRouter.get('/fleet/drones', requireSalesOrAbove(), async (c) => {
	if (!c.env?.DB) return c.json({ drones: [] });
	const db = getDb(c.env.DB);

	const fleet = await db.query.droneUnits.findMany({
		with: {
			product: true,
			customer: true
		},
		orderBy: [desc(droneUnits.createdAt)]
	});

	return c.json({ drones: fleet });
});

// ----------------------------------------------------------------------------
// WRITE OPERATIONS: Strictly restricted to Manager and Admin
// Sales role will be blocked by requireManagerOrAdmin middleware
// ----------------------------------------------------------------------------

// Create new product
inventoryRouter.post('/', requireManagerOrAdmin(), async (c) => {
	const body = await c.req.json();
	const user = c.get('user');
	if (!c.env?.DB) return c.json({ error: 'DB not available' }, 500);
	const db = getDb(c.env.DB);

	if (!body.name || !body.category || body.costBasis === undefined) {
		return c.json({ error: 'Missing mandatory fields: name, category, costBasis' }, 400);
	}

	const cost = parseFloat(body.costBasis);
	const newId = `prd_${crypto.randomUUID().slice(0, 8)}`;
	const sku = body.sku || `${body.category.slice(0, 3).toUpperCase()}-${Date.now().toString().slice(-6)}`;

	// Apply automated markup formulas if not explicitly overridden
	const financedAppPrice = body.financedAppPrice !== undefined
		? parseFloat(body.financedAppPrice)
		: Math.round((cost * 1.35 + 16.0) * 100) / 100;

	const cashAppPrice = body.cashAppPrice !== undefined
		? parseFloat(body.cashAppPrice)
		: Math.round((cost * 1.25 + 13.0) * 100) / 100;

	const carryPrice = body.carryPrice !== undefined
		? parseFloat(body.carryPrice)
		: Math.round((cost * 1.1) * 100) / 100;

	await db.insert(products).values({
		id: newId,
		sku,
		name: body.name,
		category: body.category,
		vendorId: body.vendorId,
		description: body.description,
		unit: body.unit || 'unit',
		packageSize: body.packageSize ? parseFloat(body.packageSize) : null,
		costBasis: cost,
		financedAppPrice,
		cashAppPrice,
		carryPrice,
		// Chemical fields
		chemicalType: body.chemicalType,
		applicationMethod: body.applicationMethod,
		ratePerAcre: body.ratePerAcre,
		costPerAcre: body.costPerAcre ? parseFloat(body.costPerAcre) : null,
		epaRegNumber: body.epaRegNumber,
		activeIngredients: body.activeIngredients,
		// Seed fields
		seedTrait: body.seedTrait,
		seedTreatment: body.seedTreatment,
		seedRelativeMaturity: body.seedRelativeMaturity,
		isRegulated: body.category === 'seed' || !!body.isRegulated,
		// Drone fields
		droneModel: body.droneModel,
		payloadCapacityKg: body.payloadCapacityKg ? parseFloat(body.payloadCapacityKg) : null,
		swathWidthMeters: body.swathWidthMeters ? parseFloat(body.swathWidthMeters) : null,
		currentStock: body.currentStock ? parseFloat(body.currentStock) : 0,
		reorderThreshold: body.reorderThreshold ? parseFloat(body.reorderThreshold) : 0,
		status: 'active'
	});

	// Record initial transaction
	if (body.currentStock && parseFloat(body.currentStock) > 0) {
		await db.insert(inventoryTransactions).values({
			id: `txn_${crypto.randomUUID().slice(0, 8)}`,
			productId: newId,
			transactionType: 'initial_inventory',
			quantityChange: parseFloat(body.currentStock),
			unitCostBasis: cost,
			performedByUserId: user.id,
			notes: 'Initial stock intake upon product creation'
		});
	}

	const created = await db.query.products.findFirst({
		where: eq(products.id, newId)
	});

	return c.json({ success: true, product: created }, 201);
});

// Update product & pricing tiers
inventoryRouter.put('/:id', requireManagerOrAdmin(), async (c) => {
	const id = c.req.param('id');
	const body = await c.req.json();
	if (!c.env?.DB) return c.json({ error: 'DB not available' }, 500);
	const db = getDb(c.env.DB);

	await db
		.update(products)
		.set({
			name: body.name,
			sku: body.sku,
			description: body.description,
			unit: body.unit,
			packageSize: body.packageSize !== undefined ? parseFloat(body.packageSize) : undefined,
			costBasis: body.costBasis !== undefined ? parseFloat(body.costBasis) : undefined,
			financedAppPrice: body.financedAppPrice !== undefined ? parseFloat(body.financedAppPrice) : undefined,
			cashAppPrice: body.cashAppPrice !== undefined ? parseFloat(body.cashAppPrice) : undefined,
			carryPrice: body.carryPrice !== undefined ? parseFloat(body.carryPrice) : undefined,
			chemicalType: body.chemicalType,
			applicationMethod: body.applicationMethod,
			ratePerAcre: body.ratePerAcre,
			costPerAcre: body.costPerAcre !== undefined ? parseFloat(body.costPerAcre) : undefined,
			epaRegNumber: body.epaRegNumber,
			activeIngredients: body.activeIngredients,
			seedTrait: body.seedTrait,
			seedTreatment: body.seedTreatment,
			seedRelativeMaturity: body.seedRelativeMaturity,
			isRegulated: body.isRegulated !== undefined ? !!body.isRegulated : undefined,
			droneModel: body.droneModel,
			reorderThreshold: body.reorderThreshold !== undefined ? parseFloat(body.reorderThreshold) : undefined,
			status: body.status,
			updatedAt: new Date()
		})
		.where(eq(products.id, id));

	const updated = await db.query.products.findFirst({
		where: eq(products.id, id)
	});

	return c.json({ success: true, product: updated });
});

// Adjust stock quantity with ledger audit record
inventoryRouter.post('/:id/adjust-stock', requireManagerOrAdmin(), async (c) => {
	const id = c.req.param('id');
	const { quantityChange, transactionType, notes } = await c.req.json();
	const user = c.get('user');

	if (!quantityChange || isNaN(quantityChange)) {
		return c.json({ error: 'Valid quantityChange number is required' }, 400);
	}

	if (!c.env?.DB) return c.json({ error: 'DB not available' }, 500);
	const db = getDb(c.env.DB);

	const product = await db.query.products.findFirst({
		where: eq(products.id, id)
	});

	if (!product) {
		return c.json({ error: 'Product not found' }, 404);
	}

	const newStock = Math.max(0, product.currentStock + parseFloat(quantityChange));

	await db
		.update(products)
		.set({
			currentStock: newStock,
			updatedAt: new Date()
		})
		.where(eq(products.id, id));

	await db.insert(inventoryTransactions).values({
		id: `txn_${crypto.randomUUID().slice(0, 8)}`,
		productId: id,
		transactionType: transactionType || 'manual_adjustment',
		quantityChange: parseFloat(quantityChange),
		unitCostBasis: product.costBasis,
		performedByUserId: user.id,
		notes: notes || 'Manual inventory adjustment'
	});

	return c.json({
		success: true,
		currentStock: newStock,
		delta: parseFloat(quantityChange)
	});
});

// Register serialized drone unit
inventoryRouter.post('/fleet/drones', requireManagerOrAdmin(), async (c) => {
	const body = await c.req.json();
	if (!body.productId || !body.serialNumber) {
		return c.json({ error: 'productId and serialNumber are required' }, 400);
	}

	if (!c.env?.DB) return c.json({ error: 'DB not available' }, 500);
	const db = getDb(c.env.DB);

	const unitId = `drn_${crypto.randomUUID().slice(0, 8)}`;
	await db.insert(droneUnits).values({
		id: unitId,
		productId: body.productId,
		serialNumber: body.serialNumber,
		aircraftRegistration: body.aircraftRegistration,
		remoteControlSerial: body.remoteControlSerial,
		batterySerialNumbers: body.batterySerialNumbers ? JSON.stringify(body.batterySerialNumbers) : null,
		flightHoursTotal: body.flightHoursTotal ? parseFloat(body.flightHoursTotal) : 0,
		firmwareVersion: body.firmwareVersion || 'v01.00.00',
		condition: body.condition || 'new',
		notes: body.notes
	});

	const created = await db.query.droneUnits.findFirst({
		where: eq(droneUnits.id, unitId),
		with: { product: true }
	});

	return c.json({ success: true, droneUnit: created }, 201);
});
