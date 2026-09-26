<script lang="ts">
	import { apiFetch } from '$lib/api/client';
	import { auth } from '$lib/stores/auth.svelte';
	import type { UserRole, UserStatus } from '$lib/db/schema';
	import {
		Users,
		UserPlus,
		ShieldAlert,
		ShieldCheck,
		KeyRound,
		Lock,
		CheckCircle2,
		AlertTriangle,
		RefreshCw,
		X,
		Check,
		UserCheck,
		UserX,
		Mail,
		Eye,
		EyeOff
	} from 'lucide-svelte';

	interface StaffUser {
		id: string;
		name: string;
		email: string;
		role: UserRole;
		status: UserStatus;
		createdAt?: string | number;
		updatedAt?: string | number;
	}

	let staffList = $state<StaffUser[]>([]);
	let loading = $state(false);
	let error = $state<string | null>(null);
	let successMsg = $state<string | null>(null);

	// Modals state
	let showAddModal = $state(false);
	let showEditModal = $state(false);
	let showResetPwdModal = $state(false);

	let selectedUser = $state<StaffUser | null>(null);

	// New user form
	let newName = $state('');
	let newEmail = $state('');
	let newRole = $state<UserRole>('sales');
	let newPassword = $state('AgPro2026!Staff');
	let showNewPwd = $state(false);
	let actionLoading = $state(false);

	// Edit user form
	let editName = $state('');
	let editRole = $state<UserRole>('sales');
	let editStatus = $state<UserStatus>('active');

	// Reset password form
	let resetPasswordValue = $state('');
	let showResetPwd = $state(false);

	$effect(() => {
		loadStaff();
	});

	async function loadStaff() {
		loading = true;
		error = null;
		const res = await apiFetch<{ users: StaffUser[] }>('/users');
		loading = false;
		if (res.data) {
			staffList = res.data.users || [];
		} else if (res.error) {
			error = res.error;
		}
	}

	function openAddModal() {
		newName = '';
		newEmail = '';
		newRole = 'sales';
		newPassword = `AgPro${new Date().getFullYear()}!${Math.floor(100 + Math.random() * 900)}`;
		error = null;
		successMsg = null;
		showAddModal = true;
	}

	async function handleAddStaff() {
		if (!newName.trim() || !newEmail.trim() || !newPassword.trim()) {
			error = 'Please fill out all required fields.';
			return;
		}

		actionLoading = true;
		error = null;
		const res = await apiFetch('/users', {
			method: 'POST',
			body: JSON.stringify({
				name: newName.trim(),
				email: newEmail.trim(),
				role: newRole,
				password: newPassword.trim(),
				status: 'active'
			})
		});
		actionLoading = false;

		if (res.error) {
			error = res.error;
		} else {
			successMsg = `Created account for ${newName} (${newRole.toUpperCase()})`;
			showAddModal = false;
			await loadStaff();
			setTimeout(() => (successMsg = null), 4000);
		}
	}

	function openEditModal(user: StaffUser) {
		selectedUser = user;
		editName = user.name;
		editRole = user.role;
		editStatus = user.status;
		error = null;
		showEditModal = true;
	}

	async function handleSaveEdit() {
		if (!selectedUser) return;
		actionLoading = true;
		error = null;

		const res = await apiFetch(`/users/${selectedUser.id}`, {
			method: 'PATCH',
			body: JSON.stringify({
				name: editName.trim(),
				role: editRole,
				status: editStatus
			})
		});
		actionLoading = false;

		if (res.error) {
			error = res.error;
		} else {
			successMsg = `Updated ${editName} successfully.`;
			showEditModal = false;
			await loadStaff();
			setTimeout(() => (successMsg = null), 4000);
		}
	}

	function openResetPwdModal(user: StaffUser) {
		selectedUser = user;
		resetPasswordValue = `AgPro${new Date().getFullYear()}!${Math.floor(1000 + Math.random() * 9000)}`;
		error = null;
		showResetPwdModal = true;
	}

	async function handleResetPassword() {
		if (!selectedUser || resetPasswordValue.length < 8) {
			error = 'Password must be at least 8 characters long.';
			return;
		}

		actionLoading = true;
		error = null;
		const res = await apiFetch(`/users/${selectedUser.id}`, {
			method: 'PATCH',
			body: JSON.stringify({
				password: resetPasswordValue.trim()
			})
		});
		actionLoading = false;

		if (res.error) {
			error = res.error;
		} else {
			successMsg = `Password reset for ${selectedUser.name}. They can now log in with the new credentials.`;
			showResetPwdModal = false;
			setTimeout(() => (successMsg = null), 5000);
		}
	}

	async function handleToggleStatus(user: StaffUser) {
		const newStatus: UserStatus = user.status === 'active' ? 'suspended' : 'active';
		const confirmMsg = user.status === 'active'
			? `Suspend ${user.name}? This will revoke all active sessions immediately.`
			: `Reactivate ${user.name}?`;

		if (!confirm(confirmMsg)) return;

		loading = true;
		const res = await apiFetch(`/users/${user.id}`, {
			method: 'PATCH',
			body: JSON.stringify({ status: newStatus })
		});
		loading = false;

		if (res.error) {
			error = res.error;
		} else {
			successMsg = `Account for ${user.name} is now ${newStatus.toUpperCase()}.`;
			await loadStaff();
			setTimeout(() => (successMsg = null), 4000);
		}
	}

	const roleColors: Record<UserRole, string> = {
		sales: 'gh-badge-success',
		manager: 'gh-badge-attention',
		admin: 'gh-badge-danger'
	};

	const statusColors: Record<UserStatus, string> = {
		active: 'gh-badge-success',
		suspended: 'gh-badge-danger',
		invited: 'gh-badge border-blue-500/40 text-blue-500'
	};
</script>

<div class="space-y-6">
	<!-- Page Header -->
	<div class="pb-4 border-b gh-border-muted flex flex-col sm:flex-row sm:items-center justify-between gap-3">
		<div>
			<h2 class="text-lg font-bold text-[var(--gh-fg-default)] flex items-center gap-2">
				<Users class="w-5 h-5 text-emerald-500" />
				Staff Accounts & Access Management
				<span class="gh-badge border-amber-500/40 text-amber-500 text-[10px] uppercase">
					Admin Restricted
				</span>
			</h2>
			<p class="text-xs text-[var(--gh-fg-muted)] mt-0.5">
				Manage employee logins, grant RBAC privileges (Sales, Manager, Admin), and rotate credentials for AgPro Solutions staff.
			</p>
		</div>

		<div class="flex items-center gap-2">
			<button
				type="button"
				onclick={openAddModal}
				class="gh-btn-primary text-xs font-semibold"
			>
				<UserPlus class="w-3.5 h-3.5" />
				Add Team Member
			</button>
			<button
				type="button"
				onclick={loadStaff}
				disabled={loading}
				class="gh-btn text-xs"
				title="Refresh staff roster"
			>
				<RefreshCw class="w-3.5 h-3.5 {loading ? 'animate-spin' : ''}" />
			</button>
		</div>
	</div>

	<!-- Alerts -->
	{#if error}
		<div class="p-3 rounded gh-badge-danger border flex items-center justify-between text-xs">
			<div class="flex items-center gap-2">
				<AlertTriangle class="w-4 h-4 shrink-0" />
				<span>{error}</span>
			</div>
			<button type="button" onclick={() => (error = null)} class="p-1 hover:opacity-75">
				<X class="w-3.5 h-3.5" />
			</button>
		</div>
	{/if}

	{#if successMsg}
		<div class="p-3 rounded gh-badge-success border flex items-center justify-between text-xs">
			<div class="flex items-center gap-2">
				<CheckCircle2 class="w-4 h-4 text-emerald-500 shrink-0" />
				<span>{successMsg}</span>
			</div>
			<button type="button" onclick={() => (successMsg = null)} class="p-1 hover:opacity-75">
				<X class="w-3.5 h-3.5" />
			</button>
		</div>
	{/if}

	<!-- RBAC Policy Overview Guide -->
	<div class="grid grid-cols-1 md:grid-cols-3 gap-3">
		<div class="gh-card p-3 space-y-1">
			<div class="flex items-center justify-between">
				<span class="font-bold text-xs text-[var(--gh-fg-default)]">Sales Representative</span>
				<span class="gh-badge gh-badge-success text-[9px] uppercase">Sales</span>
			</div>
			<p class="text-[11px] text-[var(--gh-fg-muted)]">
				CRM accounts, customer profiles, draft and finalized invoice creation, Iowa seed compliance verification, read-only catalog access.
			</p>
		</div>
		<div class="gh-card p-3 space-y-1">
			<div class="flex items-center justify-between">
				<span class="font-bold text-xs text-[var(--gh-fg-default)]">Operations Manager</span>
				<span class="gh-badge gh-badge-attention text-[9px] uppercase">Manager</span>
			</div>
			<p class="text-[11px] text-[var(--gh-fg-muted)]">
				All Sales permissions plus full Inventory management (stock adjustments, intake receipts), vendor document ingestion & Channel BOL auto-parsing.
			</p>
		</div>
		<div class="gh-card p-3 space-y-1">
			<div class="flex items-center justify-between">
				<span class="font-bold text-xs text-[var(--gh-fg-default)]">Corporate Administrator</span>
				<span class="gh-badge gh-badge-danger text-[9px] uppercase">Admin</span>
			</div>
			<p class="text-[11px] text-[var(--gh-fg-muted)]">
				Full system access, exclusive Checkwriting ledger & check stock print engine, staff credential management, security & audit logs.
			</p>
		</div>
	</div>

	<!-- Staff Table -->
	<div class="gh-card overflow-hidden">
		<div class="p-3.5 border-b gh-border-muted flex items-center justify-between bg-[var(--gh-canvas-subtle)]">
			<span class="text-xs font-bold uppercase tracking-wider text-[var(--gh-fg-muted)]">
				Active Staff Directory ({staffList.length})
			</span>
			<span class="text-[11px] text-[var(--gh-fg-subtle)]">
				Authentication: Edge Web Crypto PBKDF2 (SHA-256)
			</span>
		</div>

		{#if loading && staffList.length === 0}
			<div class="p-8 text-center text-xs text-[var(--gh-fg-muted)]">
				<RefreshCw class="w-4 h-4 animate-spin mx-auto mb-2 text-emerald-500" />
				Loading staff accounts...
			</div>
		{:else if staffList.length === 0}
			<div class="p-8 text-center text-xs text-[var(--gh-fg-muted)]">
				No staff accounts found.
			</div>
		{:else}
			<div class="overflow-x-auto">
				<table class="w-full text-left text-xs">
					<thead class="border-b gh-border-muted text-[10px] uppercase text-[var(--gh-fg-subtle)] bg-[var(--gh-canvas-inset)]">
						<tr>
							<th class="p-3">Team Member</th>
							<th class="p-3">Email Address</th>
							<th class="p-3">RBAC Role</th>
							<th class="p-3">Status</th>
							<th class="p-3 text-right">Actions</th>
						</tr>
					</thead>
					<tbody class="divide-y gh-border-muted">
						{#each staffList as u}
							<tr class="hover:bg-[var(--gh-canvas-subtle)] transition-colors">
								<td class="p-3">
									<div class="flex items-center gap-2.5">
										<div class="w-7 h-7 rounded-full bg-emerald-600/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-xs shrink-0">
											{u.name.charAt(0).toUpperCase()}
										</div>
										<div>
											<span class="font-semibold text-[var(--gh-fg-default)] block">
												{u.name}
												{#if u.id === auth.user?.id}
													<span class="ml-1 text-[10px] text-emerald-500 font-mono font-bold">(You)</span>
												{/if}
											</span>
											<span class="text-[10px] font-mono text-[var(--gh-fg-subtle)]">{u.id}</span>
										</div>
									</div>
								</td>
								<td class="p-3 font-mono text-[11px] text-[var(--gh-fg-muted)]">
									{u.email}
								</td>
								<td class="p-3">
									<span class={`gh-badge ${roleColors[u.role]} text-[10px] uppercase font-mono`}>
										{u.role}
									</span>
								</td>
								<td class="p-3">
									<span class={`gh-badge ${statusColors[u.status]} text-[10px] uppercase`}>
										{u.status}
									</span>
								</td>
								<td class="p-3 text-right">
									<div class="flex items-center justify-end gap-1.5">
										<button
											type="button"
											onclick={() => openEditModal(u)}
											class="gh-btn text-[11px] py-1 px-2"
											title="Edit role and status"
										>
											Edit Role
										</button>
										<button
											type="button"
											onclick={() => openResetPwdModal(u)}
											class="gh-btn text-[11px] py-1 px-2"
											title="Reset staff member password"
										>
											<KeyRound class="w-3 h-3 text-emerald-500" />
											Reset Pwd
										</button>
										{#if u.id !== auth.user?.id}
											<button
												type="button"
												onclick={() => handleToggleStatus(u)}
												class="gh-btn text-[11px] py-1 px-2 {u.status === 'active' ? 'text-rose-500 hover:bg-rose-500/10' : 'text-emerald-500 hover:bg-emerald-500/10'}"
												title={u.status === 'active' ? 'Suspend account' : 'Reactivate account'}
											>
												{#if u.status === 'active'}
													<UserX class="w-3 h-3" />
												{:else}
													<UserCheck class="w-3 h-3" />
												{/if}
											</button>
										{/if}
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

<!-- Modal 1: Add New Staff Member -->
{#if showAddModal}
	<div
		role="presentation"
		class="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs"
		onclick={(e) => { if (e.target === e.currentTarget) showAddModal = false; }}
		onkeydown={(e) => e.key === 'Escape' && (showAddModal = false)}
	>
		<div class="gh-card max-w-md w-full p-6 space-y-4 shadow-2xl animate-in fade-in">
			<div class="flex items-center justify-between pb-3 border-b gh-border-muted">
				<h3 class="font-bold text-sm text-[var(--gh-fg-default)] flex items-center gap-2">
					<UserPlus class="w-4 h-4 text-emerald-500" />
					Add Team Member
				</h3>
				<button type="button" onclick={() => (showAddModal = false)} class="p-1 rounded text-[var(--gh-fg-muted)] hover:bg-[var(--gh-canvas-inset)]">
					<X class="w-4 h-4" />
				</button>
			</div>

			<form onsubmit={(e) => { e.preventDefault(); handleAddStaff(); }} class="space-y-3.5 text-xs">
				<div>
					<label for="new-staff-name" class="text-[10px] uppercase text-[var(--gh-fg-subtle)] font-semibold block mb-1">
						Full Legal Name *
					</label>
					<input
						id="new-staff-name"
						type="text"
						bind:value={newName}
						placeholder="e.g. Cole Wardenburg"
						required
						class="w-full p-2 rounded border gh-border-default gh-card-inset text-xs"
					/>
				</div>

				<div>
					<label for="new-staff-email" class="text-[10px] uppercase text-[var(--gh-fg-subtle)] font-semibold block mb-1">
						Company Email Address *
					</label>
					<input
						id="new-staff-email"
						type="email"
						bind:value={newEmail}
						placeholder="e.g. cole@agpro.iowa"
						required
						class="w-full p-2 rounded border gh-border-default gh-card-inset text-xs font-mono"
					/>
				</div>

				<div>
					<label for="new-staff-role" class="text-[10px] uppercase text-[var(--gh-fg-subtle)] font-semibold block mb-1">
						RBAC Authorization Role *
					</label>
					<select
						id="new-staff-role"
						bind:value={newRole}
						class="w-full p-2 rounded border gh-border-default gh-card-inset text-xs font-semibold"
					>
						<option value="sales">Sales (CRM, Invoicing, Read-Only Inventory)</option>
						<option value="manager">Manager (CRM, Invoicing, Inventory Edits, Ingestion)</option>
						<option value="admin">Admin (Full System, Checkwriting, Staff Management)</option>
					</select>
				</div>

				<div>
					<label for="new-staff-pwd" class="text-[10px] uppercase text-[var(--gh-fg-subtle)] font-semibold block mb-1">
						Initial Temporary Password *
					</label>
					<div class="relative">
						<input
							id="new-staff-pwd"
							type={showNewPwd ? 'text' : 'password'}
							bind:value={newPassword}
							required
							minlength="8"
							class="w-full p-2 pr-9 rounded border gh-border-default gh-card-inset text-xs font-mono font-semibold"
						/>
						<button
							type="button"
							onclick={() => (showNewPwd = !showNewPwd)}
							class="absolute right-2 top-2 text-[var(--gh-fg-subtle)] hover:text-[var(--gh-fg-default)]"
						>
							{#if showNewPwd}<EyeOff class="w-4 h-4" />{:else}<Eye class="w-4 h-4" />{/if}
						</button>
					</div>
					<p class="text-[10px] text-[var(--gh-fg-subtle)] mt-1">
						Provide this initial temporary password to the staff member. They can rotate it at any time in their user menu.
					</p>
				</div>

				<div class="flex justify-end gap-2 pt-3 border-t gh-border-muted">
					<button type="button" onclick={() => (showAddModal = false)} class="gh-btn text-xs">
						Cancel
					</button>
					<button
						type="submit"
						disabled={actionLoading || !newName.trim() || !newEmail.trim() || !newPassword.trim()}
						class="gh-btn-primary text-xs font-semibold"
					>
						{#if actionLoading}
							<RefreshCw class="w-3.5 h-3.5 animate-spin" />
							Creating...
						{:else}
							<UserPlus class="w-3.5 h-3.5" />
							Create Account
						{/if}
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}

<!-- Modal 2: Edit Staff Role & Status -->
{#if showEditModal && selectedUser}
	<div
		role="presentation"
		class="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs"
		onclick={(e) => { if (e.target === e.currentTarget) showEditModal = false; }}
		onkeydown={(e) => e.key === 'Escape' && (showEditModal = false)}
	>
		<div class="gh-card max-w-md w-full p-6 space-y-4 shadow-2xl animate-in fade-in">
			<div class="flex items-center justify-between pb-3 border-b gh-border-muted">
				<h3 class="font-bold text-sm text-[var(--gh-fg-default)]">
					Edit Staff Profile: {selectedUser.name}
				</h3>
				<button type="button" onclick={() => (showEditModal = false)} class="p-1 rounded text-[var(--gh-fg-muted)] hover:bg-[var(--gh-canvas-inset)]">
					<X class="w-4 h-4" />
				</button>
			</div>

			<form onsubmit={(e) => { e.preventDefault(); handleSaveEdit(); }} class="space-y-3.5 text-xs">
				<div>
					<label for="edit-name" class="text-[10px] uppercase text-[var(--gh-fg-subtle)] font-semibold block mb-1">
						Full Name
					</label>
					<input
						id="edit-name"
						type="text"
						bind:value={editName}
						required
						class="w-full p-2 rounded border gh-border-default gh-card-inset text-xs"
					/>
				</div>

				<div>
					<label for="edit-role" class="text-[10px] uppercase text-[var(--gh-fg-subtle)] font-semibold block mb-1">
						RBAC Role
					</label>
					<select
						id="edit-role"
						bind:value={editRole}
						disabled={selectedUser.id === auth.user?.id}
						class="w-full p-2 rounded border gh-border-default gh-card-inset text-xs font-semibold"
					>
						<option value="sales">Sales</option>
						<option value="manager">Manager</option>
						<option value="admin">Admin</option>
					</select>
					{#if selectedUser.id === auth.user?.id}
						<p class="text-[10px] text-amber-500 mt-1">
							Self-demotion is restricted for security. Another admin must change your role.
						</p>
					{/if}
				</div>

				<div>
					<label for="edit-status" class="text-[10px] uppercase text-[var(--gh-fg-subtle)] font-semibold block mb-1">
						Account Status
					</label>
					<select
						id="edit-status"
						bind:value={editStatus}
						disabled={selectedUser.id === auth.user?.id}
						class="w-full p-2 rounded border gh-border-default gh-card-inset text-xs font-semibold"
					>
						<option value="active">Active</option>
						<option value="suspended">Suspended</option>
						<option value="invited">Invited</option>
					</select>
				</div>

				<div class="flex justify-end gap-2 pt-3 border-t gh-border-muted">
					<button type="button" onclick={() => (showEditModal = false)} class="gh-btn text-xs">
						Cancel
					</button>
					<button
						type="submit"
						disabled={actionLoading}
						class="gh-btn-primary text-xs font-semibold"
					>
						{#if actionLoading}
							<RefreshCw class="w-3.5 h-3.5 animate-spin" />
							Saving...
						{:else}
							<Check class="w-3.5 h-3.5" />
							Save Changes
						{/if}
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}

<!-- Modal 3: Reset Staff Password -->
{#if showResetPwdModal && selectedUser}
	<div
		role="presentation"
		class="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs"
		onclick={(e) => { if (e.target === e.currentTarget) showResetPwdModal = false; }}
		onkeydown={(e) => e.key === 'Escape' && (showResetPwdModal = false)}
	>
		<div class="gh-card max-w-md w-full p-6 space-y-4 shadow-2xl animate-in fade-in">
			<div class="flex items-center justify-between pb-3 border-b gh-border-muted">
				<h3 class="font-bold text-sm text-[var(--gh-fg-default)] flex items-center gap-2">
					<KeyRound class="w-4 h-4 text-emerald-500" />
					Reset Password: {selectedUser.name}
				</h3>
				<button type="button" onclick={() => (showResetPwdModal = false)} class="p-1 rounded text-[var(--gh-fg-muted)] hover:bg-[var(--gh-canvas-inset)]">
					<X class="w-4 h-4" />
				</button>
			</div>

			<p class="text-xs text-[var(--gh-fg-muted)] leading-relaxed">
				Set a new temporary password for <strong>{selectedUser.name}</strong> ({selectedUser.email}).
				This will immediately terminate any active sessions on their account.
			</p>

			<form onsubmit={(e) => { e.preventDefault(); handleResetPassword(); }} class="space-y-3.5 text-xs">
				<div>
					<label for="reset-pwd-val" class="text-[10px] uppercase text-[var(--gh-fg-subtle)] font-semibold block mb-1">
						New Password (min 8 chars) *
					</label>
					<div class="relative">
						<input
							id="reset-pwd-val"
							type={showResetPwd ? 'text' : 'password'}
							bind:value={resetPasswordValue}
							required
							minlength="8"
							class="w-full p-2 pr-9 rounded border gh-border-default gh-card-inset text-xs font-mono font-semibold"
						/>
						<button
							type="button"
							onclick={() => (showResetPwd = !showResetPwd)}
							class="absolute right-2 top-2 text-[var(--gh-fg-subtle)] hover:text-[var(--gh-fg-default)]"
						>
							{#if showResetPwd}<EyeOff class="w-4 h-4" />{:else}<Eye class="w-4 h-4" />{/if}
						</button>
					</div>
				</div>

				<div class="flex justify-end gap-2 pt-3 border-t gh-border-muted">
					<button type="button" onclick={() => (showResetPwdModal = false)} class="gh-btn text-xs">
						Cancel
					</button>
					<button
						type="submit"
						disabled={actionLoading || resetPasswordValue.length < 8}
						class="gh-btn-primary text-xs font-semibold"
					>
						{#if actionLoading}
							<RefreshCw class="w-3.5 h-3.5 animate-spin" />
							Resetting...
						{:else}
							<KeyRound class="w-3.5 h-3.5" />
							Set New Password
						{/if}
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}
