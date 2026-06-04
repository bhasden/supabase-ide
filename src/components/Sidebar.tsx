import { useState } from 'react';
import {
  Database,
  Table2,
  Plus,
  Minus,
  ChevronDown,
  ChevronRight,
  Search,
  X,
  Loader2,
  HardDrive,
} from 'lucide-react';
import type { DbConnection } from '../lib/types';

type AddTableResult = {
  ok: boolean;
  message?: string;
};

interface SidebarProps {
  connections: DbConnection[];
  activeConnectionId: string | null;
  activeTable: string | null;
  onSelectConnection: (id: string) => void;
  onSelectTable: (tableName: string) => void;
  onAddTable: (connId: string, tableName: string) => Promise<AddTableResult>;
  onRemoveTable: (connId: string, tableName: string) => void;
  onRemoveConnection: (connId: string) => void;
  onOpenAddConnection: () => void;
  onOpenClearLocalData: () => void;
}

export default function Sidebar({
  connections,
  activeConnectionId,
  activeTable,
  onSelectConnection,
  onSelectTable,
  onAddTable,
  onRemoveTable,
  onRemoveConnection,
  onOpenAddConnection,
  onOpenClearLocalData,
}: SidebarProps) {
  const [expandedConnections, setExpandedConnections] = useState<Set<string>>(
    () => new Set(connections.map((c) => c.id))
  );
  const [tableSearch, setTableSearch] = useState('');
  const [tableSearchError, setTableSearchError] = useState<string | null>(null);
  const [addingTableFor, setAddingTableFor] = useState<string | null>(null);
  const [hoveredTable, setHoveredTable] = useState<string | null>(null);
  const [expandedTables, setExpandedTables] = useState<Set<string>>(new Set());

  const toggleExpand = (connId: string) => {
    setExpandedConnections((prev) => {
      const next = new Set(prev);
      if (next.has(connId)) next.delete(connId);
      else next.add(connId);
      return next;
    });
  };

  const toggleTableExpand = (connId: string, tableName: string) => {
    const key = `${connId}::${tableName}`;
    setExpandedTables((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleTableSearchSubmit = async (e: React.FormEvent, connId: string) => {
    e.preventDefault();
    const trimmed = tableSearch.trim();
    if (!trimmed) return;
    setAddingTableFor(connId);
    setTableSearchError(null);
    const result = await onAddTable(connId, trimmed);
    setAddingTableFor(null);

    if (!result.ok) {
      setTableSearchError(result.message ?? 'Table not found');
      return;
    }

    onSelectTable(trimmed);
    setExpandedTables((prev) => new Set(prev).add(`${connId}::${trimmed}`));
    setTableSearch('');
  };

  return (
    <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col shrink-0 h-screen">
      {/* Header */}
      <div className="p-3 border-b border-slate-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-emerald-400">
            <Database size={14} />
            <span className="text-xs font-semibold tracking-wide uppercase">Explorer</span>
          </div>
          <button
            onClick={onOpenAddConnection}
            className="w-6 h-6 flex items-center justify-center rounded-md text-slate-500 hover:text-emerald-400 hover:bg-slate-800 transition-colors"
          >
            <Plus size={14} />
          </button>
        </div>
      </div>

      {/* Connections list */}
      <div className="flex-1 overflow-y-auto">
        {connections.map((conn) => {
          const isExpanded = expandedConnections.has(conn.id);
          const isActive = activeConnectionId === conn.id;

          return (
            <div key={conn.id} className={isActive ? 'bg-slate-800/30' : ''}>
              {/* Connection header */}
              <div className="flex items-center group">
                <button
                  onClick={() => toggleExpand(conn.id)}
                  className="px-1.5 py-2.5 text-slate-500 hover:text-slate-300 transition-colors"
                >
                  {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                </button>
                <button
                  onClick={() => onSelectConnection(conn.id)}
                  className="flex-1 flex items-center gap-2 py-2.5 pr-2 text-left"
                >
                  <Database
                    size={13}
                    className={isActive ? 'text-emerald-400' : 'text-slate-600'}
                  />
                  <span
                    className={`text-sm truncate ${
                      isActive ? 'text-emerald-400 font-medium' : 'text-slate-300'
                    }`}
                  >
                    {conn.name}
                  </span>
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemoveConnection(conn.id);
                  }}
                  className="px-2 py-2.5 opacity-0 group-hover:opacity-100 text-slate-600 hover:text-red-400 transition-all"
                >
                  <Minus size={14} />
                </button>
              </div>

              {/* Tables under connection */}
              {isExpanded && (
                <div className="pb-1">
                  {conn.tables.map((table) => {
                    const isTableActive =
                      isActive && activeTable === table.name;
                    const tableKey = `${conn.id}::${table.name}`;
                    const isHovered = hoveredTable === tableKey;
                    const isTableExpanded = expandedTables.has(tableKey);

                    return (
                      <div key={table.name}>
                        <div
                          className="flex items-center group/table"
                          onMouseEnter={() => setHoveredTable(tableKey)}
                          onMouseLeave={() => setHoveredTable(null)}
                        >
                          <button
                            type="button"
                            onClick={() => toggleTableExpand(conn.id, table.name)}
                            className="pl-6 pr-1 py-1.5 text-slate-600 hover:text-slate-400 transition-colors"
                          >
                            {isTableExpanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                          </button>
                          <button
                            onClick={() => {
                              onSelectConnection(conn.id);
                              onSelectTable(table.name);
                            }}
                            className={`flex-1 flex items-center gap-2 pr-2 py-1.5 text-xs transition-colors ${
                              isTableActive
                                ? 'text-emerald-400 bg-emerald-500/10'
                                : 'text-slate-400 hover:text-slate-200'
                            }`}
                          >
                            <Table2 size={12} />
                            <span className="truncate">{table.name}</span>
                          </button>
                          <button
                            onClick={() => onRemoveTable(conn.id, table.name)}
                            className={`px-2 py-1.5 transition-all ${
                              isHovered
                                ? 'opacity-100 text-slate-500 hover:text-amber-400'
                                : 'opacity-0'
                            }`}
                          >
                            <Minus size={12} />
                          </button>
                        </div>

                        {isTableExpanded && (
                          <div className="pl-12 pr-3 pb-1">
                            <div className="text-[10px] uppercase tracking-wide text-slate-600 mb-1">
                              {table.schema}
                            </div>
                            {table.columns.length > 0 ? (
                              <div className="space-y-0.5">
                                {table.columns.map((column) => (
                                  <div
                                    key={column.name}
                                    className="flex items-center justify-between gap-2 text-[11px]"
                                  >
                                    <span className="truncate text-slate-400">{column.name}</span>
                                    <span className="shrink-0 text-slate-600">{column.type}</span>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="text-[11px] text-slate-600">
                                Columns unavailable
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {/* Add table input */}
                  <form
                    onSubmit={(e) => handleTableSearchSubmit(e, conn.id)}
                    className="px-6 pt-1"
                  >
                    <div className="relative">
                      <Search
                        size={11}
                        className={`absolute left-2 top-1/2 -translate-y-1/2 ${
                          tableSearchError ? 'text-red-400' : 'text-slate-600'
                        }`}
                      />
                      <input
                        type="text"
                        placeholder="Add table..."
                        value={tableSearch}
                        onChange={(e) => {
                          setTableSearch(e.target.value);
                          setTableSearchError(null);
                        }}
                        disabled={addingTableFor === conn.id}
                        className={`w-full bg-slate-800/50 border rounded px-6 py-1 text-[11px] placeholder-slate-600 focus:outline-none disabled:opacity-60 ${
                          tableSearchError
                            ? 'border-red-500/60 text-red-300 focus:ring-1 focus:ring-red-500/50'
                            : 'border-slate-700/50 text-slate-300 focus:ring-1 focus:ring-emerald-500/50'
                        }`}
                      />
                      {addingTableFor === conn.id && (
                        <Loader2
                          size={10}
                          className="absolute right-1.5 top-1/2 -translate-y-1/2 text-emerald-400 animate-spin"
                        />
                      )}
                      {tableSearch && (
                        <button
                          type="button"
                          onClick={() => {
                            setTableSearch('');
                            setTableSearchError(null);
                          }}
                          className={`absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-400 ${
                            addingTableFor === conn.id ? 'hidden' : ''
                          }`}
                        >
                          <X size={10} />
                        </button>
                      )}
                    </div>
                  </form>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="p-2.5 border-t border-slate-800 flex items-center justify-between gap-2">
        <span className="text-[10px] text-slate-600">
          {connections.length} connection{connections.length !== 1 ? 's' : ''}
        </span>
        <button
          type="button"
          onClick={onOpenClearLocalData}
          className="inline-flex items-center gap-1 px-1.5 py-1 rounded-md text-[10px] text-slate-500 hover:text-red-300 hover:bg-red-500/10 transition-colors"
        >
          <HardDrive size={11} />
          Clear
        </button>
      </div>
    </aside>
  );
}
