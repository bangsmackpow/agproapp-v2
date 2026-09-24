<script lang="ts">
	import { apiFetch } from '$lib/api/client';
	import type { IowaComplianceLog } from '$lib/db/schema';
	import { ShieldCheck, Search, FileText, CheckCircle2, User, Calendar, ExternalLink } from 'lucide-svelte';

	let logs = $state<any[]>([]);
	let loading = $state(false);
	let searchQuery = $state<string>('');

	$effect(() => {
		loadCompliance();
	});

	async function loadCompliance() {
		loading = true;
		let path = '/compliance';
		if (searchQuery.trim()) path += `?q=${encodeURIComponent(searchQuery.trim())}`;
		const res = await apiFetch<{ logs: any[] }>(path);
		if (res.data) logs = res.data.logs || [];
		loading = false;
	}
</script>

<div class="space-y-4">
	<!-- Header -->
	<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b gh-border-muted">
		<div>
			<h2 class="text-lg font-bold text-[var(--gh-fg-default)] flex items-center gap-2">
				<ShieldCheck class="w-5 h-5 text-emerald-500" />
				State of Iowa Regulatory Seed Compliance Ledger
			</h2>
			<p class="text-xs text-[var(--gh-fg-muted)] mt-0.5">
				Iowa Department of Agriculture and Land Stewardship (IDALS) commercial seed audit tokens cross-referencing Channel Straight BOL/CMR and Order numbers.
			</p>
		</div>

		<!-- Search -->
		<div class="relative w-full sm:w-72">
			<Search class="w-3.5 h-3.5 text-[var(--gh-fg-subtle)] absolute left-2.5 top-2.5" />
			<input
				type="text"
				bind:value={searchQuery}
				oninput={loadCompliance}
				placeholder="Search BOL #, Order #, Lot, Farm..."
				class="w-full pl-8 pr-3 py-1.5 rounded-md gh-card-inset border gh-border-default text-xs"
			/>
		</div>
	</div>

	<!-- Compliance Ledger Table -->
	<div class="gh-card overflow-hidden">
		<div class="overflow-x-auto">
			<table class="w-full text-left text-xs border-collapse">
				<thead>
					<tr class="border-b gh-border-muted bg-[var(--gh-canvas-inset)] text-[var(--gh-fg-muted)] font-semibold">
						<th class="p-3">Verified Regulatory Tokens</th>
						<th class="p-3">Regulated Seed Variety</th>
						<th class="p-3">Customer / Farm Profile</th>
						<th class="p-3 text-right">Quantity</th>
						<th class="p-3">Audit Verification</th>
						<th class="p-3">Date Verified</th>
					</tr>
				</thead>
				<tbody class="divide-y gh-border-muted">
					{#if loading}
						<tr>
							<td colspan="6" class="p-8 text-center text-xs text-[var(--gh-fg-muted)]">
								Querying IDALS regulatory audit logs...
							</td>
						</tr>
					{:else if logs.length === 0}
						<tr>
							<td colspan="6" class="p-8 text-center text-xs text-[var(--gh-fg-muted)] space-y-1">
								<p>No seed compliance logs match your query.</p>
								<p class="text-[11px] text-[var(--gh-fg-subtle)]">
									Compliance entries are automatically generated when Channel BOL manifests are ingested or regulated seed invoices are finalized.
								</p>
							</td>
						</tr>
					{:else}
						{#each logs as log}
							<tr class="hover:bg-[var(--gh-canvas-inset)] transition-colors">
								<!-- Regulatory Tokens: BOL & Order -->
								<td class="p-3 space-y-0.5">
									<div class="flex items-center gap-1.5 font-mono">
										<span class="text-[10px] text-[var(--gh-fg-subtle)] uppercase">BOL/CMR:</span>
										<span class="font-bold text-emerald-600 dark:text-emerald-400">
											{log.bolNumber}
										</span>
									</div>
									<div class="flex items-center gap-1.5 font-mono">
										<span class="text-[10px] text-[var(--gh-fg-subtle)] uppercase">Order #:</span>
										<span class="font-medium text-[var(--gh-fg-default)]">
											{log.orderNumber}
										</span>
									</div>
								</td>

								<!-- Regulated Seed Product -->
								<td class="p-3">
									<p class="font-semibold text-[var(--gh-fg-default)]">
										{log.regulatedProduct}
									</p>
									<p class="text-[10px] text-[var(--gh-fg-muted)] font-mono">
										Crop: {log.cropType || 'Corn'} &bull; Lot: {log.lotNumber || 'N/A'}
									</p>
								</td>

								<!-- Customer Linkage -->
								<td class="p-3">
									<p class="font-semibold text-[var(--gh-fg-default)]">
										{log.customer?.name}
									</p>
									<p class="text-[10px] text-[var(--gh-fg-muted)]">
										{log.customer?.farmName} &bull; {log.customer?.county} County, IA
									</p>
								</td>

								<!-- Quantity -->
								<td class="p-3 text-right font-mono font-bold text-sm text-[var(--gh-fg-default)]">
									{log.quantity} {log.unit}
								</td>

								<!-- Audit Verification -->
								<td class="p-3">
									<span class="gh-badge gh-badge-success text-[10px] uppercase font-semibold flex items-center gap-1 w-fit">
										<CheckCircle2 class="w-3 h-3 text-emerald-500" />
										{log.complianceStatus}
									</span>
									<span class="block text-[10px] text-[var(--gh-fg-subtle)] mt-0.5">
										By: {log.verifiedByUser?.name || 'System Auto-Audit'}
									</span>
								</td>

								<!-- Date -->
								<td class="p-3 text-[11px] text-[var(--gh-fg-muted)] font-mono">
									{new Date(log.verifiedAt).toLocaleDateString()}
								</td>
							</tr>
						{/each}
					{/if}
				</tbody>
			</table>
		</div>
	</div>
</div>
