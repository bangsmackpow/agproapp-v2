import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { api } from '../src/lib/server/api';
import { hashPassword, verifyPassword } from '../src/lib/server/crypto';

describe('Production Authentication & Security Hardening', () => {
	test('Unauthenticated login attempt with missing fields returns 400 Bad Request', async () => {
		const req = new Request('http://localhost/api/auth/login', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({})
		});
		const res = await api.fetch(req);
		assert.strictEqual(res.status, 400);
		const data = await res.json();
		assert.ok(data.error);
	});

	test('Persona switching without session is blocked with 401 Unauthorized in production environment', async () => {
		const req = new Request('http://localhost/api/auth/switch-persona', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ role: 'admin' })
		});
		// In production environment without session, it is blocked with 401
		const res = await api.fetch(req, { APP_ENV: 'production' } as any);
		assert.strictEqual(res.status, 401);
		const data = await res.json();
		assert.match(data.message, /authentication session required/i);
	});

	test('Health endpoint returns unauthenticated state for anonymous public visitors', async () => {
		const req = new Request('http://localhost/api/');
		const res = await api.fetch(req, { APP_ENV: 'production' } as any);
		assert.strictEqual(res.status, 200);
		const data = await res.json();
		assert.strictEqual(data.authenticated, false);
		assert.strictEqual(data.currentUser, null);
	});

	test('PBKDF2 Password hashing verifies valid passwords and rejects invalid passwords', async () => {
		const password = 'AgProIowaSecret2026!';
		const hash = await hashPassword(password);
		assert.ok(hash.startsWith('pbkdf2:100000:'));

		const valid = await verifyPassword(password, hash);
		assert.strictEqual(valid, true);

		const invalid = await verifyPassword('WrongPassword', hash);
		assert.strictEqual(invalid, false);
	});
});
