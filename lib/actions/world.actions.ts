'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db/prisma';
import { AIClient } from '@/lib/ai/client';
import { VersionService } from '@/lib/services/version.service';

export async function generateWorld(projectId: string, prompt: string, kbContext?: string) {
  const result = await AIClient.generate('worldGen', prompt, kbContext);

  const project = await prisma.project.update({
    where: { id: projectId },
    data: { world: result.text },
  });

  await VersionService.createSnapshot(
    projectId,
    { world: project.world, meta: project.meta },
    'ai'
  );

  revalidatePath(`/project/${projectId}`);
  return { success: true, data: project.world };
}

export async function updateWorld(projectId: string, content: string) {
  const project = await prisma.project.update({
    where: { id: projectId },
    data: { world: content },
  });

  await VersionService.createSnapshot(
    projectId,
    { world: project.world, meta: project.meta },
    'manual'
  );

  revalidatePath(`/project/${projectId}`);
  return { success: true };
}
