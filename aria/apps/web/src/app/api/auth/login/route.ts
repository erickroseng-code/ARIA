import { NextRequest, NextResponse } from 'next/server';
import { generateToken, setAuthCookie } from '@/lib/auth';

const WEB_PASSWORD = process.env.WEB_PASSWORD || 'aria-dev-password';

export async function POST(req: NextRequest) {
  try {
    const { password } = await req.json();

    if (!password || password !== WEB_PASSWORD) {
      return NextResponse.json(
        { error: 'Invalid password' },
        { status: 401 }
      );
    }

    const token = await generateToken();
    await setAuthCookie(token);

    return NextResponse.json(
      { success: true, message: 'Logged in successfully' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
