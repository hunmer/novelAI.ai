import { AIClient } from '@/lib/ai/client';
import { logger } from '@/lib/logger/client';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const snippetId = logger.startSnippet({
    snippet_id: `portrait-keywords-${Date.now()}`,
    name: '立绘关键词生成',
  });

  try {
    const { prompt, worldContext, providerId, modelName } = await req.json();

    const trimmedPrompt = typeof prompt === 'string' ? prompt.trim() : '';
    if (!trimmedPrompt) {
      return NextResponse.json(
        { error: '提示词内容不能为空' },
        { status: 400 }
      );
    }

    if (snippetId) {
      await logger.logSnippet(
        `开始生成立绘关键词: ${trimmedPrompt.substring(0, 60)}...`,
        snippetId,
        'ai-portrait-keywords'
      );
    }

    const result = await AIClient.generate('portraitKeywords', trimmedPrompt, worldContext, {
      providerId,
      modelName,
    });

    if (snippetId) {
      await logger.logSnippet('立绘关键词生成完成', snippetId, 'ai-portrait-keywords');
      await logger.endSnippet(snippetId);
    }

    const parseJson = (text: string) => {
      try {
        return JSON.parse(text);
      } catch {
        const match = text.match(/\{[\s\S]*\}/);
        if (!match) return undefined;
        try {
          return JSON.parse(match[0]);
        } catch {
          return undefined;
        }
      }
    };

    const parsed = parseJson(result.text);

    if (!parsed) {
      return NextResponse.json(
        {
          error: 'AI返回内容无法解析',
          raw: result.text,
        },
        { status: 422 }
      );
    }

    return NextResponse.json({
      success: true,
      result: parsed,
      tokens: result.tokens,
      cost: result.cost,
      raw: result.text,
    });
  } catch (error) {
    if (snippetId) {
      await logger.logSnippet(
        `立绘关键词生成失败: ${error instanceof Error ? error.message : '未知错误'}`,
        snippetId,
        'ai-portrait-keywords',
        { level: 'error' }
      );
      await logger.endSnippet(snippetId);
    }

    await logger.error(
      `立绘关键词生成失败: ${error instanceof Error ? error.message : '未知错误'}`,
      'ai-portrait-keywords'
    );

    return NextResponse.json(
      { error: error instanceof Error ? error.message : '关键词生成失败' },
      { status: 500 }
    );
  }
}
