import { AIClient } from '@/lib/ai/client';
import { logger } from '@/lib/logger/client';
import { NextRequest } from 'next/server';

export async function POST(req: NextRequest) {
  const snippetId = logger.startSnippet({
    snippet_id: `scene-gen-${Date.now()}`,
    name: '场景生成',
  });

  try {
    const { keywords, worldContext } = await req.json();

    if (snippetId) {
      await logger.logSnippet(
        `开始生成场景: ${keywords}`,
        snippetId,
        'ai-scene'
      );
    }

    // 构建场景生成提示词
    const prompt = worldContext
      ? `基于以下世界观背景，根据关键词"${keywords}"生成详细的场景描述。

世界观背景：
${worldContext}

请生成包含以下内容的场景描述（使用Markdown格式）：
1. 场景名称
2. 地理位置和环境特征
3. 建筑风格和主要设施
4. 氛围和感官细节（视觉、听觉、嗅觉等）
5. 场景中的活动和人物
6. 场景的历史和文化背景

同时，请在描述末尾用"绘画提示词："标记，给出适合生成场景插图的英文绘画提示词（详细描述画面构图、光影、风格等）。`
      : `根据关键词"${keywords}"生成详细的场景描述。

请生成包含以下内容的场景描述（使用Markdown格式）：
1. 场景名称
2. 地理位置和环境特征
3. 建筑风格和主要设施
4. 氛围和感官细节（视觉、听觉、嗅觉等）
5. 场景中的活动和人物
6. 场景的历史和文化背景

同时，请在描述末尾用"绘画提示词："标记，给出适合生成场景插图的英文绘画提示词（详细描述画面构图、光影、风格等）。`;

    const result = await AIClient.generateStream('sceneGen', prompt);

    if (snippetId) {
      await logger.logSnippet('场景生成完成', snippetId, 'ai-scene');
      await logger.endSnippet(snippetId);
    }

    return result.toTextStreamResponse();
  } catch (error) {
    if (snippetId) {
      await logger.logSnippet(
        `场景生成失败: ${error instanceof Error ? error.message : '未知错误'}`,
        snippetId,
        'ai-scene',
        { level: 'error' }
      );
      await logger.endSnippet(snippetId);
    }

    await logger.error(
      `场景生成失败: ${error instanceof Error ? error.message : '未知错误'}`,
      'ai-scene'
    );

    return new Response(JSON.stringify({ error: 'Generation failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
