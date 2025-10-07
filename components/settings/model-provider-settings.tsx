'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Plus, Trash2, Check, X, Settings } from 'lucide-react';

type ModelCapability =
  | 'text'
  | 'vision'
  | 'web'
  | 'tools'
  | 'embedding'
  | 'image'
  | 'reasoning';

const CAPABILITY_LABELS: Record<ModelCapability, string> = {
  text: '文本',
  vision: '视觉',
  web: '联网',
  tools: '工具',
  embedding: '嵌入',
  image: '图片',
  reasoning: '推理',
};

const CAPABILITY_OPTIONS: { value: ModelCapability; label: string }[] = [
  { value: 'text', label: CAPABILITY_LABELS.text },
  { value: 'vision', label: CAPABILITY_LABELS.vision },
  { value: 'web', label: CAPABILITY_LABELS.web },
  { value: 'tools', label: CAPABILITY_LABELS.tools },
  { value: 'embedding', label: CAPABILITY_LABELS.embedding },
  { value: 'image', label: CAPABILITY_LABELS.image },
  { value: 'reasoning', label: CAPABILITY_LABELS.reasoning },
];

interface ProviderModelForm {
  name: string;
  label?: string;
  description?: string;
  capabilities: ModelCapability[];
  defaultFor: ModelCapability[];
}

interface ModelProvider {
  id: string;
  name: string;
  type: 'openai' | 'anthropic' | 'custom';
  apiKey: string;
  baseUrl?: string;
  models: ProviderModelForm[];
  isDefault: boolean;
  isActive: boolean;
  metadata?: Record<string, any>;
}

const PRESET_MODEL_LIBRARY: Record<string, ProviderModelForm[]> = {
  baai: [
    {
      name: 'BAAI/bge-m3',
      label: 'bge-m3',
      capabilities: ['embedding'],
      defaultFor: ['embedding'],
    },
  ],
  qwen: [
    {
      name: 'Qwen2.5-7B-Instruct',
      label: 'Qwen 2.5 7B Instruct',
      capabilities: ['text', 'vision', 'tools', 'web'],
      defaultFor: ['text'],
    },
  ],
  'deepseek-ai': [
    {
      name: 'deepseek-ai/DeepSeek-R1',
      label: 'DeepSeek R1',
      capabilities: ['text', 'reasoning', 'tools'],
      defaultFor: ['reasoning'],
    },
    {
      name: 'deepseek-ai/DeepSeek-V3',
      label: 'DeepSeek V3',
      capabilities: ['text', 'tools'],
      defaultFor: ['text'],
    },
  ],
  'meta-llama': [
    {
      name: 'meta-llama/Llama-3.3-70B-Instruct',
      label: 'Llama 3.3 70B',
      capabilities: ['text', 'reasoning'],
      defaultFor: ['text'],
    },
  ],
};

function cloneModels(models: ProviderModelForm[]): ProviderModelForm[] {
  return models.map((model) => ({
    ...model,
    capabilities: [...model.capabilities],
    defaultFor: [...model.defaultFor],
  }));
}

function getPresetKey(name: string): string | undefined {
  const key = name.trim().toLowerCase();
  if (!key) return undefined;
  return Object.keys(PRESET_MODEL_LIBRARY).find((preset) => preset === key);
}

export function ModelProviderSettings() {
  const [providers, setProviders] = useState<ModelProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProvider, setEditingProvider] = useState<ModelProvider | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    type: 'openai' as 'openai' | 'anthropic' | 'custom',
    apiKey: '',
    baseUrl: '',
    models: [] as ProviderModelForm[],
    isDefault: false,
  });

  useEffect(() => {
    fetchProviders();
  }, []);

  const fetchProviders = async () => {
    try {
      const res = await fetch('/api/models?includeInactive=true');
      const data = await res.json();
      const nextProviders: ModelProvider[] = (data.providers || []).map((provider: any) => ({
        id: provider.id,
        name: provider.name,
        type: provider.type,
        apiKey: provider.apiKey,
        baseUrl: provider.baseUrl || '',
        models: Array.isArray(provider.models)
          ? provider.models.map((model: any) => ({
              name: model.name,
              label: model.label,
              description: model.description,
              capabilities: Array.isArray(model.capabilities)
                ? (model.capabilities as ModelCapability[])
                : [],
              defaultFor: Array.isArray(model.defaultFor)
                ? (model.defaultFor as ModelCapability[])
                : [],
            }))
          : [],
        isDefault: provider.isDefault,
        isActive: provider.isActive,
        metadata: provider.metadata,
      }));
      setProviders(nextProviders);
    } catch (error) {
      console.error('获取模型提供商失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const presetModels = useMemo(() => {
    const presetKey = getPresetKey(formData.name);
    if (!presetKey) return undefined;
    return cloneModels(PRESET_MODEL_LIBRARY[presetKey]);
  }, [formData.name]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const payloadModels = formData.models
      .filter((model) => model.name.trim())
      .map((model) => {
        const capabilities = model.capabilities.length
          ? Array.from(new Set(model.capabilities))
          : (['text'] as ModelCapability[]);
        const defaultFor = Array.from(
          new Set(model.defaultFor.filter((capability) => capabilities.includes(capability)))
        );
        return {
          name: model.name.trim(),
          label: model.label?.trim() || undefined,
          description: model.description?.trim() || undefined,
          capabilities,
          defaultFor,
        } satisfies ProviderModelForm;
      });

    if (!payloadModels.length) {
      alert('至少添加一个模型配置');
      return;
    }

    try {
      if (editingProvider) {
        await fetch(`/api/models/${editingProvider.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: formData.name,
            type: formData.type,
            apiKey: formData.apiKey,
            baseUrl: formData.baseUrl || undefined,
            models: payloadModels,
            isDefault: formData.isDefault,
          }),
        });
      } else {
        await fetch('/api/models', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: formData.name,
            type: formData.type,
            apiKey: formData.apiKey,
            baseUrl: formData.baseUrl || undefined,
            models: payloadModels,
            isDefault: formData.isDefault,
          }),
        });
      }

      resetForm();
      setDialogOpen(false);
      fetchProviders();
    } catch (error) {
      console.error('保存模型提供商失败:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除此模型提供商吗？')) return;

    try {
      await fetch(`/api/models/${id}`, { method: 'DELETE' });
      fetchProviders();
    } catch (error) {
      console.error('删除模型提供商失败:', error);
    }
  };

  const handleToggleActive = async (provider: ModelProvider) => {
    try {
      await fetch(`/api/models/${provider.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !provider.isActive }),
      });
      fetchProviders();
    } catch (error) {
      console.error('切换状态失败:', error);
    }
  };

  const handleSetDefault = async (provider: ModelProvider) => {
    try {
      await fetch(`/api/models/${provider.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isDefault: true }),
      });
      fetchProviders();
    } catch (error) {
      console.error('设置默认失败:', error);
    }
  };

  const handleSetCapabilityDefault = async (
    provider: ModelProvider,
    modelName: string,
    capability: ModelCapability
  ) => {
    try {
      await fetch(`/api/models/${provider.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          setDefaultCapability: {
            model: modelName,
            capability,
          },
        }),
      });
      fetchProviders();
    } catch (error) {
      console.error('设置默认能力失败:', error);
    }
  };

  const handleUnsetCapabilityDefault = async (
    provider: ModelProvider,
    modelName: string,
    capability: ModelCapability
  ) => {
    try {
      await fetch(`/api/models/${provider.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          unsetDefaultCapability: {
            model: modelName,
            capability,
          },
        }),
      });
      fetchProviders();
    } catch (error) {
      console.error('取消默认能力失败:', error);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      type: 'openai',
      apiKey: '',
      baseUrl: '',
      models: [],
      isDefault: false,
    });
    setEditingProvider(null);
  };

  const handleEdit = (provider: ModelProvider) => {
    setEditingProvider(provider);
    setFormData({
      name: provider.name,
      type: provider.type,
      apiKey: provider.apiKey,
      baseUrl: provider.baseUrl || '',
      models: cloneModels(provider.models),
      isDefault: provider.isDefault,
    });
    setDialogOpen(true);
  };

  const handleAddModel = () => {
    setFormData((prev) => ({
      ...prev,
      models: [
        ...prev.models,
        {
          name: '',
          capabilities: ['text'],
          defaultFor: ['text'],
        },
      ],
    }));
  };

  const handleRemoveModel = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      models: prev.models.filter((_, idx) => idx !== index),
    }));
  };

  const updateModel = (index: number, updater: (model: ProviderModelForm) => ProviderModelForm) => {
    setFormData((prev) => ({
      ...prev,
      models: prev.models.map((model, idx) => (idx === index ? updater(model) : model)),
    }));
  };

  const toggleCapability = (index: number, capability: ModelCapability) => {
    updateModel(index, (model) => {
      const hasCapability = model.capabilities.includes(capability);
      const capabilities = hasCapability
        ? model.capabilities.filter((item) => item !== capability)
        : [...model.capabilities, capability];

      const defaultFor = hasCapability
        ? model.defaultFor.filter((item) => item !== capability)
        : model.defaultFor;

      return {
        ...model,
        capabilities,
        defaultFor,
      };
    });
  };

  const toggleDefaultCapability = (index: number, capability: ModelCapability) => {
    setFormData((prev) => ({
      ...prev,
      models: prev.models.map((model, idx) => {
        if (idx === index) {
          const isDefault = model.defaultFor.includes(capability);
          const nextDefaults = isDefault
            ? model.defaultFor.filter((item) => item !== capability)
            : [...model.defaultFor, capability];
          return {
            ...model,
            defaultFor: nextDefaults,
          };
        }
        return {
          ...model,
          defaultFor: model.defaultFor.filter((item) => item !== capability),
        };
      }),
    }));
  };

  const applyPresetModels = () => {
    if (!presetModels) return;
    setFormData((prev) => ({
      ...prev,
      models: cloneModels(presetModels),
    }));
  };

  if (loading) {
    return <div className="p-4">加载中...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">模型提供商管理</h2>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm}>
              <Plus className="w-4 h-4 mr-2" />
              添加提供商
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>{editingProvider ? '编辑' : '添加'}模型提供商</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <Label htmlFor="name">名称</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="例如: OpenAI GPT-4"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="type">类型</Label>
                  <select
                    id="type"
                    value={formData.type}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        type: e.target.value as 'openai' | 'anthropic' | 'custom',
                      })
                    }
                    className="w-full rounded border p-2"
                    required
                  >
                    <option value="openai">OpenAI</option>
                    <option value="anthropic">Anthropic</option>
                    <option value="custom">自定义(OpenAI兼容)</option>
                  </select>
                </div>
                <div>
                  <Label htmlFor="apiKey">API 密钥</Label>
                  <Input
                    id="apiKey"
                    type="password"
                    value={formData.apiKey}
                    onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
                    placeholder="sk-..."
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="baseUrl">自定义 API 端点（可选）</Label>
                  <Input
                    id="baseUrl"
                    value={formData.baseUrl}
                    onChange={(e) => setFormData({ ...formData, baseUrl: e.target.value })}
                    placeholder="https://api.example.com/v1"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isDefault"
                  checked={formData.isDefault}
                  onChange={(e) =>
                    setFormData({ ...formData, isDefault: e.target.checked })
                  }
                />
                <Label htmlFor="isDefault">设为默认提供商</Label>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold">模型配置</h4>
                  <div className="flex items-center gap-2">
                    {presetModels && (
                      <Button type="button" variant="outline" size="sm" onClick={applyPresetModels}>
                        使用预设模型
                      </Button>
                    )}
                    <Button type="button" variant="outline" size="sm" onClick={handleAddModel}>
                      <Plus className="w-4 h-4 mr-1" /> 添加模型
                    </Button>
                  </div>
                </div>

                {formData.models.length === 0 && (
                  <div className="rounded border border-dashed p-4 text-sm text-muted-foreground">
                    目前没有模型，请添加或使用预设配置。
                  </div>
                )}

                <div className="space-y-3">
                  {formData.models.map((model, index) => (
                    <Card key={`${model.name}-${index}`} className="p-4 space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 space-y-3">
                          <div className="grid gap-3 md:grid-cols-2">
                            <div>
                              <Label>模型名称</Label>
                              <Input
                                value={model.name}
                                onChange={(e) =>
                                  updateModel(index, (prev) => ({
                                    ...prev,
                                    name: e.target.value,
                                  }))
                                }
                                placeholder="例如: gpt-4o-mini"
                                required
                              />
                            </div>
                            <div>
                              <Label>显示名称（可选）</Label>
                              <Input
                                value={model.label || ''}
                                onChange={(e) =>
                                  updateModel(index, (prev) => ({
                                    ...prev,
                                    label: e.target.value,
                                  }))
                                }
                                placeholder="用于界面显示的名称"
                              />
                            </div>
                          </div>

                          <div>
                            <Label className="block text-sm font-medium">模型能力</Label>
                            <div className="mt-2 flex flex-wrap gap-2">
                              {CAPABILITY_OPTIONS.map(({ value, label }) => {
                                const active = model.capabilities.includes(value);
                                return (
                                  <Button
                                    key={value}
                                    type="button"
                                    variant={active ? 'secondary' : 'outline'}
                                    size="sm"
                                    onClick={() => toggleCapability(index, value)}
                                  >
                                    {label}
                                  </Button>
                                );
                              })}
                            </div>
                          </div>

                          {model.capabilities.length > 0 && (
                            <div>
                              <Label className="block text-sm font-medium">默认能力</Label>
                              <div className="mt-2 flex flex-wrap gap-2">
                                {model.capabilities.map((capability) => {
                                  const isDefault = model.defaultFor.includes(capability);
                                  return (
                                    <Button
                                      key={capability}
                                      type="button"
                                      variant={isDefault ? 'default' : 'outline'}
                                      size="sm"
                                      onClick={() => toggleDefaultCapability(index, capability)}
                                    >
                                      {isDefault
                                        ? `默认${CAPABILITY_LABELS[capability]}`
                                        : `设为默认${CAPABILITY_LABELS[capability]}`}
                                    </Button>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => handleRemoveModel(index)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    resetForm();
                    setDialogOpen(false);
                  }}
                >
                  取消
                </Button>
                <Button type="submit">保存</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4">
        {providers.map((provider) => (
          <Card key={provider.id} className="p-4 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-lg font-semibold">{provider.name}</h3>
                  {provider.isDefault && <Badge variant="default">默认提供商</Badge>}
                  <Badge variant={provider.isActive ? 'outline' : 'secondary'}>
                    {provider.isActive ? '已启用' : '已禁用'}
                  </Badge>
                  <Badge variant="outline">{provider.type}</Badge>
                </div>
                {provider.baseUrl && (
                  <p className="text-xs text-muted-foreground">端点：{provider.baseUrl}</p>
                )}
              </div>

              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleEdit(provider)}
                >
                  <Settings className="w-4 h-4" />
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleToggleActive(provider)}
                >
                  {provider.isActive ? <X className="w-4 h-4" /> : <Check className="w-4 h-4" />}
                </Button>
                {!provider.isDefault && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleSetDefault(provider)}
                  >
                    设为默认
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleDelete(provider.id)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <div className="space-y-3">
              {provider.models.map((model) => (
                <div
                  key={model.name}
                  className="rounded-md border p-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium">
                        {model.label || model.name}
                      </p>
                      {model.description && (
                        <p className="text-xs text-muted-foreground mt-1">{model.description}</p>
                      )}
                    </div>
                  </div>

                  <div className="mt-3 space-y-2">
                    <div className="flex flex-wrap gap-2">
                      {model.capabilities.map((capability) => (
                        <Badge key={capability} variant="outline">
                          {CAPABILITY_LABELS[capability]}
                        </Badge>
                      ))}
                    </div>

                    {model.capabilities.length > 0 && (
                      <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                        {model.capabilities.map((capability) => {
                          const isDefault = model.defaultFor.includes(capability);
                          return (
                            <div
                              key={`${model.name}-${capability}`}
                              className="flex items-center gap-2"
                            >
                              <Badge variant={isDefault ? 'default' : 'secondary'}>
                                {isDefault
                                  ? `默认${CAPABILITY_LABELS[capability]}`
                                  : `可设为默认${CAPABILITY_LABELS[capability]}`}
                              </Badge>
                              <Button
                                size="xs"
                                variant="outline"
                                onClick={() =>
                                  isDefault
                                    ? handleUnsetCapabilityDefault(
                                        provider,
                                        model.name,
                                        capability
                                      )
                                    : handleSetCapabilityDefault(
                                        provider,
                                        model.name,
                                        capability
                                      )
                                }
                              >
                                {isDefault ? '取消默认' : '设为默认'}
                              </Button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {provider.models.length === 0 && (
                <div className="text-sm text-muted-foreground">
                  该提供商尚未配置模型。
                </div>
              )}
            </div>
          </Card>
        ))}

        {providers.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            暂无模型提供商，请添加一个
          </div>
        )}
      </div>
    </div>
  );
}
