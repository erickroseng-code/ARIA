import { beforeEach, describe, expect, it, vi } from 'vitest';
import { handleMessage, handleStream, setChatService } from '../chat.controller';
import { processFinanceMessage } from '../../finance/agents/orchestrator';

vi.mock('../../finance/agents/orchestrator', () => ({
  processFinanceMessage: vi.fn(),
}));

type MockReq = {
  body: { content: string; sessionId: string };
  headers: Record<string, string | undefined>;
  log: { info: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };
};

type MockReply = {
  send: ReturnType<typeof vi.fn>;
  hijack?: ReturnType<typeof vi.fn>;
  status?: ReturnType<typeof vi.fn>;
  raw?: {
    writeHead: ReturnType<typeof vi.fn>;
    write: ReturnType<typeof vi.fn>;
    end: ReturnType<typeof vi.fn>;
    socket: { write: ReturnType<typeof vi.fn> };
    flushHeaders: ReturnType<typeof vi.fn>;
  };
};

describe('chat controller finance routing', () => {
  const financeMock = vi.mocked(processFinanceMessage);

  beforeEach(() => {
    vi.clearAllMocks();
    setChatService({
      completeResponse: vi.fn().mockResolvedValue('chat geral'),
      streamResponse: vi.fn(),
    } as unknown as Parameters<typeof setChatService>[0]);
  });

  it('routes finance balance questions to Graham on the regular message endpoint', async () => {
    financeMock.mockResolvedValue({
      reply: 'Receitas: R$ 1.000,00\nDespesas: R$ 250,00\nSaldo: R$ 750,00',
      alerts: [],
    });

    const reply: MockReply = {
      send: vi.fn(),
    };

    const req: MockReq = {
      body: { content: 'qual meu saldo?', sessionId: 'web_123' },
      log: { info: vi.fn(), error: vi.fn() },
      headers: {},
    };

    await handleMessage(req as never, reply as never);

    expect(financeMock).toHaveBeenCalledWith('qual meu saldo?');
    expect(reply.send).toHaveBeenCalledWith({
      reply: 'Receitas: R$ 1.000,00\nDespesas: R$ 250,00\nSaldo: R$ 750,00',
    });
  });

  it('routes finance updates to Graham on the streaming endpoint', async () => {
    financeMock.mockResolvedValue({
      reply: 'Despesa registrada com sucesso.',
      alerts: [],
    });

    const writes: string[] = [];
    const raw = {
      writeHead: vi.fn(),
      write: vi.fn((chunk: string) => {
        writes.push(chunk);
      }),
      end: vi.fn(),
      socket: { write: vi.fn() },
      flushHeaders: vi.fn(),
    };

    const reply: MockReply = {
      hijack: vi.fn(),
      raw,
      status: vi.fn().mockReturnThis(),
      send: vi.fn(),
    };

    const req: MockReq = {
      body: { content: 'gastei R$ 50 no mercado', sessionId: 'web_123' },
      headers: {},
      log: { info: vi.fn(), error: vi.fn() },
    };

    await handleStream(req as never, reply as never);

    expect(financeMock).toHaveBeenCalledWith('gastei R$ 50 no mercado');
    expect(reply.hijack).toHaveBeenCalledTimes(1);
    expect(raw.writeHead).toHaveBeenCalledWith(200, expect.objectContaining({
      'Content-Type': 'text/event-stream',
    }));
    expect(writes.some((chunk) => chunk.includes('"type":"chunk"'))).toBe(true);
    expect(writes.some((chunk) => chunk.includes('"type":"done"'))).toBe(true);
  });

  it('keeps generic chat messages on the standard ChatService flow', async () => {
    const chatService = {
      completeResponse: vi.fn().mockResolvedValue('resposta geral'),
      streamResponse: vi.fn(async function* () {
        yield 'resposta ';
        yield 'geral';
      }),
    } as unknown as Parameters<typeof setChatService>[0];
    setChatService(chatService);

    const reply: MockReply = {
      send: vi.fn(),
    };

    const req: MockReq = {
      body: { content: 'me explica como funciona o projeto?', sessionId: 'web_123' },
      log: { info: vi.fn(), error: vi.fn() },
      headers: {},
    };

    await handleMessage(req as never, reply as never);

    expect(financeMock).not.toHaveBeenCalled();
    expect(chatService.completeResponse).toHaveBeenCalledWith('me explica como funciona o projeto?', 'web_123');
    expect(reply.send).toHaveBeenCalledWith({ reply: 'resposta geral' });
  });
});
