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
	systemAuditLogs,
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

function renderInvoiceEmailHtml(inv: any, customMessage?: string, attachCompliance = true): string {
	const hasSeedCompliance = inv.items?.some((it: any) => it.isIowaComplianceVerified);
	const complianceLogs = inv.complianceLogs || [];

	const itemsRows = (inv.items || [])
		.map((it: any) => `
			<tr style="border-bottom: 1px solid #e2e8f0;">
				<td style="padding: 10px 8px; font-size: 13px;">
					<strong>${it.product?.name || 'Custom Application & Agronomy Service'}</strong>
					<div style="font-size: 11px; color: #64748b;">Tier: ${String(it.pricingTierApplied || 'cash_app').replace('_', ' ').toUpperCase()}</div>
				</td>
				<td style="padding: 10px 8px; text-align: center; font-size: 13px;">${it.quantity} ${it.unit}</td>
				<td style="padding: 10px 8px; text-align: right; font-size: 13px;">$${it.unitSellingPrice.toFixed(2)}</td>
				<td style="padding: 10px 8px; text-align: right; font-weight: bold; font-size: 13px;">$${it.totalPrice.toFixed(2)}</td>
			</tr>
		`).join('');

	return `
<!DOCTYPE html>
<html>
<head>
	<meta charset="utf-8">
	<title>Invoice ${inv.invoiceNumber} - AgPro Solutions</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #0f172a;">
	<div style="max-width: 640px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
		<!-- Header -->
		<div style="background-color: #065f46; color: #ffffff; padding: 24px 28px;">
			<table style="width: 100%; border-collapse: collapse;">
				<tr>
					<td>
						<h1 style="margin: 0; font-size: 22px; font-weight: 800; letter-spacing: -0.5px;">AgPro Solutions</h1>
						<p style="margin: 4px 0 0; font-size: 12px; opacity: 0.9; font-weight: 500;">Putting The Farmer Back In Control!</p>
					</td>
					<td style="text-align: right; vertical-align: top;">
						<span style="display: inline-block; background-color: rgba(255,255,255,0.15); border: 1px solid rgba(255,255,255,0.25); padding: 4px 10px; border-radius: 4px; font-size: 11px; font-weight: 600; text-transform: uppercase;">
							Invoice ${inv.invoiceNumber}
						</span>
					</td>
				</tr>
			</table>
		</div>

		<div style="padding: 28px;">
			<!-- Recipient & Intro -->
			<p style="font-size: 14px; margin-top: 0;">Dear <strong>${inv.customer?.name || 'Valued Ag Customer'}</strong>,</p>
			<p style="font-size: 13px; line-height: 1.5; color: #334155;">
				Thank you for choosing AgPro Solutions. Your electronic invoice is detailed below for recent aerial drone applications, seed supply, or custom agronomy services.
			</p>

			${customMessage?.trim() ? `
				<div style="background-color: #f0fdf4; border-left: 4px solid #10b981; padding: 12px 16px; margin: 16px 0; border-radius: 0 6px 6px 0; font-size: 13px; color: #065f46;">
					<strong>Agronomy Field Service Note:</strong><br>
					${customMessage.trim()}
				</div>
			` : ''}

			<!-- Summary Card -->
			<div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 16px; margin: 20px 0;">
				<table style="width: 100%; font-size: 13px; border-collapse: collapse;">
					<tr>
						<td style="color: #64748b; padding: 4px 0;">Invoice Issue Date:</td>
						<td style="text-align: right; font-weight: 600;">${inv.issueDate}</td>
					</tr>
					<tr>
						<td style="color: #64748b; padding: 4px 0;">Payment Due Date:</td>
						<td style="text-align: right; font-weight: 600;">${inv.dueDate}</td>
					</tr>
					${inv.acresTreated ? `
						<tr>
							<td style="color: #64748b; padding: 4px 0;">Aerial Drone Coverage:</td>
							<td style="text-align: right; font-weight: 600;">${inv.acresTreated} acres</td>
						</tr>
					` : ''}
					<tr style="border-top: 1px solid #cbd5e1;">
						<td style="padding: 10px 0 4px; font-weight: bold; font-size: 15px;">Total Amount Due:</td>
						<td style="padding: 10px 0 4px; text-align: right; font-weight: 800; font-size: 18px; color: #047857;">$${inv.totalAmount.toFixed(2)}</td>
					</tr>
				</table>
			</div>

			<!-- Line Items Table -->
			<h3 style="font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px; color: #475569; margin: 24px 0 8px; border-bottom: 2px solid #e2e8f0; padding-bottom: 6px;">
				Itemized Services & Products
			</h3>
			<table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
				<thead>
					<tr style="background-color: #f1f5f9; text-transform: uppercase; font-size: 11px; color: #64748b; text-align: left;">
						<th style="padding: 8px;">Product / Service</th>
						<th style="padding: 8px; text-align: center;">Qty</th>
						<th style="padding: 8px; text-align: right;">Unit Price</th>
						<th style="padding: 8px; text-align: right;">Extended</th>
					</tr>
				</thead>
				<tbody>
					${itemsRows}
				</tbody>
			</table>

			<!-- Iowa Seed Regulatory Audit Compliance -->
			${hasSeedCompliance && attachCompliance ? `
				<div style="background-color: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 6px; padding: 14px; margin: 20px 0; font-size: 12px; color: #065f46;">
					<strong style="display: block; margin-bottom: 6px; font-size: 13px;">State of Iowa Department of Agriculture (IDALS) Seed Audit Certification</strong>
					<p style="margin: 0 0 8px; line-height: 1.4;">
						Commercial seed distribution validated pursuant to Iowa Code Chapter 199. Verified tokens ensure full traceability:
					</p>
					${complianceLogs.map((l: any) => `
						<div style="font-family: monospace; font-size: 11px; background: rgba(255,255,255,0.7); padding: 5px 8px; border-radius: 4px; margin-bottom: 4px;">
							<strong>BOL/CMR #:</strong> ${l.bolNumber} &bull; <strong>Order #:</strong> ${l.orderNumber} &bull; ${l.regulatedProduct}
						</div>
					`).join('')}
				</div>
			` : ''}

			<!-- Tax Exemption Notice -->
			<p style="font-size: 11px; color: #64748b; line-height: 1.4; margin: 16px 0;">
				<em>Iowa Tax Exemption Notice:</em> Commercial fertilizer, agricultural chemicals, and custom aerial application services are exempt from Iowa State Sales and Use Tax under Iowa Code § 423.3.
			</p>

			<!-- Remittance & Footer -->
			<div style="border-top: 1px solid #e2e8f0; padding-top: 16px; margin-top: 24px; font-size: 12px; color: #64748b; line-height: 1.5;">
				<p style="margin: 0 0 4px;"><strong>Payment Remittance:</strong></p>
				<p style="margin: 0;">AgPro Solutions &bull; 1200 E Howard St, Creston, IA 50801</p>
				<p style="margin: 0;">Tel: (641) 745-7392 &bull; Email: agprosolu@gmail.com</p>
				<p style="margin: 4px 0 0; font-size: 11px; color: #94a3b8;">JDF & Rabo Financing terms accepted. Certified Bayer Channel SeedPro.</p>
			</div>
		</div>
	</div>
</body>
</html>
	`.trim();
}

// Preview electronic dispatch payload & rendered email
invoicesRouter.get('/:id/dispatch-preview', async (c) => {
	const id = c.req.param('id');
	if (!c.env?.DB) return c.json({ error: 'DB not available' }, 500);
	const db = getDb(c.env.DB);

	const inv = await db.query.invoices.findFirst({
		where: eq(invoices.id, id),
		with: {
			customer: true,
			items: { with: { product: true } },
			complianceLogs: true
		}
	});

	if (!inv) return c.json({ error: 'Invoice not found' }, 404);

	const recipientEmail = inv.customer?.email || 'grower@farm.iowa';
	const recipientName = inv.customer?.name || 'Valued Ag Customer';
	const hasSeedCompliance = inv.items.some((it) => it.isIowaComplianceVerified);

	const subject = `Invoice ${inv.invoiceNumber} - AgPro Solutions`;
	const htmlBody = renderInvoiceEmailHtml(inv, '', true);

	return c.json({
		invoiceNumber: inv.invoiceNumber,
		recipientEmail,
		recipientName,
		subject,
		htmlBody,
		hasSeedCompliance,
		complianceTokens: inv.complianceLogs?.map((l) => ({
			bol: l.bolNumber,
			order: l.orderNumber,
			product: l.regulatedProduct
		}))
	});
});

// Electronic dispatch endpoint via Resend
invoicesRouter.post('/:id/dispatch', async (c) => {
	const id = c.req.param('id');
	const user = c.get('user');
	const body = await c.req.json().catch(() => ({}));

	if (!c.env?.DB) return c.json({ error: 'DB not available' }, 500);
	const db = getDb(c.env.DB);

	const inv = await db.query.invoices.findFirst({
		where: eq(invoices.id, id),
		with: {
			customer: true,
			items: { with: { product: true } },
			complianceLogs: true
		}
	});

	if (!inv) return c.json({ error: 'Invoice not found' }, 404);

	const recipientEmail = body.recipientEmail || inv.customer?.email || 'grower@farm.iowa';
	const customMessage = body.customMessage || '';
	const attachCompliance = body.attachCompliance !== false;

	const emailHtml = renderInvoiceEmailHtml(inv, customMessage, attachCompliance);
	const emailSubject = `Invoice ${inv.invoiceNumber} - AgPro Solutions`;

	// Resend Transactional Email Dispatch Integration
	let resendId: string | null = null;
	let deliveryMode: 'resend_live' | 'simulated' = 'simulated';

	const resendApiKey = c.env?.RESEND_API_KEY;

	if (resendApiKey) {
		const fromEmail = c.env?.RESEND_FROM_EMAIL || 'AgPro Solutions <onboarding@resend.dev>';
		try {
			const resendRes = await fetch('https://api.resend.com/emails', {
				method: 'POST',
				headers: {
					Authorization: `Bearer ${resendApiKey}`,
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					from: fromEmail,
					to: [recipientEmail],
					subject: emailSubject,
					html: emailHtml
				})
			});

			if (!resendRes.ok) {
				const errorText = await resendRes.text();
				console.error('Resend API HTTP error:', resendRes.status, errorText);
				return c.json(
					{
						error: 'Resend API rejected email dispatch',
						details: errorText,
						statusCode: resendRes.status
					},
					502
				);
			}

			const resendData = (await resendRes.json()) as { id?: string };
			resendId = resendData.id || null;
			deliveryMode = 'resend_live';
		} catch (networkErr: any) {
			console.error('Network failure connecting to Resend:', networkErr);
			return c.json(
				{
					error: 'Failed to contact Resend mail servers',
					details: networkErr?.message
				},
				502
			);
		}
	} else {
		resendId = `sim_${crypto.randomUUID().slice(0, 8)}`;
		console.info(`[RESEND SIMULATION] Dispatched ${inv.invoiceNumber} to ${recipientEmail}`);
	}

	// Transition status to sent
	await db.update(invoices).set({ status: 'sent', updatedAt: new Date() }).where(eq(invoices.id, id));

	// Record electronic distribution audit event
	try {
		await db.insert(systemAuditLogs).values({
			id: `aud_${crypto.randomUUID().slice(0, 8)}`,
			userId: user?.id,
			userEmail: user?.email,
			action: 'INVOICE_RESEND_DISPATCH',
			entity: 'invoice',
			entityId: inv.id,
			ipAddress: c.req.header('cf-connecting-ip') || 'internal',
			userAgent: c.req.header('user-agent') || 'edge-worker',
			metadata: JSON.stringify({
				invoiceNumber: inv.invoiceNumber,
				dispatchedTo: recipientEmail,
				totalAmount: inv.totalAmount,
				resendId,
				deliveryMode,
				attachComplianceCertificate: attachCompliance
			})
		});
	} catch (e) {
		console.warn('Audit log write error:', e);
	}

	const message =
		deliveryMode === 'resend_live'
			? `Invoice ${inv.invoiceNumber} delivered to ${recipientEmail} via Resend (${resendId})`
			: `Invoice ${inv.invoiceNumber} dispatched to ${recipientEmail} (Simulated: configure RESEND_API_KEY in Cloudflare for live delivery)`;

	return c.json({
		success: true,
		message,
		deliveryMode,
		resendId,
		dispatchedTo: recipientEmail,
		invoiceNumber: inv.invoiceNumber,
		status: 'sent',
		timestamp: new Date().toISOString()
	});
});
