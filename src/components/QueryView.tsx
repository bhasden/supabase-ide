import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import QueryBuilder, {
  type ActionProps,
  type CombinatorSelectorProps,
  type FieldSelectorProps,
  type OperatorSelectorProps,
  type RuleType,
  type RuleGroupType,
  type ValueEditorProps,
  type Field,
} from 'react-querybuilder';
import { type SupabaseClient } from '@supabase/supabase-js';
import CodeMirror from '@uiw/react-codemirror';
import { sql } from '@codemirror/lang-sql';
import { RefreshCw, Loader2, AlertCircle, Table2, Filter, Code, Rows3, ChevronDown, ChevronRight, Minus, Play, ArrowUp, ArrowDown, ArrowUpDown, Search, Eraser } from 'lucide-react';
import { getSupabaseClient } from '../lib/clients';
import {
  discoverTableSchema,
  inferColumnsFromRows,
  mergeColumnMetadata,
} from '../lib/schema-discovery';
import type {
  ColumnInfo,
  ColumnSort,
  DbConnection,
  SchemaDiscoveryCapabilities,
  TableViewState,
} from '../lib/types';
import {
  SUPPORTED_OPERATORS,
  VALUELESS_OPERATORS,
  applyQueryRules,
  areRuleValuesReadyForSubmit,
  buildRuleFilterParams,
} from '../lib/query-translator';
import {
  formatValueForColumnInput,
  getColumnInputPlaceholder,
  getColumnInputType,
  getQueryBuilderDataType,
  isColumnInputComplete,
  isNumericColumnType,
  isStructuredInputType,
  normalizeColumnInputValue,
} from '../lib/column-input';
import {
  createAdvancedQueryState,
  isAdvancedQuerySubmitKey,
  submitAdvancedQueryDraft,
  updateAdvancedQueryDraft,
} from '../lib/advanced-query';
import {
  createDefaultTableViewState,
  stripRuleLocks,
} from '../lib/view-state';

import 'react-querybuilder/dist/query-builder.css';

const PAGE_SIZE = 50;
const VISUAL_QUERY_DEBOUNCE_MS = 600;
const COLUMN_FILTER_ID_PREFIX = 'column-filter:';
type PostgrestFilterBuilder = ReturnType<
  ReturnType<SupabaseClient['from']>['select']
>;

type SelectOption = {
  name: string;
  label: string;
};

type RuleSelectProps =
  | CombinatorSelectorProps
  | FieldSelectorProps
  | OperatorSelectorProps;

type AdvancedQueryInput = {
  select: string;
  filters: string[];
  order?: {
    column: string;
    ascending?: boolean;
  };
  limit?: number;
};

function parseAdvancedQueryInput(rawQuery: string): AdvancedQueryInput {
  const trimmed = rawQuery.trim();
  if (!trimmed) return { select: '*', filters: [] };

  try {
    const parsed = JSON.parse(trimmed);
    return {
      select: typeof parsed.select === 'string' ? parsed.select : '*',
      filters: Array.isArray(parsed.filters) ? parsed.filters : [],
      order:
        parsed.order && typeof parsed.order.column === 'string'
          ? {
              column: parsed.order.column,
              ascending: parsed.order.ascending,
            }
          : undefined,
      limit: Number.isFinite(Number(parsed.limit)) ? Number(parsed.limit) : undefined,
    };
  } catch {
    const params = new URLSearchParams(trimmed.replace(/^\?/, ''));
    const filters: string[] = [];
    let select = '*';

    params.forEach((value, key) => {
      if (key === 'select') {
        select = value;
        return;
      }

      filters.push(`${key}=${value}`);
    });

    return { select, filters };
  }
}

function applyAdvancedFilter(
  query: PostgrestFilterBuilder,
  filter: string
): PostgrestFilterBuilder {
  const eq = filter.indexOf('=');
  if (eq <= 0) return query;

  const key = filter.slice(0, eq);
  const value = filter.slice(eq + 1);

  if (key === 'or') {
    return query.or(value.replace(/^\(|\)$/g, ''));
  }

  const firstDot = value.indexOf('.');
  if (firstDot <= 0) return query;

  const operator = value.slice(0, firstDot);
  const filterValue = value.slice(firstDot + 1);

  if (operator === 'not') {
    const secondDot = filterValue.indexOf('.');
    if (secondDot <= 0) return query;

    const innerOperator = filterValue.slice(0, secondDot);
    const innerValue = filterValue.slice(secondDot + 1);
    return query.not(
      key,
      innerOperator,
      innerValue === 'null' ? (null as unknown as string) : innerValue
    );
  }

  if (operator === 'is') {
    return query.is(key, filterValue === 'null' ? null : filterValue);
  }

  return query.filter(key, operator, filterValue);
}

function isRuleGroup(rule: RuleGroupType['rules'][number]): rule is RuleGroupType {
  return typeof rule === 'object' && rule !== null && 'rules' in rule;
}

function getColumnFilterId(field: string) {
  return `${COLUMN_FILTER_ID_PREFIX}${field}`;
}

function getColumnFilterOperator(dataType: string) {
  return isNumericColumnType(dataType) ||
    dataType === 'boolean' ||
    isStructuredInputType(dataType)
    ? '='
    : 'contains';
}

function toFilterFields(columns: ColumnInfo[]): Field[] {
  return columns.map((column) => ({
    name: column.name,
    label: column.name,
    datatype: getQueryBuilderDataType(column.type),
  }));
}

function isNumericType(type: string): boolean {
  return isNumericColumnType(type);
}

function areColumnsEqual(a: ColumnInfo[], b: ColumnInfo[]): boolean {
  return (
    a.length === b.length &&
    a.every((column, index) => (
      column.name === b[index]?.name && column.type === b[index]?.type
    ))
  );
}

function removeColumnFilterRule(group: RuleGroupType, field: string): RuleGroupType {
  const filterId = getColumnFilterId(field);
  const nextRules: RuleGroupType['rules'] = [];

  group.rules.forEach((rule) => {
    if (isRuleGroup(rule)) {
      nextRules.push(removeColumnFilterRule(rule, field));
      return;
    }

    if ((rule as RuleType).id !== filterId) {
      nextRules.push(rule);
    }
  });

  return pruneEmptyGroups({
    ...group,
    rules: nextRules,
  });
}

function pruneEmptyGroups(group: RuleGroupType): RuleGroupType {
  const rules: RuleGroupType['rules'] = [];

  group.rules.forEach((rule) => {
    if (!isRuleGroup(rule)) {
      rules.push(rule);
      return;
    }

    const pruned = pruneEmptyGroups(rule);
    if (pruned.rules.length > 0) {
      rules.push(pruned);
    }
  });

  return {
    ...group,
    rules,
  };
}

function upsertColumnFilterRule(
  group: RuleGroupType,
  field: string,
  dataType: string,
  value: string
): RuleGroupType {
  const cleaned = removeColumnFilterRule(group, field);
  const trimmed = value.trim();
  if (!trimmed) return cleaned;

  const nextRule: RuleType = {
    id: getColumnFilterId(field),
    field,
    operator: getColumnFilterOperator(dataType),
    value: trimmed,
  };

  if (cleaned.combinator === 'and' || cleaned.rules.length === 0) {
    return { ...cleaned, rules: [...cleaned.rules, nextRule] };
  }

  return {
    combinator: 'and',
    rules: [cleaned, nextRule],
  };
}

function getColumnFilterValue(group: RuleGroupType, field: string): string {
  const filterId = getColumnFilterId(field);

  for (const rule of group.rules) {
    if (isRuleGroup(rule)) {
      const nestedValue = getColumnFilterValue(rule, field);
      if (nestedValue) return nestedValue;
      continue;
    }

    if ((rule as RuleType).id === filterId) {
      return String((rule as RuleType).value ?? '');
    }
  }

  return '';
}

function RuleSelect({ value, handleOnChange, options }: RuleSelectProps) {
  return (
    <select
      value={value}
      onChange={(e) => handleOnChange(e.target.value)}
      className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-slate-300"
    >
      {(options as SelectOption[]).map((option) => (
        <option key={option.name} value={option.name}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

type ColumnValueInputProps = {
  dataType: string;
  operator?: string;
  value: unknown;
  onChange: (value: string) => void;
  className: string;
};

function ColumnValueInput({
  dataType,
  operator,
  value,
  onChange,
  className,
}: ColumnValueInputProps) {
  const shouldAutoformat = !(dataType === 'uuid' && operator === 'in');
  const isTimestampInput = dataType === 'timestamptz' || dataType === 'timestamp';
  const timestampMaxLength = dataType === 'timestamptz' ? 25 : 19;
  const isStructured = isStructuredInputType(dataType);
  const inputValue = shouldAutoformat
    ? formatValueForColumnInput(dataType, value)
    : String(value ?? '');
  const isIncomplete =
    inputValue.length > 0 && !isColumnInputComplete(dataType, inputValue, operator);
  const inputClassName = `${className} ${
    isStructured ? 'font-mono placeholder:text-slate-600' : ''
  } ${isIncomplete ? 'ring-1 ring-amber-500/60' : ''}`;

  if (dataType === 'boolean') {
    return (
      <select
        value={inputValue}
        onChange={(event) => onChange(event.target.value)}
        className={className}
      >
        <option value="">--</option>
        <option value="true">true</option>
        <option value="false">false</option>
      </select>
    );
  }

  return (
    <input
      type={getColumnInputType(dataType)}
      value={inputValue}
      maxLength={
        dataType === 'uuid' && shouldAutoformat
          ? 36
          : isTimestampInput
            ? timestampMaxLength
            : undefined
      }
      placeholder={getColumnInputPlaceholder(dataType)}
      aria-invalid={isIncomplete}
      onChange={(event) =>
        onChange(
          shouldAutoformat
            ? normalizeColumnInputValue(dataType, event.target.value)
            : event.target.value
        )
      }
      className={inputClassName}
    />
  );
}

function RuleValueEditor({
  value,
  handleOnChange,
  operator,
  fieldData,
}: ValueEditorProps) {
  if (VALUELESS_OPERATORS.has(operator)) {
    return null;
  }

  const dataType = String(fieldData.datatype ?? 'text');

  return (
    <ColumnValueInput
      dataType={dataType}
      operator={operator}
      value={value}
      onChange={handleOnChange}
      className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-slate-300"
    />
  );
}

function AddRuleAction({ handleOnClick }: ActionProps) {
  return (
    <button
      type="button"
      onClick={handleOnClick}
      className="px-2 py-0.5 rounded text-xs text-emerald-400 hover:bg-emerald-500/10 transition-colors"
    >
      + Rule
    </button>
  );
}

function AddGroupAction({ handleOnClick }: ActionProps) {
  return (
    <button
      type="button"
      onClick={handleOnClick}
      className="px-2 py-0.5 rounded text-xs text-slate-400 hover:bg-slate-800 transition-colors"
    >
      + Group
    </button>
  );
}

function RemoveAction({ handleOnClick }: ActionProps) {
  return (
    <button
      type="button"
      onClick={handleOnClick}
      className="w-5 h-5 flex items-center justify-center rounded text-slate-500 hover:text-red-400 transition-colors"
    >
      <Minus size={12} />
    </button>
  );
}

const QUERY_BUILDER_CONTROLS = {
  combinatorSelector: RuleSelect,
  fieldSelector: RuleSelect,
  operatorSelector: RuleSelect,
  valueEditor: RuleValueEditor,
  addRuleAction: AddRuleAction,
  addGroupAction: AddGroupAction,
  removeRuleAction: RemoveAction,
  removeGroupAction: RemoveAction,
};

interface QueryViewProps {
  connection: DbConnection;
  tableName: string;
  initialColumns: ColumnInfo[];
  initialViewState: TableViewState;
  onColumnsDiscovered?: (columns: ColumnInfo[]) => void;
  onSchemaDiscoveryChange?: (schemaDiscovery: SchemaDiscoveryCapabilities) => void;
  onViewStateChange?: (viewState: TableViewState) => void;
}

export default function QueryView({
  connection,
  tableName,
  initialColumns,
  initialViewState,
  onColumnsDiscovered,
  onSchemaDiscoveryChange,
  onViewStateChange,
}: QueryViewProps) {
  const client = getSupabaseClient(connection.url, connection.apiKey);
  const schemaDiscoveryConnection = useMemo<DbConnection>(() => ({
    id: connection.id,
    name: connection.name,
    url: connection.url,
    apiKey: connection.apiKey,
    createdAt: connection.createdAt,
    tables: [],
    schemaDiscovery: {
      restOpenApi: connection.schemaDiscovery.restOpenApi,
      graphql: connection.schemaDiscovery.graphql,
    },
  }), [
    connection.id,
    connection.name,
    connection.url,
    connection.apiKey,
    connection.createdAt,
    connection.schemaDiscovery.restOpenApi,
    connection.schemaDiscovery.graphql,
  ]);

  const [columns, setColumns] = useState<ColumnInfo[]>(initialColumns);
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(0);
  const [rules, setRules] = useState<RuleGroupType>(() =>
    stripRuleLocks(initialViewState.rules)
  );
  const [submittedRules, setSubmittedRules] = useState<RuleGroupType>(() =>
    stripRuleLocks(initialViewState.rules)
  );
  const [showFilters, setShowFilters] = useState(false);
  const [showRawQuery, setShowRawQuery] = useState(false);
  const [advancedQuery, setAdvancedQuery] = useState(() => createAdvancedQueryState());
  const [useRawQuery, setUseRawQuery] = useState(false);
  const [filterFields, setFilterFields] = useState<Field[]>(
    () => toFilterFields(initialColumns)
  );
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  const [queryRevision, setQueryRevision] = useState(0);
  const [sortOrder, setSortOrder] = useState<ColumnSort>(initialViewState.sortOrder);
  const columnsRef = useRef<ColumnInfo[]>(initialColumns);
  const fieldTypesRef = useRef<Record<string, string | undefined>>({});

  const fieldTypes = useMemo(
    () =>
      Object.fromEntries(
        filterFields.map((field) => [field.name, String(field.datatype ?? 'text')])
      ),
    [filterFields]
  );

  useEffect(() => {
    fieldTypesRef.current = fieldTypes;
  }, [fieldTypes]);

  const applyDiscoveredColumns = useCallback((nextColumns: ColumnInfo[]) => {
    if (nextColumns.length === 0 || areColumnsEqual(columnsRef.current, nextColumns)) {
      return;
    }

    const nextFields = toFilterFields(nextColumns);
    columnsRef.current = nextColumns;
    fieldTypesRef.current = Object.fromEntries(
      nextFields.map((field) => [field.name, String(field.datatype ?? 'text')])
    );
    setColumns(nextColumns);
    setFilterFields(nextFields);
    onColumnsDiscovered?.(nextColumns);
  }, [onColumnsDiscovered]);

  // Fetch column info to populate filter fields
  const fetchColumns = useCallback(async () => {
    try {
      const { columns: cols, schemaDiscovery } = await discoverTableSchema(
        schemaDiscoveryConnection,
        tableName,
        { sampleRows: false }
      );
      onSchemaDiscoveryChange?.(schemaDiscovery);
      applyDiscoveredColumns(cols);
    } catch {
      // ignore - columns discovered on full fetch
    }
  }, [applyDiscoveredColumns, schemaDiscoveryConnection, tableName, onSchemaDiscoveryChange]);

  useEffect(() => {
    fetchColumns();
  }, [fetchColumns]);

  const buildUrl = useCallback((): string => {
    const base = `${connection.url}/rest/v1/${tableName}`;
    const filters: string[] = [];
    let select = '*';

    if (useRawQuery && advancedQuery.draft.trim()) {
      const parsed = parseAdvancedQueryInput(advancedQuery.draft);
      select = parsed.select;
      filters.push(...parsed.filters);
    } else {
      filters.push(
        ...buildRuleFilterParams(rules, fieldTypes).map(
          (filter) => `${filter.key}=${filter.value}`
        )
      );
    }

    const params = new URLSearchParams();
    params.set('select', select);
    filters.forEach((f) => {
      const eq = f.indexOf('=');
      if (eq > 0) {
        params.append(f.slice(0, eq), f.slice(eq + 1));
      }
    });
    params.set('offset', String(page * PAGE_SIZE));
    params.set('limit', String(PAGE_SIZE));
    if (sortOrder) {
      params.set('order', `${sortOrder.field}.${sortOrder.direction}`);
    }

    return `${base}?${params.toString()}`;
  }, [connection.url, tableName, rules, advancedQuery.draft, useRawQuery, page, fieldTypes, sortOrder]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      let query: PostgrestFilterBuilder;

      if (useRawQuery && advancedQuery.submitted.trim()) {
        const parsed = parseAdvancedQueryInput(advancedQuery.submitted);
        query = client.from(tableName).select(parsed.select, { count: 'exact' });
        parsed.filters.forEach((filter) => {
          query = applyAdvancedFilter(query, filter);
        });
        if (parsed.order) {
          query = query.order(parsed.order.column, {
            ascending: parsed.order.ascending ?? true,
          });
        }
        if (parsed.limit) query = query.limit(parsed.limit);
      } else {
        query = applyQueryRules(
          client.from(tableName),
          submittedRules,
          '*',
          'exact',
          fieldTypesRef.current
        );
      }

      if (sortOrder) {
        query = query.order(sortOrder.field, { ascending: sortOrder.direction === 'asc' });
      }

      query = query.range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      const { data, error: fetchError, count } = await query;

      if (fetchError) {
        setError(fetchError.message);
        return;
      }

      const resultRows = data as Record<string, unknown>[] | null;

      if (resultRows && resultRows.length > 0) {
        const sampledColumns = inferColumnsFromRows(resultRows);
        const nextColumns = mergeColumnMetadata(columnsRef.current, sampledColumns);
        applyDiscoveredColumns(nextColumns);

        setExpandedRows(new Set());
        setRows(resultRows);
      } else {
        setExpandedRows(new Set());
        setRows([]);
      }

      setTotalCount(count ?? 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Query failed');
    } finally {
      setLoading(false);
    }
  }, [client, tableName, submittedRules, page, advancedQuery.submitted, useRawQuery, sortOrder, applyDiscoveredColumns]);

  useEffect(() => {
    fetchData();
  }, [fetchData, queryRevision]);

  useEffect(() => {
    if (useRawQuery) return;

    const timeoutId = window.setTimeout(() => {
      if (!areRuleValuesReadyForSubmit(rules, fieldTypes)) return;
      setSubmittedRules(rules);
      setPage(0);
    }, VISUAL_QUERY_DEBOUNCE_MS);

    return () => window.clearTimeout(timeoutId);
  }, [fieldTypes, rules, useRawQuery]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      onViewStateChange?.({
        rules,
        sortOrder,
      });
    }, 250);

    return () => window.clearTimeout(timeoutId);
  }, [onViewStateChange, rules, sortOrder]);

  const handleRulesChange = useCallback((nextRules: RuleGroupType) => {
    setRules(stripRuleLocks(nextRules));
  }, []);

  const handleRunAdvancedQuery = useCallback(() => {
    setAdvancedQuery((prev) => submitAdvancedQueryDraft(prev));
    setPage(0);
    setQueryRevision((revision) => revision + 1);
  }, []);

  const handleRefresh = useCallback(() => {
    setQueryRevision((revision) => revision + 1);
  }, []);

  const handleClearFilters = useCallback(() => {
    const emptyRules = createDefaultTableViewState().rules;
    setRules(emptyRules);
    setSubmittedRules(emptyRules);
    setPage(0);
  }, []);

  const handleToggleSort = useCallback((field: string) => {
    setSortOrder((current) => {
      if (!current || current.field !== field) return { field, direction: 'asc' };
      if (current.direction === 'asc') return { field, direction: 'desc' };
      return null;
    });
    setPage(0);
  }, []);

  const handleColumnFilterChange = useCallback((
    field: string,
    dataType: string,
    value: string
  ) => {
    setRules((current) => upsertColumnFilterRule(current, field, dataType, value));
  }, []);

  const formatValue = (val: unknown): string => {
    if (val === null) return 'NULL';
    if (val === undefined) return '';
    if (typeof val === 'boolean') return val ? 'true' : 'false';
    if (typeof val === 'object') return JSON.stringify(val);
    return String(val);
  };

  const truncateValue = (val: string, maxLen = 80) => {
    if (val.length <= maxLen) return val;
    return val.slice(0, maxLen) + '...';
  };

  const toggleRowExpand = (idx: number) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  return (
    <div className="flex-1 flex flex-col min-w-0 h-screen">
      {/* Header */}
      <header className="h-11 bg-slate-900/50 border-b border-slate-800 flex items-center px-4 shrink-0 gap-2">
        <Table2 size={14} className="text-emerald-400" />
        <span className="text-sm font-medium text-slate-200">{tableName}</span>
        {totalCount > 0 && (
          <span className="text-[10px] text-slate-500 bg-slate-800 px-1.5 py-0.5 rounded-full">
            {totalCount.toLocaleString()} rows
          </span>
        )}

        <div className="flex-1" />

        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs transition-colors ${
            showFilters ? 'bg-emerald-500/15 text-emerald-400' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800'
          }`}
        >
          <Filter size={13} />
          Filters
          {rules.rules.length > 0 && (
            <span className="bg-emerald-500/20 text-emerald-400 rounded-full w-4 h-4 flex items-center justify-center text-[10px]">
              {rules.rules.length}
            </span>
          )}
        </button>

        <button
          onClick={handleClearFilters}
          disabled={rules.rules.length === 0}
          className="flex items-center justify-center w-7 h-7 rounded-md text-slate-500 hover:text-emerald-400 hover:bg-slate-800 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <Eraser size={13} />
        </button>

        <button
          onClick={() => setShowRawQuery(!showRawQuery)}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs transition-colors ${
            showRawQuery ? 'bg-emerald-500/15 text-emerald-400' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800'
          }`}
        >
          <Code size={13} />
          Query
        </button>

        <button
          onClick={handleRefresh}
          disabled={loading}
          className="flex items-center justify-center w-7 h-7 rounded-md text-slate-500 hover:text-emerald-400 hover:bg-slate-800 transition-colors disabled:opacity-40"
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
        </button>
      </header>

      {/* Filter panel */}
      {showFilters && (
        <div className="border-b border-slate-800 bg-slate-900/30 p-3">
          <div className="flex items-center gap-2 mb-2">
            <button
              onClick={() => setUseRawQuery(false)}
              className={`px-2 py-0.5 rounded text-xs transition-colors ${
                !useRawQuery ? 'bg-slate-700 text-slate-200' : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              Visual
            </button>
            <button
              onClick={() => setUseRawQuery(true)}
              className={`px-2 py-0.5 rounded text-xs transition-colors ${
                useRawQuery ? 'bg-slate-700 text-slate-200' : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              Advanced
            </button>
          </div>

          {!useRawQuery ? (
            <div className="rqb-theme">
              <QueryBuilder
                fields={filterFields}
                operators={SUPPORTED_OPERATORS}
                onQueryChange={handleRulesChange}
                query={rules}
                addRuleToNewGroups
                showCombinatorsBetweenRules
                controlElements={QUERY_BUILDER_CONTROLS}
              />
            </div>
          ) : (
            <div>
              <div className="flex items-center justify-between gap-3 mb-2">
                <p className="text-[10px] text-slate-600">
                  PostgREST params or JSON with select/filters/order
                </p>
                <button
                  type="button"
                  onClick={handleRunAdvancedQuery}
                  disabled={loading}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-40 transition-colors"
                >
                  <Play size={12} />
                  Run
                </button>
              </div>
              <div
                onKeyDown={(event) => {
                  if (isAdvancedQuerySubmitKey(event)) {
                    event.preventDefault();
                    handleRunAdvancedQuery();
                  }
                }}
              >
                <CodeMirror
                  value={advancedQuery.draft}
                  onChange={(value) =>
                    setAdvancedQuery((prev) => updateAdvancedQueryDraft(prev, value))
                  }
                  extensions={[sql()]}
                  theme="dark"
                  height="100px"
                  className="rounded-md overflow-hidden border border-slate-700"
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Generated query preview */}
      {showRawQuery && (
        <div className="border-b border-slate-800 bg-slate-900/60 px-4 py-2">
          <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Request URL</p>
          <code className="text-[11px] text-emerald-400/80 break-all font-mono leading-relaxed">
            {buildUrl()}
          </code>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mx-4 mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-start gap-2">
          <AlertCircle size={14} className="text-red-400 shrink-0 mt-0.5" />
          <p className="text-xs text-red-300">{error}</p>
        </div>
      )}

      {/* Data */}
      <div className="flex-1 overflow-auto">
        {loading && columns.length === 0 ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 size={20} className="text-emerald-400 animate-spin" />
          </div>
        ) : rows.length === 0 && columns.length === 0 && !error ? (
          <div className="flex flex-col items-center justify-center h-48 text-center">
            <Rows3 size={20} className="text-slate-700 mb-2" />
            <p className="text-sm text-slate-500">No data found</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10">
              <tr className="bg-slate-900">
                <th className="w-8 px-2 py-2 border-b border-slate-800" />
                {columns.map((col) => (
                  <th
                    key={col.name}
                    className="text-left px-3 py-2 border-b border-slate-800 whitespace-nowrap align-top min-w-36"
                  >
                    <button
                      type="button"
                      onClick={() => handleToggleSort(col.name)}
                      className="flex w-full items-center justify-between gap-2 text-[11px] font-medium text-slate-400 uppercase tracking-wider hover:text-slate-200 transition-colors"
                    >
                      <span className="truncate">{col.name}</span>
                      {sortOrder?.field === col.name ? (
                        sortOrder.direction === 'asc' ? (
                          <ArrowUp size={11} className="shrink-0 text-emerald-400" />
                        ) : (
                          <ArrowDown size={11} className="shrink-0 text-emerald-400" />
                        )
                      ) : (
                        <ArrowUpDown size={11} className="shrink-0 text-slate-600" />
                      )}
                    </button>
                    <div className="text-[9px] font-normal normal-case text-slate-600 mt-0.5">
                      {col.type}
                    </div>
                    <div className="relative mt-1">
                      {col.type !== 'boolean' && !isStructuredInputType(col.type) ? (
                        <>
                          <Search
                            size={10}
                            className="absolute left-1.5 top-1/2 -translate-y-1/2 text-slate-700"
                          />
                          <input
                            type={isNumericType(col.type) ? 'number' : 'text'}
                            value={getColumnFilterValue(rules, col.name)}
                            onChange={(event) =>
                              handleColumnFilterChange(col.name, col.type, event.target.value)
                            }
                            className="w-full bg-slate-950/70 border border-slate-800 rounded pl-5 pr-1.5 py-1 text-[10px] font-normal normal-case tracking-normal text-slate-300 placeholder-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                          />
                        </>
                      ) : (
                        <ColumnValueInput
                          dataType={col.type}
                          value={getColumnFilterValue(rules, col.name)}
                          onChange={(value) =>
                            handleColumnFilterChange(col.name, col.type, value)
                          }
                          className="w-full bg-slate-950/70 border border-slate-800 rounded px-1.5 py-1 text-[10px] font-normal normal-case tracking-normal text-slate-300 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                        />
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td
                    colSpan={columns.length + 1}
                    className="h-32 px-4 text-center text-sm text-slate-500"
                  >
                    <span className="inline-flex items-center gap-2">
                      <Loader2 size={14} className="text-emerald-400 animate-spin" />
                      Loading rows
                    </span>
                  </td>
                </tr>
              ) : rows.length === 0 && !error ? (
                <tr>
                  <td
                    colSpan={columns.length + 1}
                    className="h-32 px-4 text-center text-sm text-slate-500"
                  >
                    No rows returned
                  </td>
                </tr>
              ) : rows.map((row, i) => {
                const expanded = expandedRows.has(i);
                const hasJson = columns.some((c) => c.type === 'jsonb' && row[c.name] !== null);
                return (
                  <tr
                    key={i}
                    className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors"
                  >
                    <td className="px-2 py-1.5">
                      {hasJson && (
                        <button
                          onClick={() => toggleRowExpand(i)}
                          className="text-slate-600 hover:text-slate-400 transition-colors"
                        >
                          {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                        </button>
                      )}
                    </td>
                    {columns.map((col) => {
                      const val = row[col.name];
                      const display = formatValue(val);
                      const isJson = col.type === 'jsonb' && val !== null;

                      return (
                        <td
                          key={col.name}
                          className={`px-3 py-1.5 ${
                            val === null
                              ? 'text-slate-600 italic text-xs'
                              : 'text-slate-300'
                          }`}
                        >
                          {isJson && expanded ? (
                            <pre className="text-xs text-emerald-300/70 bg-slate-800/50 rounded p-1.5 whitespace-pre-wrap break-all font-mono">
                              {JSON.stringify(val, null, 2)}
                            </pre>
                          ) : (
                            <span className="block truncate max-w-xs" title={display}>
                              {truncateValue(display)}
                            </span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {totalCount > PAGE_SIZE && (
        <div className="h-11 bg-slate-900/50 border-t border-slate-800 flex items-center justify-between px-4 shrink-0">
          <p className="text-[11px] text-slate-500">
            {page * PAGE_SIZE + 1}-{Math.min((page + 1) * PAGE_SIZE, totalCount)} of{' '}
            {totalCount.toLocaleString()}
          </p>
          <div className="flex gap-1.5">
            <button
              onClick={() => setPage((p) => p - 1)}
              disabled={page === 0}
              className="px-2.5 py-1 text-[11px] rounded-md bg-slate-800 text-slate-300 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              Prev
            </button>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={(page + 1) * PAGE_SIZE >= totalCount}
              className="px-2.5 py-1 text-[11px] rounded-md bg-slate-800 text-slate-300 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
