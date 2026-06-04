import { useState, useCallback } from 'react';
import type { AppSettings, DbConnection } from './lib/types';
import {
  loadSettings,
  addConnection,
  removeConnection,
  setActiveConnection,
  setActiveTable,
  addTableToConnection,
  removeTableFromConnection,
} from './lib/storage';
import ConnectionSetup from './components/ConnectionSetup';
import AddConnectionForm from './components/AddConnectionForm';
import Sidebar from './components/Sidebar';
import QueryView from './components/QueryView';
import { Database } from 'lucide-react';

export default function App() {
  const [settings, setSettings] = useState<AppSettings>(loadSettings);
  const [showAddForm, setShowAddForm] = useState(false);

  const activeConnection = settings.connections.find(
    (c) => c.id === settings.activeConnectionId
  );

  const handleAddConnection = useCallback(
    (name: string, url: string, apiKey: string) => {
      const conn: DbConnection = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name,
        url,
        apiKey,
        tables: [],
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

  const handleAddTable = useCallback((connId: string, tableName: string) => {
    setSettings((prev) => addTableToConnection(prev, connId, tableName));
  }, []);

  const handleRemoveTable = useCallback((connId: string, tableName: string) => {
    setSettings((prev) => removeTableFromConnection(prev, connId, tableName));
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
      />

      <main className="flex-1 flex flex-col min-w-0">
        {activeConnection && settings.activeTable ? (
          <QueryView
            connection={activeConnection}
            tableName={settings.activeTable}
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
    </div>
  );
}
