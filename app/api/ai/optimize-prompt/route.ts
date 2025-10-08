import { AIClient } from '@/lib/ai/client';
import { logger } from '@/lib/logger/client';
import { NextRequest } from 'next/server';

export async function POST(req: NextRequest) {
  const snippetId = logger.startSnippet({
    snippet_id: `prompt-optimize-${Date.now()}`,
    name: '提示词优化',
  });

  try {
    const { prompt, type } = await req.json();

    if (!prompt) {
      return new Response(JSON.stringify({ error: '提示词内容不能为空' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (snippetId) {
      await logger.logSnippet(
        `开始优化提示词: ${prompt.substring(0, 50)}...`,
        snippetId,
        'ai-optimize'
      );
    }

    const result = await AIClient.generate('promptOptimize', prompt, type);

    if (snippetId) {
      await logger.logSnippet('提示词优化完成', snippetId, 'ai-optimize');
      await logger.endSnippet(snippetId);
    }

    // 解析JSON响应
    try {
      const jsonResponse = JSON.parse(result.text);
      return new Response(JSON.stringify(jsonResponse), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    } catch {
      // 如果解析失败，尝试提取JSON部分
      const jsonMatch = result.text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          const jsonResponse = JSON.parse(jsonMatch[0]);
          return new Response(JSON.stringify(jsonResponse), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        } catch {
          // 如果还是失败，返回原始文本作为优化结果
          return new Response(
            JSON.stringify({
              optimizedPrompt: result.text,
              improvements: ['AI已优化提示词'],
              suggestions: '已生成优化版本',
            }),
            {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            }
          );
        }
      } else {
        // 完全没有JSON格式，返回原始文本
        return new Response(
          JSON.stringify({
            optimizedPrompt: result.text,
            improvements: ['AI已优化提示词'],
            suggestions: '已生成优化版本',
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }
    }
  } catch (error) {
    if (snippetId) {
      await logger.logSnippet(
        `提示词优化失败: ${error instanceof Error ? error.message : '未知错误'}`,
        snippetId,
        'ai-optimize',
        { level: 'error' }
      );
      await logger.endSnippet(snippetId);
    }

    await logger.error(
      `提示词优化失败: ${error instanceof Error ? error.message : '未知错误'}`,
      'ai-optimize'
    );

    return new Response(JSON.stringify({ error: '优化失败，请稍后重试' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
