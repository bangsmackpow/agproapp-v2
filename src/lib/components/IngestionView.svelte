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
		RefreshCw,
		Download,
		ExternalLink,
		FileCode,
		HardDrive,
		FileCheck,
		X
	} from 'lucide-svelte';

	let { onImportCompleted } = $props<{ onImportCompleted?: () => void }>();

	let loading = $state(false);
	let error = $state<string | null>(null);
	let successResult = $state<any | null>(null);

	let inputMode = $state<'upload' | 'sample'>('upload');
	let selectedFile = $state<File | null>(null);
	let isDragging = $state(false);

	let rawPayload = $state<string>('');
	let fileName = $state<string>('sample_document.txt');
	let selectedSourceHint = $state<IngestionSource>('channel_bol');
	let autoCommit = $state<boolean>(true);

	let customers = $state<Customer[]>([]);
	let targetCustomerId = $state<string>('');

	let logs = $state<any[]>([]);
	let logsLoading = $state(false);

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
		loadLogs();
		loadSample('channel_bol');
	});

	async function loadCustomers() {
		const res = await apiFetch<{ customers: Customer[] }>('/customers');
		if (res.data) customers = res.data.customers || [];
		if (customers.length > 0) targetCustomerId = customers[0].id;
	}

	async function loadLogs() {
		logsLoading = true;
		const res = await apiFetch<{ logs: any[] }>('/ingestion/logs');
		logsLoading = false;
		if (res.data) logs = res.data.logs || [];
	}

	function loadSample(key: IngestionSource) {
		selectedSourceHint = key;
		rawPayload = SAMPLES[key].text;
		fileName = `${key}_sample_payload.txt`;
		selectedFile = null;
		error = null;
		successResult = null;
	}

	function handleFileSelected(file: File) {
		selectedFile = file;
		fileName = file.name;
		error = null;
		successResult = null;

		// Detect source hint by file name
		const lower = file.name.toLowerCase();
		if (lower.includes('channel') || lower.includes('bol')) selectedSourceHint = 'channel_bol';
		else if (lower.includes('wickman')) selectedSourceHint = 'wickman_chemical';
		else if (lower.includes('atticus')) selectedSourceHint = 'atticus';
		else if (lower.includes('ib') || lower.includes('supply')) selectedSourceHint = 'ib_ag_supply';

		// If text file, preview contents
		if (file.type.includes('text') || file.name.endsWith('.txt') || file.name.endsWith('.csv')) {
			const reader = new FileReader();
			reader.onload = (e) => {
				rawPayload = (e.target?.result as string) || '';
			};
			reader.readAsText(file);
		} else {
			rawPayload = `[File attached: ${file.name} (${(file.size / 1024).toFixed(1)} KB)]`;
		}
	}

	function clearSelectedFile() {
		selectedFile = null;
		loadSample('channel_bol');
	}

	async function handleUpload() {
		error = null;
		successResult = null;

		if (!selectedFile && !rawPayload.trim()) {
			error = 'Please select a document file or provide payload text.';
			return;
		}

		loading = true;

		try {
			let res: any;
			if (selectedFile) {
				// Multipart upload directly streaming file to Hono + Cloudflare R2
				const formData = new FormData();
				formData.append('file', selectedFile);
				if (rawPayload && !rawPayload.startsWith('[File attached:')) {
					formData.append('payloadRaw', rawPayload);
				}
				if (selectedSourceHint) formData.append('sourceHint', selectedSourceHint);
				if (targetCustomerId) formData.append('customerId', targetCustomerId);
				formData.append('autoCommit', String(autoCommit));

				const response = await fetch('/api/ingestion/process', {
					method: 'POST',
					body: formData,
					credentials: 'include'
				});

				const data = await response.json();
				if (!response.ok) {
					error = data.error || data.message || 'Upload processing failed';
				} else {
					successResult = data;
					await loadLogs();
					onImportCompleted?.();
				}
			} else {
				// JSON Text payload
				const payload = {
					payloadRaw: rawPayload,
					fileName,
					sourceHint: selectedSourceHint,
					customerId: targetCustomerId || undefined,
					autoCommit
				};

				res = await apiFetch('/ingestion/process', {
					method: 'POST',
					body: JSON.stringify(payload)
				});

				if (res.error) {
					error = res.error;
				} else {
					successResult = res.data;
					await loadLogs();
					onImportCompleted?.();
				}
			}
		} catch (e: any) {
			error = e?.message || 'Network error processing document';
		} finally {
			loading = false;
		}
	}
</script>

<div class="space-y-6">
	<!-- Page Header -->
	<div class="pb-4 border-b gh-border-muted flex flex-col sm:flex-row sm:items-center justify-between gap-3">
		<div>
			<h2 class="text-lg font-bold text-[var(--gh-fg-default)] flex items-center gap-2">
				<UploadCloud class="w-5 h-5 text-emerald-500" />
				Document Ingestion & Cloudflare R2 Archival
			</h2>
			<p class="text-xs text-[var(--gh-fg-muted)] mt-0.5">
				Upload incoming vendor invoices and Channel seed BOLs directly to Cloudflare R2 (<code>agpro-documents</code>) for permanent audit storage.
			</p>
		</div>

		<div class="flex items-center gap-3">
			<label class="text-xs text-[var(--gh-fg-muted)] flex items-center gap-2 cursor-pointer">
				<input type="checkbox" bind:checked={autoCommit} class="rounded text-emerald-500" />
				<span>Auto-commit to live inventory</span>
			</label>
			<button
				type="button"
				onclick={loadLogs}
				class="gh-btn text-xs"
				title="Refresh ingestion logs"
			>
				<RefreshCw class="w-3.5 h-3.5 {logsLoading ? 'animate-spin' : ''}" />
			</button>
		</div>
	</div>

	<!-- Mode Switcher: File Upload vs. 1-Click Test Samples -->
	<div class="flex items-center justify-between">
		<div class="flex items-center gap-1 p-1 bg-[var(--gh-canvas-inset)] rounded-md border gh-border-muted text-xs">
			<button
				type="button"
				onclick={() => (inputMode = 'upload')}
				class="px-3 py-1.5 rounded font-medium transition-colors {inputMode === 'upload' ? 'bg-[var(--gh-card-bg)] text-[var(--gh-fg-default)] font-semibold shadow-xs' : 'text-[var(--gh-fg-muted)] hover:text-[var(--gh-fg-default)]'}"
			>
				<span class="flex items-center gap-1.5">
					<UploadCloud class="w-3.5 h-3.5 text-emerald-500" />
					Upload File to R2
				</span>
			</button>
			<button
				type="button"
				onclick={() => {
					inputMode = 'sample';
					loadSample(selectedSourceHint);
				}}
				class="px-3 py-1.5 rounded font-medium transition-colors {inputMode === 'sample' ? 'bg-[var(--gh-card-bg)] text-[var(--gh-fg-default)] font-semibold shadow-xs' : 'text-[var(--gh-fg-muted)] hover:text-[var(--gh-fg-default)]'}"
			>
				<span class="flex items-center gap-1.5">
					<Sparkles class="w-3.5 h-3.5 text-amber-500" />
					1-Click Test Payloads
				</span>
			</button>
		</div>

		<span class="text-[11px] font-mono text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 hidden sm:inline-flex items-center gap-1">
			<HardDrive class="w-3 h-3" /> R2 Bucket: agpro-documents
		</span>
	</div>

	<!-- 1-Click Sample Document Loaders (When Sample Mode Active) -->
	{#if inputMode === 'sample'}
		<div class="gh-card p-4 space-y-3 animate-in fade-in">
			<div class="flex items-center justify-between">
				<span class="text-xs font-bold uppercase tracking-wider text-[var(--gh-fg-muted)] flex items-center gap-1.5">
					<Sparkles class="w-3.5 h-3.5 text-amber-500" />
					Preloaded Partner Documents & BOLs
				</span>
				<span class="text-[11px] text-[var(--gh-fg-subtle)]">Click any vendor to simulate document intake</span>
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
	{/if}

	<!-- Upload / Editor Workspace -->
	<div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
		<!-- Left: File Dropzone or Text Editor -->
		<div class="gh-card p-4 space-y-3 flex flex-col justify-between">
			<div class="space-y-3">
				{#if inputMode === 'upload'}
					<!-- Drag & Drop Zone -->
					<div
						role="presentation"
						class="border-2 border-dashed rounded-lg p-6 text-center transition-colors {isDragging ? 'border-emerald-500 bg-emerald-500/10' : 'gh-border-muted hover:border-[var(--gh-border-default)]'}"
						ondragover={(e) => { e.preventDefault(); isDragging = true; }}
						ondragleave={() => (isDragging = false)}
						ondrop={(e) => {
							e.preventDefault();
							isDragging = false;
							if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
								handleFileSelected(e.dataTransfer.files[0]);
							}
						}}
					>
						{#if selectedFile}
							<div class="flex items-center justify-between p-3 rounded gh-card-inset border gh-border-muted text-xs">
								<div class="flex items-center gap-3">
									<div class="w-9 h-9 rounded bg-emerald-600/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
										<FileCheck class="w-5 h-5" />
									</div>
									<div class="text-left">
										<p class="font-bold text-[var(--gh-fg-default)]">{selectedFile.name}</p>
										<p class="text-[11px] text-[var(--gh-fg-muted)]">
											{(selectedFile.size / 1024).toFixed(1)} KB &bull; {selectedFile.type || 'Binary Document'}
										</p>
									</div>
								</div>
								<button
									type="button"
									onclick={clearSelectedFile}
									class="p-1 rounded text-[var(--gh-fg-muted)] hover:text-rose-500"
									title="Remove file"
								>
									<X class="w-4 h-4" />
								</button>
							</div>
							<p class="text-[10px] text-emerald-500 mt-2 font-semibold">
								&check; Ready to stream into Cloudflare R2 bucket <code>agpro-documents</code>
							</p>
						{:else}
							<UploadCloud class="w-10 h-10 mx-auto text-[var(--gh-fg-subtle)] mb-2" />
							<p class="text-xs font-semibold text-[var(--gh-fg-default)]">
								Drag and drop document here, or browse from computer
							</p>
							<p class="text-[11px] text-[var(--gh-fg-muted)] mt-1">
								Supports PDF invoices, Channel seed BOLs, JPG/PNG scans, and TXT files
							</p>
							<label class="mt-3 inline-block">
								<input
									type="file"
									accept=".pdf,.png,.jpg,.jpeg,.txt,.csv,.json"
									onchange={(e) => {
										const target = e.target as HTMLInputElement;
										if (target.files && target.files.length > 0) {
											handleFileSelected(target.files[0]);
										}
									}}
									class="hidden"
								/>
								<span class="gh-btn text-xs font-semibold cursor-pointer">
									Browse Local Files
								</span>
							</label>
						{/if}
					</div>

					<!-- Optional OCR Text or Notes Override -->
					<div>
						<label for="raw-payload" class="text-[10px] uppercase font-semibold text-[var(--gh-fg-subtle)] block mb-1">
							Document OCR Text / Vendor Line Item Data:
						</label>
						<textarea
							id="raw-payload"
							bind:value={rawPayload}
							rows="7"
							placeholder="Pasted document text or OCR translation..."
							class="w-full p-2.5 rounded-md gh-card-inset border gh-border-default font-mono text-xs focus:ring-1 focus:ring-emerald-500 leading-relaxed"
						></textarea>
					</div>
				{:else}
					<!-- Sample Payload Text Editor -->
					<div>
						<div class="flex items-center justify-between mb-1">
							<label for="sample-payload" class="text-xs font-bold uppercase tracking-wider text-[var(--gh-fg-muted)]">
								Payload Text Buffer
							</label>
							<span class="text-[10px] font-mono text-[var(--gh-fg-subtle)]">
								{fileName}
							</span>
						</div>
						<textarea
							id="sample-payload"
							bind:value={rawPayload}
							rows="14"
							placeholder="Paste document text or select a 1-click sample above..."
							class="w-full p-2.5 rounded-md gh-card-inset border gh-border-default font-mono text-xs focus:ring-1 focus:ring-emerald-500 leading-relaxed"
						></textarea>
					</div>
				{/if}
			</div>

			<div class="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-2 border-t gh-border-muted">
				<div>
					<label for="link-customer-select" class="text-[10px] uppercase text-[var(--gh-fg-subtle)] block mb-1 font-semibold">
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
						disabled={loading || (!selectedFile && !rawPayload.trim())}
						class="w-full gh-btn-primary justify-center text-xs py-2 font-semibold"
					>
						{#if loading}
							<RefreshCw class="w-3.5 h-3.5 animate-spin" />
							Streaming to R2 & Parsing...
						{:else}
							<ArrowRight class="w-3.5 h-3.5" />
							Ingest & Archive in R2
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
						<div class="flex items-center gap-1.5">
							{#if successResult.r2Stored}
								<span class="gh-badge gh-badge-success text-[10px] flex items-center gap-1">
									<HardDrive class="w-3 h-3" /> R2 Archived
								</span>
							{/if}
							<span class="gh-badge border-emerald-500/40 text-emerald-500 text-[10px]">
								Confidence: {(successResult.parseResult.confidence * 100).toFixed(0)}%
							</span>
						</div>
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
					<!-- R2 Object Confirmation -->
					<div class="p-3 rounded gh-card-inset border gh-border-muted space-y-1 text-xs">
						<div class="flex items-center justify-between">
							<span class="font-bold text-[var(--gh-fg-default)] flex items-center gap-1.5">
								<HardDrive class="w-3.5 h-3.5 text-emerald-500" />
								Cloudflare R2 Audit Archive
							</span>
							<a
								href={`/api/ingestion/documents/${successResult.logId}/download`}
								target="_blank"
								download
								class="gh-btn text-[11px] py-1 px-2 flex items-center gap-1 text-emerald-500"
							>
								<Download class="w-3 h-3" /> Download from R2
							</a>
						</div>
						<p class="font-mono text-[10px] text-[var(--gh-fg-subtle)] truncate">
							Key: {successResult.storageKey}
						</p>
					</div>

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

						<div class="max-h-56 overflow-y-auto gh-card-inset rounded border gh-border-muted divide-y gh-border-muted text-xs">
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
						<p class="font-medium text-[var(--gh-fg-default)]">Awaiting Document Upload</p>
						<p class="max-w-xs text-[11px]">
							Upload a vendor invoice or choose a 1-click test document to stream into Cloudflare R2 and extract Iowa regulatory compliance tokens.
						</p>
					</div>
				{/if}
			</div>

			<div class="pt-3 border-t gh-border-muted text-[10px] text-[var(--gh-fg-subtle)] flex items-center justify-between">
				<span>Supported: Wickman, Atticus, I & B Ag, Channel BOL</span>
				<span>Cloudflare D1 &bull; R2 Bucket</span>
			</div>
		</div>
	</div>

	<!-- Ingestion Audit History (Cloudflare R2 Records) -->
	<div class="gh-card overflow-hidden">
		<div class="p-3.5 border-b gh-border-muted flex items-center justify-between bg-[var(--gh-canvas-subtle)]">
			<span class="text-xs font-bold uppercase tracking-wider text-[var(--gh-fg-muted)] flex items-center gap-1.5">
				<HardDrive class="w-3.5 h-3.5 text-emerald-500" />
				Cloudflare R2 Document Ingestion Audit Archive ({logs.length})
			</span>
			<span class="text-[11px] text-[var(--gh-fg-subtle)]">Permanent Audit Storage</span>
		</div>

		{#if logsLoading && logs.length === 0}
			<div class="p-8 text-center text-xs text-[var(--gh-fg-muted)]">
				<RefreshCw class="w-4 h-4 animate-spin mx-auto mb-2 text-emerald-500" />
				Loading R2 ingestion archive...
			</div>
		{:else if logs.length === 0}
			<div class="p-8 text-center text-xs text-[var(--gh-fg-muted)]">
				No documents ingested yet. Upload an invoice above to begin R2 archival.
			</div>
		{:else}
			<div class="overflow-x-auto">
				<table class="w-full text-left text-xs">
					<thead class="border-b gh-border-muted text-[10px] uppercase text-[var(--gh-fg-subtle)] bg-[var(--gh-canvas-inset)]">
						<tr>
							<th class="p-3">Ingested File / R2 Key</th>
							<th class="p-3">Vendor / Source</th>
							<th class="p-3">Iowa Seed BOL / Order</th>
							<th class="p-3">Items / Basis</th>
							<th class="p-3">Uploaded By</th>
							<th class="p-3 text-right">R2 Actions</th>
						</tr>
					</thead>
					<tbody class="divide-y gh-border-muted">
						{#each logs as log}
							<tr class="hover:bg-[var(--gh-canvas-subtle)] transition-colors">
								<td class="p-3">
									<div class="flex items-center gap-2">
										<FileText class="w-4 h-4 text-emerald-500 shrink-0" />
										<div>
											<span class="font-semibold text-[var(--gh-fg-default)] block truncate max-w-xs">
												{log.fileName}
											</span>
											<span class="text-[10px] font-mono text-[var(--gh-fg-subtle)]">
												{log.id} &bull; {new Date(log.createdAt).toLocaleDateString()}
											</span>
										</div>
									</div>
								</td>
								<td class="p-3">
									<span class="font-medium text-[var(--gh-fg-default)] block">
										{log.vendor?.name || 'General Vendor'}
									</span>
									<span class="gh-badge text-[9px] uppercase font-mono">
										{log.source}
									</span>
								</td>
								<td class="p-3">
									{#if log.extractedBolNumber || log.extractedOrderNumber}
										<div class="space-y-0.5 font-mono text-[11px]">
											{#if log.extractedBolNumber}
												<p class="text-emerald-600 dark:text-emerald-400 font-bold">
													BOL: {log.extractedBolNumber}
												</p>
											{/if}
											{#if log.extractedOrderNumber}
												<p class="text-[var(--gh-fg-muted)]">
													ORD: {log.extractedOrderNumber}
												</p>
											{/if}
										</div>
									{:else}
										<span class="text-[var(--gh-fg-subtle)]">—</span>
									{/if}
								</td>
								<td class="p-3 font-mono text-[11px]">
									<span class="text-[var(--gh-fg-default)] font-bold block">
										{log.itemCount} items
									</span>
									<span class="text-[var(--gh-fg-muted)]">
										${log.totalCostBasis?.toFixed(2) || '0.00'}
									</span>
								</td>
								<td class="p-3 text-[11px] text-[var(--gh-fg-muted)]">
									{log.uploadedByUser?.name || 'System Staff'}
								</td>
								<td class="p-3 text-right">
									<div class="flex items-center justify-end gap-1.5">
										<a
											href={`/api/ingestion/documents/${log.id}/download`}
											target="_blank"
											download
											class="gh-btn text-[11px] py-1 px-2 flex items-center gap-1 text-emerald-500"
											title="Download file from Cloudflare R2"
										>
											<Download class="w-3 h-3" /> Download
										</a>
										<a
											href={`/api/ingestion/documents/${log.id}/preview`}
											target="_blank"
											class="gh-btn text-[11px] py-1 px-2"
											title="Open document in browser tab"
										>
											<ExternalLink class="w-3 h-3 text-[var(--gh-fg-subtle)]" />
										</a>
									</div>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	</div>
</div>
