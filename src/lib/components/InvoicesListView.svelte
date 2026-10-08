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
		Clock,
		DollarSign,
		Plane,
		Pencil,
		Trash2
	} from 'lucide-svelte';

	import InvoicePrintModal from './InvoicePrintModal.svelte';
	import InvoiceDispatchModal from './InvoiceDispatchModal.svelte';

	let {
		onOpenComposer,
		onSelectInvoice,
		onEditInvoice,
		onSelectCustomer
	} = $props<{
		onOpenComposer?: () => void;
		onSelectInvoice?: (invoice: any) => void;
		onEditInvoice?: (invoice: any) => void;
		onSelectCustomer?: (customer: any) => void;
	}>();

	let invoices = $state<any[]>([]);
	let loading = $state(false);
	let activeFilter = $state<string>('all');
	let activePrintInvoice = $state<any | null>(null);
	let activeDispatchInvoice = $state<any | null>(null);

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

	async function deleteDraft(inv: any) {
		if (!confirm(`Are you sure you want to delete draft invoice ${inv.invoiceNumber}? This will return items to stock.`)) return;
		await apiFetch(`/invoices/${inv.id}`, { method: 'DELETE' });
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

	let totalRevenue = $derived(
		invoices.reduce((sum, inv) => sum + (inv.status !== 'canceled' ? inv.totalAmount : 0), 0)
	);
	let pendingAmount = $derived(
		invoices
			.filter((i) => i.status === 'sent' || i.status === 'draft')
			.reduce((sum, i) => sum + i.totalAmount, 0)
	);
	let pendingCount = $derived(invoices.filter((i) => i.status === 'sent' || i.status === 'draft').length);
	let totalAcres = $derived(
		invoices.reduce((sum, inv) => sum + (inv.acresTreated || 0), 0)
	);
</script>

<div class="space-y-4">
	<!-- Top Bar -->
	<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b gh-border-muted">
		<div>
			<h2 class="text-lg font-bold text-[var(--gh-fg-default)] flex items-center gap-2">
				<FileText class="w-5 h-5 text-emerald-500" />
				Invoices
			</h2>
			<p class="text-xs text-[var(--gh-fg-muted)] mt-0.5">
				Create, track, and dispatch customer invoices.
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

	<!-- Quick Summary Metrics -->
	<div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
		<div class="gh-card p-3.5 space-y-1">
			<div class="flex items-center justify-between text-[var(--gh-fg-muted)]">
				<span class="text-[11px] font-semibold uppercase tracking-wider">Total Sales Billed</span>
				<DollarSign class="w-3.5 h-3.5 text-emerald-500" />
			</div>
			<div class="text-xl font-bold font-mono text-[var(--gh-fg-default)]">
				${totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
			</div>
			<span class="text-[10px] text-[var(--gh-fg-muted)] block">
				{invoices.length} total invoices
			</span>
		</div>

		<div class="gh-card p-3.5 space-y-1">
			<div class="flex items-center justify-between text-[var(--gh-fg-muted)]">
				<span class="text-[11px] font-semibold uppercase tracking-wider">Pending / Unpaid</span>
				<Clock class="w-3.5 h-3.5 text-amber-500" />
			</div>
			<div class="text-xl font-bold font-mono text-[var(--gh-fg-default)]">
				${pendingAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
			</div>
			<span class="text-[10px] text-[var(--gh-fg-muted)] block">
				{pendingCount} drafts & sent
			</span>
		</div>

		<div class="gh-card p-3.5 space-y-1">
			<div class="flex items-center justify-between text-[var(--gh-fg-muted)]">
				<span class="text-[11px] font-semibold uppercase tracking-wider">Drone Coverage</span>
				<Plane class="w-3.5 h-3.5 text-blue-500" />
			</div>
			<div class="text-xl font-bold font-mono text-[var(--gh-fg-default)]">
				{totalAcres.toLocaleString()} <span class="text-xs font-sans font-normal text-[var(--gh-fg-muted)]">acres</span>
			</div>
			<span class="text-[10px] text-[var(--gh-fg-muted)] block">
				Custom application
			</span>
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
										onclick={() => {
											if (inv.status === 'draft') {
												onEditInvoice ? onEditInvoice(inv) : onSelectInvoice?.(inv);
											} else {
												activePrintInvoice = inv;
											}
										}}
										class="hover:underline flex items-center gap-1 group text-left cursor-pointer"
										title={inv.status === 'draft' ? 'Click to edit draft' : 'Click to view / print invoice'}
									>
										<span>{inv.invoiceNumber}</span>
										{#if inv.status === 'draft'}
											<Pencil class="w-3 h-3 text-blue-500 opacity-60 group-hover:opacity-100" />
										{:else}
											<ArrowUpRight class="w-3 h-3 text-[var(--gh-fg-subtle)]" />
										{/if}
									</button>
									{#if inv.items?.some((it: any) => it.isIowaComplianceVerified)}
										<span class="gh-badge gh-badge-success text-[8px] mt-0.5 inline-flex items-center gap-1">
											<ShieldCheck class="w-2.5 h-2.5" /> IA Seed BOL Verified
										</span>
									{/if}
								</td>

								<!-- Customer Name & County -->
								<td class="p-3">
									{#if onSelectCustomer && inv.customer}
										<button
											type="button"
											onclick={() => onSelectCustomer?.(inv.customer)}
											class="hover:underline text-left group cursor-pointer"
											title="View grower CRM profile & history"
										>
											<p class="font-semibold text-[var(--gh-fg-default)] group-hover:text-emerald-500 transition-colors flex items-center gap-1">
												{inv.customer?.name || 'Unknown Customer'}
												<ArrowUpRight class="w-2.5 h-2.5 opacity-0 group-hover:opacity-100 transition-opacity text-emerald-500" />
											</p>
											<p class="text-[10px] text-[var(--gh-fg-muted)]">
												{inv.customer?.farmName} &bull; {inv.customer?.county} Co, IA
											</p>
										</button>
									{:else}
										<p class="font-semibold text-[var(--gh-fg-default)]">
											{inv.customer?.name || 'Unknown Customer'}
										</p>
										<p class="text-[10px] text-[var(--gh-fg-muted)]">
											{inv.customer?.farmName} &bull; {inv.customer?.county} Co, IA
										</p>
									{/if}
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
									<div class="flex items-center justify-center gap-1.5">
										{#if inv.status === 'draft'}
											<button
												type="button"
												onclick={() => onEditInvoice ? onEditInvoice(inv) : onSelectInvoice?.(inv)}
												class="gh-btn text-[11px] py-0.5 px-2 text-blue-500 hover:bg-blue-500/10"
												title="Edit Draft Invoice"
											>
												<Pencil class="w-3 h-3" />
												Edit
											</button>
										{/if}

										<button
											type="button"
											onclick={() => (activePrintInvoice = inv)}
											class="gh-btn text-[11px] py-0.5 px-2"
											title="View & Print Physical Letter Layout"
										>
											<Printer class="w-3 h-3 text-emerald-500" />
											Print
										</button>

										{#if inv.status === 'draft'}
											<button
												type="button"
												onclick={() => (activeDispatchInvoice = inv)}
												class="gh-btn text-[11px] py-0.5 px-2 text-blue-500 hover:bg-blue-500/10"
												title="Electronic Distribution"
											>
												<Send class="w-3 h-3" />
												Dispatch
											</button>
											<button
												type="button"
												onclick={() => deleteDraft(inv)}
												class="gh-btn text-[11px] py-0.5 px-1.5 text-rose-500 hover:bg-rose-500/10"
												title="Delete Draft"
											>
												<Trash2 class="w-3 h-3" />
											</button>
										{:else if inv.status === 'sent'}
											<button
												type="button"
												onclick={() => (activeDispatchInvoice = inv)}
												class="gh-btn text-[11px] py-0.5 px-2 text-blue-500 hover:bg-blue-500/10"
												title="Resend Electronic Invoice"
											>
												<Send class="w-3 h-3" />
												Resend
											</button>
											<button
												type="button"
												onclick={() => updateStatus(inv.id, 'paid')}
												class="gh-btn text-[11px] py-0.5 px-2 text-emerald-500"
												title="Mark as Paid"
											>
												<CheckCircle2 class="w-3 h-3" />
												Paid
											</button>
										{:else if inv.status === 'paid'}
											<button
												type="button"
												onclick={() => (activeDispatchInvoice = inv)}
												class="gh-btn text-[11px] py-0.5 px-2 text-[var(--gh-fg-muted)]"
												title="Send Receipt Email"
											>
												<Send class="w-3 h-3" />
												Receipt
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

	<!-- Printable & Actionable Invoice Modal -->
	{#if activePrintInvoice}
		<InvoicePrintModal
			invoice={activePrintInvoice}
			onClose={() => (activePrintInvoice = null)}
			onEdit={(inv) => {
				activePrintInvoice = null;
				onEditInvoice ? onEditInvoice(inv) : onSelectInvoice?.(inv);
			}}
			onDispatch={(inv) => {
				activeDispatchInvoice = inv;
			}}
			onMarkPaid={(inv) => {
				updateStatus(inv.id, 'paid');
				activePrintInvoice = null;
			}}
		/>
	{/if}

	<!-- Electronic Dispatch Modal -->
	{#if activeDispatchInvoice}
		<InvoiceDispatchModal
			invoice={activeDispatchInvoice}
			onClose={() => (activeDispatchInvoice = null)}
			onDispatched={() => {
				activeDispatchInvoice = null;
				loadInvoices();
			}}
		/>
	{/if}
</div>
