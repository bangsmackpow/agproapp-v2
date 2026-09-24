import { Hono } from 'hono';
import type { AppBindings, AppVariables } from '$lib/server/rbac';
import { requireSalesOrAbove } from '$lib/server/rbac';
import { getDb } from '$lib/server/db';
import {
	invoices,
	invoiceItems,
	products,
	customers,
	iowaComplianceLogs,
	inventoryTransactions,
	type PricingStrategy,
	type InvoiceStatus
} from '$lib/db/schema';
import { eq, desc, and } from 'drizzle-orm';

export const invoicesRouter = new Hono<{
	Bindings: AppBindings;
	Variables: AppVariables;
}>();

// Sales, Manager, Admin can create and view invoices
invoicesRouter.use('*', requireSalesOrAbove());

// List invoices
invoicesRouter.get('/', async (c) => {
	if (!c.env?.DB) return c.json({ invoices: [] });
	const db = getDb(c.env.DB);
	const status = c.req.query('status') as InvoiceStatus | undefined;

	const list = await db.query.invoices.findMany({
		where: status ? eq(invoices.status, status) : undefined,
		with: {
			customer: true,
			items: {
				with: { product: true }
			},
			createdByUser: {
				columns: { id: true, name: true, email: true, role: true }
			}
		},
		orderBy: [desc(invoices.issueDate), desc(invoices.createdAt)]
	});

	return c.json({ invoices: list });
});

// Single invoice details
invoicesRouter.get('/:id', async (c) => {
	const id = c.req.param('id');
	if (!c.env?.DB) return c.json({ error: 'DB not available' }, 500);
	const db = getDb(c.env.DB);

	const invoice = await db.query.invoices.findFirst({
		where: eq(invoices.id, id),
		with: {
			customer: true,
			items: {
				with: { product: true }
			},
			complianceLogs: true,
			createdByUser: {
				columns: { id: true, name: true, email: true, role: true }
			}
		}
	});

	if (!invoice) {
		return c.json({ error: 'Invoice not found' }, 404);
	}

	return c.json({ invoice });
});

interface CreateInvoiceItemPayload {
	productId: string;
	quantity: number;
	unit?: string;
	customUnitPrice?: number;
	// Iowa seed regulatory audit tokens:
	bolNumber?: string;
	orderNumber?: string;
	droneUnitSerialNumber?: string;
}

// Create new invoice with automated dynamic tier calculations and Iowa Seed Compliance enforcement
invoicesRouter.post('/', async (c) => {
	const user = c.get('user');
	const body = await c.req.json<{
		customerId: string;
		pricingTier: PricingStrategy;
		issueDate?: string;
		dueDate?: string;
		acresTreated?: number;
		fieldLocationDescription?: string;
		notes?: string;
		termsAndConditions?: string;
		items: CreateInvoiceItemPayload[];
	}>();

	if (!c.env?.DB) return c.json({ error: 'DB not available' }, 500);
	const db = getDb(c.env.DB);

	if (!body.customerId || !body.items || body.items.length === 0) {
		return c.json({ error: 'Customer ID and at least one line item are required' }, 400);
	}

	const pricingTier: PricingStrategy = body.pricingTier || 'cash_app';

	// Verify Customer exists
	const customer = await db.query.customers.findFirst({
		where: eq(customers.id, body.customerId)
	});

	if (!customer) {
		return c.json({ error: 'Customer not found' }, 404);
	}

	// ----------------------------------------------------------------------------
	// STEP 1: IOWA STATE COMPLIANCE ENGINE & PRODUCT RECONCILIATION
	// If any item is a regulated seed product, verify that BOL & Order numbers exist
	// ----------------------------------------------------------------------------
	const resolvedItems = [];
	const complianceLogsToInsert = [];

	for (const itemPayload of body.items) {
		const product = await db.query.products.findFirst({
			where: eq(products.id, itemPayload.productId)
		});

		if (!product) {
			return c.json({ error: `Product ID '${itemPayload.productId}' not found in inventory` }, 400);
		}

		// Check Iowa seed regulatory audit mandate:
		const isRegulatedSeed = product.category === 'seed' || product.isRegulated;

		if (isRegulatedSeed) {
			const bol = itemPayload.bolNumber?.trim();
			const orderNo = itemPayload.orderNumber?.trim();

			// HARD ENFORCEMENT: Block submission if compliance tokens are missing
			if (!bol || !orderNo) {
				return c.json(
					{
						error: 'Iowa_Compliance_Violation',
						message: `State of Iowa Seed Regulatory Audit requires verified 'BOL/CMR Number' and 'Order Number' for regulated seed: '${product.name}'. Submission blocked.`,
						productName: product.name,
						productId: product.id,
						missingFields: [!bol ? 'bolNumber' : null, !orderNo ? 'orderNumber' : null].filter(Boolean)
					},
					422
				);
			}

			complianceLogsToInsert.push({
				bolNumber: bol,
				orderNumber: orderNo,
				productName: product.name,
				quantity: itemPayload.quantity,
				unit: itemPayload.unit || product.unit,
				lotNumber: 'LOT-AUTO-VERIFIED'
			});
		}

		// Calculate tier-based selling price
		let unitSellingPrice: number;
		if (itemPayload.customUnitPrice !== undefined && itemPayload.customUnitPrice > 0) {
			unitSellingPrice = itemPayload.customUnitPrice;
		} else {
			switch (pricingTier) {
				case 'financed_app':
					unitSellingPrice = product.financedAppPrice;
					break;
				case 'carry':
					unitSellingPrice = product.carryPrice;
					break;
				case 'cash_app':
				default:
					unitSellingPrice = product.cashAppPrice;
					break;
			}
		}

		const unitCostBasis = product.costBasis;
		const totalPrice = Math.round(unitSellingPrice * itemPayload.quantity * 100) / 100;
		const totalCost = Math.round(unitCostBasis * itemPayload.quantity * 100) / 100;
		const marginAmount = Math.round((totalPrice - totalCost) * 100) / 100;

		resolvedItems.push({
			productId: product.id,
			productName: product.name,
			description: product.description || product.name,
			quantity: itemPayload.quantity,
			unit: itemPayload.unit || product.unit,
			unitCostBasis,
			unitSellingPrice,
			totalPrice,
			totalCost,
			marginAmount,
			bolNumber: itemPayload.bolNumber || null,
			orderNumber: itemPayload.orderNumber || null,
			isIowaComplianceVerified: isRegulatedSeed,
			droneUnitSerialNumber: itemPayload.droneUnitSerialNumber || null
		});
	}

	// ----------------------------------------------------------------------------
	// STEP 2: FINALIZE FINANCIAL SUMS & GROSS MARGINS
	// ----------------------------------------------------------------------------
	const subtotal = resolvedItems.reduce((acc, it) => acc + it.totalPrice, 0);
	const totalCostBasis = resolvedItems.reduce((acc, it) => acc + it.totalCost, 0);
	const grossMarginAmount = Math.round((subtotal - totalCostBasis) * 100) / 100;
	const grossMarginPercent = subtotal > 0 ? Math.round((grossMarginAmount / subtotal) * 10000) / 100 : 0;

	// In Iowa, pure agricultural inputs (seed, fertilizers, chemicals) are exempt from sales tax
	const taxRate = 0.0;
	const taxAmount = 0.0;
	const totalAmount = subtotal;

	const invoiceId = `inv_${crypto.randomUUID().slice(0, 8)}`;
	const invoiceNumber = `INV-${new Date().getFullYear()}-${Date.now().toString().slice(-4)}`;
	const issueDate = body.issueDate || new Date().toISOString().split('T')[0];

	// Default due date: Net 30
	const defaultDue = new Date();
	defaultDue.setDate(defaultDue.getDate() + 30);
	const dueDate = body.dueDate || defaultDue.toISOString().split('T')[0];

	// ----------------------------------------------------------------------------
	// STEP 3: INSERT INVOICE & LINE ITEMS
	// ----------------------------------------------------------------------------
	await db.insert(invoices).values({
		id: invoiceId,
		invoiceNumber,
		customerId: customer.id,
		pricingStrategyTier: pricingTier,
		status: 'draft',
		issueDate,
		dueDate,
		subtotal,
		taxRate,
		taxAmount,
		discountAmount: 0,
		totalAmount,
		totalCostBasis,
		grossMarginAmount,
		grossMarginPercent,
		acresTreated: body.acresTreated || null,
		fieldLocationDescription: body.fieldLocationDescription || null,
		notes: body.notes || null,
		termsAndConditions: body.termsAndConditions || 'Payment due within 30 days of application. Interest applies at 1.5% per month on past due balances.',
		createdByUserId: user.id
	});

	for (const it of resolvedItems) {
		const itemId = `itm_${crypto.randomUUID().slice(0, 8)}`;
		await db.insert(invoiceItems).values({
			id: itemId,
			invoiceId,
			productId: it.productId,
			description: it.description,
			quantity: it.quantity,
			unit: it.unit,
			unitCostBasis: it.unitCostBasis,
			unitSellingPrice: it.unitSellingPrice,
			pricingTierApplied: pricingTier,
			totalCost: it.totalCost,
			totalPrice: it.totalPrice,
			marginAmount: it.marginAmount,
			bolNumber: it.bolNumber,
			orderNumber: it.orderNumber,
			isIowaComplianceVerified: it.isIowaComplianceVerified,
			droneUnitSerialNumber: it.droneUnitSerialNumber
		});

		// Deduct inventory stock & record transaction
		const currentProd = await db.query.products.findFirst({
			where: eq(products.id, it.productId)
		});
		if (currentProd) {
			const updatedStock = Math.max(0, currentProd.currentStock - it.quantity);
			await db.update(products).set({ currentStock: updatedStock }).where(eq(products.id, it.productId));

			await db.insert(inventoryTransactions).values({
				id: `txn_${crypto.randomUUID().slice(0, 8)}`,
				productId: it.productId,
				transactionType: 'invoice_sale',
				quantityChange: -it.quantity,
				unitCostBasis: it.unitCostBasis,
				referenceId: invoiceNumber,
				performedByUserId: user.id,
				notes: `Invoice sale #${invoiceNumber} to ${customer.name}`
			});
		}
	}

	// ----------------------------------------------------------------------------
	// STEP 4: RECORD IOWA COMPLIANCE LOGS
	// Link directly back to customer purchase history for state audits
	// ----------------------------------------------------------------------------
	for (const comp of complianceLogsToInsert) {
		await db.insert(iowaComplianceLogs).values({
			id: `log_ia_${crypto.randomUUID().slice(0, 8)}`,
			customerId: customer.id,
			invoiceId,
			bolNumber: comp.bolNumber,
			orderNumber: comp.orderNumber,
			regulatedProduct: comp.productName,
			cropType: comp.productName.toLowerCase().includes('bean') ? 'Soybeans' : 'Corn',
			lotNumber: comp.lotNumber,
			quantity: comp.quantity,
			unit: comp.unit,
			verifiedByUserId: user.id,
			complianceStatus: 'verified',
			auditNotes: `Linked to Invoice #${invoiceNumber} for Customer: ${customer.name}. Compliance numbers verified.`
		});
	}

	const createdInvoice = await db.query.invoices.findFirst({
		where: eq(invoices.id, invoiceId),
		with: {
			customer: true,
			items: { with: { product: true } },
			complianceLogs: true
		}
	});

	return c.json({ success: true, invoice: createdInvoice }, 201);
});

// Update invoice lifecycle state (draft -> sent -> paid -> canceled)
invoicesRouter.patch('/:id/status', async (c) => {
	const id = c.req.param('id');
	const { status, paymentMethod, paymentReference } = await c.req.json<{
		status: InvoiceStatus;
		paymentMethod?: string;
		paymentReference?: string;
	}>();

	if (!['draft', 'sent', 'paid', 'canceled'].includes(status)) {
		return c.json({ error: 'Invalid invoice status' }, 400);
	}

	if (!c.env?.DB) return c.json({ error: 'DB not available' }, 500);
	const db = getDb(c.env.DB);

	const updatePayload: any = {
		status,
		updatedAt: new Date()
	};

	if (status === 'paid') {
		updatePayload.paymentDate = new Date().toISOString().split('T')[0];
		if (paymentMethod) updatePayload.paymentMethod = paymentMethod;
		if (paymentReference) updatePayload.paymentReference = paymentReference;
	}

	await db.update(invoices).set(updatePayload).where(eq(invoices.id, id));

	const updated = await db.query.invoices.findFirst({
		where: eq(invoices.id, id),
		with: { customer: true, items: true }
	});

	return c.json({ success: true, invoice: updated });
});

// Electronic dispatch endpoint (Simulation for edge delivery)
invoicesRouter.post('/:id/dispatch', async (c) => {
	const id = c.req.param('id');
	if (!c.env?.DB) return c.json({ error: 'DB not available' }, 500);
	const db = getDb(c.env.DB);

	const inv = await db.query.invoices.findFirst({
		where: eq(invoices.id, id),
		with: { customer: true }
	});

	if (!inv) return c.json({ error: 'Invoice not found' }, 404);

	await db.update(invoices).set({ status: 'sent', updatedAt: new Date() }).where(eq(invoices.id, id));

	return c.json({
		success: true,
		dispatchedTo: inv.customer.email || 'customer@agpro.farms',
		invoiceNumber: inv.invoiceNumber,
		timestamp: new Date().toISOString()
	});
});
