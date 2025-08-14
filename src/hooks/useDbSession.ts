
import { useCallback, useEffect, useRef, useState } from "react";
import { connectSession, disconnectSession } from "@/lib/api";

export function useDbSession() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const expireAt = useRef<number | null>(null);
  const sessionRef = useRef<string | null>(null);


  const connect = useCallback(async (connectionString: string, ttlSeconds = 1800) => {
    setLoading(true);
    setError(null);
    try {
        const { sessionId: newSessionId, expiresAtUtc } = await connectSession(connectionString, ttlSeconds);
        setSessionId(newSessionId);
        sessionRef.current = newSessionId;
        expireAt.current = Date.parse(expiresAtUtc);
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
            expireAt.current = null;
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

  return { sessionId, connect, disconnect, expiresAt: expireAt.current, loading, error };
}

    