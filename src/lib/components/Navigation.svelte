<script lang="ts">
	import { auth } from '$lib/stores/auth.svelte';
	import {
		LayoutDashboard,
		FileText,
		Package,
		UploadCloud,
		Users,
		ShieldCheck,
		CreditCard,
		ScrollText,
		Lock,
		X
	} from 'lucide-svelte';

	let { activeTab, onSelectTab, mobileOpen, onCloseMobile } = $props<{
		activeTab: string;
		onSelectTab: (tab: string) => void;
		mobileOpen?: boolean;
		onCloseMobile?: () => void;
	}>();

	interface NavItem {
		id: string;
		label: string;
		icon: any;
		requiredRole?: 'manager' | 'admin';
		badge?: string;
	}

	const navItems: NavItem[] = [
		{ id: 'dashboard', label: 'Overview', icon: LayoutDashboard },
		{ id: 'invoices', label: 'Invoicing & Sales', icon: FileText },
		{ id: 'inventory', label: 'Inventory', icon: Package },
		{ id: 'ingestion', label: 'Auto-Import & BOL', icon: UploadCloud, requiredRole: 'manager' },
		{ id: 'customers', label: 'CRM & Accounts', icon: Users },
		{ id: 'compliance', label: 'Iowa Seed Audits', icon: ShieldCheck, badge: 'IDALS' },
		{ id: 'checks', label: 'Checkwriting', icon: CreditCard, requiredRole: 'admin', badge: 'Admin' },
		{ id: 'audit-logs', label: 'Security Logs', icon: ScrollText, requiredRole: 'admin' }
	];

	function isItemLocked(item: NavItem): boolean {
		if (item.requiredRole === 'admin') return !auth.isAdmin;
		if (item.requiredRole === 'manager') return !auth.canManageInventory;
		return false;
	}
</script>

<!-- Desktop Sub-Navigation (GitHub-Style Horizontal Tabs) -->
<nav class="gh-border-muted border-b bg-[var(--gh-canvas-subtle)] hidden md:block">
	<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center gap-1 overflow-x-auto no-scrollbar">
		{#each navItems as item}
			{@const locked = isItemLocked(item)}
			{@const active = activeTab === item.id}
			{@const Icon = item.icon}

			<button
				type="button"
				onclick={() => {
					if (!locked) onSelectTab(item.id);
				}}
				class="group flex items-center gap-2 px-3 py-2.5 text-xs font-medium border-b-2 transition-colors whitespace-nowrap {active
					? 'border-emerald-500 text-[var(--gh-fg-default)] font-semibold'
					: 'border-transparent text-[var(--gh-fg-muted)] hover:text-[var(--gh-fg-default)] hover:border-[var(--gh-border-default)]'} {locked
					? 'opacity-40 cursor-not-allowed'
					: 'cursor-pointer'}"
				title={locked ? `Restricted to ${item.requiredRole?.toUpperCase()}` : item.label}
			>
				<Icon class="w-4 h-4 {active ? 'text-emerald-500' : 'text-[var(--gh-fg-subtle)] group-hover:text-[var(--gh-fg-default)]'}" />
				<span>{item.label}</span>

				{#if item.badge}
					<span class="gh-badge text-[9px] px-1.5 py-0 uppercase {item.badge === 'Admin' ? 'border-amber-500/40 text-amber-500' : 'border-emerald-500/40 text-emerald-500'}">
						{item.badge}
					</span>
				{/if}

				{#if locked}
					<Lock class="w-3 h-3 text-[var(--gh-fg-subtle)]" />
				{/if}
			</button>
		{/each}
	</div>
</nav>

<!-- Mobile Navigation Drawer -->
{#if mobileOpen}
	<div
		role="presentation"
		class="fixed inset-0 bg-black/60 z-50 md:hidden backdrop-blur-xs"
		onclick={onCloseMobile}
		onkeydown={(e) => e.key === 'Escape' && onCloseMobile?.()}
	></div>
	<div class="fixed inset-y-0 left-0 w-72 gh-card z-50 md:hidden flex flex-col shadow-2xl">
		<div class="p-4 border-b gh-border-muted flex items-center justify-between">
			<div class="flex items-center gap-2">
				<div class="w-6 h-6 rounded bg-emerald-600 flex items-center justify-center text-white text-xs font-bold">
					IA
				</div>
				<span class="font-bold text-sm text-[var(--gh-fg-default)]">AgPro Navigation</span>
			</div>
			<button
				type="button"
				onclick={onCloseMobile}
				class="p-1 rounded-md text-[var(--gh-fg-muted)] hover:bg-[var(--gh-canvas-inset)]"
			>
				<X class="w-5 h-5" />
			</button>
		</div>

		<div class="flex-1 overflow-y-auto p-3 space-y-1">
			{#each navItems as item}
				{@const locked = isItemLocked(item)}
				{@const active = activeTab === item.id}
				{@const Icon = item.icon}

				<button
					type="button"
					onclick={() => {
						if (!locked) {
							onSelectTab(item.id);
							onCloseMobile?.();
						}
					}}
					class="w-full flex items-center justify-between px-3 py-2.5 rounded-md text-xs font-medium transition-colors {active
						? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold'
						: 'text-[var(--gh-fg-muted)] hover:bg-[var(--gh-canvas-inset)] hover:text-[var(--gh-fg-default)]'} {locked
						? 'opacity-40 cursor-not-allowed'
						: 'cursor-pointer'}"
				>
					<div class="flex items-center gap-2.5">
						<Icon class="w-4 h-4 {active ? 'text-emerald-500' : 'text-[var(--gh-fg-subtle)]'}" />
						<span>{item.label}</span>
					</div>

					<div class="flex items-center gap-1.5">
						{#if item.badge}
							<span class="gh-badge text-[9px] px-1.5 py-0 uppercase">{item.badge}</span>
						{/if}
						{#if locked}
							<Lock class="w-3 h-3 text-[var(--gh-fg-subtle)]" />
						{/if}
					</div>
				</button>
			{/each}
		</div>

		<div class="p-3 border-t gh-border-muted bg-[var(--gh-canvas-inset)] text-[11px] text-[var(--gh-fg-muted)]">
			<p class="font-medium text-[var(--gh-fg-default)]">Active Role: {auth.role.toUpperCase()}</p>
			<p class="truncate">{auth.user?.email || ''}</p>
		</div>
	</div>
{/if}
