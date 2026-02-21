import type { NotionBlock, RichTextItem } from './notion.types';

export function markdownToNotionBlocks(markdown: string): NotionBlock[] {
  const lines = markdown.split('\n');
  const blocks: NotionBlock[] = [];

  for (const line of lines) {
    // Divider
    if (line.trim() === '---') {
      blocks.push({ object: 'block', type: 'divider', divider: {} });
      continue;
    }

    // Headings
    if (line.startsWith('# ')) {
      blocks.push({
        object: 'block',
        type: 'heading_1',
        heading_1: { rich_text: buildRichText(line.slice(2)) },
      });
      continue;
    }

    if (line.startsWith('## ')) {
      blocks.push({
        object: 'block',
        type: 'heading_2',
        heading_2: { rich_text: buildRichText(line.slice(3)) },
      });
      continue;
    }

    if (line.startsWith('### ')) {
      blocks.push({
        object: 'block',
        type: 'heading_3',
        heading_3: { rich_text: buildRichText(line.slice(4)) },
      });
      continue;
    }

    // To-do (checklist)
    if (line.match(/^- \[ \] /)) {
      blocks.push({
        object: 'block',
        type: 'to_do',
        to_do: {
          rich_text: buildRichText(line.slice(6)),
          checked: false,
        },
      });
      continue;
    }

    // Bulleted list
    if (line.startsWith('- ')) {
      blocks.push({
        object: 'block',
        type: 'bulleted_list_item',
        bulleted_list_item: { rich_text: buildRichText(line.slice(2)) },
      });
      continue;
    }

    // Callout (detects emoji)
    if (line.startsWith('> ')) {
      const content = line.slice(2);
      // Match common emojis at the start
      const emojiMatch = content.match(/^(⚠️|💡|🎯|✅|❌|🔴|🟡|🟢|📊|🔗)\s/);
      const emoji: string = (emojiMatch && emojiMatch[1]) || '💡';
      const text = emojiMatch ? content.slice(emojiMatch[0].length) : content;

      blocks.push({
        object: 'block',
        type: 'callout',
        callout: {
          rich_text: buildRichText(text),
          icon: { type: 'emoji', emoji },
        },
      });
      continue;
    }

    // Paragraph (skip empty lines)
    if (line.trim()) {
      blocks.push({
        object: 'block',
        type: 'paragraph',
        paragraph: { rich_text: buildRichText(line) },
      });
    }
  }

  return blocks;
}

export function buildRichText(text: string): RichTextItem[] {
  const parts: RichTextItem[] = [];
  const regex = /(\*\*([^*]+)\*\*|\*([^*]+)\*|`([^`]+)`|([^*`]+))/g;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (!match[0]) break;

    if (match[2]) {
      // Bold
      parts.push({
        type: 'text',
        text: { content: match[2] },
        annotations: { bold: true },
      });
    } else if (match[3]) {
      // Italic
      parts.push({
        type: 'text',
        text: { content: match[3] },
        annotations: { italic: true },
      });
    } else if (match[4]) {
      // Code
      parts.push({
        type: 'text',
        text: { content: match[4] },
        annotations: { code: true },
      });
    } else if (match[5]) {
      // Plain text
      if (match[5].trim()) {
        parts.push({
          type: 'text',
          text: { content: match[5] },
        });
      }
    }
  }

  return parts.length > 0
    ? parts
    : [{ type: 'text', text: { content: text } }];
}

export function formatDateBR(): string {
  const now = new Date();
  const day = String(now.getDate()).padStart(2, '0');
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const year = now.getFullYear();
  return `${day}/${month}/${year}`;
}
