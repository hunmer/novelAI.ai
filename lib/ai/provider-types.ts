export const PROVIDER_TYPE_OPTIONS = [
  { value: 'openai', label: 'OpenAI' },
  { value: 'azure', label: 'Azure OpenAI' },
  { value: 'anthropic', label: 'Anthropic' },
  { value: 'xai', label: 'xAI' },
  { value: 'vercel', label: 'Vercel' },
  { value: 'groq', label: 'Groq' },
  { value: 'deepinfra', label: 'DeepInfra' },
  { value: 'mistral', label: 'Mistral' },
  { value: 'google-generative-ai', label: 'Google Generative AI' },
  { value: 'google-vertex', label: 'Google Vertex' },
  { value: 'deepseek', label: 'DeepSeek' },
  { value: 'cerebras', label: 'Cerebras' },
  { value: 'fireworks', label: 'Fireworks' },
  { value: 'baseten', label: 'Baseten' },
  { value: 'custom', label: '自定义 (OpenAI 兼容)' },
] as const;

export type ProviderType = (typeof PROVIDER_TYPE_OPTIONS)[number]['value'];

const PROVIDER_TYPE_LABEL_MAP = new Map(
  PROVIDER_TYPE_OPTIONS.map((item) => [item.value, item.label])
);

export function getProviderTypeLabel(type: ProviderType): string {
  return PROVIDER_TYPE_LABEL_MAP.get(type) ?? type;
}

export function isProviderType(value: unknown): value is ProviderType {
  if (typeof value !== 'string') return false;
  return PROVIDER_TYPE_LABEL_MAP.has(value as ProviderType);
}

const OPENAI_COMPATIBLE_TYPES: ProviderType[] = ['openai', 'custom'];

const OPENAI_COMPATIBLE_TYPE_SET = new Set<ProviderType>(OPENAI_COMPATIBLE_TYPES);

export function isOpenAICompatibleProviderType(type: ProviderType): boolean {
  return OPENAI_COMPATIBLE_TYPE_SET.has(type);
}

export function normalizeProviderType(value: unknown): ProviderType {
  return isProviderType(value) ? value : 'custom';
}
