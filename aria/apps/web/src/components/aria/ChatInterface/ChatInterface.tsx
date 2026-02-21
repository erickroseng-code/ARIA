'use client';

import { MessageList } from './MessageList';
import { InputBar } from './InputBar';
import { useChat } from '@/hooks/useChat';
import { useChatStore } from '@/stores/chatStore';

export function ChatInterface() {
  const { messages, isStreaming, streamingContent, sendMessage } = useChat();
  const pendingDocumentsCount = useChatStore((s) => s.pendingDocumentsCount);

  return (
    <div className="flex flex-col h-[calc(100vh-120px)] max-w-2xl mx-auto gap-4">
      <MessageList messages={messages} isStreaming={isStreaming} streamingContent={streamingContent} />
      <InputBar onSend={sendMessage} disabled={isStreaming} pendingDocumentsCount={pendingDocumentsCount} />
    </div>
  );
}
