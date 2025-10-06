import { z } from 'zod';

const envSchema = z.object({
  OPENAI_API_KEY: z.string().min(1),
  ANTHROPIC_API_KEY: z.string().optional(),
  DATABASE_URL: z.string().min(1),
});

export const env = envSchema.parse(process.env);
