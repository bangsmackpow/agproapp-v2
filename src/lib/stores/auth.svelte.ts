import { browser } from '$app/environment';
import type { UserRole } from '$lib/db/schema';

export interface PersonaUser {
	id: string;
	name: string;
	email: string;
	role: UserRole;
	title: string;
}

export const PRESET_PERSONAS: Record<UserRole, PersonaUser> = {
	sales: {
		id: 'usr_sales_01',
		name: 'Jake Miller',
		email: 'sales@agpro.iowa',
		role: 'sales',
		title: 'Field Sales Representative'
	},
	manager: {
		id: 'usr_mgr_01',
		name: 'Sarah Lindqvist',
		email: 'manager@agpro.iowa',
		role: 'manager',
		title: 'Operations & Logistics Manager'
	},
	admin: {
		id: 'usr_admin_01',
		name: 'Curtis Vance',
		email: 'admin@agpro.iowa',
		role: 'admin',
		title: 'Owner & General Manager'
	}
};

class AuthState {
	user = $state<PersonaUser>(PRESET_PERSONAS.admin);

	constructor() {
		if (browser) {
			const savedRole = localStorage.getItem('agpro_active_role') as UserRole | null;
			if (savedRole && PRESET_PERSONAS[savedRole]) {
				this.user = PRESET_PERSONAS[savedRole];
			}
		}
	}

	setRole(role: UserRole) {
		if (PRESET_PERSONAS[role]) {
			this.user = PRESET_PERSONAS[role];
			if (browser) {
				localStorage.setItem('agpro_active_role', role);
			}
		}
	}

	get role(): UserRole {
		return this.user.role;
	}

	get isSales(): boolean {
		return this.user.role === 'sales';
	}

	get isManager(): boolean {
		return this.user.role === 'manager';
	}

	get isAdmin(): boolean {
		return this.user.role === 'admin';
	}

	get canManageInventory(): boolean {
		return this.user.role === 'manager' || this.user.role === 'admin';
	}

	get canWriteChecks(): boolean {
		return this.user.role === 'admin';
	}

	get canViewAuditLogs(): boolean {
		return this.user.role === 'admin';
	}
}

export const auth = new AuthState();
