# LogsOP 调试日志使用指南

## 概述

本项目已集成 LogsOP 客户端用于实时调试和日志追踪。LogsOP 提供了统一的日志记录接口,支持 HTTP 和 WebSocket 两种传输方式。

## 环境配置

在 `.env` 文件中配置 LogsOP:

```bash
# 启用 LogsOP 日志记录
LOGSOP_ENABLED="true"

# LogsOP 服务器地址(默认: http://localhost:8832)
LOGSOP_SERVER="http://localhost:8832"

# 传输方式: http 或 websocket (默认: websocket)
LOGSOP_TRANSPORT="websocket"
```

**重要特性**:
- **延迟初始化**: 第一次调用日志方法时自动读取环境变量并初始化连接
- **日志队列**: 初始化前的日志会暂存到队列,连接成功后批量发送
- **自动回退**: 连接失败时自动使用标准 console 输出,不会报错或丢失日志
- **WebSocket 等待**: WebSocket 传输会等待最多 3 秒建立连接,超时自动回退

## 启动 LogsOP 服务器

在启动应用之前,需要先启动 LogsOP 服务器:

```bash
# 进入 logsOP 服务器目录
cd /Users/Zhuanz/logsOP/packages/server

# 安装依赖(首次运行)
npm install

# 启动服务器
npm run dev
```

服务器默认运行在 `http://localhost:8832`。

## 已集成的日志点

### 1. 服务器启动 (server.js)

- **应用准备完成**: 记录 Next.js 应用启动
- **HTTP 请求**: 记录所有 HTTP 请求(debug 级别)
- **请求错误**: 记录请求处理错误
- **服务器监听**: 记录服务器启动信息

**日志前缀**: `server`, `http`

### 2. AI 客户端 (lib/ai/client.ts)

- **AI 生成请求**: 记录每次 AI 生成的详细信息
  - 请求类型、模型配置、输入长度
  - Token 使用量和成本统计
  - 重试机制和错误处理
- **流式生成**: 记录流式生成的启动和状态
- **日志片段追踪**: 完整追踪从请求到响应的全过程

**日志前缀**: `ai-client`

**日志片段示例**:
- `ai-generate-{type}-{timestamp}`: 普通生成
- `ai-stream-{type}-{timestamp}`: 流式生成

**记录的关键指标**:
- 输入长度
- Token 使用量
- API 成本
- 重试次数
- 错误信息

### 3. API 路由 (/app/api/ai/world/route.ts)

- **世界观生成**: 使用日志片段追踪整个生成流程
  - 开始生成
  - 生成完成
  - 生成失败

**日志前缀**: `ai-world`

**日志片段**: 每次世界观生成请求会创建独立的日志片段,便于追踪完整流程。

### 4. Socket.IO 服务 (lib/socket/server.js)

- **客户端连接/断开**: 记录 WebSocket 连接状态
- **用户加入房间**: 记录用户加入项目房间
- **项目更新同步**: 记录实时协作更新事件

**日志前缀**: `socket`

## 在代码中使用日志

### TypeScript/ESM 模块

```typescript
import { logger } from '@/lib/logger/client';

// 基本日志 (无 metadata 时发送普通文本)
await logger.info('操作成功', 'prefix');
await logger.warn('警告信息', 'prefix');
await logger.error('错误信息', 'prefix');
await logger.debug('调试信息', 'prefix');

// 带 metadata 的日志 (自动发送 JSON 格式)
await logger.info('用户登录', 'auth', { userId: 123 });
await logger.error('错误信息', 'prefix', { error: err.message });

// 定时任务进度追踪 (自动发送 JSON 格式)
await logger.info('定时任务执行', 'cron-interval', {
  index: 1,
  total: 10,
  data: { count: 1, format: 'json' }
});

// JSON 格式发送的内容会被格式化为:
// {
//   "message": "定时任务执行",
//   "timestamp": "2025-01-06T10:30:00.000Z",
//   "index": 1,
//   "total": 10,
//   "data": { "count": 1, "format": "json" }
// }

// 使用日志片段追踪业务流程
const snippetId = logger.startSnippet({
  snippet_id: `my-flow-${Date.now()}`,
  name: '我的业务流程'
});

await logger.logSnippet('步骤 1 完成', snippetId!, 'prefix');
await logger.logSnippet('步骤 2 完成', snippetId!, 'prefix');
await logger.endSnippet(snippetId!);
```

### CommonJS 模块

```javascript
const { logger } = require('@/lib/logger/server');

// 基本日志 (无 metadata 时发送普通文本)
await logger.info('操作成功', 'prefix');
await logger.warn('警告信息', 'prefix');
await logger.error('错误信息', 'prefix');
await logger.debug('调试信息', 'prefix');

// 带 metadata 的日志 (自动发送 JSON 格式)
await logger.info('用户登录', 'auth', { userId: 123 });
await logger.error('错误信息', 'prefix', { error: err.message });

// 定时任务进度追踪 (自动发送 JSON 格式)
await logger.info('定时任务执行', 'cron-interval', {
  index: 1,
  total: 10,
  data: { count: 1, format: 'json' }
});

// 使用日志片段
const snippetId = logger.startSnippet({
  snippet_id: `my-flow-${Date.now()}`,
  name: '我的业务流程'
});

await logger.logSnippet('步骤 1 完成', snippetId, 'prefix');
await logger.logSnippet('步骤 2 完成', snippetId, 'prefix');
await logger.endSnippet(snippetId);
```

## 日志级别

- **debug**: 调试信息,详细的执行过程
- **info**: 一般信息,关键操作记录
- **warn**: 警告信息,潜在问题
- **error**: 错误信息,异常和失败

## 日志前缀建议

使用有意义的前缀来组织日志:

- `server`: 服务器相关
- `http`: HTTP 请求
- `socket`: WebSocket 相关
- `ai-world`: AI 世界观生成
- `ai-character`: AI 角色生成
- `db`: 数据库操作
- `auth`: 认证授权

## 查看日志

启动 LogsOP 服务器后,可以通过以下方式查看日志:

1. **Web 界面**: 访问 LogsOP 提供的 Web 控制台
2. **终端输出**: LogsOP 服务器终端会显示接收到的日志
3. **日志文件**: 根据 LogsOP 服务器配置,日志会保存到文件

## 性能考虑

- 日志记录是异步的,不会阻塞主流程
- 当 `LOGSOP_ENABLED=false` 时,日志调用会立即返回,几乎无性能影响
- 生产环境建议关闭或仅记录 error 级别日志

## 故障排查

### 日志未显示

1. 检查 `.env` 中 `LOGSOP_ENABLED` 是否为 `true`
2. 确认 LogsOP 服务器已启动
3. 检查网络连接和服务器地址配置

### WebSocket 连接失败

**不用担心!** 系统会自动处理:
- WebSocket 连接失败时,会自动回退到 console 输出
- 所有日志都会保留,不会丢失
- 控制台会显示警告信息: `[LogsOP] 连接超时,将使用 console 输出`

如需主动切换:
- 使用 HTTP 传输: `LOGSOP_TRANSPORT="http"` (更稳定但略慢)
- 检查防火墙设置

### 连接行为说明

1. **初始化阶段**: 第一次调用日志方法时触发初始化
2. **队列缓存**: 初始化期间的日志暂存到队列
3. **连接等待**: WebSocket 最多等待 3 秒建立连接
4. **成功**: 发送队列中的所有日志
5. **失败**: 将队列日志输出到 console,后续日志也使用 console

## 扩展使用

### 添加新的日志点

1. 引入 logger 模块
2. 在关键位置调用日志方法
3. 使用合适的日志级别和前缀
4. 对于复杂流程,使用日志片段追踪

### 自定义元数据

所有日志方法都支持传入元数据对象:

```typescript
await logger.info('用户登录', 'auth', {
  userId: user.id,
  userName: user.name,
  ip: req.ip,
  timestamp: Date.now()
});
```

### 自动 JSON 格式日志

当传入 `metadata` 参数时,日志会自动以 JSON 格式发送:

```typescript
// 场景:定时发送间隔日志
await logger.info('定时任务', 'task-interval', {
  index: currentIndex + 1,
  total: totalCount,
  data: {
    count: currentIndex + 1,
    format: 'json'
  }
});  // 有 metadata 参数会自动发送 JSON 格式
```

**JSON 格式日志特点:**

1. **自动触发**: 只要有 `metadata` 参数,就会自动发送 JSON 格式
2. **自动结构化**: 自动将 `message` 和 `metadata` 整合为 JSON 对象
3. **时间戳自动添加**: 自动包含 ISO 8601 格式的时间戳
4. **易于解析**: 在 LogsOP 服务端可以更方便地解析和处理

**格式对比:**

```typescript
// 无 metadata - 发送普通文本
await logger.info('用户访问', 'user');
// 发送: text: "用户访问"

// 有 metadata - 自动发送 JSON 格式
await logger.info('用户访问', 'user', { userId: 123 });
// 发送: text: '{"message":"用户访问","timestamp":"2025-01-06T10:30:00.000Z","userId":123}'
```

**适用场景:**

- 定时任务/循环任务的进度追踪
- 需要携带复杂数据结构的日志
- 需要在服务端进行日志聚合分析的场景
- 与其他系统集成时需要标准化数据格式

## 参考资料

- [LogsOP 客户端文档](file:///Users/Zhuanz/logsOP/packages/client/README.md)
- [LogsOP 快速开始](file:///Users/Zhuanz/logsOP/packages/client/QUICK_START.md)
