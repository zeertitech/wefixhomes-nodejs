const MONEY_PATTERN = /^(\d{1,8})(?:\.(\d{1,2}))?$/;

export interface Money {
  /** Non-negative integer paise. Avoids binary floating point for INR. */
  paise: number;
  /** Canonical rupee string with two decimal places. */
  amount: string;
}

export function parseMoney(value: string): Money | null {
  const match = MONEY_PATTERN.exec(value.trim());
  if (!match) return null;
  const whole = Number(match[1]);
  const fraction = Number((match[2] ?? '').padEnd(2, '0'));
  if (!Number.isSafeInteger(whole) || !Number.isSafeInteger(fraction)) return null;
  const paise = whole * 100 + fraction;
  return { paise, amount: `${whole}.${String(fraction).padStart(2, '0')}` };
}

/**
 * Display-only offer. Returns null when MRP is zero so callers never divide by zero.
 * Not a stored price and not a booking quote.
 */
export function offerPercent(mrpPaise: number, sellingPaise: number): number | null {
  if (!Number.isInteger(mrpPaise) || !Number.isInteger(sellingPaise)) return null;
  if (mrpPaise <= 0 || sellingPaise < 0 || sellingPaise > mrpPaise) return null;
  return Math.round(((mrpPaise - sellingPaise) * 100) / mrpPaise);
}

export function decimalToAmount(value: { toFixed(digits: number): string } | string | number): string {
  if (typeof value === 'number') {
    const parsed = parseMoney(value.toFixed(2));
    if (!parsed) throw new Error('Invalid decimal amount');
    return parsed.amount;
  }
  const raw = typeof value === 'string' ? value : value.toFixed(2);
  const parsed = parseMoney(raw);
  if (!parsed) throw new Error('Invalid decimal amount');
  return parsed.amount;
}
