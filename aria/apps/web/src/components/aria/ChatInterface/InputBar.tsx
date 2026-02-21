'use client';

import { useRef, useState } from 'react';
import { Send, Paperclip } from 'lucide-react';

interface InputBarProps {
  onSend: (message: string) => void;
  disabled: boolean;
  pendingDocumentsCount?: number;
}

export function InputBar({ onSend, disabled, pendingDocumentsCount = 0 }: InputBarProps) {
  const [message, setMessage] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSend = () => {
    if (message.trim() && !disabled) {
      onSend(message);
      setMessage('');
      if (inputRef.current) {
        inputRef.current.style.height = 'auto';
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Just show the name in a toast - no actual upload
      // File upload processing will be implemented in Epic 2
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
  };

  return (
    <div className="glass-panel p-4 rounded-2xl">
      <div className="flex flex-col gap-3">
        {/* Document counter (Task 8.2) */}
        {pendingDocumentsCount > 0 && (
          <div className="flex items-center gap-2 text-xs text-accent/80">
            <span>📄 {pendingDocumentsCount} documento{pendingDocumentsCount !== 1 ? 's' : ''} pendente{pendingDocumentsCount !== 1 ? 's' : ''}</span>
          </div>
        )}

        <div className="flex gap-3 items-end">
          <button
            onClick={handleFileClick}
            disabled={disabled}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors disabled:opacity-50"
            title="Attach file (coming soon)"
          >
            <Paperclip size={20} className="text-accent" />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.doc,.docx"
            onChange={handleFileSelect}
            className="hidden"
          />

          <textarea
            ref={inputRef}
            value={message}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            placeholder="Envie uma mensagem para ARIA..."
            disabled={disabled}
            rows={1}
            className="flex-1 bg-transparent text-white/90 placeholder-white/40 outline-none resize-none max-h-[120px] disabled:opacity-50"
          />

          <button
            onClick={handleSend}
            disabled={disabled || !message.trim()}
            className="p-2 bg-accent hover:bg-accent-hover text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send size={20} />
          </button>
        </div>
      </div>
    </div>
  );
}
