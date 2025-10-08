import { z } from 'zod';

export const createProjectSchema = z.object({
  name: z.string().min(1, '项目名称不能为空').max(100, '项目名称过长'),
  description: z.string().max(500, '描述过长').optional(),
  author: z.string().trim().max(100, '作者名称过长').optional(),
  tags: z
    .array(
      z
        .string()
        .trim()
        .min(1, '标签不能为空')
        .max(30, '单个标签过长')
    )
    .max(20, '标签数量过多')
    .optional(),
  coverImage: z.string().trim().max(500, '封面路径过长').optional(),
});

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
