// Core package - shared types and utilities
export const PACKAGE_NAME = '@aria/core';

// Chat exports
export * from './chat';

// Client service exports
export { ClientService } from './clients/ClientService';

// Intent parser exports
export { IntentParser, getIntentParser } from './chat/IntentParser';
export {
  TaskIntentParser,
  getTaskIntentParser,
  type TaskIntent,
  type ParseResult,
} from './chat/TaskIntentParser';

// Audio service exports
export { AudioService } from './audio/AudioService';

// Document service exports
export { DocumentService } from './documents/DocumentService';
export { PdfParser } from './documents/PdfParser';
export { DocxParser } from './documents/DocxParser';
export { DocumentAnalysisService } from './documents/DocumentAnalysisService';

// Error exports
export { AppError, type AppErrorOptions } from './errors/AppError';

// Task service exports
export { TaskService, type TaskCreationContext, type CreateClickUpTaskParams } from './services';

// Utilities exports
export { ClientMatcher, getClientMatcher, type ClientMatchResult } from './utils/client-matcher';
export { parseDateTime, parseDateExpression, parseTimeExpression, combineDateAndTime, type ParsedDate } from './utils/date-parser';
export { PriorityExtractor, getPriorityExtractor, type PriorityExtractionResult, type PriorityLevel } from './utils/priority-extractor';
