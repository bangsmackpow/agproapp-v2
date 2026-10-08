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
		X
	} from 'lucide-svelte';

	let { onOpenNewProduct } = $props<{ onOpenNewProduct?: () => void }>();

	let activeCategory = $state<string>('all');
	let searchQuery = $state<string>('');
	let products = $state<Product[]>([]);
	let loading = $state(false);
	let showImportModal = $state(false);

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
										<div class="flex items-start gap-2">
											<div class="p-1.5 rounded bg-[var(--gh-canvas-inset)] border gh-border-muted text-emerald-500 mt-0.5">
												<Icon class="w-3.5 h-3.5" />
											</div>
											<div>
												<p class="font-semibold text-[var(--gh-fg-default)]">{prod.name}</p>
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
										</div>
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
</div>
