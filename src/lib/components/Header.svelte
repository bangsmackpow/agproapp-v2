<script lang="ts">
	import { theme, type ThemeMode } from '$lib/stores/theme.svelte';
	import { auth, PRESET_PERSONAS } from '$lib/stores/auth.svelte';
	import type { UserRole } from '$lib/db/schema';
	import { Sun, Moon, Monitor, Shield, User, ChevronDown, Check, Menu, X, Plane, Sprout } from 'lucide-svelte';

	let { onToggleMobileNav } = $props<{ onToggleMobileNav?: () => void }>();

	let personaMenuOpen = $state(false);
	let themeMenuOpen = $state(false);

	function switchRole(role: UserRole) {
		auth.setRole(role);
		personaMenuOpen = false;
	}

	function switchTheme(mode: ThemeMode) {
		theme.setTheme(mode);
		themeMenuOpen = false;
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

			<a href="/" class="flex items-center gap-2 text-inherit font-semibold text-sm sm:text-base tracking-tight hover:opacity-90">
				<div class="w-8 h-8 rounded-md bg-emerald-600 flex items-center justify-center text-white shadow-sm font-bold">
					<Plane class="w-4 h-4" />
				</div>
				<div class="flex flex-col">
					<span class="font-bold flex items-center gap-1.5 text-[var(--gh-fg-default)]">
						AgPro
						<span class="text-xs px-1.5 py-0.2 rounded font-mono bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-semibold border border-emerald-500/20">
							Iowa
						</span>
					</span>
					<span class="text-[10px] text-[var(--gh-fg-muted)] leading-none hidden sm:inline">
						Precision Drone & Seed Management
					</span>
				</div>
			</a>
		</div>

		<!-- Right: Persona Switcher & Theme Selector -->
		<div class="flex items-center gap-2 sm:gap-3">
			<!-- Persona Switcher Dropdown (Crucial for Multi-User RBAC evaluation) -->
			<div class="relative">
				<button
					type="button"
					onclick={() => { personaMenuOpen = !personaMenuOpen; themeMenuOpen = false; }}
					class="gh-btn text-xs py-1 px-2.5 flex items-center gap-1.5"
					aria-expanded={personaMenuOpen}
				>
					<User class="w-3.5 h-3.5 text-[var(--gh-fg-muted)]" />
					<div class="flex items-center gap-1.5 text-left">
						<span class="font-semibold hidden sm:inline">{auth.user.name}</span>
						<span class={`gh-badge ${roleColors[auth.role]} text-[10px] uppercase tracking-wider`}>
							{auth.role}
						</span>
					</div>
					<ChevronDown class="w-3 h-3 text-[var(--gh-fg-subtle)]" />
				</button>

				{#if personaMenuOpen}
					<!-- Backdrop to close -->
					<div
						role="presentation"
						class="fixed inset-0 z-40"
						onclick={() => (personaMenuOpen = false)}
						onkeydown={(e) => e.key === 'Escape' && (personaMenuOpen = false)}
					></div>
					<div class="absolute right-0 mt-1 w-64 gh-card shadow-xl z-50 py-1 text-xs">
						<div class="px-3 py-2 border-b gh-border-muted bg-[var(--gh-canvas-inset)]">
							<p class="font-semibold text-[var(--gh-fg-default)]">Active RBAC Persona</p>
							<p class="text-[11px] text-[var(--gh-fg-muted)]">Switch roles to test permissions matrix:</p>
						</div>

						{#each (Object.keys(PRESET_PERSONAS) as UserRole[]) as r}
							{@const persona = PRESET_PERSONAS[r]}
							<button
								type="button"
								onclick={() => switchRole(r)}
								class="w-full text-left px-3 py-2.5 flex items-start gap-2.5 hover:bg-[var(--gh-canvas-inset)] transition-colors {auth.role === r ? 'bg-[var(--gh-canvas-inset)]' : ''}"
							>
								<div class="mt-0.5">
									{#if auth.role === r}
										<Check class="w-3.5 h-3.5 text-emerald-500" />
									{:else}
										<div class="w-3.5 h-3.5"></div>
									{/if}
								</div>
								<div class="flex-1">
									<div class="flex items-center justify-between">
										<span class="font-medium text-[var(--gh-fg-default)]">{persona.name}</span>
										<span class={`gh-badge ${roleColors[r]} text-[9px] uppercase`}>{r}</span>
									</div>
									<p class="text-[11px] text-[var(--gh-fg-muted)]">{persona.title}</p>
									<p class="text-[10px] text-[var(--gh-fg-subtle)] mt-0.5">
										{#if r === 'sales'}
											CRM, Invoices, Read-Only Inventory
										{:else if r === 'manager'}
											CRM, Invoicing, Inventory Edit/Import
										{:else}
											Full System Access & Checkwriting
										{/if}
									</p>
								</div>
							</button>
						{/each}
					</div>
				{/if}
			</div>

			<!-- Theme Switcher (Light / Dark / System) -->
			<div class="relative">
				<button
					type="button"
					onclick={() => { themeMenuOpen = !themeMenuOpen; personaMenuOpen = false; }}
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
