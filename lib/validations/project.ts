import { z } from 'zod';

export const createProjectSchema = z.object({
  name: z.string().min(1, '项目名称不能为空').max(100, '项目名称过长'),
  description: z.string().max(500, '描述过长').optional(),
});

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
