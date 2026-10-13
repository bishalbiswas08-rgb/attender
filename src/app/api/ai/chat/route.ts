import { NextRequest, NextResponse } from 'next/server';
import { askAttenderAI, AssistantContext } from '@/lib/ai/assistant';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function OPTIONS() {
  const isGeminiConfigured = Boolean(
    process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'your-gemini-api-key'
  );

  return new NextResponse(null, {
    status: 200,
    headers: {
      'x-gemini-configured': String(isGeminiConfigured),
    },
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { question, context } = body as { question: string; context: AssistantContext };

    if (!question || typeof question !== 'string') {
      return NextResponse.json({ error: 'Question is required' }, { status: 400 });
    }

    const answer = await askAttenderAI(question, context);

    return NextResponse.json({
      answer,
      isAiPowered: Boolean(process.env.GEMINI_API_KEY),
    });
  } catch (error: any) {
    console.error('API /api/ai/chat error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error processing AI question' },
      { status: 500 }
    );
  }
}
