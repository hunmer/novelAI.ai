import { AIClient } from '@/lib/ai/client';
import { logger } from '@/lib/logger/client';
import { NextRequest } from 'next/server';

export async function POST(req: NextRequest) {
  const snippetId = logger.startSnippet({
    snippet_id: `characters-from-world-gen-${Date.now()}`,
    name: '从世界观生成角色',
  });

  try {
    const { prompt, worldContext } = await req.json();

    if (snippetId) {
      await logger.logSnippet(
        `开始从世界观生成角色: ${prompt.substring(0, 50)}...`,
        snippetId,
        'ai-character'
      );
    }

    // 构建提示词，让AI生成多个角色列表，输出JSON数组格式
    const characterPrompt = `${worldContext ? `世界观背景:\n${worldContext}\n\n` : ''}
用户需求: ${prompt}

请基于上述世界观生成一系列登场角色。每个角色应该包含：
1. 基本信息（姓名、年龄、性别等）
2. 性格特征
3. 背景故事
4. 能力与技能
5. 人际关系
6. 在世界观中的角色定位

请以JSON数组格式输出，每个角色为一个对象，包含以下字段：
{
  "characters": [
    {
      "name": "角色名称",
      "age": "年龄",
      "gender": "性别",
      "personality": "性格特征描述",
      "background": "背景故事",
      "skills": ["技能1", "技能2"],
      "relationships": "人际关系描述",
      "role": "在世界观中的角色定位"
    }
  ]
}

确保返回有效的JSON格式，不要包含任何其他文本。`;

    const result = await AIClient.generateStream('characterGen', characterPrompt);

    if (snippetId) {
      await logger.logSnippet('角色列表生成完成', snippetId, 'ai-character');
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
