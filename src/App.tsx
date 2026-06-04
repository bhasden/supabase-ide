import { useState, useCallback } from 'react';
import type { AppSettings, ColumnInfo, DbConnection, SavedTable, TableViewState } from './lib/types';
import {
  loadSettings,
  addConnection,
  clearLocalData,
  defaultTableViewState,
  defaultSchemaDiscoveryCapabilities,
  removeConnection,
  setActiveConnection,
  setActiveTable,
  addTableToConnection,
  removeTableFromConnection,
  updateTableInConnection,
  updateConnectionSchemaDiscovery,
} from './lib/storage';
import type { ClearLocalDataCategory } from './lib/storage';
import { discoverTableSchema } from './lib/schema-discovery';
import ConnectionSetup from './components/ConnectionSetup';
import AddConnectionForm from './components/AddConnectionForm';
import ClearLocalDataDialog from './components/ClearLocalDataDialog';
import Sidebar from './components/Sidebar';
import QueryView from './components/QueryView';
import { Database } from 'lucide-react';

export default function App() {
  const [settings, setSettings] = useState<AppSettings>(loadSettings);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showClearLocalData, setShowClearLocalData] = useState(false);

  const activeConnection = settings.connections.find(
    (c) => c.id === settings.activeConnectionId
  );
  const activeConnectionId = activeConnection?.id ?? null;
  const activeSavedTable = activeConnection?.tables.find(
    (table) => table.name === settings.activeTable
  );

  const handleAddConnection = useCallback(
    (name: string, url: string, apiKey: string) => {
      const conn: DbConnection = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name,
        url,
        apiKey,
        tables: [],
        schemaDiscovery: defaultSchemaDiscoveryCapabilities,
        createdAt: Date.now(),
      };
      setSettings((prev) => addConnection(prev, conn));
      setShowAddForm(false);
    },
    []
  );

  const handleRemoveConnection = useCallback((connId: string) => {
    setSettings((prev) => removeConnection(prev, connId));
  }, []);

  const handleSelectConnection = useCallback((connId: string) => {
    setSettings((prev) => setActiveConnection(prev, connId));
  }, []);

  const handleSelectTable = useCallback((tableName: string) => {
    setSettings((prev) => setActiveTable(prev, tableName));
  }, []);

  const handleAddTable = useCallback(async (connId: string, tableName: string) => {
    const conn = settings.connections.find((connection) => connection.id === connId);
    if (!conn) return { ok: false, message: 'Connection not found' };

    const existingTable = conn.tables.find((table) => table.name === tableName);
    if (existingTable) {
      setSettings((prev) => setActiveTable(prev, tableName));
      return { ok: true };
    }

    let discovered;
    try {
      discovered = await discoverTableSchema(conn, tableName);
    } catch (error) {
      return {
        ok: false,
        message: error instanceof Error ? error.message : 'Table not found',
      };
    }

    const table: SavedTable = {
      name: tableName,
      schema: 'public',
      columns: discovered.columns,
      viewState: defaultTableViewState,
      addedAt: Date.now(),
    };

    setSettings((prev) => {
      const withCapabilities = updateConnectionSchemaDiscovery(
        prev,
        connId,
        discovered.schemaDiscovery
      );
      const withTable = addTableToConnection(withCapabilities, connId, table);
      return setActiveTable(withTable, tableName);
    });
    return { ok: true };
  }, [settings.connections]);

  const handleUpdateConnectionSchemaDiscovery = useCallback((
    connId: string,
    schemaDiscovery: DbConnection['schemaDiscovery']
  ) => {
    setSettings((prev) => {
      const conn = prev.connections.find((connection) => connection.id === connId);
      if (!conn) return prev;

      if (
        conn.schemaDiscovery.restOpenApi === schemaDiscovery.restOpenApi &&
        conn.schemaDiscovery.graphql === schemaDiscovery.graphql
      ) {
        return prev;
      }

      return updateConnectionSchemaDiscovery(prev, connId, schemaDiscovery);
    });
  }, []);

  const handleUpdateTableColumns = useCallback((
    connId: string,
    tableName: string,
    columns: ColumnInfo[]
  ) => {
    setSettings((prev) => {
      const conn = prev.connections.find((connection) => connection.id === connId);
      const table = conn?.tables.find((saved) => saved.name === tableName);
      if (!table) return prev;

      const sameColumns =
        table.columns.length === columns.length &&
        table.columns.every((column, idx) => (
          column.name === columns[idx]?.name && column.type === columns[idx]?.type
        ));

      if (sameColumns) return prev;
      return updateTableInConnection(prev, connId, { ...table, columns });
    });
  }, []);

  const handleActiveColumnsDiscovered = useCallback((columns: ColumnInfo[]) => {
    if (!activeConnectionId || !settings.activeTable) return;
    handleUpdateTableColumns(activeConnectionId, settings.activeTable, columns);
  }, [activeConnectionId, handleUpdateTableColumns, settings.activeTable]);

  const handleActiveSchemaDiscoveryChange = useCallback((
    schemaDiscovery: DbConnection['schemaDiscovery']
  ) => {
    if (!activeConnectionId) return;
    handleUpdateConnectionSchemaDiscovery(activeConnectionId, schemaDiscovery);
  }, [activeConnectionId, handleUpdateConnectionSchemaDiscovery]);

  const handleActiveViewStateChange = useCallback((viewState: TableViewState) => {
    if (!activeConnectionId || !settings.activeTable) return;

    setSettings((prev) => {
      const conn = prev.connections.find((connection) => connection.id === activeConnectionId);
      const table = conn?.tables.find((saved) => saved.name === settings.activeTable);
      if (!table) return prev;

      const sameRules = JSON.stringify(table.viewState.rules) === JSON.stringify(viewState.rules);
      const sameSort = JSON.stringify(table.viewState.sortOrder) === JSON.stringify(viewState.sortOrder);
      if (sameRules && sameSort) return prev;

      return updateTableInConnection(prev, activeConnectionId, { ...table, viewState });
    });
  }, [activeConnectionId, settings.activeTable]);

  const handleRemoveTable = useCallback((connId: string, tableName: string) => {
    setSettings((prev) => removeTableFromConnection(prev, connId, tableName));
  }, []);

  const handleClearLocalData = useCallback((categories: ClearLocalDataCategory[]) => {
    setSettings((prev) => clearLocalData(prev, categories));
    setShowClearLocalData(false);
  }, []);

  // No connections: show setup interstitial
  if (settings.connections.length === 0) {
    return <ConnectionSetup onConnect={handleAddConnection} />;
  }

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100">
      <Sidebar
        connections={settings.connections}
        activeConnectionId={settings.activeConnectionId}
        activeTable={settings.activeTable}
        onSelectConnection={handleSelectConnection}
        onSelectTable={handleSelectTable}
        onAddTable={handleAddTable}
        onRemoveTable={handleRemoveTable}
        onRemoveConnection={handleRemoveConnection}
        onOpenAddConnection={() => setShowAddForm(true)}
        onOpenClearLocalData={() => setShowClearLocalData(true)}
      />

      <main className="flex-1 flex flex-col min-w-0">
        {activeConnection && settings.activeTable ? (
          <QueryView
            key={`${activeConnection.id}:${settings.activeTable}`}
            connection={activeConnection}
            tableName={settings.activeTable}
            initialColumns={activeSavedTable?.columns ?? []}
            initialViewState={activeSavedTable?.viewState ?? defaultTableViewState}
            onColumnsDiscovered={handleActiveColumnsDiscovered}
            onSchemaDiscoveryChange={handleActiveSchemaDiscoveryChange}
            onViewStateChange={handleActiveViewStateChange}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="w-14 h-14 rounded-2xl bg-slate-800/50 flex items-center justify-center mx-auto mb-4">
                <Database size={24} className="text-slate-600" />
              </div>
              <p className="text-sm text-slate-500">
                {activeConnection
                  ? 'Select or add a table to start querying'
                  : 'Select a connection to start exploring'}
              </p>
            </div>
          </div>
        )}
      </main>

      {showAddForm && (
        <AddConnectionForm
          onAdd={handleAddConnection}
          onClose={() => setShowAddForm(false)}
        />
      )}

      {showClearLocalData && (
        <ClearLocalDataDialog
          onClose={() => setShowClearLocalData(false)}
          onConfirm={handleClearLocalData}
        />
      )}
    </div>
  );
}
