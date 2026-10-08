<script lang="ts">
	import { apiFetch } from '$lib/api/client';
	import { auth } from '$lib/stores/auth.svelte';
	import {
		DollarSign,
		Plane,
		FileText,
		ArrowRight,
		Clock,
		CheckCircle2,
		AlertCircle
	} from 'lucide-svelte';

	let { onNavigate } = $props<{ onNavigate: (tab: string) => void }>();

	let invoices = $state<any[]>([]);
	let loading = $state(false);

	$effect(() => {
		loadStats();
	});

	async function loadStats() {
		loading = true;
		const res = await apiFetch<{ invoices: any[] }>('/invoices');
		if (res.data) invoices = res.data.invoices || [];
		loading = false;
	}

	let totalRevenue = $derived(
		invoices.reduce((sum, inv) => sum + (inv.status !== 'canceled' ? inv.totalAmount : 0), 0)
	);

	let totalAcres = $derived(
		invoices.reduce((sum, inv) => sum + (inv.acresTreated || 0), 0)
	);

	let paidCount = $derived(invoices.filter((i) => i.status === 'paid').length);
	let pendingCount = $derived(invoices.filter((i) => i.status === 'sent' || i.status === 'draft').length);
	let pendingAmount = $derived(
		invoices
			.filter((i) => i.status === 'sent' || i.status === 'draft')
			.reduce((sum, i) => sum + i.totalAmount, 0)
	);
</script>

<div class="space-y-5">
	<!-- Clean Top Bar -->
	<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b gh-border-muted">
		<div>
			<h2 class="text-lg font-bold text-[var(--gh-fg-default)]">
				Operations Dashboard
			</h2>
			<p class="text-xs text-[var(--gh-fg-muted)] mt-0.5">
				Logged in as <span class="font-medium text-[var(--gh-fg-default)]">{auth.user?.name || 'Staff'}</span> &bull; <span class="uppercase font-mono text-emerald-500 font-semibold">{auth.role}</span>
			</p>
		</div>

		<div class="flex items-center gap-2">
			<button
				type="button"
				onclick={() => onNavigate('invoices')}
				class="gh-btn-primary text-xs font-semibold"
			>
				<FileText class="w-3.5 h-3.5" />
				New Invoice
			</button>
		</div>
	</div>

	<!-- Metric Tiles -->
	<div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
		<!-- Tile 1: Total Revenue -->
		<div class="gh-card p-4 space-y-1.5">
			<div class="flex items-center justify-between text-[var(--gh-fg-muted)]">
				<span class="text-xs font-semibold uppercase tracking-wider">Total Sales Billed</span>
				<DollarSign class="w-4 h-4 text-emerald-500" />
			</div>
			<div class="text-2xl font-bold font-mono text-[var(--gh-fg-default)]">
				${totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
			</div>
			<span class="text-[11px] text-[var(--gh-fg-muted)] block">
				{invoices.length} total invoices ({paidCount} paid)
			</span>
		</div>

		<!-- Tile 2: Open Receivables / Pending -->
		<div class="gh-card p-4 space-y-1.5">
			<div class="flex items-center justify-between text-[var(--gh-fg-muted)]">
				<span class="text-xs font-semibold uppercase tracking-wider">Pending / Unpaid</span>
				<Clock class="w-4 h-4 text-amber-500" />
			</div>
			<div class="text-2xl font-bold font-mono text-[var(--gh-fg-default)]">
				${pendingAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
			</div>
			<span class="text-[11px] text-[var(--gh-fg-muted)] block">
				{pendingCount} drafts & sent invoices
			</span>
		</div>

		<!-- Tile 3: Drone Coverage -->
		<div class="gh-card p-4 space-y-1.5">
			<div class="flex items-center justify-between text-[var(--gh-fg-muted)]">
				<span class="text-xs font-semibold uppercase tracking-wider">Drone Coverage</span>
				<Plane class="w-4 h-4 text-blue-500" />
			</div>
			<div class="text-2xl font-bold font-mono text-[var(--gh-fg-default)]">
				{totalAcres.toLocaleString()} <span class="text-sm font-sans font-normal text-[var(--gh-fg-muted)]">acres</span>
			</div>
			<span class="text-[11px] text-[var(--gh-fg-muted)] block">
				Custom aerial application
			</span>
		</div>
	</div>

	<!-- Recent Invoices & Status Breakdown -->
	<div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
		<!-- Left: Recent Invoices (2 cols) -->
		<div class="lg:col-span-2 gh-card p-4 space-y-3">
			<div class="flex items-center justify-between pb-2 border-b gh-border-muted">
				<h3 class="text-xs font-bold uppercase tracking-wider text-[var(--gh-fg-default)] flex items-center gap-1.5">
					<FileText class="w-4 h-4 text-emerald-500" />
					Recent Invoices
				</h3>
				<button
					type="button"
					onclick={() => onNavigate('invoices')}
					class="text-xs text-emerald-500 hover:underline flex items-center gap-1"
				>
					View all <ArrowRight class="w-3 h-3" />
				</button>
			</div>

			{#if loading}
				<div class="p-6 text-center text-xs text-[var(--gh-fg-muted)]">Loading invoices...</div>
			{:else if invoices.length === 0}
				<div class="p-6 text-center text-xs text-[var(--gh-fg-muted)]">No invoices yet.</div>
			{:else}
				<div class="divide-y gh-border-muted text-xs">
					{#each invoices.slice(0, 6) as inv}
						<div class="py-2.5 flex items-center justify-between gap-3">
							<div>
								<div class="flex items-center gap-2">
									<span class="font-mono font-bold text-emerald-500">{inv.invoiceNumber}</span>
									<span class="gh-badge text-[9px] uppercase {inv.status === 'paid' ? 'gh-badge-success' : inv.status === 'sent' ? 'border-blue-500/40 text-blue-500' : ''}">
										{inv.status}
									</span>
								</div>
								<p class="text-[11px] text-[var(--gh-fg-muted)] mt-0.5">
									{inv.customer?.name || 'Customer'} &bull; {inv.issueDate}
								</p>
							</div>

							<div class="text-right font-mono">
								<span class="font-bold text-[var(--gh-fg-default)]">
									${inv.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
								</span>
								{#if inv.acresTreated}
									<span class="block text-[10px] text-[var(--gh-fg-muted)]">
										{inv.acresTreated} acres
									</span>
								{/if}
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</div>

		<!-- Right: Quick Navigation & Status Counts (1 col) -->
		<div class="gh-card p-4 space-y-3">
			<div class="pb-2 border-b gh-border-muted">
				<h3 class="text-xs font-bold uppercase tracking-wider text-[var(--gh-fg-default)]">
					Invoice Status Breakdown
				</h3>
			</div>

			<div class="space-y-2 text-xs">
				<div class="p-3 rounded gh-card-inset border gh-border-muted flex items-center justify-between">
					<div class="flex items-center gap-2">
						<CheckCircle2 class="w-4 h-4 text-emerald-500" />
						<span class="font-medium text-[var(--gh-fg-default)]">Paid</span>
					</div>
					<span class="font-bold font-mono text-[var(--gh-fg-default)]">{paidCount}</span>
				</div>

				<div class="p-3 rounded gh-card-inset border gh-border-muted flex items-center justify-between">
					<div class="flex items-center gap-2">
						<Clock class="w-4 h-4 text-blue-500" />
						<span class="font-medium text-[var(--gh-fg-default)]">Sent / Awaiting Payment</span>
					</div>
					<span class="font-bold font-mono text-[var(--gh-fg-default)]">
						{invoices.filter((i) => i.status === 'sent').length}
					</span>
				</div>

				<div class="p-3 rounded gh-card-inset border gh-border-muted flex items-center justify-between">
					<div class="flex items-center gap-2">
						<FileText class="w-4 h-4 text-[var(--gh-fg-muted)]" />
						<span class="font-medium text-[var(--gh-fg-default)]">Draft</span>
					</div>
					<span class="font-bold font-mono text-[var(--gh-fg-default)]">
						{invoices.filter((i) => i.status === 'draft').length}
					</span>
				</div>
			</div>

			<div class="pt-2 border-t gh-border-muted space-y-1.5">
				<button
					type="button"
					onclick={() => onNavigate('customers')}
					class="w-full gh-btn text-xs justify-between"
				>
					<span>Open Customer Directory</span>
					<ArrowRight class="w-3 h-3 text-[var(--gh-fg-subtle)]" />
				</button>
				<button
					type="button"
					onclick={() => onNavigate('inventory')}
					class="w-full gh-btn text-xs justify-between"
				>
					<span>Open Inventory</span>
					<ArrowRight class="w-3 h-3 text-[var(--gh-fg-subtle)]" />
				</button>
			</div>
		</div>
	</div>
</div>
