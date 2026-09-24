<script lang="ts">
	import { apiFetch } from '$lib/api/client';
	import type { ProductCategory } from '$lib/db/schema';
	import { Plus, X, Package } from 'lucide-svelte';

	let { onClose, onCreated } = $props<{
		onClose: () => void;
		onCreated: () => void;
	}>();

	let name = $state('');
	let category = $state<ProductCategory>('chemical');
	let unit = $state('gallon');
	let costBasis = $state<number>(20.0);
	let currentStock = $state<number>(50);

	// Dynamic 3-tier pricing strategy fields (auto-calculated from costBasis by default)
	let financedAppPrice = $state<number>(38.0);
	let cashAppPrice = $state<number>(34.0);
	let carryPrice = $state<number>(24.0);

	// Specific attributes
	let chemicalType = $state('Corn Post');
	let ratePerAcre = $state('32 oz');
	let seedTrait = $state('Enlist E3');
	let isRegulated = $state(false);
	let droneModel = $state('DJI Agras T50');

	let loading = $state(false);
	let error = $state<string | null>(null);

	function autoComputeTiers(cost: number) {
		costBasis = cost;
		financedAppPrice = Math.round((cost * 1.35 + 16.0) * 100) / 100;
		cashAppPrice = Math.round((cost * 1.25 + 13.0) * 100) / 100;
		carryPrice = Math.round((cost * 1.1) * 100) / 100;
	}

	async function handleSubmit() {
		error = null;
		if (!name.trim()) {
			error = 'Product name is required.';
			return;
		}

		loading = true;
		const res = await apiFetch('/inventory', {
			method: 'POST',
			body: JSON.stringify({
				name,
				category,
				unit,
				costBasis,
				financedAppPrice,
				cashAppPrice,
				carryPrice,
				currentStock,
				chemicalType: category === 'chemical' ? chemicalType : undefined,
				ratePerAcre: category === 'chemical' ? ratePerAcre : undefined,
				seedTrait: category === 'seed' ? seedTrait : undefined,
				isRegulated: category === 'seed' || isRegulated,
				droneModel: category === 'drone' ? droneModel : undefined
			})
		});
		loading = false;

		if (res.error) {
			error = res.error;
		} else {
			onCreated();
			onClose();
		}
	}
</script>

<div
	role="presentation"
	class="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs"
	onclick={(e) => {
		if (e.target === e.currentTarget) onClose();
	}}
	onkeydown={(e) => e.key === 'Escape' && onClose()}
>
	<div class="gh-card p-6 max-w-lg w-full space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
		<div class="flex items-center justify-between pb-3 border-b gh-border-muted">
			<h3 class="font-bold text-sm text-[var(--gh-fg-default)] flex items-center gap-2">
				<Package class="w-4 h-4 text-emerald-500" />
				Create New Inventory Product
			</h3>
			<button type="button" onclick={onClose} class="p-1 rounded text-[var(--gh-fg-muted)] hover:bg-[var(--gh-canvas-inset)]">
				<X class="w-4 h-4" />
			</button>
		</div>

		{#if error}
			<div class="p-2.5 rounded gh-badge-danger border text-xs">{error}</div>
		{/if}

		<div class="space-y-3 text-xs">
			<div>
				<label for="prod-name-input" class="text-[10px] uppercase text-[var(--gh-fg-subtle)] block mb-1">Product Name *</label>
				<input
					id="prod-name-input"
					type="text"
					bind:value={name}
					placeholder="e.g. Ventas Herbicide Premix"
					class="w-full p-2 rounded border gh-border-default gh-card-inset text-xs font-semibold"
				/>
			</div>

			<div class="grid grid-cols-2 gap-2">
				<div>
					<label for="prod-cat-select" class="text-[10px] uppercase text-[var(--gh-fg-subtle)] block mb-1">Category *</label>
					<select
						id="prod-cat-select"
						bind:value={category}
						onchange={() => {
							if (category === 'seed') { unit = 'bag'; isRegulated = true; }
							else if (category === 'chemical') unit = 'gallon';
							else if (category === 'drone') unit = 'system';
							else unit = 'unit';
						}}
						class="w-full p-2 rounded border gh-border-default gh-card-inset text-xs font-semibold"
					>
						<option value="chemical">Chemical Inventory</option>
						<option value="seed">Seed Inventory (Iowa Regulated)</option>
						<option value="drone">Drone Hardware Fleet</option>
						<option value="misc">MISC Shop & Hardware</option>
					</select>
				</div>
				<div>
					<label for="prod-unit-input" class="text-[10px] uppercase text-[var(--gh-fg-subtle)] block mb-1">Unit of Measure *</label>
					<input
						id="prod-unit-input"
						type="text"
						bind:value={unit}
						placeholder="gallon, bag, unit, bottle"
						class="w-full p-2 rounded border gh-border-default gh-card-inset text-xs"
					/>
				</div>
			</div>

			<div class="grid grid-cols-2 gap-2">
				<div>
					<label for="prod-cost-input" class="text-[10px] uppercase text-[var(--gh-fg-subtle)] block mb-1">Wholesale Cost Basis ($) *</label>
					<input
						id="prod-cost-input"
						type="number"
						bind:value={costBasis}
						oninput={(e) => autoComputeTiers(parseFloat((e.target as HTMLInputElement).value) || 0)}
						step="0.01"
						class="w-full p-2 rounded border gh-border-default gh-card-inset text-xs font-mono font-bold"
					/>
				</div>
				<div>
					<label for="prod-stock-input" class="text-[10px] uppercase text-[var(--gh-fg-subtle)] block mb-1">Initial Stock Level</label>
					<input
						id="prod-stock-input"
						type="number"
						bind:value={currentStock}
						class="w-full p-2 rounded border gh-border-default gh-card-inset text-xs font-mono"
					/>
				</div>
			</div>

			<!-- Multi-Tier Pricing Fields -->
			<div class="p-3 rounded gh-card-inset border gh-border-muted space-y-2">
				<span class="text-[10px] font-bold uppercase tracking-wider text-[var(--gh-fg-muted)] block">
					Configured 3-Tier Selling Prices
				</span>

				<div class="grid grid-cols-3 gap-2">
					<div>
						<label for="prod-tier1-input" class="text-[9px] uppercase text-emerald-500 font-bold block mb-0.5">Tier 1: Financed App</label>
						<input
							id="prod-tier1-input"
							type="number"
							bind:value={financedAppPrice}
							step="0.01"
							class="w-full p-1.5 rounded border gh-border-default gh-card text-xs font-mono font-semibold"
						/>
					</div>
					<div>
						<label for="prod-tier2-input" class="text-[9px] uppercase text-blue-500 font-bold block mb-0.5">Tier 2: Cash App</label>
						<input
							id="prod-tier2-input"
							type="number"
							bind:value={cashAppPrice}
							step="0.01"
							class="w-full p-1.5 rounded border gh-border-default gh-card text-xs font-mono font-semibold"
						/>
					</div>
					<div>
						<label for="prod-tier3-input" class="text-[9px] uppercase text-amber-500 font-bold block mb-0.5">Tier 3: Carry</label>
						<input
							id="prod-tier3-input"
							type="number"
							bind:value={carryPrice}
							step="0.01"
							class="w-full p-1.5 rounded border gh-border-default gh-card text-xs font-mono font-semibold"
						/>
					</div>
				</div>
			</div>
		</div>

		<div class="flex justify-end gap-2 pt-3 border-t gh-border-muted">
			<button type="button" onclick={onClose} class="gh-btn text-xs">
				Cancel
			</button>
			<button
				type="button"
				onclick={handleSubmit}
				disabled={loading || !name.trim()}
				class="gh-btn-primary text-xs font-semibold"
			>
				Create Product
			</button>
		</div>
	</div>
</div>
