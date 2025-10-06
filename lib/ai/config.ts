import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';

export const AI_MODELS = {
  GPT4: openai('gpt-4-turbo-preview'),
  GPT35: openai('gpt-3.5-turbo'),
  CLAUDE: anthropic('claude-3-5-sonnet-20241022'),
} as const;

export const DEFAULT_MODEL = AI_MODELS.GPT4;

export const AI_CONFIG = {
  maxRetries: 3,
  timeout: 30000,
  defaultTemperature: 0.8,
  maxTokens: 4000,
} as const;
