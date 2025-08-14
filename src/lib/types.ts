
export type RenameOperation = {
  scope: "table" | "column" | "add-column" | "drop-table" | "drop-column";
  area?: "write" | "read" | "both";
  tableFrom: string;
  tableTo?: string | null;
  columnFrom?: string | null;
  columnTo?: string | null;
  type?: string | null;
  note?: string | null;
};

export type RefactorPlan = {
  renames: RenameOperation[];
};

// --- Tipos de conexión (solo uno es permitido) ---
type WithSessionId = { sessionId: string; connectionKey?: never; connectionString?: never };
type WithConnectionKey = { connectionKey: string; sessionId?: never; connectionString?: never };
type WithConnectionString = { connectionString: string; sessionId?: never; connectionKey?: never };

type ConnectionType = WithSessionId | WithConnectionKey | WithConnectionString;


export type PlanRequest = {
  renames: RenameOperation[];
  useSynonyms?: boolean;
  useViews?: boolean;
  cqrs?: boolean;
  allowDestructive?: boolean;
};

export interface PlanResponse {
  sql: SqlScripts | null;
  report: {
    tablesChanged: number;
    columnsChanged: number;
    operations: number;
  } | null;
}

export type RefactorRequest = ConnectionType & {
  plan: RefactorPlan;
  apply: boolean;
  rootKey: string;
  useSynonyms: boolean;
  useViews: boolean;
  cqrs: boolean;
};

export type CleanupRequest = ConnectionType & {
  renames: RenameOperation[];
  useSynonyms?: boolean;
  useViews?: boolean;
  cqrs?: boolean;
  allowDestructive?: boolean;
};


export interface CodeFixRequest {
    rootKey: string;
    apply: boolean;
    plan: RefactorPlan;
    includeGlobs?: string[];
    excludeGlobs?: string[];
}

export interface SqlScripts {
  renameSql?: string;
  compatSql?: string;
  cleanupSql?: string;
}

export interface CodefixFile {
  path: string;
  changed: boolean;
  changes?: number; // From API docs
  originalContent?: string;
  modifiedContent?: string;
}

export interface CodefixResult {
  ok: boolean;
  scanned: number;
  changed: number;
  files: CodefixFile[];
}

export interface RefactorResponse {
  ok: boolean;
  apply?: boolean;
  dbLog?: string;
  log?: string; // for cleanup
  sql?: SqlScripts;
  codefix?: CodefixResult;
  error?: string;
  stack?: string;
}

// Types for /analyze/schema
export interface Column {
    name: string;
    sqlType: string;
    isNullable: boolean;
    isPrimaryKey?: boolean;
}

export interface ForeignKey {
  name: string;
  columnName: string;
  referencesTable: string;
  referencesColumn: string;
}

export interface Index {
    name: string;
    columns: string[];
    isPrimary: boolean;
    isUnique: boolean;
}

export interface Table {
    schema: string;
    name: string;
    columns: Column[];
    foreignKeys: ForeignKey[];
    indexes: Index[];
}

export interface SchemaResponse {
    tables: Table[];
}

    