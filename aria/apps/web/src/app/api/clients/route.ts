import { NextRequest, NextResponse } from 'next/server';
import { getNotionClient } from '@aria/integrations';

export async function GET(_req: NextRequest) {
  try {
    const notionClient = getNotionClient();
    const clients = await notionClient.listClients();

    return NextResponse.json({
      success: true,
      data: clients,
      count: clients.length,
    });
  } catch (error) {
    console.error('Error listing clients:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to list clients',
        code: 'NOTION_001',
      },
      { status: 500 }
    );
  }
}
