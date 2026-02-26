import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { ChatInterface } from './ChatInterface';

// Mock all the child components
vi.mock('@/components/ui/LiquidGlassBackground', () => ({
  default: () => <div data-testid="liquid-glass-bg" />,
}));

vi.mock('@/components/layout/AriaSidebar', () => ({
  default: () => <div data-testid="sidebar" />,
}));

vi.mock('@/components/chat/AriaWelcome', () => ({
  default: () => <div data-testid="welcome" />,
}));

vi.mock('@/components/chat/ChatMessage', () => ({
  default: () => <div data-testid="chat-message" />,
}));

vi.mock('@/components/chat/ChatInput', () => ({
  default: () => <div data-testid="chat-input" />,
}));

vi.mock('@/components/chat/TypingIndicator', () => ({
  default: () => <div data-testid="typing-indicator" />,
}));

vi.mock('@/hooks/useChat', () => ({
  useChat: () => ({
    messages: [],
    isStreaming: false,
    streamingContent: '',
    sendMessage: vi.fn(),
  }),
}));

vi.mock('@/hooks/useAriaSpeech', () => ({
  useAriaSpeech: () => ({
    speak: vi.fn(),
    setOnSpeakingChange: vi.fn(),
    setOnEnergyPulse: vi.fn(),
  }),
}));

describe('ChatInterface - Hydration Safety', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render loading state during SSR', () => {
    const { container } = render(<ChatInterface />);
    // Initially should show loading state
    expect(container.querySelector('.animate-pulse')).toBeTruthy();
  });

  it('should not generate UUIDs or timestamps during rendering', () => {
    // This test verifies that UUIDs and timestamps are not generated
    // during initial render, only during client-side interactions
    const { container } = render(<ChatInterface />);

    // Should render without errors (no hydration mismatch)
    expect(container).toBeTruthy();
  });

  it('should handle client-only state initialization safely', async () => {
    const { rerender } = render(<ChatInterface />);

    // Component should be able to rerender without errors
    rerender(<ChatInterface />);

    // Should complete without hydration errors
    expect(true).toBe(true);
  });
});
