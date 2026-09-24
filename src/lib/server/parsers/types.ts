import type { IngestionSource, ProductCategory } from '$lib/db/schema';

export interface ParsedItem {
	sku?: string;
	name: string;
	category: ProductCategory;
	quantity: number;
	unit: string;
	costBasis: number;
	packageSize?: number;

	// Chemical attributes
	chemicalType?: string;
	applicationMethod?: string;
	ratePerAcre?: string;
	epaRegNumber?: string;
	activeIngredients?: string;

	// Seed attributes
	seedTrait?: string;
	seedTreatment?: string;
	seedRelativeMaturity?: string;
	isRegulated?: boolean;
	lotNumber?: string;

	// Pricing tier defaults (suggested based on markup rules)
	financedAppPrice?: number;
	cashAppPrice?: number;
	carryPrice?: number;
}

export interface IowaComplianceTokens {
	bolNumber: string; // BOL/CMR Number
	orderNumber: string; // Order Number
	customerName?: string;
	destinationAddress?: string;
	lotNumbers?: string[];
	shipDate?: string;
	carrier?: string;
}

export interface DocumentParseResult {
	source: IngestionSource;
	vendorName: string;
	documentNumber?: string;
	documentDate?: string;
	items: ParsedItem[];
	totalCostBasis: number;
	iowaComplianceTokens?: IowaComplianceTokens;
	rawTextSummary: string;
	confidence: number;
}
