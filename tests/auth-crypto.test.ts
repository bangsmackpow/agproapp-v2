import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { hashPassword, verifyPassword, generateSessionToken } from '../src/lib/server/crypto';

describe('Edge-Native Authentication Cryptography', () => {
	test('hashes and verifies password correctly', async () => {
		const rawPassword = 'AgProIowa2026!Secure';
		const hash = await hashPassword(rawPassword);

		assert.ok(hash.startsWith('pbkdf2:100000:'), 'Hash should have pbkdf2 prefix');

		const isValid = await verifyPassword(rawPassword, hash);
		assert.strictEqual(isValid, true, 'Valid password must verify');

		const isInvalid = await verifyPassword('WrongPassword123', hash);
		assert.strictEqual(isInvalid, false, 'Invalid password must fail verification');
	});

	test('generates cryptographically random 64-char session token', () => {
		const token1 = generateSessionToken();
		const token2 = generateSessionToken();

		assert.strictEqual(token1.length, 64);
		assert.strictEqual(token2.length, 64);
		assert.notStrictEqual(token1, token2, 'Two generated tokens must be distinct');
	});
});
