// Integrations package - third-party API clients
export const PACKAGE_NAME = '@aria/integrations';

// Notion exports
export {
  NotionClient,
  initializeNotionClient,
  getNotionClient,
  type NotionPropertyValue,
} from './notion/notion.client';

export { ClientProfileService } from './notion/ClientProfileService';

export { HistoryService } from './notion/HistoryService';

export { CLIENT_PROPERTY_MAP } from './notion/constants';

export {
  markdownToNotionBlocks,
  buildRichText,
  formatDateBR,
} from './notion/notion.helpers';

export type { NotionBlock, RichTextItem } from './notion/notion.types';

// ClickUp exports
export {
  ClickUpClient,
  initializeClickUpClient,
  getClickUpClient,
} from './clickup/ClickUpClient';

export { ClickUpTaskService, type TaskCreateRequest, type Task } from './clickup/ClickUpTaskService';
export { ClickUpManager } from './clickup/ClickUpManager';
export { RateLimiter } from './clickup/RateLimiter';
export { TaskQueue } from './clickup/TaskQueue';
export {
  ClickUpQueryService,
  initializeClickUpQueryService,
  getClickUpQueryService,
  type ClientRecord,
  type PendingTask,
  type MyTask,
} from './clickup/ClickUpQueryService';


export { NotionTaskService, type NotionTaskCreateRequest, type NotionTask } from './notion/NotionTaskService';
export { NotionManager } from './notion/NotionManager';

// Google Workspace exports
export { createWorkspaceClient, isWorkspaceConfigured, setWorkspaceTokenResolver } from './google-workspace/WorkspaceClient';
export { DriveService, type DriveFile } from './google-workspace/DriveService';
export { GmailService, type GmailMessage, type SendEmailOptions } from './google-workspace/GmailService';
export { SheetsService, type SheetData } from './google-workspace/SheetsService';
export { DocsService, type DocContent } from './google-workspace/DocsService';
export { WorkspaceActionService, type WorkspaceAction, type ActionResult } from './google-workspace/WorkspaceActionService';
export { CalendarService, type CalendarEvent } from './google-workspace/CalendarService';
