'use client';

import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { updateWorld } from '@/lib/actions/world.actions';
import { WorldVersionRollback } from '@/components/project/world-version-rollback';
import { useSocket } from '@/lib/socket/client';
import { SparklesIcon, RefreshCw, UsersIcon } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { GenerateCharactersDialog } from '@/components/dialogs/generate-characters-dialog';
import { logger } from '@/lib/logger/client';
import dynamic from 'next/dynamic';

const Editor = dynamic(() => import('@monaco-editor/react'), { ssr: false });

interface Prompt {
  id: string;
  name: string;
  content?: string;
  system?: string;
  user?: string;
}

interface WorldEditorProps {
  projectId: string;
  initialWorld?: string;
}

export function WorldEditor({ projectId, initialWorld }: WorldEditorProps) {
  const [content, setContent] = useState(initialWorld || '');
  const [prompt, setPrompt] = useState('');
  const [refinementPrompt, setRefinementPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRefining, setIsRefining] = useState(false);
  const [generatedContent, setGeneratedContent] = useState('');
  const [streamingContent, setStreamingContent] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [selectedPromptId, setSelectedPromptId] = useState<string>('');
  const [showCharacterDialog, setShowCharacterDialog] = useState(false);

  // 生成稳定的用户ID（仅在组件挂载时生成一次）
  const userId = useMemo(
    () => 'demo-user-' + Math.random().toString(36).substring(7),
    []
  );

  // Socket.IO实时协作
  const { emit, on, off } = useSocket(
    projectId,
    userId,
    '访客用户'
  );

  // 加载提示词列表
  useEffect(() => {
    const fetchPrompts = async () => {
      try {
        const res = await fetch(`/api/prompts?projectId=${projectId}&type=world`);
        const data = await res.json();
        setPrompts(data.prompts || []);
      } catch (error) {
        console.error('获取提示词失败:', error);
      }
    };
    fetchPrompts();
  }, [projectId]);

  // 监听其他用户的更新
  useEffect(() => {
    const handlePatch = (data: {
      module: string;
      userId: string;
      delta: string;
    }) => {
      if (data.module === 'world') {
        console.log('Received world update from user:', data.userId);
        setContent(data.delta);
      }
    };

    on('project:patch', handlePatch);

    return () => {
      off('project:patch', handlePatch);
    };
  }, [on, off]);

  const handleGenerate = async () => {
    if (!prompt && !selectedPromptId) return;
    setIsGenerating(true);
    setIsStreaming(true);
    setStreamingContent('');

    try {
      const manualPrompt = prompt.trim();
      const applyReplacements = (template: string, replacements: Record<string, string>) =>
        template.replace(/%([A-Za-z0-9_]+)%/g, (match, key) => replacements[key] ?? '');

      let finalPrompt = manualPrompt;
      let resolvedSystem: string | undefined;
      let templateApplied = false;

      // 如果选择了预设提示词，使用预设提示词内容
      if (selectedPromptId) {
        const selectedPrompt = prompts.find((p) => p.id === selectedPromptId);
        if (selectedPrompt) {
          const presetUser = selectedPrompt.user ?? selectedPrompt.content ?? '';
          const presetSystem = selectedPrompt.system ?? '';
          const replacements: Record<string, string> = {
            input: manualPrompt,
            worldContext: '',
          };

          const resolvedPreset = presetUser
            ? applyReplacements(presetUser, replacements)
            : '';
          resolvedSystem = presetSystem
            ? applyReplacements(presetSystem, replacements)
            : undefined;

          const hasInputPlaceholder = presetUser.includes('%input%');
          if (manualPrompt && !hasInputPlaceholder) {
            finalPrompt = [resolvedPreset, manualPrompt].filter(Boolean).join('\n\n');
          } else {
            finalPrompt = resolvedPreset || manualPrompt;
          }

          templateApplied = true;
        }
      }

      if (!finalPrompt.trim()) {
        setIsGenerating(false);
        setIsStreaming(false);
        return;
      }

      const response = await fetch('/api/ai/world', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: finalPrompt,
          systemPrompt: resolvedSystem,
          templateApplied,
          outputFormat: 'json'
        }),
      });

      if (!response.ok) throw new Error('Generation failed');

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let fullText = '';

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          fullText += chunk;
          setStreamingContent(fullText);
        }

        setGeneratedContent(fullText);
        setContent(fullText);

        // 保存生成的内容
        await updateWorld(projectId, fullText);
      }
    } finally {
      setIsGenerating(false);
      setIsStreaming(false);
    }
  };

  const handleRefine = async () => {
    if (!refinementPrompt || !generatedContent) return;
    setIsRefining(true);
    setIsStreaming(true);
    setStreamingContent('');

    try {
      const combinedPrompt = `基于以下世界观内容进行改进：\n\n${generatedContent}\n\n改进要求：${refinementPrompt}`;

      const response = await fetch('/api/ai/world', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: combinedPrompt,
          templateApplied: true,
          outputFormat: 'json'
        }),
      });

      if (!response.ok) throw new Error('Refinement failed');

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let fullText = '';

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          fullText += chunk;
          setStreamingContent(fullText);
        }

        setGeneratedContent(fullText);
        setContent(fullText);

        // 保存改进的内容
        await updateWorld(projectId, fullText);
      }
    } finally {
      setIsRefining(false);
      setIsStreaming(false);
    }
  };

  const handleSave = async () => {
    await updateWorld(projectId, content);

    // 广播更新给其他用户
    emit('project:update', {
      projectId,
      module: 'world',
      delta: content,
      version: Date.now(),
      userId: 'demo-user',
    });
  };

  const handleCharactersGenerated = async (charactersJson: string) => {
    const snippetId = logger.startSnippet({
      snippet_id: `add-characters-${Date.now()}`,
      name: '添加生成的角色',
    });

    try {
      if (snippetId) {
        await logger.logSnippet('开始解析并添加角色', snippetId, 'character-add');
      }

      // 清理和提取JSON内容
      let jsonContent = charactersJson.trim();

      // 尝试提取JSON对象（处理可能的Markdown代码块或其他包装）
      const jsonMatch = jsonContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        jsonContent = jsonMatch[0];
      }

      // 解析JSON格式的角色数据
      const data = JSON.parse(jsonContent);
      const characters = data.characters || [];

      for (const char of characters) {
        // 将角色数据转换为JSON字符串存储
        const attributes = JSON.stringify({
          age: char.age,
          gender: char.gender,
          personality: char.personality,
          background: char.background,
          skills: char.skills,
          relationships: char.relationships,
          role: char.role,
        });

        // 创建角色
        await fetch(`/api/characters`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            projectId,
            name: char.name,
            attributes,
          }),
        });
      }

      if (snippetId) {
        await logger.logSnippet(`成功添加${characters.length}个角色`, snippetId, 'character-add');
        await logger.endSnippet(snippetId);
      }
    } catch (error) {
      if (snippetId) {
        await logger.logSnippet(
          `添加角色失败: ${error instanceof Error ? error.message : '未知错误'}`,
          snippetId,
          'character-add',
          { level: 'error' }
        );
        await logger.endSnippet(snippetId);
      }

      await logger.error(
        `添加角色失败: ${error instanceof Error ? error.message : '未知错误'}`,
        'character-add'
      );
    }
  };

  return (
    <div className="grid grid-cols-4 gap-4">
      <div className="col-span-3 space-y-4">
        <Card className="p-4">
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">AI 生成世界观</label>
              <div className="space-y-3">
                <Select value={selectedPromptId || 'none'} onValueChange={(value) => setSelectedPromptId(value === 'none' ? '' : value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="选择预设提示词（可选）" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">不使用预设</SelectItem>
                    {prompts.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="描述你想要的世界观,例如: 创建一个赛博朋克风格的未来都市..."
                  rows={3}
                  className="w-full"
                />

                <div className="flex justify-end gap-2">
                  <Button
                    onClick={() => setShowCharacterDialog(true)}
                    disabled={!content}
                    variant="outline"
                  >
                    <UsersIcon className="h-4 w-4 mr-2" />
                    从世界观生成角色
                  </Button>
                  <Button onClick={handleGenerate} disabled={isGenerating}>
                    <SparklesIcon className="h-4 w-4 mr-2" />
                    {isGenerating ? '生成中...' : '生成'}
                  </Button>
                </div>
              </div>
            </div>

            {generatedContent && (
              <div className="space-y-2 pt-4 border-t">
                <label className="text-sm font-medium">改进世界观</label>
                <div className="flex gap-2">
                  <Textarea
                    value={refinementPrompt}
                    onChange={(e) => setRefinementPrompt(e.target.value)}
                    placeholder="描述你想要的改进，例如: 增加更多科技元素，添加政治派系..."
                    rows={2}
                  />
                  <Button onClick={handleRefine} disabled={isRefining} variant="secondary">
                    <RefreshCw className="h-4 w-4 mr-2" />
                    {isRefining ? '改进中...' : '改进'}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </Card>

        <Card className="p-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">世界观内容</label>
            <div className="border rounded-md overflow-hidden">
              <Editor
                height="500px"
                defaultLanguage={isStreaming ? "plaintext" : "json"}
                theme="vs-dark"
                value={isStreaming ? streamingContent : content}
                onChange={(value) => !isStreaming && setContent(value || '')}
                options={{
                  readOnly: isStreaming,
                  minimap: { enabled: false },
                  fontSize: 14,
                  lineNumbers: 'on',
                  scrollBeyondLastLine: false,
                  wordWrap: 'on',
                  automaticLayout: true,
                }}
              />
            </div>
            <Button onClick={handleSave} variant="outline" disabled={isStreaming}>
              保存
            </Button>
          </div>
        </Card>
      </div>

      <div className="col-span-1 space-y-4">
        <WorldVersionRollback
          projectId={projectId}
          currentContent={content}
          onRestore={() => window.location.reload()}
        />
      </div>

      <GenerateCharactersDialog
        open={showCharacterDialog}
        onOpenChange={setShowCharacterDialog}
        worldContext={content}
        projectId={projectId}
        onConfirm={handleCharactersGenerated}
      />
    </div>
  );
}
