export const ERROR_CODES = {
  // AI Domain
  AI_001: 'Claude API unavailable',
  AI_002: 'Context window exceeded',
  AI_003: 'Intent parsing failed',

  // Document Domain
  DOC_001: 'File type not supported',
  DOC_002: 'File size exceeds limit (10MB)',
  DOC_003: 'Parse failed — corrupted or unreadable file',
  DOC_004: 'Maximum 5 documents per session exceeded',
  DOC_005: 'No documents to analyze',

  // Notion Domain
  NOTION_001: 'Failed to list clients',
  NOTION_002: 'Database not found',
  NOTION_003: 'Client page not found',

  // Internal
  INTERNAL_001: 'Unexpected server error',
} as const;

export type ErrorCode = keyof typeof ERROR_CODES;
