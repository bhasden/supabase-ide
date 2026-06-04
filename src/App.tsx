import { useState, useEffect, useCallback } from 'react';
import { externalDb } from './lib/external-supabase';
import {
  Database,
  Table2,
  RefreshCw,
  ChevronRight,
  Loader2,
  AlertCircle,
  Search,
  X,
  ArrowLeft,
  Rows3,
} from 'lucide-react';

interface TableInfo {
  name: string;
  schema: string;
}

interface ColumnInfo {
  name: string;
  type: string;
  isNullable: boolean;
  defaultValue: string | null;
}

export default function App() {
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [columns, setColumns] = useState<ColumnInfo[]>([]);
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [schemaError, setSchemaError] = useState<string | null>(null);
  const [searchFilter, setSearchFilter] = useState('');
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const PAGE_SIZE = 50;

  const fetchTables = useCallback(async () => {
    setLoading(true);
    setSchemaError(null);
    try {
      // Try to fetch from information_schema via RPC or direct query
      // Since we only have anon key, we'll try common table names
      // First attempt: use the Supabase REST API to discover tables
      const { data, error: rpcError } = await externalDb.rpc('get_tables');

      if (rpcError) {
        // Fallback: try to query the information_schema tables directly
        // These are typically accessible to anon users on public schema
        setSchemaError(
          'Auto-discovery unavailable with anon key. Enter table names below or try common names.'
        );
        setTables([]);
      } else if (data) {
        setTables(
          data.map((t: { tablename?: string; table_name?: string; name?: string }) => ({
            name: t.tablename || t.table_name || t.name || '',
            schema: 'public',
          }))
        );
      }
    } catch {
      setSchemaError(
        'Auto-discovery unavailable with anon key. Enter table names below or try common names.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTables();
  }, [fetchTables]);

  const addManualTable = (name: string) => {
    if (!name.trim()) return;
    const exists = tables.some((t) => t.name === name.trim());
    if (!exists) {
      setTables((prev) => [...prev, { name: name.trim(), schema: 'public' }]);
    }
    setSelectedTable(name.trim());
    setSearchFilter('');
  };

  const fetchTableData = useCallback(async (tableName: string) => {
    setLoading(true);
    setError(null);
    setColumns([]);
    setRows([]);
    setPage(0);

    try {
      // Fetch rows
      const { data, error: dataError, count } = await externalDb
        .from(tableName)
        .select('*', { count: 'exact' })
        .range(0, PAGE_SIZE - 1);

      if (dataError) {
        setError(dataError.message);
        return;
      }

      if (data && data.length > 0) {
        // Derive columns from the first row
        const cols = Object.keys(data[0]).map((key) => ({
          name: key,
          type: typeof data[0][key] === 'number'
            ? 'number'
            : typeof data[0][key] === 'boolean'
              ? 'boolean'
              : typeof data[0][key] === 'object' && data[0][key] !== null
                ? 'jsonb'
                : 'text',
          isNullable: data[0][key] === null,
          defaultValue: null,
        }));
        setColumns(cols);
        setRows(data as Record<string, unknown>[]);
      } else {
        setRows([]);
      }

      setTotalCount(count ?? 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchPage = useCallback(
    async (p: number) => {
      if (!selectedTable) return;
      setLoading(true);
      setError(null);

      try {
        const { data, error: dataError } = await externalDb
          .from(selectedTable)
          .select('*')
          .range(p * PAGE_SIZE, (p + 1) * PAGE_SIZE - 1);

        if (dataError) {
          setError(dataError.message);
          return;
        }

        if (data && data.length > 0) {
          const cols = Object.keys(data[0]).map((key) => ({
            name: key,
            type: typeof data[0][key] === 'number'
              ? 'number'
              : typeof data[0][key] === 'boolean'
                ? 'boolean'
                : typeof data[0][key] === 'object' && data[0][key] !== null
                  ? 'jsonb'
                  : 'text',
            isNullable: data[0][key] === null,
            defaultValue: null,
          }));
          setColumns(cols);
          setRows(data as Record<string, unknown>[]);
        } else {
          setRows([]);
        }

        setPage(p);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch page');
      } finally {
        setLoading(false);
      }
    },
    [selectedTable]
  );

  useEffect(() => {
    if (selectedTable) {
      fetchTableData(selectedTable);
    }
  }, [selectedTable, fetchTableData]);

  const filteredTables = tables.filter((t) =>
    t.name.toLowerCase().includes(searchFilter.toLowerCase())
  );

  const formatValue = (val: unknown): string => {
    if (val === null) return 'NULL';
    if (val === undefined) return '';
    if (typeof val === 'object') return JSON.stringify(val);
    return String(val);
  };

  const truncateValue = (val: string, maxLen = 120) => {
    if (val.length <= maxLen) return val;
    return val.slice(0, maxLen) + '...';
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex">
      {/* Sidebar */}
      <aside className="w-72 bg-slate-900 border-r border-slate-800 flex flex-col shrink-0">
        <div className="p-4 border-b border-slate-800">
          <div className="flex items-center gap-2 text-emerald-400 mb-1">
            <Database size={18} />
            <span className="font-semibold text-sm tracking-wide">EXTERNAL DB</span>
          </div>
          <p className="text-xs text-slate-500 truncate">gkldtnyitcuorwpntokt.supabase.co</p>
        </div>

        {/* Search / Add table */}
        <div className="p-3 border-b border-slate-800">
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-2.5 text-slate-500" />
            <input
              type="text"
              placeholder="Search or add table..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && searchFilter.trim()) {
                  addManualTable(searchFilter);
                }
              }}
              className="w-full bg-slate-800 border border-slate-700 rounded-md pl-8 pr-8 py-1.5 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
            />
            {searchFilter && (
              <button
                onClick={() => setSearchFilter('')}
                className="absolute right-2 top-2 text-slate-500 hover:text-slate-300"
              >
                <X size={14} />
              </button>
            )}
          </div>
          <p className="text-[10px] text-slate-600 mt-1.5 px-0.5">
            Press Enter to add a table name manually
          </p>
        </div>

        {/* Table list */}
        <div className="flex-1 overflow-y-auto">
          {schemaError && (
            <div className="mx-3 mt-3 p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-md">
              <div className="flex items-start gap-1.5">
                <AlertCircle size={12} className="text-amber-400 shrink-0 mt-0.5" />
                <p className="text-[11px] text-amber-300 leading-tight">{schemaError}</p>
              </div>
            </div>
          )}

          {filteredTables.length === 0 && !loading && (
            <div className="p-4 text-center text-slate-600 text-xs">
              No tables discovered. Try adding one above.
            </div>
          )}

          {filteredTables.map((table) => (
            <button
              key={table.name}
              onClick={() => setSelectedTable(table.name)}
              className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-sm transition-colors ${
                selectedTable === table.name
                  ? 'bg-emerald-500/10 text-emerald-400 border-r-2 border-emerald-500'
                  : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
              }`}
            >
              <Table2 size={14} />
              <span className="truncate">{table.name}</span>
              {selectedTable === table.name && (
                <ChevronRight size={14} className="ml-auto" />
              )}
            </button>
          ))}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-slate-800 text-[10px] text-slate-600">
          {tables.length} table{tables.length !== 1 ? 's' : ''} found
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="h-13 bg-slate-900/50 border-b border-slate-800 flex items-center px-6 shrink-0">
          {selectedTable ? (
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  setSelectedTable(null);
                  setRows([]);
                  setColumns([]);
                  setError(null);
                }}
                className="text-slate-500 hover:text-slate-300 transition-colors"
              >
                <ArrowLeft size={16} />
              </button>
              <Rows3 size={16} className="text-emerald-400" />
              <h1 className="text-base font-semibold text-slate-100">{selectedTable}</h1>
              {totalCount > 0 && (
                <span className="text-xs text-slate-500 bg-slate-800 px-2 py-0.5 rounded-full">
                  {totalCount.toLocaleString()} rows
                </span>
              )}
              <button
                onClick={() => fetchTableData(selectedTable)}
                disabled={loading}
                className="ml-2 text-slate-500 hover:text-emerald-400 transition-colors disabled:opacity-40"
              >
                <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Database size={16} className="text-emerald-400" />
              <h1 className="text-base font-semibold text-slate-100">Data Explorer</h1>
            </div>
          )}
        </header>

        {/* Body */}
        <div className="flex-1 overflow-auto p-6">
          {!selectedTable ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="w-16 h-16 rounded-2xl bg-slate-800 flex items-center justify-center mb-5">
                <Database size={28} className="text-emerald-400" />
              </div>
              <h2 className="text-lg font-semibold text-slate-200 mb-2">Select a table to explore</h2>
              <p className="text-sm text-slate-500 max-w-md">
                Choose a table from the sidebar, or type a table name and press Enter to
                add it manually. Auto-discovery may not work with the anon key.
              </p>
            </div>
          ) : loading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 size={24} className="text-emerald-400 animate-spin" />
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-64 text-center">
              <div className="w-14 h-14 rounded-full bg-red-500/10 flex items-center justify-center mb-4">
                <AlertCircle size={24} className="text-red-400" />
              </div>
              <p className="text-red-400 font-medium mb-1">Query failed</p>
              <p className="text-sm text-slate-500 max-w-lg">{error}</p>
            </div>
          ) : rows.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-center">
              <Rows3 size={24} className="text-slate-600 mb-3" />
              <p className="text-slate-500 text-sm">Table is empty or inaccessible</p>
            </div>
          ) : (
            <div className="overflow-auto rounded-lg border border-slate-800">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-900/80">
                    {columns.map((col) => (
                      <th
                        key={col.name}
                        className="text-left px-3 py-2.5 text-xs font-medium text-slate-400 uppercase tracking-wider border-b border-slate-800 whitespace-nowrap"
                      >
                        <div>{col.name}</div>
                        <div className="text-[10px] font-normal normal-case text-slate-600 mt-0.5">
                          {col.type}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => (
                    <tr
                      key={i}
                      className="border-b border-slate-800/60 hover:bg-slate-800/30 transition-colors"
                    >
                      {columns.map((col) => (
                        <td
                          key={col.name}
                          className={`px-3 py-2 whitespace-nowrap max-w-xs truncate ${
                            row[col.name] === null
                              ? 'text-slate-600 italic'
                              : 'text-slate-300'
                          }`}
                          title={formatValue(row[col.name])}
                        >
                          {truncateValue(formatValue(row[col.name]))}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Pagination */}
              {totalCount > PAGE_SIZE && (
                <div className="flex items-center justify-between px-4 py-3 bg-slate-900/50 border-t border-slate-800">
                  <p className="text-xs text-slate-500">
                    Showing {page * PAGE_SIZE + 1}-{Math.min((page + 1) * PAGE_SIZE, totalCount)} of{' '}
                    {totalCount.toLocaleString()}
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => fetchPage(page - 1)}
                      disabled={page === 0}
                      className="px-3 py-1.5 text-xs rounded-md bg-slate-800 text-slate-300 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                      Previous
                    </button>
                    <button
                      onClick={() => fetchPage(page + 1)}
                      disabled={(page + 1) * PAGE_SIZE >= totalCount}
                      className="px-3 py-1.5 text-xs rounded-md bg-slate-800 text-slate-300 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
