import Anthropic from '@anthropic-ai/sdk';
import { ContextStore } from './ContextStore';
import { PlanOfAttackService } from '../clients/PlanOfAttackService';
import { getNotionClient, ClientProfileService } from '@aria/integrations';

export class ChatService {
  constructor(
    private claude: Anthropic,
    private contextStore: ContextStore,
  ) {}

  async *streamResponse(
    userMessage: string,
    sessionId: string,
    userId?: string,
  ): AsyncGenerator<string> {
    const context = await this.contextStore.get(sessionId);
    let systemPrompt = 'Você é ARIA, um assistente pessoal profissional. Responda sempre em português.';

    if (userId) {
      const activeClientId = await this.contextStore.getActiveClient(userId);
      if (activeClientId) {
        systemPrompt += `\n\nContexto: o usuário está trabalhando com o cliente ID: ${activeClientId}.`;
      }
    }

    const stream = this.claude.messages.stream({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      system: systemPrompt,
      messages: [
        ...context.history.slice(-10).map((m) => ({
          role: m.role,
          content: m.content,
        })),
        { role: 'user', content: userMessage },
      ],
    });

    let fullResponse = '';
    for await (const chunk of stream) {
      if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
        fullResponse += chunk.delta.text;
        yield chunk.delta.text;
      }
    }

    await this.contextStore.append(sessionId, {
      role: 'user',
      content: userMessage,
    });
    await this.contextStore.append(sessionId, {
      role: 'assistant',
      content: fullResponse,
    });
  }

  async completeResponse(userMessage: string, sessionId: string, userId?: string): Promise<string> {
    const context = await this.contextStore.get(sessionId);
    let systemPrompt = 'Você é ARIA, um assistente pessoal profissional. Responda sempre em português.';

    if (userId) {
      const activeClientId = await this.contextStore.getActiveClient(userId);
      if (activeClientId) {
        systemPrompt += `\n\nContexto: o usuário está trabalhando com o cliente ID: ${activeClientId}.`;
      }
    }

    const message = await this.claude.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      system: systemPrompt,
      messages: [
        ...context.history.slice(-10).map((m) => ({
          role: m.role,
          content: m.content,
        })),
        { role: 'user', content: userMessage },
      ],
    });

    const response =
      message.content[0]?.type === 'text' && 'text' in message.content[0]
        ? message.content[0].text
        : '';

    await this.contextStore.append(sessionId, {
      role: 'user',
      content: userMessage,
    });
    await this.contextStore.append(sessionId, {
      role: 'assistant',
      content: response,
    });

    return response;
  }

  async handlePlanOfAttackConfirm(sessionId: string, clientPageId: string): Promise<{ pageId: string; notionUrl: string }> {
    const pendingAnalysis = await this.contextStore.getPendingAnalysis(sessionId);

    if (!pendingAnalysis) {
      throw new Error('Nenhuma análise pendente para confirmar. Execute uma análise primeiro.');
    }

    const notionClient = getNotionClient();
    const planService = new PlanOfAttackService(notionClient);

    const pageId = await planService.createPlanPage(
      clientPageId,
      pendingAnalysis
    );

    const notionUrl = planService.formatNotionUrl(pageId);

    // Clear pending analysis after successful creation
    await this.contextStore.clearPendingAnalysis(sessionId);

    return { pageId, notionUrl };
  }

  async handlePropertyUpdateAll(sessionId: string): Promise<string> {
    const pendingConflicts = await this.contextStore.getPendingConflicts(sessionId);

    if (!pendingConflicts) {
      return 'Não há campos pendentes de atualização.';
    }

    const notionClient = getNotionClient();
    const clientProfileService = new ClientProfileService(notionClient);

    const result = await clientProfileService.forceUpdateAll(
      pendingConflicts.pageId,
      pendingConflicts.metadata
    );

    // Clear pending conflicts after update
    await this.contextStore.clearPendingConflicts(sessionId);

    const updatedFields = result.updated.join(', ');
    return `✅ Perfil atualizado com ${result.updated.length} campos: ${updatedFields}`;
  }
}
