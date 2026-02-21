// Notion Block Types
export interface NotionBlock {
  object: 'block';
  type: 'heading_1' | 'heading_2' | 'heading_3' | 'paragraph' | 'bulleted_list_item' | 'to_do' | 'callout' | 'divider';
  heading_1?: HeadingBlock;
  heading_2?: HeadingBlock;
  heading_3?: HeadingBlock;
  paragraph?: ParagraphBlock;
  bulleted_list_item?: BulletedListBlock;
  to_do?: ToDoBlock;
  callout?: CalloutBlock;
  divider?: Record<string, unknown>;
}

export interface HeadingBlock {
  rich_text: RichTextItem[];
  color?: string;
}

export interface ParagraphBlock {
  rich_text: RichTextItem[];
  color?: string;
}

export interface BulletedListBlock {
  rich_text: RichTextItem[];
  color?: string;
}

export interface ToDoBlock {
  rich_text: RichTextItem[];
  checked: boolean;
  color?: string;
}

export interface CalloutBlock {
  rich_text: RichTextItem[];
  icon: { type: 'emoji'; emoji: string } | { type: 'file'; file: { url: string } };
  color?: string;
}

export interface RichTextItem {
  type: 'text' | 'mention' | 'equation';
  text?: { content: string; link?: { url: string } | null };
  annotations?: {
    bold?: boolean;
    italic?: boolean;
    strikethrough?: boolean;
    underline?: boolean;
    code?: boolean;
    color?: string;
  };
  mention?: Record<string, unknown>;
  equation?: { expression: string };
  href?: string | null;
  plain_text?: string;
}
