import { NextRequest, NextResponse } from 'next/server';
import { askAttenderAI, AssistantContext } from '@/lib/ai/assistant';
import { getAuthenticatedUser, verifyClassAccess } from '@/lib/auth/serverAuth';

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
    // 1. Enforce authentication server-side
    const authCtx = await getAuthenticatedUser(req);
    if (!authCtx.user || !authCtx.profile) {
      return NextResponse.json(
        { error: 'Authentication required to use ATTENDER AI.' },
        { status: 401 }
      );
    }

    if (authCtx.isStudent) {
      return NextResponse.json(
        { error: 'Access denied: Students cannot query administrative assistant tools.' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { question, context } = body as { question: string; context: AssistantContext };

    if (!question || typeof question !== 'string') {
      return NextResponse.json({ error: 'Question is required' }, { status: 400 });
    }

    // Verify teacher class authorization if querying class-specific data
    if (authCtx.isTeacher && Array.isArray(context?.classes) && context.classes.length > 0) {
      for (const cls of context.classes) {
        if (cls?.id) {
          const hasAccess = await verifyClassAccess(authCtx, cls.id);
          if (!hasAccess) {
            return NextResponse.json(
              { error: 'Access denied: You are not authorized to query AI insights for unassigned classes.' },
              { status: 403 }
            );
          }
        }
      }
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
