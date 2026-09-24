CREATE TABLE `account` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`account_id` text NOT NULL,
	`provider_id` text NOT NULL,
	`access_token` text,
	`refresh_token` text,
	`access_token_expires_at` integer,
	`refresh_token_expires_at` integer,
	`scope` text,
	`id_token` text,
	`password` text,
	`created_at` integer DEFAULT (strftime('%s', 'now') * 1000) NOT NULL,
	`updated_at` integer DEFAULT (strftime('%s', 'now') * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `account_user_idx` ON `account` (`user_id`);--> statement-breakpoint
CREATE INDEX `account_provider_idx` ON `account` (`provider_id`,`account_id`);--> statement-breakpoint
CREATE TABLE `check_sequences` (
	`id` text PRIMARY KEY NOT NULL,
	`account_name` text DEFAULT 'Primary Ag Operating' NOT NULL,
	`next_check_number` integer DEFAULT 1001 NOT NULL,
	`updated_at` integer DEFAULT (strftime('%s', 'now') * 1000) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `checks` (
	`id` text PRIMARY KEY NOT NULL,
	`check_number` integer NOT NULL,
	`vendor_id` text NOT NULL,
	`amount` real NOT NULL,
	`amount_in_words` text NOT NULL,
	`issue_date` text NOT NULL,
	`memo` text,
	`category` text DEFAULT 'Inventory Purchase',
	`status` text DEFAULT 'draft' NOT NULL,
	`printed_by_user_id` text,
	`printed_at` integer,
	`voided_by_user_id` text,
	`void_reason` text,
	`voided_at` integer,
	`check_layout_config` text,
	`created_at` integer DEFAULT (strftime('%s', 'now') * 1000) NOT NULL,
	`updated_at` integer DEFAULT (strftime('%s', 'now') * 1000) NOT NULL,
	FOREIGN KEY (`vendor_id`) REFERENCES `vendors`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`printed_by_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`voided_by_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `checks_check_number_unique` ON `checks` (`check_number`);--> statement-breakpoint
CREATE UNIQUE INDEX `check_number_idx` ON `checks` (`check_number`);--> statement-breakpoint
CREATE INDEX `check_vendor_idx` ON `checks` (`vendor_id`);--> statement-breakpoint
CREATE INDEX `check_status_idx` ON `checks` (`status`);--> statement-breakpoint
CREATE INDEX `check_issue_date_idx` ON `checks` (`issue_date`);--> statement-breakpoint
CREATE TABLE `customers` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`farm_name` text,
	`contact_person` text,
	`email` text,
	`phone` text,
	`billing_address` text,
	`shipping_address` text,
	`county` text,
	`state` text DEFAULT 'IA' NOT NULL,
	`zip_code` text,
	`tax_exempt_number` text,
	`credit_limit` real DEFAULT 0 NOT NULL,
	`balance` real DEFAULT 0 NOT NULL,
	`notes` text,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` integer DEFAULT (strftime('%s', 'now') * 1000) NOT NULL,
	`updated_at` integer DEFAULT (strftime('%s', 'now') * 1000) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `customer_name_idx` ON `customers` (`name`);--> statement-breakpoint
CREATE INDEX `customer_county_idx` ON `customers` (`county`);--> statement-breakpoint
CREATE INDEX `customer_phone_idx` ON `customers` (`phone`);--> statement-breakpoint
CREATE TABLE `document_ingestion_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`vendor_id` text,
	`source` text NOT NULL,
	`file_name` text NOT NULL,
	`file_type` text,
	`file_size` integer,
	`payload_raw` text,
	`extracted_attributes` text,
	`extracted_bol_number` text,
	`extracted_order_number` text,
	`item_count` integer DEFAULT 0 NOT NULL,
	`total_cost_basis` real DEFAULT 0,
	`status` text DEFAULT 'pending' NOT NULL,
	`error_message` text,
	`uploaded_by_user_id` text NOT NULL,
	`created_at` integer DEFAULT (strftime('%s', 'now') * 1000) NOT NULL,
	`updated_at` integer DEFAULT (strftime('%s', 'now') * 1000) NOT NULL,
	FOREIGN KEY (`vendor_id`) REFERENCES `vendors`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`uploaded_by_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `ingestion_source_idx` ON `document_ingestion_logs` (`source`);--> statement-breakpoint
CREATE INDEX `ingestion_status_idx` ON `document_ingestion_logs` (`status`);--> statement-breakpoint
CREATE INDEX `ingestion_bol_idx` ON `document_ingestion_logs` (`extracted_bol_number`);--> statement-breakpoint
CREATE TABLE `drone_units` (
	`id` text PRIMARY KEY NOT NULL,
	`product_id` text NOT NULL,
	`serial_number` text NOT NULL,
	`aircraft_registration` text,
	`remote_control_serial` text,
	`battery_serial_numbers` text,
	`flight_hours_total` real DEFAULT 0 NOT NULL,
	`firmware_version` text,
	`condition` text DEFAULT 'new' NOT NULL,
	`sold_to_customer_id` text,
	`sold_invoice_id` text,
	`notes` text,
	`created_at` integer DEFAULT (strftime('%s', 'now') * 1000) NOT NULL,
	`updated_at` integer DEFAULT (strftime('%s', 'now') * 1000) NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`sold_to_customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`sold_invoice_id`) REFERENCES `invoices`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `drone_units_serial_number_unique` ON `drone_units` (`serial_number`);--> statement-breakpoint
CREATE UNIQUE INDEX `drone_serial_idx` ON `drone_units` (`serial_number`);--> statement-breakpoint
CREATE INDEX `drone_product_idx` ON `drone_units` (`product_id`);--> statement-breakpoint
CREATE TABLE `inventory_transactions` (
	`id` text PRIMARY KEY NOT NULL,
	`product_id` text NOT NULL,
	`transaction_type` text NOT NULL,
	`quantity_change` real NOT NULL,
	`unit_cost_basis` real NOT NULL,
	`reference_id` text,
	`performed_by_user_id` text NOT NULL,
	`notes` text,
	`created_at` integer DEFAULT (strftime('%s', 'now') * 1000) NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`performed_by_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `transaction_product_idx` ON `inventory_transactions` (`product_id`);--> statement-breakpoint
CREATE INDEX `transaction_type_idx` ON `inventory_transactions` (`transaction_type`);--> statement-breakpoint
CREATE INDEX `transaction_created_idx` ON `inventory_transactions` (`created_at`);--> statement-breakpoint
CREATE TABLE `invoice_items` (
	`id` text PRIMARY KEY NOT NULL,
	`invoice_id` text NOT NULL,
	`product_id` text NOT NULL,
	`description` text NOT NULL,
	`quantity` real NOT NULL,
	`unit` text NOT NULL,
	`unit_cost_basis` real NOT NULL,
	`unit_selling_price` real NOT NULL,
	`pricing_tier_applied` text NOT NULL,
	`total_cost` real NOT NULL,
	`total_price` real NOT NULL,
	`margin_amount` real NOT NULL,
	`bol_number` text,
	`order_number` text,
	`is_iowa_compliance_verified` integer DEFAULT false NOT NULL,
	`drone_unit_serial_number` text,
	`created_at` integer DEFAULT (strftime('%s', 'now') * 1000) NOT NULL,
	FOREIGN KEY (`invoice_id`) REFERENCES `invoices`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `item_invoice_idx` ON `invoice_items` (`invoice_id`);--> statement-breakpoint
CREATE INDEX `item_product_idx` ON `invoice_items` (`product_id`);--> statement-breakpoint
CREATE INDEX `item_bol_idx` ON `invoice_items` (`bol_number`);--> statement-breakpoint
CREATE TABLE `invoices` (
	`id` text PRIMARY KEY NOT NULL,
	`invoice_number` text NOT NULL,
	`customer_id` text NOT NULL,
	`pricing_strategy_tier` text DEFAULT 'cash_app' NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`issue_date` text NOT NULL,
	`due_date` text NOT NULL,
	`subtotal` real DEFAULT 0 NOT NULL,
	`tax_rate` real DEFAULT 0 NOT NULL,
	`tax_amount` real DEFAULT 0 NOT NULL,
	`discount_amount` real DEFAULT 0 NOT NULL,
	`total_amount` real DEFAULT 0 NOT NULL,
	`total_cost_basis` real DEFAULT 0 NOT NULL,
	`gross_margin_amount` real DEFAULT 0 NOT NULL,
	`gross_margin_percent` real DEFAULT 0 NOT NULL,
	`acres_treated` real,
	`field_location_description` text,
	`notes` text,
	`terms_and_conditions` text,
	`payment_date` text,
	`payment_reference` text,
	`created_by_user_id` text NOT NULL,
	`created_at` integer DEFAULT (strftime('%s', 'now') * 1000) NOT NULL,
	`updated_at` integer DEFAULT (strftime('%s', 'now') * 1000) NOT NULL,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `invoices_invoice_number_unique` ON `invoices` (`invoice_number`);--> statement-breakpoint
CREATE UNIQUE INDEX `invoice_number_idx` ON `invoices` (`invoice_number`);--> statement-breakpoint
CREATE INDEX `invoice_customer_idx` ON `invoices` (`customer_id`);--> statement-breakpoint
CREATE INDEX `invoice_status_idx` ON `invoices` (`status`);--> statement-breakpoint
CREATE INDEX `invoice_issue_date_idx` ON `invoices` (`issue_date`);--> statement-breakpoint
CREATE TABLE `iowa_compliance_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`customer_id` text NOT NULL,
	`invoice_id` text,
	`invoice_item_id` text,
	`bol_number` text NOT NULL,
	`order_number` text NOT NULL,
	`regulated_product` text NOT NULL,
	`crop_type` text,
	`lot_number` text,
	`treatment_tag` text,
	`quantity` real NOT NULL,
	`unit` text NOT NULL,
	`verified_by_user_id` text NOT NULL,
	`verified_at` integer DEFAULT (strftime('%s', 'now') * 1000) NOT NULL,
	`compliance_status` text DEFAULT 'verified' NOT NULL,
	`audit_notes` text,
	`created_at` integer DEFAULT (strftime('%s', 'now') * 1000) NOT NULL,
	`updated_at` integer DEFAULT (strftime('%s', 'now') * 1000) NOT NULL,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`invoice_id`) REFERENCES `invoices`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`invoice_item_id`) REFERENCES `invoice_items`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`verified_by_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `compliance_bol_idx` ON `iowa_compliance_logs` (`bol_number`);--> statement-breakpoint
CREATE INDEX `compliance_order_idx` ON `iowa_compliance_logs` (`order_number`);--> statement-breakpoint
CREATE INDEX `compliance_customer_idx` ON `iowa_compliance_logs` (`customer_id`);--> statement-breakpoint
CREATE INDEX `compliance_invoice_idx` ON `iowa_compliance_logs` (`invoice_id`);--> statement-breakpoint
CREATE TABLE `products` (
	`id` text PRIMARY KEY NOT NULL,
	`sku` text NOT NULL,
	`name` text NOT NULL,
	`category` text NOT NULL,
	`vendor_id` text,
	`description` text,
	`unit` text NOT NULL,
	`package_size` real,
	`cost_basis` real NOT NULL,
	`financed_app_price` real NOT NULL,
	`cash_app_price` real NOT NULL,
	`carry_price` real NOT NULL,
	`chemical_type` text,
	`application_method` text,
	`rate_per_acre` text,
	`cost_per_acre` real,
	`epa_reg_number` text,
	`active_ingredients` text,
	`seed_trait` text,
	`seed_treatment` text,
	`seed_relative_maturity` text,
	`is_regulated` integer DEFAULT false NOT NULL,
	`drone_model` text,
	`payload_capacity_kg` real,
	`swath_width_meters` real,
	`current_stock` real DEFAULT 0 NOT NULL,
	`reorder_threshold` real DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` integer DEFAULT (strftime('%s', 'now') * 1000) NOT NULL,
	`updated_at` integer DEFAULT (strftime('%s', 'now') * 1000) NOT NULL,
	FOREIGN KEY (`vendor_id`) REFERENCES `vendors`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `products_sku_unique` ON `products` (`sku`);--> statement-breakpoint
CREATE UNIQUE INDEX `product_sku_idx` ON `products` (`sku`);--> statement-breakpoint
CREATE INDEX `product_category_idx` ON `products` (`category`);--> statement-breakpoint
CREATE INDEX `product_name_idx` ON `products` (`name`);--> statement-breakpoint
CREATE INDEX `product_vendor_idx` ON `products` (`vendor_id`);--> statement-breakpoint
CREATE TABLE `session` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`token` text NOT NULL,
	`expires_at` integer NOT NULL,
	`ip_address` text,
	`user_agent` text,
	`created_at` integer DEFAULT (strftime('%s', 'now') * 1000) NOT NULL,
	`updated_at` integer DEFAULT (strftime('%s', 'now') * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `session_token_unique` ON `session` (`token`);--> statement-breakpoint
CREATE UNIQUE INDEX `session_token_idx` ON `session` (`token`);--> statement-breakpoint
CREATE INDEX `session_user_idx` ON `session` (`user_id`);--> statement-breakpoint
CREATE TABLE `system_audit_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`user_email` text,
	`action` text NOT NULL,
	`entity` text NOT NULL,
	`entity_id` text,
	`ip_address` text,
	`user_agent` text,
	`metadata` text,
	`created_at` integer DEFAULT (strftime('%s', 'now') * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `audit_action_idx` ON `system_audit_logs` (`action`);--> statement-breakpoint
CREATE INDEX `audit_entity_idx` ON `system_audit_logs` (`entity`);--> statement-breakpoint
CREATE INDEX `audit_user_idx` ON `system_audit_logs` (`user_id`);--> statement-breakpoint
CREATE INDEX `audit_created_idx` ON `system_audit_logs` (`created_at`);--> statement-breakpoint
CREATE TABLE `user` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`email_verified` integer DEFAULT false NOT NULL,
	`image` text,
	`role` text DEFAULT 'sales' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` integer DEFAULT (strftime('%s', 'now') * 1000) NOT NULL,
	`updated_at` integer DEFAULT (strftime('%s', 'now') * 1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_email_unique` ON `user` (`email`);--> statement-breakpoint
CREATE UNIQUE INDEX `user_email_idx` ON `user` (`email`);--> statement-breakpoint
CREATE INDEX `user_role_idx` ON `user` (`role`);--> statement-breakpoint
CREATE TABLE `vendors` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`vendor_code` text,
	`contact_name` text,
	`email` text,
	`phone` text,
	`address` text,
	`tax_id` text,
	`payment_terms` text DEFAULT 'Net 30',
	`notes` text,
	`created_at` integer DEFAULT (strftime('%s', 'now') * 1000) NOT NULL,
	`updated_at` integer DEFAULT (strftime('%s', 'now') * 1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `vendors_vendor_code_unique` ON `vendors` (`vendor_code`);--> statement-breakpoint
CREATE INDEX `vendor_name_idx` ON `vendors` (`name`);--> statement-breakpoint
CREATE TABLE `verification` (
	`id` text PRIMARY KEY NOT NULL,
	`identifier` text NOT NULL,
	`value` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer DEFAULT (strftime('%s', 'now') * 1000) NOT NULL,
	`updated_at` integer DEFAULT (strftime('%s', 'now') * 1000) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `verification_identifier_idx` ON `verification` (`identifier`);