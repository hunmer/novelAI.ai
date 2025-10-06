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
import { Plus, Trash2, Pencil } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface Prompt {
  id: string;
  name: string;
  content: string;
  type: 'world' | 'character';
  projectId: string;
  createdAt: string;
  updatedAt: string;
}

interface PromptListProps {
  projectId: string;
  type: 'world' | 'character';
}

export function PromptList({ projectId, type }: PromptListProps) {
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPrompt, setEditingPrompt] = useState<Prompt | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    content: '',
  });

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (editingPrompt) {
        // 更新
        await fetch(`/api/prompts/${editingPrompt.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        });
      } else {
        // 新建
        await fetch('/api/prompts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...formData,
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
      content: '',
    });
    setEditingPrompt(null);
  };

  const handleEdit = (prompt: Prompt) => {
    setEditingPrompt(prompt);
    setFormData({
      name: prompt.name,
      content: prompt.content,
    });
    setDialogOpen(true);
  };

  if (loading) {
    return <div className="p-4">加载中...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">
          {type === 'world' ? '世界观提示词列表' : '角色提示词列表'}
        </h3>
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

              <div>
                <Label htmlFor="content">提示词内容</Label>
                <Textarea
                  id="content"
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  placeholder="输入提示词内容..."
                  rows={10}
                  required
                />
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
                  {type === 'world' ? '世界观' : '角色'}
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
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
            <p className="text-sm text-muted-foreground line-clamp-3">
              {prompt.content}
            </p>
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
