import { Hono } from 'hono';
import type { AppBindings, AppVariables } from '$lib/server/rbac';
import { requireManagerOrAdmin } from '$lib/server/rbac';
import { getDb } from '$lib/server/db';
import {
	documentIngestionLogs,
	vendors,
	products,
	inventoryTransactions,
	iowaComplianceLogs,
	type IngestionSource
} from '$lib/db/schema';
import { parseDocumentPayload } from '$lib/server/parsers';
import { eq, desc } from 'drizzle-orm';

export const ingestionRouter = new Hono<{
	Bindings: AppBindings;
	Variables: AppVariables;
}>();

// Ingestion operations require Manager or Admin permissions
ingestionRouter.use('*', requireManagerOrAdmin());

// List recent ingestion history & logs
ingestionRouter.get('/logs', async (c) => {
	if (!c.env?.DB) return c.json({ logs: [] });
	const db = getDb(c.env.DB);

	const logs = await db.query.documentIngestionLogs.findMany({
		with: {
			vendor: true,
			uploadedByUser: {
				columns: { id: true, name: true, email: true }
			}
		},
		orderBy: [desc(documentIngestionLogs.createdAt)],
		limit: 50
	});

	return c.json({ logs });
});

// Main Ingestion & Auto-Import Endpoint with Cloudflare R2 Bucket Persistence
// Accepts JSON or multipart/form-data containing PDF, image, CSV, or text
ingestionRouter.post('/process', async (c) => {
	const user = c.get('user');
	if (!c.env?.DB) return c.json({ error: 'DB not available' }, 500);
	const db = getDb(c.env.DB);

	let fileName = 'payload.txt';
	let fileType = 'text/plain';
	let fileSize: number | undefined;
	let rawPayload = '';
	let fileBuffer: ArrayBuffer | null = null;
	let sourceHint: IngestionSource | undefined;
	let targetCustomerId: string | undefined;
	let autoCommitToInventory = true;

	const contentType = c.req.header('content-type') || '';

	if (contentType.includes('application/json')) {
		const json = await c.req.json();
		rawPayload = json.payloadRaw || json.text || '';
		fileName = json.fileName || 'document_upload.txt';
		fileType = 'text/plain';
		fileSize = new TextEncoder().encode(rawPayload).length;
		sourceHint = json.sourceHint;
		targetCustomerId = json.customerId;
		if (json.autoCommit !== undefined) autoCommitToInventory = !!json.autoCommit;
	} else if (contentType.includes('multipart/form-data')) {
		const formData = await c.req.formData();
		const file = formData.get('file') as File | null;
		sourceHint = (formData.get('sourceHint') as IngestionSource) || undefined;
		targetCustomerId = (formData.get('customerId') as string) || undefined;
		const autoCommitField = formData.get('autoCommit');
		if (autoCommitField !== null) autoCommitToInventory = autoCommitField === 'true';

		if (file) {
			fileName = file.name;
			fileType = file.type || 'application/octet-stream';
			fileSize = file.size;

			if (
				file.type.includes('text') ||
				file.name.endsWith('.txt') ||
				file.name.endsWith('.csv') ||
				file.name.endsWith('.json')
			) {
				rawPayload = await file.text();
				fileBuffer = await file.arrayBuffer();
			} else {
				// Binary documents (PDF, JPG, PNG, TIFF)
				fileBuffer = await file.arrayBuffer();
				const textSnippet = (formData.get('payloadRaw') as string) || '';
				rawPayload = textSnippet.trim()
					? textSnippet
					: `[BINARY DOCUMENT: ${file.name} (${file.type || 'application/octet-stream'}, ${(file.size / 1024).toFixed(1)} KB)]`;
			}
		} else {
			rawPayload = (formData.get('payloadRaw') as string) || '';
			fileSize = new TextEncoder().encode(rawPayload).length;
		}
	}

	if (!rawPayload.trim() && !fileBuffer) {
		return c.json({ error: 'Empty payload or document text provided' }, 400);
	}

	// 1. Execute Intelligent Parsing Engine
	const parseResult = parseDocumentPayload(rawPayload, sourceHint);

	// 2. Resolve or create vendor record
	let vendorRecord = await db.query.vendors.findFirst({
		where: eq(vendors.name, parseResult.vendorName)
	});

	if (!vendorRecord) {
		const newVendorId = `vnd_${crypto.randomUUID().slice(0, 8)}`;
		await db.insert(vendors).values({
			id: newVendorId,
			name: parseResult.vendorName,
			vendorCode: `${parseResult.source.toUpperCase().slice(0, 4)}-01`,
			paymentTerms: 'Net 30'
		});
		vendorRecord = await db.query.vendors.findFirst({
			where: eq(vendors.id, newVendorId)
		});
	}

	// 3. Create Document Ingestion Log
	const logId = `ing_${crypto.randomUUID().slice(0, 8)}`;
	await db.insert(documentIngestionLogs).values({
		id: logId,
		vendorId: vendorRecord?.id,
		source: parseResult.source,
		fileName,
		fileType,
		fileSize: fileSize || 0,
		payloadRaw: rawPayload.slice(0, 10000), // Cap raw snippet in log
		extractedAttributes: JSON.stringify(parseResult.items),
		extractedBolNumber: parseResult.iowaComplianceTokens?.bolNumber,
		extractedOrderNumber: parseResult.iowaComplianceTokens?.orderNumber,
		itemCount: parseResult.items.length,
		totalCostBasis: parseResult.totalCostBasis,
		status: 'processed',
		uploadedByUserId: user.id
	});

	// 4. Store Document Payload into Cloudflare R2 Bucket (DOCUMENTS -> agpro-documents)
	const storageKey = `documents/${logId}_${encodeURIComponent(fileName)}`;
	let r2Stored = false;

	if (c.env?.DOCUMENTS) {
		try {
			const bodyData: ArrayBuffer | Uint8Array = fileBuffer || new TextEncoder().encode(rawPayload);
			await c.env.DOCUMENTS.put(storageKey, bodyData, {
				httpMetadata: {
					contentType: fileType || 'application/octet-stream'
				},
				customMetadata: {
					logId,
					fileName,
					vendorName: parseResult.vendorName,
					source: parseResult.source,
					uploadedByUserId: user.id,
					bolNumber: parseResult.iowaComplianceTokens?.bolNumber || ''
				}
			});
			r2Stored = true;
		} catch (r2Err) {
			console.warn('Cloudflare R2 document storage write error:', r2Err);
		}
	}

	// 5. If Channel BOL contains Iowa compliance tokens, create/update Iowa Compliance Log
	if (parseResult.iowaComplianceTokens && targetCustomerId) {
		const compId = `log_ia_${crypto.randomUUID().slice(0, 8)}`;
		await db.insert(iowaComplianceLogs).values({
			id: compId,
			customerId: targetCustomerId,
			bolNumber: parseResult.iowaComplianceTokens.bolNumber,
			orderNumber: parseResult.iowaComplianceTokens.orderNumber,
			regulatedProduct: parseResult.items[0]?.name || 'Channel Regulated Seed',
			cropType: parseResult.items[0]?.name.toLowerCase().includes('bean') ? 'Soybeans' : 'Corn',
			lotNumber: parseResult.iowaComplianceTokens.lotNumbers?.[0] || 'LOT-AUTO-IA',
			quantity: parseResult.items.reduce((s, it) => s + it.quantity, 0),
			unit: parseResult.items[0]?.unit || 'unit',
			verifiedByUserId: user.id,
			complianceStatus: 'verified',
			auditNotes: `Auto-indexed from Channel Straight BOL (${fileName}). Stored in R2 (${storageKey}).`
		});
	}

	// 6. Automatically update or insert inventory products if autoCommit is enabled
	const importedProducts = [];
	if (autoCommitToInventory) {
		for (const item of parseResult.items) {
			const existing = await db.query.products.findFirst({
				where: eq(products.name, item.name)
			});

			if (existing) {
				// Update existing stock
				const newStock = existing.currentStock + item.quantity;
				await db
					.update(products)
					.set({
						currentStock: newStock,
						costBasis: item.costBasis,
						financedAppPrice: item.financedAppPrice || existing.financedAppPrice,
						cashAppPrice: item.cashAppPrice || existing.cashAppPrice,
						carryPrice: item.carryPrice || existing.carryPrice,
						updatedAt: new Date()
					})
					.where(eq(products.id, existing.id));

				await db.insert(inventoryTransactions).values({
					id: `txn_${crypto.randomUUID().slice(0, 8)}`,
					productId: existing.id,
					transactionType: 'purchase_intake',
					quantityChange: item.quantity,
					unitCostBasis: item.costBasis,
					referenceId: logId,
					performedByUserId: user.id,
					notes: `Intake from ${parseResult.vendorName} invoice (${fileName})`
				});

				importedProducts.push({ id: existing.id, name: existing.name, action: 'stock_incremented', newStock });
			} else {
				// Create new product record
				const newProdId = `prd_${crypto.randomUUID().slice(0, 8)}`;
				const sku = `${item.category.slice(0, 3).toUpperCase()}-${Date.now().toString().slice(-6)}`;

				await db.insert(products).values({
					id: newProdId,
					sku,
					name: item.name,
					category: item.category,
					vendorId: vendorRecord?.id,
					unit: item.unit,
					packageSize: item.packageSize || 1,
					costBasis: item.costBasis,
					financedAppPrice: item.financedAppPrice || Math.round((item.costBasis * 1.35 + 16) * 100) / 100,
					cashAppPrice: item.cashAppPrice || Math.round((item.costBasis * 1.25 + 13) * 100) / 100,
					carryPrice: item.carryPrice || Math.round((item.costBasis * 1.1) * 100) / 100,
					chemicalType: item.chemicalType,
					applicationMethod: item.applicationMethod,
					ratePerAcre: item.ratePerAcre,
					epaRegNumber: item.epaRegNumber,
					activeIngredients: item.activeIngredients,
					seedTrait: item.seedTrait,
					seedTreatment: item.seedTreatment,
					seedRelativeMaturity: item.seedRelativeMaturity,
					isRegulated: !!item.isRegulated,
					currentStock: item.quantity,
					reorderThreshold: 10,
					status: 'active'
				});

				await db.insert(inventoryTransactions).values({
					id: `txn_${crypto.randomUUID().slice(0, 8)}`,
					productId: newProdId,
					transactionType: 'initial_inventory',
					quantityChange: item.quantity,
					unitCostBasis: item.costBasis,
					referenceId: logId,
					performedByUserId: user.id,
					notes: `Initial auto-import from ${parseResult.vendorName}`
				});

				importedProducts.push({ id: newProdId, name: item.name, action: 'product_created', newStock: item.quantity });
			}
		}
	}

	return c.json({
		success: true,
		logId,
		fileName,
		r2Stored,
		storageKey,
		bucketName: 'agpro-documents',
		parseResult,
		importedProducts,
		iowaComplianceTokens: parseResult.iowaComplianceTokens || null
	});
});

// GET /api/ingestion/documents/:id/download - Stream/download original document from R2
ingestionRouter.get('/documents/:id/download', async (c) => {
	const id = c.req.param('id');
	if (!c.env?.DB) return c.json({ error: 'DB not available' }, 500);
	const db = getDb(c.env.DB);

	const log = await db.query.documentIngestionLogs.findFirst({
		where: eq(documentIngestionLogs.id, id)
	});

	if (!log) {
		return c.json({ error: 'Document ingestion record not found' }, 404);
	}

	const storageKey = `documents/${log.id}_${encodeURIComponent(log.fileName)}`;

	// Attempt retrieval from Cloudflare R2 bucket
	if (c.env?.DOCUMENTS) {
		try {
			const object = await c.env.DOCUMENTS.get(storageKey);
			if (object) {
				return new Response(object.body, {
					status: 200,
					headers: {
						'Content-Type': object.httpMetadata?.contentType || log.fileType || 'application/octet-stream',
						'Content-Disposition': `attachment; filename="${encodeURIComponent(log.fileName)}"`,
						'Content-Length': String(object.size),
						'ETag': object.httpEtag
					}
				});
			}
		} catch (r2Err) {
			console.warn('R2 retrieval error:', r2Err);
		}
	}

	// Fallback to raw text payload if R2 object unavailable or simulated in dev
	return new Response(log.payloadRaw || 'Document content unavailable', {
		status: 200,
		headers: {
			'Content-Type': log.fileType || 'text/plain',
			'Content-Disposition': `attachment; filename="${log.fileName}"`
		}
	});
});

// GET /api/ingestion/documents/:id/preview - In-browser preview of document from R2
ingestionRouter.get('/documents/:id/preview', async (c) => {
	const id = c.req.param('id');
	if (!c.env?.DB) return c.json({ error: 'DB not available' }, 500);
	const db = getDb(c.env.DB);

	const log = await db.query.documentIngestionLogs.findFirst({
		where: eq(documentIngestionLogs.id, id)
	});

	if (!log) {
		return c.json({ error: 'Document record not found' }, 404);
	}

	const storageKey = `documents/${log.id}_${encodeURIComponent(log.fileName)}`;

	if (c.env?.DOCUMENTS) {
		try {
			const object = await c.env.DOCUMENTS.get(storageKey);
			if (object) {
				return new Response(object.body, {
					status: 200,
					headers: {
						'Content-Type': object.httpMetadata?.contentType || log.fileType || 'application/octet-stream',
						'Content-Disposition': 'inline'
					}
				});
			}
		} catch (e) {
			console.warn('R2 preview error:', e);
		}
	}

	return new Response(log.payloadRaw || 'No preview available', {
		status: 200,
		headers: {
			'Content-Type': log.fileType || 'text/plain; charset=utf-8',
			'Content-Disposition': 'inline'
		}
	});
});
