'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Typewriter } from '@/components/ui/typewriter';
import { RefreshCw, Check } from 'lucide-react';
import { logger } from '@/lib/logger/client';

interface Character {
  name: string;
  age?: string;
  gender?: string;
  personality?: string;
  background?: string;
  skills?: string[];
  relationships?: string;
  role?: string;
}

function CharacterList({ content }: { content: string }) {
  try {
    // 清理和提取JSON内容
    let jsonContent = content.trim();

    // 尝试提取JSON对象（处理可能的Markdown代码块或其他包装）
    const jsonMatch = jsonContent.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      jsonContent = jsonMatch[0];
    }

    const data = JSON.parse(jsonContent);
    const characters: Character[] = data.characters || [];

    if (characters.length === 0) {
      return <div className="text-muted-foreground">暂无角色数据</div>;
    }

    return (
      <div className="space-y-6">
        {characters.map((char, index) => (
          <div key={index} className="border-b pb-4 last:border-b-0">
            <h3 className="text-lg font-bold mb-3">{char.name}</h3>

            {(char.age || char.gender) && (
              <div className="mb-2">
                <span className="font-semibold">基本信息：</span>
                {char.age && <span className="ml-2">年龄: {char.age}</span>}
                {char.gender && <span className="ml-4">性别: {char.gender}</span>}
              </div>
            )}

            {char.personality && (
              <div className="mb-2">
                <span className="font-semibold">性格特征：</span>
                <p className="text-sm mt-1">{char.personality}</p>
              </div>
            )}

            {char.background && (
              <div className="mb-2">
                <span className="font-semibold">背景故事：</span>
                <p className="text-sm mt-1">{char.background}</p>
              </div>
            )}

            {char.skills && char.skills.length > 0 && (
              <div className="mb-2">
                <span className="font-semibold">能力与技能：</span>
                <ul className="list-disc list-inside text-sm mt-1">
                  {char.skills.map((skill, i) => (
                    <li key={i}>{skill}</li>
                  ))}
                </ul>
              </div>
            )}

            {char.relationships && (
              <div className="mb-2">
                <span className="font-semibold">人际关系：</span>
                <p className="text-sm mt-1">{char.relationships}</p>
              </div>
            )}

            {char.role && (
              <div className="mb-2">
                <span className="font-semibold">角色定位：</span>
                <p className="text-sm mt-1">{char.role}</p>
              </div>
            )}
          </div>
        ))}
      </div>
    );
  } catch (error) {
    return (
      <div className="text-sm text-muted-foreground">
        <p>JSON解析失败，显示原始内容：</p>
        <pre className="mt-2 whitespace-pre-wrap">{content}</pre>
      </div>
    );
  }
}

interface GenerateCharactersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  worldContext: string;
  projectId: string;
  onConfirm: (characters: string) => void;
}

export function GenerateCharactersDialog({
  open,
  onOpenChange,
  worldContext,
  projectId: _projectId,
  onConfirm,
}: GenerateCharactersDialogProps) {
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedContent, setGeneratedContent] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);

  const handleGenerate = async () => {
    if (!prompt.trim()) return;

    setIsGenerating(true);
    setIsStreaming(true);
    setGeneratedContent('');

    const snippetId = logger.startSnippet({
      snippet_id: `character-gen-dialog-${Date.now()}`,
      name: '对话框角色生成',
    });

    try {
      if (snippetId) {
        await logger.logSnippet('开始生成角色列表', snippetId, 'character-dialog');
      }

      const response = await fetch('/api/ai/characters-from-world', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, worldContext }),
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
          setGeneratedContent(fullText);
        }
      }

      if (snippetId) {
        await logger.logSnippet('角色列表生成完成', snippetId, 'character-dialog');
        await logger.endSnippet(snippetId);
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      if (snippetId) {
        await logger.logSnippet(
          `生成失败: ${errorMessage}`,
          snippetId,
          'character-dialog',
          { level: 'error' }
        );
        await logger.endSnippet(snippetId);
      }

      await logger.error(
        `角色生成失败: ${errorMessage}`,
        'character-dialog'
      );
    } finally {
      setIsGenerating(false);
      setIsStreaming(false);
    }
  };

  const handleRegenerate = () => {
    handleGenerate();
  };

  const handleConfirm = () => {
    if (generatedContent) {
      onConfirm(generatedContent);
      setPrompt('');
      setGeneratedContent('');
      onOpenChange(false);
    }
  };

  const handleClose = () => {
    setPrompt('');
    setGeneratedContent('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>从世界观生成角色</DialogTitle>
          <DialogDescription>
            基于当前世界观设定，AI将生成一系列相关角色
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 space-y-4 overflow-y-auto">
          <div className="space-y-2">
            <label className="text-sm font-medium">角色生成需求</label>
            <Textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="描述你需要的角色，例如：生成3个主要角色，包括一个正义的骑士、一个神秘的法师和一个狡猾的商人..."
              rows={4}
              disabled={isGenerating}
            />
          </div>

          {!generatedContent && (
            <Button
              onClick={handleGenerate}
              disabled={isGenerating || !prompt.trim()}
              className="w-full"
            >
              {isGenerating ? '生成中...' : '生成角色'}
            </Button>
          )}

          {generatedContent && (
            <div className="space-y-4">
              <div className="border rounded-lg p-4 bg-muted/50 min-h-[300px] max-h-[400px] overflow-y-auto">
                {isStreaming ? (
                  <Typewriter text={generatedContent} typeSpeed={20} />
                ) : (
                  <CharacterList content={generatedContent} />
                )}
              </div>

              {!isStreaming && (
                <div className="flex gap-2">
                  <Button
                    onClick={handleRegenerate}
                    variant="outline"
                    className="flex-1"
                    disabled={isGenerating}
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    重新生成
                  </Button>
                  <Button
                    onClick={handleConfirm}
                    className="flex-1"
                    disabled={isGenerating}
                  >
                    <Check className="h-4 w-4 mr-2" />
                    确认添加
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={handleClose}>
            取消
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
