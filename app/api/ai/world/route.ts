import { AIClient } from '@/lib/ai/client';
import { NextRequest } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { prompt, kbContext } = await req.json();
    const result = await AIClient.generateStream('worldGen', prompt, kbContext);
    return result.toTextStreamResponse();
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Generation failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
