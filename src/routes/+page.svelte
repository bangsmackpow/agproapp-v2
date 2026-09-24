<script lang="ts">
	import Header from '$lib/components/Header.svelte';
	import Navigation from '$lib/components/Navigation.svelte';
	import DashboardOverview from '$lib/components/DashboardOverview.svelte';
	import InvoicesListView from '$lib/components/InvoicesListView.svelte';
	import InvoiceComposer from '$lib/components/InvoiceComposer.svelte';
	import InventoryView from '$lib/components/InventoryView.svelte';
	import IngestionView from '$lib/components/IngestionView.svelte';
	import CustomersView from '$lib/components/CustomersView.svelte';
	import ComplianceView from '$lib/components/ComplianceView.svelte';
	import ChecksView from '$lib/components/ChecksView.svelte';
	import AuditLogsView from '$lib/components/AuditLogsView.svelte';
	import ProductModal from '$lib/components/ProductModal.svelte';

	let activeTab = $state<string>('dashboard');
	let mobileNavOpen = $state<boolean>(false);
	let isComposingInvoice = $state<boolean>(false);
	let showProductModal = $state<boolean>(false);

	function switchTab(tab: string) {
		activeTab = tab;
		isComposingInvoice = false;
	}
</script>

<div class="min-h-screen flex flex-col bg-[var(--gh-bg)] text-[var(--gh-fg-default)]">
	<!-- Top Application Header -->
	<Header onToggleMobileNav={() => (mobileNavOpen = !mobileNavOpen)} />

	<!-- Sub-Navigation Bar (Desktop Tabs & Mobile Drawer) -->
	<Navigation
		{activeTab}
		onSelectTab={switchTab}
		mobileOpen={mobileNavOpen}
		onCloseMobile={() => (mobileNavOpen = false)}
	/>

	<!-- Main Workspace Viewport -->
	<main class="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
		{#if activeTab === 'dashboard'}
			<DashboardOverview onNavigate={switchTab} />
		{:else if activeTab === 'invoices'}
			{#if isComposingInvoice}
				<InvoiceComposer
					onCancel={() => (isComposingInvoice = false)}
					onSaved={() => (isComposingInvoice = false)}
				/>
			{:else}
				<InvoicesListView
					onOpenComposer={() => (isComposingInvoice = true)}
					onSelectInvoice={(inv) => {
						// Open invoice in composer or preview
					}}
				/>
			{/if}
		{:else if activeTab === 'inventory'}
			<InventoryView onOpenNewProduct={() => (showProductModal = true)} />
		{:else if activeTab === 'ingestion'}
			<IngestionView onImportCompleted={() => {}} />
		{:else if activeTab === 'customers'}
			<CustomersView />
		{:else if activeTab === 'compliance'}
			<ComplianceView />
		{:else if activeTab === 'checks'}
			<ChecksView />
		{:else if activeTab === 'audit-logs'}
			<AuditLogsView />
		{/if}
	</main>

	<!-- Footer -->
	<footer class="border-t gh-border-muted bg-[var(--gh-canvas-subtle)] text-[11px] text-[var(--gh-fg-muted)] py-4 mt-8">
		<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2">
			<div class="flex items-center gap-2">
				<span class="font-bold text-[var(--gh-fg-default)]">AgPro Systems</span>
				<span>&bull;</span>
				<span>Iowa Precision Agronomy & Drone Application Operations</span>
			</div>
			<div class="flex items-center gap-4 text-[10px] font-mono text-[var(--gh-fg-subtle)]">
				<span>Cloudflare D1 & Workers</span>
				<span>Hono Gateway</span>
				<span>State of Iowa IDALS Seed Audits</span>
			</div>
		</div>
	</footer>

	<!-- Global Product Creation Modal -->
	{#if showProductModal}
		<ProductModal
			onClose={() => (showProductModal = false)}
			onCreated={() => (showProductModal = false)}
		/>
	{/if}
</div>
