'use client';

import { useCallback, useEffect, useState } from 'react';

export interface SessionInfo {
  sessionId: string;
  activeClientId?: string;
  messageCount: number;
  createdAt: string | null;
  lastMessageAt: string | null;
}

export function useSession(sessionId: string) {
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadSession = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/chat/session/${sessionId}`);
      if (!response.ok) {
        throw new Error('Failed to load session');
      }

      const data = await response.json();
      setSession(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    loadSession();
  }, [sessionId, loadSession]);

  return { session, loading, error, reload: loadSession };
}
