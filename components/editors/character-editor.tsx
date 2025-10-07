'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  getCharacters,
  updateCharacter,
  deleteCharacter,
} from '@/lib/actions/character.actions';
import { SparklesIcon, PlusIcon, TrashIcon } from 'lucide-react';
import type { Character } from '@prisma/client';
import { ImageGenerator } from '@/components/image/image-generator';
import dynamic from 'next/dynamic';

const Editor = dynamic(() => import('@monaco-editor/react'), { ssr: false });

interface CharacterEditorProps {
  projectId: string;
  worldContext?: string;
}

export function CharacterEditor({ projectId, worldContext }: CharacterEditorProps) {
  const [characters, setCharacters] = useState<Character[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);

  useEffect(() => {
    loadCharacters();
  }, [projectId]);

  const loadCharacters = async () => {
    const data = await getCharacters(projectId);
    setCharacters(data);
  };

  const handleGenerate = async () => {
    if (!prompt) return;
    setIsGenerating(true);
    setIsStreaming(true);
    setStreamingContent('');

    try {
      const response = await fetch('/api/ai/character', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          worldContext,
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

        // 解析JSON并提取角色信息
        let characterName = 'AI生成角色';
        let paintingPrompt = '';

        try {
          const jsonMatch = fullText.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const characterData = JSON.parse(jsonMatch[0]);
            characterName = characterData.name || characterName;
            paintingPrompt = characterData.paintingPrompt || '';
          }
        } catch (e) {
          console.warn('Failed to parse character JSON:', e);
        }

        // 创建新角色
        const newChar = await fetch(`/api/characters`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            projectId,
            name: characterName,
            attributes: fullText,
            paintingPrompt,
          }),
        }).then(res => res.json());

        await loadCharacters();
        setSelectedId(newChar.id);
      }
    } finally {
      setIsGenerating(false);
      setIsStreaming(false);
    }
  };

  const handleUpdate = async (id: string, updates: Partial<Character>) => {
    await updateCharacter(id, updates);
    await loadCharacters();
  };

  const handleImageGenerated = (
    imageUrl: string,
    _imageId: string,
    thumbnailUrl?: string
  ) => {
    if (selectedId) {
      handleUpdate(selectedId, {
        portraitImage: imageUrl,
        portraitThumbnail: thumbnailUrl ?? null,
      });
    }
  };

  const handleSetPortrait = (
    imageUrl: string | null,
    thumbnailUrl?: string | null
  ) => {
    if (!selectedId) return;
    handleUpdate(selectedId, {
      portraitImage: imageUrl,
      portraitThumbnail: thumbnailUrl ?? null,
    });
  };

  const handleDelete = async (id: string) => {
    await deleteCharacter(id);
    await loadCharacters();
    if (selectedId === id) setSelectedId(null);
  };

  const selected = characters.find((c) => c.id === selectedId);

  return (
    <div className="grid grid-cols-[300px_1fr] gap-4">
      <div className="space-y-4">
        <Card className="p-4">
          <div className="space-y-2">
            <Textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="描述角色,例如: 创建一个神秘的赏金猎人..."
              rows={3}
            />
            <Button onClick={handleGenerate} disabled={isGenerating} className="w-full">
              <SparklesIcon className="h-4 w-4 mr-2" />
              生成角色
            </Button>
          </div>
        </Card>

        <div className="space-y-2">
          <h3 className="text-sm font-medium">角色列表</h3>
          {characters.map((char) => (
            <Card
              key={char.id}
              className={`p-3 cursor-pointer ${
                selectedId === char.id ? 'border-primary' : ''
              }`}
              onClick={() => setSelectedId(char.id)}
            >
              <div className="flex items-center justify-between">
                <span className="font-medium">{char.name}</span>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(char.id);
                  }}
                >
                  <TrashIcon className="h-4 w-4" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      </div>

      <div>
        {isStreaming ? (
          <Card className="p-4 space-y-4">
            <div className="text-sm font-medium">正在生成角色...</div>
            <div className="border rounded-md overflow-hidden">
              <Editor
                height="500px"
                defaultLanguage="plaintext"
                theme="vs-dark"
                value={streamingContent}
                options={{
                  readOnly: true,
                  minimap: { enabled: false },
                  fontSize: 14,
                  lineNumbers: 'on',
                  scrollBeyondLastLine: false,
                  wordWrap: 'on',
                  automaticLayout: true,
                }}
              />
            </div>
          </Card>
        ) : selected ? (
          <Tabs defaultValue="description">
            <TabsList className="mb-4">
              <TabsTrigger value="description">角色描述</TabsTrigger>
              <TabsTrigger value="portrait">角色插画</TabsTrigger>
            </TabsList>

            <TabsContent value="description">
              <Card className="p-4 space-y-4">
                <div>
                  <Label htmlFor="character-name">角色名称</Label>
                  <Input
                    id="character-name"
                    value={selected.name}
                    onChange={(e) => handleUpdate(selected.id, { name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="character-attrs">角色属性</Label>
                  <div className="border rounded-md overflow-hidden">
                    <Editor
                      height="500px"
                      defaultLanguage="json"
                      theme="vs-dark"
                      value={selected.attributes}
                      onChange={(value) => handleUpdate(selected.id, { attributes: value || '' })}
                      options={{
                        minimap: { enabled: false },
                        fontSize: 14,
                        lineNumbers: 'on',
                        scrollBeyondLastLine: false,
                        wordWrap: 'on',
                        automaticLayout: true,
                      }}
                    />
                  </div>
                </div>
              </Card>
            </TabsContent>

            <TabsContent value="portrait">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>生成与历史</Label>
                  {selected.portraitImage && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleSetPortrait(null)}
                    >
                      移除插画
                    </Button>
                  )}
                </div>

                <ImageGenerator
                  projectId={projectId}
                  characterId={selected.id}
                  initialPrompt={selected.paintingPrompt || ''}
                  onImageGenerated={handleImageGenerated}
                  highlightImageUrl={selected.portraitImage}
                  highlightThumbnailUrl={selected.portraitThumbnail}
                  onSetBackground={(imageUrl, thumbnailUrl) =>
                    handleSetPortrait(imageUrl, thumbnailUrl)
                  }
                />
              </div>
            </TabsContent>
          </Tabs>
        ) : (
          <Card className="p-12 text-center text-muted-foreground">
            选择或生成一个角色
          </Card>
        )}
      </div>
    </div>
  );
}
