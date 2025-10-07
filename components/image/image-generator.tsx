'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import imageCompression from 'browser-image-compression';
import { Button } from '@/components/ui/button';
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
import {
  ImageIcon,
  Loader2,
  Download,
  CheckIcon,
  Trash2,
} from 'lucide-react';
import Lightbox from 'yet-another-react-lightbox';
import Captions from 'yet-another-react-lightbox/plugins/captions';
import Zoom from 'yet-another-react-lightbox/plugins/zoom';
import 'yet-another-react-lightbox/styles.css';
import 'yet-another-react-lightbox/plugins/captions.css';

interface ProviderModel {
  name: string;
  label?: string;
  capabilities: string[];
  defaultFor?: string[];
}

interface ModelProvider {
  id: string;
  name: string;
  models: ProviderModel[];
}

interface GeneratedImage {
  id: string;
  imageUrl: string;
  prompt: string;
  modelProvider: string;
  modelName: string;
  createdAt: string;
  thumbnailUrl: string | null;
}

interface GalleryImage extends GeneratedImage {
  isCurrentBackground?: boolean;
  isSynthetic?: boolean;
}

interface ImageGeneratorProps {
  projectId?: string;
  sceneId?: string;
  characterId?: string;
  initialPrompt?: string;
  onImageGenerated?: (
    imageUrl: string,
    imageId: string,
    thumbnailUrl?: string | null
  ) => void;
  highlightImageUrl?: string | null;
  highlightThumbnailUrl?: string | null;
  onSetBackground?: (imageUrl: string, thumbnailUrl?: string | null) => void;
}

export function ImageGenerator({
  projectId,
  sceneId,
  characterId,
  initialPrompt = '',
  onImageGenerated,
  highlightImageUrl,
  highlightThumbnailUrl,
  onSetBackground,
}: ImageGeneratorProps) {
  const [prompt, setPrompt] = useState(initialPrompt);
  const [providers, setProviders] = useState<ModelProvider[]>([]);
  const [selectedProviderId, setSelectedProviderId] = useState<string>('');
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string>('');
  const [imageHistory, setImageHistory] = useState<GeneratedImage[]>([]);
  const [showHistory, setShowHistory] = useState(true);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [activeSlide, setActiveSlide] = useState(0);

  useEffect(() => {
    setPrompt(initialPrompt);
  }, [initialPrompt]);

  // 加载图片生成模型提供商
  useEffect(() => {
    const fetchProviders = async () => {
      try {
        const res = await fetch('/api/models');
        const data = await res.json();
        // 过滤出包含图片能力的模型
        const imageProviders = (data.providers || [])
          .map((provider: any) => {
            const models: ProviderModel[] = Array.isArray(provider.models)
              ? provider.models.filter((model: any) =>
                  Array.isArray(model?.capabilities) &&
                  model.capabilities.includes('image')
                )
              : [];

            return {
              id: provider.id,
              name: provider.name,
              models,
            } as ModelProvider;
          })
          .filter((provider: ModelProvider) => provider.models.length > 0);
        setProviders(imageProviders);

        if (imageProviders.length > 0) {
          const initialProvider = imageProviders[0];
          setSelectedProviderId(initialProvider.id);
          setSelectedModel(initialProvider.models[0]?.name || '');
        }
      } catch (error) {
        console.error('获取模型提供商失败:', error);
      }
    };
    fetchProviders();
  }, []);

  // 加载图片生成历史
  const fetchImageHistory = useCallback(async () => {
    try {
      let url = '/api/ai/image?limit=10';
      if (characterId) {
        url = `/api/ai/image?characterId=${characterId}&limit=10`;
      } else if (sceneId) {
        url = `/api/ai/image?sceneId=${sceneId}&limit=10`;
      } else if (projectId) {
        url = `/api/ai/image?projectId=${projectId}&limit=10`;
      }
      const res = await fetch(url);
      const data = await res.json();
      setImageHistory(data.images || []);
    } catch (error) {
      console.error('获取图片历史失败:', error);
    }
  }, [projectId, sceneId, characterId]);

  const createAndUploadThumbnail = useCallback(
    async (imageId: string, originalUrl: string) => {
      try {
        const response = await fetch(originalUrl);
        if (!response.ok) {
          throw new Error('加载原图失败');
        }

        const sourceBlob = await response.blob();
        const compressed = await imageCompression(sourceBlob, {
          maxWidthOrHeight: 256,
          maxSizeMB: 0.3,
          useWebWorker: true,
          fileType: 'image/jpeg',
        });

        const fallbackName = `${imageId}.jpg`;
        const payloadFile =
          compressed instanceof File
            ? compressed
            : new File([compressed], fallbackName, { type: 'image/jpeg' });

        const formData = new FormData();
        formData.append('imageId', imageId);
        formData.append(
          'thumbnail',
          payloadFile,
          payloadFile.name || fallbackName
        );

        const uploadResponse = await fetch('/api/ai/image/thumbnail', {
          method: 'POST',
          body: formData,
        });

        const payload = await uploadResponse.json();
        if (!uploadResponse.ok) {
          throw new Error(payload.error || '上传缩略图失败');
        }

        return payload.thumbnailUrl as string;
      } catch (error) {
        console.error('生成缩略图失败:', error);
        return undefined;
      }
    },
    []
  );

  useEffect(() => {
    fetchImageHistory();
  }, [fetchImageHistory]);

  const displayedImages = useMemo<GalleryImage[]>(() => {
    if (!imageHistory.length && !highlightImageUrl) {
      return [];
    }

    if (!highlightImageUrl) {
      return imageHistory.map((img) => ({
        ...img,
        thumbnailUrl: img.thumbnailUrl || img.imageUrl,
      }));
    }

    const historyWithFlag = imageHistory.map<GalleryImage>((img) => ({
      ...img,
      thumbnailUrl: img.thumbnailUrl || img.imageUrl,
      isCurrentBackground: img.imageUrl === highlightImageUrl,
    }));

    const pinned = historyWithFlag.find((img) => img.isCurrentBackground);
    const remainder = historyWithFlag.filter((img) => !img.isCurrentBackground);

    if (pinned) {
      return [pinned, ...remainder];
    }

    return [
      {
        id: 'current-background',
        imageUrl: highlightImageUrl,
        prompt: '当前背景图',
        modelProvider: '',
        modelName: '',
        createdAt: '',
        thumbnailUrl: highlightThumbnailUrl ?? highlightImageUrl,
        isCurrentBackground: true,
        isSynthetic: true,
      },
      ...historyWithFlag,
    ];
  }, [imageHistory, highlightImageUrl, highlightThumbnailUrl]);

  const slides = useMemo(
    () =>
      displayedImages.map((img) => ({
        src: img.imageUrl,
        description: img.prompt,
        title: img.createdAt ? new Date(img.createdAt).toLocaleString() : '当前背景图',
      })),
    [displayedImages]
  );

  const handleOpenLightbox = useCallback((index: number) => {
    setActiveSlide(index);
    setIsLightboxOpen(true);
  }, []);

  const handleSetBackgroundFromSlide = useCallback(() => {
    if (!onSetBackground) return;
    const target = displayedImages[activeSlide];
    if (!target || target.isCurrentBackground) return;
    onSetBackground(target.imageUrl, target.thumbnailUrl || target.imageUrl);
    setGeneratedImageUrl(target.imageUrl);
    setIsLightboxOpen(false);
  }, [activeSlide, displayedImages, onSetBackground]);

  const handleDeleteSlide = useCallback(async () => {
    const target = displayedImages[activeSlide];
    if (!target || target.isSynthetic) return;

    try {
      const res = await fetch(`/api/ai/image?id=${target.id}`, { method: 'DELETE' });
      if (!res.ok) {
        throw new Error('删除图片失败');
      }
      await fetchImageHistory();
      setGeneratedImageUrl((current) =>
        current === target.imageUrl ? '' : current
      );
      setIsLightboxOpen(false);
    } catch (error) {
      console.error('删除图片失败:', error);
      alert('删除图片失败，请稍后再试');
    }
  }, [activeSlide, displayedImages, fetchImageHistory]);

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
          sceneId,
          characterId,
        }),
      });

      const data = await res.json();

      if (data.success) {
        setGeneratedImageUrl(data.imageUrl);

        let thumbnailUrl: string | null = data.thumbnailUrl ?? null;
        if (!thumbnailUrl) {
          thumbnailUrl =
            (await createAndUploadThumbnail(data.id, data.imageUrl)) ?? null;
        }

        await fetchImageHistory();

        if (onImageGenerated) {
          onImageGenerated(data.imageUrl, data.id, thumbnailUrl);
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

  useEffect(() => {
    if (!selectedProvider) return;
    if (!selectedProvider.models.find((model) => model.name === selectedModel)) {
      const fallback =
        selectedProvider.models.find((model) =>
          (model.defaultFor || []).includes('image')
        ) || selectedProvider.models[0];
      setSelectedModel(fallback ? fallback.name : '');
    }
  }, [selectedProviderId, selectedProvider, selectedModel]);

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
                    <SelectItem key={model.name} value={model.name}>
                      {model.label || model.name}
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

        {showHistory && displayedImages.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {displayedImages.map((img, index) => (
              <div
                key={`${img.id}-${index}`}
                className="relative group cursor-pointer"
                onClick={() => {
                  setGeneratedImageUrl(img.imageUrl);
                  handleOpenLightbox(index);
                }}
              >
                <img
                  src={img.thumbnailUrl || img.imageUrl}
                  alt={img.prompt}
                  className="w-full aspect-square object-cover rounded-lg"
                />
                <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-50 transition-all rounded-lg flex items-center justify-center">
                  <div className="text-white text-xs p-2 opacity-0 group-hover:opacity-100 text-center max-h-20 overflow-hidden text-ellipsis">
                    {img.prompt || '暂无提示词'}
                  </div>
                </div>
                {img.isCurrentBackground && (
                  <div className="absolute right-2 top-2 rounded-full bg-primary px-2 py-1 text-[10px] font-medium text-primary-foreground shadow">
                    当前背景
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {showHistory && displayedImages.length === 0 && (
          <div className="text-center text-muted-foreground py-8">
            暂无生成历史
          </div>
        )}
      </Card>

      {slides.length > 0 && (
        <Lightbox
          open={isLightboxOpen}
          close={() => setIsLightboxOpen(false)}
          index={activeSlide}
          slides={slides}
          plugins={[Captions, Zoom]}
          on={{ view: ({ index }) => setActiveSlide(index ?? 0) }}
          render={{
            toolbar: ({ buttons, index }) => {
              const target = displayedImages[index ?? activeSlide];
              const disableSetBackground =
                !onSetBackground || !target || target.isCurrentBackground;
              const disableDelete = !target || target.isSynthetic;

              return (
                <div className="flex items-center gap-2">
                  {buttons}
                  <Button
                    size="sm"
                    variant="secondary"
                    className="flex items-center gap-1"
                    disabled={disableSetBackground}
                    onClick={handleSetBackgroundFromSlide}
                  >
                    <CheckIcon className="h-4 w-4" />
                    设置背景图
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    className="flex items-center gap-1"
                    disabled={disableDelete}
                    onClick={handleDeleteSlide}
                  >
                    <Trash2 className="h-4 w-4" />
                    删除记录
                  </Button>
                </div>
              );
            },
          }}
        />
      )}
    </div>
  );
}
