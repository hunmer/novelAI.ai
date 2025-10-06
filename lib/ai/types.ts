// lib/ai/types.ts
export interface IAIGenerateOptions {
  prompt: string;
  temperature?: number;
  maxTokens?: number;
  kbContext?: string;
  onStream?: (chunk: string) => void;
}

export interface IAIResponse {
  text: string;
  tokens: number;
  cost: number;
}
