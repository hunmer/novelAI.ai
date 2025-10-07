# 数据库迁移说明

## 场景管理功能数据库更新

由于 SQLite 数据库当前被应用占用，需要按以下步骤手动执行数据库迁移：

### 步骤 1：停止开发服务器

如果开发服务器正在运行，请先停止它（通常是 Ctrl+C）。

### 步骤 2：执行数据库迁移

选择以下任一方法：

#### 方法A：使用 Prisma Migrate（推荐）

```bash
npx prisma migrate dev --name add_scene_fields_and_generated_image
```

#### 方法B：手动执行 SQL 脚本

```bash
sqlite3 prisma/dev.db < prisma/migrations/manual_add_scene_and_image.sql
```

### 步骤 3：验证迁移

```bash
npx prisma studio
```

打开 Prisma Studio 检查：
- `Scene` 表是否包含新字段：`paintingPrompt`、`backgroundImage`
- 是否存在新表：`GeneratedImage`

### 步骤 4：重启开发服务器

```bash
npm run dev
```

## 新增功能

迁移完成后，你可以使用以下新功能：

1. **场景Tab**：在项目页面的"场景"标签页中管理场景
2. **AI场景生成**：输入关键词自动生成详细的场景描述和绘画提示词
3. **图片生成**：使用配置的图片生成模型为场景创建插图
4. **场景背景图**：从生成的图片历史中选择一张作为场景背景

## 使用前准备

在使用图片生成功能前，请确保：

1. 在设置中添加至少一个图片生成模型提供商
2. 将模型的 `capability` 设置为 `image`
3. 配置正确的 API Key 和 Base URL

支持的图片生成模型示例：
- OpenAI DALL-E 3
- Stability AI (通过 OpenAI 兼容接口)
- 其他支持 OpenAI 图片生成 API 格式的服务
