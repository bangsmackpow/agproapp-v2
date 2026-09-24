import { auth } from '$lib/stores/auth.svelte';

export async function apiFetch<T = any>(
	path: string,
	options: RequestInit = {}
): Promise<{ data: T | null; error: string | null; status: number }> {
	const url = path.startsWith('/api') ? path : `/api${path.startsWith('/') ? path : `/${path}`}`;

	const headers = new Headers(options.headers || {});
	if (!headers.has('content-type') && !(options.body instanceof FormData)) {
		headers.set('content-type', 'application/json');
	}

	// Attach active RBAC persona headers if user is logged in
	if (auth.user) {
		headers.set('x-user-role', auth.role);
		headers.set('x-user-id', auth.user.id);
	}

	try {
		const res = await fetch(url, {
			...options,
			headers,
			credentials: 'include'
		});

		const json = await res.json().catch(() => null);

		if (!res.ok) {
			return {
				data: null,
				error: json?.message || json?.error || `HTTP error ${res.status}`,
				status: res.status
			};
		}

		return {
			data: json,
			error: null,
			status: res.status
		};
	} catch (err: any) {
		return {
			data: null,
			error: err?.message || 'Network request failed',
			status: 0
		};
	}
}
