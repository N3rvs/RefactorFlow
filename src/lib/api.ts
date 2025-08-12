"use server";

import type {
  RefactorRequest,
  RefactorResponse,
  CleanupRequest,
  SchemaResponse,
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
      } catch (e) {
        // Not a JSON response
        errorData = { error: `HTTP error! status: ${response.status}`, details: await response.text() };
      }
      throw new Error(errorData.error || `Request failed with status ${response.status}`);
    }
    
    return await response.json();
  } catch (error: any) {
    console.error(`API call to ${url} failed:`, error);
    throw new Error(error.message || "An unknown network error occurred.");
  }
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

export async function analyzeSchema(connectionString: string): Promise<SchemaResponse> {
  const encodedConnectionString = encodeURIComponent(connectionString);
  return fetchApi<SchemaResponse>(`/analyze/schema?connectionString=${encodedConnectionString}`);
}
