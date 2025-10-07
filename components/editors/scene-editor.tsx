'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { MarkdownEditor } from '@/components/ui/markdown-editor';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SparklesIcon, TrashIcon } from 'lucide-react';
import { Typewriter } from '@/components/ui/typewriter';
import { ImageGenerator } from '@/components/image/image-generator';

interface Scene {
  id: string;
  name: string;
  description: string | null;
  paintingPrompt: string | null;
  backgroundImage: string | null;
  backgroundThumbnail: string | null;
  createdAt: string;
  updatedAt: string;
}

interface SceneEditorProps {
  projectId: string;
  worldContext?: string;
}

export function SceneEditor({ projectId, worldContext }: SceneEditorProps) {
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [keywords, setKeywords] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);

  useEffect(() => {
    loadScenes();
  }, [projectId]);

  const loadScenes = async () => {
    try {
      const res = await fetch(`/api/scenes?projectId=${projectId}`);
      const data = await res.json();
      setScenes(data.scenes || []);
    } catch (error) {
      console.error('加载场景失败:', error);
    }
  };

  const handleGenerate = async () => {
    if (!keywords) return;
    setIsGenerating(true);
    setIsStreaming(true);
    setStreamingContent('');

    try {
      const response = await fetch('/api/ai/scene', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keywords, worldContext }),
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

        // 解析生成的内容，提取绘画提示词
        const paintingPromptMatch = fullText.match(/绘画提示词[：:]\s*(.+?)$/ms);
        const paintingPrompt = paintingPromptMatch
          ? paintingPromptMatch[1].trim()
          : '';
        const description = paintingPrompt
          ? fullText.replace(/绘画提示词[：:][\s\S]*$/, '').trim()
          : fullText;

        // 提取场景名称（第一个#标题）
        const nameMatch = description.match(/^#\s*(.+?)$/m);
        const sceneName = nameMatch ? nameMatch[1].trim() : keywords;

        // 创建新场景
        const newScene = await fetch(`/api/scenes`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            projectId,
            name: sceneName,
            description,
            paintingPrompt,
          }),
        }).then((res) => res.json());

        await loadScenes();
        setSelectedId(newScene.id);
        setKeywords('');
      }
    } catch (error) {
      console.error('场景生成失败:', error);
      alert('场景生成失败：' + (error instanceof Error ? error.message : '未知错误'));
    } finally {
      setIsGenerating(false);
      setIsStreaming(false);
    }
  };

  const handleUpdate = async (id: string, updates: Partial<Scene>) => {
    try {
      await fetch(`/api/scenes/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      await loadScenes();
    } catch (error) {
      console.error('更新场景失败:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除此场景吗？')) return;

    try {
      await fetch(`/api/scenes/${id}`, { method: 'DELETE' });
      await loadScenes();
      if (selectedId === id) setSelectedId(null);
    } catch (error) {
      console.error('删除场景失败:', error);
    }
  };

  const handleImageGenerated = (
    imageUrl: string,
    _imageId: string,
    thumbnailUrl?: string
  ) => {
    if (selectedId) {
      handleUpdate(selectedId, {
        backgroundImage: imageUrl,
        backgroundThumbnail: thumbnailUrl ?? null,
      });
    }
  };

  const handleSetBackground = (
    imageUrl: string | null,
    thumbnailUrl?: string | null
  ) => {
    if (!selectedId) return;
    handleUpdate(selectedId, {
      backgroundImage: imageUrl,
      backgroundThumbnail: thumbnailUrl ?? null,
    });
  };

  const selected = scenes.find((s) => s.id === selectedId);

  return (
    <div className="grid grid-cols-3 gap-4">
      <div className="col-span-1 space-y-4">
        <Card className="p-4">
          <div className="space-y-2">
            <Label htmlFor="keywords">场景关键词</Label>
            <Textarea
              id="keywords"
              value={keywords}
              onChange={(e) => setKeywords(e.target.value)}
              placeholder="描述场景关键词，例如：赛博朋克酒吧、未来都市广场..."
              rows={3}
            />
            <Button onClick={handleGenerate} disabled={isGenerating} className="w-full">
              <SparklesIcon className="h-4 w-4 mr-2" />
              {isGenerating ? '生成中...' : '生成场景'}
            </Button>
          </div>
        </Card>

        <div className="space-y-2">
          <h3 className="text-sm font-medium">场景列表</h3>
          {scenes.map((scene) => (
            <Card
              key={scene.id}
              className={`p-3 cursor-pointer ${
                selectedId === scene.id ? 'border-primary' : ''
              }`}
              onClick={() => setSelectedId(scene.id)}
            >
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 overflow-hidden rounded-md border bg-muted">
                  {scene.backgroundImage ? (
                    <img
                      src={scene.backgroundThumbnail || scene.backgroundImage}
                      alt={`${scene.name} 缩略图`}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-[10px] text-muted-foreground">
                      无封面
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{scene.name}</div>
                  <div className="text-xs text-muted-foreground mt-1 truncate">
                    {scene.description ? '已编写描述' : '暂无描述'}
                  </div>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(scene.id);
                  }}
                >
                  <TrashIcon className="h-4 w-4" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      </div>

      <div className="col-span-2">
        {isStreaming ? (
          <Card className="p-4 space-y-4">
            <div className="text-sm font-medium">正在生成场景...</div>
            <div className="border rounded-md p-4 min-h-[500px] bg-background">
              <Typewriter text={streamingContent} typeSpeed={20} />
            </div>
          </Card>
        ) : selected ? (
          <Tabs defaultValue="description">
            <TabsList className="mb-4">
              <TabsTrigger value="description">场景描述</TabsTrigger>
              <TabsTrigger value="image">场景插图</TabsTrigger>
            </TabsList>

            <TabsContent value="description">
              <Card className="p-4 space-y-4">
                <div>
                  <Label htmlFor="scene-name">场景名称</Label>
                  <Input
                    id="scene-name"
                    value={selected.name}
                    onChange={(e) => handleUpdate(selected.id, { name: e.target.value })}
                  />
                </div>

                <div>
                  <Label htmlFor="scene-desc">场景描述（Markdown）</Label>
                  <MarkdownEditor
                    id="scene-desc"
                    value={selected.description || ''}
                    onChange={(value) =>
                      handleUpdate(selected.id, { description: value })
                    }
                    rows={15}
                  />
                </div>

                <div>
                  <Label htmlFor="painting-prompt">绘画提示词</Label>
                  <Textarea
                    id="painting-prompt"
                    value={selected.paintingPrompt || ''}
                    onChange={(e) =>
                      handleUpdate(selected.id, { paintingPrompt: e.target.value })
                    }
                    placeholder="用于生成场景插图的英文提示词..."
                    rows={3}
                  />
                </div>
              </Card>
            </TabsContent>

            <TabsContent value="image">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>生成与历史</Label>
                  {selected.backgroundImage && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleSetBackground(null)}
                    >
                      移除背景图
                    </Button>
                  )}
                </div>

                <ImageGenerator
                  projectId={projectId}
                  sceneId={selected.id}
                  initialPrompt={selected.paintingPrompt || ''}
                  onImageGenerated={handleImageGenerated}
                  highlightImageUrl={selected.backgroundImage}
                  highlightThumbnailUrl={selected.backgroundThumbnail}
                  onSetBackground={(imageUrl, thumbnailUrl) =>
                    handleSetBackground(imageUrl, thumbnailUrl)
                  }
                />
              </div>
            </TabsContent>
          </Tabs>
        ) : (
          <Card className="p-12 text-center text-muted-foreground">
            选择或生成一个场景
          </Card>
        )}
      </div>
    </div>
  );
}
