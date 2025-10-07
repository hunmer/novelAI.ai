import { promises as fs } from 'fs';
import path from 'path';

const IMAGE_DIR = path.join(process.cwd(), 'public', 'generated-images');
const THUMBNAIL_DIR = path.join(IMAGE_DIR, 'thumbnails');

export type StoredImageInfo = {
  absolutePath: string;
  publicPath: string;
  fileName: string;
};

async function ensureDirectory(dir: string) {
  await fs.mkdir(dir, { recursive: true });
}

function toPublicPath(...segments: string[]) {
  return `/${path.posix.join(...segments)}`;
}

export async function persistImage(
  buffer: Buffer,
  fileName: string,
  type: 'original' | 'thumbnail'
): Promise<StoredImageInfo> {
  const baseDir = type === 'original' ? IMAGE_DIR : THUMBNAIL_DIR;
  await ensureDirectory(baseDir);
  const absolutePath = path.join(baseDir, fileName);
  await fs.writeFile(absolutePath, buffer);

  const publicSegments =
    type === 'original'
      ? ['generated-images', fileName]
      : ['generated-images', 'thumbnails', fileName];

  return {
    absolutePath,
    publicPath: toPublicPath(...publicSegments),
    fileName,
  };
}

export async function removeImageIfExists(publicPath?: string | null) {
  if (!publicPath) return;
  const normalized = publicPath.startsWith('/')
    ? publicPath.substring(1)
    : publicPath;
  const absolutePath = path.join(process.cwd(), 'public', normalized);
  try {
    await fs.unlink(absolutePath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error;
    }
  }
}

export function resolveImageExtension(contentType?: string | null) {
  if (!contentType) return 'png';
  if (contentType.includes('png')) return 'png';
  if (contentType.includes('webp')) return 'webp';
  if (contentType.includes('gif')) return 'gif';
  if (contentType.includes('bmp')) return 'bmp';
  return 'jpg';
}
