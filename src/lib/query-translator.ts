import type { RuleGroupType } from 'react-querybuilder';
import type { SupabaseClient } from '@supabase/supabase-js';

type PostgrestFilterBuilder = ReturnType<
  ReturnType<SupabaseClient['from']>['select']
>;

const OPERATOR_MAP: Record<string, string> = {
  '=': 'eq',
  '!=': 'neq',
  '>': 'gt',
  '<': 'lt',
  '>=': 'gte',
  '<=': 'lte',
  like: 'like',
  'contains': 'like',
  'beginsWith': 'like',
  'endsWith': 'like',
  in: 'in',
  isNull: 'is',
  isNotNull: 'is',
  isEmpty: 'eq',
  isNotEmpty: 'neq',
};

function applyOperatorsToColumn(
  builder: PostgrestFilterBuilder,
  field: string,
  operator: string,
  value: unknown
): PostgrestFilterBuilder {
  const pgOp = OPERATOR_MAP[operator];

  if (!pgOp) return builder;

  switch (operator) {
    case '=':
      return builder.eq(field, value as string | number | boolean);
    case '!=':
      return builder.neq(field, value as string | number | boolean);
    case '>':
      return builder.gt(field, value as string | number);
    case '<':
      return builder.lt(field, value as string | number);
    case '>=':
      return builder.gte(field, value as string | number);
    case '<=':
      return builder.lte(field, value as string | number);
    case 'like':
      return builder.like(field, value as string);
    case 'contains':
      return builder.ilike(field, `%${value}%`);
    case 'beginsWith':
      return builder.ilike(field, `${value}%`);
    case 'endsWith':
      return builder.ilike(field, `%${value}`);
    case 'in': {
      const vals = Array.isArray(value) ? value : String(value).split(',').map((s) => s.trim());
      return builder.in(field, vals as string[]);
    }
    case 'isNull':
      return builder.is(field, null);
    case 'isNotNull':
      return builder.not(field, 'is', null as unknown as string);
    case 'isEmpty':
      return builder.eq(field, '');
    case 'isNotEmpty':
      return builder.neq(field, '');
    default:
      return builder;
  }
}

type QueryableBuilder = {
  select: (cols: string, opts?: { count: 'exact' | 'planned' | 'estimated' }) => PostgrestFilterBuilder;
};

export function applyQueryRules(
  baseQuery: QueryableBuilder,
  rules: RuleGroupType,
  selectCols = '*',
  count: 'exact' | 'planned' | 'estimated' = 'exact'
): PostgrestFilterBuilder {
  let builder = baseQuery.select(selectCols, { count });

  if (rules.combinator === 'or') {
    const orParts: string[] = [];
    for (const rule of rules.rules) {
      if ('rules' in rule) continue; // skip nested groups for OR
      const r = rule as { field: string; operator: string; value: unknown };
      const pgOp = OPERATOR_MAP[r.operator];
      if (!pgOp) continue;
      if (r.operator === 'contains') {
        orParts.push(`${r.field}.ilike.%${r.value}%`);
      } else if (r.operator === 'beginsWith') {
        orParts.push(`${r.field}.ilike.${r.value}%`);
      } else if (r.operator === 'endsWith') {
        orParts.push(`${r.field}.ilike.%${r.value}`);
      } else if (r.operator === 'isNull') {
        orParts.push(`${r.field}.is.null`);
      } else if (r.operator === 'isNotNull') {
        orParts.push(`${r.field}.not.is.null`);
      } else if (r.operator === 'in') {
        const vals = Array.isArray(r.value) ? r.value : String(r.value).split(',').map((s) => s.trim());
        orParts.push(`${r.field}.in.(${vals.join(',')})`);
      } else {
        orParts.push(`${r.field}.${pgOp}.${r.value}`);
      }
    }
    if (orParts.length > 0) {
      builder = builder.or(orParts.join(','));
    }
  } else {
    for (const rule of rules.rules) {
      if ('rules' in rule) continue;
      const r = rule as { field: string; operator: string; value: unknown };
      builder = applyOperatorsToColumn(builder, r.field, r.operator, r.value) as PostgrestFilterBuilder;
    }
  }

  return builder as PostgrestFilterBuilder;
}
