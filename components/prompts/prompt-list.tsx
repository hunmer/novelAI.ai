'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Plus, Trash2, Pencil, Sparkles, RotateCcw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { PROMPT_TEMPLATES } from '@/lib/ai/prompts';

interface Prompt {
  id: string;
  name: string;
  content?: string;
  system?: string;
  user?: string;
  type: 'world' | 'character' | 'scene' | 'dialog';
  projectId: string;
  createdAt: string;
  updatedAt: string;
  isDefault?: boolean; // 标记为默认提示词（不可删除）
}

interface PromptListProps {
  projectId: string;
  type: 'world' | 'character' | 'scene' | 'dialog';
}

export function PromptList({ projectId, type }: PromptListProps) {
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPrompt, setEditingPrompt] = useState<Prompt | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    system: '',
    user: '',
  });

  const [optimizing, setOptimizing] = useState(false);

  useEffect(() => {
    fetchPrompts();
  }, [projectId, type]);

  const fetchPrompts = async () => {
    try {
      const res = await fetch(`/api/prompts?projectId=${projectId}&type=${type}`);
      const data = await res.json();
      setPrompts(data.prompts || []);
    } catch (error) {
      console.error('获取提示词失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const restoreDefaultPrompts = async () => {
    try {
      // 根据类型选择对应的默认提示词
      let defaultPrompts: { name: string; template: keyof typeof PROMPT_TEMPLATES }[] = [];

      if (type === 'world') {
        defaultPrompts = [{ name: '世界观生成（默认）', template: 'worldGen' }];
      } else if (type === 'character') {
        defaultPrompts = [{ name: '角色生成（默认）', template: 'characterGen' }];
      } else if (type === 'scene') {
        defaultPrompts = [{ name: '场景生成（默认）', template: 'sceneGen' }];
      } else if (type === 'dialog') {
        defaultPrompts = [{ name: '对话生成（默认）', template: 'dialogGen' }];
      }

      // 检查每个默认提示词是否存在，不存在则创建
      for (const prompt of defaultPrompts) {
        const template = PROMPT_TEMPLATES[prompt.template];
        const existing = prompts.find(
          (p) => p.name === prompt.name && p.isDefault
        );

        if (!existing) {
          await fetch('/api/prompts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: prompt.name,
              system: template.system,
              user: template.user,
              content: template.user,
              type,
              projectId,
              isDefault: true, // 标记为默认提示词
            }),
          });
          continue;
        }

        await fetch(`/api/prompts/${existing.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            system: template.system,
            user: template.user,
            content: template.user,
            isDefault: true,
          }),
        });
      }

      // 重新获取提示词列表
      fetchPrompts();
      alert('默认提示词已恢复');
    } catch (error) {
      console.error('恢复默认提示词失败:', error);
      alert('恢复失败，请稍后重试');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (editingPrompt) {
        // 更新
        await fetch(`/api/prompts/${editingPrompt.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...formData,
            content: formData.user,
          }),
        });
      } else {
        // 新建
        await fetch('/api/prompts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...formData,
            content: formData.user,
            type,
            projectId,
          }),
        });
      }

      resetForm();
      setDialogOpen(false);
      fetchPrompts();
    } catch (error) {
      console.error('保存提示词失败:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除此提示词吗？')) return;

    try {
      await fetch(`/api/prompts/${id}`, { method: 'DELETE' });
      fetchPrompts();
    } catch (error) {
      console.error('删除提示词失败:', error);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      system: '',
      user: '',
    });
    setEditingPrompt(null);
  };

  const handleEdit = (prompt: Prompt) => {
    setEditingPrompt(prompt);
    setFormData({
      name: prompt.name,
      system: prompt.system ?? '',
      user: prompt.user ?? prompt.content ?? '',
    });
    setDialogOpen(true);
  };

  const handleOptimize = async () => {
    if (!formData.user.trim()) {
      alert('请先输入提示词内容');
      return;
    }

    setOptimizing(true);
    try {
      const res = await fetch('/api/ai/optimize-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: formData.user,
          type,
        }),
      });

      const data = await res.json();

      if (res.ok && data.optimizedPrompt) {
        // 直接替换输入框内容
        setFormData({
          ...formData,
          user: data.optimizedPrompt,
        });
      } else {
        alert(data.error || '优化失败，请稍后重试');
      }
    } catch (error) {
      console.error('优化提示词失败:', error);
      alert('优化失败，请检查网络连接');
    } finally {
      setOptimizing(false);
    }
  };

  if (loading) {
    return <div className="p-4">加载中...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">
          {type === 'world' ? '世界观提示词列表' : type === 'character' ? '角色提示词列表' : type === 'scene' ? '场景提示词列表' : '对话提示词列表'}
        </h3>
        <div className="flex gap-2">
          <Button variant="outline" onClick={restoreDefaultPrompts}>
            <RotateCcw className="w-4 h-4 mr-2" />
            恢复默认提示词
          </Button>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={resetForm}>
                <Plus className="w-4 h-4 mr-2" />
                添加提示词
              </Button>
            </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {editingPrompt ? '编辑' : '添加'}提示词
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="name">提示词名称</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="例如: 赛博朋克风格"
                  required
                />
              </div>

              <div className="grid gap-2">
                <div>
                  <Label htmlFor="system">System 提示词</Label>
                  <Textarea
                    id="system"
                    value={formData.system}
                    onChange={(e) => setFormData({ ...formData, system: e.target.value })}
                    placeholder="输入系统提示词，可为空"
                    rows={6}
                  />
                </div>
                <div>
                  <Label htmlFor="user">User 提示词</Label>
                  <Textarea
                    id="user"
                    value={formData.user}
                    onChange={(e) => setFormData({ ...formData, user: e.target.value })}
                    placeholder="输入用户提示词内容..."
                    rows={10}
                    required
                  />
                </div>
              </div>

              <div className="flex gap-2 justify-between">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleOptimize}
                  disabled={optimizing || !formData.user.trim()}
                  className="gap-2"
                >
                  <Sparkles className="w-4 h-4" />
                  {optimizing ? '优化中...' : 'AI 优化'}
                </Button>
                <div className="flex gap-2">
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
              </div>
            </form>
          </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="space-y-3">
        {prompts.map((prompt) => (
          <div
            key={prompt.id}
            className="p-4 border rounded-lg hover:bg-muted/50 transition-colors"
          >
            <div className="flex justify-between items-start mb-2">
              <div className="flex items-center gap-2">
                <h4 className="font-medium">{prompt.name}</h4>
                <Badge variant="outline">
                  {type === 'world' ? '世界观' : type === 'character' ? '角色' : type === 'scene' ? '场景' : '对话'}
                </Badge>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleEdit(prompt)}
                >
                  <Pencil className="w-4 h-4" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleDelete(prompt.id)}
                  title="删除"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
            <div className="text-xs text-muted-foreground mt-2">
              更新时间: {new Date(prompt.updatedAt).toLocaleString('zh-CN')}
            </div>
          </div>
        ))}

        {prompts.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            暂无提示词，请添加一个
          </div>
        )}
      </div>
    </div>
  );
}
