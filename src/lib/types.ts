export interface DbConnection {
  id: string;
  name: string;
  url: string;
  apiKey: string;
  tables: string[];
  createdAt: number;
}

export interface AppSettings {
  connections: DbConnection[];
  activeConnectionId: string | null;
  activeTable: string | null;
}

export interface ColumnInfo {
  name: string;
  type: string;
}
