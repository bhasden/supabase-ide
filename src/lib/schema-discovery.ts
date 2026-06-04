import { getSupabaseClient } from './clients';
import type {
  ColumnInfo,
  DbConnection,
  SchemaDiscoveryCapabilities,
  SchemaDiscoveryFeatureStatus,
} from './types';

type JsonSchemaProperty = {
  type?: string | string[];
  format?: string;
  items?: JsonSchemaProperty;
};

type OpenApiDocument = {
  definitions?: Record<string, { properties?: Record<string, JsonSchemaProperty> }>;
  components?: {
    schemas?: Record<string, { properties?: Record<string, JsonSchemaProperty> }>;
  };
};

type GraphqlTypeRef = {
  kind?: string;
  name?: string | null;
  ofType?: GraphqlTypeRef | null;
};

type GraphqlField = {
  name: string;
  type: GraphqlTypeRef;
};

type GraphqlType = {
  kind: string;
  name: string;
  fields?: GraphqlField[] | null;
};

type GraphqlIntrospection = {
  data?: {
    __schema?: {
      types?: GraphqlType[];
    };
  };
};

type TableProbe = {
  rows: Record<string, unknown>[];
  columns: ColumnInfo[];
  schemaDiscovery: SchemaDiscoveryCapabilities;
};

type DiscoverTableSchemaOptions = {
  sampleRows?: boolean;
};

type SchemaEndpointResult = {
  columns: ColumnInfo[] | null;
  status: SchemaDiscoveryFeatureStatus;
};

const ROW_SAMPLE_SIZE = 25;

const GRAPHQL_INTROSPECTION_QUERY = `
  query SupabaseIdeSchemaIntrospection {
    __schema {
      types {
        kind
        name
        fields {
          name
          type {
            kind
            name
            ofType {
              kind
              name
              ofType {
                kind
                name
                ofType {
                  kind
                  name
                }
              }
            }
          }
        }
      }
    }
  }
`;

export async function discoverTableSchema(
  connection: DbConnection,
  tableName: string,
  options: DiscoverTableSchemaOptions = {}
): Promise<TableProbe> {
  const shouldSampleRows = options.sampleRows ?? true;
  const currentCapabilities = {
    restOpenApi: connection.schemaDiscovery?.restOpenApi ?? 'unknown',
    graphql: connection.schemaDiscovery?.graphql ?? 'unknown',
  } satisfies SchemaDiscoveryCapabilities;

  const [probe, openApiColumns, graphqlColumns] = await Promise.all([
    shouldSampleRows
      ? probeTable(connection, tableName)
      : Promise.resolve({ rows: [] }),
    currentCapabilities.restOpenApi === 'unavailable'
      ? Promise.resolve<SchemaEndpointResult>({
          columns: null,
          status: currentCapabilities.restOpenApi,
        })
      : fetchOpenApiColumns(connection, tableName),
    currentCapabilities.graphql === 'unavailable'
      ? Promise.resolve<SchemaEndpointResult>({
          columns: null,
          status: currentCapabilities.graphql,
        })
      : fetchGraphqlColumns(connection, tableName),
  ]);

  const columns = mergeColumnMetadata(
    openApiColumns.columns ?? graphqlColumns.columns ?? [],
    inferColumnsFromRows(probe.rows)
  );

  return {
    rows: probe.rows,
    columns,
    schemaDiscovery: {
      restOpenApi: openApiColumns.status,
      graphql: graphqlColumns.status,
    },
  };
}

export function inferColumnsFromRow(row: Record<string, unknown>): ColumnInfo[] {
  return inferColumnsFromRows([row]);
}

export function inferColumnsFromRows(rows: Record<string, unknown>[]): ColumnInfo[] {
  const columnNames: string[] = [];
  const seenColumns = new Set<string>();

  rows.forEach((row) => {
    Object.keys(row).forEach((key) => {
      if (!seenColumns.has(key)) {
        seenColumns.add(key);
        columnNames.push(key);
      }
    });
  });

  return columnNames.map((key) => ({
    name: key,
    type: inferTypeFromValues(rows.map((row) => row[key])),
  }));
}

function inferTypeFromValues(values: unknown[]): string {
  const concreteValues = values.filter((value) => value !== null && value !== undefined);
  if (concreteValues.length === 0) return 'text';

  const inferredTypes = concreteValues.map(inferTypeFromValue);
  if (inferredTypes.every((type) => type === 'uuid')) return 'uuid';
  if (inferredTypes.every((type) => type === 'date')) return 'date';
  if (inferredTypes.every((type) => type === 'date' || type === 'timestamptz')) return 'timestamptz';
  if (inferredTypes.every((type) => type === 'boolean')) return 'boolean';
  if (inferredTypes.every((type) => type === 'jsonb')) return 'jsonb';
  if (inferredTypes.every((type) => type === 'integer')) return 'integer';
  if (inferredTypes.every((type) => type === 'integer' || type === 'numeric')) return 'numeric';

  return 'text';
}

function inferTypeFromValue(value: unknown): string {
  if (typeof value === 'number') {
    return Number.isInteger(value) ? 'integer' : 'numeric';
  }

  if (typeof value === 'boolean') return 'boolean';
  if (typeof value === 'string') {
    if (isUuid(value)) return 'uuid';
    return inferIsoDateType(value) ?? 'text';
  }
  if (typeof value === 'object' && value !== null) return 'jsonb';
  return 'text';
}

async function probeTable(connection: DbConnection, tableName: string): Promise<{
  rows: Record<string, unknown>[];
}> {
  const client = getSupabaseClient(connection.url, connection.apiKey);
  const { data, error } = await client.from(tableName).select('*').limit(ROW_SAMPLE_SIZE);

  if (error) throw error;

  return {
    rows: (data as Record<string, unknown>[] | null) ?? [],
  };
}

async function fetchOpenApiColumns(
  connection: DbConnection,
  tableName: string
): Promise<SchemaEndpointResult> {
  try {
    const response = await fetch(`${connection.url}/rest/v1/`, {
      headers: {
        apikey: connection.apiKey,
        Authorization: `Bearer ${connection.apiKey}`,
        Accept: 'application/openapi+json',
      },
    });

    if (!response.ok) {
      return { columns: null, status: 'unavailable' };
    }

    const spec = (await response.json()) as OpenApiDocument;
    const schema =
      spec.definitions?.[tableName] ??
      spec.components?.schemas?.[tableName] ??
      findCaseInsensitiveSchema(spec.definitions, tableName) ??
      findCaseInsensitiveSchema(spec.components?.schemas, tableName);

    if (!schema?.properties) {
      return { columns: null, status: 'available' };
    }

    return {
      columns: Object.entries(schema.properties).map(([name, property]) => ({
        name,
        type: mapOpenApiType(property),
      })),
      status: 'available',
    };
  } catch {
    return { columns: null, status: 'unavailable' };
  }
}

async function fetchGraphqlColumns(
  connection: DbConnection,
  tableName: string
): Promise<SchemaEndpointResult> {
  try {
    const response = await fetch(`${connection.url}/graphql/v1`, {
      method: 'POST',
      headers: {
        apikey: connection.apiKey,
        Authorization: `Bearer ${connection.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: GRAPHQL_INTROSPECTION_QUERY }),
    });

    if (!response.ok) {
      return { columns: null, status: 'unavailable' };
    }

    const introspection = (await response.json()) as GraphqlIntrospection;
    const types = introspection.data?.__schema?.types;
    if (!types) {
      return { columns: null, status: 'unavailable' };
    }

    const typeMap = new Map(types.map((type) => [type.name, type]));
    const tableType = findGraphqlTableType(types, typeMap, tableName);
    if (!tableType?.fields) {
      return { columns: null, status: 'available' };
    }

    return {
      columns: tableType.fields
        .filter((field) => field.name !== 'nodeId')
        .map((field) => ({
          name: field.name,
          type: mapGraphqlType(field.type),
        })),
      status: 'available',
    };
  } catch {
    return { columns: null, status: 'unavailable' };
  }
}

export function mergeColumnMetadata(preferred: ColumnInfo[], fallback: ColumnInfo[]): ColumnInfo[] {
  if (preferred.length === 0) return fallback;
  if (fallback.length === 0) return preferred;

  const preferredNames = new Set(preferred.map((column) => column.name));
  const fallbackByName = new Map(fallback.map((column) => [column.name, column]));

  return [
    ...preferred.map((column) => mergeColumn(column, fallbackByName.get(column.name))),
    ...fallback.filter((column) => !preferredNames.has(column.name)),
  ];
}

function mergeColumn(preferred: ColumnInfo, fallback: ColumnInfo | undefined): ColumnInfo {
  if (!fallback || preferred.type === fallback.type) return preferred;

  if (isGenericType(preferred.type) && !isGenericType(fallback.type)) {
    return { ...preferred, type: fallback.type };
  }

  return preferred;
}

function isGenericType(type: string): boolean {
  return ['text', 'unknown', 'string'].includes(type.toLowerCase());
}

function findCaseInsensitiveSchema(
  schemas: OpenApiDocument['definitions'],
  tableName: string
) {
  if (!schemas) return undefined;
  const key = Object.keys(schemas).find(
    (schemaName) => schemaName.toLowerCase() === tableName.toLowerCase()
  );
  return key ? schemas[key] : undefined;
}

export function mapOpenApiType(property: JsonSchemaProperty): string {
  const type = Array.isArray(property.type) ? property.type.find((part) => part !== 'null') : property.type;

  if (property.format === 'uuid') return 'uuid';
  if (type === 'integer') return property.format === 'int64' ? 'bigint' : 'integer';
  if (type === 'number') return 'numeric';
  if (type === 'boolean') return 'boolean';
  if (type === 'array') {
    const itemType = property.items ? mapOpenApiType(property.items) : 'unknown';
    return `${itemType}[]`;
  }
  if (type === 'object') return 'jsonb';
  if (property.format === 'date') return 'date';
  if (property.format === 'date-time') return 'timestamptz';
  return 'text';
}

function findGraphqlTableType(
  types: GraphqlType[],
  typeMap: Map<string, GraphqlType>,
  tableName: string
): GraphqlType | null {
  const directCandidates = new Set([
    tableName,
    toPascalCase(tableName),
    toCamelCase(tableName),
  ]);

  for (const candidate of directCandidates) {
    const type = typeMap.get(candidate);
    if (type?.kind === 'OBJECT' && hasUserFields(type)) return type;
  }

  const queryType = typeMap.get('Query');
  const collectionField = queryType?.fields?.find((field) => {
    const expectedNames = new Set([
      `${tableName}Collection`,
      `${toCamelCase(tableName)}Collection`,
      `${toPascalCase(tableName)}Collection`,
    ]);
    return expectedNames.has(field.name);
  });

  const collectionTypeName = unwrapTypeName(collectionField?.type);
  const collectionType = collectionTypeName ? typeMap.get(collectionTypeName) : undefined;
  const nodeTypeName = findCollectionNodeTypeName(collectionType, typeMap);
  const nodeType = nodeTypeName ? typeMap.get(nodeTypeName) : undefined;

  if (nodeType?.kind === 'OBJECT' && hasUserFields(nodeType)) return nodeType;

  return (
    types.find(
      (type) =>
        type.kind === 'OBJECT' &&
        hasUserFields(type) &&
        type.name.toLowerCase() === tableName.toLowerCase()
    ) ?? null
  );
}

function findCollectionNodeTypeName(
  collectionType: GraphqlType | undefined,
  typeMap: Map<string, GraphqlType>
): string | null {
  const edgesField = collectionType?.fields?.find((field) => field.name === 'edges');
  const edgeTypeName = unwrapTypeName(edgesField?.type);
  const edgeType = edgeTypeName ? typeMap.get(edgeTypeName) : undefined;
  const nodeField = edgeType?.fields?.find((field) => field.name === 'node');
  return unwrapTypeName(nodeField?.type);
}

function hasUserFields(type: GraphqlType): boolean {
  return Boolean(type.fields?.some((field) => field.name !== 'nodeId' && !field.name.startsWith('__')));
}

function unwrapTypeName(type: GraphqlTypeRef | undefined | null): string | null {
  if (!type) return null;
  if (type.name) return type.name;
  return unwrapTypeName(type.ofType);
}

export function mapGraphqlType(type: GraphqlTypeRef): string {
  const name = unwrapTypeName(type);

  switch (name) {
    case 'UUID':
      return 'uuid';
    case 'Int':
      return 'integer';
    case 'BigInt':
      return 'bigint';
    case 'Float':
    case 'BigFloat':
      return 'numeric';
    case 'Boolean':
      return 'boolean';
    case 'Date':
      return 'date';
    case 'Datetime':
      return 'timestamptz';
    case 'JSON':
      return 'jsonb';
    default:
      return 'text';
  }
}

function toPascalCase(value: string): string {
  return value
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}

function toCamelCase(value: string): string {
  const pascal = toPascalCase(value);
  return pascal.charAt(0).toLowerCase() + pascal.slice(1);
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value.trim());
}

function inferIsoDateType(value: string): 'date' | 'timestamptz' | null {
  const trimmed = value.trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return isValidDateOnly(trimmed) ? 'date' : null;
  }

  if (
    /^\d{4}-\d{2}-\d{2}[Tt ][0-2]\d:[0-5]\d(?::[0-5]\d(?:\.\d{1,9})?)?(?:Z|[+-]\d{2}:?\d{2})?$/.test(trimmed) &&
    Number.isFinite(Date.parse(trimmed))
  ) {
    return 'timestamptz';
  }

  return null;
}

function isValidDateOnly(value: string): boolean {
  const [year, month, day] = value.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));

  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  );
}
