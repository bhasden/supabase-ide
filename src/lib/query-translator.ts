import type { RuleGroupType } from 'react-querybuilder';
import type { SupabaseClient } from '@supabase/supabase-js';
import { isColumnInputComplete } from './column-input';

type PostgrestFilterBuilder = ReturnType<
  ReturnType<SupabaseClient['from']>['select']
>;

type QueryableBuilder = {
  select: (cols: string, opts?: { count: 'exact' | 'planned' | 'estimated' }) => PostgrestFilterBuilder;
};

type RuleNode = RuleGroupType['rules'][number];
type FieldDataTypes = Record<string, string | undefined>;

type QueryRule = {
  field?: string;
  operator?: string;
  value?: unknown;
};

export type FilterParam = {
  key: string;
  value: string;
};

export const SUPPORTED_OPERATORS = [
  { name: '=', label: '=' },
  { name: '!=', label: '!=' },
  { name: '>', label: '>' },
  { name: '<', label: '<' },
  { name: '>=', label: '>=' },
  { name: '<=', label: '<=' },
  { name: 'contains', label: 'contains' },
  { name: 'beginsWith', label: 'begins with' },
  { name: 'endsWith', label: 'ends with' },
  { name: 'in', label: 'in' },
  { name: 'isNull', label: 'is null' },
  { name: 'isNotNull', label: 'is not null' },
  { name: 'isEmpty', label: 'is empty' },
  { name: 'isNotEmpty', label: 'is not empty' },
];

export const VALUELESS_OPERATORS = new Set([
  'isNull',
  'isNotNull',
  'isEmpty',
  'isNotEmpty',
]);

const POSTGREST_OPERATOR: Record<string, string> = {
  '=': 'eq',
  '!=': 'neq',
  '>': 'gt',
  '<': 'lt',
  '>=': 'gte',
  '<=': 'lte',
  contains: 'ilike',
  beginsWith: 'ilike',
  endsWith: 'ilike',
  in: 'in',
  isNull: 'is',
  isNotNull: 'not.is',
  isEmpty: 'eq',
  isNotEmpty: 'neq',
};

function isRuleGroup(rule: RuleNode): rule is RuleGroupType {
  return typeof rule === 'object' && rule !== null && 'rules' in rule;
}

function hasRuleValue(rule: QueryRule, fieldTypes: FieldDataTypes = {}): boolean {
  if (VALUELESS_OPERATORS.has(rule.operator ?? '')) return true;
  if (rule.value === undefined || rule.value === null || String(rule.value).length === 0) {
    return false;
  }

  if (!rule.field) return true;
  return isColumnInputComplete(fieldTypes[rule.field], rule.value, rule.operator);
}

function coerceScalarValue(value: unknown, dataType?: string): string | number | boolean {
  if (dataType === 'boolean') {
    if (value === true || value === 'true') return true;
    if (value === false || value === 'false') return false;
  }

  if (dataType === 'number') {
    const numeric = Number(value);
    if (Number.isFinite(numeric)) return numeric;
  }

  return String(value);
}

export function coerceRuleValue(
  value: unknown,
  dataType?: string,
  operator?: string
): string | number | boolean | Array<string | number | boolean> | null {
  if (operator === 'isNull' || operator === 'isNotNull') return null;
  if (operator === 'isEmpty' || operator === 'isNotEmpty') return '';

  if (operator === 'in') {
    const values = Array.isArray(value)
      ? value
      : String(value)
          .split(',')
          .map((part) => part.trim())
          .filter(Boolean);

    return values.map((part) => coerceScalarValue(part, dataType));
  }

  return coerceScalarValue(value, dataType);
}

function formatValueForPostgrest(
  value: unknown,
  dataType?: string,
  operator?: string
): string {
  const coerced = coerceRuleValue(value, dataType, operator);

  if (Array.isArray(coerced)) {
    return `(${coerced.map((part) => String(part)).join(',')})`;
  }

  return String(coerced ?? '');
}

function formatRuleExpression(rule: QueryRule, fieldTypes: FieldDataTypes = {}): string | null {
  if (!rule.field || !rule.operator || !hasRuleValue(rule, fieldTypes)) return null;

  const pgOperator = POSTGREST_OPERATOR[rule.operator];
  if (!pgOperator) return null;

  const dataType = fieldTypes[rule.field];

  switch (rule.operator) {
    case 'contains':
      return `${rule.field}.ilike.*${formatValueForPostgrest(rule.value, dataType, rule.operator)}*`;
    case 'beginsWith':
      return `${rule.field}.ilike.${formatValueForPostgrest(rule.value, dataType, rule.operator)}*`;
    case 'endsWith':
      return `${rule.field}.ilike.*${formatValueForPostgrest(rule.value, dataType, rule.operator)}`;
    case 'isNull':
      return `${rule.field}.is.null`;
    case 'isNotNull':
      return `${rule.field}.not.is.null`;
    default:
      return `${rule.field}.${pgOperator}.${formatValueForPostgrest(rule.value, dataType, rule.operator)}`;
  }
}

function formatGroupExpression(group: RuleGroupType, fieldTypes: FieldDataTypes = {}): string | null {
  const expressions = group.rules
    .map((rule) => {
      if (isRuleGroup(rule)) {
        const child = formatGroupExpression(rule, fieldTypes);
        if (!child) return null;
        return `${rule.combinator}(${child})`;
      }

      return formatRuleExpression(rule as QueryRule, fieldTypes);
    })
    .filter((expr): expr is string => Boolean(expr));

  if (expressions.length === 0) return null;
  return expressions.join(',');
}

function applyRuleToBuilder(
  builder: PostgrestFilterBuilder,
  rule: QueryRule,
  fieldTypes: FieldDataTypes = {}
): PostgrestFilterBuilder {
  if (!rule.field || !rule.operator || !hasRuleValue(rule, fieldTypes)) return builder;

  const dataType = fieldTypes[rule.field];
  const value = coerceRuleValue(rule.value, dataType, rule.operator);

  switch (rule.operator) {
    case '=':
      return builder.eq(rule.field, value as string | number | boolean);
    case '!=':
      return builder.neq(rule.field, value as string | number | boolean);
    case '>':
      return builder.gt(rule.field, value as string | number);
    case '<':
      return builder.lt(rule.field, value as string | number);
    case '>=':
      return builder.gte(rule.field, value as string | number);
    case '<=':
      return builder.lte(rule.field, value as string | number);
    case 'contains':
      return builder.ilike(rule.field, `%${value}%`);
    case 'beginsWith':
      return builder.ilike(rule.field, `${value}%`);
    case 'endsWith':
      return builder.ilike(rule.field, `%${value}`);
    case 'in':
      return builder.in(rule.field, value as Array<string | number | boolean>);
    case 'isNull':
      return builder.is(rule.field, null);
    case 'isNotNull':
      return builder.not(rule.field, 'is', null as unknown as string);
    case 'isEmpty':
      return builder.eq(rule.field, '');
    case 'isNotEmpty':
      return builder.neq(rule.field, '');
    default:
      return builder;
  }
}

export function areRuleValuesReadyForSubmit(
  rules: RuleGroupType,
  fieldTypes: FieldDataTypes = {}
): boolean {
  return rules.rules.every((rule) => {
    if (isRuleGroup(rule)) return areRuleValuesReadyForSubmit(rule, fieldTypes);

    const queryRule = rule as QueryRule;
    const value = queryRule.value;
    if (value === undefined || value === null || String(value).length === 0) return true;
    if (!queryRule.field) return true;

    return isColumnInputComplete(fieldTypes[queryRule.field], value, queryRule.operator);
  });
}

function applyAndGroupToBuilder(
  builder: PostgrestFilterBuilder,
  group: RuleGroupType,
  fieldTypes: FieldDataTypes = {}
): PostgrestFilterBuilder {
  let next = builder;

  for (const rule of group.rules) {
    if (isRuleGroup(rule)) {
      if (rule.combinator === 'or') {
        const expression = formatGroupExpression(rule, fieldTypes);
        if (expression) next = next.or(expression);
      } else {
        next = applyAndGroupToBuilder(next, rule, fieldTypes);
      }
      continue;
    }

    next = applyRuleToBuilder(next, rule as QueryRule, fieldTypes);
  }

  return next;
}

export function buildRuleFilterParams(
  rules: RuleGroupType,
  fieldTypes: FieldDataTypes = {}
): FilterParam[] {
  if (rules.combinator === 'or') {
    const expression = formatGroupExpression(rules, fieldTypes);
    return expression ? [{ key: 'or', value: `(${expression})` }] : [];
  }

  return rules.rules.flatMap((rule): FilterParam[] => {
    if (isRuleGroup(rule)) {
      if (rule.combinator === 'or') {
        const expression = formatGroupExpression(rule, fieldTypes);
        return expression ? [{ key: 'or', value: `(${expression})` }] : [];
      }

      return buildRuleFilterParams(rule, fieldTypes);
    }

    const expression = formatRuleExpression(rule as QueryRule, fieldTypes);
    if (!expression) return [];

    const [key, operator, ...valueParts] = expression.split('.');
    return [{ key, value: `${operator}.${valueParts.join('.')}` }];
  });
}

export function buildRuleFilterSignature(
  rules: RuleGroupType,
  fieldTypes: FieldDataTypes = {}
): string {
  return JSON.stringify(buildRuleFilterParams(rules, fieldTypes));
}

export function applyQueryRules(
  baseQuery: QueryableBuilder,
  rules: RuleGroupType,
  selectCols = '*',
  count: 'exact' | 'planned' | 'estimated' = 'exact',
  fieldTypes: FieldDataTypes = {}
): PostgrestFilterBuilder {
  let builder = baseQuery.select(selectCols, { count });

  if (rules.combinator === 'or') {
    const expression = formatGroupExpression(rules, fieldTypes);
    return expression ? builder.or(expression) : builder;
  }

  builder = applyAndGroupToBuilder(builder, rules, fieldTypes);
  return builder;
}
