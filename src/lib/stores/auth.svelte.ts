import { browser } from '$app/environment';
import type { UserRole } from '$lib/db/schema';

export interface AuthUserInfo {
	id: string;
	name: string;
	email: string;
	role: UserRole;
	title?: string;
}

export const ROLE_TITLES: Record<UserRole, string> = {
	admin: 'Owner & General Manager',
	manager: 'Operations & Logistics Manager',
	sales: 'Field Sales Representative'
};

class AuthState {
	user = $state<AuthUserInfo | null>(null);
	isLoading = $state<boolean>(true);
	error = $state<string | null>(null);

	constructor() {
		if (browser) {
			this.checkSession();
		} else {
			this.isLoading = false;
		}
	}

	async checkSession() {
		try {
			this.isLoading = true;
			const res = await fetch('/api/auth/me');
			if (res.ok) {
				const data = await res.json();
				if (data.authenticated && data.user) {
					this.user = {
						...data.user,
						title: ROLE_TITLES[data.user.role as UserRole] || 'AgPro Staff'
					};
				} else {
					this.user = null;
				}
			} else {
				this.user = null;
			}
		} catch (err) {
			console.error('Session check failed:', err);
			this.user = null;
		} finally {
			this.isLoading = false;
		}
	}

	async login(email: string, password: string): Promise<{ success: boolean; error?: string }> {
		try {
			this.isLoading = true;
			this.error = null;
			const res = await fetch('/api/auth/login', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ email, password })
			});

			const data = await res.json();
			if (!res.ok || !data.success) {
				this.error = data.error || 'Authentication failed';
				return { success: false, error: this.error || undefined };
			}

			this.user = {
				...data.user,
				title: ROLE_TITLES[data.user.role as UserRole] || 'AgPro Staff'
			};
			return { success: true };
		} catch (err: any) {
			this.error = err?.message || 'Network error occurred during login';
			return { success: false, error: this.error || undefined };
		} finally {
			this.isLoading = false;
		}
	}

	async logout() {
		try {
			this.isLoading = true;
			await fetch('/api/auth/logout', { method: 'POST' });
		} catch (err) {
			console.error('Logout error:', err);
		} finally {
			this.user = null;
			this.isLoading = false;
		}
	}

	get isAuthenticated(): boolean {
		return !!this.user;
	}

	get role(): UserRole {
		return this.user?.role || 'sales';
	}

	get isSales(): boolean {
		return this.user?.role === 'sales';
	}

	get isManager(): boolean {
		return this.user?.role === 'manager';
	}

	get isAdmin(): boolean {
		return this.user?.role === 'admin';
	}

	get canManageInventory(): boolean {
		return this.user?.role === 'manager' || this.user?.role === 'admin';
	}

	get canWriteChecks(): boolean {
		return this.user?.role === 'admin';
	}

	get canViewAuditLogs(): boolean {
		return this.user?.role === 'admin';
	}
}

export const auth = new AuthState();
