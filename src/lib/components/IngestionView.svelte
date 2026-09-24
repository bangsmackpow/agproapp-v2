<script lang="ts">
	import { apiFetch } from '$lib/api/client';
	import type { IngestionSource, Customer } from '$lib/db/schema';
	import {
		UploadCloud,
		FileText,
		CheckCircle2,
		AlertCircle,
		ShieldCheck,
		ArrowRight,
		Sparkles,
		Layers,
		PackagePlus,
		RefreshCw
	} from 'lucide-svelte';

	let { onImportCompleted } = $props<{ onImportCompleted?: () => void }>();

	let loading = $state(false);
	let error = $state<string | null>(null);
	let successResult = $state<any | null>(null);

	let rawPayload = $state<string>('');
	let fileName = $state<string>('sample_document.txt');
	let selectedSourceHint = $state<IngestionSource>('channel_bol');
	let autoCommit = $state<boolean>(true);

	let customers = $state<Customer[]>([]);
	let targetCustomerId = $state<string>('');

	// Sample Document Payloads for 1-Click Testing (As requested by user)
	const SAMPLES: Record<IngestionSource, { name: string; vendor: string; text: string }> = {
		channel_bol: {
			name: 'Channel Straight Bill of Lading (BOL)',
			vendor: 'Channel Seed / Bayer CropScience',
			text: `BAYER CROPSCIENCE / CHANNEL SEED LOGISTICS
CHANNEL STRAIGHT BILL OF LADING
BOL/CMR NO: CH-BOL-948120
ORDER NO: ORD-BAY-449102
SHIP DATE: 04/18/2026
SHIP TO: Prairie Ridge Farms LLC, 14228 290th St, Ames, IA 50010
CARRIER: Midwest Ag Express - Trailer #4091

PRODUCT LINE ITEMS:
1. CHANNEL 209-15 VT2P CORN SEED 120 BAGS LOT: LOT-IA-209-B2
2. CHANNEL 2420RX ENLIST E3 SOYBEANS 80 UNITS LOT: LOT-IA-242-S1

REGULATORY CERTIFICATION:
Certified compliant with State of Iowa Department of Agriculture and Land Stewardship (IDALS) commercial seed laws. No noxious weed seeds detected.`
		},
		wickman_chemical: {
			name: 'Wickman Chemical Bulk Herbicide Invoice',
			vendor: 'Wickman Chemical Co.',
			text: `WICKMAN CHEMICAL COMPANY
PO BOX 184, ATLANTIC, IA 50022
INVOICE #: WICK-2026-8819
DATE: 05/12/2026
TERMS: Pre-Pay Cash Discount Net 30

DELIVERED TO: AgPro Iowa Application Services

LINE ITEMS:
- Ventas Herbicide Premix: 50 GAL @ $18.50 / GAL
- Tenkoz 4L Atrazine Flowable: 80 GAL @ $22.00 / GAL
- Nano Penetrant Adjuvant: 10 BOTTLE @ $45.00 / BOTTLE
- Xsate 53.8% Glyphosate: 100 GAL @ $29.50 / GAL
- Fulltec Drift Retardant: 15 GAL @ $65.00 / GAL`
		},
		atticus: {
			name: 'Atticus LLC Post-Patent Chemistry',
			vendor: 'Atticus LLC',
			text: `ATTICUS LLC - AG CHEMICAL SOLUTIONS
ORDER CONFIRMATION / INVOICE #: ATT-40918
DATE: 06/02/2026
TERMS: Net 30

PRODUCTS DELIVERED:
1. Atticus Acadia 2 SC Fungicide EPA: 91234-10
   Active: Azoxystrobin 22.9%
   Quantity: 40 GAL @ $72.00 / GAL
2. Atticus Glufosinate 280 SL EPA: 91234-122
   Active: Glufosinate-ammonium 24.5%
   Quantity: 60 GAL @ $36.50 / GAL`
		},
		ib_ag_supply: {
			name: 'I & B Ag Supply Fertilizer & Hardware',
			vendor: 'I & B Ag Supply',
			text: `I & B AG SUPPLY
WEBSTER CITY, IA 50595
INVOICE #: IB-7731
DATE: 05/01/2026

PURCHASED ITEMS:
- AMS (Dry) Water Conditioner: 50 BAG @ $14.50 / BAG
- FullTec Adjuvant: 20 GAL @ $65.00 / GAL
- DJI Agras T50 Spray Nozzle Kit (Pack of 4): 2 PACK @ $185.00 / PACK
- BANJO 2-inch Quick Transfer Pump: 1 UNIT @ $340.00 / UNIT`
		},
		generic_invoice: {
			name: 'Generic Ag Invoice',
			vendor: 'General Ag Supply',
			text: `AG DISTRIBUTOR INVOICE #GEN-1029
DATE: 04/20/2026
- Xsate 53.8% Herbicide: 30 GAL @ $29.50 / GAL`
		},
		manual: {
			name: 'Manual Document Entry',
			vendor: 'Custom',
			text: ''
		}
	};

	$effect(() => {
		loadCustomers();
		loadSample('channel_bol');
	});

	async function loadCustomers() {
		const res = await apiFetch<{ customers: Customer[] }>('/customers');
		if (res.data) customers = res.data.customers || [];
		if (customers.length > 0) targetCustomerId = customers[0].id;
	}

	function loadSample(key: IngestionSource) {
		selectedSourceHint = key;
		rawPayload = SAMPLES[key].text;
		fileName = `${key}_sample_payload.txt`;
		error = null;
		successResult = null;
	}

	async function handleUpload() {
		error = null;
		successResult = null;
		if (!rawPayload.trim()) {
			error = 'Payload text cannot be empty.';
			return;
		}

		loading = true;

		const payload = {
			payloadRaw: rawPayload,
			fileName,
			sourceHint: selectedSourceHint,
			customerId: targetCustomerId || undefined,
			autoCommit
		};

		const res = await apiFetch('/ingestion/process', {
			method: 'POST',
			body: JSON.stringify(payload)
		});

		loading = false;

		if (res.error) {
			error = res.error;
		} else {
			successResult = res.data;
			onImportCompleted?.();
		}
	}
</script>

<div class="space-y-6">
	<!-- Page Header -->
	<div class="pb-4 border-b gh-border-muted flex flex-col sm:flex-row sm:items-center justify-between gap-3">
		<div>
			<h2 class="text-lg font-bold text-[var(--gh-fg-default)] flex items-center gap-2">
				<UploadCloud class="w-5 h-5 text-emerald-500" />
				Intelligent Data Ingestion & Auto-Import Engine
			</h2>
			<p class="text-xs text-[var(--gh-fg-muted)] mt-0.5">
				Upload vendor invoices or seed bills of lading to auto-extract line items, cost basis, quantities, and Iowa compliance tokens.
			</p>
		</div>

		<div class="flex items-center gap-2">
			<label class="text-xs text-[var(--gh-fg-muted)] flex items-center gap-2 cursor-pointer">
				<input type="checkbox" bind:checked={autoCommit} class="rounded text-emerald-500" />
				<span>Auto-commit to live inventory</span>
			</label>
		</div>
	</div>

	<!-- 1-Click Sample Document Loaders (Requested by User) -->
	<div class="gh-card p-4 space-y-3">
		<div class="flex items-center justify-between">
			<span class="text-xs font-bold uppercase tracking-wider text-[var(--gh-fg-muted)] flex items-center gap-1.5">
				<Sparkles class="w-3.5 h-3.5 text-amber-500" />
				1-Click Test Documents (Key Partners & BOLs)
			</span>
			<span class="text-[11px] text-[var(--gh-fg-subtle)]">Click to test individual parser logic</span>
		</div>

		<div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
			<button
				type="button"
				onclick={() => loadSample('channel_bol')}
				class="gh-btn text-xs justify-start p-2.5 {selectedSourceHint === 'channel_bol' ? 'border-emerald-500 bg-emerald-500/10' : ''}"
			>
				<ShieldCheck class="w-4 h-4 text-emerald-500 shrink-0" />
				<div class="text-left truncate">
					<p class="font-semibold truncate">Channel BOL</p>
					<p class="text-[10px] text-[var(--gh-fg-muted)]">State Seed Audit</p>
				</div>
			</button>

			<button
				type="button"
				onclick={() => loadSample('wickman_chemical')}
				class="gh-btn text-xs justify-start p-2.5 {selectedSourceHint === 'wickman_chemical' ? 'border-emerald-500 bg-emerald-500/10' : ''}"
			>
				<FileText class="w-4 h-4 text-blue-500 shrink-0" />
				<div class="text-left truncate">
					<p class="font-semibold truncate">Wickman Chem</p>
					<p class="text-[10px] text-[var(--gh-fg-muted)]">Herbicides & Rates</p>
				</div>
			</button>

			<button
				type="button"
				onclick={() => loadSample('atticus')}
				class="gh-btn text-xs justify-start p-2.5 {selectedSourceHint === 'atticus' ? 'border-emerald-500 bg-emerald-500/10' : ''}"
			>
				<FileText class="w-4 h-4 text-purple-500 shrink-0" />
				<div class="text-left truncate">
					<p class="font-semibold truncate">Atticus LLC</p>
					<p class="text-[10px] text-[var(--gh-fg-muted)]">EPA Reg & Actives</p>
				</div>
			</button>

			<button
				type="button"
				onclick={() => loadSample('ib_ag_supply')}
				class="gh-btn text-xs justify-start p-2.5 {selectedSourceHint === 'ib_ag_supply' ? 'border-emerald-500 bg-emerald-500/10' : ''}"
			>
				<FileText class="w-4 h-4 text-amber-500 shrink-0" />
				<div class="text-left truncate">
					<p class="font-semibold truncate">I & B Ag Supply</p>
					<p class="text-[10px] text-[var(--gh-fg-muted)]">Hardware & AMS</p>
				</div>
			</button>
		</div>
	</div>

	<!-- Upload / Editor Workspace -->
	<div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
		<!-- Left: Raw Document Text Editor / Dropzone -->
		<div class="gh-card p-4 space-y-3">
			<div class="flex items-center justify-between">
				<label for="raw-payload" class="text-xs font-bold uppercase tracking-wider text-[var(--gh-fg-muted)]">
					Document Payload Text / OCR Buffer
				</label>
				<span class="text-[10px] font-mono text-[var(--gh-fg-subtle)]">
					{fileName}
				</span>
			</div>

			<textarea
				id="raw-payload"
				bind:value={rawPayload}
				rows="14"
				placeholder="Paste document text or select a 1-click sample above..."
				class="w-full p-2.5 rounded-md gh-card-inset border gh-border-default font-mono text-xs focus:ring-1 focus:ring-emerald-500 leading-relaxed"
			></textarea>

			<div class="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-1">
				<div>
					<label for="link-customer-select" class="text-[10px] uppercase text-[var(--gh-fg-subtle)] block mb-1">
						Link Seed BOL To Customer:
					</label>
					<select
						id="link-customer-select"
						bind:value={targetCustomerId}
						class="w-full p-2 rounded border gh-border-default gh-card-inset text-xs"
					>
						<option value="">-- No customer link --</option>
						{#each customers as c}
							<option value={c.id}>{c.name} ({c.county} Co, IA)</option>
						{/each}
					</select>
				</div>

				<div class="flex items-end">
					<button
						type="button"
						onclick={handleUpload}
						disabled={loading || !rawPayload.trim()}
						class="w-full gh-btn-primary justify-center text-xs py-2 font-semibold"
					>
						{#if loading}
							<RefreshCw class="w-3.5 h-3.5 animate-spin" />
							Parsing & Processing...
						{:else}
							<ArrowRight class="w-3.5 h-3.5" />
							Parse & Ingest Document
						{/if}
					</button>
				</div>
			</div>
		</div>

		<!-- Right: Extracted Live Results & Regulatory Ledger -->
		<div class="gh-card p-4 flex flex-col justify-between">
			<div class="space-y-3">
				<div class="flex items-center justify-between pb-2 border-b gh-border-muted">
					<h3 class="text-xs font-bold uppercase tracking-wider text-[var(--gh-fg-default)]">
						Parsed Extraction Schema
					</h3>
					{#if successResult}
						<span class="gh-badge gh-badge-success text-[10px]">
							Confidence: {(successResult.parseResult.confidence * 100).toFixed(0)}%
						</span>
					{/if}
				</div>

				{#if error}
					<div class="p-3 rounded gh-badge-danger border flex items-start gap-2 text-xs">
						<AlertCircle class="w-4 h-4 shrink-0 mt-0.5" />
						<div>
							<p class="font-semibold">Ingestion Error</p>
							<p>{error}</p>
						</div>
					</div>
				{/if}

				{#if successResult}
					<!-- Extracted Iowa Seed BOL Regulatory Tokens -->
					{#if successResult.iowaComplianceTokens}
						<div class="p-3 rounded-md border border-emerald-500/40 bg-emerald-500/10 space-y-1.5 text-xs">
							<div class="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-bold">
								<ShieldCheck class="w-4 h-4 text-emerald-500" />
								<span>Iowa IDALS Regulatory Tokens Isolated</span>
							</div>

							<div class="grid grid-cols-2 gap-2 text-xs pt-1">
								<div>
									<span class="text-[10px] text-[var(--gh-fg-subtle)] uppercase block">BOL/CMR Number:</span>
									<span class="font-mono font-bold text-[var(--gh-fg-default)]">
										{successResult.iowaComplianceTokens.bolNumber}
									</span>
								</div>
								<div>
									<span class="text-[10px] text-[var(--gh-fg-subtle)] uppercase block">Order Number:</span>
									<span class="font-mono font-bold text-[var(--gh-fg-default)]">
										{successResult.iowaComplianceTokens.orderNumber}
									</span>
								</div>
							</div>
							<p class="text-[10px] text-[var(--gh-fg-muted)]">
								Indexed to State of Iowa seed purchase records for regulatory audits.
							</p>
						</div>
					{/if}

					<!-- Extracted Items Table -->
					<div class="space-y-2">
						<div class="flex justify-between items-center text-xs">
							<span class="font-semibold text-[var(--gh-fg-muted)]">
								Vendor: {successResult.parseResult.vendorName}
							</span>
							<span class="font-mono font-bold text-[var(--gh-fg-default)]">
								Total Cost: ${successResult.parseResult.totalCostBasis.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
							</span>
						</div>

						<div class="max-h-64 overflow-y-auto gh-card-inset rounded border gh-border-muted divide-y gh-border-muted text-xs">
							{#each successResult.parseResult.items as it}
								<div class="p-2.5 flex items-start justify-between gap-3">
									<div class="space-y-0.5">
										<div class="flex items-center gap-1.5">
											<span class="font-semibold text-[var(--gh-fg-default)]">{it.name}</span>
											<span class="gh-badge text-[9px] uppercase">{it.category}</span>
										</div>
										<p class="text-[11px] text-[var(--gh-fg-muted)]">
											Qty: {it.quantity} {it.unit} &bull; Cost Basis: ${it.costBasis.toFixed(2)}
											{#if it.ratePerAcre}
												&bull; Rate: {it.ratePerAcre}/acre
											{/if}
										</p>
										{#if it.epaRegNumber}
											<p class="text-[10px] font-mono text-[var(--gh-fg-subtle)]">
												EPA Reg: {it.epaRegNumber} &bull; {it.activeIngredients}
											</p>
										{/if}
									</div>

									<div class="text-right text-[11px] font-mono shrink-0">
										<span class="font-bold text-[var(--gh-fg-default)]">
											${(it.costBasis * it.quantity).toFixed(2)}
										</span>
										<span class="block text-[9px] text-emerald-500">
											Cash App: ${it.cashAppPrice?.toFixed(2)}
										</span>
									</div>
								</div>
							{/each}
						</div>
					</div>

					<!-- Auto-commit results -->
					{#if successResult.importedProducts && successResult.importedProducts.length > 0}
						<div class="p-2.5 gh-card-inset rounded text-[11px] flex items-center justify-between text-emerald-500">
							<span class="flex items-center gap-1.5">
								<PackagePlus class="w-3.5 h-3.5" />
								Committed {successResult.importedProducts.length} product(s) to live inventory.
							</span>
							<span class="font-bold font-mono text-[10px]">D1 Sync OK</span>
						</div>
					{/if}
				{:else}
					<div class="h-64 flex flex-col items-center justify-center text-center p-6 text-xs text-[var(--gh-fg-muted)] border border-dashed gh-border-muted rounded-md space-y-2">
						<UploadCloud class="w-8 h-8 text-[var(--gh-fg-subtle)] stroke-1" />
						<p class="font-medium text-[var(--gh-fg-default)]">Awaiting Payload Submission</p>
						<p class="max-w-xs text-[11px]">
							Choose a 1-click test document above or paste vendor text to review extracted attributes and Iowa BOL tokens.
						</p>
					</div>
				{/if}
			</div>

			<div class="pt-3 border-t gh-border-muted text-[10px] text-[var(--gh-fg-subtle)] flex items-center justify-between">
				<span>Supports: Wickman, Atticus, I & B Ag, Channel BOL</span>
				<span>Cloudflare D1 Ledger</span>
			</div>
		</div>
	</div>
</div>
