import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { parseDocumentPayload, parseChannelBOL, parseWickmanChemical, parseAtticus, parseIBAgSupply } from '../src/lib/server/parsers/index';
import { amountToWords } from '../src/lib/utils/number-to-words';
import { api } from '../src/lib/server/api/index';

describe('Phase 2: Intelligent Document Parse Controls', () => {
	test('Channel Straight BOL Parser isolates BOL/CMR and Order numbers for Iowa seed audit', () => {
		const rawBOL = `
BAYER CROPSCIENCE / CHANNEL SEED LOGISTICS
CHANNEL STRAIGHT BILL OF LADING
BOL/CMR NO: CH-BOL-948120
ORDER NO: ORD-BAY-449102
SHIP DATE: 04/18/2026
SHIP TO: Prairie Ridge Farms LLC, 14228 290th St, Ames, IA 50010
CARRIER: Midwest Ag Express

LINE ITEMS:
1. CHANNEL 209-15 VT2P CORN SEED 120 BAGS LOT: LOT-IA-209-B2
2. CHANNEL 2420RX ENLIST E3 SOYBEANS 80 UNITS LOT: LOT-IA-242-S1
		`;

		const result = parseChannelBOL(rawBOL);
		assert.equal(result.source, 'channel_bol');
		assert.equal(result.iowaComplianceTokens?.bolNumber, 'CH-BOL-948120');
		assert.equal(result.iowaComplianceTokens?.orderNumber, 'ORD-BAY-449102');
		assert.ok(result.items.length >= 2, 'Should extract at least 2 seed line items');
		assert.equal(result.items[0].isRegulated, true, 'Seed items must be flagged as regulated for Iowa audits');
		assert.ok(result.items[0].financedAppPrice! > result.items[0].cashAppPrice!);
		assert.ok(result.items[0].cashAppPrice! > result.items[0].carryPrice!);
	});

	test('Wickman Chemical Parser extracts herbicides, application rates, and cost basis', () => {
		const rawInvoice = `
WICKMAN CHEMICAL CO.
INVOICE #: WICK-2026-8819
DATE: 05/12/2026
CUSTOMER: AgPro Iowa Application Services

PRODUCTS:
- Ventas Herbicide: 50 GAL @ $18.50 / GAL
- Tenkoz 4L Atrazine: 80 GAL @ $22.00 / GAL
- Nano Penetrant: 10 BOTTLE @ $45.00
- Xsate 53.8%: 100 GAL @ $29.50 / GAL
		`;

		const result = parseWickmanChemical(rawInvoice);
		assert.equal(result.source, 'wickman_chemical');
		assert.equal(result.vendorName, 'Wickman Chemical');
		assert.equal(result.documentNumber, 'WICK-2026-8819');
		assert.ok(result.items.length >= 3);
	});

	test('Atticus Parser extracts EPA numbers and active ingredients', () => {
		const rawAtticus = `
ATTICUS LLC - POST-PATENT AG CHEM
INVOICE #: ATT-40918
DATE: 06/02/2026
Items:
- Atticus Acadia 2 SC EPA: 91234-10 QTY: 40 GAL
		`;

		const result = parseAtticus(rawAtticus);
		assert.equal(result.source, 'atticus');
		assert.equal(result.vendorName, 'Atticus LLC');
		assert.ok(result.items.length >= 1);
		assert.equal(result.items[0].epaRegNumber, '91234-10');
	});

	test('I & B Ag Supply Parser extracts hardware and supplies', () => {
		const rawIB = `
I & B AG SUPPLY
INVOICE #: IB-7731
DATE: 05/01/2026
Items:
- AMS (Dry) Water Conditioner 50 BAG
- FullTec Adjuvant 20 GAL
		`;

		const result = parseIBAgSupply(rawIB);
		assert.equal(result.source, 'ib_ag_supply');
		assert.ok(result.items.length >= 2);
	});

	test('Master document parser auto-routes based on content signatures', () => {
		const bolText = 'BAYER CHANNEL STRAIGHT BILL OF LADING BOL/CMR NO: 123456 ORDER NO: 789012';
		const bolResult = parseDocumentPayload(bolText);
		assert.equal(bolResult.source, 'channel_bol');

		const wickmanText = 'WICKMAN CHEMICAL CO INVOICE VENTAS 30 GAL';
		const wickmanResult = parseDocumentPayload(wickmanText);
		assert.equal(wickmanResult.source, 'wickman_chemical');
	});
});

describe('Phase 2: Checkwriting Legal Number-To-Words Transformation', () => {
	test('Converts exact dollar and cents amounts to checkbook legal words', () => {
		assert.equal(
			amountToWords(1250.5),
			'One Thousand Two Hundred Fifty and 50/100 Dollars'
		);
		assert.equal(
			amountToWords(28900.0),
			'Twenty-Eight Thousand Nine Hundred and 00/100 Dollars'
		);
		assert.equal(
			amountToWords(0.75),
			'Zero and 75/100 Dollars'
		);
		assert.equal(
			amountToWords(1045230.15),
			'One Million Forty-Five Thousand Two Hundred Thirty and 15/100 Dollars'
		);
	});
});

describe('Phase 2: Hono Gateway Router & RBAC Validation', () => {
	test('Root health endpoint returns system status and capabilities', async () => {
		const res = await api.fetch(new Request('http://localhost/api/'));
		assert.equal(res.status, 200);
		const data = await res.json();
		assert.equal(data.status, 'healthy');
		assert.ok(data.modules.length >= 5);
	});

	test('Protected Checkwriting route blocks non-admin personas with 403 Forbidden', async () => {
		// Sales persona attempting to access Checkwriting
		const salesReq = new Request('http://localhost/api/checks', {
			headers: { 'x-user-role': 'sales' }
		});
		const salesRes = await api.fetch(salesReq);
		assert.equal(salesRes.status, 403, 'Sales persona must be blocked from Checkwriting');

		// Manager persona attempting to access Checkwriting
		const mgrReq = new Request('http://localhost/api/checks', {
			headers: { 'x-user-role': 'manager' }
		});
		const mgrRes = await api.fetch(mgrReq);
		assert.equal(mgrRes.status, 403, 'Manager persona must be blocked from Checkwriting');
	});

	test('Inventory write route blocks sales persona with 403 Forbidden', async () => {
		const writeReq = new Request('http://localhost/api/inventory', {
			method: 'POST',
			headers: {
				'content-type': 'application/json',
				'x-user-role': 'sales'
			},
			body: JSON.stringify({
				name: 'Unauthorized Product Creation',
				category: 'misc',
				costBasis: 10
			})
		});
		const res = await api.fetch(writeReq);
		assert.equal(res.status, 403, 'Sales persona must be blocked from creating products');
	});
});
