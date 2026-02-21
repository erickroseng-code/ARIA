import { getNotionClient } from '@aria/integrations';
import { ContextStore } from '../chat/ContextStore';
import type { ClientRef } from '@aria/shared';

export class ClientService {
  constructor(private contextStore: ContextStore) {}

  async handleClientLookup(
    clientName: string,
    sessionId: string,
    userId?: string
  ): Promise<{ message: string; matches: ClientRef[]; requiresSelection: boolean }> {
    try {
      const notionClient = getNotionClient();
      const topMatches = await notionClient.getTopMatches(clientName, 3);

      if (topMatches.length === 0) {
        return {
          message: `❌ Nenhum cliente encontrado com o nome "${clientName}". Verifique se existe no Notion e tente novamente.`,
          matches: [],
          requiresSelection: false,
        };
      }

      // Exact match - auto-confirm
      const firstMatch = topMatches[0];
      if (topMatches.length === 1 && firstMatch && firstMatch.name.toLowerCase() === clientName.toLowerCase()) {
        if (userId) {
          await this.contextStore.setActiveClient(userId, firstMatch.notionPageId);
        }

        return {
          message: `✅ Cliente *${firstMatch.name}* encontrado e selecionado!`,
          matches: topMatches,
          requiresSelection: false,
        };
      }

      // Multiple matches - ask user to select
      const matchList = topMatches
        .map(
          (client: ClientRef, index: number) =>
            `${index + 1}. **${client.name}** (${client.segment}) — ${client.responsible}`
        )
        .join('\n');

      return {
        message: `Encontrei ${topMatches.length} cliente(s) similar(es):\n\n${matchList}\n\nQual você quer selecionar? (Responda com 1, 2 ou 3)`,
        matches: topMatches,
        requiresSelection: true,
      };
    } catch (error) {
      console.error('Error handling client lookup:', error);
      return {
        message: '⚠️ Não consegui acessar o Notion agora. Tente novamente em instantes.',
        matches: [],
        requiresSelection: false,
      };
    }
  }

  async confirmClientSelection(
    selectedIndex: number,
    topMatches: ClientRef[],
    userId?: string
  ): Promise<{ message: string; success: boolean }> {
    if (selectedIndex < 1 || selectedIndex > topMatches.length) {
      return {
        message: `❌ Seleção inválida. Por favor, responda com um número entre 1 e ${topMatches.length}.`,
        success: false,
      };
    }

    const selected = topMatches[selectedIndex - 1];
    if (!selected) {
      return {
        message: `❌ Seleção inválida.`,
        success: false,
      };
    }

    if (userId) {
      await this.contextStore.setActiveClient(userId, selected.notionPageId);
    }

    return {
      message: `✅ Cliente *${selected.name}* selecionado!`,
      success: true,
    };
  }
}
