'use client';

interface StreamingMessageProps {
  content: string;
}

export function StreamingMessage({ content }: StreamingMessageProps) {
  return (
    <div className="flex justify-start">
      <div className="glass-panel max-w-md lg:max-w-xl px-4 py-3 rounded-lg text-white/90">
        <div className="whitespace-pre-wrap break-words">{content}</div>
        <span className="inline-block w-1.5 h-5 bg-accent ml-1 animate-pulse" />
      </div>
    </div>
  );
}
