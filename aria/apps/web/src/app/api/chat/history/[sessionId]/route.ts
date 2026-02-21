import { NextRequest, NextResponse } from 'next/server';
import { ContextStore } from '@aria/core';

const contextStore = new ContextStore();

export async function GET(
  _req: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  try {
    const { sessionId } = params;

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Missing sessionId' },
        { status: 400 }
      );
    }

    const context = await contextStore.getSessionContext(sessionId);

    if (!context) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      sessionId: context.sessionId,
      activeClientId: context.activeClientId,
      history: context.history,
    });
  } catch (error) {
    console.error('History error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
