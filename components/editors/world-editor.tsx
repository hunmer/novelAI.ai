'use client';

import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { MarkdownEditor } from '@/components/ui/markdown-editor';
import { Card } from '@/components/ui/card';
import { updateWorld } from '@/lib/actions/world.actions';
import { WorldVersionRollback } from '@/components/project/world-version-rollback';
import { useSocket } from '@/lib/socket/client';
import { SparklesIcon, RefreshCw } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Typewriter } from '@/components/ui/typewriter';

interface Prompt {
  id: string;
  name: string;
  content: string;
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
    const handlePatch = (data: any) => {
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
      // 如果选择了预设提示词，使用预设提示词内容
      let finalPrompt = prompt;
      if (selectedPromptId) {
        const selectedPrompt = prompts.find((p) => p.id === selectedPromptId);
        if (selectedPrompt) {
          finalPrompt = prompt
            ? `${selectedPrompt.content}\n\n${prompt}`
            : selectedPrompt.content;
        }
      }

      const response = await fetch('/api/ai/world', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: finalPrompt }),
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
        body: JSON.stringify({ prompt: combinedPrompt }),
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

                <div className="flex justify-end">
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
            {isStreaming ? (
              <div className="border rounded-md p-4 min-h-[500px] bg-background">
                <Typewriter text={streamingContent} typeSpeed={20} />
              </div>
            ) : (
              <MarkdownEditor
                value={content}
                onChange={setContent}
                placeholder="世界观内容将在这里显示..."
                rows={20}
              />
            )}
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
    </div>
  );
}
