import { sqliteTable, text, integer, real, index, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { relations, sql } from 'drizzle-orm';

// ============================================================================
// 1. AUTHENTICATION & ACCESS CONTROL (BETTER AUTH + RBAC)
// ============================================================================

export const userRoleEnum = ['sales', 'manager', 'admin'] as const;
export type UserRole = (typeof userRoleEnum)[number];

export const userStatusEnum = ['active', 'suspended', 'invited'] as const;
export type UserStatus = (typeof userStatusEnum)[number];

export const users = sqliteTable(
	'user',
	{
		id: text('id').primaryKey(),
		name: text('name').notNull(),
		email: text('email').notNull().unique(),
		emailVerified: integer('email_verified', { mode: 'boolean' }).notNull().default(false),
		image: text('image'),
		role: text('role', { enum: userRoleEnum }).notNull().default('sales'),
		status: text('status', { enum: userStatusEnum }).notNull().default('active'),
		createdAt: integer('created_at', { mode: 'timestamp_ms' })
			.notNull()
			.default(sql`(strftime('%s', 'now') * 1000)`),
		updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
			.notNull()
			.default(sql`(strftime('%s', 'now') * 1000)`)
	},
	(table) => ({
		emailIdx: uniqueIndex('user_email_idx').on(table.email),
		roleIdx: index('user_role_idx').on(table.role)
	})
);

export const sessions = sqliteTable(
	'session',
	{
		id: text('id').primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		token: text('token').notNull().unique(),
		expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
		ipAddress: text('ip_address'),
		userAgent: text('user_agent'),
		createdAt: integer('created_at', { mode: 'timestamp_ms' })
			.notNull()
			.default(sql`(strftime('%s', 'now') * 1000)`),
		updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
			.notNull()
			.default(sql`(strftime('%s', 'now') * 1000)`)
	},
	(table) => ({
		tokenIdx: uniqueIndex('session_token_idx').on(table.token),
		userIdx: index('session_user_idx').on(table.userId)
	})
);

export const accounts = sqliteTable(
	'account',
	{
		id: text('id').primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		accountId: text('account_id').notNull(),
		providerId: text('provider_id').notNull(),
		accessToken: text('access_token'),
		refreshToken: text('refresh_token'),
		accessTokenExpiresAt: integer('access_token_expires_at', { mode: 'timestamp_ms' }),
		refreshTokenExpiresAt: integer('refresh_token_expires_at', { mode: 'timestamp_ms' }),
		scope: text('scope'),
		idToken: text('id_token'),
		password: text('password'),
		createdAt: integer('created_at', { mode: 'timestamp_ms' })
			.notNull()
			.default(sql`(strftime('%s', 'now') * 1000)`),
		updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
			.notNull()
			.default(sql`(strftime('%s', 'now') * 1000)`)
	},
	(table) => ({
		userIdx: index('account_user_idx').on(table.userId),
		providerIdx: index('account_provider_idx').on(table.providerId, table.accountId)
	})
);

export const verifications = sqliteTable(
	'verification',
	{
		id: text('id').primaryKey(),
		identifier: text('identifier').notNull(),
		value: text('value').notNull(),
		expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
		createdAt: integer('created_at', { mode: 'timestamp_ms' })
			.notNull()
			.default(sql`(strftime('%s', 'now') * 1000)`),
		updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
			.notNull()
			.default(sql`(strftime('%s', 'now') * 1000)`)
	},
	(table) => ({
		identifierIdx: index('verification_identifier_idx').on(table.identifier)
	})
);

// ============================================================================
// 2. CRM & IOWA COMPLIANCE AUDIT ENGINE
// ============================================================================

export const customerStatusEnum = ['active', 'inactive', 'on_hold'] as const;
export type CustomerStatus = (typeof customerStatusEnum)[number];

export const customers = sqliteTable(
	'customers',
	{
		id: text('id').primaryKey(),
		name: text('name').notNull(), // Grower or Farm Legal Name
		farmName: text('farm_name'), // e.g., "Prairie Ridge Farms LLC"
		contactPerson: text('contact_person'),
		email: text('email'),
		phone: text('phone'),
		billingAddress: text('billing_address'),
		shippingAddress: text('shipping_address'), // Field shop / staging point
		county: text('county'), // Iowa County (e.g. Story, Hamilton, Hardin, Boone)
		state: text('state').default('IA').notNull(),
		zipCode: text('zip_code'),
		taxExemptNumber: text('tax_exempt_number'), // Iowa Ag Tax Exemption ID
		creditLimit: real('credit_limit').default(0).notNull(),
		balance: real('balance').default(0).notNull(),
		notes: text('notes'),
		status: text('status', { enum: customerStatusEnum }).default('active').notNull(),
		createdAt: integer('created_at', { mode: 'timestamp_ms' })
			.notNull()
			.default(sql`(strftime('%s', 'now') * 1000)`),
		updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
			.notNull()
			.default(sql`(strftime('%s', 'now') * 1000)`)
	},
	(table) => ({
		nameIdx: index('customer_name_idx').on(table.name),
		countyIdx: index('customer_county_idx').on(table.county),
		phoneIdx: index('customer_phone_idx').on(table.phone)
	})
);

export const complianceStatusEnum = ['pending', 'verified', 'flagged'] as const;
export type ComplianceStatus = (typeof complianceStatusEnum)[number];

/**
 * Iowa State Compliance Engine:
 * Satisfies State of Iowa Department of Agriculture & Land Stewardship (IDALS)
 * seed and regulated chemical audit criteria. Tracks Channel Straight BOL/CMR and Order numbers.
 */
export const iowaComplianceLogs = sqliteTable(
	'iowa_compliance_logs',
	{
		id: text('id').primaryKey(),
		customerId: text('customer_id')
			.notNull()
			.references(() => customers.id),
		invoiceId: text('invoice_id').references(() => invoices.id),
		invoiceItemId: text('invoice_item_id').references(() => invoiceItems.id),
		// Regulatory Iowa Audit Tokens:
		bolNumber: text('bol_number').notNull(), // Channel Straight BOL/CMR Number
		orderNumber: text('order_number').notNull(), // Manufacturer Order Number
		regulatedProduct: text('regulated_product').notNull(), // e.g. Channel Corn Seed, Enlist E3 Soybean
		cropType: text('crop_type'), // Corn, Soybeans, etc.
		lotNumber: text('lot_number'),
		treatmentTag: text('treatment_tag'), // Seed treatment / fungicide / insecticide tag
		quantity: real('quantity').notNull(),
		unit: text('unit').notNull(), // 'Bags', 'Units', 'Totes'
		verifiedByUserId: text('verified_by_user_id')
			.notNull()
			.references(() => users.id),
		verifiedAt: integer('verified_at', { mode: 'timestamp_ms' })
			.notNull()
			.default(sql`(strftime('%s', 'now') * 1000)`),
		complianceStatus: text('compliance_status', { enum: complianceStatusEnum })
			.notNull()
			.default('verified'),
		auditNotes: text('audit_notes'),
		createdAt: integer('created_at', { mode: 'timestamp_ms' })
			.notNull()
			.default(sql`(strftime('%s', 'now') * 1000)`),
		updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
			.notNull()
			.default(sql`(strftime('%s', 'now') * 1000)`)
	},
	(table) => ({
		bolIdx: index('compliance_bol_idx').on(table.bolNumber),
		orderIdx: index('compliance_order_idx').on(table.orderNumber),
		customerIdx: index('compliance_customer_idx').on(table.customerId),
		invoiceIdx: index('compliance_invoice_idx').on(table.invoiceId)
	})
);

// ============================================================================
// 3. VENDORS & INTELLIGENT INGESTION LEDGER
// ============================================================================

export const vendors = sqliteTable(
	'vendors',
	{
		id: text('id').primaryKey(),
		name: text('name').notNull(), // e.g. "Wickman Chemical", "Atticus", "I & B Ag Supply", "Channel Seed"
		vendorCode: text('vendor_code').unique(),
		contactName: text('contact_name'),
		email: text('email'),
		phone: text('phone'),
		address: text('address'),
		taxId: text('tax_id'),
		paymentTerms: text('payment_terms').default('Net 30'), // Net 30, Pre-pay, Early Cash Discount
		notes: text('notes'),
		createdAt: integer('created_at', { mode: 'timestamp_ms' })
			.notNull()
			.default(sql`(strftime('%s', 'now') * 1000)`),
		updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
			.notNull()
			.default(sql`(strftime('%s', 'now') * 1000)`)
	},
	(table) => ({
		nameIdx: index('vendor_name_idx').on(table.name)
	})
);

export const ingestionSourceEnum = [
	'wickman_chemical',
	'atticus',
	'ib_ag_supply',
	'channel_bol',
	'generic_invoice',
	'manual'
] as const;
export type IngestionSource = (typeof ingestionSourceEnum)[number];

export const ingestionStatusEnum = ['pending', 'processed', 'flagged', 'failed'] as const;
export type IngestionStatus = (typeof ingestionStatusEnum)[number];

export const documentIngestionLogs = sqliteTable(
	'document_ingestion_logs',
	{
		id: text('id').primaryKey(),
		vendorId: text('vendor_id').references(() => vendors.id),
		source: text('source', { enum: ingestionSourceEnum }).notNull(),
		fileName: text('file_name').notNull(),
		fileType: text('file_type'), // MIME type: image/jpeg, application/pdf, etc.
		fileSize: integer('file_size'),
		payloadRaw: text('payload_raw'), // Raw text extracted via OCR / edge parser
		extractedAttributes: text('extracted_attributes'), // JSON string with mapped schema
		// Extracted BOL specific tokens if present:
		extractedBolNumber: text('extracted_bol_number'),
		extractedOrderNumber: text('extracted_order_number'),
		itemCount: integer('item_count').default(0).notNull(),
		totalCostBasis: real('total_cost_basis').default(0),
		status: text('status', { enum: ingestionStatusEnum }).default('pending').notNull(),
		errorMessage: text('error_message'),
		uploadedByUserId: text('uploaded_by_user_id')
			.notNull()
			.references(() => users.id),
		createdAt: integer('created_at', { mode: 'timestamp_ms' })
			.notNull()
			.default(sql`(strftime('%s', 'now') * 1000)`),
		updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
			.notNull()
			.default(sql`(strftime('%s', 'now') * 1000)`)
	},
	(table) => ({
		sourceIdx: index('ingestion_source_idx').on(table.source),
		statusIdx: index('ingestion_status_idx').on(table.status),
		bolIdx: index('ingestion_bol_idx').on(table.extractedBolNumber)
	})
);

// ============================================================================
// 4. UNIFIED MULTI-CATEGORY INVENTORY & MULTI-TIERED PRICING ENGINE
// ============================================================================

export const productCategoryEnum = ['chemical', 'seed', 'drone', 'misc'] as const;
export type ProductCategory = (typeof productCategoryEnum)[number];

export const productStatusEnum = ['active', 'archived', 'out_of_stock'] as const;
export type ProductStatus = (typeof productStatusEnum)[number];

/**
 * Unified Inventory Table:
 * Dynamic Multi-Tiered Markup:
 * 1. financed_app_price: Financed application (High Margin) - includes drone flight + financing terms
 * 2. cash_app_price: Cash application (Standard Margin) - includes drone flight paid cash/check
 * 3. carry_price: Cash/Finance and Carry (Low/Flat Margin) - customer transports & self-applies
 */
export const products = sqliteTable(
	'products',
	{
		id: text('id').primaryKey(),
		sku: text('sku').notNull().unique(),
		name: text('name').notNull(),
		category: text('category', { enum: productCategoryEnum }).notNull(),
		vendorId: text('vendor_id').references(() => vendors.id),
		description: text('description'),
		unit: text('unit').notNull(), // 'oz', 'gallon', 'bag', 'unit', 'box', 'piece'
		packageSize: real('package_size'), // e.g. 2.5 (gal), 50 (lb)
		costBasis: real('cost_basis').notNull(), // Raw cost basis per unit from vendor

		// Multi-Tiered Pricing Matrix
		financedAppPrice: real('financed_app_price').notNull(), // Tier 1: High Margin (Drone application financed)
		cashAppPrice: real('cash_app_price').notNull(), // Tier 2: Standard Margin (Drone application cash)
		carryPrice: real('carry_price').notNull(), // Tier 3: Low/Flat Margin (Cash/Finance & Carry)

		// Category Specific: Chemical Inventory Attributes
		chemicalType: text('chemical_type'), // 'Corn', 'Corn Pre', 'Corn Post', 'Bean Pre', 'Bean Post'
		applicationMethod: text('application_method'), // 'Single', 'Dual', 'E3', 'Flex'
		ratePerAcre: text('rate_per_acre'), // e.g. '32 oz', '2 oz', '2#'
		costPerAcre: real('cost_per_acre'), // Calculated or benchmarked cost/acre
		epaRegNumber: text('epa_reg_number'),
		activeIngredients: text('active_ingredients'),

		// Category Specific: Seed Inventory Attributes
		seedTrait: text('seed_trait'), // e.g., 'Enlist E3', 'Roundup Ready 2 Xtend', 'SmartStax PRO'
		seedTreatment: text('seed_treatment'),
		seedRelativeMaturity: text('seed_relative_maturity'), // e.g., '2.4 RM' or '108 Day'
		isRegulated: integer('is_regulated', { mode: 'boolean' }).default(false).notNull(), // Requires Iowa BOL compliance audit

		// Category Specific: Drone Inventory Attributes
		droneModel: text('drone_model'), // e.g., 'DJI Agras T50', 'DJI Agras T40', 'XAG P100 Pro'
		payloadCapacityKg: real('payload_capacity_kg'),
		swathWidthMeters: real('swath_width_meters'),

		// Stock & Tracking
		currentStock: real('current_stock').default(0).notNull(),
		reorderThreshold: real('reorder_threshold').default(0).notNull(),
		status: text('status', { enum: productStatusEnum }).default('active').notNull(),
		createdAt: integer('created_at', { mode: 'timestamp_ms' })
			.notNull()
			.default(sql`(strftime('%s', 'now') * 1000)`),
		updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
			.notNull()
			.default(sql`(strftime('%s', 'now') * 1000)`)
	},
	(table) => ({
		skuIdx: uniqueIndex('product_sku_idx').on(table.sku),
		categoryIdx: index('product_category_idx').on(table.category),
		nameIdx: index('product_name_idx').on(table.name),
		vendorIdx: index('product_vendor_idx').on(table.vendorId)
	})
);

export const droneConditionEnum = ['new', 'demo', 'field_ready', 'maintenance_required', 'sold'] as const;
export type DroneCondition = (typeof droneConditionEnum)[number];

/**
 * Serialized Unit Tracking for Drone Sales & Service Fleet
 */
export const droneUnits = sqliteTable(
	'drone_units',
	{
		id: text('id').primaryKey(),
		productId: text('product_id')
			.notNull()
			.references(() => products.id),
		serialNumber: text('serial_number').notNull().unique(),
		aircraftRegistration: text('aircraft_registration'), // FAA N-number
		remoteControlSerial: text('remote_control_serial'),
		batterySerialNumbers: text('battery_serial_numbers'), // JSON array of battery IDs
		flightHoursTotal: real('flight_hours_total').default(0).notNull(),
		firmwareVersion: text('firmware_version'),
		condition: text('condition', { enum: droneConditionEnum }).default('new').notNull(),
		soldToCustomerId: text('sold_to_customer_id').references(() => customers.id),
		soldInvoiceId: text('sold_invoice_id').references(() => invoices.id),
		notes: text('notes'),
		createdAt: integer('created_at', { mode: 'timestamp_ms' })
			.notNull()
			.default(sql`(strftime('%s', 'now') * 1000)`),
		updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
			.notNull()
			.default(sql`(strftime('%s', 'now') * 1000)`)
	},
	(table) => ({
		serialIdx: uniqueIndex('drone_serial_idx').on(table.serialNumber),
		productIdx: index('drone_product_idx').on(table.productId)
	})
);

export const transactionTypeEnum = [
	'purchase_intake',
	'invoice_sale',
	'return_restock',
	'manual_adjustment',
	'initial_inventory'
] as const;
export type TransactionType = (typeof transactionTypeEnum)[number];

export const inventoryTransactions = sqliteTable(
	'inventory_transactions',
	{
		id: text('id').primaryKey(),
		productId: text('product_id')
			.notNull()
			.references(() => products.id),
		transactionType: text('transaction_type', { enum: transactionTypeEnum }).notNull(),
		quantityChange: real('quantity_change').notNull(),
		unitCostBasis: real('unit_cost_basis').notNull(),
		referenceId: text('reference_id'), // e.g. invoiceId, ingestionLogId, BOL number
		performedByUserId: text('performed_by_user_id')
			.notNull()
			.references(() => users.id),
		notes: text('notes'),
		createdAt: integer('created_at', { mode: 'timestamp_ms' })
			.notNull()
			.default(sql`(strftime('%s', 'now') * 1000)`)
	},
	(table) => ({
		productIdx: index('transaction_product_idx').on(table.productId),
		typeIdx: index('transaction_type_idx').on(table.transactionType),
		createdIdx: index('transaction_created_idx').on(table.createdAt)
	})
);

// ============================================================================
// 5. INVOICING ENGINE & COMPLIANCE VERIFICATION
// ============================================================================

export const pricingStrategyEnum = ['financed_app', 'cash_app', 'carry'] as const;
export type PricingStrategy = (typeof pricingStrategyEnum)[number];

export const invoiceStatusEnum = ['draft', 'sent', 'paid', 'canceled'] as const;
export type InvoiceStatus = (typeof invoiceStatusEnum)[number];

export const invoices = sqliteTable(
	'invoices',
	{
		id: text('id').primaryKey(),
		invoiceNumber: text('invoice_number').notNull().unique(), // e.g., "INV-2026-0001"
		customerId: text('customer_id')
			.notNull()
			.references(() => customers.id),
		pricingStrategyTier: text('pricing_strategy_tier', { enum: pricingStrategyEnum })
			.notNull()
			.default('cash_app'),
		status: text('status', { enum: invoiceStatusEnum }).notNull().default('draft'),
		issueDate: text('issue_date').notNull(), // YYYY-MM-DD
		dueDate: text('due_date').notNull(), // YYYY-MM-DD

		// Calculations & Financials
		subtotal: real('subtotal').notNull().default(0),
		taxRate: real('tax_rate').notNull().default(0), // Ag exemptions often 0%
		taxAmount: real('tax_amount').notNull().default(0),
		discountAmount: real('discount_amount').notNull().default(0),
		totalAmount: real('total_amount').notNull().default(0),

		// Cost and Margin Analysis (internal only)
		totalCostBasis: real('total_cost_basis').notNull().default(0),
		grossMarginAmount: real('gross_margin_amount').notNull().default(0),
		grossMarginPercent: real('gross_margin_percent').notNull().default(0),

		// Drone Application Context
		acresTreated: real('acres_treated'),
		fieldLocationDescription: text('field_location_description'), // Township, Section, Farm GPS

		notes: text('notes'),
		termsAndConditions: text('terms_and_conditions'),
		paymentDate: text('payment_date'),
		paymentReference: text('payment_reference'), // Check number, ACH ID, etc.

		createdByUserId: text('created_by_user_id')
			.notNull()
			.references(() => users.id),
		createdAt: integer('created_at', { mode: 'timestamp_ms' })
			.notNull()
			.default(sql`(strftime('%s', 'now') * 1000)`),
		updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
			.notNull()
			.default(sql`(strftime('%s', 'now') * 1000)`)
	},
	(table) => ({
		invoiceNumberIdx: uniqueIndex('invoice_number_idx').on(table.invoiceNumber),
		customerIdx: index('invoice_customer_idx').on(table.customerId),
		statusIdx: index('invoice_status_idx').on(table.status),
		issueDateIdx: index('invoice_issue_date_idx').on(table.issueDate)
	})
);

export const invoiceItems = sqliteTable(
	'invoice_items',
	{
		id: text('id').primaryKey(),
		invoiceId: text('invoice_id')
			.notNull()
			.references(() => invoices.id, { onDelete: 'cascade' }),
		productId: text('product_id')
			.notNull()
			.references(() => products.id),
		description: text('description').notNull(),
		quantity: real('quantity').notNull(),
		unit: text('unit').notNull(),

		// Unit and Total Financials
		unitCostBasis: real('unit_cost_basis').notNull(),
		unitSellingPrice: real('unit_selling_price').notNull(), // Derived from product pricing strategy
		pricingTierApplied: text('pricing_tier_applied', { enum: pricingStrategyEnum }).notNull(),
		totalCost: real('total_cost').notNull(),
		totalPrice: real('total_price').notNull(),
		marginAmount: real('margin_amount').notNull(),

		// Iowa Seed Regulatory Compliance Linkage
		bolNumber: text('bol_number'), // Verified Channel BOL CMR Number
		orderNumber: text('order_number'), // Verified Iowa Regulatory Order Number
		isIowaComplianceVerified: integer('is_iowa_compliance_verified', { mode: 'boolean' })
			.default(false)
			.notNull(),

		// Serialized unit linkage (for drone hardware sales)
		droneUnitSerialNumber: text('drone_unit_serial_number'),

		createdAt: integer('created_at', { mode: 'timestamp_ms' })
			.notNull()
			.default(sql`(strftime('%s', 'now') * 1000)`)
	},
	(table) => ({
		invoiceIdx: index('item_invoice_idx').on(table.invoiceId),
		productIdx: index('item_product_idx').on(table.productId),
		bolIdx: index('item_bol_idx').on(table.bolNumber)
	})
);

// ============================================================================
// 6. PROTECTED CHECKWRITING MODULE (ADMIN ONLY)
// ============================================================================

export const checkStatusEnum = ['draft', 'printed', 'cleared', 'voided'] as const;
export type CheckStatus = (typeof checkStatusEnum)[number];

/**
 * Strict Numeric Check Number Sequence Isolation:
 * Prevents race conditions, duplicates, or gaps in physical printed checkbooks.
 */
export const checkSequences = sqliteTable('check_sequences', {
	id: text('id').primaryKey(), // Default: 'primary_operating_account'
	accountName: text('account_name').notNull().default('Primary Ag Operating'),
	nextCheckNumber: integer('next_check_number').notNull().default(1001),
	updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
		.notNull()
		.default(sql`(strftime('%s', 'now') * 1000)`)
});

export const checks = sqliteTable(
	'checks',
	{
		id: text('id').primaryKey(),
		checkNumber: integer('check_number').notNull().unique(), // Atomic serial sequence
		vendorId: text('vendor_id')
			.notNull()
			.references(() => vendors.id),
		amount: real('amount').notNull(),
		amountInWords: text('amount_in_words').notNull(), // Format: "One Thousand Two Hundred and 00/100 Dollars"
		issueDate: text('issue_date').notNull(), // YYYY-MM-DD
		memo: text('memo'),
		category: text('category').default('Inventory Purchase'), // Expense categorization

		status: text('status', { enum: checkStatusEnum }).notNull().default('draft'),

		// User Access Security & Printing Audit (Strict Admin validation)
		printedByUserId: text('printed_by_user_id').references(() => users.id),
		printedAt: integer('printed_at', { mode: 'timestamp_ms' }),
		voidedByUserId: text('voided_by_user_id').references(() => users.id),
		voidReason: text('void_reason'),
		voidedAt: integer('voided_at', { mode: 'timestamp_ms' }),

		// Pixel-Perfect Check Layout Offsets (Stored JSON for 3-part check stock calibration)
		checkLayoutConfig: text('check_layout_config'),

		createdAt: integer('created_at', { mode: 'timestamp_ms' })
			.notNull()
			.default(sql`(strftime('%s', 'now') * 1000)`),
		updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
			.notNull()
			.default(sql`(strftime('%s', 'now') * 1000)`)
	},
	(table) => ({
		checkNumberIdx: uniqueIndex('check_number_idx').on(table.checkNumber),
		vendorIdx: index('check_vendor_idx').on(table.vendorId),
		statusIdx: index('check_status_idx').on(table.status),
		issueDateIdx: index('check_issue_date_idx').on(table.issueDate)
	})
);

// ============================================================================
// 7. SYSTEM AUDIT & SECURITY LOGS (ADMIN RESTRICTED)
// ============================================================================

export const systemAuditLogs = sqliteTable(
	'system_audit_logs',
	{
		id: text('id').primaryKey(),
		userId: text('user_id').references(() => users.id),
		userEmail: text('user_email'),
		action: text('action').notNull(), // e.g., 'CHECK_PRINTED', 'CHECK_VOIDED', 'ROLE_CHANGED', 'BOL_VERIFIED'
		entity: text('entity').notNull(), // 'check', 'invoice', 'product', 'user', 'compliance'
		entityId: text('entity_id'),
		ipAddress: text('ip_address'),
		userAgent: text('user_agent'),
		metadata: text('metadata'), // JSON state diff or context
		createdAt: integer('created_at', { mode: 'timestamp_ms' })
			.notNull()
			.default(sql`(strftime('%s', 'now') * 1000)`)
	},
	(table) => ({
		actionIdx: index('audit_action_idx').on(table.action),
		entityIdx: index('audit_entity_idx').on(table.entity),
		userIdx: index('audit_user_idx').on(table.userId),
		createdIdx: index('audit_created_idx').on(table.createdAt)
	})
);

// ============================================================================
// 8. RELATIONS DEFINITIONS (DRIZZLE ORM)
// ============================================================================

export const usersRelations = relations(users, ({ many }) => ({
	sessions: many(sessions),
	accounts: many(accounts),
	invoicesCreated: many(invoices),
	checksPrinted: many(checks),
	verifiedComplianceLogs: many(iowaComplianceLogs),
	auditLogs: many(systemAuditLogs)
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
	user: one(users, {
		fields: [sessions.userId],
		references: [users.id]
	})
}));

export const accountsRelations = relations(accounts, ({ one }) => ({
	user: one(users, {
		fields: [accounts.userId],
		references: [users.id]
	})
}));

export const customersRelations = relations(customers, ({ many }) => ({
	invoices: many(invoices),
	complianceLogs: many(iowaComplianceLogs),
	droneUnits: many(droneUnits)
}));

export const vendorsRelations = relations(vendors, ({ many }) => ({
	products: many(products),
	checks: many(checks),
	ingestionLogs: many(documentIngestionLogs)
}));

export const productsRelations = relations(products, ({ one, many }) => ({
	vendor: one(vendors, {
		fields: [products.vendorId],
		references: [vendors.id]
	}),
	droneUnits: many(droneUnits),
	invoiceItems: many(invoiceItems),
	transactions: many(inventoryTransactions)
}));

export const droneUnitsRelations = relations(droneUnits, ({ one }) => ({
	product: one(products, {
		fields: [droneUnits.productId],
		references: [products.id]
	}),
	customer: one(customers, {
		fields: [droneUnits.soldToCustomerId],
		references: [customers.id]
	}),
	invoice: one(invoices, {
		fields: [droneUnits.soldInvoiceId],
		references: [invoices.id]
	})
}));

export const invoicesRelations = relations(invoices, ({ one, many }) => ({
	customer: one(customers, {
		fields: [invoices.customerId],
		references: [customers.id]
	}),
	createdByUser: one(users, {
		fields: [invoices.createdByUserId],
		references: [users.id]
	}),
	items: many(invoiceItems),
	complianceLogs: many(iowaComplianceLogs)
}));

export const invoiceItemsRelations = relations(invoiceItems, ({ one }) => ({
	invoice: one(invoices, {
		fields: [invoiceItems.invoiceId],
		references: [invoices.id]
	}),
	product: one(products, {
		fields: [invoiceItems.productId],
		references: [products.id]
	})
}));

export const iowaComplianceLogsRelations = relations(iowaComplianceLogs, ({ one }) => ({
	customer: one(customers, {
		fields: [iowaComplianceLogs.customerId],
		references: [customers.id]
	}),
	invoice: one(invoices, {
		fields: [iowaComplianceLogs.invoiceId],
		references: [invoices.id]
	}),
	invoiceItem: one(invoiceItems, {
		fields: [iowaComplianceLogs.invoiceItemId],
		references: [invoiceItems.id]
	}),
	verifiedByUser: one(users, {
		fields: [iowaComplianceLogs.verifiedByUserId],
		references: [users.id]
	})
}));

export const checksRelations = relations(checks, ({ one }) => ({
	vendor: one(vendors, {
		fields: [checks.vendorId],
		references: [vendors.id]
	}),
	printedByUser: one(users, {
		fields: [checks.printedByUserId],
		references: [users.id]
	}),
	voidedByUser: one(users, {
		fields: [checks.voidedByUserId],
		references: [users.id]
	})
}));

export const inventoryTransactionsRelations = relations(inventoryTransactions, ({ one }) => ({
	product: one(products, {
		fields: [inventoryTransactions.productId],
		references: [products.id]
	}),
	performedByUser: one(users, {
		fields: [inventoryTransactions.performedByUserId],
		references: [users.id]
	})
}));

export const documentIngestionLogsRelations = relations(documentIngestionLogs, ({ one }) => ({
	vendor: one(vendors, {
		fields: [documentIngestionLogs.vendorId],
		references: [vendors.id]
	}),
	uploadedByUser: one(users, {
		fields: [documentIngestionLogs.uploadedByUserId],
		references: [users.id]
	})
}));

// ============================================================================
// 9. INFERRED TYPESCRIPT TYPES
// ============================================================================

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;

export type Customer = typeof customers.$inferSelect;
export type NewCustomer = typeof customers.$inferInsert;

export type IowaComplianceLog = typeof iowaComplianceLogs.$inferSelect;
export type NewIowaComplianceLog = typeof iowaComplianceLogs.$inferInsert;

export type Vendor = typeof vendors.$inferSelect;
export type NewVendor = typeof vendors.$inferInsert;

export type Product = typeof products.$inferSelect;
export type NewProduct = typeof products.$inferInsert;

export type DroneUnit = typeof droneUnits.$inferSelect;
export type NewDroneUnit = typeof droneUnits.$inferInsert;

export type Invoice = typeof invoices.$inferSelect;
export type NewInvoice = typeof invoices.$inferInsert;

export type InvoiceItem = typeof invoiceItems.$inferSelect;
export type NewInvoiceItem = typeof invoiceItems.$inferInsert;

export type Check = typeof checks.$inferSelect;
export type NewCheck = typeof checks.$inferInsert;

export type CheckSequence = typeof checkSequences.$inferSelect;
export type NewCheckSequence = typeof checkSequences.$inferInsert;

export type InventoryTransaction = typeof inventoryTransactions.$inferSelect;
export type NewInventoryTransaction = typeof inventoryTransactions.$inferInsert;

export type DocumentIngestionLog = typeof documentIngestionLogs.$inferSelect;
export type NewDocumentIngestionLog = typeof documentIngestionLogs.$inferInsert;

export type SystemAuditLog = typeof systemAuditLogs.$inferSelect;
export type NewSystemAuditLog = typeof systemAuditLogs.$inferInsert;
