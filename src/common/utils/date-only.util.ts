export function normalizeDateOnlyString(value: unknown): string | null {
  if (!value) return null;

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(
      value.getDate(),
    ).padStart(2, '0')}`;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;

    const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      return `${match[1]}-${match[2]}-${match[3]}`;
    }

    const parsed = new Date(trimmed);
    return Number.isNaN(parsed.getTime()) ? null : normalizeDateOnlyString(parsed);
  }

  return null;
}

export function serializeDateOnly(value: unknown): string | null {
  const normalized = normalizeDateOnlyString(value);
  return normalized ? `${normalized}T12:00:00.000Z` : null;
}

export function parseDateOnly(value: unknown): Date | null {
  const normalized = normalizeDateOnlyString(value);
  if (!normalized) return null;

  const [year, month, day] = normalized.split('-').map(Number);
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}
