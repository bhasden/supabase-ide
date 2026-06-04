import type { AppSettings, DbConnection } from './types';

const STORAGE_KEY = 'supabase-explorer-settings';

const defaultSettings: AppSettings = {
  connections: [],
  activeConnectionId: null,
  activeTable: null,
};

export function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultSettings;
    return { ...defaultSettings, ...JSON.parse(raw) };
  } catch {
    return defaultSettings;
  }
}

export function saveSettings(settings: AppSettings): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

export function addConnection(settings: AppSettings, conn: DbConnection): AppSettings {
  const next = {
    ...settings,
    connections: [...settings.connections, conn],
    activeConnectionId: conn.id,
    activeTable: null,
  };
  saveSettings(next);
  return next;
}

export function removeConnection(settings: AppSettings, connId: string): AppSettings {
  const next = {
    ...settings,
    connections: settings.connections.filter((c) => c.id !== connId),
    activeConnectionId:
      settings.activeConnectionId === connId
        ? (settings.connections.find((c) => c.id !== connId)?.id ?? null)
        : settings.activeConnectionId,
    activeTable:
      settings.activeConnectionId === connId ? null : settings.activeTable,
  };
  saveSettings(next);
  return next;
}

export function updateConnection(settings: AppSettings, conn: DbConnection): AppSettings {
  const next = {
    ...settings,
    connections: settings.connections.map((c) => (c.id === conn.id ? conn : c)),
  };
  saveSettings(next);
  return next;
}

export function setActiveConnection(settings: AppSettings, connId: string | null): AppSettings {
  const next = {
    ...settings,
    activeConnectionId: connId,
    activeTable: null,
  };
  saveSettings(next);
  return next;
}

export function setActiveTable(settings: AppSettings, tableName: string | null): AppSettings {
  const next = {
    ...settings,
    activeTable: tableName,
  };
  saveSettings(next);
  return next;
}

export function addTableToConnection(
  settings: AppSettings,
  connId: string,
  tableName: string
): AppSettings {
  const conn = settings.connections.find((c) => c.id === connId);
  if (!conn) return settings;
  if (conn.tables.includes(tableName)) return settings;
  const updated: DbConnection = { ...conn, tables: [...conn.tables, tableName] };
  return updateConnection(settings, updated);
}

export function removeTableFromConnection(
  settings: AppSettings,
  connId: string,
  tableName: string
): AppSettings {
  const conn = settings.connections.find((c) => c.id === connId);
  if (!conn) return settings;
  const updated: DbConnection = {
    ...conn,
    tables: conn.tables.filter((t) => t !== tableName),
  };
  const next = updateConnection(settings, updated);
  if (settings.activeTable === tableName && settings.activeConnectionId === connId) {
    return setActiveTable(next, null);
  }
  return next;
}
