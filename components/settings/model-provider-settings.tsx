'use client';

import { useState, useEffect } from 'react';
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

type ModelCapability = 'text' | 'image' | 'vision';

interface ModelProvider {
  id: string;
  name: string;
  type: 'openai' | 'anthropic' | 'custom';
  apiKey: string;
  baseUrl?: string;
  models: string[];
  isDefault: boolean;
  isActive: boolean;
  capability?: ModelCapability;
}

export function ModelProviderSettings() {
  const [providers, setProviders] = useState<ModelProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProvider, setEditingProvider] = useState<ModelProvider | null>(null);

  // 表单状态
  const [formData, setFormData] = useState({
    name: '',
    type: 'openai' as 'openai' | 'anthropic' | 'custom',
    apiKey: '',
    baseUrl: '',
    models: '',
    isDefault: false,
    capability: 'text' as ModelCapability,
  });

  useEffect(() => {
    fetchProviders();
  }, []);

  const fetchProviders = async () => {
    try {
      const res = await fetch('/api/models?includeInactive=true');
      const data = await res.json();
      setProviders(data.providers || []);
    } catch (error) {
      console.error('获取模型提供商失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const models = formData.models.split(',').map((m) => m.trim()).filter(Boolean);

    try {
      if (editingProvider) {
        // 更新
        await fetch(`/api/models/${editingProvider.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...formData,
            models,
          }),
        });
      } else {
        // 新建
        await fetch('/api/models', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...formData,
            models,
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

  const resetForm = () => {
    setFormData({
      name: '',
      type: 'openai',
      apiKey: '',
      baseUrl: '',
      models: '',
      isDefault: false,
      capability: 'text',
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
      models: provider.models.join(', '),
      isDefault: provider.isDefault,
      capability: provider.capability || 'text',
    });
    setDialogOpen(true);
  };

  if (loading) {
    return <div className="p-4">加载中...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">模型提供商管理</h2>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm}>
              <Plus className="w-4 h-4 mr-2" />
              添加提供商
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {editingProvider ? '编辑' : '添加'}模型提供商
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
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
                  className="w-full p-2 border rounded"
                  required
                >
                  <option value="openai">OpenAI</option>
                  <option value="anthropic">Anthropic</option>
                  <option value="custom">自定义(OpenAI兼容)</option>
                </select>
              </div>

              <div>
                <Label htmlFor="apiKey">API密钥</Label>
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
                <Label htmlFor="baseUrl">自定义API端点（可选）</Label>
                <Input
                  id="baseUrl"
                  value={formData.baseUrl}
                  onChange={(e) => setFormData({ ...formData, baseUrl: e.target.value })}
                  placeholder="https://api.example.com/v1"
                />
              </div>

              <div>
                <Label htmlFor="models">可用模型（逗号分隔）</Label>
                <Input
                  id="models"
                  value={formData.models}
                  onChange={(e) => setFormData({ ...formData, models: e.target.value })}
                  placeholder="gpt-4o-mini, gpt-4o"
                  required
                />
              </div>

              <div>
                <Label htmlFor="capability">模型能力</Label>
                <select
                  id="capability"
                  value={formData.capability}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      capability: e.target.value as ModelCapability,
                    })
                  }
                  className="w-full p-2 border rounded"
                  required
                >
                  <option value="text">文本生成</option>
                  <option value="image">图片生成</option>
                  <option value="vision">视觉理解</option>
                </select>
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
                <Label htmlFor="isDefault">设为默认</Label>
              </div>

              <div className="flex gap-2 justify-end">
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
          <Card key={provider.id} className="p-4">
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="text-lg font-semibold">{provider.name}</h3>
                  {provider.isDefault && (
                    <Badge variant="default">默认</Badge>
                  )}
                  <Badge variant={provider.isActive ? 'outline' : 'secondary'}>
                    {provider.isActive ? '已启用' : '已禁用'}
                  </Badge>
                  <Badge variant="outline">{provider.type}</Badge>
                  {provider.capability && (
                    <Badge variant="secondary">
                      {provider.capability === 'text' && '文本'}
                      {provider.capability === 'image' && '图片'}
                      {provider.capability === 'vision' && '视觉'}
                    </Badge>
                  )}
                </div>

                <div className="text-sm text-gray-600 mb-2">
                  可用模型: {provider.models.join(', ')}
                </div>

                {provider.baseUrl && (
                  <div className="text-sm text-gray-500">
                    端点: {provider.baseUrl}
                  </div>
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
                  {provider.isActive ? (
                    <X className="w-4 h-4" />
                  ) : (
                    <Check className="w-4 h-4" />
                  )}
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
