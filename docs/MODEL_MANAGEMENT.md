# 模型管理系统使用说明

## 概述

模型管理系统允许您灵活配置和管理不同的AI模型提供商，而不是使用固定的模型配置。您可以添加多个提供商（OpenAI、Anthropic或自定义兼容服务），并在它们之间切换。

## 功能特点

- ✅ 支持多个模型提供商
- ✅ 支持OpenAI、Anthropic和自定义OpenAI兼容API
- ✅ 可设置默认模型
- ✅ 可启用/禁用特定提供商
- ✅ 为每个提供商配置多个模型
- ✅ 自定义API端点支持
- ✅ 完整的UI管理界面

## 访问设置页面

访问 `/settings` 路径来管理模型提供商。

## 添加模型提供商

### 1. 点击"添加提供商"按钮

### 2. 填写表单

**必填字段：**
- **名称**: 提供商的显示名称（如: "OpenAI GPT-4"）
- **类型**: 选择提供商类型
  - `OpenAI`: 使用OpenAI官方API
  - `Anthropic`: 使用Anthropic官方API
  - `自定义(OpenAI兼容)`: 使用其他OpenAI兼容的API服务
- **API密钥**: 您的API密钥
- **可用模型**: 逗号分隔的模型列表（如: `gpt-4o-mini, gpt-4o`）

**可选字段：**
- **自定义API端点**: 自定义的API基础URL（仅用于自定义类型或需要代理的情况）
- **设为默认**: 勾选后将此提供商设为默认

### 3. 保存

点击"保存"按钮创建提供商。

## 管理提供商

### 编辑提供商
点击设置图标（⚙️）可以编辑提供商配置。

### 启用/禁用提供商
点击勾选/叉号按钮来启用或禁用提供商。禁用的提供商不会在AI调用中使用。

### 设为默认
点击"设为默认"按钮将该提供商设为默认。默认提供商的第一个模型将用于所有未指定模型的AI调用。

### 删除提供商
点击垃圾桶图标（🗑️）删除提供商。

## API使用

### 在代码中使用

#### 使用默认模型

```typescript
import { AIClient } from '@/lib/ai/client';

const response = await AIClient.generate(
  'story',
  '写一个科幻故事'
);
```

#### 使用特定提供商和模型

```typescript
import { AIClient } from '@/lib/ai/client';

const response = await AIClient.generate(
  'story',
  '写一个科幻故事',
  undefined, // context
  {
    providerId: 'provider-id-here',
    modelName: 'gpt-4o'
  }
);
```

### API端点

#### 获取所有提供商
```
GET /api/models
GET /api/models?includeInactive=true
```

#### 获取可用模型列表
```
GET /api/models?listAvailable=true
```

#### 添加提供商
```
POST /api/models
Content-Type: application/json

{
  "name": "OpenAI GPT-4",
  "type": "openai",
  "apiKey": "sk-...",
  "baseUrl": "https://api.openai.com/v1",
  "models": ["gpt-4o-mini", "gpt-4o"],
  "isDefault": true
}
```

#### 更新提供商
```
PATCH /api/models/[id]
Content-Type: application/json

{
  "name": "Updated Name",
  "isActive": false
}
```

#### 删除提供商
```
DELETE /api/models/[id]
```

## 配置示例

### OpenAI 官方

```json
{
  "name": "OpenAI GPT-4",
  "type": "openai",
  "apiKey": "sk-...",
  "models": ["gpt-4o-mini", "gpt-4o", "gpt-3.5-turbo"]
}
```

### Anthropic Claude

```json
{
  "name": "Anthropic Claude",
  "type": "anthropic",
  "apiKey": "sk-ant-...",
  "models": ["claude-3-5-sonnet-20241022", "claude-3-opus-20240229"]
}
```

### 自定义OpenAI兼容API（如本地部署的模型）

```json
{
  "name": "Local LLM",
  "type": "custom",
  "apiKey": "any-key",
  "baseUrl": "http://localhost:1234/v1",
  "models": ["local-model-name"]
}
```

## 代理支持

系统会自动检测环境变量中的代理配置：
- `HTTPS_PROXY`
- `HTTP_PROXY`

如果配置了这些环境变量，所有API请求都会通过代理发送。

## 数据结构

### ModelProvider 表字段

| 字段 | 类型 | 说明 |
|------|------|------|
| id | String | 唯一标识符 |
| name | String | 提供商名称 |
| type | String | 类型: openai, anthropic, custom |
| apiKey | String | API密钥 |
| baseUrl | String? | 自定义API端点 |
| models | String | JSON数组存储可用模型 |
| isDefault | Boolean | 是否为默认提供商 |
| isActive | Boolean | 是否启用 |
| metadata | String | JSON对象存储额外元数据 |
| createdAt | DateTime | 创建时间 |
| updatedAt | DateTime | 更新时间 |

## 迁移说明

从旧的固定配置迁移到新的动态配置系统：

1. **备份现有配置**: 记录 `.env` 中的 `OPENAI_API_KEY` 和 `ANTHROPIC_API_KEY`
2. **运行数据库迁移**:
   ```bash
   npx prisma migrate dev
   ```
3. **添加提供商**: 通过UI或API添加您的模型提供商
4. **测试**: 确保AI功能正常工作
5. **清理**: 可选择保留或删除 `.env` 中的旧配置

## 注意事项

- 至少需要配置一个默认提供商，否则AI功能将回退到 `lib/ai/config.ts` 中的默认配置
- API密钥存储在数据库中，请确保数据库文件的安全性
- 每次只能有一个默认提供商
- 禁用的提供商不会显示在可用模型列表中

## 故障排除

### 问题: "未配置默认模型提供商"

**解决方案**:
1. 访问 `/settings` 页面
2. 添加至少一个提供商
3. 确保该提供商被设为默认且处于启用状态

### 问题: API调用失败

**解决方案**:
1. 检查API密钥是否正确
2. 检查baseUrl是否正确（如果使用自定义端点）
3. 检查网络连接和代理配置
4. 查看服务器日志获取详细错误信息

### 问题: 找不到特定模型

**解决方案**:
1. 确认模型名称在提供商的"可用模型"列表中
2. 确认提供商处于启用状态
3. 检查模型名称拼写是否正确
