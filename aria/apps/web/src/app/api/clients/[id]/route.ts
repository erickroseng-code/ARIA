import { NextRequest, NextResponse } from 'next/server';
import { getNotionClient } from '@aria/integrations';

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    if (!id) {
      return NextResponse.json(
        { error: 'Missing client ID' },
        { status: 400 }
      );
    }

    const notionClient = getNotionClient();
    const profile = await notionClient.getClientProfile(id);

    return NextResponse.json({
      success: true,
      data: profile,
    });
  } catch (error) {
    console.error('Error retrieving client profile:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Client not found',
        code: 'NOTION_003',
      },
      { status: 404 }
    );
  }
}
