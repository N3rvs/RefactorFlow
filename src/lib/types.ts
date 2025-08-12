export interface RenameOperation {
  scope: "column" | "table";
  tableFrom: string;
  tableTo?: string;
  columnFrom?: string;
  columnTo?: string;
  type?: string;
}

export interface RefactorPlan {
  renames: RenameOperation[];
}

export interface RefactorRequest {
  connectionString: string;
  plan: RefactorPlan;
  apply: boolean;
  rootKey: string;
  useSynonyms: boolean;
  useViews: boolean;
  cqrs: boolean;
}

export interface CleanupRequest {
  connectionString: string;
  renames: RenameOperation[];
  useSynonyms: boolean;
  useViews: boolean;
  cqrs: boolean;
}

export interface SqlScripts {
  renameSql?: string;
  compatSql?: string;
  cleanupSql?: string;
}

export interface CodefixFile {
  path: string;
  changed: boolean;
}

export interface CodefixResult {
  scanned: number;
  changed: number;
  files: CodefixFile[];
}

export interface RefactorResponse {
  ok: boolean;
  apply?: boolean;
  dbLog?: string;
  log?: string; // for cleanup
  sql: SqlScripts;
  codefix: CodefixResult;
  error?: string;
  stack?: string;
}

// Types for /analyze/schema
export interface Column {
    name: string;
    sqlType: string;
    isNullable: boolean;
}

export interface Table {
    schema: string;
    name: string;
    columns: Column[];
    foreignKeys: any[];
    indexes: any[];
}

export interface SchemaResponse {
    tables: Table[];
}
