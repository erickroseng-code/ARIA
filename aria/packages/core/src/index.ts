// Core package - shared types and utilities
export const PACKAGE_NAME = '@aria/core';

// Chat exports
export * from './chat';

// Client service exports
export { ClientService } from './clients/ClientService';

// Intent parser exports
export { IntentParser, getIntentParser } from './chat/IntentParser';

// Document service exports
export { DocumentService } from './documents/DocumentService';
export { PdfParser } from './documents/PdfParser';
export { DocxParser } from './documents/DocxParser';
export { DocumentAnalysisService } from './documents/DocumentAnalysisService';

// Error exports
export { AppError, type AppErrorOptions } from './errors/AppError';

// Task service exports
export { TaskService, type TaskCreationContext, type CreateClickUpTaskParams } from './services';
