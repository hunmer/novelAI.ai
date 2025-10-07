import { AIClient } from '@/lib/ai/client';
import { logger } from '@/lib/logger/client';
import { NextRequest } from 'next/server';

export async function POST(req: NextRequest) {
  const snippetId = logger.startSnippet({
    snippet_id: `character-gen-${Date.now()}`,
    name: '角色生成',
  });

  try {
    const { prompt, worldContext, outputFormat } = await req.json();

    if (snippetId) {
      await logger.logSnippet(
        `开始生成角色: ${prompt.substring(0, 50)}...`,
        snippetId,
        'ai-character'
      );
    }

    const result = await AIClient.generateStream('characterGen', prompt, worldContext, { outputFormat });

    if (snippetId) {
      await logger.logSnippet('角色生成完成', snippetId, 'ai-character');
      await logger.endSnippet(snippetId);
    }

    return result.toTextStreamResponse();
  } catch (error) {
    if (snippetId) {
      await logger.logSnippet(
        `角色生成失败: ${error instanceof Error ? error.message : '未知错误'}`,
        snippetId,
        'ai-character',
        { level: 'error' }
      );
      await logger.endSnippet(snippetId);
    }

    await logger.error(
      `角色生成失败: ${error instanceof Error ? error.message : '未知错误'}`,
      'ai-character'
    );

    return new Response(JSON.stringify({ error: 'Generation failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
