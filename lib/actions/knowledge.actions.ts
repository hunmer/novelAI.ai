'use server';

import { embed } from 'ai';
import { prisma } from '@/lib/db/prisma';
import { getEmbeddingModel } from '@/lib/ai/dynamic-config';

interface KnowledgeMetadata {
  [key: string]: any;
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
