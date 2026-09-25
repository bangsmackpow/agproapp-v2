<script lang="ts">
	import { Printer, X, ShieldCheck, Plane } from 'lucide-svelte';

	let { invoice, onClose } = $props<{
		invoice: any;
		onClose: () => void;
	}>();

	const hasRegulatedSeed = $derived(
		invoice.items?.some((it: any) => it.isIowaComplianceVerified)
	);
</script>

<div
	role="presentation"
	class="fixed inset-0 bg-black/75 z-50 flex items-center justify-center p-4 backdrop-blur-xs overflow-y-auto no-print"
	onclick={(e) => {
		if (e.target === e.currentTarget) onClose();
	}}
	onkeydown={(e) => e.key === 'Escape' && onClose()}
>
	<div class="gh-card max-w-4xl w-full p-6 space-y-4 shadow-2xl my-8">
		<!-- Modal Chrome Top (Hidden during physical print) -->
		<div class="flex items-center justify-between pb-3 border-b gh-border-muted no-print">
			<div class="flex items-center gap-2">
				<Printer class="w-4 h-4 text-emerald-500" />
				<h3 class="font-bold text-sm text-[var(--gh-fg-default)]">
					Print Engine Layout: Invoice {invoice.invoiceNumber}
				</h3>
			</div>

			<div class="flex items-center gap-2">
				<button
					type="button"
					onclick={() => window.print()}
					class="gh-btn-primary text-xs font-semibold"
				>
					<Printer class="w-3.5 h-3.5" />
					Print Standard Letter (8.5" x 11")
				</button>
				<button type="button" onclick={onClose} class="gh-btn text-xs">
					Close
				</button>
			</div>
		</div>

		<!-- Physical Printable US Letter Document (Target of @media print) -->
		<div class="printable-document bg-white text-slate-900 font-sans p-8 rounded-md border border-slate-200 shadow-sm space-y-6 text-xs selection:bg-slate-200">
			<!-- Document Header -->
			<div class="flex justify-between items-start border-b-2 border-slate-900 pb-4">
				<div>
					<div class="flex items-center gap-2">
						<div class="w-8 h-8 rounded bg-emerald-800 text-white flex items-center justify-center font-bold">
							<Plane class="w-4 h-4" />
						</div>
						<h1 class="text-xl font-bold tracking-tight text-slate-900">AgPro Solutions</h1>
					</div>
					<p class="text-xs text-slate-600 mt-1 font-medium">
						Crop Protection, Channel® Seed & Custom Aerial/Ground Application
					</p>
					<p class="text-[10px] text-slate-500">
						1200 E Howard St, Creston, IA 50801 &bull; Tel: (641) 745-7392 &bull; agprosolu@gmail.com &bull; agprosolu.com
					</p>
				</div>

				<div class="text-right">
					<span class="inline-block px-2.5 py-1 bg-slate-900 text-white font-mono font-bold text-xs uppercase tracking-wider rounded">
						INVOICE
					</span>
					<p class="font-mono font-bold text-base text-slate-900 mt-2">{invoice.invoiceNumber}</p>
					<p class="text-[10px] text-slate-600 font-mono">Issued: {invoice.issueDate}</p>
					<p class="text-[10px] text-slate-600 font-mono">Due Date: {invoice.dueDate}</p>
				</div>
			</div>

			<!-- Customer Billing & Staging Context -->
			<div class="grid grid-cols-2 gap-6 text-xs">
				<div class="p-3 bg-slate-50 rounded border border-slate-200 space-y-1">
					<span class="text-[9px] font-bold uppercase tracking-wider text-slate-500 block">
						Bill To / Grower Account:
					</span>
					<p class="font-bold text-sm text-slate-900">{invoice.customer?.name}</p>
					<p class="text-slate-700">{invoice.customer?.farmName}</p>
					<p class="text-slate-600">{invoice.customer?.billingAddress}</p>
					<p class="text-slate-600">{invoice.customer?.county} County, IA {invoice.customer?.zipCode || ''}</p>
					<p class="text-slate-500 text-[10px]">Phone: {invoice.customer?.phone || 'N/A'}</p>
				</div>

				<div class="p-3 bg-slate-50 rounded border border-slate-200 space-y-1">
					<span class="text-[9px] font-bold uppercase tracking-wider text-slate-500 block">
						Field Staging & Application Details:
					</span>
					<p class="font-medium text-slate-800">
						Staging: {invoice.customer?.shippingAddress || invoice.customer?.billingAddress}
					</p>
					{#if invoice.acresTreated}
						<p class="font-semibold text-emerald-800">
							Aerial Drone Application: {invoice.acresTreated} Total Treated Acres
						</p>
					{/if}
					{#if invoice.fieldLocationDescription}
						<p class="text-slate-600 text-[10px]">
							Location: {invoice.fieldLocationDescription}
						</p>
					{/if}
					<p class="text-[10px] text-slate-500 pt-1">
						Pricing Tier Strategy: <strong class="uppercase font-mono">{invoice.pricingStrategyTier.replace('_', ' ')}</strong>
					</p>
				</div>
			</div>

			<!-- Itemized Products Table -->
			<table class="w-full text-left text-xs border-collapse print-table">
				<thead>
					<tr class="border-b-2 border-slate-800 text-slate-800 font-bold bg-slate-100">
						<th class="p-2">Item Description & Classification</th>
						<th class="p-2 text-right">Quantity</th>
						<th class="p-2 text-right">Unit Price</th>
						<th class="p-2 text-right">Line Total</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-slate-200">
					{#each invoice.items as item}
						<tr>
							<td class="p-2">
								<p class="font-bold text-slate-900">{item.description}</p>
								<div class="text-[10px] text-slate-500 flex items-center gap-2">
									<span>Unit: {item.unit}</span>
									{#if item.bolNumber}
										<span class="font-mono text-emerald-800 font-semibold">
											BOL/CMR: {item.bolNumber}
										</span>
									{/if}
									{#if item.orderNumber}
										<span class="font-mono text-slate-600">
											Order: {item.orderNumber}
										</span>
									{/if}
								</div>
							</td>
							<td class="p-2 text-right font-mono font-semibold">{item.quantity} {item.unit}</td>
							<td class="p-2 text-right font-mono">${item.unitSellingPrice.toFixed(2)}</td>
							<td class="p-2 text-right font-mono font-bold">${item.totalPrice.toFixed(2)}</td>
						</tr>
					{/each}
				</tbody>
			</table>

			<!-- Iowa Seed Regulatory Compliance Certificate (Mandatory for seed audits) -->
			{#if hasRegulatedSeed}
				<div class="p-3 bg-emerald-50 rounded border border-emerald-300 space-y-1.5 text-slate-800">
					<div class="flex items-center gap-2">
						<ShieldCheck class="w-4 h-4 text-emerald-700" />
						<span class="font-bold text-xs uppercase tracking-wide text-emerald-900">
							State of Iowa Department of Agriculture (IDALS) Seed Audit Verification
						</span>
					</div>
					<p class="text-[10px] text-slate-700 leading-relaxed">
						This document officially certifies that all commercial seed varieties listed herein are cross-referenced with authorized Channel Straight Bill of Lading (BOL/CMR) and manufacturer order documentation in accordance with Iowa Code Chapter 199.
					</p>
					<div class="grid grid-cols-2 gap-2 pt-1 font-mono text-[10px]">
						<div>Verified Seed Custody: Channel / Bayer CropScience</div>
						<div>Jurisdiction: State of Iowa Commercial Agronomy</div>
					</div>
				</div>
			{/if}

			<!-- Financial Totals Section -->
			<div class="flex justify-end pt-2">
				<div class="w-72 space-y-1.5 text-xs">
					<div class="flex justify-between text-slate-600">
						<span>Subtotal:</span>
						<span class="font-mono">${invoice.subtotal.toFixed(2)}</span>
					</div>
					<div class="flex justify-between text-slate-600">
						<span>Iowa Ag Sales Tax:</span>
						<span class="font-mono">$0.00 (Exempt - IA Code § 423.3)</span>
					</div>
					<div class="flex justify-between border-t-2 border-slate-900 pt-2 font-bold text-sm text-slate-900">
						<span>Total Balance Due:</span>
						<span class="font-mono text-emerald-800">${invoice.totalAmount.toFixed(2)}</span>
					</div>
				</div>
			</div>

			<!-- Remittance & Bank Settlement Stub -->
			<div class="border-t-2 border-dashed border-slate-300 pt-4 mt-6 text-[10px] text-slate-600 space-y-1">
				<div class="flex justify-between font-bold text-slate-800">
					<span>REMITTANCE ADVICE - PLEASE DETACH AND RETURN WITH PAYMENT</span>
					<span>INVOICE #{invoice.invoiceNumber}</span>
				</div>
				<p>Make all checks payable to: <strong>AgPro Solutions</strong> &bull; 1200 E Howard St, Creston, IA 50801 &bull; Tel: (641) 745-7392</p>
				<p class="font-mono text-slate-500">In-house, JDF & Rabo Financing available &bull; Remittance inquiries: agprosolu@gmail.com</p>
			</div>
		</div>
	</div>
</div>
