/**
 * Extract a user-friendly label from a document filename
 * Examples:
 * - "setor-comercial.pdf" → "Setor Comercial"
 * - "mkt_briefing_2026.docx" → "MKT Briefing"
 * - "document.pdf" → "Document"
 * - "" → "" (empty, caller should use default "Documento N")
 */
export function extractLabelFromFilename(filename: string): string {
  // Remove extension
  const noExt = filename.replace(/\.[^/.]+$/, '').trim();
  if (!noExt) return '';

  // Remove date patterns: _2026, -2026, _jan_2026, etc.
  const noDate = noExt.replace(/[-_]\d{4}([-_]\d{2})?([-_]\d{2})?/g, '').trim();
  if (!noDate) return '';

  // Convert separators to spaces
  const spaced = noDate.replace(/[-_]+/g, ' ').trim();
  if (!spaced) return '';

  // Capitalize each word
  return spaced
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .filter((word) => word.length > 0)
    .join(' ');
}

/**
 * Generate default label for a document by index
 * Used when extractLabelFromFilename() returns empty string
 */
export function getDefaultDocumentLabel(index: number): string {
  return `Documento ${index + 1}`;
}

/**
 * Get final label for a document (extracted or default)
 */
export function getFinalDocumentLabel(filename: string, index: number): string {
  const extracted = extractLabelFromFilename(filename);
  return extracted || getDefaultDocumentLabel(index);
}
