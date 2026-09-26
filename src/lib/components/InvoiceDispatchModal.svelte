<script lang="ts">
	import { apiFetch } from '$lib/api/client';
	import { Send, X, ShieldCheck, Mail, CheckCircle2, AlertTriangle, RefreshCw } from 'lucide-svelte';

	let { invoice, onClose, onDispatched } = $props<{
		invoice: any;
		onClose: () => void;
		onDispatched?: () => void;
	}>();

	let loading = $state(false);
	let previewLoading = $state(true);
	let previewData = $state<any | null>(null);
	let error = $state<string | null>(null);
	let successMsg = $state<string | null>(null);

	let recipientEmail = $state('');
	let customMessage = $state('');
	let attachCompliance = $state(true);

	$effect(() => {
		loadPreview();
	});

	async function loadPreview() {
		previewLoading = true;
		const res = await apiFetch(`/invoices/${invoice.id}/dispatch-preview`);
		previewLoading = false;
		if (res.data) {
			previewData = res.data;
			recipientEmail = res.data.recipientEmail || invoice.customer?.email || '';
		}
	}

	async function handleSend() {
		error = null;
		successMsg = null;
		loading = true;

		const res = await apiFetch(`/invoices/${invoice.id}/dispatch`, {
			method: 'POST',
			body: JSON.stringify({
				recipientEmail,
				customMessage,
				attachCompliance
			})
		});

		loading = false;

		if (res.error) {
			error = res.error;
		} else {
			successMsg = res.data.message || `Dispatched to ${recipientEmail}`;
			setTimeout(() => {
				onDispatched?.();
				onClose();
			}, 1200);
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
	<div class="gh-card max-w-lg w-full p-6 space-y-4 shadow-2xl">
		<div class="flex items-center justify-between pb-3 border-b gh-border-muted">
			<div class="flex items-center gap-2">
				<Send class="w-4 h-4 text-emerald-500" />
				<h3 class="font-bold text-sm text-[var(--gh-fg-default)]">
					Electronic Distribution: {invoice.invoiceNumber}
				</h3>
				<span class="gh-badge border-purple-500/40 text-purple-600 dark:text-purple-400 text-[9px] uppercase font-mono">
					Resend API
				</span>
			</div>
			<button type="button" onclick={onClose} class="p-1 rounded text-[var(--gh-fg-muted)] hover:bg-[var(--gh-canvas-inset)]">
				<X class="w-4 h-4" />
			</button>
		</div>

		{#if error}
			<div class="p-2.5 rounded gh-badge-danger border text-xs flex items-center gap-2">
				<AlertTriangle class="w-3.5 h-3.5" />
				<span>{error}</span>
			</div>
		{/if}

		{#if successMsg}
			<div class="p-2.5 rounded gh-badge-success border text-xs flex items-center gap-2">
				<CheckCircle2 class="w-3.5 h-3.5 text-emerald-500" />
				<span>{successMsg}</span>
			</div>
		{/if}

		{#if previewLoading}
			<div class="p-8 text-center text-xs text-[var(--gh-fg-muted)]">
				Preparing electronic payload...
			</div>
		{:else}
			<div class="space-y-3 text-xs">
				<div>
					<label for="recip-email" class="text-[10px] uppercase text-[var(--gh-fg-subtle)] block mb-1">
						Grower / Farm Recipient Email *
					</label>
					<input
						id="recip-email"
						type="email"
						bind:value={recipientEmail}
						placeholder="grower@farm.iowa"
						class="w-full p-2 rounded border gh-border-default gh-card-inset text-xs font-mono font-semibold"
					/>
				</div>

				<div>
					<label for="custom-msg" class="text-[10px] uppercase text-[var(--gh-fg-subtle)] block mb-1">
						Personalized Agronomy Message (Optional)
					</label>
					<textarea
						id="custom-msg"
						bind:value={customMessage}
						rows="2"
						placeholder="e.g. Completed post-emerge corn aerial application today on North 80 field."
						class="w-full p-2 rounded border gh-border-default gh-card-inset text-xs"
					></textarea>
				</div>

				<!-- Compliance Attachment Toggle -->
				{#if previewData?.hasSeedCompliance}
					<label class="p-2.5 rounded gh-card-inset border gh-border-muted flex items-start gap-2.5 cursor-pointer">
						<input type="checkbox" bind:checked={attachCompliance} class="mt-0.5 rounded text-emerald-500" />
						<div class="space-y-0.5">
							<span class="font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
								<ShieldCheck class="w-3.5 h-3.5" />
								Attach State of Iowa Seed Compliance Audit Certificate
							</span>
							<p class="text-[10px] text-[var(--gh-fg-muted)]">
								Includes verified Channel Straight BOL and Order numbers satisfying IDALS commercial seed distribution regulations.
							</p>
						</div>
					</label>
				{/if}

				<!-- Summary of Invoice Payload -->
				<div class="p-3 rounded gh-card-inset text-[11px] space-y-1">
					<div class="flex justify-between">
						<span class="text-[var(--gh-fg-muted)]">Customer:</span>
						<span class="font-semibold text-[var(--gh-fg-default)]">{previewData?.recipientName}</span>
					</div>
					<div class="flex justify-between">
						<span class="text-[var(--gh-fg-muted)]">Total Amount:</span>
						<span class="font-mono font-bold text-emerald-500">${invoice.totalAmount.toFixed(2)}</span>
					</div>
				</div>
			</div>
		{/if}

		<div class="flex justify-end gap-2 pt-3 border-t gh-border-muted">
			<button type="button" onclick={onClose} class="gh-btn text-xs">
				Cancel
			</button>
			<button
				type="button"
				onclick={handleSend}
				disabled={loading || !recipientEmail.trim()}
				class="gh-btn-primary text-xs font-semibold"
			>
				{#if loading}
					<RefreshCw class="w-3.5 h-3.5 animate-spin" />
					Dispatching...
				{:else}
					<Send class="w-3.5 h-3.5" />
					Dispatch Invoice
				{/if}
			</button>
		</div>
	</div>
</div>
