'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db/prisma';
import { AIClient } from '@/lib/ai/client';

export async function generateCharacter(
  projectId: string,
  prompt: string,
  worldContext?: string
) {
  const result = await AIClient.generate('characterGen', prompt, worldContext);

  const character = await prisma.character.create({
    data: {
      projectId,
      name: 'AI生成角色',
      attributes: result.text,
    },
  });

  revalidatePath(`/project/${projectId}`);
  return { success: true, data: character };
}

export async function getCharacters(projectId: string) {
  return await prisma.character.findMany({
    where: { projectId },
    orderBy: { createdAt: 'desc' },
  });
}

export async function updateCharacter(id: string, data: { name?: string; attributes?: string }) {
  const character = await prisma.character.update({
    where: { id },
    data,
  });
  return { success: true, data: character };
}

export async function deleteCharacter(id: string) {
  await prisma.character.delete({ where: { id } });
  return { success: true };
}
