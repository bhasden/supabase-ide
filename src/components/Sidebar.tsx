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
} from 'lucide-react';
import type { DbConnection } from '../lib/types';

interface SidebarProps {
  connections: DbConnection[];
  activeConnectionId: string | null;
  activeTable: string | null;
  onSelectConnection: (id: string) => void;
  onSelectTable: (tableName: string) => void;
  onAddTable: (connId: string, tableName: string) => void;
  onRemoveTable: (connId: string, tableName: string) => void;
  onRemoveConnection: (connId: string) => void;
  onOpenAddConnection: () => void;
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
}: SidebarProps) {
  const [expandedConnections, setExpandedConnections] = useState<Set<string>>(
    () => new Set(connections.map((c) => c.id))
  );
  const [tableSearch, setTableSearch] = useState('');
  const [hoveredTable, setHoveredTable] = useState<string | null>(null);

  const toggleExpand = (connId: string) => {
    setExpandedConnections((prev) => {
      const next = new Set(prev);
      if (next.has(connId)) next.delete(connId);
      else next.add(connId);
      return next;
    });
  };

  const handleTableSearchSubmit = (e: React.FormEvent, connId: string) => {
    e.preventDefault();
    const trimmed = tableSearch.trim();
    if (!trimmed) return;
    onAddTable(connId, trimmed);
    onSelectTable(trimmed);
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
                      isActive && activeTable === table;
                    const isHovered = hoveredTable === `${conn.id}::${table}`;

                    return (
                      <div
                        key={table}
                        className="flex items-center group/table"
                        onMouseEnter={() => setHoveredTable(`${conn.id}::${table}`)}
                        onMouseLeave={() => setHoveredTable(null)}
                      >
                        <button
                          onClick={() => {
                            onSelectConnection(conn.id);
                            onSelectTable(table);
                          }}
                          className={`flex-1 flex items-center gap-2 pl-8 pr-2 py-1.5 text-xs transition-colors ${
                            isTableActive
                              ? 'text-emerald-400 bg-emerald-500/10'
                              : 'text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          <Table2 size={12} />
                          <span className="truncate">{table}</span>
                        </button>
                        <button
                          onClick={() => onRemoveTable(conn.id, table)}
                          className={`px-2 py-1.5 transition-all ${
                            isHovered
                              ? 'opacity-100 text-slate-500 hover:text-amber-400'
                              : 'opacity-0'
                          }`}
                        >
                          <Minus size={12} />
                        </button>
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
                        className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-600"
                      />
                      <input
                        type="text"
                        placeholder="Add table..."
                        value={tableSearch}
                        onChange={(e) => setTableSearch(e.target.value)}
                        className="w-full bg-slate-800/50 border border-slate-700/50 rounded px-6 py-1 text-[11px] text-slate-300 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                      />
                      {tableSearch && (
                        <button
                          type="button"
                          onClick={() => setTableSearch('')}
                          className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-400"
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
      <div className="p-2.5 border-t border-slate-800 text-[10px] text-slate-600">
        {connections.length} connection{connections.length !== 1 ? 's' : ''}
      </div>
    </aside>
  );
}
