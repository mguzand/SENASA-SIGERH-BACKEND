const UNITS = [
  '',
  'UNO',
  'DOS',
  'TRES',
  'CUATRO',
  'CINCO',
  'SEIS',
  'SIETE',
  'OCHO',
  'NUEVE',
];

const SPECIAL_NUMBERS: Record<number, string> = {
  10: 'DIEZ',
  11: 'ONCE',
  12: 'DOCE',
  13: 'TRECE',
  14: 'CATORCE',
  15: 'QUINCE',
  16: 'DIECISÉIS',
  17: 'DIECISIETE',
  18: 'DIECIOCHO',
  19: 'DIECINUEVE',
  20: 'VEINTE',
  21: 'VEINTIUNO',
  22: 'VEINTIDÓS',
  23: 'VEINTITRÉS',
  24: 'VEINTICUATRO',
  25: 'VEINTICINCO',
  26: 'VEINTISÉIS',
  27: 'VEINTISIETE',
  28: 'VEINTIOCHO',
  29: 'VEINTINUEVE',
};

const TENS = [
  '',
  '',
  'VEINTE',
  'TREINTA',
  'CUARENTA',
  'CINCUENTA',
  'SESENTA',
  'SETENTA',
  'OCHENTA',
  'NOVENTA',
];

const HUNDREDS = [
  '',
  'CIENTO',
  'DOSCIENTOS',
  'TRESCIENTOS',
  'CUATROCIENTOS',
  'QUINIENTOS',
  'SEISCIENTOS',
  'SETECIENTOS',
  'OCHOCIENTOS',
  'NOVECIENTOS',
];

function underOneHundred(value: number): string {
  if (value < 10) return UNITS[value];
  if (value < 30) return SPECIAL_NUMBERS[value];

  const tens = Math.floor(value / 10);
  const units = value % 10;

  return units ? `${TENS[tens]} Y ${UNITS[units]}` : TENS[tens];
}

function underOneThousand(value: number): string {
  if (value === 100) return 'CIEN';
  if (value < 100) return underOneHundred(value);

  const hundreds = Math.floor(value / 100);
  const remainder = value % 100;

  return remainder
    ? `${HUNDREDS[hundreds]} ${underOneHundred(remainder)}`
    : HUNDREDS[hundreds];
}

export function numberToSpanishWords(value: number): string {
  const number = Math.trunc(Number(value));

  if (!Number.isFinite(number) || number < 0) {
    throw new Error('El valor debe ser un número positivo válido.');
  }
  if (number === 0) return 'CERO';
  if (number < 1000) return underOneThousand(number);

  if (number < 1_000_000) {
    const thousands = Math.floor(number / 1000);
    const remainder = number % 1000;
    const prefix =
      thousands === 1
        ? 'MIL'
        : `${apocopateOne(numberToSpanishWords(thousands))} MIL`;

    return remainder ? `${prefix} ${underOneThousand(remainder)}` : prefix;
  }

  if (number < 1_000_000_000) {
    const millions = Math.floor(number / 1_000_000);
    const remainder = number % 1_000_000;
    const prefix =
      millions === 1
        ? 'UN MILLÓN'
        : `${apocopateOne(numberToSpanishWords(millions))} MILLONES`;

    return remainder ? `${prefix} ${numberToSpanishWords(remainder)}` : prefix;
  }

  throw new Error('El valor excede el límite soportado de 999,999,999.');
}

function apocopateOne(words: string): string {
  return words
    .replace(/VEINTIUNO$/, 'VEINTIÚN')
    .replace(/ Y UNO$/, ' Y UN')
    .replace(/UNO$/, 'UN');
}

export function numberToLempirasWords(value: number): string {
  const amount = Number(value);

  if (!Number.isFinite(amount) || amount < 0) {
    throw new Error('El monto debe ser un número positivo válido.');
  }

  let integerPart = Math.floor(amount);
  let cents = Math.round((amount - integerPart) * 100);

  if (cents === 100) {
    integerPart += 1;
    cents = 0;
  }

  const currency = integerPart === 1 ? 'LEMPIRA' : 'LEMPIRAS';
  const words =
    integerPart === 1 ? 'UNA' : apocopateOne(numberToSpanishWords(integerPart));

  return cents === 0
    ? `${words} ${currency} EXACTOS`
    : `${words} ${currency} CON ${String(cents).padStart(2, '0')}/100`;
}
