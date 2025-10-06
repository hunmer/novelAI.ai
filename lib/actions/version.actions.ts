'use server';

import { revalidatePath } from 'next/cache';
import { VersionService } from '@/lib/services/version.service';

export async function getVersionHistory(projectId: string) {
  return await VersionService.getVersionHistory(projectId);
}

export async function rollbackToVersion(projectId: string, versionId: string) {
  const data = await VersionService.rollbackToVersion(projectId, versionId);
  revalidatePath(`/project/${projectId}`);
  return { success: true, data };
}

export async function compareVersions(versionId1: string, versionId2: string) {
  return await VersionService.compareVersions(versionId1, versionId2);
}
