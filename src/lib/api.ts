import type {
  RefactorRequest,
  RefactorResponse,
  CleanupRequest,
  SchemaResponse,
  PlanRequest,      // { renames: RenameOperation[], useSynonyms?: boolean, useViews?: boolean, cqrs?: boolean }
  PlanResponse,     // { sql: { renameSql?: string; compatSql?: string; cleanupSql?: string }, report?: {...} }
  CodeFixRequest,   // { rootKey: string; plan: { renames: [...] }; apply: boolean; includeGlobs?: string[]; excludeGlobs?: string[] }
  CodefixResult,
} from "./types";

function getApiBase() {
  const raw =
    process.env.NEXT_PUBLIC_DBREFACTOR_API ??
    process.env.DBREFACTOR_API;
  if (!raw) throw new Error("Falta NEXT_PUBLIC_DBREFACTOR_API (o DBREFACTOR_API).");
  return raw.replace(/\/+$/, "");
}

async function fetchApi<T>(
  endpoint: string,
  options: RequestInit = {},
  timeoutMs = 60000
): Promise<T> {
  const base = getApiBase();
  const finalUrl = `${base}/${endpoint.replace(/^\//, "")}`;

  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);

  const headers: HeadersInit = {
    Accept: "application/json",
    ...(options.body ? { "Content-Type": "application/json" } : {}),
    ...(options.headers || {}),
  };

  try {
    // Útil para depurar URL reales:
    // console.debug("[DBRefactor] ->", finalUrl, options);
    const res = await fetch(finalUrl, {
      cache: "no-store",
      // @ts-ignore Next.js
      next: { revalidate: 0 },
      ...options,
      headers,
      signal: controller.signal,
    });

    const text = await res.text();
    let payload: any = null;
    try { payload = text ? JSON.parse(text) : null; } catch { payload = text; }

    if (!res.ok) {
      const message =
        (payload && (payload.error || payload.title || payload.message)) ||
        `HTTP ${res.status} ${res.statusText}`;
      const details =
        (payload && (payload.stack || payload.detail)) ||
        (typeof payload === "string" ? payload : JSON.stringify(payload, null, 2));
      throw new Error(`${message}\n\n${details ?? ""}`.trim());
    }
    return payload as T;
  } catch (err: any) {
    if (err?.name === "AbortError") {
      throw new Error(`Timeout (${timeoutMs} ms) llamando a ${finalUrl}`);
    }
    throw new Error(err?.message || "Fallo de red desconocido. Revisa URL, CORS y la API.");
  } finally {
    clearTimeout(id);
  }
}

/** GET /analyze/schema?connectionString=... */
export async function analyzeSchema(connectionString: string): Promise<SchemaResponse> {
  const qs = encodeURIComponent(connectionString);
  return fetchApi<SchemaResponse>(`/analyze/schema?connectionString=${qs}`);
}

/** POST /plan    (NO requiere connectionString) */
export async function generatePlan(data: PlanRequest): Promise<PlanResponse> {
  // data = { renames, useSynonyms?, useViews?, cqrs? }
  return fetchApi<PlanResponse>("/plan", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

/** POST /refactor/run  (sí requiere connectionString) */
export async function runRefactor(
  data: Omit<RefactorRequest, "apply">,
  apply: boolean
): Promise<RefactorResponse> {
  const body: RefactorRequest = { ...data, apply };
  return fetchApi<RefactorResponse>("/refactor/run", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

/** POST /apply/cleanup (sí requiere connectionString + renames) */
export async function runCleanup(data: CleanupRequest): Promise<RefactorResponse> {
  return fetchApi<RefactorResponse>("/apply/cleanup", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

/** POST /codefix/run (NO requiere connectionString) */
export async function runCodeFix(data: CodeFixRequest): Promise<CodefixResult> {
  return fetchApi<CodefixResult>("/codefix/run", {
    method: "POST",
    body: JSON.stringify(data),
  });
}
