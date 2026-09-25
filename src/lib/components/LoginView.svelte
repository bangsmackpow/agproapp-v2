<script lang="ts">
	import { auth } from '$lib/stores/auth.svelte';
	import { Plane, Lock, Mail, AlertCircle, Eye, EyeOff } from 'lucide-svelte';

	let email = $state('');
	let password = $state('');
	let showPassword = $state(false);
	let errorMessage = $state<string | null>(null);
	let isSubmitting = $state(false);

	async function handleSubmit(e: Event) {
		e.preventDefault();
		if (!email.trim() || !password) {
			errorMessage = 'Please enter both your email and password.';
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
</script>

<div class="min-h-screen flex flex-col justify-center items-center py-12 px-4 sm:px-6 lg:px-8 bg-[var(--gh-bg)] text-[var(--gh-fg-default)]">
	<div class="w-full max-w-sm space-y-6">
		<!-- Brand & Header -->
		<div class="text-center space-y-2">
			<div class="inline-flex p-3 rounded-xl bg-emerald-600 text-white shadow-md">
				<Plane class="w-7 h-7" />
			</div>
			<div class="space-y-0.5">
				<h1 class="text-xl font-bold tracking-tight text-[var(--gh-fg-default)]">
					AgPro Solutions
				</h1>
				<p class="text-xs font-medium text-[var(--gh-fg-muted)]">
					Creston, Iowa
				</p>
			</div>
			<p class="text-xs italic text-[var(--gh-fg-subtle)]">
				"Putting The Farmer Back In Control!"
			</p>
		</div>

		<!-- Login Card -->
		<div class="gh-card p-6 shadow-md border gh-border-muted">
			{#if errorMessage}
				<div class="mb-4 p-3 rounded-md bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs flex items-start gap-2">
					<AlertCircle class="w-4 h-4 shrink-0 mt-0.5" />
					<span>{errorMessage}</span>
				</div>
			{/if}

			<form onsubmit={handleSubmit} class="space-y-4">
				<!-- Email Field -->
				<div>
					<label for="email" class="block text-xs font-semibold text-[var(--gh-fg-default)] mb-1">
						Work Email
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
							placeholder="name@agpro.iowa"
							class="gh-input pl-9 w-full text-xs"
						/>
					</div>
				</div>

				<!-- Password Field -->
				<div>
					<label for="password" class="block text-xs font-semibold text-[var(--gh-fg-default)] mb-1">
						Password
					</label>
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
					class="gh-btn-primary w-full py-2 flex items-center justify-center gap-2 text-xs font-semibold shadow-sm mt-3 disabled:opacity-50"
				>
					{#if isSubmitting}
						<div class="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
						<span>Signing In...</span>
					{:else}
						<Lock class="w-3.5 h-3.5" />
						<span>Sign In</span>
					{/if}
				</button>
			</form>
		</div>

		<!-- Clean Footer Contact Info -->
		<div class="text-center text-[11px] text-[var(--gh-fg-subtle)] space-y-1">
			<p class="font-medium">1200 E Howard St, Creston, IA 50801 &bull; (641) 745-7392</p>
			<p>
				<a href="https://agprosolu.com" target="_blank" rel="noopener noreferrer" class="hover:underline text-[var(--gh-fg-muted)]">
					agprosolu.com
				</a>
			</p>
		</div>
	</div>
</div>
