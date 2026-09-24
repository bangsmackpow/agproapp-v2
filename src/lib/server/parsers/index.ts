import type { DocumentParseResult } from './types';
import { parseChannelBOL } from './channel-bol';
import { parseWickmanChemical } from './wickman-chemical';
import { parseAtticus } from './atticus';
import { parseIBAgSupply } from './ib-ag-supply';
import type { IngestionSource } from '$lib/db/schema';

export * from './types';
export { parseChannelBOL, parseWickmanChemical, parseAtticus, parseIBAgSupply };

/**
 * Intelligent Document Routing and Parsing Engine:
 * Analyzes document text and metadata, detects vendor signatures,
 * and delegates to the appropriate specialized parser.
 */
export function parseDocumentPayload(
	rawText: string,
	sourceHint?: IngestionSource
): DocumentParseResult {
	const upper = rawText.toUpperCase();

	// Explicit hint provided
	if (sourceHint) {
		switch (sourceHint) {
			case 'channel_bol':
				return parseChannelBOL(rawText);
			case 'wickman_chemical':
				return parseWickmanChemical(rawText);
			case 'atticus':
				return parseAtticus(rawText);
			case 'ib_ag_supply':
				return parseIBAgSupply(rawText);
		}
	}

	// Automatic signature detection
	if (
		upper.includes('CHANNEL') ||
		upper.includes('BAYER CROPSCIENCE') ||
		upper.includes('STRAIGHT BILL OF LADING') ||
		upper.includes('BOL/CMR') ||
		upper.includes('SEED ORDER')
	) {
		return parseChannelBOL(rawText);
	}

	if (upper.includes('WICKMAN') || upper.includes('VENTAS') || upper.includes('TENKOZ')) {
		return parseWickmanChemical(rawText);
	}

	if (upper.includes('ATTICUS') || upper.includes('ACADIA') || upper.includes('EPA REG')) {
		return parseAtticus(rawText);
	}

	if (upper.includes('I & B AG') || upper.includes('IB AG') || upper.includes('FULLTEC')) {
		return parseIBAgSupply(rawText);
	}

	// Default fallback to Channel BOL if compliance patterns are spotted, otherwise generic Wickman
	if (/(?:BOL|CMR|ORDER NO)/i.test(rawText)) {
		return parseChannelBOL(rawText);
	}

	return parseWickmanChemical(rawText);
}
