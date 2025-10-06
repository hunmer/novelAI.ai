import { AIClient } from '@/lib/ai/client';
import { logger } from '@/lib/logger/client';
import { NextRequest } from 'next/server';

export async function POST(req: NextRequest) {
  const snippetId = logger.startSnippet({
    snippet_id: `world-gen-${Date.now()}`,
    name: '世界观生成',
  });

  try {
    const { prompt, kbContext } = await req.json();

    if (snippetId) {
      await logger.logSnippet(
        `开始生成世界观: ${prompt.substring(0, 50)}...`,
        snippetId,
        'ai-world'
      );
    }

    const result = await AIClient.generateStream('worldGen', prompt, kbContext);

    if (snippetId) {
      await logger.logSnippet('世界观生成完成', snippetId, 'ai-world');
      await logger.endSnippet(snippetId);
    }

    return result.toTextStreamResponse();
  } catch (error) {
    if (snippetId) {
      await logger.logSnippet(
        `世界观生成失败: ${error instanceof Error ? error.message : '未知错误'}`,
        snippetId,
        'ai-world',
        { level: 'error' }
      );
      await logger.endSnippet(snippetId);
    }

    await logger.error(
      `世界观生成失败: ${error instanceof Error ? error.message : '未知错误'}`,
      'ai-world'
    );

    return new Response(JSON.stringify({ error: 'Generation failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
