import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { ProxyAgent } from 'undici';

// 代理配置
const proxyUrl = process.env.HTTPS_PROXY || process.env.HTTP_PROXY;

// 如果配置了代理，使用 undici 的 ProxyAgent
const customFetch = proxyUrl
  ? async (url: RequestInfo | URL, init?: RequestInit) => {
      const dispatcher = new ProxyAgent(proxyUrl);
      return fetch(url, { ...init, dispatcher } as RequestInit);
    }
  : undefined;

// 使用代理配置创建 provider
const openaiProvider = customFetch
  ? createOpenAI({
      fetch: customFetch,
      apiKey: process.env.OPENAI_API_KEY
    })
  : openai;

const anthropicProvider = customFetch
  ? createAnthropic({
      fetch: customFetch,
      apiKey: process.env.ANTHROPIC_API_KEY
    })
  : anthropic;

export const AI_MODELS = {
  GPT4: openaiProvider('gpt-4o-mini'),
  GPT35: openaiProvider('gpt-3.5-turbo'),
  CLAUDE: anthropicProvider('claude-3-5-sonnet-20241022'),
} as const;

export const DEFAULT_MODEL = AI_MODELS.GPT4;

export const AI_CONFIG = {
  maxRetries: 3,
  timeout: 30000,
  defaultTemperature: 0.8,
  maxTokens: 4000,
} as const;
