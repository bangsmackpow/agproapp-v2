/**
 * Converts numeric currency amount into formal legal English words
 * for bank check writing.
 * Example: 1450.75 -> "One Thousand Four Hundred Fifty and 75/100 Dollars"
 */
export function amountToWords(amount: number): string {
	if (isNaN(amount) || amount < 0) return 'Zero and 00/100 Dollars';

	const dollars = Math.floor(amount);
	const cents = Math.round((amount - dollars) * 100);

	const ones = [
		'',
		'One',
		'Two',
		'Three',
		'Four',
		'Five',
		'Six',
		'Seven',
		'Eight',
		'Nine',
		'Ten',
		'Eleven',
		'Twelve',
		'Thirteen',
		'Fourteen',
		'Fifteen',
		'Sixteen',
		'Seventeen',
		'Eighteen',
		'Nineteen'
	];

	const tens = [
		'',
		'',
		'Twenty',
		'Thirty',
		'Forty',
		'Fifty',
		'Sixty',
		'Seventy',
		'Eighty',
		'Ninety'
	];

	function convertGroup(n: number): string {
		let str = '';
		if (n >= 100) {
			str += ones[Math.floor(n / 100)] + ' Hundred ';
			n %= 100;
		}
		if (n >= 20) {
			str += tens[Math.floor(n / 10)] + (n % 10 > 0 ? '-' + ones[n % 10] : '') + ' ';
		} else if (n > 0) {
			str += ones[n] + ' ';
		}
		return str.trim();
	}

	if (dollars === 0) {
		return `Zero and ${cents.toString().padStart(2, '0')}/100 Dollars`;
	}

	let words = '';
	const billions = Math.floor(dollars / 1000000000);
	const millions = Math.floor((dollars % 1000000000) / 1000000);
	const thousands = Math.floor((dollars % 1000000) / 1000);
	const remainder = dollars % 1000;

	if (billions > 0) {
		words += convertGroup(billions) + ' Billion ';
	}
	if (millions > 0) {
		words += convertGroup(millions) + ' Million ';
	}
	if (thousands > 0) {
		words += convertGroup(thousands) + ' Thousand ';
	}
	if (remainder > 0) {
		words += convertGroup(remainder) + ' ';
	}

	const centsString = cents.toString().padStart(2, '0');
	return `${words.trim()} and ${centsString}/100 Dollars`;
}
