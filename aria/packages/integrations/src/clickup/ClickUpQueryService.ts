/**
 * ClickUp Query Service
 * High-level service providing ARIA-friendly methods for querying ClickUp data.
 * Powers tool calling in ChatService.
 */

import type { ClickUpTask } from '@aria/shared';
import { ClickUpClient } from './ClickUpClient';

export interface ClientRecord {
    id: string;
    name: string;
    status: string;
    currentEtapa?: string;
    pendingTasks: PendingTask[];
}

export interface PendingTask {
    id: string;
    name: string;
    status: string;
    etapa?: string;
}

export interface MyTask {
    id: string;
    name: string;
    status: string;
    dueDate?: string;
    list?: string;
    priority?: string;
    subtasks?: MyTask[]; // Tarefas aninhadas
}

export class ClickUpQueryService {
    // Cache com TTL de 5 minutos
    private myTasksCache: { data: MyTask[]; timestamp: number } | null = null;
    private clientPipelineCache: { data: ClientRecord[]; timestamp: number } | null = null;
    private readonly CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutos

    constructor(
        private client: ClickUpClient,
        private readonly teamId: string,
        private readonly pipeListId: string,
        private readonly myUserId?: number,
    ) { }

    /**
     * Get all client records from the PIPE | Acelerados list,
     * with their current etapa (em andamento) and pending tasks.
     * Results are cached for 5 minutes.
     */
    async getClientPipeline(statusFilter?: string): Promise<ClientRecord[]> {
        console.log('[ClickUpQueryService.getClientPipeline] Fetching pipeline. pipeListId:', this.pipeListId, 'statusFilter:', statusFilter);

        // Verificar cache
        const now = Date.now();
        if (this.clientPipelineCache && now - this.clientPipelineCache.timestamp < this.CACHE_TTL_MS) {
            console.log('[ClickUpQueryService.getClientPipeline] Retornando do cache (idade:', Math.round((now - this.clientPipelineCache.timestamp) / 1000), 's)');
            return this.clientPipelineCache.data;
        }

        const allTasks = await this.client.getTasksByList(this.pipeListId, {
            includeSubtasks: true,
        });
        console.log('[ClickUpQueryService.getClientPipeline] Fetched', allTasks.length, 'tasks from list');

        // Top-level tasks = client records
        const clientTasks = allTasks.filter(
            (t) => !t.parent && t.name !== '[MODELO]',
        );
        console.log('[ClickUpQueryService.getClientPipeline] Found', clientTasks.length, 'client records');

        const result: ClientRecord[] = [];

        for (const clientTask of clientTasks) {
            // All subtasks from the flat list that belong to this client (direct children)
            const directChildren = allTasks.filter(
                (t) => t.parent === clientTask.id,
            );

            // Find current active etapa
            const currentEtapa = directChildren.find(
                (t) =>
                    t.status?.status === 'em andamento' &&
                    t.name.toLowerCase().startsWith('etapa'),
            );

            // Collect pending tasks (all children with 'aguardando' or 'em andamento' status)
            const pending: PendingTask[] = allTasks
                .filter(
                    (t) =>
                        t.parent === clientTask.id &&
                        (statusFilter && statusFilter !== 'all'
                            ? t.status?.status === statusFilter
                            : statusFilter === 'all'
                                ? true // all statuses
                                : ['aguardando', 'em andamento'].includes(
                                    t.status?.status ?? '',
                                )),
                )
                .map((t) => ({
                    id: t.id,
                    name: t.name,
                    status: t.status?.status ?? 'unknown',
                    etapa: currentEtapa?.name,
                }));

            if (
                !statusFilter ||
                statusFilter === 'all' ||
                clientTask.status?.status === statusFilter ||
                pending.length > 0
            ) {
                result.push({
                    id: clientTask.id,
                    name: clientTask.name,
                    status: clientTask.status?.status ?? 'unknown',
                    currentEtapa: currentEtapa?.name,
                    pendingTasks: pending,
                });
            }
        }

        // Salvar no cache
        this.clientPipelineCache = { data: result, timestamp: Date.now() };
        console.log('[ClickUpQueryService.getClientPipeline] Cache updated with', result.length, 'clients');
        return result;
    }

    /**
     * Get tasks assigned to the current user across all team lists.
     * Results are cached for 5 minutes.
     */
    async getMyTasks(dueDateFilter?: 'today' | 'overdue' | 'upcoming'): Promise<MyTask[]> {
        console.log('[ClickUpQueryService.getMyTasks] Fetching tasks. myUserId:', this.myUserId, 'dueDateFilter:', dueDateFilter);
        if (!this.myUserId) {
            console.warn('[ClickUpQueryService.getMyTasks] myUserId is not set!');
            return [];
        }

        // Verificar cache (ignorar filtro para cache de base)
        const now = Date.now();
        if (this.myTasksCache && now - this.myTasksCache.timestamp < this.CACHE_TTL_MS) {
            console.log('[ClickUpQueryService.getMyTasks] Retornando do cache (idade:', Math.round((now - this.myTasksCache.timestamp) / 1000), 's)');
            let tasks = this.myTasksCache.data;

            // Aplicar filtro após retornar do cache
            if (dueDateFilter) {
                tasks = tasks.filter((t) => {
                    if (!t.dueDate) return dueDateFilter === 'upcoming';
                    const due = new Date(t.dueDate).getTime();
                    const todayStart = new Date();
                    todayStart.setHours(0, 0, 0, 0);
                    const todayEnd = new Date();
                    todayEnd.setHours(23, 59, 59, 999);
                    if (dueDateFilter === 'today') return due >= todayStart.getTime() && due <= todayEnd.getTime();
                    if (dueDateFilter === 'overdue') return due < todayStart.getTime();
                    if (dueDateFilter === 'upcoming') return due > todayEnd.getTime();
                    return true;
                });
            }
            return tasks;
        }

        const tasks = await this.client.getTasksByAssignee(
            this.teamId,
            this.myUserId,
        );

        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const todayEnd = new Date();
        todayEnd.setHours(23, 59, 59, 999);

        const filtered = dueDateFilter
            ? tasks.filter((t) => {
                if (!t.due_date) return dueDateFilter === 'upcoming'; // no date = upcoming
                const due = parseInt(String(t.due_date));
                if (dueDateFilter === 'today')
                    return due >= todayStart.getTime() && due <= todayEnd.getTime();
                if (dueDateFilter === 'overdue') return due < todayStart.getTime();
                if (dueDateFilter === 'upcoming') return due > todayEnd.getTime();
                return true;
            })
            : tasks;

        const result = filtered.map((t) => ({
            id: t.id,
            name: t.name,
            status: t.status?.status ?? 'unknown',
            dueDate: t.due_date
                ? new Date(parseInt(String(t.due_date))).toLocaleDateString('pt-BR')
                : undefined,
            list: (t as any).list?.name,
            priority: (t as any).priority?.priority,
        }));

        // Salvar no cache (sem filtro - cache contém todos os dados)
        this.myTasksCache = { data: result, timestamp: Date.now() };
        console.log('[ClickUpQueryService.getMyTasks] Cache updated with', result.length, 'tasks');
        return result;
    }

    /**
     * Update the status of a specific task by ID.
     */
    async updateTaskStatus(taskId: string, newStatus: string): Promise<string> {
        await this.client.updateTaskStatus(taskId, newStatus);
        return `Status da tarefa atualizado para "${newStatus}"`;
    }

    /**
     * Get subtasks for a specific task ID
     */
    async getSubtasksForTask(taskId: string): Promise<MyTask[]> {
        console.log('[ClickUpQueryService.getSubtasksForTask] Fetching subtasks for taskId:', taskId);
        const subtasks = await this.client.getSubtasks(taskId);
        console.log('[ClickUpQueryService.getSubtasksForTask] Got', subtasks.length, 'subtasks');

        return subtasks.map((t) => ({
            id: t.id,
            name: t.name,
            status: t.status?.status ?? 'unknown',
            dueDate: t.due_date
                ? new Date(parseInt(String(t.due_date))).toLocaleDateString('pt-BR')
                : undefined,
            list: (t as any).list?.name,
            priority: (t as any).priority?.priority,
        }));
    }

    /**
     * Get my tasks WITH their subtasks (hierarchical)
     * More detailed but slower than getMyTasks() - use when you need full hierarchy
     */
    async getMyTasksWithSubtasks(dueDateFilter?: 'today' | 'overdue' | 'upcoming'): Promise<MyTask[]> {
        console.log('[ClickUpQueryService.getMyTasksWithSubtasks] Fetching tasks with subtasks');
        const tasks = await this.getMyTasks(dueDateFilter);

        // Buscar subtarefas para cada tarefa (em paralelo)
        const tasksWithSubtasks = await Promise.all(
            tasks.map(async (task) => {
                try {
                    const subtasks = await this.getSubtasksForTask(task.id);
                    return { ...task, subtasks };
                } catch (error) {
                    console.warn('[ClickUpQueryService.getMyTasksWithSubtasks] Error getting subtasks for', task.name, ':', error);
                    return task; // Retornar tarefa sem subtarefas se falhar
                }
            })
        );

        console.log('[ClickUpQueryService.getMyTasksWithSubtasks] Processed', tasksWithSubtasks.length, 'tasks');
        return tasksWithSubtasks;
    }

    /**
     * Format client pipeline data as a human-readable markdown string for ARIA.
     */
    formatPipelineForAI(pipeline: ClientRecord[], statusFilter?: string): string {
        if (pipeline.length === 0) return 'Nenhuma cliente encontrada no pipeline.';

        const lines: string[] = [
            `**Pipeline de Clientes — PIPE | Acelerados** (${pipeline.length} clientes)\n`,
        ];

        for (const client of pipeline) {
            lines.push(`### ${client.name} — *${client.status}*`);
            if (client.currentEtapa) lines.push(`Etapa atual: **${client.currentEtapa}**`);

            if (client.pendingTasks.length === 0) {
                lines.push('✅ Nenhuma tarefa pendente.');
            } else {
                const label = statusFilter === 'all' ? 'neste cliente' : (statusFilter ?? 'pendentes');
                lines.push(`Tarefas ${label} (${client.pendingTasks.length}):`);
                client.pendingTasks.forEach((t) =>
                    lines.push(`  - [${t.status}] ${t.name}`),
                );
            }
            lines.push('');
        }

        return lines.join('\n');
    }

    /**
     * Format my tasks as a human-readable markdown string for ARIA.
     */
    formatMyTasksForAI(tasks: MyTask[], filter?: string): string {
        if (tasks.length === 0) return `Nenhuma tarefa ${filter ?? ''} encontrada.`;

        const lines: string[] = [`**Suas Tarefas** (${tasks.length})\n`];
        tasks.forEach((t) => {
            const due = t.dueDate ? ` — 📅 ${t.dueDate}` : '';
            const list = t.list ? ` | ${t.list}` : '';
            lines.push(`- [${t.status}] ${t.name}${due}${list}`);
        });

        return lines.join('\n');
    }

    /**
     * Format my tasks WITH subtasks as a human-readable markdown string for ARIA.
     * Shows task hierarchy with indentation.
     */
    formatMyTasksWithSubtasksForAI(tasks: MyTask[], filter?: string): string {
        if (tasks.length === 0) return `Nenhuma tarefa ${filter ?? ''} encontrada.`;

        const lines: string[] = [`**Suas Tarefas com Subtarefas** (${tasks.length})\n`];

        tasks.forEach((t) => {
            const due = t.dueDate ? ` — 📅 ${t.dueDate}` : '';
            const list = t.list ? ` | ${t.list}` : '';
            const subtaskCount = t.subtasks?.length ?? 0;
            const subtaskBadge = subtaskCount > 0 ? ` 📋 (${subtaskCount} sub)` : '';

            lines.push(`- [${t.status}] ${t.name}${due}${list}${subtaskBadge}`);

            // Adicionar subtarefas com indentação
            if (t.subtasks && t.subtasks.length > 0) {
                t.subtasks.forEach((subtask) => {
                    const subDue = subtask.dueDate ? ` — 📅 ${subtask.dueDate}` : '';
                    const subList = subtask.list ? ` | ${subtask.list}` : '';
                    lines.push(`  ↳ [${subtask.status}] ${subtask.name}${subDue}${subList}`);
                });
            }
        });

        return lines.join('\n');
    }
}

// Singleton
let queryService: ClickUpQueryService | null = null;

export function initializeClickUpQueryService(
    client: ClickUpClient,
    teamId: string,
    pipeListId: string,
    myUserId?: number,
): ClickUpQueryService {
    queryService = new ClickUpQueryService(client, teamId, pipeListId, myUserId);
    return queryService;
}

export function getClickUpQueryService(): ClickUpQueryService | null {
    return queryService;
}
