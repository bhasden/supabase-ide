import { describe, expect, it } from 'vitest';
import {
  formatValueForColumnInput,
  getColumnInputPlaceholder,
  getColumnInputType,
  getQueryBuilderDataType,
  isColumnInputComplete,
  normalizeColumnInputValue,
} from './column-input';

describe('column input helpers', () => {
  it('autoformats UUID input with dashes while typing or pasting', () => {
    expect(normalizeColumnInputValue('uuid', '84218236b0f54e8cb2d0890e8a47fe2a')).toBe(
      '84218236-b0f5-4e8c-b2d0-890e8a47fe2a'
    );
    expect(normalizeColumnInputValue('uuid', '84218236-b0f5')).toBe('84218236-b0f5');
    expect(normalizeColumnInputValue('uuid', '84218236-B0F5-zzzz-4E8C')).toBe(
      '84218236-b0f5-4e8c'
    );
  });

  it('uses native input types for structured column data', () => {
    expect(getColumnInputType('uuid')).toBe('text');
    expect(getColumnInputType('date')).toBe('date');
    expect(getColumnInputType('timestamptz')).toBe('text');
    expect(getColumnInputType('integer')).toBe('number');
  });

  it('provides visible format placeholders for structured inputs', () => {
    expect(getColumnInputPlaceholder('uuid')).toBe('xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx');
    expect(getColumnInputPlaceholder('timestamptz')).toBe('YYYY-MM-DDTHH:mm:ss+00:00');
    expect(getColumnInputPlaceholder('timestamp')).toBe('YYYY-MM-DDTHH:mm:ss');
    expect(getColumnInputPlaceholder('date')).toBe('YYYY-MM-DD');
  });

  it('formats stored date and timestamp values for native inputs', () => {
    expect(formatValueForColumnInput('date', '2026-03-30T05:26:34.421319+00:00')).toBe(
      '2026-03-30'
    );
    expect(
      formatValueForColumnInput('timestamptz', '2026-03-30T05:26:34.421319+00:00')
    ).toBe('2026-03-30T05:26:34+00:00');
    expect(formatValueForColumnInput('timestamp', '2026-03-30T05:26:34.421319')).toBe(
      '2026-03-30T05:26:34'
    );
  });

  it('keeps timestamp inputs constrained to four-digit years', () => {
    expect(normalizeColumnInputValue('timestamptz', '20260330052634')).toBe(
      '2026-03-30T05:26:34'
    );
    expect(normalizeColumnInputValue('timestamptz', '202603300526340000')).toBe(
      '2026-03-30T05:26:34+00:00'
    );
    expect(
      normalizeColumnInputValue('timestamptz', '2026-03-30T05:26:34.421319+00:00')
    ).toBe('2026-03-30T05:26:34+00:00');
    expect(normalizeColumnInputValue('timestamptz', '20260330052634-0400')).toBe(
      '2026-03-30T05:26:34-04:00'
    );
    expect(normalizeColumnInputValue('timestamptz', '2026-03-30T05:26:34+')).toBe(
      '2026-03-30T05:26:34+'
    );
    expect(normalizeColumnInputValue('timestamptz', '2026-03-30T05:26:34+00')).toBe(
      '2026-03-30T05:26:34+00'
    );
    expect(normalizeColumnInputValue('timestamptz', '2026-03-30T05:26:34+000')).toBe(
      '2026-03-30T05:26:34+00:0'
    );
  });

  it('allows manual timestamptz typing past minutes into seconds and offset', () => {
    expect(normalizeColumnInputValue('timestamptz', '2026-03-30T05:263')).toBe(
      '2026-03-30T05:26:3'
    );
    expect(normalizeColumnInputValue('timestamptz', '2026-03-30T05:26:34+0')).toBe(
      '2026-03-30T05:26:34+0'
    );
    expect(normalizeColumnInputValue('timestamptz', '2026-03-30T05:26:34+00:0')).toBe(
      '2026-03-30T05:26:34+00:0'
    );
    expect(normalizeColumnInputValue('timestamptz', '2026-03-30T05:26:34Z')).toBe(
      '2026-03-30T05:26:34Z'
    );
  });

  it('detects incomplete structured values before querying', () => {
    expect(isColumnInputComplete('uuid', '84218236-b0f5')).toBe(false);
    expect(isColumnInputComplete('uuid', '84218236-b0f5-4e8c-b2d0-890e8a47fe2a')).toBe(true);
    expect(
      isColumnInputComplete(
        'uuid',
        '84218236-b0f5-4e8c-b2d0-890e8a47fe2a, afec6569-8c0d-4b0b-92b2-681198a71339',
        'in'
      )
    ).toBe(true);
    expect(
      isColumnInputComplete(
        'uuid',
        '84218236-b0f5-4e8c-b2d0-890e8a47fe2a, afec6569',
        'in'
      )
    ).toBe(false);
    expect(isColumnInputComplete('timestamptz', '2026-03-30T05:26')).toBe(false);
    expect(isColumnInputComplete('timestamptz', '2026-03-30T05:26:34')).toBe(false);
    expect(isColumnInputComplete('timestamptz', '2026-03-30T05:26:34+00:00')).toBe(true);
    expect(isColumnInputComplete('timestamp', '2026-03-30T05:26:34')).toBe(true);
    expect(isColumnInputComplete('date', '2026-02-31')).toBe(false);
    expect(isColumnInputComplete('date', '2026-03-30')).toBe(true);
  });

  it('preserves structured query builder data types', () => {
    expect(getQueryBuilderDataType('uuid')).toBe('uuid');
    expect(getQueryBuilderDataType('timestamptz')).toBe('timestamptz');
    expect(getQueryBuilderDataType('boolean')).toBe('boolean');
    expect(getQueryBuilderDataType('numeric')).toBe('number');
  });
});
