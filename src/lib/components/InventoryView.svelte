<script lang="ts">
	import { apiFetch } from '$lib/api/client';
	import { auth } from '$lib/stores/auth.svelte';
	import type { Product, ProductCategory } from '$lib/db/schema';
	import IngestionView from '$lib/components/IngestionView.svelte';
	import {
		Package,
		Plus,
		Search,
		Filter,
		Plane,
		Sprout,
		FlaskConical,
		Wrench,
		Lock,
		AlertCircle,
		CheckCircle2,
		ArrowUpDown,
		Tag,
		UploadCloud,
		X,
		ArrowUpRight,
		FileText
	} from 'lucide-svelte';

	let { onOpenNewProduct, onSelectInvoice } = $props<{
		onOpenNewProduct?: () => void;
		onSelectInvoice?: (invoiceNumber: string) => void;
	}>();

	let activeCategory = $state<string>('all');
	let searchQuery = $state<string>('');
	let products = $state<Product[]>([]);
	let loading = $state(false);
	let showImportModal = $state(false);
	let selectedProduct = $state<any | null>(null);

	// Adjust Stock Modal State
	let adjustingProduct = $state<Product | null>(null);
	let stockDelta = $state<number>(10);
	let adjustNotes = $state<string>('');
	let adjustLoading = $state(false);

	$effect(() => {
		loadInventory();
	});

	async function loadInventory() {
		loading = true;
		let path = '/inventory';
		const params = new URLSearchParams();
		if (activeCategory !== 'all') params.append('category', activeCategory);
		if (searchQuery.trim()) params.append('q', searchQuery.trim());
		if (params.toString()) path += `?${params.toString()}`;

		const res = await apiFetch<{ products: Product[] }>(path);
		if (res.data) products = res.data.products || [];
		loading = false;
	}

	async function inspectProduct(id: string) {
		const res = await apiFetch<{ product: any }>(`/inventory/${id}`);
		if (res.data?.product) {
			selectedProduct = res.data.product;
		}
	}

	async function submitStockAdjustment() {
		if (!adjustingProduct || isNaN(stockDelta)) return;
		adjustLoading = true;
		const res = await apiFetch(`/inventory/${adjustingProduct.id}/adjust-stock`, {
			method: 'POST',
			body: JSON.stringify({
				quantityChange: stockDelta,
				notes: adjustNotes
			})
		});
		adjustLoading = false;
		if (res.data) {
			adjustingProduct = null;
			loadInventory();
		}
	}

	const categoryIcons: Record<string, any> = {
		chemical: FlaskConical,
		seed: Sprout,
		drone: Plane,
		misc: Wrench
	};
</script>

<div class="space-y-4">
	<!-- Top Bar -->
	<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b gh-border-muted">
		<div>
			<h2 class="text-lg font-bold text-[var(--gh-fg-default)] flex items-center gap-2">
				<Package class="w-5 h-5 text-emerald-500" />
				Inventory
			</h2>
			<p class="text-xs text-[var(--gh-fg-muted)] mt-0.5">
				Track products, on-hand stock, and pricing tiers.
			</p>
		</div>

		<div class="flex items-center gap-2">
			{#if auth.isSales}
				<div class="gh-badge text-xs px-2.5 py-1 flex items-center gap-1.5 opacity-80" title="Sales reps have Read-Only view">
					<Lock class="w-3.5 h-3.5" />
					<span>Sales Persona: Read-Only</span>
				</div>
			{:else}
				<button
					type="button"
					onclick={() => (showImportModal = true)}
					class="gh-btn text-xs font-semibold flex items-center gap-1.5"
				>
					<UploadCloud class="w-3.5 h-3.5 text-emerald-500" />
					Import BOL / Invoices
				</button>
				<button
					type="button"
					onclick={onOpenNewProduct}
					class="gh-btn-primary text-xs font-semibold"
				>
					<Plus class="w-3.5 h-3.5" />
					New Product
				</button>
			{/if}
		</div>
	</div>
		<!-- Filters & Search -->
		<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
			<!-- Category filter buttons -->
			<div class="flex items-center gap-1 overflow-x-auto no-scrollbar py-1">
				{#each ['all', 'chemical', 'seed', 'drone', 'misc'] as cat}
					<button
						type="button"
						onclick={() => { activeCategory = cat; loadInventory(); }}
						class="gh-btn text-xs capitalize {activeCategory === cat ? 'border-emerald-500 font-semibold text-emerald-500' : ''}"
					>
						{cat}
					</button>
				{/each}
			</div>

			<!-- Search input -->
			<div class="relative w-full sm:w-64">
				<Search class="w-3.5 h-3.5 text-[var(--gh-fg-subtle)] absolute left-2.5 top-2.5" />
				<input
					type="text"
					bind:value={searchQuery}
					oninput={loadInventory}
					placeholder="Search SKU, name, trait..."
					class="w-full pl-8 pr-3 py-1.5 rounded-md gh-card-inset border gh-border-default text-xs"
				/>
			</div>
		</div>

		<!-- Products Table -->
		<div class="gh-card overflow-hidden">
			<div class="overflow-x-auto">
				<table class="w-full text-left text-xs border-collapse">
					<thead>
						<tr class="border-b gh-border-muted bg-[var(--gh-canvas-inset)] text-[var(--gh-fg-muted)] font-semibold">
							<th class="p-3">Product Name & Category</th>
							<th class="p-3">SKU / Reg #</th>
							<th class="p-3 text-right">Cost Basis</th>
							<th class="p-3 text-right">
								<span class="text-emerald-500">Tier 1: Financed App</span>
							</th>
							<th class="p-3 text-right">
								<span class="text-blue-500">Tier 2: Cash App</span>
							</th>
							<th class="p-3 text-right">
								<span class="text-amber-500">Tier 3: Carry</span>
							</th>
							<th class="p-3 text-right">Stock</th>
							<th class="p-3 text-center">Actions</th>
						</tr>
					</thead>
					<tbody class="divide-y gh-border-muted">
						{#if loading}
							<tr>
								<td colspan="8" class="p-8 text-center text-xs text-[var(--gh-fg-muted)]">
									Loading inventory records...
								</td>
							</tr>
						{:else if products.length === 0}
							<tr>
								<td colspan="8" class="p-8 text-center text-xs text-[var(--gh-fg-muted)]">
									No inventory records found.
								</td>
							</tr>
						{:else}
							{#each products as prod}
								{@const Icon = categoryIcons[prod.category] || Package}
								<tr class="hover:bg-[var(--gh-canvas-inset)] transition-colors">
									<td class="p-3">
										<button
											type="button"
											onclick={() => inspectProduct(prod.id)}
											class="flex items-start gap-2 text-left hover:opacity-80 transition-opacity cursor-pointer group"
											title="View product specifications & invoice field history"
										>
											<div class="p-1.5 rounded bg-[var(--gh-canvas-inset)] border gh-border-muted text-emerald-500 mt-0.5 group-hover:border-emerald-500 transition-colors">
												<Icon class="w-3.5 h-3.5" />
											</div>
											<div>
												<p class="font-semibold text-[var(--gh-fg-default)] group-hover:text-emerald-500 transition-colors flex items-center gap-1">
													{prod.name}
													<ArrowUpRight class="w-2.5 h-2.5 opacity-0 group-hover:opacity-100 transition-opacity text-emerald-500" />
												</p>
												<div class="flex items-center gap-1.5 text-[10px] text-[var(--gh-fg-muted)] mt-0.5">
													<span class="gh-badge text-[9px] uppercase">{prod.category}</span>
													<span>Unit: {prod.unit}</span>
													{#if prod.chemicalType}
														<span>&bull; {prod.chemicalType} ({prod.ratePerAcre || 'std'})</span>
													{/if}
													{#if prod.seedTrait}
														<span>&bull; {prod.seedTrait}</span>
													{/if}
													{#if prod.isRegulated}
														<span class="gh-badge gh-badge-attention text-[9px]">Iowa BOL Req</span>
													{/if}
												</div>
											</div>
										</button>
									</td>

									<td class="p-3 font-mono text-[11px] text-[var(--gh-fg-subtle)]">
										{prod.sku}
										{#if prod.epaRegNumber}
											<span class="block text-[9px] text-[var(--gh-fg-subtle)]">EPA: {prod.epaRegNumber}</span>
										{/if}
									</td>

									<td class="p-3 text-right font-mono text-[var(--gh-fg-muted)]">
										${prod.costBasis.toFixed(2)}
									</td>

									<!-- Tier 1: Financed Application -->
									<td class="p-3 text-right font-mono font-semibold text-emerald-600 dark:text-emerald-400">
										${prod.financedAppPrice.toFixed(2)}
									</td>

									<!-- Tier 2: Cash Application -->
									<td class="p-3 text-right font-mono font-semibold text-blue-600 dark:text-blue-400">
										${prod.cashAppPrice.toFixed(2)}
									</td>

									<!-- Tier 3: Carry Only -->
									<td class="p-3 text-right font-mono font-semibold text-amber-600 dark:text-amber-400">
										${prod.carryPrice.toFixed(2)}
									</td>

									<td class="p-3 text-right font-mono font-bold {prod.currentStock <= prod.reorderThreshold ? 'text-amber-500' : 'text-[var(--gh-fg-default)]'}">
										{prod.currentStock}
									</td>

									<td class="p-3 text-center">
										{#if auth.canManageInventory}
											<button
												type="button"
												onclick={() => { adjustingProduct = prod; stockDelta = 10; adjustNotes = ''; }}
												class="gh-btn text-[11px] py-0.5 px-2"
											>
												Adjust
											</button>
										{:else}
											<span class="text-[10px] text-[var(--gh-fg-subtle)] italic">Read Only</span>
										{/if}
									</td>
								</tr>
							{/each}
						{/if}
					</tbody>
				</table>
			</div>
		</div>


	<!-- Stock Adjustment Modal -->
	{#if adjustingProduct}
		<div
			role="presentation"
			class="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs"
			onclick={(e) => {
				if (e.target === e.currentTarget) adjustingProduct = null;
			}}
			onkeydown={(e) => e.key === 'Escape' && (adjustingProduct = null)}
		>
			<div class="gh-card p-5 max-w-sm w-full space-y-4 shadow-2xl">
				<h3 class="font-bold text-sm text-[var(--gh-fg-default)]">
					Adjust Inventory: {adjustingProduct.name}
				</h3>

				<div class="space-y-3 text-xs">
					<div>
						<span class="text-[var(--gh-fg-muted)] block text-[10px] uppercase">Current On-Hand:</span>
						<span class="font-mono font-bold text-sm text-[var(--gh-fg-default)]">
							{adjustingProduct.currentStock} {adjustingProduct.unit}
						</span>
					</div>

					<div>
						<label for="stock-delta" class="text-[10px] uppercase text-[var(--gh-fg-subtle)] block mb-1">
							Quantity Change (+ Addition, - Deduction)
						</label>
						<input
							id="stock-delta"
							type="number"
							bind:value={stockDelta}
							class="w-full p-2 rounded border gh-border-default gh-card-inset text-xs font-mono"
						/>
					</div>

					<div>
						<label for="adjust-reason" class="text-[10px] uppercase text-[var(--gh-fg-subtle)] block mb-1">
							Reason / Transaction Notes
						</label>
						<input
							id="adjust-reason"
							type="text"
							bind:value={adjustNotes}
							placeholder="e.g. Physical cycle count audit"
							class="w-full p-2 rounded border gh-border-default gh-card-inset text-xs"
						/>
					</div>
				</div>

				<div class="flex justify-end gap-2 pt-2 border-t gh-border-muted">
					<button
						type="button"
						onclick={() => (adjustingProduct = null)}
						class="gh-btn text-xs"
					>
						Cancel
					</button>
					<button
						type="button"
						onclick={submitStockAdjustment}
						disabled={adjustLoading}
						class="gh-btn-primary text-xs font-semibold"
					>
						Apply Adjustment
					</button>
				</div>
			</div>
		</div>
	{/if}

	<!-- Import BOL / Invoices Modal -->
	{#if showImportModal}
		<div
			role="presentation"
			class="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs overflow-y-auto"
			onclick={(e) => {
				if (e.target === e.currentTarget) showImportModal = false;
			}}
			onkeydown={(e) => e.key === 'Escape' && (showImportModal = false)}
		>
			<div class="gh-card p-5 max-w-4xl w-full max-h-[90vh] overflow-y-auto space-y-4 shadow-2xl relative my-auto">
				<div class="flex items-center justify-between pb-3 border-b gh-border-muted">
					<div class="flex items-center gap-2">
						<UploadCloud class="w-4 h-4 text-emerald-500" />
						<h3 class="font-bold text-sm text-[var(--gh-fg-default)]">Import Vendor Invoices & Channel Seed BOLs</h3>
					</div>
					<button
						type="button"
						onclick={() => (showImportModal = false)}
						class="gh-btn p-1.5 text-xs"
						title="Close modal"
					>
						<X class="w-4 h-4" />
					</button>
				</div>
				<IngestionView onImportCompleted={() => { loadInventory(); }} />
			</div>
		</div>
	{/if}

	<!-- Product Detail Slide-Over Drawer -->
	{#if selectedProduct}
		<div
			role="presentation"
			class="fixed inset-0 bg-black/60 z-50 flex justify-end backdrop-blur-xs"
			onclick={(e) => {
				if (e.target === e.currentTarget) selectedProduct = null;
			}}
			onkeydown={(e) => e.key === 'Escape' && (selectedProduct = null)}
		>
			<div class="bg-[var(--gh-card-bg)] border-l gh-border-default w-full max-w-lg h-full overflow-y-auto p-6 space-y-6 shadow-2xl">
				<!-- Header -->
				<div class="flex items-start justify-between pb-4 border-b gh-border-muted">
					<div class="space-y-1">
						<span class="gh-badge text-[10px] uppercase font-bold text-emerald-500">{selectedProduct.category}</span>
						<h3 class="text-base font-bold text-[var(--gh-fg-default)]">{selectedProduct.name}</h3>
						<p class="text-xs font-mono text-[var(--gh-fg-subtle)]">
							SKU: {selectedProduct.sku}
							{#if selectedProduct.epaRegNumber}
								&bull; EPA: {selectedProduct.epaRegNumber}
							{/if}
						</p>
					</div>
					<button
						type="button"
						onclick={() => (selectedProduct = null)}
						class="p-1 rounded hover:bg-[var(--gh-canvas-inset)] text-[var(--gh-fg-muted)] cursor-pointer"
					>
						<X class="w-4 h-4" />
					</button>
				</div>

				<!-- Current Stock & Quick Adjustment -->
				<div class="p-3.5 bg-[var(--gh-canvas-inset)] border gh-border-muted rounded-md flex items-center justify-between">
					<div>
						<span class="text-[10px] uppercase tracking-wider text-[var(--gh-fg-muted)] font-semibold block">On-Hand Stock</span>
						<span class="text-xl font-bold font-mono text-[var(--gh-fg-default)]">
							{selectedProduct.currentStock} <span class="text-xs font-sans font-normal text-[var(--gh-fg-muted)]">{selectedProduct.unit}</span>
						</span>
					</div>
					{#if auth.canManageInventory}
						<button
							type="button"
							onclick={() => {
								adjustingProduct = selectedProduct;
								stockDelta = 10;
								adjustNotes = '';
							}}
							class="gh-btn text-xs font-semibold"
						>
							Adjust Stock
						</button>
					{/if}
				</div>

				<!-- Pricing Tiers Card -->
				<div class="space-y-2">
					<h4 class="text-xs font-bold uppercase tracking-wider text-[var(--gh-fg-muted)]">3-Tier Pricing Structure</h4>
					<div class="grid grid-cols-3 gap-2 text-xs">
						<div class="p-2.5 rounded bg-[var(--gh-canvas-subtle)] border gh-border-muted space-y-0.5">
							<span class="text-[10px] text-emerald-500 font-semibold block">Financed App</span>
							<span class="font-mono font-bold text-emerald-600 dark:text-emerald-400">${selectedProduct.financedAppPrice.toFixed(2)}</span>
						</div>
						<div class="p-2.5 rounded bg-[var(--gh-canvas-subtle)] border gh-border-muted space-y-0.5">
							<span class="text-[10px] text-blue-500 font-semibold block">Cash App</span>
							<span class="font-mono font-bold text-blue-600 dark:text-blue-400">${selectedProduct.cashAppPrice.toFixed(2)}</span>
						</div>
						<div class="p-2.5 rounded bg-[var(--gh-canvas-subtle)] border gh-border-muted space-y-0.5">
							<span class="text-[10px] text-amber-500 font-semibold block">Carry Only</span>
							<span class="font-mono font-bold text-amber-600 dark:text-amber-400">${selectedProduct.carryPrice.toFixed(2)}</span>
						</div>
					</div>
					<div class="text-[11px] text-[var(--gh-fg-muted)] flex justify-between px-1">
						<span>Cost Basis: <strong class="font-mono">${selectedProduct.costBasis.toFixed(2)}</strong></span>
						<span>Cash App Margin: <strong class="font-mono text-emerald-500">{((selectedProduct.cashAppPrice - selectedProduct.costBasis) / (selectedProduct.cashAppPrice || 1) * 100).toFixed(1)}%</strong></span>
					</div>
				</div>

				<!-- Recent Invoice Sales & Stock Movements -->
				<div class="space-y-2">
					<h4 class="text-xs font-bold uppercase tracking-wider text-[var(--gh-fg-muted)] flex items-center gap-1.5">
						<FileText class="w-4 h-4 text-emerald-500" />
						Recent Field Sales & Usage ({selectedProduct.transactions?.length || 0})
					</h4>

					{#if !selectedProduct.transactions || selectedProduct.transactions.length === 0}
						<p class="text-xs text-[var(--gh-fg-subtle)] italic p-3 gh-card-inset rounded">
							No recorded inventory transactions yet.
						</p>
					{:else}
						<div class="divide-y gh-border-muted border gh-border-muted rounded gh-card-inset text-xs">
							{#each selectedProduct.transactions as txn}
								<div class="p-2.5 flex items-center justify-between">
									<div class="space-y-0.5">
										{#if txn.referenceId && onSelectInvoice}
											<button
												type="button"
												onclick={() => {
													const ref = txn.referenceId;
													selectedProduct = null;
													onSelectInvoice?.(ref);
												}}
												class="font-mono font-bold text-emerald-500 hover:underline flex items-center gap-1 cursor-pointer"
												title="Jump to this invoice"
											>
												{txn.referenceId}
												<ArrowUpRight class="w-2.5 h-2.5" />
											</button>
										{:else if txn.referenceId}
											<span class="font-mono font-bold text-[var(--gh-fg-default)]">{txn.referenceId}</span>
										{:else}
											<span class="font-semibold capitalize text-[var(--gh-fg-default)]">{txn.transactionType.replace('_', ' ')}</span>
										{/if}
										<p class="text-[10px] text-[var(--gh-fg-muted)]">{txn.notes || 'Transaction recorded'}</p>
									</div>
									<div class="text-right font-mono">
										<span class="font-bold {txn.quantityChange < 0 ? 'text-amber-500' : 'text-emerald-500'}">
											{txn.quantityChange > 0 ? '+' : ''}{txn.quantityChange} {selectedProduct.unit}
										</span>
										<span class="text-[10px] text-[var(--gh-fg-subtle)] block">
											{new Date(txn.createdAt).toLocaleDateString()}
										</span>
									</div>
								</div>
							{/each}
						</div>
					{/if}
				</div>
			</div>
		</div>
	{/if}
</div>
