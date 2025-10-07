'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ImageIcon, Loader2, Download } from 'lucide-react';

interface ModelProvider {
  id: string;
  name: string;
  models: string[];
  capability?: string;
}

interface GeneratedImage {
  id: string;
  imageUrl: string;
  prompt: string;
  modelProvider: string;
  modelName: string;
  createdAt: string;
}

interface ImageGeneratorProps {
  projectId?: string;
  initialPrompt?: string;
  onImageGenerated?: (imageUrl: string, imageId: string) => void;
}

export function ImageGenerator({
  projectId,
  initialPrompt = '',
  onImageGenerated,
}: ImageGeneratorProps) {
  const [prompt, setPrompt] = useState(initialPrompt);
  const [providers, setProviders] = useState<ModelProvider[]>([]);
  const [selectedProviderId, setSelectedProviderId] = useState<string>('');
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string>('');
  const [imageHistory, setImageHistory] = useState<GeneratedImage[]>([]);
  const [showHistory, setShowHistory] = useState(true);

  // 加载图片生成模型提供商
  useEffect(() => {
    const fetchProviders = async () => {
      try {
        const res = await fetch('/api/models');
        const data = await res.json();
        // 过滤出图片生成模型
        const imageProviders = (data.providers || []).filter(
          (p: ModelProvider) => p.capability === 'image'
        );
        setProviders(imageProviders);

        if (imageProviders.length > 0) {
          setSelectedProviderId(imageProviders[0].id);
          setSelectedModel(imageProviders[0].models[0]);
        }
      } catch (error) {
        console.error('获取模型提供商失败:', error);
      }
    };
    fetchProviders();
  }, []);

  // 加载图片生成历史
  useEffect(() => {
    fetchImageHistory();
  }, [projectId]);

  const fetchImageHistory = async () => {
    try {
      const url = projectId
        ? `/api/ai/image?projectId=${projectId}&limit=10`
        : '/api/ai/image?limit=10';
      const res = await fetch(url);
      const data = await res.json();
      setImageHistory(data.images || []);
    } catch (error) {
      console.error('获取图片历史失败:', error);
    }
  };

  const handleGenerate = async () => {
    if (!prompt || !selectedProviderId) return;

    setIsGenerating(true);
    setGeneratedImageUrl('');

    try {
      const res = await fetch('/api/ai/image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          providerId: selectedProviderId,
          model: selectedModel,
          projectId,
        }),
      });

      const data = await res.json();

      if (data.success) {
        setGeneratedImageUrl(data.imageUrl);
        fetchImageHistory(); // 刷新历史记录

        if (onImageGenerated) {
          onImageGenerated(data.imageUrl, data.id);
        }
      } else {
        throw new Error(data.error || '图片生成失败');
      }
    } catch (error) {
      console.error('图片生成失败:', error);
      alert('图片生成失败：' + (error instanceof Error ? error.message : '未知错误'));
    } finally {
      setIsGenerating(false);
    }
  };

  const selectedProvider = providers.find((p) => p.id === selectedProviderId);

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="space-y-4">
          <div>
            <Label htmlFor="provider">选择模型提供商</Label>
            <Select value={selectedProviderId} onValueChange={setSelectedProviderId}>
              <SelectTrigger id="provider">
                <SelectValue placeholder="选择图片生成模型" />
              </SelectTrigger>
              <SelectContent>
                {providers.map((provider) => (
                  <SelectItem key={provider.id} value={provider.id}>
                    {provider.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedProvider && selectedProvider.models.length > 1 && (
            <div>
              <Label htmlFor="model">选择模型</Label>
              <Select value={selectedModel} onValueChange={setSelectedModel}>
                <SelectTrigger id="model">
                  <SelectValue placeholder="选择具体模型" />
                </SelectTrigger>
                <SelectContent>
                  {selectedProvider.models.map((model) => (
                    <SelectItem key={model} value={model}>
                      {model}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div>
            <Label htmlFor="prompt">绘画提示词</Label>
            <Textarea
              id="prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="详细描述你想要生成的图片，例如：A futuristic cyberpunk city at night, neon lights, rain-soaked streets..."
              rows={4}
            />
          </div>

          <Button
            onClick={handleGenerate}
            disabled={isGenerating || !prompt || !selectedProviderId}
            className="w-full"
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                生成中...
              </>
            ) : (
              <>
                <ImageIcon className="h-4 w-4 mr-2" />
                生成图片
              </>
            )}
          </Button>
        </div>
      </Card>

      {generatedImageUrl && (
        <Card className="p-4">
          <h3 className="text-sm font-medium mb-2">生成的图片</h3>
          <div className="relative">
            <img
              src={generatedImageUrl}
              alt="Generated"
              className="w-full rounded-lg"
            />
            <a
              href={generatedImageUrl}
              download
              target="_blank"
              rel="noopener noreferrer"
              className="absolute top-2 right-2"
            >
              <Button size="sm" variant="secondary">
                <Download className="h-4 w-4" />
              </Button>
            </a>
          </div>
        </Card>
      )}

      <Card className="p-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-sm font-medium">生成历史</h3>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowHistory(!showHistory)}
          >
            {showHistory ? '隐藏' : '显示'}
          </Button>
        </div>

        {showHistory && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {imageHistory.map((img) => (
              <div
                key={img.id}
                className="relative group cursor-pointer"
                onClick={() => setGeneratedImageUrl(img.imageUrl)}
              >
                <img
                  src={img.imageUrl}
                  alt={img.prompt}
                  className="w-full aspect-square object-cover rounded-lg"
                />
                <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-50 transition-all rounded-lg flex items-center justify-center">
                  <div className="text-white text-xs p-2 opacity-0 group-hover:opacity-100 text-center">
                    {img.prompt.substring(0, 50)}...
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {showHistory && imageHistory.length === 0 && (
          <div className="text-center text-muted-foreground py-8">
            暂无生成历史
          </div>
        )}
      </Card>
    </div>
  );
}
