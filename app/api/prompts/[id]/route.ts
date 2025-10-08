import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const PROMPTS_FILE = path.join(process.cwd(), 'data', 'prompts.json');

type PromptType = 'world' | 'character' | 'scene' | 'dialog' | 'portrait';

interface Prompt {
  id: string;
  name: string;
  content?: string;
  system?: string;
  user?: string;
  type: PromptType;
  projectId: string;
  createdAt: string;
  updatedAt: string;
  isDefault?: boolean;
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

    const updatedPrompt = { ...prompts[index] } as Prompt;

    if (typeof body.name === 'string') {
      updatedPrompt.name = body.name;
    }

    if (typeof body.type === 'string') {
      updatedPrompt.type = body.type;
    }

    if (typeof body.projectId === 'string') {
      updatedPrompt.projectId = body.projectId;
    }

    const resolvedUser =
      typeof body.user === 'string'
        ? body.user
        : typeof body.content === 'string'
          ? body.content
          : updatedPrompt.user ?? updatedPrompt.content ?? '';

    const resolvedSystem =
      typeof body.system === 'string' ? body.system : updatedPrompt.system ?? '';

    updatedPrompt.system = resolvedSystem;
    updatedPrompt.user = resolvedUser;
    updatedPrompt.content = resolvedUser;

    prompts[index] = {
      ...updatedPrompt,
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
