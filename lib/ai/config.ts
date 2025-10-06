import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';

// 代理配置
const proxyConfig = {
  httpProxy: process.env.HTTP_PROXY,
  httpsProxy: process.env.HTTPS_PROXY,
};

// 如果配置了代理,使用自定义 fetch
const customFetch = (proxyConfig.httpProxy || proxyConfig.httpsProxy)
  ? async (url: RequestInfo | URL, init?: RequestInit) => {
      // Node.js 环境下,设置了 HTTP_PROXY/HTTPS_PROXY 环境变量后会自动使用代理
      return fetch(url, init);
    }
  : undefined;

// 使用代理配置创建 provider
const openaiProvider = customFetch
  ? createOpenAI({ fetch: customFetch })
  : openai;

const anthropicProvider = customFetch
  ? createAnthropic({ fetch: customFetch })
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
