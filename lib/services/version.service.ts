import * as jsondiffpatch from 'jsondiffpatch';
import { prisma } from '@/lib/db/prisma';

const differ = jsondiffpatch.create({
  objectHash: (obj: { id?: unknown } | Record<string, unknown>) => (obj as { id?: unknown }).id || JSON.stringify(obj),
  arrays: { detectMove: true },
});

export class VersionService {
  static async createSnapshot(
    projectId: string,
    newData: Record<string, unknown>,
    source: 'ai' | 'manual'
  ) {
    const latestVersion = await prisma.version.findFirst({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
    });

    let snapshot: string | null;
    let baseVersionId: string | null = null;

    if (latestVersion) {
      const oldData = JSON.parse(latestVersion.snapshot);
      const delta = differ.diff(oldData, newData);

      if (!delta) return null;

      snapshot = JSON.stringify(delta);
      baseVersionId = latestVersion.id;
    } else {
      snapshot = JSON.stringify(newData);
    }

    return await prisma.version.create({
      data: {
        projectId,
        snapshot,
        source,
        baseVersionId,
      },
    });
  }

  static async getVersionHistory(projectId: string) {
    return await prisma.version.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
    });
  }

  static async reconstructVersion(versionId: string) {
    const targetVersion = await prisma.version.findUnique({
      where: { id: versionId },
    });

    if (!targetVersion) throw new Error('Version not found');

    const chain = await this.getVersionChain(targetVersion);

    let state = JSON.parse(chain[0].snapshot);

    for (let i = 1; i < chain.length; i++) {
      const delta = JSON.parse(chain[i].snapshot);
      state = differ.patch(state, delta);
    }

    return state;
  }

  private static async getVersionChain(version: { id: string; baseVersionId: string | null; snapshot: string }) {
    const chain = [version];
    let current = version;

    while (current.baseVersionId) {
      const base = await prisma.version.findUnique({
        where: { id: current.baseVersionId },
      });
      if (!base) break;
      chain.unshift(base);
      current = base;
    }

    return chain;
  }

  static async compareVersions(versionId1: string, versionId2: string) {
    const [data1, data2] = await Promise.all([
      this.reconstructVersion(versionId1),
      this.reconstructVersion(versionId2),
    ]);

    return differ.diff(data1, data2);
  }

  static async rollbackToVersion(projectId: string, versionId: string) {
    const data = await this.reconstructVersion(versionId);

    await prisma.project.update({
      where: { id: projectId },
      data: {
        world: data.world,
        meta: data.meta,
      },
    });

    return data;
  }
}
