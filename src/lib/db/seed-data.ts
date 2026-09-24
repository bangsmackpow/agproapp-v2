import type { Database } from '$lib/server/db';
import {
	users,
	accounts,
	customers,
	vendors,
	products,
	droneUnits,
	checkSequences,
	iowaComplianceLogs
} from './schema';
import { eq } from 'drizzle-orm';
import { hashPassword } from '$lib/server/crypto';

export const INITIAL_USER_ACCOUNTS = [
	{
		id: 'usr_admin_01',
		name: 'Curtis Vance (Owner/Admin)',
		email: 'admin@agpro.iowa',
		role: 'admin' as const,
		initialPassword: 'AgPro2026!Admin'
	},
	{
		id: 'usr_mgr_01',
		name: 'Sarah Lindqvist (Operations Mgr)',
		email: 'manager@agpro.iowa',
		role: 'manager' as const,
		initialPassword: 'AgPro2026!Mgr'
	},
	{
		id: 'usr_sales_01',
		name: 'Jake Miller (Field Sales Rep)',
		email: 'sales@agpro.iowa',
		role: 'sales' as const,
		initialPassword: 'AgPro2026!Sales'
	}
];

export async function seedInitialData(db: Database) {
	// 1. Seed Default Users & Initial Credential Accounts
	for (const acc of INITIAL_USER_ACCOUNTS) {
		const existingUser = await db.query.users.findFirst({
			where: eq(users.id, acc.id)
		});

		if (!existingUser) {
			await db.insert(users).values({
				id: acc.id,
				name: acc.name,
				email: acc.email,
				role: acc.role,
				status: 'active',
				emailVerified: true
			});
		}

		const existingAccount = await db.query.accounts.findFirst({
			where: eq(accounts.userId, acc.id)
		});

		if (!existingAccount) {
			const hashedPassword = await hashPassword(acc.initialPassword);
			await db.insert(accounts).values({
				id: `acc_${acc.id}`,
				userId: acc.id,
				accountId: acc.email,
				providerId: 'credential',
				password: hashedPassword
			});
		}
	}

	// 2. Seed Default Vendors
	const existingWickman = await db.query.vendors.findFirst({
		where: eq(vendors.name, 'Wickman Chemical')
	});

	let wickmanId = 'vnd_wickman_01';
	let atticusId = 'vnd_atticus_01';
	let ibAgId = 'vnd_ibag_01';
	let channelSeedId = 'vnd_channel_01';

	if (!existingWickman) {
		await db.insert(vendors).values([
			{
				id: wickmanId,
				name: 'Wickman Chemical',
				vendorCode: 'WICK-01',
				contactName: 'Dennis Wickman',
				email: 'orders@wickmanchem.com',
				phone: '(712) 555-0199',
				address: 'Atlantic, IA 50022',
				paymentTerms: 'Pre-Pay Early Discount'
			},
			{
				id: atticusId,
				name: 'Atticus LLC',
				vendorCode: 'ATT-01',
				contactName: 'Regional Agronomy Rep',
				email: 'agorders@atticusllc.com',
				phone: '(919) 555-0144',
				address: 'Research Triangle Park, NC',
				paymentTerms: 'Net 30'
			},
			{
				id: ibAgId,
				name: 'I & B Ag Supply',
				vendorCode: 'IB-01',
				contactName: 'Brian Iverson',
				email: 'supplies@ibagsupply.com',
				phone: '(515) 555-0177',
				address: 'Webster City, IA 50595',
				paymentTerms: 'Net 30'
			},
			{
				id: channelSeedId,
				name: 'Channel Seed / Bayer CropScience',
				vendorCode: 'CHAN-01',
				contactName: 'Channel Seed District Sales Mgr',
				email: 'orders@channelseeds.com',
				phone: '(800) 555-0133',
				address: 'Ankeny Distribution Hub, Ankeny, IA 50021',
				paymentTerms: 'Crop Year Settlement'
			}
		]);
	}

	// 3. Seed Default Customers (Iowa Farmers)
	const existingCust = await db.query.customers.findFirst();
	let cust1Id = 'cst_prairie_01';
	let cust2Id = 'cst_heartland_02';

	if (!existingCust) {
		await db.insert(customers).values([
			{
				id: cust1Id,
				name: 'Prairie Ridge Farms LLC',
				farmName: 'Prairie Ridge Farms',
				contactPerson: 'Caleb Henderson',
				email: 'caleb@prairieridgefarms.net',
				phone: '(515) 555-3821',
				billingAddress: '14228 290th St',
				shippingAddress: '14228 290th St, Shop #2',
				county: 'Story',
				state: 'IA',
				zipCode: '50010',
				creditLimit: 75000,
				balance: 14250,
				status: 'active'
			},
			{
				id: cust2Id,
				name: 'Boone River Agri Corp',
				farmName: 'Boone River Farms',
				contactPerson: 'Dennis Albright',
				email: 'dennis@booneriver.com',
				phone: '(515) 555-9012',
				billingAddress: '401 E 2nd St',
				shippingAddress: 'Section 14 Farm Road Staging Point',
				county: 'Hamilton',
				state: 'IA',
				zipCode: '50595',
				creditLimit: 120000,
				balance: 0,
				status: 'active'
			}
		]);
	}

	// 4. Seed Chemical Products (From chemical_inventory.xlsx)
	const existingProduct = await db.query.products.findFirst();
	if (!existingProduct) {
		await db.insert(products).values([
			// Chemical Products from chemical_inventory.xlsx
			{
				id: 'prd_ventas_01',
				sku: 'CHEM-VENTAS-GL',
				name: 'Ventas Herbicide Premix',
				category: 'chemical',
				vendorId: wickmanId,
				description: 'Selective post-emergence weed control for Iowa field corn.',
				unit: 'gallon',
				packageSize: 2.5,
				costBasis: 18.5,
				financedAppPrice: 38.5, // High Margin Financed Application
				cashAppPrice: 34.0, // Standard Margin Cash Application
				carryPrice: 22.5, // Low/Flat Margin Carry
				chemicalType: 'Corn',
				applicationMethod: 'Single',
				ratePerAcre: '32 oz',
				costPerAcre: 4.63,
				currentStock: 180,
				reorderThreshold: 40
			},
			{
				id: 'prd_tenkoz_01',
				sku: 'CHEM-TENKOZ-GL',
				name: 'Tenkoz 4L Atrazine Flowable',
				category: 'chemical',
				vendorId: wickmanId,
				description: 'Liquid atrazine flowable for corn pre and early post weed suppression.',
				unit: 'gallon',
				packageSize: 2.5,
				costBasis: 22.0,
				financedAppPrice: 42.0,
				cashAppPrice: 37.5,
				carryPrice: 25.5,
				chemicalType: 'Corn',
				applicationMethod: 'Single',
				ratePerAcre: '48 oz',
				costPerAcre: 8.25,
				currentStock: 240,
				reorderThreshold: 50
			},
			{
				id: 'prd_nano_01',
				sku: 'CHEM-NANO-OZ',
				name: 'Nano Penetrant Adjuvant',
				category: 'chemical',
				vendorId: wickmanId,
				description: 'Ultra-low volume droplet retention adjuvant formulated for aerial drone spray systems.',
				unit: 'bottle',
				packageSize: 1.0,
				costBasis: 45.0,
				financedAppPrice: 72.0,
				cashAppPrice: 65.0,
				carryPrice: 52.0,
				chemicalType: 'Corn / Bean',
				applicationMethod: 'Single',
				ratePerAcre: '1 oz',
				costPerAcre: 2.81,
				currentStock: 65,
				reorderThreshold: 15
			},
			{
				id: 'prd_xsate_01',
				sku: 'CHEM-XSATE-GL',
				name: 'Xsate 53.8% Glyphosate Concentrate',
				category: 'chemical',
				vendorId: wickmanId,
				description: 'High-load glyphosate burndown and over-the-top application.',
				unit: 'gallon',
				packageSize: 2.5,
				costBasis: 29.5,
				financedAppPrice: 51.5,
				cashAppPrice: 46.0,
				carryPrice: 33.5,
				chemicalType: 'Corn / Bean Pre',
				applicationMethod: 'Dual / E3',
				ratePerAcre: '32 oz',
				costPerAcre: 7.38,
				currentStock: 350,
				reorderThreshold: 80
			},
			{
				id: 'prd_enlist_01',
				sku: 'CHEM-ENLIST-GL',
				name: 'ENLIST ONE 2,4-D Choline',
				category: 'chemical',
				vendorId: atticusId,
				description: 'Straight-goods 2,4-D choline for Enlist E3 soybeans with low drift profile.',
				unit: 'gallon',
				packageSize: 2.5,
				costBasis: 48.0,
				financedAppPrice: 74.0,
				cashAppPrice: 66.5,
				carryPrice: 54.0,
				chemicalType: 'Bean Post',
				applicationMethod: 'E3',
				ratePerAcre: '32 oz',
				costPerAcre: 12.0,
				epaRegNumber: '62719-695',
				currentStock: 140,
				reorderThreshold: 30
			},
			{
				id: 'prd_interline_01',
				sku: 'CHEM-INTERLINE-GL',
				name: 'Interline (Liberty) Glufosinate',
				category: 'chemical',
				vendorId: wickmanId,
				description: 'Broad-spectrum post-emergence glufosinate herbicide.',
				unit: 'gallon',
				packageSize: 2.5,
				costBasis: 34.0,
				financedAppPrice: 58.0,
				cashAppPrice: 51.0,
				carryPrice: 38.5,
				chemicalType: 'Bean Post',
				applicationMethod: 'E3 / Flex',
				ratePerAcre: '32 oz',
				costPerAcre: 8.5,
				currentStock: 200,
				reorderThreshold: 45
			},

			// Seed Inventory (With Iowa Compliance / Regulated Trait)
			{
				id: 'prd_seed_ch209_01',
				sku: 'SEED-CH-20915-VT2P',
				name: 'Channel 209-15 VT2P RIB Corn Seed',
				category: 'seed',
				vendorId: channelSeedId,
				description: '109 RM high-yielding drought-tolerant corn seed with Genuity VT Double PRO.',
				unit: 'bag',
				packageSize: 80000,
				costBasis: 285.0,
				financedAppPrice: 365.0, // Includes aerial cover crop or granular fertilizing pairing
				cashAppPrice: 335.0,
				carryPrice: 305.0,
				seedTrait: 'VT Double PRO / RIB Complete',
				seedTreatment: 'Acceleron Elite 500',
				seedRelativeMaturity: '109 RM',
				isRegulated: true, // Trigger Iowa BOL compliance check
				currentStock: 450,
				reorderThreshold: 50
			},
			{
				id: 'prd_seed_ch2420_01',
				sku: 'SEED-CH-2420-E3',
				name: 'Channel 2420RX Enlist E3 Soybeans',
				category: 'seed',
				vendorId: channelSeedId,
				description: '2.4 RM Enlist E3 soybeans with high SCN resistance and excellent emergence.',
				unit: 'unit',
				packageSize: 140000,
				costBasis: 62.0,
				financedAppPrice: 84.0,
				cashAppPrice: 76.0,
				carryPrice: 68.0,
				seedTrait: 'Enlist E3 / STS',
				seedTreatment: 'Acceleron Standard',
				seedRelativeMaturity: '2.4 RM',
				isRegulated: true,
				currentStock: 600,
				reorderThreshold: 100
			},

			// Drone Hardware Inventory
			{
				id: 'prd_drone_t50_01',
				sku: 'DRONE-DJI-T50-SYS',
				name: 'DJI Agras T50 Agricultural Drone Package',
				category: 'drone',
				vendorId: ibAgId,
				description: 'Flagship dual-atomizing centrifugal drone system with 50kg spreading / 40kg spraying.',
				unit: 'system',
				packageSize: 1,
				costBasis: 21500.0,
				financedAppPrice: 28900.0, // Financed with flight training & setup
				cashAppPrice: 26500.0, // Cash purchase with dealer onboarding
				carryPrice: 24800.0, // Crated pickup
				droneModel: 'DJI Agras T50',
				payloadCapacityKg: 50.0,
				swathWidthMeters: 11.0,
				currentStock: 4,
				reorderThreshold: 1
			},

			// MISC Hardware & Shop Supplies
			{
				id: 'prd_misc_nozzle_01',
				sku: 'MISC-T50-NOZZLE-SET',
				name: 'DJI Agras T50 Centrifugal Spray Disc Assembly',
				category: 'misc',
				vendorId: ibAgId,
				description: 'Replacement high-speed centrifugal atomizing nozzle set (Pair).',
				unit: 'pair',
				packageSize: 1,
				costBasis: 145.0,
				financedAppPrice: 220.0,
				cashAppPrice: 195.0,
				carryPrice: 175.0,
				currentStock: 12,
				reorderThreshold: 3
			}
		]);

		// Seed Serialized Drone Fleet
		await db.insert(droneUnits).values([
			{
				id: 'drn_t50_sn101',
				productId: 'prd_drone_t50_01',
				serialNumber: 'DJI-T50-IA-990142',
				aircraftRegistration: 'FA3948K91',
				remoteControlSerial: 'RC-T50-9901',
				batterySerialNumbers: JSON.stringify(['DB1560-A101', 'DB1560-A102']),
				flightHoursTotal: 14.5,
				firmwareVersion: 'v01.03.0420',
				condition: 'demo',
				notes: 'Primary demo drone unit used for Iowa Farm Progress Show.'
			},
			{
				id: 'drn_t50_sn102',
				productId: 'prd_drone_t50_01',
				serialNumber: 'DJI-T50-IA-990288',
				aircraftRegistration: 'FA4109M22',
				remoteControlSerial: 'RC-T50-9902',
				batterySerialNumbers: JSON.stringify(['DB1560-B201', 'DB1560-B202', 'DB1560-B203']),
				flightHoursTotal: 0.0,
				firmwareVersion: 'v01.03.0420',
				condition: 'new',
				notes: 'Brand new in crate ready for customer delivery.'
			}
		]);
	}

	// 5. Seed Check Sequences for Checkwriting Module
	const existingSeq = await db.query.checkSequences.findFirst();
	if (!existingSeq) {
		await db.insert(checkSequences).values({
			id: 'primary_operating_account',
			accountName: 'AgPro Primary Operating (Iowa State Bank)',
			nextCheckNumber: 1045
		});
	}

	// 6. Seed an Initial Iowa Compliance Log (Benchmark Seed Audit Proof)
	const existingCompliance = await db.query.iowaComplianceLogs.findFirst();
	if (!existingCompliance) {
		await db.insert(iowaComplianceLogs).values({
			id: 'log_ia_compliance_001',
			customerId: cust1Id,
			bolNumber: 'CH-BOL-884912',
			orderNumber: 'ORD-BAY-552190',
			regulatedProduct: 'Channel 209-15 VT2P RIB Corn Seed',
			cropType: 'Corn',
			lotNumber: 'LOT-CH209-IA24',
			treatmentTag: 'Acceleron Elite 500 w/ Poncho VOTiVO',
			quantity: 120,
			unit: 'bag',
			verifiedByUserId: 'usr_admin_01',
			complianceStatus: 'verified',
			auditNotes: 'State of Iowa IDALS Seed Audit verified. Cross-referenced with Channel Straight BOL shipping document.'
		});
	}
}
