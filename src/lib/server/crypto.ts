/**
 * Edge-Native Cryptographic Utilities for Cloudflare Workers & Node.js
 * Uses standard Web Crypto API (crypto.subtle) with PBKDF2 and SHA-256.
 * Zero external native C/C++ dependencies.
 */

export async function hashPassword(password: string): Promise<string> {
	const encoder = new TextEncoder();
	const salt = crypto.getRandomValues(new Uint8Array(16));
	const keyMaterial = await crypto.subtle.importKey(
		'raw',
		encoder.encode(password),
		'PBKDF2',
		false,
		['deriveBits']
	);

	const derivedBits = await crypto.subtle.deriveBits(
		{
			name: 'PBKDF2',
			salt: salt,
			iterations: 100000,
			hash: 'SHA-256'
		},
		keyMaterial,
		256
	);

	const saltHex = Array.from(salt)
		.map((b) => b.toString(16).padStart(2, '0'))
		.join('');
	const hashHex = Array.from(new Uint8Array(derivedBits))
		.map((b) => b.toString(16).padStart(2, '0'))
		.join('');

	return `pbkdf2:100000:${saltHex}:${hashHex}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
	try {
		const parts = stored.split(':');
		if (parts.length !== 4 || parts[0] !== 'pbkdf2') return false;

		const iterations = parseInt(parts[1], 10);
		const saltHex = parts[2];
		const expectedHashHex = parts[3];

		const saltMatches = saltHex.match(/.{1,2}/g);
		if (!saltMatches) return false;

		const salt = new Uint8Array(saltMatches.map((byte) => parseInt(byte, 16)));
		const encoder = new TextEncoder();
		const keyMaterial = await crypto.subtle.importKey(
			'raw',
			encoder.encode(password),
			'PBKDF2',
			false,
			['deriveBits']
		);

		const derivedBits = await crypto.subtle.deriveBits(
			{
				name: 'PBKDF2',
				salt: salt,
				iterations: iterations,
				hash: 'SHA-256'
			},
			keyMaterial,
			256
		);

		const hashHex = Array.from(new Uint8Array(derivedBits))
			.map((b) => b.toString(16).padStart(2, '0'))
			.join('');

		// Constant-time comparison
		if (hashHex.length !== expectedHashHex.length) return false;
		let diff = 0;
		for (let i = 0; i < hashHex.length; i++) {
			diff |= hashHex.charCodeAt(i) ^ expectedHashHex.charCodeAt(i);
		}
		return diff === 0;
	} catch (err) {
		console.error('Password verification error:', err);
		return false;
	}
}

export function generateSessionToken(): string {
	const bytes = crypto.getRandomValues(new Uint8Array(32));
	return Array.from(bytes)
		.map((b) => b.toString(16).padStart(2, '0'))
		.join('');
}
