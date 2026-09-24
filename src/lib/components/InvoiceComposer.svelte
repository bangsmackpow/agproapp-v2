<script lang="ts">
	import { apiFetch } from '$lib/api/client';
	import type { Customer, Product, PricingStrategy } from '$lib/db/schema';
	import {
		Plus,
		Trash2,
		AlertTriangle,
		CheckCircle2,
		ShieldAlert,
		Sparkles,
		Calculator,
		Printer,
		Send,
		Save,
		Search,
		ArrowRight
	} from 'lucide-svelte';

	let { onSaved, onCancel } = $props<{
		onSaved?: (invoice: any) => void;
		onCancel?: () => void;
	}>();

	// Component State
	let loading = $state(false);
	let error = $state<string | null>(null);
	let successMessage = $state<string | null>(null);

	let customers = $state<Customer[]>([]);
	let products = $state<Product[]>([]);

	let selectedCustomerId = $state<string>('');
	let selectedCustomer = $state<Customer | null>(null);
	let customerComplianceHistory = $state<any[]>([]);

	// Pricing Strategy Tier (Default: Cash Application as requested by user)
	let pricingTier = $state<PricingStrategy>('cash_app');

	let issueDate = $state<string>(new Date().toISOString().split('T')[0]);
	let dueDate = $state<string>('');
	let acresTreated = $state<number | undefined>(undefined);
	let fieldLocationDescription = $state<string>('');
	let notes = $state<string>('');

	interface LineItemState {
		id: string;
		productId: string;
		productName: string;
		category: string;
		quantity: number;
		unit: string;
		unitCostBasis: number;
		unitSellingPrice: number;
		isRegulated: boolean;
		bolNumber: string;
		orderNumber: string;
		droneUnitSerialNumber?: string;
	}

	let lineItems = $state<LineItemState[]>([]);

	// Load customers and inventory on mount
	$effect(() => {
		loadData();
		// Set default due date to Net 30
		const d = new Date();
		d.setDate(d.getDate() + 30);
		dueDate = d.toISOString().split('T')[0];
	});

	async function loadData() {
		loading = true;
		const [custRes, prodRes] = await Promise.all([
			apiFetch<{ customers: Customer[] }>('/customers'),
			apiFetch<{ products: Product[] }>('/inventory')
		]);

		if (custRes.data) customers = custRes.data.customers || [];
		if (prodRes.data) products = prodRes.data.products || [];
		loading = false;
	}

	// Handle Customer Selection: Auto-fills address, county, and fetches seed compliance history
	async function onCustomerChange(id: string) {
		selectedCustomerId = id;
		selectedCustomer = customers.find((c) => c.id === id) || null;

		if (selectedCustomer) {
			const res = await apiFetch<{ customer: any }>(`/customers/${selectedCustomer.id}`);
			if (res.data?.customer) {
				customerComplianceHistory = res.data.customer.complianceLogs || [];
			}
		} else {
			customerComplianceHistory = [];
		}
	}

	// Handle Pricing Strategy Change: Dynamically updates selling prices of existing line items
	function onPricingTierChange(newTier: PricingStrategy) {
		pricingTier = newTier;
		lineItems = lineItems.map((item) => {
			const prod = products.find((p) => p.id === item.productId);
			if (!prod) return item;
			let price = prod.cashAppPrice;
			if (newTier === 'financed_app') price = prod.financedAppPrice;
			else if (newTier === 'carry') price = prod.carryPrice;
			return {
				...item,
				unitSellingPrice: price
			};
		});
	}

	// Add Line Item
	function addLineItem() {
		if (products.length === 0) return;
		const defaultProd = products[0];
		let price = defaultProd.cashAppPrice;
		if (pricingTier === 'financed_app') price = defaultProd.financedAppPrice;
		else if (pricingTier === 'carry') price = defaultProd.carryPrice;

		const isRegulated = defaultProd.category === 'seed' || defaultProd.isRegulated;

		// If customer has a recent BOL in history for this seed, pre-populate
		let suggestedBol = '';
		let suggestedOrder = '';
		if (isRegulated && customerComplianceHistory.length > 0) {
			suggestedBol = customerComplianceHistory[0].bolNumber || '';
			suggestedOrder = customerComplianceHistory[0].orderNumber || '';
		}

		lineItems.push({
			id: crypto.randomUUID(),
			productId: defaultProd.id,
			productName: defaultProd.name,
			category: defaultProd.category,
			quantity: 10,
			unit: defaultProd.unit,
			unitCostBasis: defaultProd.costBasis,
			unitSellingPrice: price,
			isRegulated,
			bolNumber: suggestedBol,
			orderNumber: suggestedOrder
		});
	}

	function updateLineItemProduct(itemId: string, newProductId: string) {
		const prod = products.find((p) => p.id === newProductId);
		if (!prod) return;

		let price = prod.cashAppPrice;
		if (pricingTier === 'financed_app') price = prod.financedAppPrice;
		else if (pricingTier === 'carry') price = prod.carryPrice;

		const isRegulated = prod.category === 'seed' || prod.isRegulated;

		let suggestedBol = '';
		let suggestedOrder = '';
		if (isRegulated && customerComplianceHistory.length > 0) {
			suggestedBol = customerComplianceHistory[0].bolNumber || '';
			suggestedOrder = customerComplianceHistory[0].orderNumber || '';
		}

		lineItems = lineItems.map((item) => {
			if (item.id === itemId) {
				return {
					...item,
					productId: prod.id,
					productName: prod.name,
					category: prod.category,
					unit: prod.unit,
					unitCostBasis: prod.costBasis,
					unitSellingPrice: price,
					isRegulated,
					bolNumber: item.bolNumber || suggestedBol,
					orderNumber: item.orderNumber || suggestedOrder
				};
			}
			return item;
		});
	}

	function removeLineItem(itemId: string) {
		lineItems = lineItems.filter((it) => it.id !== itemId);
	}

	// Dynamic Financial Calculations
	let subtotal = $derived(
		lineItems.reduce((acc, it) => acc + it.unitSellingPrice * it.quantity, 0)
	);
	let totalCostBasis = $derived(
		lineItems.reduce((acc, it) => acc + it.unitCostBasis * it.quantity, 0)
	);
	let grossMarginAmount = $derived(Math.round((subtotal - totalCostBasis) * 100) / 100);
	let grossMarginPercent = $derived(
		subtotal > 0 ? Math.round((grossMarginAmount / subtotal) * 10000) / 100 : 0
	);

	// Compliance Validation Check
	let complianceViolations = $derived(
		lineItems.filter(
			(it) => it.isRegulated && (!it.bolNumber.trim() || !it.orderNumber.trim())
		)
	);
	let isSubmissionBlocked = $derived(
		!selectedCustomerId || lineItems.length === 0 || complianceViolations.length > 0
	);

	// Submit Invoice Form
	async function handleSubmit(statusToSet: 'draft' | 'sent' = 'draft') {
		error = null;
		successMessage = null;

		if (!selectedCustomerId) {
			error = 'Please select a customer profile.';
			return;
		}

		if (lineItems.length === 0) {
			error = 'At least one line item is required.';
			return;
		}

		if (complianceViolations.length > 0) {
			error = `State of Iowa Seed Compliance Error: Missing verified BOL/CMR or Order Number on ${complianceViolations.length} regulated seed product(s).`;
			return;
		}

		loading = true;

		const payload = {
			customerId: selectedCustomerId,
			pricingTier,
			issueDate,
			dueDate,
			acresTreated: acresTreated || null,
			fieldLocationDescription,
			notes,
			items: lineItems.map((it) => ({
				productId: it.productId,
				quantity: it.quantity,
				unit: it.unit,
				customUnitPrice: it.unitSellingPrice,
				bolNumber: it.bolNumber || undefined,
				orderNumber: it.orderNumber || undefined,
				droneUnitSerialNumber: it.droneUnitSerialNumber || undefined
			}))
		};

		const res = await apiFetch('/invoices', {
			method: 'POST',
			body: JSON.stringify(payload)
		});

		loading = false;

		if (res.error) {
			error = res.error;
		} else {
			const invoice = res.data.invoice;
			if (statusToSet === 'sent') {
				await apiFetch(`/invoices/${invoice.id}/status`, {
					method: 'PATCH',
					body: JSON.stringify({ status: 'sent' })
				});
			}
			successMessage = `Invoice ${invoice.invoiceNumber} created successfully!`;
			onSaved?.(invoice);
		}
	}
</script>

<div class="space-y-6">
	<!-- Header Bar -->
	<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b gh-border-muted">
		<div>
			<h2 class="text-lg font-bold text-[var(--gh-fg-default)] flex items-center gap-2">
				<Calculator class="w-5 h-5 text-emerald-500" />
				New Agricultural Sales & Drone Application Invoice
			</h2>
			<p class="text-xs text-[var(--gh-fg-muted)] mt-0.5">
				Configure customer profile, pricing tiers, and satisfy Iowa State seed regulatory compliance tokens.
			</p>
		</div>

		<div class="flex items-center gap-2">
			{#if onCancel}
				<button type="button" onclick={onCancel} class="gh-btn text-xs">
					Cancel
				</button>
			{/if}
			<button
				type="button"
				onclick={() => handleSubmit('draft')}
				disabled={isSubmissionBlocked || loading}
				class="gh-btn text-xs font-semibold"
			>
				<Save class="w-3.5 h-3.5" />
				Save Draft
			</button>
			<button
				type="button"
				onclick={() => handleSubmit('sent')}
				disabled={isSubmissionBlocked || loading}
				class="gh-btn-primary text-xs font-semibold"
			>
				<Send class="w-3.5 h-3.5" />
				Submit & Dispatch
			</button>
		</div>
	</div>

	<!-- Error / Warning Alerts -->
	{#if error}
		<div class="p-3.5 rounded-md gh-badge-danger border flex items-start gap-3 text-xs">
			<AlertTriangle class="w-4 h-4 shrink-0 mt-0.5" />
			<div class="flex-1">
				<p class="font-semibold">Submission Notice</p>
				<p>{error}</p>
			</div>
		</div>
	{/if}

	{#if successMessage}
		<div class="p-3.5 rounded-md gh-badge-success border flex items-center gap-3 text-xs">
			<CheckCircle2 class="w-4 h-4 text-emerald-500 shrink-0" />
			<p class="font-semibold text-emerald-600 dark:text-emerald-400">{successMessage}</p>
		</div>
	{/if}

	<!-- Section 1: Customer Profile Auto-Fill & Dates -->
	<div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
		<!-- Customer Selection Box -->
		<div class="gh-card p-4 space-y-3 lg:col-span-2">
			<div class="flex items-center justify-between">
				<label for="customer-select" class="text-xs font-bold uppercase tracking-wider text-[var(--gh-fg-muted)]">
					Customer / Farm Entity
				</label>
				{#if selectedCustomer}
					<span class="gh-badge gh-badge-success text-[10px]">
						County: {selectedCustomer.county}, IA
					</span>
				{/if}
			</div>

			<select
				id="customer-select"
				bind:value={selectedCustomerId}
				onchange={(e) => onCustomerChange((e.target as HTMLSelectElement).value)}
				class="w-full text-xs gh-card-inset p-2.5 rounded-md border gh-border-default focus:ring-1 focus:ring-emerald-500"
			>
				<option value="">-- Choose Grower / Farm Profile --</option>
				{#each customers as cust}
					<option value={cust.id}>
						{cust.name} ({cust.farmName || 'General Account'}) - {cust.county} Co, IA
					</option>
				{/each}
			</select>

			<!-- Auto-filled Parameters Preview -->
			{#if selectedCustomer}
				<div class="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 text-xs border-t gh-border-muted">
					<div>
						<span class="text-[var(--gh-fg-subtle)] block text-[10px] uppercase">Billing Address:</span>
						<p class="font-medium text-[var(--gh-fg-default)]">{selectedCustomer.billingAddress || 'No address on file'}</p>
						<p class="text-[var(--gh-fg-muted)]">{selectedCustomer.county} County, IA {selectedCustomer.zipCode || ''}</p>
					</div>
					<div>
						<span class="text-[var(--gh-fg-subtle)] block text-[10px] uppercase">Field Staging / Drop-Off:</span>
						<p class="font-medium text-[var(--gh-fg-default)]">{selectedCustomer.shippingAddress || selectedCustomer.billingAddress}</p>
						<p class="text-[var(--gh-fg-muted)]">Phone: {selectedCustomer.phone || 'N/A'}</p>
					</div>
				</div>
			{:else}
				<div class="p-3 gh-card-inset rounded text-xs text-[var(--gh-fg-muted)] italic text-center">
					Select a customer to auto-fill billing, staging parameters, and Iowa regulatory audit records.
				</div>
			{/if}
		</div>

		<!-- Dates & Invoicing Strategy Selector -->
		<div class="gh-card p-4 space-y-3">
			<label for="pricing-tier-select" class="text-xs font-bold uppercase tracking-wider text-[var(--gh-fg-muted)] block">
				Pricing Strategy Tier
			</label>

			<select
				id="pricing-tier-select"
				bind:value={pricingTier}
				onchange={(e) => onPricingTierChange((e.target as HTMLSelectElement).value as PricingStrategy)}
				class="w-full text-xs gh-card-inset p-2.5 rounded-md border gh-border-default font-semibold focus:ring-1 focus:ring-emerald-500"
			>
				<option value="cash_app">Cash Application (Standard Margin)</option>
				<option value="financed_app">Financed Application (High Margin)</option>
				<option value="carry">Cash / Finance and Carry (Low/Flat Margin)</option>
			</select>

			<div class="text-[11px] text-[var(--gh-fg-muted)] p-2 rounded gh-card-inset">
				{#if pricingTier === 'financed_app'}
					<span class="font-semibold text-emerald-500">Tier 1:</span> Financed terms with drone fertilization/herbicide application included.
				{:else if pricingTier === 'cash_app'}
					<span class="font-semibold text-blue-500">Tier 2:</span> Cash/check terms with precision drone application included.
				{:else}
					<span class="font-semibold text-amber-500">Tier 3:</span> Carry only. Customer transports product & performs independent field application.
				{/if}
			</div>

			<div class="grid grid-cols-2 gap-2 pt-2 border-t gh-border-muted text-xs">
				<div>
					<label for="issue-date" class="text-[10px] uppercase text-[var(--gh-fg-subtle)] block">Issue Date</label>
					<input
						id="issue-date"
						type="date"
						bind:value={issueDate}
						class="w-full text-xs p-1.5 rounded border gh-border-default gh-card-inset"
					/>
				</div>
				<div>
					<label for="due-date" class="text-[10px] uppercase text-[var(--gh-fg-subtle)] block">Due Date</label>
					<input
						id="due-date"
						type="date"
						bind:value={dueDate}
						class="w-full text-xs p-1.5 rounded border gh-border-default gh-card-inset"
					/>
				</div>
			</div>
		</div>
	</div>

	<!-- Section 2: Precision Drone Application Context -->
	<div class="gh-card p-4">
		<div class="flex items-center justify-between mb-3">
			<h3 class="text-xs font-bold uppercase tracking-wider text-[var(--gh-fg-muted)] flex items-center gap-1.5">
				Precision Drone Application Coverage
			</h3>
			<span class="text-[11px] text-[var(--gh-fg-muted)]">DJI Agras T50 Fleet Parameters</span>
		</div>

		<div class="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
			<div>
				<label for="acres-treated" class="text-[10px] uppercase text-[var(--gh-fg-subtle)] block mb-1">Acres Treated</label>
				<input
					id="acres-treated"
					type="number"
					bind:value={acresTreated}
					placeholder="e.g. 160 acres"
					class="w-full p-2 rounded border gh-border-default gh-card-inset text-xs"
				/>
			</div>
			<div class="sm:col-span-2">
				<label for="field-location" class="text-[10px] uppercase text-[var(--gh-fg-subtle)] block mb-1">Field Location / Legal Description</label>
				<input
					id="field-location"
					type="text"
					bind:value={fieldLocationDescription}
					placeholder="e.g. Section 14, Franklin Township, Story County (North 80)"
					class="w-full p-2 rounded border gh-border-default gh-card-inset text-xs"
				/>
			</div>
		</div>
	</div>

	<!-- Section 3: Line Items Engine with Real-Time Markup & Iowa Compliance -->
	<div class="gh-card overflow-hidden">
		<div class="p-3.5 border-b gh-border-muted bg-[var(--gh-canvas-inset)] flex items-center justify-between">
			<div class="flex items-center gap-2">
				<h3 class="text-xs font-bold uppercase tracking-wider text-[var(--gh-fg-default)]">
					Products & Billable Items ({lineItems.length})
				</h3>
				{#if complianceViolations.length > 0}
					<span class="gh-badge gh-badge-danger text-[10px] flex items-center gap-1 animate-pulse">
						<ShieldAlert class="w-3 h-3" />
						{complianceViolations.length} Seed Audit Token(s) Required
					</span>
				{/if}
			</div>

			<button type="button" onclick={addLineItem} class="gh-btn text-xs">
				<Plus class="w-3.5 h-3.5 text-emerald-500" />
				Add Line Item
			</button>
		</div>

		{#if lineItems.length === 0}
			<div class="p-8 text-center text-xs text-[var(--gh-fg-muted)] space-y-2">
				<p>No line items added to this invoice yet.</p>
				<button type="button" onclick={addLineItem} class="gh-btn-primary text-xs">
					<Plus class="w-3.5 h-3.5" />
					Add First Item
				</button>
			</div>
		{:else}
			<div class="divide-y gh-border-muted overflow-x-auto">
				{#each lineItems as item, idx}
					{@const lineMargin = (item.unitSellingPrice - item.unitCostBasis) * item.quantity}
					{@const lineMarginPct = item.unitSellingPrice > 0 ? ((item.unitSellingPrice - item.unitCostBasis) / item.unitSellingPrice) * 100 : 0}
					<div class="p-4 space-y-3 {item.isRegulated ? 'bg-amber-500/5' : ''}">
						<!-- Product Row Top -->
						<div class="grid grid-cols-12 gap-3 items-start text-xs">
							<!-- Item index & product selector -->
							<div class="col-span-12 md:col-span-5 space-y-1">
								<div class="flex items-center justify-between">
									<span class="text-[10px] font-semibold text-[var(--gh-fg-subtle)] uppercase">
										#{idx + 1} - Product Selection
									</span>
									<span class="gh-badge text-[9px] uppercase">{item.category}</span>
								</div>

								<select
									value={item.productId}
									onchange={(e) => updateLineItemProduct(item.id, (e.target as HTMLSelectElement).value)}
									class="w-full p-2 rounded border gh-border-default gh-card-inset text-xs font-medium"
								>
									{#each products as p}
										<option value={p.id}>
											{p.name} ({p.unit}) - Stock: {p.currentStock}
										</option>
									{/each}
								</select>
							</div>

							<!-- Quantity & Unit -->
							<div class="col-span-4 md:col-span-2">
								<span class="text-[10px] font-semibold text-[var(--gh-fg-subtle)] uppercase block mb-1">
									Qty ({item.unit})
								</span>
								<input
									type="number"
									bind:value={item.quantity}
									min="0.1"
									step="any"
									class="w-full p-2 rounded border gh-border-default gh-card-inset text-xs font-mono"
								/>
							</div>

							<!-- Unit Selling Price (Driven by selected tier) -->
							<div class="col-span-4 md:col-span-2">
								<span class="text-[10px] font-semibold text-[var(--gh-fg-subtle)] uppercase block mb-1">
									Unit Price ($)
								</span>
								<input
									type="number"
									bind:value={item.unitSellingPrice}
									step="0.01"
									class="w-full p-2 rounded border gh-border-default gh-card-inset text-xs font-mono font-semibold"
								/>
								<span class="text-[9px] text-[var(--gh-fg-subtle)] block mt-0.5">
									Cost: ${item.unitCostBasis.toFixed(2)}
								</span>
							</div>

							<!-- Line Sum & Margin -->
							<div class="col-span-3 md:col-span-2 text-right">
								<span class="text-[10px] font-semibold text-[var(--gh-fg-subtle)] uppercase block mb-1">
									Total
								</span>
								<span class="text-sm font-bold font-mono text-[var(--gh-fg-default)] block">
									${(item.unitSellingPrice * item.quantity).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
								</span>
								<span class="text-[10px] font-mono text-emerald-500 block">
									+${lineMargin.toFixed(0)} ({lineMarginPct.toFixed(0)}%)
								</span>
							</div>

							<!-- Delete button -->
							<div class="col-span-1 flex justify-end items-center pt-5">
								<button
									type="button"
									onclick={() => removeLineItem(item.id)}
									class="p-1.5 rounded hover:bg-rose-500/15 text-[var(--gh-fg-subtle)] hover:text-rose-500"
									title="Remove item"
								>
									<Trash2 class="w-4 h-4" />
								</button>
							</div>
						</div>

						<!-- Iowa State Compliance Gate (Seed BOL Verification) -->
						{#if item.isRegulated}
							<div class="p-2.5 rounded-md border border-amber-500/30 bg-amber-500/10 text-xs space-y-2">
								<div class="flex items-center justify-between">
									<div class="flex items-center gap-2">
										<ShieldAlert class="w-4 h-4 text-amber-500" />
										<span class="font-bold text-amber-600 dark:text-amber-400">
											Iowa Regulatory Seed Audit Requirement
										</span>
									</div>
									<span class="text-[10px] font-mono text-amber-500">
										IDALS Compliance Gate
									</span>
								</div>

								<p class="text-[11px] text-[var(--gh-fg-muted)]">
									State of Iowa seed sales regulations require indexing the Channel Straight Bill of Lading (BOL/CMR) and Order Number to complete this transaction.
								</p>

								<div class="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
									<div>
										<label for={`bol-num-${item.id}`} class="text-[10px] font-semibold uppercase text-amber-600 dark:text-amber-400 block mb-0.5">
											BOL/CMR Number *
										</label>
										<input
											id={`bol-num-${item.id}`}
											type="text"
											bind:value={item.bolNumber}
											placeholder="e.g. CH-BOL-948120"
											class="w-full p-1.5 rounded border gh-border-default gh-card text-xs font-mono {item.bolNumber ? 'border-emerald-500' : 'border-amber-500'}"
										/>
									</div>
									<div>
										<label for={`order-num-${item.id}`} class="text-[10px] font-semibold uppercase text-amber-600 dark:text-amber-400 block mb-0.5">
											Order Number *
										</label>
										<input
											id={`order-num-${item.id}`}
											type="text"
											bind:value={item.orderNumber}
											placeholder="e.g. ORD-BAY-449102"
											class="w-full p-1.5 rounded border gh-border-default gh-card text-xs font-mono {item.orderNumber ? 'border-emerald-500' : 'border-amber-500'}"
										/>
									</div>
								</div>

								{#if customerComplianceHistory.length > 0 && (!item.bolNumber || !item.orderNumber)}
									<div class="text-[10px] text-[var(--gh-fg-muted)] flex items-center gap-2 pt-1">
										<span>Auto-suggested from customer history:</span>
										<button
											type="button"
											onclick={() => {
												item.bolNumber = customerComplianceHistory[0].bolNumber;
												item.orderNumber = customerComplianceHistory[0].orderNumber;
											}}
											class="underline font-mono text-emerald-500 hover:text-emerald-400"
										>
											Use {customerComplianceHistory[0].bolNumber} / {customerComplianceHistory[0].orderNumber}
										</button>
									</div>
								{/if}
							</div>
						{/if}
					</div>
				{/each}
			</div>
		{/if}
	</div>

	<!-- Section 4: Financial Summary Panel & Actions -->
	<div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
		<!-- Notes & Terms -->
		<div class="gh-card p-4 space-y-2 lg:col-span-2">
			<label for="invoice-notes" class="text-xs font-bold uppercase tracking-wider text-[var(--gh-fg-muted)] block">
				Invoice Notes & Terms
			</label>
			<textarea
				id="invoice-notes"
				bind:value={notes}
				rows="3"
				placeholder="Add notes for field sales representative, aerial drone pilot, or farm customer..."
				class="w-full p-2 rounded border gh-border-default gh-card-inset text-xs"
			></textarea>
			<p class="text-[10px] text-[var(--gh-fg-subtle)]">
				Standard terms: Net 30 days from application. 1.5% interest on late payments. Seed returns subject to Bayer/Channel seal inspection.
			</p>
		</div>

		<!-- Calculation Summary Card -->
		<div class="gh-card p-4 space-y-3">
			<h4 class="text-xs font-bold uppercase tracking-wider text-[var(--gh-fg-muted)] pb-2 border-b gh-border-muted">
				Financial Summary
			</h4>

			<div class="space-y-1.5 text-xs">
				<div class="flex justify-between">
					<span class="text-[var(--gh-fg-muted)]">Subtotal ({lineItems.length} items):</span>
					<span class="font-mono font-semibold">${subtotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
				</div>
				<div class="flex justify-between">
					<span class="text-[var(--gh-fg-muted)]">Iowa Ag Sales Tax (Exempt):</span>
					<span class="font-mono">$0.00</span>
				</div>
				<div class="flex justify-between text-sm font-bold pt-2 border-t gh-border-muted text-[var(--gh-fg-default)]">
					<span>Total Due:</span>
					<span class="font-mono text-emerald-500">${subtotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
				</div>
			</div>

			<!-- Internal Profit Margin Breakdown -->
			<div class="p-2.5 rounded gh-card-inset border gh-border-muted text-[11px] space-y-1">
				<div class="flex justify-between text-[var(--gh-fg-muted)]">
					<span>Total Wholesale Cost:</span>
					<span class="font-mono">${totalCostBasis.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
				</div>
				<div class="flex justify-between font-semibold text-emerald-500">
					<span>Gross Profit Margin:</span>
					<span class="font-mono">${grossMarginAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ({grossMarginPercent.toFixed(1)}%)</span>
				</div>
			</div>

			<div class="pt-2 flex flex-col gap-2">
				<button
					type="button"
					onclick={() => handleSubmit('sent')}
					disabled={isSubmissionBlocked || loading}
					class="w-full gh-btn-primary justify-center text-xs py-2 font-semibold shadow-xs"
				>
					<Send class="w-3.5 h-3.5" />
					Finalize & Dispatch Invoice
				</button>
				<button
					type="button"
					onclick={() => handleSubmit('draft')}
					disabled={isSubmissionBlocked || loading}
					class="w-full gh-btn justify-center text-xs py-1.5 font-medium"
				>
					<Save class="w-3.5 h-3.5" />
					Save as Draft
				</button>
			</div>
		</div>
	</div>
</div>
