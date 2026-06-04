export function getColumnInputType(dataType: string): string {
  if (isNumericColumnType(dataType)) return 'number';
  if (dataType === 'date') return 'date';
  return 'text';
}

export function getQueryBuilderDataType(columnType: string): string {
  if (isNumericColumnType(columnType)) return 'number';
  if (columnType === 'boolean') return 'boolean';
  if (columnType === 'uuid') return 'uuid';
  if (columnType === 'date') return 'date';
  if (columnType === 'timestamptz' || columnType === 'timestamp') return 'timestamptz';
  return 'text';
}

export function normalizeColumnInputValue(dataType: string, value: string): string {
  if (dataType === 'uuid') return formatUuidInput(value);
  if (dataType === 'timestamptz') return formatTimestampInput(value, true);
  if (dataType === 'timestamp') return formatTimestampInput(value, false);
  return value;
}

export function getColumnInputPlaceholder(dataType: string): string | undefined {
  if (dataType === 'uuid') return 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx';
  if (dataType === 'timestamptz') return 'YYYY-MM-DDTHH:mm:ss+00:00';
  if (dataType === 'timestamp') return 'YYYY-MM-DDTHH:mm:ss';
  if (dataType === 'date') return 'YYYY-MM-DD';
  return undefined;
}

export function formatValueForColumnInput(dataType: string, value: unknown): string {
  const text = String(value ?? '');

  if (dataType === 'uuid') return formatUuidInput(text);
  if (dataType === 'date') return text.match(/^\d{4}-\d{2}-\d{2}/)?.[0] ?? text;
  if (dataType === 'timestamptz') return formatTimestampInput(text, true);
  if (dataType === 'timestamp') return formatTimestampInput(text, false);

  return text;
}

export function isNumericColumnType(type: string): boolean {
  return ['integer', 'bigint', 'numeric', 'number', 'real', 'double precision'].includes(type);
}

export function isStructuredInputType(type: string): boolean {
  return type === 'uuid' || type === 'date' || type === 'timestamptz' || type === 'timestamp';
}

export function isColumnInputComplete(
  dataType: string | undefined,
  value: unknown,
  operator?: string
): boolean {
  const text = String(value ?? '').trim();
  if (!text) return true;

  if (dataType === 'uuid') {
    if (operator === 'in') {
      const values = text
        .split(',')
        .map((part) => part.trim())
        .filter(Boolean);

      return values.length > 0 && values.every(isCompleteUuid);
    }

    return isCompleteUuid(text);
  }

  if (dataType === 'date') {
    return isValidDateOnly(text);
  }

  if (dataType === 'timestamptz' || dataType === 'timestamp') {
    return dataType === 'timestamptz'
      ? isCompleteTimestampWithOffset(text)
      : isCompleteTimestamp(text);
  }

  return true;
}

function formatUuidInput(value: string): string {
  const hex = value.replace(/[^0-9a-f]/gi, '').slice(0, 32).toLowerCase();
  const groups = [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].filter(Boolean);

  return groups.join('-');
}

function formatTimestampInput(value: string, withOffset: boolean): string {
  const trimmed = value.trim();
  const shouldNormalizeIso =
    trimmed.includes('.') || /(?:Z|[+-]\d{2}:?\d{2})$/i.test(trimmed);
  const isoMatch = shouldNormalizeIso
    ? trimmed.match(
        /^(\d{4}-\d{2}-\d{2})[Tt ](\d{2}:\d{2})(?::(\d{2}))?(?:\.\d+)?(Z|[+-]\d{2}:?\d{2})?/
      )
    : null;

  if (isoMatch) {
    const timestamp = `${isoMatch[1]}T${isoMatch[2]}${isoMatch[3] ? `:${isoMatch[3]}` : ''}`;
    if (!withOffset) return timestamp;
    return `${timestamp}${normalizePartialOffset(isoMatch[4] ?? '')}`;
  }

  const digits = trimmed.replace(/\D/g, '').slice(0, withOffset ? 18 : 14);
  const year = digits.slice(0, 4);
  const month = digits.slice(4, 6);
  const day = digits.slice(6, 8);
  const hour = digits.slice(8, 10);
  const minute = digits.slice(10, 12);
  const second = digits.slice(12, 14);
  const offsetHour = digits.slice(14, 16);
  const offsetMinute = digits.slice(16, 18);
  const explicitOffsetSign = trimmed.match(/[+-](?=\d{0,2}:?\d{0,2}$)/)?.[0];
  const explicitUtcOffset = /Z$/i.test(trimmed);

  let next = year;
  if (month) next += `-${month}`;
  if (day) next += `-${day}`;
  if (hour) next += `T${hour}`;
  if (minute) next += `:${minute}`;
  if (second) next += `:${second}`;
  if (withOffset && explicitUtcOffset && second.length === 2) next += 'Z';
  if (withOffset && explicitOffsetSign && second.length === 2 && !offsetHour) {
    next += explicitOffsetSign;
  }
  if (withOffset && offsetHour) next += `${explicitOffsetSign ?? '+'}${offsetHour}`;
  if (withOffset && offsetMinute) next += `:${offsetMinute}`;

  return next;
}

function isCompleteUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

function isCompleteTimestamp(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(value)) return false;
  return Number.isFinite(Date.parse(value));
}

function isCompleteTimestampWithOffset(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(Z|[+-]\d{2}:\d{2})$/.test(value)) {
    return false;
  }

  return Number.isFinite(Date.parse(value));
}

function normalizePartialOffset(value: string): string {
  if (!value) return '';
  if (value === 'Z') return 'Z';

  const match = value.match(/^([+-])(\d{0,2}):?(\d{0,2})$/);
  if (!match) return '';

  const [, sign, hour, minute] = match;
  if (!hour) return sign;
  if (hour.length < 2) return `${sign}${hour}`;
  if (!minute) return `${sign}${hour}`;
  return `${sign}${hour}:${minute}`;
}

function isValidDateOnly(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

  const [year, month, day] = value.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));

  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  );
}
