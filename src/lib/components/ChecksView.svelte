<script lang="ts">
	import { apiFetch } from '$lib/api/client';
	import { auth } from '$lib/stores/auth.svelte';
	import { amountToWords } from '$lib/utils/number-to-words';
	import type { Check, Vendor } from '$lib/db/schema';
	import {
		CreditCard,
		Plus,
		Lock,
		Printer,
		Ban,
		CheckCircle2,
		AlertTriangle,
		ShieldAlert,
		Sparkles,
		FileSpreadsheet
	} from 'lucide-svelte';

	let checks = $state<any[]>([]);
	let vendors = $state<Vendor[]>([]);
	let nextCheckNumber = $state<number>(1045);
	let loading = $state(false);

	// Write Check Modal
	let showWriteModal = $state(false);
	let writeLoading = $state(false);
	let writeError = $state<string | null>(null);

	let selectedVendorId = $state<string>('');
	let checkAmount = $state<number>(1250.0);
	let checkMemo = $state<string>('');
	let checkCategory = $state<string>('Inventory Purchase');

	// Real-time legal amount to words transformation
	let writtenWords = $derived(amountToWords(checkAmount || 0));

	// Physical Check Print Preview Modal
	let activePreviewCheck = $state<any | null>(null);

	$effect(() => {
		if (auth.isAdmin) {
			loadData();
		}
	});

	async function loadData() {
		loading = true;
		const [chkRes, vndRes] = await Promise.all([
			apiFetch<{ checks: any[]; sequence: any }>('/checks'),
			apiFetch<{ vendors: Vendor[] }>('/inventory') // fallback vendors list
		]);

		if (chkRes.data) {
			checks = chkRes.data.checks || [];
			if (chkRes.data.sequence?.nextCheckNumber) {
				nextCheckNumber = chkRes.data.sequence.nextCheckNumber;
			}
		}

		// Also fetch vendors
		const vRes = await apiFetch<{ vendors: Vendor[] }>('/vendors').catch(() => null);
		if (vRes?.data?.vendors) {
			vendors = vRes.data.vendors;
		} else {
			// Mock default vendors if vendors endpoint isn't standalone
			vendors = [
				{ id: 'vnd_wickman_01', name: 'Wickman Chemical', vendorCode: 'WICK-01' } as any,
				{ id: 'vnd_atticus_01', name: 'Atticus LLC', vendorCode: 'ATT-01' } as any,
				{ id: 'vnd_ibag_01', name: 'I & B Ag Supply', vendorCode: 'IB-01' } as any,
				{ id: 'vnd_channel_01', name: 'Channel Seed / Bayer CropScience', vendorCode: 'CHAN-01' } as any
			];
		}
		if (vendors.length > 0 && !selectedVendorId) {
			selectedVendorId = vendors[0].id;
		}

		loading = false;
	}

	async function handleCreateCheck() {
		writeError = null;
		if (!selectedVendorId || !checkAmount || checkAmount <= 0) {
			writeError = 'Please select a vendor and enter a positive check dollar amount.';
			return;
		}

		writeLoading = true;
		const res = await apiFetch('/checks', {
			method: 'POST',
			body: JSON.stringify({
				vendorId: selectedVendorId,
				amount: checkAmount,
				memo: checkMemo,
				category: checkCategory
			})
		});
		writeLoading = false;

		if (res.error) {
			writeError = res.error;
		} else {
			showWriteModal = false;
			checkMemo = '';
			loadData();
		}
	}

	async function markPrinted(checkId: string) {
		await apiFetch(`/checks/${checkId}/print`, { method: 'POST' });
		loadData();
		if (activePreviewCheck && activePreviewCheck.id === checkId) {
			activePreviewCheck.status = 'printed';
		}
	}

	async function voidCheck(checkId: string) {
		const reason = prompt('Please enter mandatory reason for voiding this check:');
		if (!reason) return;

		await apiFetch(`/checks/${checkId}/void`, {
			method: 'POST',
			body: JSON.stringify({ reason })
		});
		loadData();
		if (activePreviewCheck && activePreviewCheck.id === checkId) {
			activePreviewCheck.status = 'voided';
		}
	}
</script>

<div class="space-y-6">
	<!-- Top Bar -->
	<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b gh-border-muted">
		<div>
			<h2 class="text-lg font-bold text-[var(--gh-fg-default)] flex items-center gap-2">
				<CreditCard class="w-5 h-5 text-emerald-500" />
				Protected Checkwriting & Disbursement Module
			</h2>
			<p class="text-xs text-[var(--gh-fg-muted)] mt-0.5">
				Strictly restricted to Admin persona. Sequential check number locking, amount-to-words parsing, and corporate 3-part layout calibration.
			</p>
		</div>

		{#if auth.isAdmin}
			<div class="flex items-center gap-3">
				<div class="text-right hidden sm:block">
					<span class="text-[10px] uppercase text-[var(--gh-fg-subtle)] block">Next Serial #</span>
					<span class="font-mono font-bold text-sm text-emerald-500">#{nextCheckNumber}</span>
				</div>
				<button
					type="button"
					onclick={() => (showWriteModal = true)}
					class="gh-btn-primary text-xs font-semibold"
				>
					<Plus class="w-3.5 h-3.5" />
					Write Check
				</button>
			</div>
		{/if}
	</div>

	<!-- RBAC Lock Notice if user is NOT Admin -->
	{#if !auth.isAdmin}
		<div class="gh-card p-12 text-center space-y-4 max-w-lg mx-auto">
			<div class="w-12 h-12 rounded-full bg-rose-500/10 text-rose-500 flex items-center justify-center mx-auto border border-rose-500/30">
				<Lock class="w-6 h-6" />
			</div>
			<div>
				<h3 class="font-bold text-sm text-[var(--gh-fg-default)]">
					Access Restricted: Admin Persona Required
				</h3>
				<p class="text-xs text-[var(--gh-fg-muted)] mt-1">
					Checkwriting contains privileged financial disbursement controls and physical check printing sequences.
					Current active role: <span class="font-mono font-bold uppercase">{auth.role}</span>.
				</p>
			</div>
			<div class="pt-2">
				<p class="text-[11px] text-[var(--gh-fg-subtle)]">
					To test check issuance and 3-part paper layouts, use the persona switcher in the header to switch to <span class="font-semibold text-emerald-500">Curtis Vance (Admin)</span>.
				</p>
			</div>
		</div>
	{:else}
		<!-- Checks Register Table -->
		<div class="gh-card overflow-hidden">
			<div class="overflow-x-auto">
				<table class="w-full text-left text-xs border-collapse">
					<thead>
						<tr class="border-b gh-border-muted bg-[var(--gh-canvas-inset)] text-[var(--gh-fg-muted)] font-semibold">
							<th class="p-3">Check #</th>
							<th class="p-3">Vendor / Payee</th>
							<th class="p-3">Issue Date</th>
							<th class="p-3">Status</th>
							<th class="p-3 text-right">Amount ($)</th>
							<th class="p-3">Amount in Legal Words</th>
							<th class="p-3 text-center">Actions</th>
						</tr>
					</thead>
					<tbody class="divide-y gh-border-muted">
						{#if loading}
							<tr>
								<td colspan="7" class="p-8 text-center text-xs text-[var(--gh-fg-muted)]">
									Loading check register ledger...
								</td>
							</tr>
						{:else if checks.length === 0}
							<tr>
								<td colspan="7" class="p-8 text-center text-xs text-[var(--gh-fg-muted)] space-y-2">
									<p>No checks written yet. Checkbook sequence starts at #{nextCheckNumber}.</p>
									<button type="button" onclick={() => (showWriteModal = true)} class="gh-btn-primary text-xs">
										<Plus class="w-3.5 h-3.5" />
										Write First Check
									</button>
								</td>
							</tr>
						{:else}
							{#each checks as chk}
								<tr class="hover:bg-[var(--gh-canvas-inset)] transition-colors">
									<td class="p-3 font-mono font-bold text-sm text-[var(--gh-fg-default)]">
										#{chk.checkNumber}
									</td>
									<td class="p-3">
										<p class="font-semibold text-[var(--gh-fg-default)]">{chk.vendor?.name}</p>
										<p class="text-[10px] text-[var(--gh-fg-muted)]">{chk.memo || chk.category}</p>
									</td>
									<td class="p-3 text-[11px] text-[var(--gh-fg-muted)]">
										{chk.issueDate}
									</td>
									<td class="p-3">
										{#if chk.status === 'printed'}
											<span class="gh-badge gh-badge-success text-[10px] uppercase font-semibold">
												Printed
											</span>
										{:else if chk.status === 'voided'}
											<span class="gh-badge gh-badge-danger text-[10px] uppercase font-semibold">
												Voided
											</span>
										{:else}
											<span class="gh-badge text-[10px] uppercase text-[var(--gh-fg-muted)]">
												Draft
											</span>
										{/if}
									</td>
									<td class="p-3 text-right font-mono font-bold text-sm text-[var(--gh-fg-default)]">
										${chk.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
									</td>
									<td class="p-3 font-mono text-[10px] text-[var(--gh-fg-muted)] max-w-xs truncate" title={chk.amountInWords}>
										{chk.amountInWords}
									</td>
									<td class="p-3 text-center">
										<div class="flex items-center justify-center gap-1.5">
											<button
												type="button"
												onclick={() => (activePreviewCheck = chk)}
												class="gh-btn text-[11px] py-0.5 px-2"
												title="Preview Corporate 3-Part Print Layout"
											>
												<Printer class="w-3 h-3 text-emerald-500" />
												Layout
											</button>
											{#if chk.status !== 'voided'}
												<button
													type="button"
													onclick={() => voidCheck(chk.id)}
													class="gh-btn text-[11px] py-0.5 px-2 text-rose-500 hover:bg-rose-500/10"
													title="Void check"
												>
													<Ban class="w-3 h-3" />
													Void
												</button>
											{/if}
										</div>
									</td>
								</tr>
							{/each}
						{/if}
					</tbody>
				</table>
			</div>
		</div>
	{/if}

	<!-- Write Check Dialog -->
	{#if showWriteModal}
		<div
			role="presentation"
			class="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs"
			onclick={(e) => {
				if (e.target === e.currentTarget) showWriteModal = false;
			}}
			onkeydown={(e) => e.key === 'Escape' && (showWriteModal = false)}
		>
			<div class="gh-card p-5 max-w-lg w-full space-y-4 shadow-2xl">
				<div class="flex items-center justify-between pb-2 border-b gh-border-muted">
					<h3 class="font-bold text-sm text-[var(--gh-fg-default)] flex items-center gap-2">
						<CreditCard class="w-4 h-4 text-emerald-500" />
						Write Corporate Check (Next: #{nextCheckNumber})
					</h3>
					<span class="gh-badge gh-badge-danger text-[10px]">Admin Protected</span>
				</div>

				{#if writeError}
					<div class="p-2.5 rounded gh-badge-danger border flex items-center gap-2 text-xs">
						<AlertTriangle class="w-3.5 h-3.5 shrink-0" />
						<span>{writeError}</span>
					</div>
				{/if}

				<div class="space-y-3 text-xs">
					<!-- Vendor selection -->
					<div>
						<label for="check-vendor-select" class="text-[10px] uppercase text-[var(--gh-fg-subtle)] block mb-1">
							Vendor Payee *
						</label>
						<select
							id="check-vendor-select"
							bind:value={selectedVendorId}
							class="w-full p-2 rounded border gh-border-default gh-card-inset text-xs font-semibold"
						>
							{#each vendors as v}
								<option value={v.id}>{v.name} ({v.vendorCode || 'Vendor'})</option>
							{/each}
						</select>
					</div>

					<!-- Dollar Amount -->
					<div>
						<label for="check-dollar-amount" class="text-[10px] uppercase text-[var(--gh-fg-subtle)] block mb-1">
							Payment Amount ($ USD) *
						</label>
						<input
							id="check-dollar-amount"
							type="number"
							bind:value={checkAmount}
							step="0.01"
							min="0.01"
							class="w-full p-2 rounded border gh-border-default gh-card-inset text-sm font-mono font-bold"
						/>
					</div>

					<!-- Real-Time Amount In Words -->
					<div class="p-2.5 rounded gh-card-inset border gh-border-muted space-y-1">
						<span class="text-[10px] uppercase text-[var(--gh-fg-subtle)] block">
							Legal Words Preview (Checked on Print):
						</span>
						<p class="font-mono text-xs font-semibold text-emerald-600 dark:text-emerald-400">
							{writtenWords}
						</p>
					</div>

					<!-- Memo & Category -->
					<div class="grid grid-cols-2 gap-2">
						<div>
							<label for="check-memo" class="text-[10px] uppercase text-[var(--gh-fg-subtle)] block mb-1">Memo / PO</label>
							<input
								id="check-memo"
								type="text"
								bind:value={checkMemo}
								placeholder="e.g. Inv #8819 Herbicide"
								class="w-full p-2 rounded border gh-border-default gh-card-inset text-xs"
							/>
						</div>
						<div>
							<label for="check-category" class="text-[10px] uppercase text-[var(--gh-fg-subtle)] block mb-1">Ledger Category</label>
							<select
								id="check-category"
								bind:value={checkCategory}
								class="w-full p-2 rounded border gh-border-default gh-card-inset text-xs"
							>
								<option value="Inventory Purchase">Inventory Purchase</option>
								<option value="Drone Parts & Maintenance">Drone Parts & Maintenance</option>
								<option value="Aviation Fuel & Staging">Aviation Fuel & Staging</option>
								<option value="Seed Delivery Settlement">Seed Delivery Settlement</option>
							</select>
						</div>
					</div>
				</div>

				<div class="flex justify-end gap-2 pt-3 border-t gh-border-muted">
					<button
						type="button"
						onclick={() => (showWriteModal = false)}
						class="gh-btn text-xs"
					>
						Cancel
					</button>
					<button
						type="button"
						onclick={handleCreateCheck}
						disabled={writeLoading}
						class="gh-btn-primary text-xs font-semibold"
					>
						Allocate Check #{nextCheckNumber}
					</button>
				</div>
			</div>
		</div>
	{/if}

	<!-- Pixel-Perfect 3-Part Corporate Check Print Preview Modal -->
	{#if activePreviewCheck}
		<div
			role="presentation"
			class="fixed inset-0 bg-black/75 z-50 flex items-center justify-center p-4 backdrop-blur-sm overflow-y-auto"
			onclick={(e) => {
				if (e.target === e.currentTarget) activePreviewCheck = null;
			}}
			onkeydown={(e) => e.key === 'Escape' && (activePreviewCheck = null)}
		>
			<div class="gh-card max-w-3xl w-full p-6 space-y-4 shadow-2xl my-8">
				<div class="flex items-center justify-between pb-3 border-b gh-border-muted">
					<div>
						<h3 class="font-bold text-sm text-[var(--gh-fg-default)] flex items-center gap-2">
							<Printer class="w-4 h-4 text-emerald-500" />
							Corporate Three-Part Check Print Layout Calibration
						</h3>
						<p class="text-xs text-[var(--gh-fg-muted)]">
							Target hardware: Standard 8.5" x 11" 3-part check stock (Top Check, Middle Voucher, Bottom Voucher).
						</p>
					</div>

					<div class="flex items-center gap-2">
						{#if activePreviewCheck.status !== 'printed'}
							<button
								type="button"
								onclick={() => markPrinted(activePreviewCheck.id)}
								class="gh-btn-primary text-xs font-semibold"
							>
								Mark as Printed
							</button>
						{/if}
						<button
							type="button"
							onclick={() => window.print()}
							class="gh-btn text-xs"
						>
							Physical Print
						</button>
						<button
							type="button"
							onclick={() => (activePreviewCheck = null)}
							class="gh-btn text-xs"
						>
							Close
						</button>
					</div>
				</div>

				<!-- Physical 3-Part Check Paper Simulation (Top Check, 2 Stubs) -->
				<div class="bg-white text-slate-900 font-sans p-6 rounded-md border border-slate-300 shadow-inner space-y-6 text-xs selection:bg-slate-200">
					<!-- SECTION 1: TOP CHECK -->
					<div class="border-2 border-slate-800 p-4 rounded bg-amber-50/20 relative space-y-4">
						<!-- Bank & Check Header -->
						<div class="flex justify-between items-start">
							<div>
								<p class="font-bold uppercase tracking-wider text-sm">AgPro Iowa LLC</p>
								<p class="text-[11px] text-slate-600">Precision Aerial Drone Application</p>
								<p class="text-[10px] text-slate-500">Story County, Iowa &bull; Tel: (515) 555-0100</p>
							</div>
							<div class="text-right">
								<p class="font-mono font-bold text-base">CHECK NO: {activePreviewCheck.checkNumber}</p>
								<p class="font-mono text-xs">DATE: {activePreviewCheck.issueDate}</p>
							</div>
						</div>

						<!-- Payee and Dollar Box -->
						<div class="pt-4 flex items-end justify-between gap-4 border-b border-slate-400 pb-2">
							<div class="flex-1">
								<span class="text-[10px] uppercase font-bold text-slate-500 block">PAY TO THE ORDER OF:</span>
								<span class="font-bold text-base text-slate-900 underline underline-offset-4">
									{activePreviewCheck.vendor?.name}
								</span>
							</div>
							<div class="border-2 border-slate-800 p-2 font-mono font-bold text-base bg-white rounded shrink-0">
								${activePreviewCheck.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
							</div>
						</div>

						<!-- Legal Words Line -->
						<div class="border-b border-slate-400 pb-2">
							<span class="text-[10px] uppercase font-bold text-slate-500 block">AMOUNT IN LEGAL WORDS:</span>
							<span class="font-mono font-bold text-xs uppercase tracking-wide">
								{activePreviewCheck.amountInWords}
							</span>
						</div>

						<!-- Memo & Signature Line -->
						<div class="flex justify-between items-end pt-2">
							<div class="w-1/2">
								<span class="text-[10px] uppercase text-slate-500 block">MEMO:</span>
								<span class="font-mono text-xs">{activePreviewCheck.memo || 'Ag Inventory'}</span>
							</div>
							<div class="w-1/3 text-center border-t border-slate-700 pt-1">
								<span class="text-[10px] uppercase font-semibold text-slate-600 block">AUTHORIZED SIGNATURE</span>
								<span class="font-script text-sm italic text-slate-700">Curtis Vance</span>
							</div>
						</div>

						<!-- Simulated MICR Line -->
						<div class="pt-2 text-center font-mono text-[11px] tracking-widest text-slate-600 border-t border-dashed border-slate-300">
							A{activePreviewCheck.checkNumber}A T073000228T 1009482910C
						</div>
					</div>

					<!-- PERFORATION LINE 1 -->
					<div class="border-t-2 border-dashed border-slate-300 text-center text-[10px] text-slate-400 uppercase tracking-widest py-1">
						&bull; &bull; &bull; Perforation Line - Detach Before Depositing &bull; &bull; &bull;
					</div>

					<!-- SECTION 2: VOUCHER STUB 1 -->
					<div class="p-3 border border-slate-300 rounded bg-slate-50 text-[11px] space-y-1">
						<div class="flex justify-between font-bold">
							<span>AgPro Iowa LLC - Accounts Payable Voucher (Vendor Copy)</span>
							<span>Check #{activePreviewCheck.checkNumber}</span>
						</div>
						<div class="grid grid-cols-4 gap-2 pt-1 text-slate-600 font-mono text-[10px]">
							<div>Payee: {activePreviewCheck.vendor?.name}</div>
							<div>Date: {activePreviewCheck.issueDate}</div>
							<div>Category: {activePreviewCheck.category}</div>
							<div class="text-right font-bold text-slate-900">${activePreviewCheck.amount.toFixed(2)}</div>
						</div>
					</div>

					<!-- PERFORATION LINE 2 -->
					<div class="border-t-2 border-dashed border-slate-300 text-center text-[10px] text-slate-400 uppercase tracking-widest py-1">
						&bull; &bull; &bull; Perforation Line &bull; &bull; &bull;
					</div>

					<!-- SECTION 3: VOUCHER STUB 2 -->
					<div class="p-3 border border-slate-300 rounded bg-slate-50 text-[11px] space-y-1">
						<div class="flex justify-between font-bold">
							<span>AgPro Iowa LLC - General Ledger Record (Office Archive Copy)</span>
							<span>Check #{activePreviewCheck.checkNumber}</span>
						</div>
						<div class="grid grid-cols-4 gap-2 pt-1 text-slate-600 font-mono text-[10px]">
							<div>Account: AgPro Primary Operating</div>
							<div>Audit Token: {activePreviewCheck.id}</div>
							<div>Signer: Curtis Vance (Admin)</div>
							<div class="text-right font-bold text-slate-900">${activePreviewCheck.amount.toFixed(2)}</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	{/if}
</div>
