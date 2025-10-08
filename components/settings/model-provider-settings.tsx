'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from '@/components/ui/dialog';
import { Plus, Trash2, Check, X, Settings, Table } from 'lucide-react';
import {
  PROVIDER_TYPE_OPTIONS,
  ProviderType,
  getProviderTypeLabel,
  normalizeProviderType,
} from '@/lib/ai/provider-types';

type ModelCapability =
  | 'text'
  | 'vision'
  | 'web'
  | 'tools'
  | 'embedding'
  | 'image'
  | 'reasoning';

const CAPABILITY_LABELS: Record<ModelCapability, string> = {
  text: '文本',
  vision: '视觉',
  web: '联网',
  tools: '工具',
  embedding: '嵌入',
  image: '图片',
  reasoning: '推理',
};

const CAPABILITY_OPTIONS: { value: ModelCapability; label: string }[] = [
  { value: 'text', label: CAPABILITY_LABELS.text },
  { value: 'vision', label: CAPABILITY_LABELS.vision },
  { value: 'web', label: CAPABILITY_LABELS.web },
  { value: 'tools', label: CAPABILITY_LABELS.tools },
  { value: 'embedding', label: CAPABILITY_LABELS.embedding },
  { value: 'image', label: CAPABILITY_LABELS.image },
  { value: 'reasoning', label: CAPABILITY_LABELS.reasoning },
];

type ProviderFeatureKey = 'imageInput' | 'objectGeneration' | 'toolUsage' | 'toolStreaming';

type ProviderFeatures = Record<ProviderFeatureKey, boolean>;

interface ProviderSupportRow {
  providerName: string;
  providerHref: string;
  model: string;
  features: ProviderFeatures;
}

const FEATURE_COLUMNS: Array<{ key: ProviderFeatureKey; label: string }> = [
  { key: 'imageInput', label: 'Image Input' },
  { key: 'objectGeneration', label: 'Object Generation' },
  { key: 'toolUsage', label: 'Tool Usage' },
  { key: 'toolStreaming', label: 'Tool Streaming' },
];

const FEATURE_PRESETS = {
  all: {
    imageInput: true,
    objectGeneration: true,
    toolUsage: true,
    toolStreaming: true,
  },
  textToolsStream: {
    imageInput: false,
    objectGeneration: true,
    toolUsage: true,
    toolStreaming: true,
  },
  textTools: {
    imageInput: false,
    objectGeneration: true,
    toolUsage: true,
    toolStreaming: false,
  },
  imageOnly: {
    imageInput: true,
    objectGeneration: false,
    toolUsage: false,
    toolStreaming: false,
  },
  none: {
    imageInput: false,
    objectGeneration: false,
    toolUsage: false,
    toolStreaming: false,
  },
} as const satisfies Record<string, ProviderFeatures>;

type FeaturePreset = keyof typeof FEATURE_PRESETS;

interface KeyValueItem {
  id: string;
  key: string;
  value: string;
}

function createKeyValueItem(key = '', value = ''): KeyValueItem {
  const id = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);
  return { id, key, value };
}

function cloneKeyValueItems(items: KeyValueItem[] = []): KeyValueItem[] {
  return items.map((item) => createKeyValueItem(item.key, item.value));
}

function headersObjectToList(raw: unknown): KeyValueItem[] {
  let record: Record<string, unknown> | null = null;

  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    record = raw as Record<string, unknown>;
  } else if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        record = parsed as Record<string, unknown>;
      }
    } catch {
      // ignore
    }
  }

  if (!record) return [];

  const entries: KeyValueItem[] = [];
  for (const [key, value] of Object.entries(record)) {
    const trimmedKey = key.trim();
    if (!trimmedKey) continue;

    let stringValue: string | undefined;
    if (typeof value === 'string') {
      stringValue = value.trim();
    } else if (typeof value === 'number' || typeof value === 'boolean') {
      stringValue = String(value);
    }

    if (!stringValue) continue;
    entries.push(createKeyValueItem(trimmedKey, stringValue));
  }
  return entries;
}

function headersListToObject(items: KeyValueItem[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (const item of items) {
    const key = item.key.trim();
    const value = item.value.trim();
    if (!key || !value) continue;
    result[key] = value;
  }
  return result;
}

interface ProviderMetadata {
  headers?: Record<string, string>;
  [key: string]: unknown;
}

function mergeMetadataWithHeaders(
  base: ProviderMetadata | undefined,
  headers: Record<string, string>
): ProviderMetadata {
  const metadata = base ? { ...base } : {};

  if (Object.keys(headers).length) {
    metadata.headers = headers;
  } else if ('headers' in metadata) {
    delete metadata.headers;
  }

  return metadata;
}

function createProviderRows(
  providerName: string,
  providerHref: string,
  models: Array<{ name: string; preset: FeaturePreset; overrides?: Partial<ProviderFeatures> }>
): ProviderSupportRow[] {
  return models.map(({ name, preset, overrides }) => ({
    providerName,
    providerHref,
    model: name,
    features: { ...FEATURE_PRESETS[preset], ...(overrides ?? {}) },
  }));
}

const PROVIDER_SUPPORT_ROWS: ProviderSupportRow[] = [
  ...createProviderRows('xAI Grok', '/providers/ai-sdk-providers/xai', [
    { name: 'grok-4', preset: 'textToolsStream' },
    { name: 'grok-3', preset: 'textToolsStream' },
    { name: 'grok-3-fast', preset: 'textToolsStream' },
    { name: 'grok-3-mini', preset: 'textToolsStream' },
    { name: 'grok-3-mini-fast', preset: 'textToolsStream' },
    { name: 'grok-2-1212', preset: 'textToolsStream' },
    { name: 'grok-2-vision-1212', preset: 'all' },
    { name: 'grok-beta', preset: 'textToolsStream' },
    { name: 'grok-vision-beta', preset: 'imageOnly' },
  ]),
  ...createProviderRows('Vercel', '/providers/ai-sdk-providers/vercel', [
    { name: 'v0-1.0-md', preset: 'all' },
  ]),
  ...createProviderRows('OpenAI', '/providers/ai-sdk-providers/openai', [
    { name: 'gpt-5', preset: 'all' },
    { name: 'gpt-5-mini', preset: 'all' },
    { name: 'gpt-5-nano', preset: 'all' },
    { name: 'gpt-5-codex', preset: 'all' },
    { name: 'gpt-5-chat-latest', preset: 'all' },
  ]),
  ...createProviderRows('Anthropic', '/providers/ai-sdk-providers/anthropic', [
    { name: 'claude-opus-4-1', preset: 'all' },
    { name: 'claude-opus-4-0', preset: 'all' },
    { name: 'claude-sonnet-4-0', preset: 'all' },
    { name: 'claude-3-7-sonnet-latest', preset: 'all' },
    { name: 'claude-3-5-haiku-latest', preset: 'all' },
  ]),
  ...createProviderRows('Groq', '/providers/ai-sdk-providers/groq', [
    { name: 'meta-llama/llama-4-scout-17b-16e-instruct', preset: 'all' },
    { name: 'deepseek-r1-distill-llama-70b', preset: 'textToolsStream' },
    { name: 'llama-3.3-70b-versatile', preset: 'textToolsStream' },
    { name: 'llama-3.1-8b-instant', preset: 'textToolsStream' },
    { name: 'qwen-qwq-32b', preset: 'textToolsStream' },
    { name: 'mixtral-8x7b-32768', preset: 'textToolsStream' },
    { name: 'gemma2-9b-it', preset: 'textToolsStream' },
    { name: 'moonshotai/kimi-k2-instruct', preset: 'textTools' },
  ]),
  ...createProviderRows('DeepInfra', '/providers/ai-sdk-providers/deepinfra', [
    { name: 'meta-llama/Llama-4-Maverick-17B-128E-Instruct-FP8', preset: 'imageOnly' },
    { name: 'meta-llama/Llama-4-Scout-17B-16E-Instruct', preset: 'imageOnly' },
    { name: 'meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo', preset: 'textTools' },
    { name: 'meta-llama/Llama-3.3-70B-Instruct', preset: 'textTools' },
    { name: 'deepseek-ai/DeepSeek-V3', preset: 'none' },
    { name: 'deepseek-ai/DeepSeek-R1', preset: 'none' },
    { name: 'deepseek-ai/DeepSeek-R1-Distill-Llama-70B', preset: 'none' },
    { name: 'deepseek-ai/DeepSeek-R1-Turbo', preset: 'none' },
  ]),
  ...createProviderRows('Mistral', '/providers/ai-sdk-providers/mistral', [
    { name: 'pixtral-large-latest', preset: 'all' },
    { name: 'mistral-large-latest', preset: 'textToolsStream' },
    { name: 'mistral-medium-latest', preset: 'textToolsStream' },
    { name: 'mistral-medium-2505', preset: 'textToolsStream' },
    { name: 'mistral-small-latest', preset: 'textToolsStream' },
    { name: 'pixtral-12b-2409', preset: 'all' },
  ]),
  ...createProviderRows('Google Generative AI', '/providers/ai-sdk-providers/google-generative-ai', [
    { name: 'gemini-2.0-flash-exp', preset: 'all' },
    { name: 'gemini-1.5-flash', preset: 'all' },
    { name: 'gemini-1.5-pro', preset: 'all' },
  ]),
  ...createProviderRows('Google Vertex', '/providers/ai-sdk-providers/google-vertex', [
    { name: 'gemini-2.0-flash-exp', preset: 'all' },
    { name: 'gemini-1.5-flash', preset: 'all' },
    { name: 'gemini-1.5-pro', preset: 'all' },
  ]),
  ...createProviderRows('DeepSeek', '/providers/ai-sdk-providers/deepseek', [
    { name: 'deepseek-chat', preset: 'textToolsStream' },
    { name: 'deepseek-reasoner', preset: 'none' },
  ]),
  ...createProviderRows('Cerebras', '/providers/ai-sdk-providers/cerebras', [
    { name: 'llama3.1-8b', preset: 'textToolsStream' },
    { name: 'llama3.3-70b', preset: 'textToolsStream' },
  ]),
  ...createProviderRows('Fireworks', '/providers/ai-sdk-providers/fireworks', [
    { name: 'kimi-k2-instruct', preset: 'textTools' },
  ]),
  ...createProviderRows('Baseten', '/providers/ai-sdk-providers/baseten', [
    { name: 'openai/gpt-oss-120b', preset: 'textToolsStream' },
    { name: 'Qwen/Qwen3-235B-A22B-Instruct-2507', preset: 'textToolsStream' },
    { name: 'Qwen/Qwen3-Coder-480B-A35B-Instruct', preset: 'textToolsStream' },
    { name: 'moonshotai/Kimi-K2-Instruct-0905', preset: 'textToolsStream' },
    { name: 'deepseek-ai/DeepSeek-V3.1', preset: 'textToolsStream' },
    { name: 'deepseek-ai/DeepSeek-R1-0528', preset: 'textToolsStream' },
    { name: 'deepseek-ai/DeepSeek-V3-0324', preset: 'textToolsStream' },
  ]),
];

function FeatureIcon({ active }: { active: boolean }) {
  const Icon = active ? Check : X;
  const classes = active ? 'h-4 w-4 text-emerald-500' : 'h-4 w-4 text-muted-foreground';

  return (
    <span className="inline-flex items-center justify-center">
      <Icon className={classes} aria-hidden="true" />
      <span className="sr-only">{active ? '支持' : '不支持'}</span>
    </span>
  );
}

function ProviderComparisonTable() {
  return (
    <div className="space-y-3">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-border text-left">
              <th className="py-2 pr-3 font-medium">Provider</th>
              <th className="py-2 pr-3 font-medium">Model</th>
              {FEATURE_COLUMNS.map((column) => (
                <th key={column.key} className="py-2 px-3 text-center font-medium">
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PROVIDER_SUPPORT_ROWS.map((row) => (
              <tr
                key={`${row.providerName}-${row.model}`}
                className="border-b border-border last:border-b-0"
              >
                <td className="py-2 pr-3 align-top">
                  <Link
                    href={row.providerHref}
                    className="text-primary underline-offset-4 hover:underline"
                  >
                    {row.providerName}
                  </Link>
                </td>
                <td className="py-2 pr-3 align-top">
                  <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{row.model}</code>
                </td>
                {FEATURE_COLUMNS.map((column) => (
                  <td key={column.key} className="py-2 px-3 text-center align-top">
                    <FeatureIcon active={row.features[column.key]} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="rounded-md border border-dashed border-muted-foreground/40 p-3 text-xs text-muted-foreground">
        此表并非完整清单，更多模型可在提供商文档与社区维护的{' '}
        <Link
          href="/providers/ai-sdk-providers/community-providers"
          className="text-primary underline-offset-4 hover:underline"
        >
          社区提供商
        </Link>
        {' '}页面中查看。
      </div>
    </div>
  );
}

function ProviderComparisonModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="查看模型能力对比">
          <Table className="h-4 w-4" aria-hidden="true" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle>AI SDK Providers</DialogTitle>
          <DialogDescription>
            AI SDK 提供官方与社区模型服务商支持，以下表格概览主流模型的能力覆盖，便于快速对比与选择。
          </DialogDescription>
        </DialogHeader>
        <ProviderComparisonTable />
      </DialogContent>
    </Dialog>
  );
}

interface ProviderModelForm {
  name: string;
  label?: string;
  description?: string;
  capabilities: ModelCapability[];
  defaultFor: ModelCapability[];
  metadata?: ProviderMetadata;
  headers?: KeyValueItem[];
}

interface ModelProvider {
  id: string;
  name: string;
  type: ProviderType;
  apiKey: string;
  baseUrl?: string;
  models: ProviderModelForm[];
  isDefault: boolean;
  isActive: boolean;
  metadata: ProviderMetadata;
  headers: KeyValueItem[];
}

interface ProviderFormState {
  name: string;
  type: ProviderType;
  apiKey: string;
  baseUrl: string;
  models: ProviderModelForm[];
  isDefault: boolean;
  metadata?: ProviderMetadata;
  headers: KeyValueItem[];
}

const PRESET_MODEL_LIBRARY: Record<string, ProviderModelForm[]> = {
  baai: [
    {
      name: 'BAAI/bge-m3',
      label: 'bge-m3',
      capabilities: ['embedding'],
      defaultFor: ['embedding'],
    },
  ],
  qwen: [
    {
      name: 'Qwen2.5-7B-Instruct',
      label: 'Qwen 2.5 7B Instruct',
      capabilities: ['text', 'vision', 'tools', 'web'],
      defaultFor: ['text'],
    },
  ],
  'deepseek-ai': [
    {
      name: 'deepseek-ai/DeepSeek-R1',
      label: 'DeepSeek R1',
      capabilities: ['text', 'reasoning', 'tools'],
      defaultFor: ['reasoning'],
    },
    {
      name: 'deepseek-ai/DeepSeek-V3',
      label: 'DeepSeek V3',
      capabilities: ['text', 'tools'],
      defaultFor: ['text'],
    },
  ],
  'meta-llama': [
    {
      name: 'meta-llama/Llama-3.3-70B-Instruct',
      label: 'Llama 3.3 70B',
      capabilities: ['text', 'reasoning'],
      defaultFor: ['text'],
    },
  ],
};

function cloneModels(models: ProviderModelForm[]): ProviderModelForm[] {
  return models.map((model) => ({
    ...model,
    capabilities: [...model.capabilities],
    defaultFor: [...model.defaultFor],
    metadata: model.metadata
      ? JSON.parse(JSON.stringify(model.metadata))
      : {},
    headers: cloneKeyValueItems(model.headers || []),
  }));
}

function createEmptyFormState(): ProviderFormState {
  return {
    name: '',
    type: 'openai',
    apiKey: '',
    baseUrl: '',
    models: [],
    isDefault: false,
    metadata: {},
    headers: [],
  };
}

function getPresetKey(name: string): string | undefined {
  const key = name.trim().toLowerCase();
  if (!key) return undefined;
  return Object.keys(PRESET_MODEL_LIBRARY).find((preset) => preset === key);
}

export function ModelProviderSettings() {
  const [providers, setProviders] = useState<ModelProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProvider, setEditingProvider] = useState<ModelProvider | null>(null);
  const [comparisonOpen, setComparisonOpen] = useState(false);

  const [formData, setFormData] = useState<ProviderFormState>(() => createEmptyFormState());

  useEffect(() => {
    fetchProviders();
  }, []);

  const fetchProviders = async () => {
    try {
      const res = await fetch('/api/models?includeInactive=true');
      const data = await res.json();
      interface RawProvider {
        id: string;
        name: string;
        type: string;
        apiKey: string;
        baseUrl?: string;
        models?: Array<{
          name: string;
          label?: string;
          description?: string;
          capabilities?: string[];
          defaultFor?: string[];
          metadata?: unknown;
        }>;
        isDefault: boolean;
        isActive: boolean;
        metadata?: unknown;
      }

      const nextProviders: ModelProvider[] = (data.providers || []).map((provider: RawProvider) => {
        const rawMetadata =
          provider.metadata && typeof provider.metadata === 'object'
            ? (provider.metadata as Record<string, unknown>)
            : undefined;
        const metadataClone = rawMetadata
          ? JSON.parse(JSON.stringify(rawMetadata))
          : undefined;
        const providerHeaders = headersObjectToList(rawMetadata?.['headers']);

        return {
          id: provider.id,
          name: provider.name,
          type: normalizeProviderType(provider.type),
          apiKey: provider.apiKey,
          baseUrl: provider.baseUrl || '',
          models: Array.isArray(provider.models)
            ? provider.models.map((model) => {
                const modelMetadata =
                  model.metadata && typeof model.metadata === 'object'
                    ? (model.metadata as Record<string, unknown>)
                    : undefined;
                return {
                  name: model.name,
                  label: model.label,
                  description: model.description,
                  capabilities: Array.isArray(model.capabilities)
                    ? (model.capabilities as ModelCapability[])
                    : [],
                  defaultFor: Array.isArray(model.defaultFor)
                    ? (model.defaultFor as ModelCapability[])
                    : [],
                  metadata: modelMetadata
                    ? JSON.parse(JSON.stringify(modelMetadata))
                    : undefined,
                  headers: headersObjectToList(modelMetadata?.['headers']),
                } satisfies ProviderModelForm;
              })
            : [],
          isDefault: provider.isDefault,
          isActive: provider.isActive,
          metadata: metadataClone ?? {},
          headers: providerHeaders,
        } satisfies ModelProvider;
      });
      setProviders(nextProviders);
    } catch (error) {
      console.error('获取模型提供商失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const presetModels = useMemo(() => {
    const presetKey = getPresetKey(formData.name);
    if (!presetKey) return undefined;
    return cloneModels(PRESET_MODEL_LIBRARY[presetKey]);
  }, [formData.name]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const payloadModels = formData.models
      .filter((model) => model.name.trim())
      .map((model) => {
        const capabilities = model.capabilities.length
          ? Array.from(new Set(model.capabilities))
          : (['text'] as ModelCapability[]);
        const defaultFor = Array.from(
          new Set(model.defaultFor.filter((capability) => capabilities.includes(capability)))
        );
        const headersRecord = headersListToObject(model.headers ?? []);
        const metadata = mergeMetadataWithHeaders(model.metadata, headersRecord);
        const hasOriginalMetadata = !!(
          model.metadata && Object.keys(model.metadata).length > 0
        );
        const shouldIncludeMetadata =
          Object.keys(metadata).length > 0 || hasOriginalMetadata;

        return {
          name: model.name.trim(),
          label: model.label?.trim() || undefined,
          description: model.description?.trim() || undefined,
          capabilities,
          defaultFor,
          ...(shouldIncludeMetadata ? { metadata } : {}),
        } satisfies ProviderModelForm;
      });

    if (!payloadModels.length) {
      alert('至少添加一个模型配置');
      return;
    }

    const providerHeaders = headersListToObject(formData.headers);
    const providerMetadata = mergeMetadataWithHeaders(formData.metadata, providerHeaders);
    const hadProviderMetadata = !!(
      (formData.metadata && Object.keys(formData.metadata).length > 0) ||
      (editingProvider?.metadata && Object.keys(editingProvider.metadata).length > 0)
    );
    const shouldSendProviderMetadata =
      Object.keys(providerMetadata).length > 0 || hadProviderMetadata;

    try {
      if (editingProvider) {
        await fetch(`/api/models/${editingProvider.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: formData.name,
            type: formData.type,
            apiKey: formData.apiKey,
            baseUrl: formData.baseUrl || undefined,
            models: payloadModels,
            isDefault: formData.isDefault,
            ...(shouldSendProviderMetadata ? { metadata: providerMetadata } : {}),
          }),
        });
      } else {
        await fetch('/api/models', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: formData.name,
            type: formData.type,
            apiKey: formData.apiKey,
            baseUrl: formData.baseUrl || undefined,
            models: payloadModels,
            isDefault: formData.isDefault,
            ...(shouldSendProviderMetadata ? { metadata: providerMetadata } : {}),
          }),
        });
      }

      resetForm();
      setDialogOpen(false);
      fetchProviders();
    } catch (error) {
      console.error('保存模型提供商失败:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除此模型提供商吗？')) return;

    try {
      await fetch(`/api/models/${id}`, { method: 'DELETE' });
      fetchProviders();
    } catch (error) {
      console.error('删除模型提供商失败:', error);
    }
  };

  const handleToggleActive = async (provider: ModelProvider) => {
    try {
      await fetch(`/api/models/${provider.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !provider.isActive }),
      });
      fetchProviders();
    } catch (error) {
      console.error('切换状态失败:', error);
    }
  };

  const handleSetDefault = async (provider: ModelProvider) => {
    try {
      await fetch(`/api/models/${provider.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isDefault: true }),
      });
      fetchProviders();
    } catch (error) {
      console.error('设置默认失败:', error);
    }
  };

  const handleSetCapabilityDefault = async (
    provider: ModelProvider,
    modelName: string,
    capability: ModelCapability
  ) => {
    try {
      await fetch(`/api/models/${provider.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          setDefaultCapability: {
            model: modelName,
            capability,
          },
        }),
      });
      fetchProviders();
    } catch (error) {
      console.error('设置默认能力失败:', error);
    }
  };

  const handleUnsetCapabilityDefault = async (
    provider: ModelProvider,
    modelName: string,
    capability: ModelCapability
  ) => {
    try {
      await fetch(`/api/models/${provider.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          unsetDefaultCapability: {
            model: modelName,
            capability,
          },
        }),
      });
      fetchProviders();
    } catch (error) {
      console.error('取消默认能力失败:', error);
    }
  };

  const resetForm = () => {
    setFormData(createEmptyFormState());
    setEditingProvider(null);
  };

  const handleEdit = (provider: ModelProvider) => {
    setEditingProvider(provider);
    setFormData({
      name: provider.name,
      type: provider.type,
      apiKey: provider.apiKey,
      baseUrl: provider.baseUrl || '',
      models: cloneModels(provider.models),
      isDefault: provider.isDefault,
      metadata:
        provider.metadata && Object.keys(provider.metadata).length > 0
          ? JSON.parse(JSON.stringify(provider.metadata))
          : {},
      headers: cloneKeyValueItems(provider.headers),
    });
    setDialogOpen(true);
  };

  const handleAddModel = () => {
    setFormData((prev) => ({
      ...prev,
      models: [
        ...prev.models,
        {
          name: '',
          capabilities: ['text'],
          defaultFor: ['text'],
          metadata: {},
          headers: [],
        },
      ],
    }));
  };

  const handleRemoveModel = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      models: prev.models.filter((_, idx) => idx !== index),
    }));
  };

  const addProviderHeader = () => {
    setFormData((prev) => ({
      ...prev,
      headers: [...prev.headers, createKeyValueItem()],
    }));
  };

  const updateProviderHeader = (
    index: number,
    field: 'key' | 'value',
    value: string
  ) => {
    setFormData((prev) => ({
      ...prev,
      headers: prev.headers.map((item, idx) =>
        idx === index
          ? {
              ...item,
              [field]: value,
            }
          : item
      ),
    }));
  };

  const removeProviderHeader = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      headers: prev.headers.filter((_, idx) => idx !== index),
    }));
  };

  const updateModel = (index: number, updater: (model: ProviderModelForm) => ProviderModelForm) => {
    setFormData((prev) => ({
      ...prev,
      models: prev.models.map((model, idx) => (idx === index ? updater(model) : model)),
    }));
  };

  const addModelHeader = (index: number) => {
    updateModel(index, (model) => ({
      ...model,
      headers: [...(model.headers ?? []), createKeyValueItem()],
    }));
  };

  const updateModelHeader = (
    modelIndex: number,
    headerIndex: number,
    field: 'key' | 'value',
    value: string
  ) => {
    updateModel(modelIndex, (model) => ({
      ...model,
      headers: (model.headers ?? []).map((item, idx) =>
        idx === headerIndex
          ? {
              ...item,
              [field]: value,
            }
          : item
      ),
    }));
  };

  const removeModelHeader = (modelIndex: number, headerIndex: number) => {
    updateModel(modelIndex, (model) => ({
      ...model,
      headers: (model.headers ?? []).filter((_, idx) => idx !== headerIndex),
    }));
  };

  const toggleCapability = (index: number, capability: ModelCapability) => {
    updateModel(index, (model) => {
      const hasCapability = model.capabilities.includes(capability);
      const capabilities = hasCapability
        ? model.capabilities.filter((item) => item !== capability)
        : [...model.capabilities, capability];

      const defaultFor = hasCapability
        ? model.defaultFor.filter((item) => item !== capability)
        : model.defaultFor;

      return {
        ...model,
        capabilities,
        defaultFor,
      };
    });
  };

  const toggleDefaultCapability = (index: number, capability: ModelCapability) => {
    setFormData((prev) => ({
      ...prev,
      models: prev.models.map((model, idx) => {
        if (idx === index) {
          const isDefault = model.defaultFor.includes(capability);
          const nextDefaults = isDefault
            ? model.defaultFor.filter((item) => item !== capability)
            : [...model.defaultFor, capability];
          return {
            ...model,
            defaultFor: nextDefaults,
          };
        }
        return {
          ...model,
          defaultFor: model.defaultFor.filter((item) => item !== capability),
        };
      }),
    }));
  };

  const applyPresetModels = () => {
    if (!presetModels) return;
    setFormData((prev) => ({
      ...prev,
      models: cloneModels(presetModels),
    }));
  };

  if (loading) {
    return <div className="p-4">加载中...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">模型提供商管理</h2>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm}>
              <Plus className="w-4 h-4 mr-2" />
              添加提供商
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <div className="flex items-center justify-between">
                <DialogTitle>{editingProvider ? '编辑' : '添加'}模型提供商</DialogTitle>
                <ProviderComparisonModal
                  open={comparisonOpen}
                  onOpenChange={setComparisonOpen}
                />
              </div>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <Label htmlFor="name">名称</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="例如: OpenAI GPT-4"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="type">类型</Label>
                  <select
                    id="type"
                    value={formData.type}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        type: normalizeProviderType(e.target.value),
                      })
                    }
                    className="w-full rounded border p-2"
                    required
                  >
                    {PROVIDER_TYPE_OPTIONS.map(({ value, label }) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label htmlFor="apiKey">API 密钥</Label>
                  <Input
                    id="apiKey"
                    type="password"
                    value={formData.apiKey}
                    onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
                    placeholder="sk-..."
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="baseUrl">自定义 API 端点（可选）</Label>
                  <Input
                    id="baseUrl"
                    value={formData.baseUrl}
                    onChange={(e) => setFormData({ ...formData, baseUrl: e.target.value })}
                    placeholder="https://api.example.com/v1"
                  />
                </div>
                <div className="md:col-span-2 space-y-2">
                  <div>
                    <Label>自定义 Headers（可选）</Label>
                    <p className="mt-1 text-xs text-muted-foreground">
                      将在调用该提供商下任意模型时附加到请求中，可用于私有网关、租户标识等场景。
                    </p>
                  </div>
                  <div className="space-y-2">
                    {formData.headers.map((item, idx) => (
                      <div key={item.id} className="flex gap-2">
                        <Input
                          placeholder="Header 名称"
                          value={item.key}
                          onChange={(e) => updateProviderHeader(idx, 'key', e.target.value)}
                        />
                        <Input
                          placeholder="Header 值"
                          value={item.value}
                          onChange={(e) => updateProviderHeader(idx, 'value', e.target.value)}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => removeProviderHeader(idx)}
                          aria-label="删除 Header"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={addProviderHeader}>
                    <Plus className="mr-2 h-4 w-4" /> 添加 Header
                  </Button>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isDefault"
                  checked={formData.isDefault}
                  onChange={(e) =>
                    setFormData({ ...formData, isDefault: e.target.checked })
                  }
                />
                <Label htmlFor="isDefault">设为默认提供商</Label>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold">模型配置</h4>
                  <div className="flex items-center gap-2">
                    {presetModels && (
                      <Button type="button" variant="outline" size="sm" onClick={applyPresetModels}>
                        使用预设模型
                      </Button>
                    )}
                    <Button type="button" variant="outline" size="sm" onClick={handleAddModel}>
                      <Plus className="w-4 h-4 mr-1" /> 添加模型
                    </Button>
                  </div>
                </div>

                {formData.models.length === 0 && (
                  <div className="rounded border border-dashed p-4 text-sm text-muted-foreground">
                    目前没有模型，请添加或使用预设配置。
                  </div>
                )}

                <div className="space-y-3">
                  {formData.models.map((model, index) => (
                    <Card key={`${model.name}-${index}`} className="p-4 space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 space-y-3">
                          <div className="grid gap-3 md:grid-cols-2">
                            <div>
                              <Label>模型名称</Label>
                              <Input
                                value={model.name}
                                onChange={(e) =>
                                  updateModel(index, (prev) => ({
                                    ...prev,
                                    name: e.target.value,
                                  }))
                                }
                                placeholder="例如: gpt-4o-mini"
                                required
                              />
                            </div>
                            <div>
                              <Label>显示名称（可选）</Label>
                              <Input
                                value={model.label || ''}
                                onChange={(e) =>
                                  updateModel(index, (prev) => ({
                                    ...prev,
                                    label: e.target.value,
                                  }))
                                }
                                placeholder="用于界面显示的名称"
                              />
                            </div>
                          </div>

                          <div>
                            <Label className="block text-sm font-medium">模型能力</Label>
                            <div className="mt-2 flex flex-wrap gap-2">
                              {CAPABILITY_OPTIONS.map(({ value, label }) => {
                                const active = model.capabilities.includes(value);
                                return (
                                  <Button
                                    key={value}
                                    type="button"
                                    variant={active ? 'secondary' : 'outline'}
                                    size="sm"
                                    onClick={() => toggleCapability(index, value)}
                                  >
                                    {label}
                                  </Button>
                                );
                              })}
                            </div>
                          </div>

                          {model.capabilities.length > 0 && (
                            <div>
                              <Label className="block text-sm font-medium">默认能力</Label>
                              <div className="mt-2 flex flex-wrap gap-2">
                                {model.capabilities.map((capability) => {
                                  const isDefault = model.defaultFor.includes(capability);
                                  return (
                                    <Button
                                      key={capability}
                                      type="button"
                                      variant={isDefault ? 'default' : 'outline'}
                                      size="sm"
                                      onClick={() => toggleDefaultCapability(index, capability)}
                                    >
                                      {isDefault
                                        ? `默认${CAPABILITY_LABELS[capability]}`
                                        : `设为默认${CAPABILITY_LABELS[capability]}`}
                                    </Button>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          <div className="space-y-2">
                            <Label className="block text-sm font-medium">模型级 Headers（可选）</Label>
                            <p className="text-xs text-muted-foreground">
                              会与服务商 Headers 合并，模型配置可覆盖同名项。
                            </p>
                            <div className="space-y-2">
                              {(model.headers ?? []).map((item, headerIdx) => (
                                <div key={item.id} className="flex gap-2">
                                  <Input
                                    placeholder="Header 名称"
                                    value={item.key}
                                    onChange={(e) =>
                                      updateModelHeader(index, headerIdx, 'key', e.target.value)
                                    }
                                  />
                                  <Input
                                    placeholder="Header 值"
                                    value={item.value}
                                    onChange={(e) =>
                                      updateModelHeader(index, headerIdx, 'value', e.target.value)
                                    }
                                  />
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    onClick={() => removeModelHeader(index, headerIdx)}
                                    aria-label="删除模型 Header"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              ))}
                            </div>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => addModelHeader(index)}
                            >
                              <Plus className="mr-2 h-4 w-4" /> 添加模型 Header
                            </Button>
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => handleRemoveModel(index)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2">
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

      <div className="grid gap-4">
        {providers.map((provider) => (
          <Card key={provider.id} className="p-4 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-lg font-semibold">{provider.name}</h3>
                  {provider.isDefault && <Badge variant="default">默认提供商</Badge>}
                  <Badge variant={provider.isActive ? 'outline' : 'secondary'}>
                    {provider.isActive ? '已启用' : '已禁用'}
                  </Badge>
                  <Badge variant="outline">{getProviderTypeLabel(provider.type)}</Badge>
                </div>
                {provider.baseUrl && (
                  <p className="text-xs text-muted-foreground">端点：{provider.baseUrl}</p>
                )}
              </div>

              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleEdit(provider)}
                >
                  <Settings className="w-4 h-4" />
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleToggleActive(provider)}
                >
                  {provider.isActive ? <X className="w-4 h-4" /> : <Check className="w-4 h-4" />}
                </Button>
                {!provider.isDefault && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleSetDefault(provider)}
                  >
                    设为默认
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleDelete(provider.id)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <div className="space-y-3">
              {provider.models.map((model) => (
                <div
                  key={model.name}
                  className="rounded-md border p-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium">
                        {model.label || model.name}
                      </p>
                      {model.description && (
                        <p className="text-xs text-muted-foreground mt-1">{model.description}</p>
                      )}
                    </div>
                  </div>

                  <div className="mt-3 space-y-2">
                    <div className="flex flex-wrap gap-2">
                      {model.capabilities.map((capability) => (
                        <Badge key={capability} variant="outline">
                          {CAPABILITY_LABELS[capability]}
                        </Badge>
                      ))}
                    </div>

                    {model.capabilities.length > 0 && (
                      <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                        {model.capabilities.map((capability) => {
                          const isDefault = model.defaultFor.includes(capability);
                          return (
                            <div
                              key={`${model.name}-${capability}`}
                              className="flex items-center gap-2"
                            >
                              <Badge variant={isDefault ? 'default' : 'secondary'}>
                                {isDefault
                                  ? `默认${CAPABILITY_LABELS[capability]}`
                                  : `可设为默认${CAPABILITY_LABELS[capability]}`}
                              </Badge>
                              <Button
                                size="xs"
                                variant="outline"
                                onClick={() =>
                                  isDefault
                                    ? handleUnsetCapabilityDefault(
                                        provider,
                                        model.name,
                                        capability
                                      )
                                    : handleSetCapabilityDefault(
                                        provider,
                                        model.name,
                                        capability
                                      )
                                }
                              >
                                {isDefault ? '取消默认' : '设为默认'}
                              </Button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {provider.models.length === 0 && (
                <div className="text-sm text-muted-foreground">
                  该提供商尚未配置模型。
                </div>
              )}
            </div>
          </Card>
        ))}

        {providers.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            暂无模型提供商，请添加一个
          </div>
        )}
      </div>

    </div>
  );
}
