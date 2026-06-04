import type { RuleGroupType } from 'react-querybuilder';

export interface ColumnInfo {
  name: string;
  type: string;
}

export type SchemaDiscoveryFeatureStatus = 'unknown' | 'available' | 'unavailable';

export interface SchemaDiscoveryCapabilities {
  restOpenApi: SchemaDiscoveryFeatureStatus;
  graphql: SchemaDiscoveryFeatureStatus;
}

export type ColumnSort = {
  field: string;
  direction: 'asc' | 'desc';
} | null;

export interface TableViewState {
  rules: RuleGroupType;
  sortOrder: ColumnSort;
}

export interface SavedTable {
  name: string;
  schema: string;
  columns: ColumnInfo[];
  viewState: TableViewState;
  addedAt: number;
}

export interface DbConnection {
  id: string;
  name: string;
  url: string;
  apiKey: string;
  tables: SavedTable[];
  schemaDiscovery: SchemaDiscoveryCapabilities;
  createdAt: number;
}

export interface AppSettings {
  connections: DbConnection[];
  activeConnectionId: string | null;
  activeTable: string | null;
}
