'use server';

import { embed } from 'ai';
import { prisma } from '@/lib/db/prisma';
import { getEmbeddingModel } from '@/lib/ai/dynamic-config';

interface KnowledgeMetadata {
  [key: string]: string | number | boolean | null;
}

export interface KnowledgeEntry {
  id: string;
  projectId: string;
  content: string;
  metadata: KnowledgeMetadata;
  createdAt: Date;
}

export interface KnowledgeSearchResult extends KnowledgeEntry {
  similarity: number;
}

export interface KnowledgeChatSession {
  id: string;
  projectId: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface KnowledgeChatMessage {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: Date;
}

function parseEmbedding(payload: string | null): number[] {
  if (!payload) return [];
  try {
    const parsed = JSON.parse(payload);
    return Array.isArray(parsed) ? parsed.map(Number) : [];
  } catch (error) {
    console.error('Failed to parse embedding payload', error);
    return [];
  }
}

function serializeMetadata(metadata?: KnowledgeMetadata): string {
  try {
    return JSON.stringify(metadata || {});
  } catch (error) {
    console.error('Failed to serialize metadata', error);
    return '{}';
  }
}

function serializeEmbedding(vector: number[]): string {
  return JSON.stringify(vector);
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (!a.length || !b.length || a.length !== b.length) {
    return 0;
  }

  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  if (!normA || !normB) {
    return 0;
  }

  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

export async function listKnowledgeEntries(projectId: string): Promise<KnowledgeEntry[]> {
  const records = await prisma.knowledgeBase.findMany({
    where: { projectId },
    orderBy: { createdAt: 'desc' },
  });

  return records.map((record) => ({
    id: record.id,
    projectId: record.projectId,
    content: record.content,
    metadata: (() => {
      try {
        return JSON.parse(record.metadata);
      } catch {
        return {};
      }
    })(),
    createdAt: record.createdAt,
  }));
}

async function generateEmbedding(value: string): Promise<number[]> {
  const { model, provider, modelName } = await getEmbeddingModel();
  const { embedding } = await embed({ model, value });
  if (!embedding.length) {
    throw new Error(`Embedding生成失败，提供商：${provider.name}，模型：${modelName}`);
  }
  return Array.from(embedding);
}

export async function createKnowledgeEntry(
  projectId: string,
  content: string,
  metadata?: KnowledgeMetadata
): Promise<KnowledgeEntry> {
  if (!content.trim()) {
    throw new Error('知识库内容不能为空');
  }

  const vector = await generateEmbedding(content);

  const record = await prisma.knowledgeBase.create({
    data: {
      projectId,
      content,
      metadata: serializeMetadata(metadata),
      embedding: serializeEmbedding(vector),
    },
  });

  return {
    id: record.id,
    projectId: record.projectId,
    content: record.content,
    metadata: metadata || {},
    createdAt: record.createdAt,
  };
}

export async function deleteKnowledgeEntry(id: string): Promise<void> {
  await prisma.knowledgeBase.delete({ where: { id } });
}

export async function updateKnowledgeEntry(
  projectId: string,
  id: string,
  content: string,
  metadata?: KnowledgeMetadata
): Promise<KnowledgeEntry> {
  if (!content.trim()) {
    throw new Error('知识库内容不能为空');
  }

  const existing = await prisma.knowledgeBase.findUnique({
    where: { id },
    select: { projectId: true },
  });

  if (!existing || existing.projectId !== projectId) {
    throw new Error('知识库片段不存在或不属于当前项目');
  }

  const vector = await generateEmbedding(content);

  const record = await prisma.knowledgeBase.update({
    where: { id },
    data: {
      content,
      metadata: serializeMetadata(metadata),
      embedding: serializeEmbedding(vector),
    },
  });

  return {
    id: record.id,
    projectId: record.projectId,
    content: record.content,
    metadata: metadata || {},
    createdAt: record.createdAt,
  };
}

export async function searchKnowledgeEntries(
  projectId: string,
  queryEmbedding: number[],
  topK = 5
): Promise<KnowledgeSearchResult[]> {
  const records = await prisma.knowledgeBase.findMany({ where: { projectId } });

  return records
    .map((record) => {
      const embeddingVector = parseEmbedding(record.embedding);
      const similarity = cosineSimilarity(queryEmbedding, embeddingVector);
      const result: KnowledgeSearchResult = {
        id: record.id,
        projectId: record.projectId,
        content: record.content,
        metadata: (() => {
          try {
            return JSON.parse(record.metadata);
          } catch {
            return {};
          }
        })(),
        createdAt: record.createdAt,
        similarity,
      };
      return result;
    })
    .filter((result) => result.similarity > 0)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, topK);
}

export async function listKnowledgeChatSessions(
  projectId: string
): Promise<KnowledgeChatSession[]> {
  const sessions = await prisma.knowledgeChatSession.findMany({
    where: { projectId },
    orderBy: { updatedAt: 'desc' },
  });

  return sessions.map((session) => ({
    id: session.id,
    projectId: session.projectId,
    title: session.title,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
  }));
}

export async function createKnowledgeChatSession(
  projectId: string,
  title?: string
): Promise<KnowledgeChatSession> {
  const trimmedTitle = title?.trim();

  const session = await prisma.knowledgeChatSession.create({
    data: {
      projectId,
      ...(trimmedTitle ? { title: trimmedTitle } : {}),
    },
  });

  return {
    id: session.id,
    projectId: session.projectId,
    title: session.title,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
  };
}

export async function getKnowledgeChatMessages(
  projectId: string,
  sessionId: string,
  limit = 100
): Promise<KnowledgeChatMessage[]> {
  const session = await prisma.knowledgeChatSession.findUnique({
    where: { id: sessionId },
    select: { projectId: true },
  });

  if (!session || session.projectId !== projectId) {
    throw new Error('知识库对话会话不存在或不属于当前项目');
  }

  const records = await prisma.knowledgeChatMessage.findMany({
    where: { sessionId },
    orderBy: { createdAt: 'asc' },
    take: limit,
  });

  return records.map((record) => ({
    id: record.id,
    sessionId: record.sessionId,
    role: record.role as 'user' | 'assistant',
    content: record.content,
    createdAt: record.createdAt,
  }));
}

export async function appendKnowledgeChatMessages(
  projectId: string,
  sessionId: string,
  messages: Array<{ id?: string; role: 'user' | 'assistant'; content: string }>
): Promise<void> {
  if (!messages.length) return;

  const session = await prisma.knowledgeChatSession.findUnique({
    where: { id: sessionId },
    select: { projectId: true },
  });

  if (!session || session.projectId !== projectId) {
    throw new Error('知识库对话会话不存在或不属于当前项目');
  }

  const sanitized = messages
    .map((message) => ({
      id: typeof message.id === 'string' ? message.id : undefined,
      role: message.role,
      content: message.content.trim(),
    }))
    .filter((message) => Boolean(message.id) && message.content.length > 0) as Array<{
    id: string;
    role: 'user' | 'assistant';
    content: string;
  }>;

  if (!sanitized.length) {
    return;
  }

  await prisma.$transaction(async (tx) => {
    for (const message of sanitized) {
      await tx.knowledgeChatMessage.upsert({
        where: { id: message.id },
        update: {
          role: message.role,
          content: message.content,
        },
        create: {
          id: message.id,
          sessionId,
          role: message.role,
          content: message.content,
        },
      });
    }

    await tx.knowledgeChatSession.update({
      where: { id: sessionId },
      data: { updatedAt: new Date() },
    });
  });
}

interface ImportOptions {
  worldview: boolean;
  characters: boolean;
  scenes: boolean;
}

interface ImportResult {
  success: boolean;
  imported: {
    worldview?: string;
    characters?: number;
    scenes?: number;
  };
  message: string;
}

export async function importProjectSettings(
  projectId: string,
  options: ImportOptions
): Promise<ImportResult> {
  const imported: ImportResult['imported'] = {};
  let totalImported = 0;

  try {
    // 导入世界观设定
    if (options.worldview) {
      const project = await prisma.project.findUnique({
        where: { id: projectId },
        select: { world: true },
      });

      if (project?.world && project.world !== '{}' && project.world.trim()) {
        // 使用固定ID来确保幂等性
        const worldEntryId = `${projectId}-worldview`;

        // 检查是否已存在
        const existing = await prisma.knowledgeBase.findFirst({
          where: {
            projectId,
            metadata: {
              contains: `"settingId":"${worldEntryId}"`,
            },
          },
        });

        if (existing) {
          // 更新现有条目
          const vector = await generateEmbedding(project.world);
          await prisma.knowledgeBase.update({
            where: { id: existing.id },
            data: {
              content: project.world,
              embedding: serializeEmbedding(vector),
              metadata: serializeMetadata({
                title: '世界观设定',
                settingId: worldEntryId,
                type: 'worldview',
              }),
            },
          });
        } else {
          // 创建新条目
          await createKnowledgeEntry(projectId, project.world, {
            title: '世界观设定',
            settingId: worldEntryId,
            type: 'worldview',
          });
        }

        imported.worldview = worldEntryId;
        totalImported++;
      }
    }

    // 导入角色列表
    if (options.characters) {
      const characters = await prisma.character.findMany({
        where: { projectId },
        orderBy: { createdAt: 'desc' },
      });

      for (const character of characters) {
        const characterEntryId = `${projectId}-character-${character.id}`;

        const content = `# 角色：${character.name}\n\n${character.attributes}`;

        // 检查是否已存在
        const existing = await prisma.knowledgeBase.findFirst({
          where: {
            projectId,
            metadata: {
              contains: `"settingId":"${characterEntryId}"`,
            },
          },
        });

        if (existing) {
          // 更新现有条目
          const vector = await generateEmbedding(content);
          await prisma.knowledgeBase.update({
            where: { id: existing.id },
            data: {
              content,
              embedding: serializeEmbedding(vector),
              metadata: serializeMetadata({
                title: `角色：${character.name}`,
                settingId: characterEntryId,
                type: 'character',
                characterId: character.id,
              }),
            },
          });
        } else {
          // 创建新条目
          await createKnowledgeEntry(projectId, content, {
            title: `角色：${character.name}`,
            settingId: characterEntryId,
            type: 'character',
            characterId: character.id,
          });
        }
      }

      imported.characters = characters.length;
      totalImported += characters.length;
    }

    // 导入场景列表
    if (options.scenes) {
      const scenes = await prisma.scene.findMany({
        where: { projectId },
        orderBy: { createdAt: 'desc' },
      });

      for (const scene of scenes) {
        const sceneEntryId = `${projectId}-scene-${scene.id}`;

        const content = `# 场景：${scene.name}\n\n${scene.description || '无描述'}`;

        // 检查是否已存在
        const existing = await prisma.knowledgeBase.findFirst({
          where: {
            projectId,
            metadata: {
              contains: `"settingId":"${sceneEntryId}"`,
            },
          },
        });

        if (existing) {
          // 更新现有条目
          const vector = await generateEmbedding(content);
          await prisma.knowledgeBase.update({
            where: { id: existing.id },
            data: {
              content,
              embedding: serializeEmbedding(vector),
              metadata: serializeMetadata({
                title: `场景：${scene.name}`,
                settingId: sceneEntryId,
                type: 'scene',
                sceneId: scene.id,
              }),
            },
          });
        } else {
          // 创建新条目
          await createKnowledgeEntry(projectId, content, {
            title: `场景：${scene.name}`,
            settingId: sceneEntryId,
            type: 'scene',
            sceneId: scene.id,
          });
        }
      }

      imported.scenes = scenes.length;
      totalImported += scenes.length;
    }

    return {
      success: true,
      imported,
      message: `成功导入 ${totalImported} 项设定到知识库`,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : '导入失败';
    throw new Error(message);
  }
}
