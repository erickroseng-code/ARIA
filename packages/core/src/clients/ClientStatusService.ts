/**
 * ClientStatusService: Consolidate client status from ClickUp, Notion, meetings, and plans
 */

export interface Task {
  id: string;
  title: string;
  dueDate?: Date;
  status: 'open' | 'overdue' | 'completed';
  url: string;
  source: 'clickup' | 'notion';
}

export interface Meeting {
  id: string;
  date: Date;
  description: string;
  url: string;
}

export interface Plan {
  id: string;
  date: Date;
  title: string;
  url: string;
}

export interface ClientStatus {
  clientId: string;
  clientName: string;
  clickupTasks: Task[];
  notionTasks: Task[];
  upcomingMeetings: Meeting[];
  plans: Plan[];
  lastUpdated: Date;
  summary: string;
}

interface CacheEntry {
  data: ClientStatus;
  timestamp: number;
}

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const API_TIMEOUT_MS = 3000; // 3 seconds per API

export class ClientStatusService {
  private cache: Map<string, CacheEntry> = new Map();

  // Mock API fetchers - would be replaced with actual API calls
  private clickupFetcher: (clientId: string) => Promise<Task[]> = async () => [];
  private notionFetcher: (clientId: string) => Promise<Task[]> = async () => [];
  private meetingsFetcher: (clientId: string) => Promise<Meeting[]> = async () => [];
  private plansFetcher: (clientId: string) => Promise<Plan[]> = async () => [];

  constructor(
    clickupFetcher?: (clientId: string) => Promise<Task[]>,
    notionFetcher?: (clientId: string) => Promise<Task[]>,
    meetingsFetcher?: (clientId: string) => Promise<Meeting[]>,
    plansFetcher?: (clientId: string) => Promise<Plan[]>
  ) {
    if (clickupFetcher) this.clickupFetcher = clickupFetcher;
    if (notionFetcher) this.notionFetcher = notionFetcher;
    if (meetingsFetcher) this.meetingsFetcher = meetingsFetcher;
    if (plansFetcher) this.plansFetcher = plansFetcher;
  }

  /**
   * Get consolidated client status
   */
  async getStatus(clientId: string, clientName: string): Promise<ClientStatus> {
    // Check cache
    const cached = this.getFromCache(clientId);
    if (cached) {
      return cached;
    }

    // Fetch data in parallel with timeouts
    const [clickupTasks, notionTasks, upcomingMeetings, plans] = await Promise.all([
      this.withTimeout(this.clickupFetcher(clientId), 'ClickUp'),
      this.withTimeout(this.notionFetcher(clientId), 'Notion'),
      this.withTimeout(this.meetingsFetcher(clientId), 'Meetings'),
      this.withTimeout(this.plansFetcher(clientId), 'Plans'),
    ]);

    // Consolidate and sort
    const status: ClientStatus = {
      clientId,
      clientName,
      clickupTasks,
      notionTasks,
      upcomingMeetings: upcomingMeetings.slice(0, 3), // Top 3
      plans: plans.slice(0, 3), // Top 3
      lastUpdated: new Date(),
      summary: this.generateSummary(clickupTasks, notionTasks, upcomingMeetings, plans),
    };

    // Cache result
    this.setCache(clientId, status);

    return status;
  }

  /**
   * Get formatted message for display
   */
  formatStatus(status: ClientStatus): string {
    let message = `📊 Status de *${status.clientName}* — ${this.formatTimestamp(status.lastUpdated)}\n\n`;

    // Overdue tasks
    const overdueTasks = [...status.clickupTasks, ...status.notionTasks]
      .filter((t) => t.status === 'overdue')
      .sort((a, b) => (a.dueDate?.getTime() || 0) - (b.dueDate?.getTime() || 0));

    if (overdueTasks.length > 0) {
      message += `🔴 **Tarefas Atrasadas (${overdueTasks.length})**\n`;
      overdueTasks.forEach((task, idx) => {
        const dueStr = task.dueDate ? this.formatDate(task.dueDate) : 'sem data';
        message += `${idx + 1}. ${task.title} — vence ${dueStr}\n`;
      });
      message += '\n';
    }

    // Due today
    const dueToday = [...status.clickupTasks, ...status.notionTasks]
      .filter((t) => t.status === 'open' && this.isDueToday(t.dueDate))
      .slice(0, 3);

    if (dueToday.length > 0) {
      message += `⚠️ **Vencendo Hoje (${dueToday.length})**\n`;
      dueToday.forEach((task, idx) => {
        const timeStr = task.dueDate ? this.formatTime(task.dueDate) : 'sem hora';
        message += `${idx + 1}. ${task.title} — vence hoje ${timeStr}\n`;
      });
      message += '\n';
    }

    // Upcoming meetings
    if (status.upcomingMeetings.length > 0) {
      message += `📅 **Próximas ${status.upcomingMeetings.length} Reuniões**\n`;
      status.upcomingMeetings.forEach((meeting, idx) => {
        const dateStr = this.formatDateTime(meeting.date);
        message += `${idx + 1}. ${dateStr} — ${meeting.description}\n`;
      });
      message += '\n';
    }

    // Recent plans
    if (status.plans.length > 0) {
      message += `🎯 **Últimos Planos de Ataque (${status.plans.length})**\n`;
      status.plans.forEach((plan, idx) => {
        const dateStr = this.formatDate(plan.date);
        message += `${idx + 1}. ${plan.title} — ${dateStr}\n`;
      });
      message += '\n';
    }

    // Add perfil link
    message += `[Ver perfil completo](notion://client/${status.clientId})`;

    return message;
  }

  /**
   * Clear cache for a client
   */
  clearCache(clientId: string): void {
    this.cache.delete(clientId);
  }

  /**
   * Clear all cache
   */
  clearAllCache(): void {
    this.cache.clear();
  }

  // Private helpers

  private getFromCache(clientId: string): ClientStatus | null {
    const entry = this.cache.get(clientId);
    if (!entry) return null;

    if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
      this.cache.delete(clientId);
      return null;
    }

    return entry.data;
  }

  private setCache(clientId: string, data: ClientStatus): void {
    this.cache.set(clientId, {
      data,
      timestamp: Date.now(),
    });
  }

  private async withTimeout<T>(promise: Promise<T>, serviceName: string): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(
          () => reject(new Error(`${serviceName} timeout after ${API_TIMEOUT_MS}ms`)),
          API_TIMEOUT_MS
        )
      ),
    ]).catch((error) => {
      console.warn(`${serviceName} fetch failed:`, error.message);
      return [] as any; // Fallback to empty array
    });
  }

  private generateSummary(
    clickupTasks: Task[],
    notionTasks: Task[],
    meetings: Meeting[],
    plans: Plan[]
  ): string {
    const overdue = [...clickupTasks, ...notionTasks].filter((t) => t.status === 'overdue').length;
    const open = [...clickupTasks, ...notionTasks].filter((t) => t.status === 'open').length;

    return `${overdue > 0 ? `${overdue} atrasadas, ` : ''}${open} abertas, ${meetings.length} reuniões próximas`;
  }

  private isDueToday(date?: Date): boolean {
    if (!date) return false;
    const today = new Date();
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  }

  private formatTimestamp(date: Date): string {
    return date.toLocaleDateString('pt-BR', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  private formatDate(date: Date): string {
    return date.toLocaleDateString('pt-BR');
  }

  private formatTime(date: Date): string {
    return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }

  private formatDateTime(date: Date): string {
    return date.toLocaleDateString('pt-BR', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
}
