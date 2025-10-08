import { NextRequest, NextResponse } from 'next/server';
import { embed, streamText } from 'ai';
import {
  getDefaultLanguageModel,
  getEmbeddingModel,
} from '@/lib/ai/dynamic-config';
import { searchKnowledgeEntries } from '@/lib/actions/knowledge.actions';
import { logger } from '@/lib/logger/client';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let snippetId: string | null = null;
  try {
    const { id: projectId } = await params;
    const { messages } = await req.json();

    snippetId = logger.startSnippet({
      snippet_id: `knowledge-chat-${projectId}-${Date.now()}`,
      name: '知识库对话流程',
    }) as string | null;

    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: '消息列表不能为空' }, { status: 400 });
    }

    if (snippetId) {
      await logger.logSnippet('收到知识库对话请求', snippetId, 'knowledge-chat', {
        projectId,
        messageCount: messages.length,
      });
    }

    const extractText = (message: any): string => {
      if (!message) return '';

      if (typeof message.content === 'string') {
        return message.content;
      }

      if (Array.isArray(message.parts)) {
        return message.parts
          .filter((part: any) => part && part.type === 'text' && typeof part.text === 'string')
          .map((part: any) => part.text)
          .join('\n');
      }

      return '';
    };

    const lastUserMessage = [...messages]
      .reverse()
      .find((message) => message.role === 'user');

    const userInput = extractText(lastUserMessage);

    if (!userInput.trim()) {
      return NextResponse.json({ error: '缺少用户输入' }, { status: 400 });
    }

    const embeddingInfo = await getEmbeddingModel();

    if (snippetId) {
      await logger.logSnippet('Embedding 模型解析完成', snippetId, 'knowledge-chat', {
        projectId,
        embeddingProviderId: embeddingInfo.provider.id,
        embeddingProviderName: embeddingInfo.provider.name,
        embeddingModel: embeddingInfo.modelName,
      });
    }

    const { embedding } = await embed({
      model: embeddingInfo.model,
      value: userInput,
    });

    const relatedEntries = await searchKnowledgeEntries(
      projectId,
      Array.from(embedding),
      5
    );

    if (snippetId) {
      await logger.logSnippet('知识库检索完成', snippetId, 'knowledge-chat', {
        projectId,
        relatedEntryCount: relatedEntries.length,
        topSimilarities: relatedEntries.map((entry) => entry.similarity.toFixed(3)),
      });
    }

    const context = relatedEntries
      .map((entry, index) =>
        `片段${index + 1} (相似度 ${entry.similarity.toFixed(3)}):\n${entry.content}`
      )
      .join('\n\n');

    const systemPrompt = `你是一名知识库助手，请结合知识库内容回答用户问题。` +
      (context
        ? `\n\n已检索到以下知识库片段，请优先引用：\n${context}\n\n如果回答中引用了知识库，请以 [片段编号] 的形式标注出处。`
        : '\n\n当前知识库中没有找到相关片段，请基于已有对话谨慎回答，可提示用户补充知识库。');

    const normalizedMessages = messages
      .filter((message) => message.role === 'user' || message.role === 'assistant')
      .map((message) => ({
        role: message.role,
        content: extractText(message),
      }))
      .filter((message) => message.content.trim());

    const textModelInfo = await getDefaultLanguageModel();

    if (snippetId) {
      await logger.logSnippet('文本模型解析完成', snippetId, 'knowledge-chat', {
        projectId,
        textProviderId: textModelInfo.provider.id,
        textProviderName: textModelInfo.provider.name,
        textModel: textModelInfo.modelName,
      });
    }

    const result = streamText({
      model: textModelInfo.model,
      messages: [{ role: 'system', content: systemPrompt }, ...normalizedMessages],
    });

    if (snippetId) {
      await logger.logSnippet('开始流式推理', snippetId, 'knowledge-chat', {
        projectId,
        normalizedMessageCount: normalizedMessages.length,
      });
      await logger.endSnippet(snippetId);
    }

    return result.toAIStreamResponse();
  } catch (error) {
    const message =
      error instanceof Error ? error.message : '知识库对话失败';
    const status =
      message.includes('Embedding') || message.includes('embedding')
        ? 400
        : 500;
    if (snippetId) {
      await logger.logSnippet(`对话流程失败: ${message}`, snippetId, 'knowledge-chat', {
        error: message,
      });
      await logger.endSnippet(snippetId);
    }
    await logger.error(`知识库对话失败: ${message}`, 'knowledge-chat', {
      error: message,
    });
    return NextResponse.json({ error: message }, { status });
  }
}
