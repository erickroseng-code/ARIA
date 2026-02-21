export interface ClientRef {
  notionPageId: string;
  name: string;
  segment: string;
  responsible: string;
}

export interface ClientProfile extends ClientRef {
  status: string;
  description: string;
  metadata?: Record<string, unknown>;
}

export interface TaskRef {
  id: string;
  title: string;
  status: string;
  dueDate?: Date;
}

export interface CalendarEvent {
  id: string;
  title: string;
  startTime: Date;
}

export interface PlanOfAttack {
  id: string;
  clientId: string;
  title: string;
  status: 'draft' | 'active' | 'completed';
  actionItems: ActionItem[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ActionItem {
  id: string;
  title: string;
  status: 'pending' | 'in_progress' | 'done';
  assignedTo?: string;
  dueDate?: Date;
}

// Document types
export const SUPPORTED_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
] as const;

export type SupportedMimeType = typeof SUPPORTED_MIME_TYPES[number];

export interface ProcessedDocument {
  id: string;
  originalName: string;
  mimeType: SupportedMimeType;
  extractedText: string;
  summary?: string;
  clientId?: string;
  uploadedAt: Date;
  processedAt?: Date;
}

export interface PendingDocument extends ProcessedDocument {
  label: string;  // Auto-extracted from filename or user-assigned
}

// Analysis types
export interface GeneratedAnalysis {
  clientName: string;
  sections: AnalysisSection[];
  integratedAnalysis: string;    // Markdown
  practicalChecklist: ChecklistItem[];
  generatedAt: Date;
  sourceDocuments: string[];     // filenames
}

export interface AnalysisSection {
  label: string;                 // Document label from PendingDocument
  sectorType: string;            // 'comercial' | 'marketing' | 'rh' | etc.
  content: string;               // Markdown — individual document analysis
}

export interface ChecklistItem {
  action: string;
  priority: 'alta' | 'média' | 'baixa';
  sector?: string;
}

// Client metadata extraction (Story 2.5)
export interface ClientMetadata {
  responsavel_comercial?: string;
  responsavel_marketing?: string;
  segmento?: string;
  metas?: string[];
  desafios?: string[];
}

export interface ConflictDetail {
  field: string;
  notionPropName: string;
  existing: string;
  incoming: string;
}

export interface FillResult {
  updated: string[];
  conflicted: ConflictDetail[];
  pageId: string;
}

export interface HistoryEntry {
  type: 'PLANO_DE_ATAQUE' | 'DOCUMENTO_PROCESSADO' | 'REUNIAO';
  date: Date;
  documents: string[];
  pageLink?: string;
  notes?: string;
}
