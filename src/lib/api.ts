
import type {
  RefactorRequest,
  RefactorResponse,
  CleanupRequest,
  SchemaResponse,
  PlanRequest,
  PlanResponse,
  CodeFixRequest,
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

/* --------- Sessions --------- */
export async function connectSession(connectionString: string, ttlSeconds = 1800) {
  return fetchApi<{ sessionId: string; expiresAtUtc: string }>("/session/connect", {
    method: "POST",
    body: JSON.stringify({ connectionString, ttlSeconds }),
  });
}

export async function disconnectSession(sessionId: string) {
  return fetchApi("/session/disconnect", {
    method: "POST",
    body: JSON.stringify({ sessionId }),
  });
}

/** POST /analyze/schema (con sessionId) */
export async function analyzeSchema(sessionId: string): Promise<SchemaResponse> {
  return fetchApi<SchemaResponse>("/analyze/schema", {
    method: 'POST',
    body: JSON.stringify({ sessionId })
  });
}

/** POST /plan    (NO requiere session) */
export async function generatePlan(data: PlanRequest): Promise<PlanResponse> {
  const raw = await fetchApi<any>("/plan", {
    method: "POST",
    body: JSON.stringify(data),
  });
  const sql = raw?.sql ?? raw?.bundle ?? null;
  return { sql, report: raw?.report ?? null };
}

/** POST /refactor/run  (sí requiere sessionId) */
export async function runRefactor(
  data: RefactorRequest,
): Promise<RefactorResponse> {
  return fetchApi<RefactorResponse>("/refactor/run", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

/** POST /apply/cleanup (sí requiere sessionId) */
export async function runCleanup(data: CleanupRequest): Promise<RefactorResponse> {
  return fetchApi<RefactorResponse>("/apply/cleanup", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

/** POST /codefix/run (NO requiere session) */
export async function runCodeFix(data: CodeFixRequest): Promise<CodefixResult> {
  return fetchApi<CodefixResult>("/codefix/run", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

    