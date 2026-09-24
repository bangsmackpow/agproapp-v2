<script lang="ts">
	import { apiFetch } from '$lib/api/client';
	import { auth } from '$lib/stores/auth.svelte';
	import {
		DollarSign,
		Plane,
		ShieldCheck,
		Package,
		FileText,
		UploadCloud,
		Users,
		ArrowRight,
		Clock,
		AlertCircle
	} from 'lucide-svelte';

	let { onNavigate } = $props<{ onNavigate: (tab: string) => void }>();

	let invoices = $state<any[]>([]);
	let products = $state<any[]>([]);
	let complianceCount = $state<number>(0);
	let loading = $state(false);

	$effect(() => {
		loadStats();
	});

	async function loadStats() {
		loading = true;
		const [invRes, prodRes, compRes] = await Promise.all([
			apiFetch<{ invoices: any[] }>('/invoices'),
			apiFetch<{ products: any[] }>('/inventory'),
			apiFetch<{ logs: any[] }>('/compliance')
		]);

		if (invRes.data) invoices = invRes.data.invoices || [];
		if (prodRes.data) products = prodRes.data.products || [];
		if (compRes.data) complianceCount = compRes.data.logs?.length || 0;
		loading = false;
	}

	let totalRevenue = $derived(
		invoices.reduce((sum, inv) => sum + (inv.status !== 'canceled' ? inv.totalAmount : 0), 0)
	);

	let totalAcres = $derived(
		invoices.reduce((sum, inv) => sum + (inv.acresTreated || 0), 0)
	);

	let inventoryValuation = $derived(
		products.reduce((sum, prod) => sum + prod.costBasis * prod.currentStock, 0)
	);
</script>

<div class="space-y-6">
	<!-- Hero Welcome -->
	<div class="gh-card p-6 border-l-4 border-l-emerald-500 flex flex-col md:flex-row md:items-center justify-between gap-4">
		<div>
			<div class="flex items-center gap-2">
				<span class="gh-badge gh-badge-success text-[10px] uppercase font-mono">
					State of Iowa Ag System
				</span>
				<span class="text-xs text-[var(--gh-fg-muted)]">Story, Hamilton, Boone & Surrounding Counties</span>
			</div>
			<h2 class="text-xl font-bold text-[var(--gh-fg-default)] mt-1">
				Precision Drone Fertilization, Seed & Ag Operations
			</h2>
			<p class="text-xs text-[var(--gh-fg-muted)] mt-1 max-w-2xl">
				Logged in as <span class="font-semibold text-[var(--gh-fg-default)]">{auth.user.name}</span> (<span class="uppercase font-mono text-emerald-500 font-bold">{auth.role}</span>).
				Unified cross-platform operations supporting field sales representatives on mobile tablets and office managers on desktop.
			</p>
		</div>

		<!-- Action Quick Links -->
		<div class="flex flex-wrap items-center gap-2">
			<button
				type="button"
				onclick={() => onNavigate('invoices')}
				class="gh-btn-primary text-xs font-semibold"
			>
				<FileText class="w-3.5 h-3.5" />
				New Invoice
			</button>
			{#if auth.canManageInventory}
				<button
					type="button"
					onclick={() => onNavigate('ingestion')}
					class="gh-btn text-xs font-semibold"
				>
					<UploadCloud class="w-3.5 h-3.5 text-emerald-500" />
					Ingest BOL
				</button>
			{/if}
		</div>
	</div>

	<!-- High-Level Metric Tiles (GitHub Card Aesthetic) -->
	<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
		<!-- Tile 1: Revenue -->
		<div class="gh-card p-4 space-y-2">
			<div class="flex items-center justify-between text-[var(--gh-fg-muted)]">
				<span class="text-xs font-bold uppercase tracking-wider">Gross Sales Volume</span>
				<DollarSign class="w-4 h-4 text-emerald-500" />
			</div>
			<div class="flex items-baseline gap-2">
				<span class="text-2xl font-bold font-mono text-[var(--gh-fg-default)]">
					${totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
				</span>
			</div>
			<span class="text-[11px] text-[var(--gh-fg-muted)] block">
				{invoices.length} issued sales transactions
			</span>
		</div>

		<!-- Tile 2: Drone Acres -->
		<div class="gh-card p-4 space-y-2">
			<div class="flex items-center justify-between text-[var(--gh-fg-muted)]">
				<span class="text-xs font-bold uppercase tracking-wider">Drone Coverage</span>
				<Plane class="w-4 h-4 text-blue-500" />
			</div>
			<div class="flex items-baseline gap-2">
				<span class="text-2xl font-bold font-mono text-[var(--gh-fg-default)]">
					{totalAcres.toLocaleString()} <span class="text-sm font-sans font-normal text-[var(--gh-fg-muted)]">acres</span>
				</span>
			</div>
			<span class="text-[11px] text-[var(--gh-fg-muted)] block">
				DJI Agras T50 precision applications
			</span>
		</div>

		<!-- Tile 3: Regulated Seed Audits -->
		<div class="gh-card p-4 space-y-2">
			<div class="flex items-center justify-between text-[var(--gh-fg-muted)]">
				<span class="text-xs font-bold uppercase tracking-wider">Iowa Seed Audits</span>
				<ShieldCheck class="w-4 h-4 text-emerald-500" />
			</div>
			<div class="flex items-baseline gap-2">
				<span class="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
					{complianceCount}
				</span>
				<span class="text-xs text-[var(--gh-fg-muted)]">Tokens Verified</span>
			</div>
			<span class="text-[11px] text-[var(--gh-fg-muted)] block">
				100% IDALS Straight BOL audit compliance
			</span>
		</div>

		<!-- Tile 4: Inventory Valuation -->
		<div class="gh-card p-4 space-y-2">
			<div class="flex items-center justify-between text-[var(--gh-fg-muted)]">
				<span class="text-xs font-bold uppercase tracking-wider">Stock Valuation</span>
				<Package class="w-4 h-4 text-amber-500" />
			</div>
			<div class="flex items-baseline gap-2">
				<span class="text-2xl font-bold font-mono text-[var(--gh-fg-default)]">
					${inventoryValuation.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
				</span>
			</div>
			<span class="text-[11px] text-[var(--gh-fg-muted)] block">
				Across {products.length} distinct SKUs & categories
			</span>
		</div>
	</div>

	<!-- Recent Invoices & Quick Dispatch Feed -->
	<div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
		<!-- Left: Recent Invoices -->
		<div class="gh-card p-4 space-y-3">
			<div class="flex items-center justify-between pb-2 border-b gh-border-muted">
				<h3 class="text-xs font-bold uppercase tracking-wider text-[var(--gh-fg-default)] flex items-center gap-1.5">
					<FileText class="w-4 h-4 text-emerald-500" />
					Recent Invoices & State Machine
				</h3>
				<button
					type="button"
					onclick={() => onNavigate('invoices')}
					class="text-xs text-emerald-500 hover:underline flex items-center gap-1"
				>
					View all <ArrowRight class="w-3 h-3" />
				</button>
			</div>

			<div class="divide-y gh-border-muted text-xs">
				{#each invoices.slice(0, 5) as inv}
					<div class="py-2.5 flex items-center justify-between gap-3">
						<div>
							<div class="flex items-center gap-2">
								<span class="font-mono font-bold text-emerald-500">{inv.invoiceNumber}</span>
								<span class="gh-badge text-[9px] uppercase">{inv.status}</span>
							</div>
							<p class="text-[11px] text-[var(--gh-fg-muted)] mt-0.5">
								{inv.customer?.name} &bull; {inv.issueDate}
							</p>
						</div>

						<div class="text-right font-mono">
							<span class="font-bold text-[var(--gh-fg-default)]">
								${inv.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
							</span>
							<span class="block text-[10px] text-emerald-500">
								+${inv.grossMarginAmount?.toFixed(0)} margin
							</span>
						</div>
					</div>
				{/each}
			</div>
		</div>

		<!-- Right: Quick Partner Ingestion Overview -->
		<div class="gh-card p-4 space-y-3">
			<div class="flex items-center justify-between pb-2 border-b gh-border-muted">
				<h3 class="text-xs font-bold uppercase tracking-wider text-[var(--gh-fg-default)] flex items-center gap-1.5">
					<UploadCloud class="w-4 h-4 text-blue-500" />
					Key Vendor Integrations & Parsers
				</h3>
				{#if auth.canManageInventory}
					<button
						type="button"
						onclick={() => onNavigate('ingestion')}
						class="text-xs text-emerald-500 hover:underline flex items-center gap-1"
					>
						Open Ingestion Engine <ArrowRight class="w-3 h-3" />
					</button>
				{/if}
			</div>

			<div class="space-y-2 text-xs">
				<div class="p-2.5 rounded gh-card-inset border gh-border-muted flex items-start justify-between gap-2">
					<div>
						<p class="font-bold text-[var(--gh-fg-default)]">Channel Straight BOL Manifests</p>
						<p class="text-[11px] text-[var(--gh-fg-muted)]">
							Isolates BOL/CMR # and Order # for Iowa seed regulatory compliance.
						</p>
					</div>
					<span class="gh-badge gh-badge-success text-[10px]">IDALS Certified</span>
				</div>

				<div class="p-2.5 rounded gh-card-inset border gh-border-muted flex items-start justify-between gap-2">
					<div>
						<p class="font-bold text-[var(--gh-fg-default)]">Wickman Chemical</p>
						<p class="text-[11px] text-[var(--gh-fg-muted)]">
							Ventas, Tenkoz 4L, Xsate 53.8%, pre & post corn/soybean herbicide rates.
						</p>
					</div>
					<span class="gh-badge text-[10px]">Active</span>
				</div>

				<div class="p-2.5 rounded gh-card-inset border gh-border-muted flex items-start justify-between gap-2">
					<div>
						<p class="font-bold text-[var(--gh-fg-default)]">Atticus LLC</p>
						<p class="text-[11px] text-[var(--gh-fg-muted)]">
							Post-patent chemistry, EPA registration numbers & active ingredients.
						</p>
					</div>
					<span class="gh-badge text-[10px]">Active</span>
				</div>

				<div class="p-2.5 rounded gh-card-inset border gh-border-muted flex items-start justify-between gap-2">
					<div>
						<p class="font-bold text-[var(--gh-fg-default)]">I & B Ag Supply</p>
						<p class="text-[11px] text-[var(--gh-fg-muted)]">
							Banjo pumps, dry AMS water conditioners, DJI T50 atomizing nozzles.
						</p>
					</div>
					<span class="gh-badge text-[10px]">Active</span>
				</div>
			</div>
		</div>
	</div>
</div>
