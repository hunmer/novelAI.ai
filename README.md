非常好 👍
你希望把之前的架构（Web + Server 分离 + socket 通讯）改为一个更现代、更简洁的 **一体化架构**，即：
👉 使用 **Next.js (App Router + Server Components)** 实现全栈，
👉 使用 **shadcn/ui** 做前端 UI 框架，
👉 不再前后端分离，而是通过 **Next.js API Routes / Server Actions** 实现业务逻辑、AI 调用与数据库交互。

下面是完整修正版的 PRD 文档，我会帮你重构成 **Next.js 一体化开发架构方案** 的 Markdown 文档风格。
（最后我也可以帮你导出成 `.zip` 文件，和之前一样。）

---

# Novel.AI 创作平台 - 一体化架构产品需求文档（Next.js + shadcn/ui）

## 🧩 一、项目概述

本项目旨在构建一个基于 **AI 辅助创作的小说生成平台**，帮助用户从想法或剧本出发，通过 AI 自动生成并完善以下内容：

* 世界观与背景设定
* 角色人设与属性
* 场景与剧情发展
* 对话内容
* 美术资源（角色立绘、背景图）

与传统前后端分离不同，本系统采用 **Next.js 全栈架构**，集成：

* 前端页面（App Router + Server Components）
* 后端逻辑（API Routes / Server Actions）
* 实时协作（WebSocket / edge runtime）
* shadcn/ui 组件库统一样式与交互

---

## ⚙️ 二、技术架构

| 层级    | 技术栈                                  | 说明                                              |
| ----- | ------------------------------------ | ----------------------------------------------- |
| 全栈框架  | **Next.js 15+**                      | 使用 App Router + Server Components 实现 SSR 与服务端逻辑 |
| UI 组件 | **shadcn/ui + TailwindCSS**          | 快速构建现代 UI 组件与主题风格                               |
| AI 调用 | **Flowgram.ai SDK**                  | 提供世界观、角色、场景、对话、美术生成工作流                          |
| 实时协作  | **Socket.IO / Next.js Edge Runtime** | 房间系统，协作同步与多人在线编辑                                |
| 数据存储  | **JSON + SQLite / Prisma ORM**       | 工程文件、版本与知识库结构化存储                                |
| 版本控制  | 内置差分记录与回滚机制                          | 所有工程变更均可追踪与还原                                   |

---

## 🧱 三、系统结构

### 1. 目录结构（Next.js）

```
/app
 ├── (dashboard)/
 │   ├── layout.tsx
 │   ├── page.tsx
 │   ├── world/
 │   ├── characters/
 │   ├── scenes/
 │   ├── dialogs/
 │   └── assets/
 ├── api/
 │   ├── ai/route.ts
 │   ├── projects/route.ts
 │   ├── kb/route.ts
 │   └── preview/route.ts
/lib
 ├── flowgram.ts        # 封装 Flowgram.ai 工作流调用
 ├── socket.ts          # 房间与协作事件定义
 ├── db.ts              # Prisma 数据库实例
/components
 ├── ui/ (来自 shadcn)
 ├── project-tabs.tsx
 ├── scene-editor.tsx
 ├── dialog-generator.tsx
 └── preview-player.tsx
```

---

## 🖥️ 四、前端交互设计（shadcn/ui）

### 主界面布局

```
------------------------------------------------
| 左侧栏 (项目切换 + 操作按钮) | 主工作区 (Tabs)
------------------------------------------------
Tabs 包含：
- 世界观设定
- 角色设计
- 场景编辑
- 对话生成
- 美术资源
------------------------------------------------
```

### 操作逻辑

* 新建 / 导入工程
* 上传知识库（自动解析入向量索引）
* 调用 AI 工作流生成内容
* 查看与回滚版本
* 启动测试预览（场景模拟）

---

## ⚙️ 五、工程数据结构

每个工程存储为一条数据库记录，对应多个 JSON 子模块：

| 模块              | 内容               |
| --------------- | ---------------- |
| `meta`          | 作品名称、简介、主题、状态    |
| `world`         | 世界观、设定、派系、文化体系   |
| `characters`    | 角色数据（属性、性格、背景）   |
| `scenes`        | 场景信息（地理、氛围、资源引用） |
| `dialogs`       | 对话与互动            |
| `assets`        | 角色立绘与场景背景资源      |
| `knowledgeBase` | 用户上传或生成的知识库数据    |

---

## 🧠 六、AI 生成逻辑（Flowgram.ai 工作流）

### 工作流预设

使用 Flowgram.ai 创建以下工作流：

* `worldGen`：生成世界观与文化背景
* `characterGen`：生成角色设定
* `sceneGen`：生成场景与视觉要素
* `dialogGen`：生成多轮对话（带角色属性）
* `artGen`：生成美术资源

### 节点模型（Story Graph）

每个剧情通过 **节点系统（Node Graph）** 实现：

| 节点类型          | 功能                   |
| ------------- | -------------------- |
| SceneNode     | 定义场景背景、音乐、时间等        |
| CharacterNode | 定义角色属性（好感度、心情、自定义标签） |
| DialogueNode  | 角色交互节点，调用对话生成工作流     |
| ArtNode       | 生成场景或角色立绘            |
| LogicNode     | 条件/变量控制，用于剧情分支       |

> 系统通过收集 Scene + Character 属性 → 注入 Prompt → 调用工作流生成剧情。

---

## 🔌 七、Server Actions 与 AI 调用流程

### 示例流程（生成角色）

1. 用户在角色页点击“生成角色”
2. 前端调用：

   ```tsx
   await generateCharacterAction({ prompt, kbContext })
   ```
3. Server Action 内部逻辑：

   * 调用 `Flowgram.ai` 对应工作流
   * 注入知识库内容、上下文属性
   * 保存生成结果至数据库（`characters` 表）
4. 生成完成后返回结果并更新前端视图（自动 revalidate）

---

## 🧩 八、实时协作（Socket 房间机制）

* 使用 Socket.IO（集成于 Next.js Edge runtime）
* 每个工程一个房间：`room:{projectId}`
* 支持以下事件：

  * `project:update`
  * `workflow:progress`
  * `dialog:add`
  * `preview:state`
* 用户进入同一工程后可实时看到他人编辑状态、游标与生成结果。

---

## 🎨 九、美术资源系统

* 使用 AI（Flowgram）生成角色立绘、场景图等。
* 支持版本记录、替换与比较。
* 美术版本记录示例：

  ```json
  {
    "id": "a_01",
    "type": "character",
    "versions": [
      {"ver": 1, "uri": "/assets/char_1_v1.png"},
      {"ver": 2, "uri": "/assets/char_1_v2.png"}
    ]
  }
  ```

---

## 🧪 十、测试预览系统

* 使用 `<PreviewPlayer />` 组件模拟游戏演出：

  * 背景、立绘、BGM 动态加载
  * 支持场景选择与剧情跳转
  * 可从任意句子进入预览
* 实现交互：点击选项推进剧情，实时更新角色状态（好感度/心情）

---

## 📚 十一、知识库（Knowledge Base）

* 用户上传 `.txt / .md / .json` 文件后自动索引
* 系统在生成时自动检索相关片段注入 Prompt
* 可视化查看命中内容（显示引用来源与权重）

---

## 🧭 十二、版本控制

* 所有编辑操作都会生成差异快照
* 版本记录存储在 `versions` 表
* 可对比或回滚任意版本
* AI 生成与手动修改分别标注来源

---

## 🧰 十三、非功能需求

| 项目  | 要求                        |
| --- | ------------------------- |
| 实时性 | 编辑延迟 < 200ms              |
| 稳定性 | Edge Runtime 自动断线重连       |
| 安全  | Room 级权限控制、访问令牌           |
| 可扩展 | 模块化节点系统、可自定义 Flowgram 工作流 |
| 响应式 | PC / 平板 自适应布局             |

---

## 🚀 十四、MVP 范围

* 使用 Next.js + shadcn/ui 完成核心前端
* 整合 Flowgram.ai 工作流（世界观 / 角色 / 对话）
* 工程创建与保存（本地 JSON + Prisma）
* 实时协作（Socket 房间系统）
* 基础测试预览模块

---
