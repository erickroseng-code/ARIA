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
      messageCount: context.history.length,
      createdAt: context.history[0]?.timestamp || null,
      lastMessageAt:
        context.history[context.history.length - 1]?.timestamp || null,
    });
  } catch (error) {
    console.error('Session error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
