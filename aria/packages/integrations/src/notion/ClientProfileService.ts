import type { ClientMetadata, ConflictDetail, FillResult } from '@aria/shared';
import { NotionClient, type NotionPropertyValue } from './notion.client';
import { CLIENT_PROPERTY_MAP } from './constants';

export class ClientProfileService {
  constructor(private notion: NotionClient) {}

  async fillProperties(
    pageId: string,
    metadata: ClientMetadata
  ): Promise<FillResult> {
    const updated: string[] = [];
    const conflicted: ConflictDetail[] = [];

    // Get current page properties
    const currentProps = await this.notion.getPageProperties(pageId);

    // Build update payload
    const updatePayload: Record<string, NotionPropertyValue> = {};

    for (const [metaKey, metaValue] of Object.entries(metadata)) {
      if (!metaValue || metaValue === '') continue;

      const mapping = CLIENT_PROPERTY_MAP[metaKey as keyof ClientMetadata];
      if (!mapping) continue;

      const currentProp = currentProps[mapping.notionName];
      const currentValue = currentProp?.value ?? '';
      const isEmpty = currentValue === '' || (Array.isArray(currentValue) && currentValue.length === 0);

      // Prepare incoming value based on property type
      let incomingValue: string | string[] = metaValue;
      if (Array.isArray(metaValue) && mapping.type === 'rich_text') {
        incomingValue = metaValue.join('\n');
      } else if (!Array.isArray(metaValue) && mapping.type === 'multi_select') {
        incomingValue = [metaValue];
      }

      if (isEmpty) {
        // Property is empty, add to update
        updatePayload[mapping.notionName] = {
          type: mapping.type,
          value: incomingValue,
        };
        updated.push(metaKey);
      } else if (String(currentValue) !== String(incomingValue)) {
        // Property has a different value, mark as conflict
        conflicted.push({
          field: metaKey,
          notionPropName: mapping.notionName,
          existing: String(currentValue),
          incoming: String(incomingValue),
        });
      }
    }

    // Apply updates if any
    if (Object.keys(updatePayload).length > 0) {
      await this.notion.updatePageProperties(pageId, updatePayload);
    }

    return {
      updated,
      conflicted,
      pageId,
    };
  }

  async forceUpdateAll(
    pageId: string,
    metadata: ClientMetadata
  ): Promise<FillResult> {
    const updated: string[] = [];

    // Build update payload for all fields
    const updatePayload: Record<string, NotionPropertyValue> = {};

    for (const [metaKey, metaValue] of Object.entries(metadata)) {
      if (!metaValue || metaValue === '') continue;

      const mapping = CLIENT_PROPERTY_MAP[metaKey as keyof ClientMetadata];
      if (!mapping) continue;

      // Prepare incoming value based on property type
      let incomingValue: string | string[] = metaValue;
      if (Array.isArray(metaValue) && mapping.type === 'rich_text') {
        incomingValue = metaValue.join('\n');
      } else if (!Array.isArray(metaValue) && mapping.type === 'multi_select') {
        incomingValue = [metaValue];
      }

      updatePayload[mapping.notionName] = {
        type: mapping.type,
        value: incomingValue,
      };
      updated.push(metaKey);
    }

    // Apply all updates
    if (Object.keys(updatePayload).length > 0) {
      await this.notion.updatePageProperties(pageId, updatePayload);
    }

    return {
      updated,
      conflicted: [],
      pageId,
    };
  }
}
