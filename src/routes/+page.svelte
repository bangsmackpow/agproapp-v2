<script lang="ts">
	import { auth } from '$lib/stores/auth.svelte';
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
	import StaffManagementView from '$lib/components/StaffManagementView.svelte';
	import AuditLogsView from '$lib/components/AuditLogsView.svelte';
	import ProductModal from '$lib/components/ProductModal.svelte';
	import LoginView from '$lib/components/LoginView.svelte';
	import { Plane } from 'lucide-svelte';

	let activeTab = $state<string>('dashboard');
	let mobileNavOpen = $state<boolean>(false);
	let isComposingInvoice = $state<boolean>(false);
	let showProductModal = $state<boolean>(false);

	function switchTab(tab: string) {
		activeTab = tab;
		isComposingInvoice = false;
	}
</script>

{#if auth.isLoading}
	<!-- Initial Session Verification Loading Screen -->
	<div class="min-h-screen flex flex-col items-center justify-center bg-[var(--gh-bg)] text-[var(--gh-fg-default)]">
		<div class="flex flex-col items-center gap-4">
			<div class="w-12 h-12 rounded-xl bg-emerald-600 flex items-center justify-center text-white shadow-lg animate-pulse">
				<Plane class="w-6 h-6" />
			</div>
			<div class="flex items-center gap-2 text-xs font-semibold text-[var(--gh-fg-muted)]">
				<div class="w-3.5 h-3.5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
				<span>Loading AgPro Solutions...</span>
			</div>
		</div>
	</div>
{:else if !auth.isAuthenticated}
	<!-- Gated Login Screen -->
	<LoginView />
{:else}
	<!-- Authenticated Application Workspace -->
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
			{:else if activeTab === 'staff'}
				<StaffManagementView />
			{:else if activeTab === 'audit-logs'}
				<AuditLogsView />
			{/if}
		</main>

		<!-- Footer -->
		<footer class="border-t gh-border-muted bg-[var(--gh-canvas-subtle)] text-[11px] text-[var(--gh-fg-muted)] py-4 mt-8">
			<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2">
				<div class="flex flex-wrap items-center gap-2">
					<span class="font-bold text-[var(--gh-fg-default)]">AgPro Solutions</span>
					<span>&bull;</span>
					<span>1200 E Howard St, Creston, IA 50801</span>
					<span>&bull;</span>
					<span>(641) 745-7392</span>
				</div>
				<div class="flex items-center gap-3 text-[10px] text-[var(--gh-fg-subtle)]">
					<span>"Putting The Farmer Back In Control!"</span>
					<span>&bull;</span>
					<a href="https://agprosolu.com" target="_blank" rel="noopener noreferrer" class="hover:underline text-[var(--gh-fg-muted)]">
						agprosolu.com
					</a>
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
{/if}
