import type {
  RefactorRequest,
  RefactorResponse,
  CleanupRequest,
  SchemaResponse,
  PlanRequest,
  PlanResponse,
  CodeFixRequest,
  CodefixResult,
  ApplyRequest 
} from "./types";

function getApiBase() {
  const raw =
    process.env.NEXT_PUBLIC_DBREFACTOR_API ??
    process.env.DBREFACTOR_API; 
  if (!raw) throw new Error("Falta la variable de entorno NEXT_PUBLIC_DBREFACTOR_API/DBREFACTOR_API.");
 
  return raw.replace(/\/+$/, "");
}

async function fetchApi<T>(
  endpoint: string,
  options: RequestInit = {},
  timeoutMs = 60000
): Promise<T> {
  const base = getApiBase();
  
  const finalUrl = `${base}/${endpoint.replace(/^\//, '')}`;

  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
 
  const headers: HeadersInit = {
    Accept: "application/json",
    ...(options.body ? { "Content-Type": "application/json" } : {}),
    ...(options.headers || {})
  };

  try {
    const res = await fetch(finalUrl, {
      cache: "no-store",
      // @ts-ignore Next.js hint
      next: { revalidate: 0 },
      ...options,
      headers,
      signal: controller.signal
    });

    let payload: any = null;
    const text = await res.text();
    try {
      payload = text ? JSON.parse(text) : null;
    } catch {
      payload = text;
    }

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
    console.error(`API call to ${finalUrl} failed:`, err);
    throw new Error(err?.message || "Fallo de red desconocido. Revisa URL, CORS y la API.");
  } finally {
    clearTimeout(id);
  }
}

export async function analyzeSchema(connectionString: string): Promise<SchemaResponse> {
  const qs = encodeURIComponent(connectionString);
  return fetchApi<SchemaResponse>(`/analyze/schema?connectionString=${qs}`, { method: 'GET' });
}

export async function generatePlan(data: PlanRequest): Promise<PlanResponse> {
  return fetchApi<PlanResponse>("/plan", {
    method: "POST",
    body: JSON.stringify(data)
  });
}

export async function runApply(data: ApplyRequest): Promise<{
  ok: boolean;
  log?: string;
  sql?: { renameSql?: string; compatSql?: string };
}> {
  return fetchApi("/apply", {
    method: "POST",
    body: JSON.stringify(data)
  });
}

export async function runCleanup(data: CleanupRequest): Promise<RefactorResponse> {
  return fetchApi<RefactorResponse>("/apply/cleanup", {
    method: "POST",
    body: JSON.stringify(data)
  });
}

export async function runRefactor(
  data: Omit<RefactorRequest, "apply">,
  apply: boolean
): Promise<RefactorResponse> {
  const body: RefactorRequest = { ...data, apply };
  return fetchApi<RefactorResponse>("/refactor/run", {
    method: "POST",
    body: JSON.stringify(body)
  });
}

export async function runCodeFix(data: CodeFixRequest): Promise<CodefixResult> {
  return fetchApi<CodefixResult>("/codefix/run", {
    method: "POST",
    body: JSON.stringify(data)
  });
}
