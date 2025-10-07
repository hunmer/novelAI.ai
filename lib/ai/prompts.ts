export const PROMPT_TEMPLATES = {
  worldGen: {
    system: '你是一位资深的小说世界观设计师,擅长创建丰富、连贯的虚构世界。',
    user: (input: string, kb?: string) => `
${kb ? `参考知识库:\n${kb}\n\n` : ''}
用户需求: ${input}

请生成详细的世界观设定,包括:
1. 世界背景与历史
2. 地理环境与文化
3. 势力与派系
4. 核心规则与设定

以JSON格式输出:
{
  "background": "...",
  "geography": "...",
  "factions": [...],
  "rules": [...]
}
    `,
  },
  characterGen: {
    system: '你是一位角色设计专家,擅长创建立体、有深度的小说角色。',
    user: (input: string, worldContext?: string) => `
${worldContext ? `世界观背景:\n${worldContext}\n\n` : ''}
用户需求: ${input}

请生成角色设定,包括:
1. 基本信息(姓名、年龄、性别等)
2. 性格特征
3. 背景故事
4. 能力与技能
5. 人际关系

以JSON格式输出。
    `,
  },
  sceneGen: {
    system: '你是一位场景描写大师,擅长创建生动、沉浸式的场景。',
    user: (input: string) => `用户需求: ${input}\n\n请生成场景描述。`,
  },
  dialogGen: {
    system: '你是一位对话写作专家,擅长创建自然、符合角色性格的对话。',
    user: (input: string, characters?: string) => `
${characters ? `角色信息:\n${characters}\n\n` : ''}
用户需求: ${input}

请生成对话内容,确保符合角色性格。
    `,
  },
  promptOptimize: {
    system: '你是一位专业的提示词优化专家，擅长改进和优化各类AI提示词，使其更加清晰、具体、有效。',
    user: (input: string, type?: string) => `
请优化以下${type === 'world' ? '世界观' : type === 'character' ? '角色' : ''}提示词，使其更加详细、结构化和有效。

原始提示词：
${input}

优化要求：
1. 保持原始意图，但让描述更加具体和详细
2. 添加必要的结构化元素
3. 确保语言流畅、逻辑清晰
4. 增强提示词的可操作性

请以JSON格式输出优化结果：
{
  "optimizedPrompt": "优化后的提示词内容",
  "improvements": ["改进点1", "改进点2", "改进点3"],
  "suggestions": "进一步优化建议（可选）"
}

注意：必须严格返回有效的JSON格式，不要包含任何其他文本。
    `,
  },
};

export type PromptType = keyof typeof PROMPT_TEMPLATES;
