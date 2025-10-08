'use client';

import type { ChangeEvent, ReactNode } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { createProject, updateProject } from '@/lib/actions/project.actions';
import type { CreateProjectInput } from '@/lib/validations/project';
import { useRouter } from 'next/navigation';
import { Edit2, Loader2, PlusIcon, Trash2, UploadCloud } from 'lucide-react';

const projectFormSchema = z.object({
  name: z.string().min(1, '项目名称不能为空').max(100, '项目名称过长'),
  description: z.string().max(500, '描述过长').optional(),
  author: z.string().max(100, '作者名称过长').optional(),
  tagsText: z.string().max(300, '标签总长度过长').optional(),
  coverImage: z.string().max(500, '封面路径过长').optional(),
});

type ProjectFormValues = z.infer<typeof projectFormSchema>;

export interface ProjectDialogProject {
  id: string;
  name: string;
  description?: string | null;
  author?: string | null;
  tags?: string[];
  coverImage?: string | null;
}

interface CreateProjectDialogProps {
  project?: ProjectDialogProject;
  trigger?: ReactNode;
}

export function CreateProjectDialog({ project, trigger }: CreateProjectDialogProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [open, setOpen] = useState(false);
  const [isUploadingCover, setIsUploadingCover] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(project?.coverImage ?? null);
  const isEditMode = Boolean(project);

  const defaultValues = useMemo<ProjectFormValues>(
    () => ({
      name: project?.name ?? '',
      description: project?.description ?? '',
      author: project?.author ?? '',
      tagsText: project?.tags?.join(', ') ?? '',
      coverImage: project?.coverImage ?? '',
    }),
    [project]
  );

  const form = useForm<ProjectFormValues>({
    resolver: zodResolver(projectFormSchema),
    defaultValues,
  });

  useEffect(() => {
    if (!open) return;
    form.reset(defaultValues);
    setCoverPreview(project?.coverImage ?? null);
    setUploadError(null);
  }, [open, defaultValues, form, project?.coverImage]);

  const openFilePicker = () => {
    fileInputRef.current?.click();
  };

  const handleCoverUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploadingCover(true);
    setUploadError(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const response = await fetch('/api/project/cover', {
        method: 'POST',
        body: formData,
      });
      if (!response.ok) {
        throw new Error('上传失败');
      }
      const payload = await response.json();
      if (!payload?.coverImage) {
        throw new Error('缺少封面返回值');
      }
      form.setValue('coverImage', payload.coverImage, { shouldDirty: true });
      setCoverPreview(payload.coverImage);
    } catch (error) {
      console.error('上传封面失败', error);
      setUploadError('上传封面失败，请重试');
    } finally {
      setIsUploadingCover(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemoveCover = () => {
    setCoverPreview(null);
    form.setValue('coverImage', '', { shouldDirty: true });
  };

  const onSubmit = async (values: ProjectFormValues) => {
    const tags = values.tagsText
      ? values.tagsText
          .split(',')
          .map((tag) => tag.trim())
          .filter((tag) => tag.length > 0)
      : undefined;

    const payload: CreateProjectInput = {
      name: values.name,
      description: values.description?.trim() ? values.description.trim() : undefined,
      author: values.author?.trim() ? values.author.trim() : undefined,
      coverImage: values.coverImage?.trim() ? values.coverImage.trim() : undefined,
      tags,
    };

    try {
      if (project) {
        await updateProject(project.id, payload);
      } else {
        await createProject(payload);
      }
      setOpen(false);
      router.refresh();
    } catch (error) {
      console.error('保存项目失败', error);
    }
  };

  const dialogTrigger = trigger ?? (
    <Button size="icon" variant="ghost">
      {project ? <Edit2 className="h-4 w-4" /> : <PlusIcon className="h-4 w-4" />}
    </Button>
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{dialogTrigger}</DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEditMode ? '编辑项目' : '创建新项目'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <Label htmlFor="name">项目名称</Label>
            <Input id="name" {...form.register('name')} />
            {form.formState.errors.name && (
              <p className="mt-1 text-sm text-red-500">{form.formState.errors.name.message}</p>
            )}
          </div>

          <div>
            <Label htmlFor="author">作者</Label>
            <Input id="author" placeholder="作者名称" {...form.register('author')} />
            {form.formState.errors.author && (
              <p className="mt-1 text-sm text-red-500">{form.formState.errors.author.message}</p>
            )}
          </div>

          <div>
            <Label htmlFor="description">项目描述</Label>
            <Textarea id="description" rows={4} {...form.register('description')} />
            {form.formState.errors.description && (
              <p className="mt-1 text-sm text-red-500">{form.formState.errors.description.message}</p>
            )}
          </div>

          <div>
            <Label htmlFor="tagsText">作品标签</Label>
            <Input
              id="tagsText"
              placeholder="使用逗号分隔多个标签，例如：奇幻, 冒险"
              {...form.register('tagsText')}
            />
            {form.formState.errors.tagsText && (
              <p className="mt-1 text-sm text-red-500">{form.formState.errors.tagsText.message}</p>
            )}
          </div>

          <div>
            <Label>封面图</Label>
            <input type="hidden" {...form.register('coverImage')} />
            <div className="flex items-start gap-4">
              <div className="flex h-28 w-28 items-center justify-center overflow-hidden rounded-md border bg-muted">
                {coverPreview ? (
                  <Image src={coverPreview} alt="项目封面" width={112} height={112} className="h-full w-full object-cover" />
                ) : (
                  <span className="px-2 text-center text-xs text-muted-foreground">尚未上传</span>
                )}
              </div>
              <div className="flex flex-col gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={openFilePicker}
                  disabled={isUploadingCover}
                  className="gap-2"
                >
                  {isUploadingCover ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      上传中...
                    </>
                  ) : (
                    <>
                      <UploadCloud className="h-4 w-4" />
                      上传图片
                    </>
                  )}
                </Button>
                {coverPreview && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleRemoveCover}
                    disabled={isUploadingCover}
                    className="gap-2 text-red-500 hover:text-red-500"
                  >
                    <Trash2 className="h-4 w-4" />
                    移除封面
                  </Button>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleCoverUpload}
                />
              </div>
            </div>
            {uploadError && <p className="mt-2 text-sm text-red-500">{uploadError}</p>}
            {form.formState.errors.coverImage && (
              <p className="mt-1 text-sm text-red-500">{form.formState.errors.coverImage.message}</p>
            )}
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={form.formState.isSubmitting || isUploadingCover}
          >
            {form.formState.isSubmitting
              ? '保存中...'
              : isEditMode
                ? '保存修改'
                : '创建'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
