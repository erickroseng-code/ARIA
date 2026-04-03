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

export { NotionTaskService, type NotionTaskCreateRequest, type NotionTask } from './notion/NotionTaskService';
export { NotionManager } from './notion/NotionManager';
export { RateLimiter } from './common/RateLimiter';
export { TaskQueue } from './common/TaskQueue';

// Google Workspace exports
export { createWorkspaceClient, isWorkspaceConfigured, setWorkspaceTokenResolver, setOnInvalidGrant, notifyInvalidGrant, setWorkspaceTokenPersistor } from './google-workspace/WorkspaceClient';
export { DriveService, type DriveFile } from './google-workspace/DriveService';
export { GmailService, type GmailMessage, type SendEmailOptions } from './google-workspace/GmailService';
export { SheetsService, type SheetData } from './google-workspace/SheetsService';
export { DocsService, type DocContent } from './google-workspace/DocsService';
export { WorkspaceActionService, type WorkspaceAction, type ActionResult } from './google-workspace/WorkspaceActionService';
export { CalendarService, type CalendarEvent } from './google-workspace/CalendarService';
