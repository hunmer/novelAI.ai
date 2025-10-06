import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const PROMPTS_FILE = path.join(process.cwd(), 'data', 'prompts.json');

interface Prompt {
  id: string;
  name: string;
  content: string;
  type: 'world' | 'character';
  projectId: string;
  createdAt: string;
  updatedAt: string;
}

async function getPrompts(): Promise<Prompt[]> {
  try {
    const data = await fs.readFile(PROMPTS_FILE, 'utf-8');
    return JSON.parse(data);
  } catch {
    return [];
  }
}

async function savePrompts(prompts: Prompt[]) {
  const dataDir = path.join(process.cwd(), 'data');
  try {
    await fs.access(dataDir);
  } catch {
    await fs.mkdir(dataDir, { recursive: true });
  }
  await fs.writeFile(PROMPTS_FILE, JSON.stringify(prompts, null, 2));
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body = await request.json();
    const prompts = await getPrompts();

    const index = prompts.findIndex((p) => p.id === id);
    if (index === -1) {
      return NextResponse.json({ error: '提示词不存在' }, { status: 404 });
    }

    prompts[index] = {
      ...prompts[index],
      ...body,
      updatedAt: new Date().toISOString(),
    };

    await savePrompts(prompts);

    return NextResponse.json({ prompt: prompts[index] });
  } catch (error) {
    console.error('更新提示词失败:', error);
    return NextResponse.json({ error: '更新提示词失败' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const prompts = await getPrompts();

    const filtered = prompts.filter((p) => p.id !== id);
    if (filtered.length === prompts.length) {
      return NextResponse.json({ error: '提示词不存在' }, { status: 404 });
    }

    await savePrompts(filtered);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('删除提示词失败:', error);
    return NextResponse.json({ error: '删除提示词失败' }, { status: 500 });
  }
}
