'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useChatStore } from '@/stores/chatStore';
import { streamMessage } from '@/services/chat.service';

export function useChat() {
  const {
    messages,
    isStreaming,
    streamingContent,
    addMessage,
    setStreaming,
    appendStreamChunk,
    commitStreamedMessage,
  } = useChatStore();

  const sessionIdRef = useRef<string>('');

  useEffect(() => {
    if (!sessionIdRef.current) {
      sessionIdRef.current = `web_${crypto.randomUUID()}`;
      sessionStorage.setItem('aria-session-id', sessionIdRef.current);
    }
  }, []);

  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim() || isStreaming) return;

      const sessionId = sessionIdRef.current;

      // Add user message
      addMessage({
        id: crypto.randomUUID(),
        role: 'user',
        content,
        timestamp: new Date(),
        sessionId,
        contentType: 'text',
      });

      setStreaming(true);

      try {
        for await (const chunk of streamMessage(content, sessionId)) {
          appendStreamChunk(chunk);
        }
        commitStreamedMessage();
      } catch (error) {
        console.error('Stream error:', error);
        setStreaming(false);
      }
    },
    [isStreaming, addMessage, setStreaming, appendStreamChunk, commitStreamedMessage]
  );

  return {
    messages,
    isStreaming,
    streamingContent,
    sendMessage,
  };
}
