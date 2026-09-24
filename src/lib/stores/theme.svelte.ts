import { browser } from '$app/environment';

export type ThemeMode = 'light' | 'dark' | 'system';

class ThemeState {
	current = $state<ThemeMode>('dark');
	effectiveTheme = $state<'light' | 'dark'>('dark');

	constructor() {
		if (browser) {
			const saved = localStorage.getItem('agpro_theme') as ThemeMode | null;
			if (saved && ['light', 'dark', 'system'].includes(saved)) {
				this.current = saved;
			} else {
				this.current = 'system';
			}
			this.apply();

			// Listen for OS theme changes when in 'system' mode
			window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
				if (this.current === 'system') {
					this.apply();
				}
			});
		}
	}

	setTheme(theme: ThemeMode) {
		this.current = theme;
		if (browser) {
			localStorage.setItem('agpro_theme', theme);
			this.apply();
		}
	}

	private apply() {
		if (!browser) return;

		let isDark = true;
		if (this.current === 'system') {
			isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
		} else {
			isDark = this.current === 'dark';
		}

		this.effectiveTheme = isDark ? 'dark' : 'light';

		const html = document.documentElement;
		if (isDark) {
			html.classList.add('dark');
			html.classList.remove('light');
		} else {
			html.classList.add('light');
			html.classList.remove('dark');
		}
	}
}

export const theme = new ThemeState();
