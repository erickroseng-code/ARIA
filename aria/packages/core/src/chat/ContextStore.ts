import type { PendingDocument, GeneratedAnalysis } from '@aria/shared';
import type { TaskIntent } from './TaskIntentParser';

export interface PendingTask {
  intent: TaskIntent;
  confidence: number;
  preview: string;
  createdAt?: Date;
}

export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: Date;
}

export type PendingAnalysis = GeneratedAnalysis;

export interface PropertyConflict {
  field: string;
  notionPropName: string;
  existing: string;
  incoming: string;
}

export interface PendingPropertyConflicts {
  pageId: string;
  metadata: Record<string, unknown>;
  conflicts: PropertyConflict[];
}

export interface SessionContext {
  sessionId: string;
  history: ConversationMessage[];
  activeClientId?: string;
  pendingAnalysis?: PendingAnalysis;
  pendingPropertyConflicts?: PendingPropertyConflicts;
  pendingDocuments?: PendingDocument[];
  pendingTask?: PendingTask;
}

export interface ActiveContext {
  activeClientId?: string;
  lastUpdated: Date;
}

export class ContextStore {
  private contexts = new Map<string, SessionContext>();
  private activeContexts = new Map<string, ActiveContext>();
  private readonly MAX_HISTORY = 10;

  async get(sessionId: string): Promise<SessionContext> {
    if (!this.contexts.has(sessionId)) {
      this.contexts.set(sessionId, {
        sessionId,
        history: [],
      });
    }
    return this.contexts.get(sessionId)!;
  }

  async append(sessionId: string, message: ConversationMessage): Promise<void> {
    const context = await this.get(sessionId);
    context.history.push({
      ...message,
      timestamp: message.timestamp || new Date(),
    });

    // Keep rolling window of max 10 messages
    if (context.history.length > this.MAX_HISTORY) {
      context.history = context.history.slice(-this.MAX_HISTORY);
    }
  }

  async clear(sessionId: string): Promise<void> {
    this.contexts.delete(sessionId);
  }

  async setActiveClient(userId: string, clientId: string): Promise<void> {
    this.activeContexts.set(userId, {
      activeClientId: clientId,
      lastUpdated: new Date(),
    });
  }

  async getActiveClient(userId: string): Promise<string | undefined> {
    return this.activeContexts.get(userId)?.activeClientId;
  }

  async getSessionContext(sessionId: string): Promise<SessionContext | undefined> {
    return this.contexts.get(sessionId);
  }

  async getAllContexts(): Promise<Map<string, SessionContext>> {
    return this.contexts;
  }

  async setPendingAnalysis(sessionId: string, analysis: PendingAnalysis): Promise<void> {
    const context = await this.get(sessionId);
    context.pendingAnalysis = analysis;
  }

  async getPendingAnalysis(sessionId: string): Promise<PendingAnalysis | undefined> {
    const context = await this.get(sessionId);
    return context.pendingAnalysis;
  }

  async clearPendingAnalysis(sessionId: string): Promise<void> {
    const context = await this.get(sessionId);
    delete context.pendingAnalysis;
  }

  async setPendingConflicts(
    sessionId: string,
    conflicts: PendingPropertyConflicts
  ): Promise<void> {
    const context = await this.get(sessionId);
    context.pendingPropertyConflicts = conflicts;
  }

  async getPendingConflicts(sessionId: string): Promise<PendingPropertyConflicts | undefined> {
    const context = await this.get(sessionId);
    return context.pendingPropertyConflicts;
  }

  async clearPendingConflicts(sessionId: string): Promise<void> {
    const context = await this.get(sessionId);
    delete context.pendingPropertyConflicts;
  }

  async addPendingDocument(sessionId: string, doc: PendingDocument): Promise<void> {
    const context = await this.get(sessionId);
    if (!context.pendingDocuments) {
      context.pendingDocuments = [];
    }
    context.pendingDocuments.push(doc);
  }

  async getPendingDocuments(sessionId: string): Promise<PendingDocument[]> {
    const context = await this.get(sessionId);
    return context.pendingDocuments || [];
  }

  async clearPendingDocuments(sessionId: string): Promise<void> {
    const context = await this.get(sessionId);
    context.pendingDocuments = [];
  }

  async appendPendingTask(sessionId: string, task: PendingTask): Promise<void> {
    const context = await this.get(sessionId);
    context.pendingTask = {
      ...task,
      createdAt: task.createdAt || new Date(),
    };
  }

  async getPendingTask(sessionId: string): Promise<PendingTask | undefined> {
    const context = await this.get(sessionId);
    return context.pendingTask;
  }

  async clearPendingTask(sessionId: string): Promise<void> {
    const context = await this.get(sessionId);
    delete context.pendingTask;
  }
}

export const contextStore = new ContextStore();
