import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createAzure } from '@ai-sdk/azure';
import { createGroq } from '@ai-sdk/groq';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createVertex } from '@ai-sdk/google-vertex';
import { createMistral } from '@ai-sdk/mistral';
import { createDeepSeek } from '@ai-sdk/deepseek';
import { createDeepInfra } from '@ai-sdk/deepinfra';
import { createFireworks } from '@ai-sdk/fireworks';
import { createCerebras } from '@ai-sdk/cerebras';
import { createVercel } from '@ai-sdk/vercel';
import { createXai } from '@ai-sdk/xai';
import type { LanguageModelV2 } from '@ai-sdk/provider';
type BasetenFactory = typeof import('@ai-sdk/baseten').createBaseten;
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

const fetchConfig = customFetch ? { fetch: customFetch } : {};

function firstDefined<T>(...values: Array<T | undefined | null>): T | undefined {
  for (const value of values) {
    if (value !== undefined && value !== null && value !== '') {
      return value as T;
    }
  }
  return undefined;
}

function normalizePrivateKey(value?: string) {
  return value ? value.replace(/\\n/g, '\n') : undefined;
}

let basetenFactoryCache: BasetenFactory | null | undefined;

function loadBasetenFactory(): BasetenFactory | null {
  if (basetenFactoryCache !== undefined) {
    return basetenFactoryCache;
  }

  try {
    const req: NodeRequire =
      typeof __non_webpack_require__ === 'function'
        ? __non_webpack_require__
        : eval('require');
    basetenFactoryCache = req('@ai-sdk/baseten').createBaseten as BasetenFactory;
  } catch {
    basetenFactoryCache = null;
  }

  return basetenFactoryCache;
}

// 使用代理配置创建 provider
const openaiProvider = customFetch
  ? createOpenAI({
      ...fetchConfig,
      apiKey: process.env.OPENAI_API_KEY
    })
  : openai;

const anthropicProvider = customFetch
  ? createAnthropic({
      ...fetchConfig,
      apiKey: process.env.ANTHROPIC_API_KEY
    })
  : anthropic;

const azureProvider = (() => {
  const apiKey = process.env.AZURE_OPENAI_API_KEY;
  const resourceName = process.env.AZURE_OPENAI_RESOURCE || process.env.AZURE_RESOURCE_NAME;
  const endpoint = process.env.AZURE_OPENAI_ENDPOINT || process.env.AZURE_OPENAI_BASE_URL;

  if (!apiKey || (!resourceName && !endpoint)) {
    return null;
  }

  const apiVersion = process.env.AZURE_OPENAI_API_VERSION;

  const init: Record<string, unknown> = {
    apiKey,
    ...fetchConfig,
  };

  if (resourceName) {
    init.resourceName = resourceName;
  }

  if (endpoint) {
    init.endpoint = endpoint;
  }

  if (apiVersion) {
    init.apiVersion = apiVersion;
  }

  return createAzure(init as Parameters<typeof createAzure>[0]);
})();

const groqProvider = (() => {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return null;
  }

  const init: Record<string, unknown> = {
    apiKey,
    ...fetchConfig,
  };

  if (process.env.GROQ_BASE_URL) {
    init.baseURL = process.env.GROQ_BASE_URL;
  }

  return createGroq(init as Parameters<typeof createGroq>[0]);
})();

const googleProvider = (() => {
  const apiKey = firstDefined(
    process.env.GOOGLE_GENERATIVE_AI_API_KEY,
    process.env.GOOGLE_API_KEY,
    process.env.GEMINI_API_KEY
  );
  if (!apiKey) {
    return null;
  }

  const init: Record<string, unknown> = {
    apiKey,
    ...fetchConfig,
  };

  const baseURL = firstDefined(
    process.env.GOOGLE_GENERATIVE_AI_API_ENDPOINT,
    process.env.GOOGLE_GENERATIVE_AI_BASE_URL,
    process.env.GOOGLE_API_BASE_URL
  );
  if (baseURL) {
    init.baseURL = baseURL;
  }

  return createGoogleGenerativeAI(init as Parameters<typeof createGoogleGenerativeAI>[0]);
})();

const vertexProvider = (() => {
  const project = firstDefined(
    process.env.GOOGLE_VERTEX_PROJECT,
    process.env.GOOGLE_CLOUD_PROJECT
  );
  const location = firstDefined(
    process.env.GOOGLE_VERTEX_LOCATION,
    process.env.GOOGLE_CLOUD_LOCATION
  );

  const clientEmail = firstDefined(
    process.env.GOOGLE_VERTEX_CLIENT_EMAIL,
    process.env.GOOGLE_CLIENT_EMAIL
  );
  const privateKey = normalizePrivateKey(
    firstDefined(
      process.env.GOOGLE_VERTEX_PRIVATE_KEY,
      process.env.GOOGLE_PRIVATE_KEY
    )
  );

  const init: Record<string, unknown> = {
    ...fetchConfig,
  };

  if (project) {
    init.project = project;
  }
  if (location) {
    init.location = location;
  }

  if (clientEmail && privateKey) {
    init.googleAuthOptions = {
      credentials: {
        client_email: clientEmail,
        private_key: privateKey,
      },
    };
  }

  const baseURL = firstDefined(
    process.env.GOOGLE_VERTEX_BASE_URL,
    process.env.GOOGLE_VERTEX_ENDPOINT
  );
  if (baseURL) {
    init.baseURL = baseURL;
  }

  // Vertex SDK can use ADC without explicit credentials; ensure at least
  // one configuration value exists to avoid instantiating unnecessarily.
  if (!project && !location && !clientEmail && !baseURL && !process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    return null;
  }

  return createVertex(init as Parameters<typeof createVertex>[0]);
})();

const mistralProvider = (() => {
  const apiKey = process.env.MISTRAL_API_KEY;
  if (!apiKey) return null;

  const init: Record<string, unknown> = {
    apiKey,
    ...fetchConfig,
  };

  if (process.env.MISTRAL_BASE_URL) {
    init.baseURL = process.env.MISTRAL_BASE_URL;
  }

  return createMistral(init as Parameters<typeof createMistral>[0]);
})();

const deepseekProvider = (() => {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) return null;

  const init: Record<string, unknown> = {
    apiKey,
    ...fetchConfig,
  };

  if (process.env.DEEPSEEK_BASE_URL) {
    init.baseURL = process.env.DEEPSEEK_BASE_URL;
  }

  return createDeepSeek(init as Parameters<typeof createDeepSeek>[0]);
})();

const deepinfraProvider = (() => {
  const apiKey = process.env.DEEPINFRA_API_KEY;
  if (!apiKey) return null;

  const init: Record<string, unknown> = {
    apiKey,
    ...fetchConfig,
  };

  if (process.env.DEEPINFRA_BASE_URL) {
    init.baseURL = process.env.DEEPINFRA_BASE_URL;
  }

  return createDeepInfra(init as Parameters<typeof createDeepInfra>[0]);
})();

const fireworksProvider = (() => {
  const apiKey = process.env.FIREWORKS_API_KEY;
  if (!apiKey) return null;

  const init: Record<string, unknown> = {
    apiKey,
    ...fetchConfig,
  };

  if (process.env.FIREWORKS_BASE_URL) {
    init.baseURL = process.env.FIREWORKS_BASE_URL;
  }

  return createFireworks(init as Parameters<typeof createFireworks>[0]);
})();

const cerebrasProvider = (() => {
  const apiKey = process.env.CEREBRAS_API_KEY;
  if (!apiKey) return null;

  const init: Record<string, unknown> = {
    apiKey,
    ...fetchConfig,
  };

  if (process.env.CEREBRAS_BASE_URL) {
    init.baseURL = process.env.CEREBRAS_BASE_URL;
  }

  return createCerebras(init as Parameters<typeof createCerebras>[0]);
})();

const basetenProvider = (() => {
  const factory = loadBasetenFactory();
  if (!factory) return null;

  const modelURL = firstDefined(
    process.env.BASETEN_MODEL_URL,
    process.env.BASETEN_MODEL_ENDPOINT
  );
  if (!modelURL) return null;

  const init: Record<string, unknown> = {
    modelURL,
    ...fetchConfig,
  };

  if (process.env.BASETEN_API_KEY) {
    init.apiKey = process.env.BASETEN_API_KEY;
  }
  if (process.env.BASETEN_WORKSPACE_ID) {
    init.workspaceId = process.env.BASETEN_WORKSPACE_ID;
  }

  return factory(init as Parameters<BasetenFactory>[0]);
})();

const vercelProvider = (() => {
  const apiKey = firstDefined(process.env.VERCEL_AI_API_KEY, process.env.VERCEL_API_KEY);
  if (!apiKey) return null;

  const init: Record<string, unknown> = {
    apiKey,
    ...fetchConfig,
  };

  if (process.env.VERCEL_AI_BASE_URL) {
    init.baseURL = process.env.VERCEL_AI_BASE_URL;
  }

  return createVercel(init as Parameters<typeof createVercel>[0]);
})();

const xaiProvider = (() => {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) return null;

  const init: Record<string, unknown> = {
    apiKey,
    ...fetchConfig,
  };

  if (process.env.XAI_BASE_URL) {
    init.baseURL = process.env.XAI_BASE_URL;
  }

  return createXai(init as Parameters<typeof createXai>[0]);
})();

type ChatModel = LanguageModelV2;

const aiModels: Record<string, ChatModel> = {
  // 使用 Chat Completion API 提供文本能力
  GPT4: openaiProvider.chat('gpt-4o-mini'),
  GPT35: openaiProvider.chat('gpt-3.5-turbo'),
  CLAUDE: anthropicProvider.chat('claude-3-5-sonnet-20241022'),
};

const azureDefaultDeployment = process.env.AZURE_OPENAI_DEPLOYMENT || process.env.AZURE_OPENAI_MODEL;
if (azureProvider && azureDefaultDeployment) {
  aiModels.AZURE_DEFAULT = azureProvider.chat(azureDefaultDeployment);
}

const groqDefaultModel = process.env.GROQ_MODEL || process.env.GROQ_DEFAULT_MODEL;
if (groqProvider && groqDefaultModel) {
  aiModels.GROQ_DEFAULT = groqProvider.chat(groqDefaultModel);
}

const googleDefaultModel = firstDefined(
  process.env.GOOGLE_GENERATIVE_AI_MODEL,
  process.env.GEMINI_MODEL_ID
);
if (googleProvider && googleDefaultModel) {
  aiModels.GOOGLE_DEFAULT = googleProvider(googleDefaultModel);
}

const vertexDefaultModel = firstDefined(
  process.env.GOOGLE_VERTEX_MODEL,
  process.env.GEMINI_VERTEX_MODEL
);
if (vertexProvider && vertexDefaultModel) {
  aiModels.GOOGLE_VERTEX_DEFAULT = vertexProvider(vertexDefaultModel);
}

const mistralDefaultModel = process.env.MISTRAL_MODEL;
if (mistralProvider && mistralDefaultModel) {
  aiModels.MISTRAL_DEFAULT = mistralProvider(mistralDefaultModel);
}

const deepseekDefaultModel = process.env.DEEPSEEK_MODEL;
if (deepseekProvider && deepseekDefaultModel) {
  aiModels.DEEPSEEK_DEFAULT = deepseekProvider(deepseekDefaultModel);
}

const deepinfraDefaultModel = process.env.DEEPINFRA_MODEL;
if (deepinfraProvider && deepinfraDefaultModel) {
  aiModels.DEEPINFRA_DEFAULT = deepinfraProvider(deepinfraDefaultModel);
}

const fireworksDefaultModel = process.env.FIREWORKS_MODEL;
if (fireworksProvider && fireworksDefaultModel) {
  aiModels.FIREWORKS_DEFAULT = fireworksProvider(fireworksDefaultModel);
}

const cerebrasDefaultModel = process.env.CEREBRAS_MODEL;
if (cerebrasProvider && cerebrasDefaultModel) {
  aiModels.CEREBRAS_DEFAULT = cerebrasProvider(cerebrasDefaultModel);
}

const basetenDefaultModel = process.env.BASETEN_MODEL_ID;
if (basetenProvider && basetenDefaultModel) {
  aiModels.BASETEN_DEFAULT = basetenProvider(basetenDefaultModel);
}

const vercelDefaultModel = firstDefined(
  process.env.VERCEL_AI_MODEL,
  process.env.VERCEL_DEFAULT_MODEL
);
if (vercelProvider && vercelDefaultModel) {
  aiModels.VERCEL_DEFAULT = vercelProvider(vercelDefaultModel);
}

const xaiDefaultModel = process.env.XAI_MODEL;
if (xaiProvider && xaiDefaultModel) {
  aiModels.XAI_DEFAULT = xaiProvider(xaiDefaultModel);
}

export const AI_MODELS = aiModels;

export const DEFAULT_MODEL = AI_MODELS.GPT4;

export const AI_CONFIG = {
  maxRetries: 3,
  timeout: 30000,
  defaultTemperature: 0.8,
  maxTokens: 4000,
} as const;
