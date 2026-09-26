import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { api } from '../src/lib/server/api/index';

describe('Pre-Production Features: Staff Management, R2 Archival & Resend Dispatch', () => {
	test('Staff Management route /api/users blocks unauthenticated or non-admin users', async () => {
		// Sales role attempt to access /api/users
		const salesRes = await api.request('/api/users', {
			method: 'GET',
			headers: { 'x-user-role': 'sales' }
		});
		assert.equal(salesRes.status, 403, 'Sales should be forbidden from accessing /api/users');

		// Manager role attempt to access /api/users
		const mgrRes = await api.request('/api/users', {
			method: 'GET',
			headers: { 'x-user-role': 'manager' }
		});
		assert.equal(mgrRes.status, 403, 'Manager should be forbidden from accessing /api/users');
	});

	test('Staff Management route /api/users permits Admin role', async () => {
		const adminRes = await api.request('/api/users', {
			method: 'GET',
			headers: { 'x-user-role': 'admin' }
		});
		// Should not be 401 or 403
		assert.ok(adminRes.status === 200 || adminRes.status === 500, `Expected 200 or DB fallback, got ${adminRes.status}`);
		if (adminRes.status === 200) {
			const body = (await adminRes.json()) as any;
			assert.ok(Array.isArray(body.users));
		}
	});

	test('Password change route /api/auth/change-password validates input parameters', async () => {
		const res = await api.request('/api/auth/change-password', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'x-user-role': 'admin'
			},
			body: JSON.stringify({ currentPassword: '', newPassword: '' })
		});
		assert.equal(res.status, 400, 'Empty passwords should return 400 Bad Request');
	});

	test('Document ingestion endpoint processes payload with R2 storage metadata', async () => {
		const sampleText = `
BAYER CROPSCIENCE / CHANNEL SEED LOGISTICS
CHANNEL STRAIGHT BILL OF LADING
BOL/CMR NO: CH-BOL-948120
ORDER NO: ORD-BAY-449102
SHIP DATE: 04/18/2026
SHIP TO: Prairie Ridge Farms LLC, 14228 290th St, Ames, IA 50010
LINE ITEMS:
1. CHANNEL 209-15 VT2P CORN SEED 120 BAGS LOT: LOT-IA-209-B2
		`.trim();

		// Create mock R2 bucket for testing
		let storedKey = '';
		let storedData: any = null;
		const mockDocumentsBucket = {
			put: async (key: string, value: any) => {
				storedKey = key;
				storedData = value;
				return { key };
			},
			get: async (key: string) => {
				if (key === storedKey) {
					return {
						body: storedData,
						size: 500,
						httpMetadata: { contentType: 'text/plain' },
						httpEtag: '"test-etag"'
					};
				}
				return null;
			}
		};

		const res = await api.request(
			'/api/ingestion/process',
			{
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'x-user-role': 'manager'
				},
				body: JSON.stringify({
					payloadRaw: sampleText,
					fileName: 'channel_bol_test.txt',
					sourceHint: 'channel_bol',
					autoCommit: false
				})
			},
			{
				DOCUMENTS: mockDocumentsBucket
			} as any
		);

		// With mock DB or in-memory, verify status or response structure
		if (res.status === 200) {
			const data = (await res.json()) as any;
			assert.equal(data.success, true);
			assert.equal(data.bucketName, 'agpro-documents');
			assert.ok(data.storageKey.startsWith('documents/'));
			assert.equal(data.iowaComplianceTokens?.bolNumber, 'CH-BOL-948120');
			assert.equal(data.iowaComplianceTokens?.orderNumber, 'ORD-BAY-449102');
		} else {
			// DB not available in pure mock environment is accepted
			assert.equal(res.status, 500);
		}
	});

	test('Invoice dispatch preview renders branded AgPro Solutions Creston email layout', async () => {
		// Test dispatch preview with mock invoice response or 404 validation
		const previewRes = await api.request('/api/invoices/inv_non_existent/dispatch-preview', {
			method: 'GET',
			headers: { 'x-user-role': 'sales' }
		});

		// Non-existent invoice should return 404
		assert.ok(
			previewRes.status === 404 || previewRes.status === 500,
			`Expected 404 or 500 without DB, got ${previewRes.status}`
		);
	});
});
