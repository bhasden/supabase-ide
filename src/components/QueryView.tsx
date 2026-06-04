import { useState, useEffect, useCallback } from 'react';
import QueryBuilder, { type RuleGroupType, type Field } from 'react-querybuilder';
import { type PostgrestFilterBuilder } from '@supabase/supabase-js';
import CodeMirror from '@uiw/react-codemirror';
import { sql } from '@codemirror/lang-sql';
import { RefreshCw, Loader2, AlertCircle, Table2, Filter, Code, Rows3, ChevronDown, ChevronRight, Minus } from 'lucide-react';
import { getSupabaseClient } from '../lib/clients';
import type { DbConnection, ColumnInfo } from '../lib/types';
import { applyQueryRules } from '../lib/query-translator';

import 'react-querybuilder/dist/query-builder.css';

const PAGE_SIZE = 50;

const DEFAULT_RULES: RuleGroupType = {
  combinator: 'and',
  rules: [],
};

interface QueryViewProps {
  connection: DbConnection;
  tableName: string;
}

export default function QueryView({ connection, tableName }: QueryViewProps) {
  const client = getSupabaseClient(connection.url, connection.apiKey);

  const [columns, setColumns] = useState<ColumnInfo[]>([]);
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(0);
  const [rules, setRules] = useState<RuleGroupType>(DEFAULT_RULES);
  const [showFilters, setShowFilters] = useState(false);
  const [showRawQuery, setShowRawQuery] = useState(false);
  const [rawQuery, setRawQuery] = useState('');
  const [useRawQuery, setUseRawQuery] = useState(false);
  const [filterFields, setFilterFields] = useState<Field[]>([]);
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());

  // Fetch column info to populate filter fields
  const fetchColumns = useCallback(async () => {
    try {
      const { data, error: colError } = await client.from(tableName).select('*').limit(1);
      if (colError) return;
      if (data && data.length > 0) {
        const cols = Object.entries(data[0]).map(([key, val]) => ({
          name: key,
          type: typeof val === 'number'
            ? 'number'
            : typeof val === 'boolean'
              ? 'boolean'
              : typeof val === 'object' && val !== null
                ? 'jsonb'
                : 'text',
        }));
        setColumns(cols);
        setFilterFields(
          cols.map((c) => ({
            name: c.name,
            label: c.name,
            datatype: c.type === 'number' ? 'number' : c.type === 'boolean' ? 'boolean' : 'text',
          }))
        );
      }
    } catch {
      // ignore - columns discovered on full fetch
    }
  }, [client, tableName]);

  useEffect(() => {
    fetchColumns();
  }, [fetchColumns]);

  const buildUrl = useCallback((): string => {
    const base = `${connection.url}/rest/v1/${tableName}`;
    const filters: string[] = [];
    let select = '*';

    if (useRawQuery && rawQuery.trim()) {
      try {
        const parsed = JSON.parse(rawQuery);
        if (parsed.select) select = parsed.select;
        if (parsed.filters) filters.push(...parsed.filters);
      } catch {
        // treat as a PostgREST filter string
        filters.push(rawQuery.trim());
      }
    } else {
      // Build from visual rules
      if (rules.rules.length > 0) {
        if (rules.combinator === 'or') {
          const orParts: string[] = [];
          for (const rule of rules.rules) {
            if ('rules' in rule) continue;
            const r = rule as { field: string; operator: string; value: unknown };
            if (r.operator === 'contains') {
              orParts.push(`${r.field}=ilike.*${r.value}*`);
            } else if (r.operator === 'beginsWith') {
              orParts.push(`${r.field}=ilike.${r.value}*`);
            } else if (r.operator === 'endsWith') {
              orParts.push(`${r.field}=ilike.*${r.value}`);
            } else if (r.operator === '=') {
              orParts.push(`${r.field}=eq.${r.value}`);
            } else if (r.operator === '!=') {
              orParts.push(`${r.field}=neq.${r.value}`);
            } else if (r.operator === '>') {
              orParts.push(`${r.field}=gt.${r.value}`);
            } else if (r.operator === '<') {
              orParts.push(`${r.field}=lt.${r.value}`);
            } else if (r.operator === '>=') {
              orParts.push(`${r.field}=gte.${r.value}`);
            } else if (r.operator === '<=') {
              orParts.push(`${r.field}=lte.${r.value}`);
            }
          }
          if (orParts.length > 0) filters.push(`or=(${orParts.join(',')})`);
        } else {
          for (const rule of rules.rules) {
            if ('rules' in rule) continue;
            const r = rule as { field: string; operator: string; value: unknown };
            if (r.operator === 'contains') {
              filters.push(`${r.field}=ilike.*${r.value}*`);
            } else if (r.operator === 'beginsWith') {
              filters.push(`${r.field}=ilike.${r.value}*`);
            } else if (r.operator === 'endsWith') {
              filters.push(`${r.field}=ilike.*${r.value}`);
            } else if (r.operator === '=') {
              filters.push(`${r.field}=eq.${r.value}`);
            } else if (r.operator === '!=') {
              filters.push(`${r.field}=neq.${r.value}`);
            } else if (r.operator === '>') {
              filters.push(`${r.field}=gt.${r.value}`);
            } else if (r.operator === '<') {
              filters.push(`${r.field}=lt.${r.value}`);
            } else if (r.operator === '>=') {
              filters.push(`${r.field}=gte.${r.value}`);
            } else if (r.operator === '<=') {
              filters.push(`${r.field}=lte.${r.value}`);
            } else if (r.operator === 'isNull') {
              filters.push(`${r.field}=is.null`);
            } else if (r.operator === 'isNotNull') {
              filters.push(`${r.field}=not.is.null`);
            }
          }
        }
      }
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

    return `${base}?${params.toString()}`;
  }, [connection.url, tableName, rules, rawQuery, useRawQuery, page]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      let query: PostgrestFilterBuilder;

      if (useRawQuery && rawQuery.trim()) {
        // Parse raw JSON query for advanced use
        try {
          const parsed = JSON.parse(rawQuery);
          const selectCols = parsed.select || '*';
          query = client.from(tableName).select(selectCols, { count: 'exact' });
          if (parsed.order) query = query.order(parsed.order.column, { ascending: parsed.order.ascending ?? true });
          if (parsed.limit) query = query.limit(parsed.limit);
        } catch {
          query = client.from(tableName).select('*', { count: 'exact' });
        }
      } else {
        query = applyQueryRules(client.from(tableName), rules, '*', 'exact');
      }

      query = query.range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      const { data, error: fetchError, count } = await query;

      if (fetchError) {
        setError(fetchError.message);
        return;
      }

      if (data && data.length > 0) {
        const cols = Object.entries(data[0]).map(([key, val]) => ({
          name: key,
          type: typeof val === 'number'
            ? 'number'
            : typeof val === 'boolean'
              ? 'boolean'
              : typeof val === 'object' && val !== null
                ? 'jsonb'
                : 'text',
        }));
        setColumns(cols);
        setRows(data as Record<string, unknown>[]);
      } else {
        setRows([]);
      }

      setTotalCount(count ?? 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Query failed');
    } finally {
      setLoading(false);
    }
  }, [client, tableName, rules, page, rawQuery, useRawQuery]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    // Don't auto-run, just update preview
  }, [buildUrl]);

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
          onClick={() => setShowRawQuery(!showRawQuery)}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs transition-colors ${
            showRawQuery ? 'bg-emerald-500/15 text-emerald-400' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800'
          }`}
        >
          <Code size={13} />
          Query
        </button>

        <button
          onClick={fetchData}
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
                onQueryChange={setRules}
                query={rules}
                addRuleToNewGroups
                showCombinatorsBetweenRules
                showLockButtons
                controlElements={{
                  combinatorSelector: ({ value, onChange, options }) => (
                    <select
                      value={value}
                      onChange={(e) => onChange(e.target.value)}
                      className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-slate-300"
                    >
                      {options.map((o) => (
                        <option key={o.name} value={o.name}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  ),
                  fieldSelector: ({ value, onChange, options }) => (
                    <select
                      value={value}
                      onChange={(e) => onChange(e.target.value)}
                      className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-slate-300"
                    >
                      {options.map((o) => (
                        <option key={o.name} value={o.name}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  ),
                  operatorSelector: ({ value, onChange, options }) => (
                    <select
                      value={value}
                      onChange={(e) => onChange(e.target.value)}
                      className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-slate-300"
                    >
                      {options.map((o) => (
                        <option key={o.name} value={o.name}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  ),
                  valueEditor: ({ value, onChange, field }) => {
                    const f = filterFields.find((ff) => ff.name === field);
                    if (f?.datatype === 'boolean') {
                      return (
                        <select
                          value={value ?? ''}
                          onChange={(e) => onChange(e.target.value)}
                          className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-slate-300"
                        >
                          <option value="">--</option>
                          <option value="true">true</option>
                          <option value="false">false</option>
                        </select>
                      );
                    }
                    return (
                      <input
                        type={f?.datatype === 'number' ? 'number' : 'text'}
                        value={value ?? ''}
                        onChange={(e) => onChange(e.target.value)}
                        className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-slate-300"
                      />
                    );
                  },
                  addRuleAction: ({ handleOnClick }) => (
                    <button
                      onClick={handleOnClick}
                      className="px-2 py-0.5 rounded text-xs text-emerald-400 hover:bg-emerald-500/10 transition-colors"
                    >
                      + Rule
                    </button>
                  ),
                  addGroupAction: ({ handleOnClick }) => (
                    <button
                      onClick={handleOnClick}
                      className="px-2 py-0.5 rounded text-xs text-slate-400 hover:bg-slate-800 transition-colors"
                    >
                      + Group
                    </button>
                  ),
                  removeRuleAction: ({ handleOnClick }) => (
                    <button
                      onClick={handleOnClick}
                      className="w-5 h-5 flex items-center justify-center rounded text-slate-500 hover:text-red-400 transition-colors"
                    >
                      <Minus size={12} />
                    </button>
                  ),
                  removeGroupAction: ({ handleOnClick }) => (
                    <button
                      onClick={handleOnClick}
                      className="w-5 h-5 flex items-center justify-center rounded text-slate-500 hover:text-red-400 transition-colors"
                    >
                      <Minus size={12} />
                    </button>
                  ),
                }}
              />
            </div>
          ) : (
            <div>
              <CodeMirror
                value={rawQuery}
                onChange={setRawQuery}
                extensions={[sql()]}
                theme="dark"
                height="100px"
                className="rounded-md overflow-hidden border border-slate-700"
              />
              <p className="mt-1.5 text-[10px] text-slate-600">
                Enter PostgREST filter params or JSON with select/filters/order
              </p>
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
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 size={20} className="text-emerald-400 animate-spin" />
          </div>
        ) : rows.length === 0 && !error ? (
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
                    className="text-left px-3 py-2 text-[11px] font-medium text-slate-400 uppercase tracking-wider border-b border-slate-800 whitespace-nowrap"
                  >
                    <div>{col.name}</div>
                    <div className="text-[9px] font-normal normal-case text-slate-600">
                      {col.type}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => {
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
              onClick={() => {
                setPage((p) => p - 1);
                fetchData();
              }}
              disabled={page === 0}
              className="px-2.5 py-1 text-[11px] rounded-md bg-slate-800 text-slate-300 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              Prev
            </button>
            <button
              onClick={() => {
                setPage((p) => p + 1);
                fetchData();
              }}
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
