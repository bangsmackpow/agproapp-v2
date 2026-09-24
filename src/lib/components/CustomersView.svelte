<script lang="ts">
	import { apiFetch } from '$lib/api/client';
	import type { Customer } from '$lib/db/schema';
	import { Users, Plus, Search, MapPin, Phone, Mail, FileText, ShieldCheck, DollarSign } from 'lucide-svelte';

	let customers = $state<Customer[]>([]);
	let loading = $state(false);
	let searchQuery = $state<string>('');

	// Customer Detail Slide-Over
	let selectedCustomer = $state<any | null>(null);

	// Create Customer Modal
	let showCreateModal = $state(false);
	let newCustName = $state('');
	let newCustFarm = $state('');
	let newCustCounty = $state('Story');
	let newCustPhone = $state('');
	let newCustEmail = $state('');
	let newCustAddress = $state('');
	let createLoading = $state(false);

	$effect(() => {
		loadCustomers();
	});

	async function loadCustomers() {
		loading = true;
		let path = '/customers';
		if (searchQuery.trim()) path += `?q=${encodeURIComponent(searchQuery.trim())}`;
		const res = await apiFetch<{ customers: Customer[] }>(path);
		if (res.data) customers = res.data.customers || [];
		loading = false;
	}

	async function inspectCustomer(id: string) {
		const res = await apiFetch<{ customer: any }>(`/customers/${id}`);
		if (res.data?.customer) {
			selectedCustomer = res.data.customer;
		}
	}

	async function createCustomer() {
		if (!newCustName.trim()) return;
		createLoading = true;
		const res = await apiFetch('/customers', {
			method: 'POST',
			body: JSON.stringify({
				name: newCustName,
				farmName: newCustFarm || newCustName,
				county: newCustCounty,
				phone: newCustPhone,
				email: newCustEmail,
				billingAddress: newCustAddress
			})
		});
		createLoading = false;
		if (res.data) {
			showCreateModal = false;
			newCustName = '';
			newCustFarm = '';
			newCustPhone = '';
			newCustEmail = '';
			newCustAddress = '';
			loadCustomers();
		}
	}
</script>

<div class="space-y-4">
	<!-- Top Bar -->
	<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b gh-border-muted">
		<div>
			<h2 class="text-lg font-bold text-[var(--gh-fg-default)] flex items-center gap-2">
				<Users class="w-5 h-5 text-emerald-500" />
				CRM & Farm Customer Accounts
			</h2>
			<p class="text-xs text-[var(--gh-fg-muted)] mt-0.5">
				Grower profiles, field staging locations, credit balances, and historical Iowa seed audit trails.
			</p>
		</div>

		<div class="flex items-center gap-2">
			<!-- Search -->
			<div class="relative w-full sm:w-64">
				<Search class="w-3.5 h-3.5 text-[var(--gh-fg-subtle)] absolute left-2.5 top-2.5" />
				<input
					type="text"
					bind:value={searchQuery}
					oninput={loadCustomers}
					placeholder="Search farm, county, phone..."
					class="w-full pl-8 pr-3 py-1.5 rounded-md gh-card-inset border gh-border-default text-xs"
				/>
			</div>

			<button
				type="button"
				onclick={() => (showCreateModal = true)}
				class="gh-btn-primary text-xs font-semibold shrink-0"
			>
				<Plus class="w-3.5 h-3.5" />
				New Customer
			</button>
		</div>
	</div>

	<!-- Customers Grid -->
	<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
		{#if loading}
			<div class="col-span-full p-8 text-center text-xs text-[var(--gh-fg-muted)]">
				Loading customer accounts...
			</div>
		{:else if customers.length === 0}
			<div class="col-span-full p-8 text-center text-xs text-[var(--gh-fg-muted)] space-y-2">
				<p>No customer profiles found.</p>
				<button type="button" onclick={() => (showCreateModal = true)} class="gh-btn-primary text-xs">
					<Plus class="w-3.5 h-3.5" />
					Add Customer Profile
				</button>
			</div>
		{:else}
			{#each customers as cust}
				<div
					role="button"
					tabindex="0"
					onclick={() => inspectCustomer(cust.id)}
					onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && inspectCustomer(cust.id)}
					class="gh-card p-4 space-y-3 hover:border-emerald-500 transition-colors cursor-pointer text-left focus:outline-none focus:ring-1 focus:ring-emerald-500"
				>
					<div class="flex items-start justify-between gap-2">
						<div>
							<h3 class="font-bold text-sm text-[var(--gh-fg-default)]">{cust.name}</h3>
							<p class="text-xs text-[var(--gh-fg-muted)]">{cust.farmName || 'Primary Operating Account'}</p>
						</div>
						<span class="gh-badge gh-badge-success text-[10px]">
							{cust.county} Co, IA
						</span>
					</div>

					<div class="space-y-1 text-xs text-[var(--gh-fg-muted)]">
						{#if cust.billingAddress}
							<p class="flex items-center gap-1.5 truncate">
								<MapPin class="w-3.5 h-3.5 text-[var(--gh-fg-subtle)] shrink-0" />
								<span class="truncate">{cust.billingAddress}</span>
							</p>
						{/if}
						{#if cust.phone}
							<p class="flex items-center gap-1.5">
								<Phone class="w-3.5 h-3.5 text-[var(--gh-fg-subtle)] shrink-0" />
								<span>{cust.phone}</span>
							</p>
						{/if}
					</div>

					<div class="pt-2 border-t gh-border-muted flex items-center justify-between text-xs">
						<div>
							<span class="text-[10px] text-[var(--gh-fg-subtle)] uppercase block">Account Balance:</span>
							<span class="font-mono font-bold {cust.balance > 0 ? 'text-amber-500' : 'text-emerald-500'}">
								${cust.balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
							</span>
						</div>
						<div class="text-right">
							<span class="text-[10px] text-[var(--gh-fg-subtle)] uppercase block">Credit Limit:</span>
							<span class="font-mono text-[var(--gh-fg-muted)]">
								${cust.creditLimit.toLocaleString()}
							</span>
						</div>
					</div>
				</div>
			{/each}
		{/if}
	</div>

	<!-- Customer Drilldown Modal -->
	{#if selectedCustomer}
		<div
			role="presentation"
			class="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs"
			onclick={(e) => {
				if (e.target === e.currentTarget) selectedCustomer = null;
			}}
			onkeydown={(e) => e.key === 'Escape' && (selectedCustomer = null)}
		>
			<div class="gh-card max-w-2xl w-full p-6 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
				<div class="flex items-start justify-between pb-3 border-b gh-border-muted">
					<div>
						<h3 class="font-bold text-base text-[var(--gh-fg-default)]">{selectedCustomer.name}</h3>
						<p class="text-xs text-[var(--gh-fg-muted)]">
							{selectedCustomer.farmName} &bull; {selectedCustomer.county} County, Iowa
						</p>
					</div>
					<button
						type="button"
						onclick={() => (selectedCustomer = null)}
						class="gh-btn text-xs"
					>
						Close
					</button>
				</div>

				<!-- Info Columns -->
				<div class="grid grid-cols-2 gap-3 text-xs p-3 rounded gh-card-inset">
					<div>
						<span class="text-[10px] uppercase text-[var(--gh-fg-subtle)] block">Billing / Dispatch Address:</span>
						<p class="font-medium text-[var(--gh-fg-default)]">{selectedCustomer.billingAddress || 'No address'}</p>
					</div>
					<div>
						<span class="text-[10px] uppercase text-[var(--gh-fg-subtle)] block">Field Drop-Off Staging:</span>
						<p class="font-medium text-[var(--gh-fg-default)]">{selectedCustomer.shippingAddress || selectedCustomer.billingAddress}</p>
					</div>
				</div>

				<!-- Linked Iowa Compliance Logs -->
				<div class="space-y-2">
					<h4 class="text-xs font-bold uppercase tracking-wider text-[var(--gh-fg-muted)] flex items-center gap-1.5">
						<ShieldCheck class="w-4 h-4 text-emerald-500" />
						State Seed Audit History ({selectedCustomer.complianceLogs?.length || 0})
					</h4>

					{#if !selectedCustomer.complianceLogs || selectedCustomer.complianceLogs.length === 0}
						<p class="text-xs text-[var(--gh-fg-subtle)] italic p-3 gh-card-inset rounded">
							No regulated seed purchases logged for this customer.
						</p>
					{:else}
						<div class="divide-y gh-border-muted border gh-border-muted rounded gh-card-inset text-xs">
							{#each selectedCustomer.complianceLogs as comp}
								<div class="p-2.5 flex items-center justify-between">
									<div>
										<p class="font-semibold text-[var(--gh-fg-default)]">{comp.regulatedProduct}</p>
										<p class="text-[10px] font-mono text-[var(--gh-fg-muted)]">
											BOL/CMR: <span class="font-bold text-emerald-500">{comp.bolNumber}</span> &bull;
											Order: {comp.orderNumber} &bull; Qty: {comp.quantity} {comp.unit}
										</p>
									</div>
									<span class="gh-badge gh-badge-success text-[9px] uppercase font-semibold">
										{comp.complianceStatus}
									</span>
								</div>
							{/each}
						</div>
					{/if}
				</div>

				<!-- Recent Invoices -->
				<div class="space-y-2">
					<h4 class="text-xs font-bold uppercase tracking-wider text-[var(--gh-fg-muted)] flex items-center gap-1.5">
						<FileText class="w-4 h-4 text-blue-500" />
						Recent Invoices ({selectedCustomer.invoices?.length || 0})
					</h4>

					{#if !selectedCustomer.invoices || selectedCustomer.invoices.length === 0}
						<p class="text-xs text-[var(--gh-fg-subtle)] italic p-3 gh-card-inset rounded">
							No invoices issued yet.
						</p>
					{:else}
						<div class="divide-y gh-border-muted border gh-border-muted rounded gh-card-inset text-xs">
							{#each selectedCustomer.invoices as inv}
								<div class="p-2.5 flex items-center justify-between">
									<div>
										<span class="font-mono font-bold text-emerald-500">{inv.invoiceNumber}</span>
										<span class="text-[10px] text-[var(--gh-fg-muted)] ml-2">({inv.issueDate})</span>
									</div>
									<div class="text-right font-mono">
										<span class="font-bold">${inv.totalAmount.toFixed(2)}</span>
										<span class="gh-badge text-[9px] uppercase ml-2">{inv.status}</span>
									</div>
								</div>
							{/each}
						</div>
					{/if}
				</div>
			</div>
		</div>
	{/if}

	<!-- Create Customer Modal -->
	{#if showCreateModal}
		<div
			role="presentation"
			class="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs"
			onclick={(e) => {
				if (e.target === e.currentTarget) showCreateModal = false;
			}}
			onkeydown={(e) => e.key === 'Escape' && (showCreateModal = false)}
		>
			<div class="gh-card p-5 max-w-md w-full space-y-4 shadow-2xl">
				<h3 class="font-bold text-sm text-[var(--gh-fg-default)]">Create New Farm Customer Profile</h3>

				<div class="space-y-3 text-xs">
					<div>
						<label for="cust-name-input" class="text-[10px] uppercase text-[var(--gh-fg-subtle)] block mb-1">
							Customer Legal Name *
						</label>
						<input
							id="cust-name-input"
							type="text"
							bind:value={newCustName}
							placeholder="e.g. Caleb Henderson / Prairie Ridge Farms LLC"
							class="w-full p-2 rounded border gh-border-default gh-card-inset text-xs font-semibold"
						/>
					</div>

					<div class="grid grid-cols-2 gap-2">
						<div>
							<label for="cust-farm-input" class="text-[10px] uppercase text-[var(--gh-fg-subtle)] block mb-1">
								Farm Trade Name
							</label>
							<input
								id="cust-farm-input"
								type="text"
								bind:value={newCustFarm}
								placeholder="e.g. Prairie Ridge Farms"
								class="w-full p-2 rounded border gh-border-default gh-card-inset text-xs"
							/>
						</div>
						<div>
							<label for="cust-county-select" class="text-[10px] uppercase text-[var(--gh-fg-subtle)] block mb-1">
								Iowa County *
							</label>
							<select
								id="cust-county-select"
								bind:value={newCustCounty}
								class="w-full p-2 rounded border gh-border-default gh-card-inset text-xs"
							>
								<option value="Story">Story County, IA</option>
								<option value="Hamilton">Hamilton County, IA</option>
								<option value="Boone">Boone County, IA</option>
								<option value="Hardin">Hardin County, IA</option>
								<option value="Polk">Polk County, IA</option>
								<option value="Dallas">Dallas County, IA</option>
							</select>
						</div>
					</div>

					<div class="grid grid-cols-2 gap-2">
						<div>
							<label for="cust-phone-input" class="text-[10px] uppercase text-[var(--gh-fg-subtle)] block mb-1">
								Phone Number
							</label>
							<input
								id="cust-phone-input"
								type="text"
								bind:value={newCustPhone}
								placeholder="(515) 555-0123"
								class="w-full p-2 rounded border gh-border-default gh-card-inset text-xs"
							/>
						</div>
						<div>
							<label for="cust-email-input" class="text-[10px] uppercase text-[var(--gh-fg-subtle)] block mb-1">
								Email
							</label>
							<input
								id="cust-email-input"
								type="email"
								bind:value={newCustEmail}
								placeholder="grower@farm.com"
								class="w-full p-2 rounded border gh-border-default gh-card-inset text-xs"
							/>
						</div>
					</div>

					<div>
						<label for="cust-address-input" class="text-[10px] uppercase text-[var(--gh-fg-subtle)] block mb-1">
							Farm Shop / Staging Address
						</label>
						<input
							id="cust-address-input"
							type="text"
							bind:value={newCustAddress}
							placeholder="14228 290th St, Ames, IA"
							class="w-full p-2 rounded border gh-border-default gh-card-inset text-xs"
						/>
					</div>
				</div>

				<div class="flex justify-end gap-2 pt-2 border-t gh-border-muted">
					<button
						type="button"
						onclick={() => (showCreateModal = false)}
						class="gh-btn text-xs"
					>
						Cancel
					</button>
					<button
						type="button"
						onclick={createCustomer}
						disabled={createLoading || !newCustName.trim()}
						class="gh-btn-primary text-xs font-semibold"
					>
						Save Customer
					</button>
				</div>
			</div>
		</div>
	{/if}
</div>
