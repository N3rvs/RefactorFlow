"use server";

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

async function getApiUrl() {
  const apiUrl = process.env.NEXT_PUBLIC_DBREFACTOR_API;
  if (!apiUrl) {
    throw new Error("NEXT_PUBLIC_DBREFACTOR_API environment variable is not set.");
  }
  return apiUrl;
}

async function fetchApi<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const apiUrl = await getApiUrl();
  const url = `${apiUrl}${endpoint}`;
  
  const defaultOptions: RequestInit = {
    headers: {
      "Content-Type": "application/json",
    },
    ...options,
  };

  try {
    const response = await fetch(url, defaultOptions);

    if (!response.ok) {
      let errorData;
      try {
        errorData = await response.json();
        // The backend seems to use 'error' or 'title' for error messages.
        const message = errorData.error || errorData.title || `Request failed with status ${response.status}`;
        const details = errorData.stack || errorData.detail || JSON.stringify(errorData, null, 2);
        throw new Error(`${message}\n\n${details}`);

      } catch (e) {
        // Not a JSON response or other parsing error
        const textResponse = await response.text();
        throw new Error(`HTTP error! status: ${response.status}\n\n${textResponse}`);
      }
    }
    
    return await response.json();
  } catch (error: any) {
    console.error(`API call to ${url} failed:`, error);
    throw new Error(error.message || "An unknown network error occurred. Check API URL, CORS, and if the backend is running.");
  }
}

export async function analyzeSchema(connectionString: string): Promise<SchemaResponse> {
  const encodedConnectionString = encodeURIComponent(connectionString);
  return fetchApi<SchemaResponse>(`/analyze/schema?connectionString=${encodedConnectionString}`);
}

export async function generatePlan(data: PlanRequest): Promise<PlanResponse> {
    return fetchApi<PlanResponse>("/plan", {
        method: "POST",
        body: JSON.stringify(data)
    });
}

export async function runRefactor(data: Omit<RefactorRequest, 'apply'>, apply: boolean): Promise<RefactorResponse> {
  const body: RefactorRequest = { ...data, apply };
  return fetchApi<RefactorResponse>("/refactor/run", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function runCleanup(data: CleanupRequest): Promise<RefactorResponse> {
  return fetchApi<RefactorResponse>("/apply/cleanup", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function runCodeFix(data: CodeFixRequest): Promise<CodefixResult> {
    return fetchApi<CodefixResult>("/codefix/run", {
        method: "POST",
        body: JSON.stringify(data),
    });
}
