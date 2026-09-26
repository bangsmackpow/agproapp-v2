<script lang="ts">
	import { apiFetch } from '$lib/api/client';
	import { KeyRound, X, CheckCircle2, AlertTriangle, RefreshCw, Eye, EyeOff } from 'lucide-svelte';

	let { onClose } = $props<{ onClose: () => void }>();

	let currentPassword = $state('');
	let newPassword = $state('');
	let confirmPassword = $state('');

	let showCurrent = $state(false);
	let showNew = $state(false);

	let loading = $state(false);
	let error = $state<string | null>(null);
	let successMsg = $state<string | null>(null);

	async function handleSubmit() {
		error = null;
		successMsg = null;

		if (!currentPassword) {
			error = 'Please enter your current password.';
			return;
		}

		if (newPassword.length < 8) {
			error = 'New password must be at least 8 characters long.';
			return;
		}

		if (newPassword !== confirmPassword) {
			error = 'New passwords do not match. Please re-type.';
			return;
		}

		loading = true;
		const res = await apiFetch('/auth/change-password', {
			method: 'POST',
			body: JSON.stringify({ currentPassword, newPassword })
		});
		loading = false;

		if (res.error) {
			error = res.error;
		} else {
			successMsg = 'Password updated successfully! You can now use your new password.';
			currentPassword = '';
			newPassword = '';
			confirmPassword = '';
			setTimeout(() => {
				onClose();
			}, 1500);
		}
	}
</script>

<div
	role="presentation"
	class="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs"
	onclick={(e) => {
		if (e.target === e.currentTarget) onClose();
	}}
	onkeydown={(e) => e.key === 'Escape' && onClose()}
>
	<div class="gh-card max-w-md w-full p-6 space-y-4 shadow-2xl animate-in fade-in">
		<div class="flex items-center justify-between pb-3 border-b gh-border-muted">
			<h3 class="font-bold text-sm text-[var(--gh-fg-default)] flex items-center gap-2">
				<KeyRound class="w-4 h-4 text-emerald-500" />
				Rotate Account Password
			</h3>
			<button
				type="button"
				onclick={onClose}
				class="p-1 rounded text-[var(--gh-fg-muted)] hover:bg-[var(--gh-canvas-inset)]"
			>
				<X class="w-4 h-4" />
			</button>
		</div>

		<p class="text-xs text-[var(--gh-fg-muted)] leading-relaxed">
			Update your login credentials. Use a strong passphrase of at least 8 characters.
		</p>

		{#if error}
			<div class="p-2.5 rounded gh-badge-danger border text-xs flex items-center gap-2">
				<AlertTriangle class="w-3.5 h-3.5 shrink-0" />
				<span>{error}</span>
			</div>
		{/if}

		{#if successMsg}
			<div class="p-2.5 rounded gh-badge-success border text-xs flex items-center gap-2">
				<CheckCircle2 class="w-3.5 h-3.5 text-emerald-500 shrink-0" />
				<span>{successMsg}</span>
			</div>
		{/if}

		<form
			onsubmit={(e) => {
				e.preventDefault();
				handleSubmit();
			}}
			class="space-y-3.5 text-xs"
		>
			<div>
				<label for="current-pwd" class="text-[10px] uppercase text-[var(--gh-fg-subtle)] font-semibold block mb-1">
					Current Password *
				</label>
				<div class="relative">
					<input
						id="current-pwd"
						type={showCurrent ? 'text' : 'password'}
						bind:value={currentPassword}
						placeholder="••••••••••••"
						autocomplete="current-password"
						required
						class="w-full p-2 pr-9 rounded border gh-border-default gh-card-inset text-xs font-mono"
					/>
					<button
						type="button"
						onclick={() => (showCurrent = !showCurrent)}
						class="absolute right-2 top-2 text-[var(--gh-fg-subtle)] hover:text-[var(--gh-fg-default)]"
					>
						{#if showCurrent}<EyeOff class="w-4 h-4" />{:else}<Eye class="w-4 h-4" />{/if}
					</button>
				</div>
			</div>

			<div>
				<label for="new-pwd" class="text-[10px] uppercase text-[var(--gh-fg-subtle)] font-semibold block mb-1">
					New Password (min 8 chars) *
				</label>
				<div class="relative">
					<input
						id="new-pwd"
						type={showNew ? 'text' : 'password'}
						bind:value={newPassword}
						placeholder="••••••••••••"
						autocomplete="new-password"
						required
						class="w-full p-2 pr-9 rounded border gh-border-default gh-card-inset text-xs font-mono"
					/>
					<button
						type="button"
						onclick={() => (showNew = !showNew)}
						class="absolute right-2 top-2 text-[var(--gh-fg-subtle)] hover:text-[var(--gh-fg-default)]"
					>
						{#if showNew}<EyeOff class="w-4 h-4" />{:else}<Eye class="w-4 h-4" />{/if}
					</button>
				</div>
			</div>

			<div>
				<label for="confirm-pwd" class="text-[10px] uppercase text-[var(--gh-fg-subtle)] font-semibold block mb-1">
					Confirm New Password *
				</label>
				<input
					id="confirm-pwd"
					type="password"
					bind:value={confirmPassword}
					placeholder="••••••••••••"
					autocomplete="new-password"
					required
					class="w-full p-2 rounded border gh-border-default gh-card-inset text-xs font-mono"
				/>
			</div>

			<div class="flex justify-end gap-2 pt-3 border-t gh-border-muted">
				<button type="button" onclick={onClose} class="gh-btn text-xs">
					Cancel
				</button>
				<button
					type="submit"
					disabled={loading || !currentPassword || !newPassword || !confirmPassword}
					class="gh-btn-primary text-xs font-semibold"
				>
					{#if loading}
						<RefreshCw class="w-3.5 h-3.5 animate-spin" />
						Updating...
					{:else}
						<KeyRound class="w-3.5 h-3.5" />
						Update Password
					{/if}
				</button>
			</div>
		</form>
	</div>
</div>
