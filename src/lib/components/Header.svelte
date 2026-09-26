<script lang="ts">
	import { theme, type ThemeMode } from '$lib/stores/theme.svelte';
	import { auth } from '$lib/stores/auth.svelte';
	import type { UserRole } from '$lib/db/schema';
	import {
		Sun,
		Moon,
		Monitor,
		Shield,
		User,
		ChevronDown,
		Check,
		Menu,
		Plane,
		LogOut,
		ShieldCheck,
		Lock,
		KeyRound
	} from 'lucide-svelte';
	import ChangePasswordModal from './ChangePasswordModal.svelte';

	let { onToggleMobileNav } = $props<{ onToggleMobileNav?: () => void }>();

	let userMenuOpen = $state(false);
	let themeMenuOpen = $state(false);
	let showPasswordModal = $state(false);

	function switchTheme(mode: ThemeMode) {
		theme.setTheme(mode);
		themeMenuOpen = false;
	}

	async function handleLogout() {
		userMenuOpen = false;
		await auth.logout();
	}

	const roleColors: Record<UserRole, string> = {
		sales: 'gh-badge-success',
		manager: 'gh-badge-attention',
		admin: 'gh-badge-danger'
	};
</script>

<header class="gh-border-muted border-b bg-[var(--gh-canvas-subtle)] sticky top-0 z-40">
	<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between gap-4">
		<!-- Left: Brand & Mobile Toggle -->
		<div class="flex items-center gap-3">
			{#if onToggleMobileNav}
				<button
					type="button"
					onclick={onToggleMobileNav}
					class="md:hidden p-1.5 rounded-md hover:bg-[var(--gh-canvas-inset)] text-[var(--gh-fg-muted)]"
					aria-label="Toggle navigation"
				>
					<Menu class="w-5 h-5" />
				</button>
			{/if}

			<a href="/" class="flex items-center gap-2.5 text-inherit font-semibold text-sm sm:text-base tracking-tight hover:opacity-90">
				<div class="w-8 h-8 rounded-md bg-emerald-600 flex items-center justify-center text-white shadow-sm font-bold">
					<Plane class="w-4 h-4" />
				</div>
				<div class="flex flex-col">
					<span class="font-bold flex items-center gap-1.5 text-[var(--gh-fg-default)]">
						AgPro Solutions
						<span class="text-[10px] px-1.5 py-0.2 rounded font-mono bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold border border-emerald-500/20">
							Creston, IA
						</span>
					</span>
					<span class="text-[10px] text-[var(--gh-fg-muted)] leading-none hidden sm:inline">
						Putting The Farmer Back In Control
					</span>
				</div>
			</a>
		</div>

		<!-- Right: Authenticated User Menu & Theme Selector -->
		<div class="flex items-center gap-2 sm:gap-3">
			<!-- Authenticated User Profile Dropdown -->
			<div class="relative">
				<button
					type="button"
					onclick={() => { userMenuOpen = !userMenuOpen; themeMenuOpen = false; }}
					class="gh-btn text-xs py-1 px-2.5 flex items-center gap-1.5"
					aria-expanded={userMenuOpen}
				>
					<div class="w-5 h-5 rounded-full bg-emerald-600/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-[10px]">
						{auth.user?.name ? auth.user.name.charAt(0).toUpperCase() : 'U'}
					</div>
					<div class="flex items-center gap-1.5 text-left">
						<span class="font-semibold hidden sm:inline">{auth.user?.name || 'Authenticated User'}</span>
						<span class={`gh-badge ${roleColors[auth.role]} text-[10px] uppercase tracking-wider`}>
							{auth.role}
						</span>
					</div>
					<ChevronDown class="w-3 h-3 text-[var(--gh-fg-subtle)]" />
				</button>

				{#if userMenuOpen}
					<!-- Backdrop to close -->
					<div
						role="presentation"
						class="fixed inset-0 z-40"
						onclick={() => (userMenuOpen = false)}
						onkeydown={(e) => e.key === 'Escape' && (userMenuOpen = false)}
					></div>
					<div class="absolute right-0 mt-1 w-72 gh-card shadow-xl z-50 py-1 text-xs animate-in fade-in">
						<!-- User Identity Details -->
						<div class="px-3.5 py-3 border-b gh-border-muted bg-[var(--gh-canvas-inset)]">
							<div class="flex items-center justify-between">
								<p class="font-bold text-[var(--gh-fg-default)]">{auth.user?.name}</p>
								<span class={`gh-badge ${roleColors[auth.role]} text-[9px] uppercase font-mono`}>
									{auth.role}
								</span>
							</div>
							<p class="text-[11px] text-[var(--gh-fg-muted)] font-mono">{auth.user?.email}</p>
							<p class="text-[11px] text-[var(--gh-fg-subtle)] mt-0.5">{auth.user?.title}</p>
						</div>

						<!-- RBAC Security Privileges Summary -->
						<div class="px-3.5 py-2.5 border-b gh-border-muted space-y-1.5 text-[11px]">
							<p class="text-[10px] font-semibold uppercase tracking-wider text-[var(--gh-fg-subtle)]">
								RBAC Authorization Privileges
							</p>
							<div class="flex items-center justify-between text-[11px]">
								<span class="text-[var(--gh-fg-muted)]">CRM & Invoicing:</span>
								<span class="text-emerald-500 font-semibold flex items-center gap-1">
									<Check class="w-3 h-3" /> Full
								</span>
							</div>
							<div class="flex items-center justify-between text-[11px]">
								<span class="text-[var(--gh-fg-muted)]">Inventory Edits & Ingestion:</span>
								{#if auth.canManageInventory}
									<span class="text-emerald-500 font-semibold flex items-center gap-1">
										<Check class="w-3 h-3" /> Full
									</span>
								{:else}
									<span class="text-amber-500 font-semibold">Read Only</span>
								{/if}
							</div>
							<div class="flex items-center justify-between text-[11px]">
								<span class="text-[var(--gh-fg-muted)]">Corporate Checkwriting:</span>
								{#if auth.canWriteChecks}
									<span class="text-emerald-500 font-semibold flex items-center gap-1">
										<Check class="w-3 h-3" /> Authorized
									</span>
								{:else}
									<span class="text-rose-500 font-semibold flex items-center gap-1">
										<Lock class="w-3 h-3" /> Locked (Admin)
									</span>
								{/if}
							</div>
						</div>

						<!-- Account Actions -->
						<div class="p-1.5 space-y-0.5 border-b gh-border-muted">
							<button
								type="button"
								onclick={() => {
									userMenuOpen = false;
									showPasswordModal = true;
								}}
								class="w-full text-left px-2.5 py-1.5 rounded-md flex items-center gap-2 text-[var(--gh-fg-default)] hover:bg-[var(--gh-canvas-inset)] font-medium transition-colors"
							>
								<KeyRound class="w-3.5 h-3.5 text-emerald-500" />
								<span>Change Password</span>
							</button>
						</div>

						<!-- Sign Out Action -->
						<div class="p-1.5">
							<button
								type="button"
								onclick={handleLogout}
								class="w-full text-left px-2.5 py-1.5 rounded-md flex items-center gap-2 text-rose-500 hover:bg-rose-500/10 font-semibold transition-colors"
							>
								<LogOut class="w-3.5 h-3.5" />
								<span>Sign Out of Session</span>
							</button>
						</div>
					</div>
				{/if}
			</div>

			{#if showPasswordModal}
				<ChangePasswordModal onClose={() => (showPasswordModal = false)} />
			{/if}

			<!-- Theme Switcher (Light / Dark / System) -->
			<div class="relative">
				<button
					type="button"
					onclick={() => { themeMenuOpen = !themeMenuOpen; userMenuOpen = false; }}
					class="gh-btn p-1.5 text-[var(--gh-fg-muted)] hover:text-[var(--gh-fg-default)]"
					title="Toggle theme (Light / Dark / System)"
					aria-label="Toggle theme"
				>
					{#if theme.current === 'dark'}
						<Moon class="w-4 h-4" />
					{:else if theme.current === 'light'}
						<Sun class="w-4 h-4" />
					{:else}
						<Monitor class="w-4 h-4" />
					{/if}
				</button>

				{#if themeMenuOpen}
					<div
						role="presentation"
						class="fixed inset-0 z-40"
						onclick={() => (themeMenuOpen = false)}
						onkeydown={(e) => e.key === 'Escape' && (themeMenuOpen = false)}
					></div>
					<div class="absolute right-0 mt-1 w-36 gh-card shadow-xl z-50 py-1 text-xs">
						<button
							type="button"
							onclick={() => switchTheme('light')}
							class="w-full text-left px-3 py-1.5 flex items-center justify-between hover:bg-[var(--gh-canvas-inset)] {theme.current === 'light' ? 'font-semibold text-emerald-500' : 'text-[var(--gh-fg-default)]'}"
						>
							<span class="flex items-center gap-2"><Sun class="w-3.5 h-3.5" /> Light</span>
							{#if theme.current === 'light'}<Check class="w-3 h-3" />{/if}
						</button>
						<button
							type="button"
							onclick={() => switchTheme('dark')}
							class="w-full text-left px-3 py-1.5 flex items-center justify-between hover:bg-[var(--gh-canvas-inset)] {theme.current === 'dark' ? 'font-semibold text-emerald-500' : 'text-[var(--gh-fg-default)]'}"
						>
							<span class="flex items-center gap-2"><Moon class="w-3.5 h-3.5" /> Dark</span>
							{#if theme.current === 'dark'}<Check class="w-3 h-3" />{/if}
						</button>
						<button
							type="button"
							onclick={() => switchTheme('system')}
							class="w-full text-left px-3 py-1.5 flex items-center justify-between hover:bg-[var(--gh-canvas-inset)] {theme.current === 'system' ? 'font-semibold text-emerald-500' : 'text-[var(--gh-fg-default)]'}"
						>
							<span class="flex items-center gap-2"><Monitor class="w-3.5 h-3.5" /> System</span>
							{#if theme.current === 'system'}<Check class="w-3 h-3" />{/if}
						</button>
					</div>
				{/if}
			</div>
		</div>
	</div>
</header>
