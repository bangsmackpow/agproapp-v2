<script lang="ts">
	import { apiFetch } from '$lib/api/client';
	import { auth } from '$lib/stores/auth.svelte';
	import { ScrollText, ShieldAlert, Lock, RefreshCw } from 'lucide-svelte';

	let logs = $state<any[]>([]);
	let loading = $state(false);

	$effect(() => {
		if (auth.isAdmin) {
			loadLogs();
		}
	});

	async function loadLogs() {
		loading = true;
		const res = await apiFetch<{ logs: any[] }>('/system-logs');
		if (res.data) logs = res.data.logs || [];
		loading = false;
	}
</script>

<div class="space-y-4">
	<div class="flex items-center justify-between pb-4 border-b gh-border-muted">
		<div>
			<h2 class="text-lg font-bold text-[var(--gh-fg-default)] flex items-center gap-2">
				<ScrollText class="w-5 h-5 text-emerald-500" />
				System Configuration & Security Audit Logs
			</h2>
			<p class="text-xs text-[var(--gh-fg-muted)] mt-0.5">
				Immutable log of administrative security events, RBAC blockage occurrences, check disbursements, and Iowa seed compliance audits.
			</p>
		</div>

		{#if auth.isAdmin}
			<button type="button" onclick={loadLogs} class="gh-btn text-xs">
				<RefreshCw class="w-3.5 h-3.5 {loading ? 'animate-spin' : ''}" />
				Refresh
			</button>
		{/if}
	</div>

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
					Security logs are restricted strictly to Curtis Vance (Admin).
				</p>
			</div>
		</div>
	{:else}
		<div class="gh-card overflow-hidden">
			<div class="overflow-x-auto">
				<table class="w-full text-left text-xs border-collapse">
					<thead>
						<tr class="border-b gh-border-muted bg-[var(--gh-canvas-inset)] text-[var(--gh-fg-muted)] font-semibold">
							<th class="p-3">Event Action</th>
							<th class="p-3">User & IP</th>
							<th class="p-3">Target Entity</th>
							<th class="p-3">Context Metadata</th>
							<th class="p-3">Timestamp</th>
						</tr>
					</thead>
					<tbody class="divide-y gh-border-muted">
						{#if loading}
							<tr>
								<td colspan="5" class="p-8 text-center text-xs text-[var(--gh-fg-muted)]">
									Loading audit trail...
								</td>
							</tr>
						{:else if logs.length === 0}
							<tr>
								<td colspan="5" class="p-8 text-center text-xs text-[var(--gh-fg-muted)]">
									No security audit events recorded.
								</td>
							</tr>
						{:else}
							{#each logs as log}
								<tr class="hover:bg-[var(--gh-canvas-inset)] transition-colors">
									<td class="p-3">
										<span class="gh-badge {log.action.includes('VIOLATION') || log.action.includes('VOID') ? 'gh-badge-danger' : 'gh-badge-success'} text-[10px] font-mono font-bold">
											{log.action}
										</span>
									</td>
									<td class="p-3">
										<p class="font-semibold text-[var(--gh-fg-default)]">{log.userEmail || 'System'}</p>
										<p class="text-[10px] text-[var(--gh-fg-muted)] font-mono">{log.ipAddress || 'internal'}</p>
									</td>
									<td class="p-3 font-mono text-[11px] text-[var(--gh-fg-default)]">
										{log.entity} {log.entityId ? `(${log.entityId.slice(0, 10)})` : ''}
									</td>
									<td class="p-3 font-mono text-[10px] text-[var(--gh-fg-muted)] max-w-sm truncate" title={log.metadata}>
										{log.metadata || 'None'}
									</td>
									<td class="p-3 font-mono text-[11px] text-[var(--gh-fg-muted)]">
										{new Date(log.createdAt).toLocaleString()}
									</td>
								</tr>
							{/each}
						{/if}
					</tbody>
				</table>
			</div>
		</div>
	{/if}
</div>
