<script lang="ts">
	import { apiFetch } from '$lib/api/client';
	import type { Invoice, InvoiceStatus } from '$lib/db/schema';
	import {
		FileText,
		Plus,
		Search,
		Send,
		Printer,
		CheckCircle2,
		XCircle,
		ShieldCheck,
		ArrowUpRight,
		Clock
	} from 'lucide-svelte';

	let { onOpenComposer, onSelectInvoice } = $props<{
		onOpenComposer?: () => void;
		onSelectInvoice?: (invoice: any) => void;
	}>();

	let invoices = $state<any[]>([]);
	let loading = $state(false);
	let activeFilter = $state<string>('all');

	$effect(() => {
		loadInvoices();
	});

	async function loadInvoices() {
		loading = true;
		let path = '/invoices';
		if (activeFilter !== 'all') path += `?status=${activeFilter}`;
		const res = await apiFetch<{ invoices: any[] }>(path);
		if (res.data) invoices = res.data.invoices || [];
		loading = false;
	}

	async function updateStatus(id: string, newStatus: InvoiceStatus) {
		await apiFetch(`/invoices/${id}/status`, {
			method: 'PATCH',
			body: JSON.stringify({ status: newStatus })
		});
		loadInvoices();
	}

	const statusBadges: Record<InvoiceStatus, string> = {
		draft: 'gh-badge text-[var(--gh-fg-muted)]',
		sent: 'gh-badge border-blue-500/40 text-blue-500',
		paid: 'gh-badge gh-badge-success',
		canceled: 'gh-badge gh-badge-danger'
	};

	const tierLabels: Record<string, { label: string; color: string }> = {
		financed_app: { label: 'Financed App', color: 'text-emerald-500' },
		cash_app: { label: 'Cash App', color: 'text-blue-500' },
		carry: { label: 'Carry', color: 'text-amber-500' }
	};
</script>

<div class="space-y-4">
	<!-- Top Bar -->
	<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b gh-border-muted">
		<div>
			<h2 class="text-lg font-bold text-[var(--gh-fg-default)] flex items-center gap-2">
				<FileText class="w-5 h-5 text-emerald-500" />
				Invoicing & Sales Lifecycle Engine
			</h2>
			<p class="text-xs text-[var(--gh-fg-muted)] mt-0.5">
				Track invoice states (Draft &rarr; Sent &rarr; Paid), pricing strategy tiers, and Iowa regulatory audit verification.
			</p>
		</div>

		<div class="flex items-center gap-2">
			<button
				type="button"
				onclick={onOpenComposer}
				class="gh-btn-primary text-xs font-semibold"
			>
				<Plus class="w-3.5 h-3.5" />
				New Invoice
			</button>
		</div>
	</div>

	<!-- Status Filter Tabs -->
	<div class="flex items-center gap-1 overflow-x-auto no-scrollbar pb-1 text-xs">
		{#each ['all', 'draft', 'sent', 'paid', 'canceled'] as st}
			<button
				type="button"
				onclick={() => { activeFilter = st; loadInvoices(); }}
				class="gh-btn capitalize text-xs {activeFilter === st ? 'border-emerald-500 font-semibold text-emerald-500' : ''}"
			>
				{st}
			</button>
		{/each}
	</div>

	<!-- Invoices Table -->
	<div class="gh-card overflow-hidden">
		<div class="overflow-x-auto">
			<table class="w-full text-left text-xs border-collapse">
				<thead>
					<tr class="border-b gh-border-muted bg-[var(--gh-canvas-inset)] text-[var(--gh-fg-muted)] font-semibold">
						<th class="p-3">Invoice #</th>
						<th class="p-3">Customer / Farm Entity</th>
						<th class="p-3">Pricing Tier</th>
						<th class="p-3">Status</th>
						<th class="p-3">Dates</th>
						<th class="p-3 text-right">Total Amount</th>
						<th class="p-3 text-right">Gross Margin</th>
						<th class="p-3 text-center">Actions</th>
					</tr>
				</thead>
				<tbody class="divide-y gh-border-muted">
					{#if loading}
						<tr>
							<td colspan="8" class="p-8 text-center text-xs text-[var(--gh-fg-muted)]">
								Loading sales invoices...
							</td>
						</tr>
					{:else if invoices.length === 0}
						<tr>
							<td colspan="8" class="p-8 text-center text-xs text-[var(--gh-fg-muted)] space-y-2">
								<p>No invoices found in this view.</p>
								<button type="button" onclick={onOpenComposer} class="gh-btn-primary text-xs">
									<Plus class="w-3.5 h-3.5" />
									Create First Invoice
								</button>
							</td>
						</tr>
					{:else}
						{#each invoices as inv}
							{@const tier = tierLabels[inv.pricingStrategyTier] || { label: inv.pricingStrategyTier, color: '' }}
							<tr class="hover:bg-[var(--gh-canvas-inset)] transition-colors">
								<!-- Invoice Number -->
								<td class="p-3 font-mono font-bold text-emerald-600 dark:text-emerald-400">
									<button
										type="button"
										onclick={() => onSelectInvoice?.(inv)}
										class="hover:underline flex items-center gap-1"
									>
										{inv.invoiceNumber}
										<ArrowUpRight class="w-3 h-3 text-[var(--gh-fg-subtle)]" />
									</button>
									{#if inv.items?.some((it: any) => it.isIowaComplianceVerified)}
										<span class="gh-badge gh-badge-success text-[8px] mt-0.5 inline-flex items-center gap-1">
											<ShieldCheck class="w-2.5 h-2.5" /> IA Seed BOL Verified
										</span>
									{/if}
								</td>

								<!-- Customer Name & County -->
								<td class="p-3">
									<p class="font-semibold text-[var(--gh-fg-default)]">
										{inv.customer?.name || 'Unknown Customer'}
									</p>
									<p class="text-[10px] text-[var(--gh-fg-muted)]">
										{inv.customer?.farmName} &bull; {inv.customer?.county} Co, IA
									</p>
								</td>

								<!-- Pricing Strategy Tier -->
								<td class="p-3">
									<span class="font-medium text-[11px] {tier.color}">
										{tier.label}
									</span>
									{#if inv.acresTreated}
										<span class="block text-[10px] text-[var(--gh-fg-muted)]">
											{inv.acresTreated} acres aerial app
										</span>
									{/if}
								</td>

								<!-- Status Pill -->
								<td class="p-3">
									<span class="{statusBadges[inv.status as InvoiceStatus]} text-[10px] uppercase font-semibold">
										{inv.status}
									</span>
								</td>

								<!-- Dates -->
								<td class="p-3 text-[11px] text-[var(--gh-fg-muted)]">
									<span class="block">Issued: {inv.issueDate}</span>
									<span class="text-[10px] text-[var(--gh-fg-subtle)]">Due: {inv.dueDate}</span>
								</td>

								<!-- Financial Total -->
								<td class="p-3 text-right font-mono font-bold text-sm text-[var(--gh-fg-default)]">
									${inv.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
								</td>

								<!-- Gross Profit Margin -->
								<td class="p-3 text-right font-mono text-[11px] text-emerald-500 font-semibold">
									${inv.grossMarginAmount.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
									<span class="block text-[9px] text-[var(--gh-fg-muted)]">
										{inv.grossMarginPercent.toFixed(1)}% margin
									</span>
								</td>

								<!-- Quick Actions -->
								<td class="p-3 text-center">
									<div class="flex items-center justify-center gap-1">
										{#if inv.status === 'draft'}
											<button
												type="button"
												onclick={() => updateStatus(inv.id, 'sent')}
												class="gh-btn text-[11px] py-0.5 px-2"
												title="Mark as Sent / Dispatched"
											>
												<Send class="w-3 h-3 text-blue-500" />
												Dispatch
											</button>
										{:else if inv.status === 'sent'}
											<button
												type="button"
												onclick={() => updateStatus(inv.id, 'paid')}
												class="gh-btn text-[11px] py-0.5 px-2 text-emerald-500"
												title="Mark as Paid"
											>
												<CheckCircle2 class="w-3 h-3" />
												Paid
											</button>
										{/if}
									</div>
								</td>
							</tr>
						{/each}
					{/if}
				</tbody>
			</table>
		</div>
	</div>
</div>
