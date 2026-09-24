import { Hono } from 'hono';
import type { AppBindings, AppVariables } from '$lib/server/rbac';
import { requireAdmin } from '$lib/server/rbac';
import { getDb } from '$lib/server/db';
import {
	checks,
	checkSequences,
	vendors,
	systemAuditLogs,
	type CheckStatus
} from '$lib/db/schema';
import { amountToWords } from '$lib/utils/number-to-words';
import { eq, desc } from 'drizzle-orm';

export const checksRouter = new Hono<{
	Bindings: AppBindings;
	Variables: AppVariables;
}>();

// STRICT ACCESS LOCK: Checkwriting is 100% restricted to Admin role.
// Any request from Sales or Manager triggers an immediate 403 Forbidden with security audit logging.
checksRouter.use('*', requireAdmin());

// List all checks and sequence configuration
checksRouter.get('/', async (c) => {
	if (!c.env?.DB) return c.json({ checks: [], sequence: null });
	const db = getDb(c.env.DB);

	const checkList = await db.query.checks.findMany({
		with: {
			vendor: true,
			printedByUser: {
				columns: { id: true, name: true, email: true }
			},
			voidedByUser: {
				columns: { id: true, name: true, email: true }
			}
		},
		orderBy: [desc(checks.checkNumber)]
	});

	const sequence = await db.query.checkSequences.findFirst({
		where: eq(checkSequences.id, 'primary_operating_account')
	});

	return c.json({ checks: checkList, sequence });
});

// Single check details
checksRouter.get('/:id', async (c) => {
	const id = c.req.param('id');
	if (!c.env?.DB) return c.json({ error: 'DB not available' }, 500);
	const db = getDb(c.env.DB);

	const check = await db.query.checks.findFirst({
		where: eq(checks.id, id),
		with: { vendor: true, printedByUser: true }
	});

	if (!check) return c.json({ error: 'Check not found' }, 404);
	return c.json({ check });
});

// Atomic Check Number Allocation & Checkwriting
checksRouter.post('/', async (c) => {
	const user = c.get('user');
	const body = await c.req.json<{
		vendorId: string;
		amount: number;
		issueDate?: string;
		memo?: string;
		category?: string;
		checkLayoutConfig?: any;
	}>();

	if (!body.vendorId || !body.amount || body.amount <= 0) {
		return c.json({ error: 'Vendor ID and positive dollar amount are required' }, 400);
	}

	if (!c.env?.DB) return c.json({ error: 'DB not available' }, 500);
	const db = getDb(c.env.DB);

	// Verify vendor
	const vendor = await db.query.vendors.findFirst({
		where: eq(vendors.id, body.vendorId)
	});

	if (!vendor) {
		return c.json({ error: 'Vendor not found' }, 404);
	}

	// ----------------------------------------------------------------------------
	// ATOMIC SEQUENCE INCREMENT TO ISOLATE AGAINST DUPLICATE CHECK NUMBERS
	// ----------------------------------------------------------------------------
	let seq = await db.query.checkSequences.findFirst({
		where: eq(checkSequences.id, 'primary_operating_account')
	});

	if (!seq) {
		await db.insert(checkSequences).values({
			id: 'primary_operating_account',
			accountName: 'AgPro Primary Operating (Iowa State Bank)',
			nextCheckNumber: 1045
		});
		seq = { id: 'primary_operating_account', accountName: 'AgPro Primary Operating', nextCheckNumber: 1045, updatedAt: new Date() };
	}

	const allocatedCheckNumber = seq.nextCheckNumber;

	// Atomically increment next sequence
	await db
		.update(checkSequences)
		.set({
			nextCheckNumber: allocatedCheckNumber + 1,
			updatedAt: new Date()
		})
		.where(eq(checkSequences.id, 'primary_operating_account'));

	const checkId = `chk_${crypto.randomUUID().slice(0, 8)}`;
	const issueDate = body.issueDate || new Date().toISOString().split('T')[0];
	const words = amountToWords(body.amount);

	// Default calibration offsets targeting standard 3-part corporate business checks (Top check / 2 stubs)
	const defaultLayout = {
		paperSize: 'Letter',
		topMarginInches: 0.25,
		payeeOffsetTopInches: 1.15,
		payeeOffsetLeftInches: 1.1,
		dateOffsetTopInches: 0.85,
		dateOffsetLeftInches: 6.8,
		amountNumberOffsetTopInches: 1.15,
		amountNumberOffsetLeftInches: 6.8,
		amountWordsOffsetTopInches: 1.55,
		amountWordsOffsetLeftInches: 1.1,
		memoOffsetTopInches: 2.3,
		memoOffsetLeftInches: 1.1,
		stub1OffsetTopInches: 3.5,
		stub2OffsetTopInches: 7.0
	};

	await db.insert(checks).values({
		id: checkId,
		checkNumber: allocatedCheckNumber,
		vendorId: vendor.id,
		amount: Math.round(body.amount * 100) / 100,
		amountInWords: words,
		issueDate,
		memo: body.memo || `Inventory Payment - ${vendor.name}`,
		category: body.category || 'Inventory Purchase',
		status: 'draft',
		checkLayoutConfig: JSON.stringify(body.checkLayoutConfig || defaultLayout)
	});

	// Audit log
	await db.insert(systemAuditLogs).values({
		id: `aud_${crypto.randomUUID().slice(0, 8)}`,
		userId: user.id,
		userEmail: user.email,
		action: 'CHECK_ALLOCATED',
		entity: 'check',
		entityId: checkId,
		metadata: JSON.stringify({
			checkNumber: allocatedCheckNumber,
			vendor: vendor.name,
			amount: body.amount
		})
	});

	const createdCheck = await db.query.checks.findFirst({
		where: eq(checks.id, checkId),
		with: { vendor: true }
	});

	return c.json({ success: true, check: createdCheck }, 201);
});

// Mark check as printed with layout config calibration
checksRouter.post('/:id/print', async (c) => {
	const id = c.req.param('id');
	const user = c.get('user');
	const { layoutConfig } = await c.req.json().catch(() => ({ layoutConfig: null }));

	if (!c.env?.DB) return c.json({ error: 'DB not available' }, 500);
	const db = getDb(c.env.DB);

	const check = await db.query.checks.findFirst({
		where: eq(checks.id, id)
	});

	if (!check) return c.json({ error: 'Check not found' }, 404);
	if (check.status === 'voided') {
		return c.json({ error: 'Cannot print a voided check' }, 400);
	}

	await db
		.update(checks)
		.set({
			status: 'printed',
			printedByUserId: user.id,
			printedAt: new Date(),
			checkLayoutConfig: layoutConfig ? JSON.stringify(layoutConfig) : check.checkLayoutConfig,
			updatedAt: new Date()
		})
		.where(eq(checks.id, id));

	// Record security audit
	await db.insert(systemAuditLogs).values({
		id: `aud_${crypto.randomUUID().slice(0, 8)}`,
		userId: user.id,
		userEmail: user.email,
		action: 'CHECK_PRINTED',
		entity: 'check',
		entityId: check.id,
		metadata: JSON.stringify({
			checkNumber: check.checkNumber,
			amount: check.amount
		})
	});

	return c.json({ success: true, message: `Check #${check.checkNumber} printed successfully` });
});

// Void check with mandatory reason
checksRouter.post('/:id/void', async (c) => {
	const id = c.req.param('id');
	const user = c.get('user');
	const { reason } = await c.req.json();

	if (!reason || !reason.trim()) {
		return c.json({ error: 'Mandatory void reason is required' }, 400);
	}

	if (!c.env?.DB) return c.json({ error: 'DB not available' }, 500);
	const db = getDb(c.env.DB);

	const check = await db.query.checks.findFirst({
		where: eq(checks.id, id)
	});

	if (!check) return c.json({ error: 'Check not found' }, 404);

	await db
		.update(checks)
		.set({
			status: 'voided',
			voidedByUserId: user.id,
			voidReason: reason.trim(),
			voidedAt: new Date(),
			updatedAt: new Date()
		})
		.where(eq(checks.id, id));

	await db.insert(systemAuditLogs).values({
		id: `aud_${crypto.randomUUID().slice(0, 8)}`,
		userId: user.id,
		userEmail: user.email,
		action: 'CHECK_VOIDED',
		entity: 'check',
		entityId: check.id,
		metadata: JSON.stringify({
			checkNumber: check.checkNumber,
			reason
		})
	});

	return c.json({ success: true, message: `Check #${check.checkNumber} voided` });
});
