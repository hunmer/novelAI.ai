import { NextRequest, NextResponse } from 'next/server';
import { nanoid } from 'nanoid';
import fs from 'fs/promises';
import path from 'path';

const PROMPTS_FILE = path.join(process.cwd(), 'data', 'prompts.json');

interface Prompt {
  id: string;
  name: string;
  content: string;
  type: 'world' | 'character' | 'scene' | 'dialog';
  projectId: string;
  createdAt: string;
  updatedAt: string;
  isDefault?: boolean;
}

async function ensureDataDir() {
  const dataDir = path.join(process.cwd(), 'data');
  try {
    await fs.access(dataDir);
  } catch {
    await fs.mkdir(dataDir, { recursive: true });
  }
}

async function getPrompts(): Promise<Prompt[]> {
  try {
    await ensureDataDir();
    const data = await fs.readFile(PROMPTS_FILE, 'utf-8');
    return JSON.parse(data);
  } catch {
    return [];
  }
}

async function savePrompts(prompts: Prompt[]) {
  await ensureDataDir();
  await fs.writeFile(PROMPTS_FILE, JSON.stringify(prompts, null, 2));
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const projectId = searchParams.get('projectId');
    const type = searchParams.get('type') as 'world' | 'character' | 'scene' | 'dialog' | null;

    let prompts = await getPrompts();

    if (projectId) {
      prompts = prompts.filter((p) => p.projectId === projectId);
    }

    if (type) {
      prompts = prompts.filter((p) => p.type === type);
    }

    return NextResponse.json({ prompts });
  } catch (error) {
    console.error('获取提示词失败:', error);
    return NextResponse.json({ error: '获取提示词失败' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, content, type, projectId, isDefault } = body;

    if (!name || !content || !type || !projectId) {
      return NextResponse.json({ error: '缺少必要字段' }, { status: 400 });
    }

    const prompts = await getPrompts();
    const newPrompt: Prompt = {
      id: nanoid(),
      name,
      content,
      type,
      projectId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isDefault: isDefault || false,
    };

    prompts.push(newPrompt);
    await savePrompts(prompts);

    return NextResponse.json({ prompt: newPrompt });
  } catch (error) {
    console.error('创建提示词失败:', error);
    return NextResponse.json({ error: '创建提示词失败' }, { status: 500 });
  }
}
