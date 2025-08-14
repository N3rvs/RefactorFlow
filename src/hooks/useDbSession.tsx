
"use client";

import React, { createContext, useCallback, useEffect, useRef, useState } from "react";
import { connectSession, disconnectSession } from "@/lib/api";

interface DbSessionContextType {
    sessionId: string | null;
    connect: (connectionString: string, ttlSeconds?: number) => Promise<string>;
    disconnect: () => Promise<void>;
    expiresAt: number | null;
    loading: boolean;
    error: string | null;
}

export const DbSessionContext = createContext<DbSessionContextType | null>(null);

export const DbSessionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const sessionRef = useRef<string | null>(null);

  const connect = useCallback(async (connectionString: string, ttlSeconds = 1800) => {
    setLoading(true);
    setError(null);
    try {
        const { sessionId: newSessionId, expiresAtUtc } = await connectSession(connectionString, ttlSeconds);
        setSessionId(newSessionId);
        sessionRef.current = newSessionId;
        const expires = Date.parse(expiresAtUtc);
        setExpiresAt(expires);
        return newSessionId;
    } catch(err: any) {
        setError(err.message || "Failed to connect");
        throw err;
    } finally {
        setLoading(false);
    }
  }, []);

  const disconnect = useCallback(async () => {
    const currentSessionId = sessionRef.current;
    if (currentSessionId) {
        setLoading(true);
        try { 
            await disconnectSession(currentSessionId);
        } catch(err) {
             console.error("Failed to disconnect session, clearing locally.", err);
        } finally {
            setSessionId(null);
            sessionRef.current = null;
            setExpiresAt(null);
            setLoading(false);
        }
    }
  }, []);

  // Limpieza al cerrar pestaña
  useEffect(() => {
    const onUnload = () => { 
        if(sessionRef.current) {
            // This is a best-effort call and likely won't complete,
            // but it's worth a try. The server will clean up expired sessions.
            navigator.sendBeacon(`/session/disconnect`, JSON.stringify({ sessionId: sessionRef.current }));
        }
    };
    window.addEventListener("beforeunload", onUnload);
    return () => window.removeEventListener("beforeunload", onUnload);
  }, []);
  
  const value = { sessionId, connect, disconnect, expiresAt, loading, error };

  return (
    <DbSessionContext.Provider value={value}>
        {children}
    </DbSessionContext.Provider>
  )
}

export function useDbSession() {
  const context = React.useContext(DbSessionContext);
  if (!context) {
    throw new Error("useDbSession must be used within a DbSessionProvider");
  }
  return context;
}

    