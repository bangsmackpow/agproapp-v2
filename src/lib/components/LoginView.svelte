<script lang="ts">
	import { auth } from '$lib/stores/auth.svelte';
	import { Plane, Lock, Mail, AlertCircle, Eye, EyeOff, ShieldCheck, CheckCircle2 } from 'lucide-svelte';

	let email = $state('admin@agpro.iowa');
	let password = $state('');
	let showPassword = $state(false);
	let errorMessage = $state<string | null>(null);
	let isSubmitting = $state(false);

	async function handleSubmit(e: Event) {
		e.preventDefault();
		if (!email.trim() || !password) {
			errorMessage = 'Please enter both email and password.';
			return;
		}

		errorMessage = null;
		isSubmitting = true;

		const result = await auth.login(email.trim(), password);
		isSubmitting = false;

		if (!result.success) {
			errorMessage = result.error || 'Invalid credentials. Please verify your email and password.';
		}
	}

	function fillCredentials(fillEmail: string, fillPass: string) {
		email = fillEmail;
		password = fillPass;
		errorMessage = null;
	}
</script>

<div class="min-h-screen flex flex-col justify-center items-center py-12 px-4 sm:px-6 lg:px-8 bg-[var(--gh-bg)] text-[var(--gh-fg-default)]">
	<div class="w-full max-w-md space-y-6">
		<!-- Brand & Header -->
		<div class="text-center space-y-2">
			<div class="inline-flex p-3 rounded-xl bg-emerald-600 text-white shadow-lg shadow-emerald-900/20 ring-1 ring-emerald-500/30">
				<Plane class="w-8 h-8" />
			</div>
			<h1 class="text-2xl font-bold tracking-tight text-[var(--gh-fg-default)]">
				AgPro Management Systems
			</h1>
			<p class="text-xs text-[var(--gh-fg-muted)]">
				Iowa Precision Agronomy, Seed Sales & Drone Fleet Operations
			</p>
			<div class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-mono bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
				<ShieldCheck class="w-3 h-3" />
				<span>IDALS State of Iowa Certified Edge Portal</span>
			</div>
		</div>

		<!-- Login Card -->
		<div class="gh-card p-6 sm:p-8 shadow-xl">
			{#if errorMessage}
				<div class="mb-4 p-3 rounded-md bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs flex items-start gap-2 animate-in fade-in">
					<AlertCircle class="w-4 h-4 shrink-0 mt-0.5" />
					<span>{errorMessage}</span>
				</div>
			{/if}

			<form onsubmit={handleSubmit} class="space-y-4">
				<!-- Email Field -->
				<div>
					<label for="email" class="block text-xs font-semibold text-[var(--gh-fg-default)] mb-1">
						Work Email Address
					</label>
					<div class="relative">
						<div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[var(--gh-fg-subtle)]">
							<Mail class="w-4 h-4" />
						</div>
						<input
							id="email"
							type="email"
							autocomplete="email"
							required
							bind:value={email}
							placeholder="admin@agpro.iowa"
							class="gh-input pl-9 w-full text-xs font-mono"
						/>
					</div>
				</div>

				<!-- Password Field -->
				<div>
					<div class="flex items-center justify-between mb-1">
						<label for="password" class="block text-xs font-semibold text-[var(--gh-fg-default)]">
							Password
						</label>
					</div>
					<div class="relative">
						<div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[var(--gh-fg-subtle)]">
							<Lock class="w-4 h-4" />
						</div>
						<input
							id="password"
							type={showPassword ? 'text' : 'password'}
							autocomplete="current-password"
							required
							bind:value={password}
							placeholder="••••••••••••"
							class="gh-input pl-9 pr-10 w-full text-xs"
						/>
						<button
							type="button"
							onclick={() => (showPassword = !showPassword)}
							class="absolute inset-y-0 right-0 pr-3 flex items-center text-[var(--gh-fg-subtle)] hover:text-[var(--gh-fg-default)]"
							aria-label={showPassword ? 'Hide password' : 'Show password'}
						>
							{#if showPassword}
								<EyeOff class="w-4 h-4" />
							{:else}
								<Eye class="w-4 h-4" />
							{/if}
						</button>
					</div>
				</div>

				<!-- Submit Button -->
				<button
					type="submit"
					disabled={isSubmitting}
					class="gh-btn-primary w-full py-2 flex items-center justify-center gap-2 text-xs font-semibold shadow-sm mt-2 disabled:opacity-50"
				>
					{#if isSubmitting}
						<div class="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
						<span>Authenticating Session...</span>
					{:else}
						<Lock class="w-3.5 h-3.5" />
						<span>Sign In to AgPro</span>
					{/if}
				</button>
			</form>

			<!-- Quick-Fill Team Credentials for testing/onboarding -->
			<div class="mt-6 pt-5 border-t gh-border-muted">
				<p class="text-[11px] font-semibold text-[var(--gh-fg-muted)] mb-2 text-center">
					Authorized System Personas (One-Click Credentials):
				</p>
				<div class="grid grid-cols-1 sm:grid-cols-3 gap-2">
					<button
						type="button"
						onclick={() => fillCredentials('admin@agpro.iowa', 'AgPro2026!Admin')}
						class="p-2 rounded-md border gh-border-muted bg-[var(--gh-canvas-subtle)] hover:bg-[var(--gh-canvas-inset)] text-left transition-colors"
					>
						<div class="flex items-center justify-between">
							<span class="text-[11px] font-bold text-[var(--gh-fg-default)]">Curtis Vance</span>
							<span class="gh-badge gh-badge-danger text-[9px] uppercase">Admin</span>
						</div>
						<div class="text-[10px] text-[var(--gh-fg-muted)] truncate">admin@agpro.iowa</div>
					</button>

					<button
						type="button"
						onclick={() => fillCredentials('manager@agpro.iowa', 'AgPro2026!Mgr')}
						class="p-2 rounded-md border gh-border-muted bg-[var(--gh-canvas-subtle)] hover:bg-[var(--gh-canvas-inset)] text-left transition-colors"
					>
						<div class="flex items-center justify-between">
							<span class="text-[11px] font-bold text-[var(--gh-fg-default)]">Sarah L.</span>
							<span class="gh-badge gh-badge-attention text-[9px] uppercase">Manager</span>
						</div>
						<div class="text-[10px] text-[var(--gh-fg-muted)] truncate">manager@agpro.iowa</div>
					</button>

					<button
						type="button"
						onclick={() => fillCredentials('sales@agpro.iowa', 'AgPro2026!Sales')}
						class="p-2 rounded-md border gh-border-muted bg-[var(--gh-canvas-subtle)] hover:bg-[var(--gh-canvas-inset)] text-left transition-colors"
					>
						<div class="flex items-center justify-between">
							<span class="text-[11px] font-bold text-[var(--gh-fg-default)]">Jake Miller</span>
							<span class="gh-badge gh-badge-success text-[9px] uppercase">Sales</span>
						</div>
						<div class="text-[10px] text-[var(--gh-fg-muted)] truncate">sales@agpro.iowa</div>
					</button>
				</div>
			</div>
		</div>

		<!-- Footer Info -->
		<div class="text-center text-[11px] text-[var(--gh-fg-subtle)] space-y-1">
			<p>Protected by Cloudflare Edge Security & D1 SQL Encryption</p>
			<p class="font-mono text-[10px]">Session Tokens: PBKDF2-SHA256 • HttpOnly Lax</p>
		</div>
	</div>
</div>
