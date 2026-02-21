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

export { NotionTaskService, type NotionTaskCreateRequest, type NotionTask } from './notion/NotionTaskService';
export { NotionManager } from './notion/NotionManager';
