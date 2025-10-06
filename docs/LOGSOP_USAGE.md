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

### 2. API 路由 (/app/api/ai/world/route.ts)

- **世界观生成**: 使用日志片段追踪整个生成流程
  - 开始生成
  - 生成完成
  - 生成失败

**日志前缀**: `ai-world`

**日志片段**: 每次世界观生成请求会创建独立的日志片段,便于追踪完整流程。

### 3. Socket.IO 服务 (lib/socket/server.js)

- **客户端连接/断开**: 记录 WebSocket 连接状态
- **用户加入房间**: 记录用户加入项目房间
- **项目更新同步**: 记录实时协作更新事件

**日志前缀**: `socket`

## 在代码中使用日志

### TypeScript/ESM 模块

```typescript
import { logger } from '@/lib/logger/client';

// 基本日志
await logger.info('操作成功', 'prefix', { userId: 123 });
await logger.warn('警告信息', 'prefix');
await logger.error('错误信息', 'prefix', { error: err.message });
await logger.debug('调试信息', 'prefix');

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

// 基本日志
await logger.info('操作成功', 'prefix', { userId: 123 });
await logger.warn('警告信息', 'prefix');
await logger.error('错误信息', 'prefix', { error: err.message });
await logger.debug('调试信息', 'prefix');

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

- 尝试切换为 HTTP 传输: `LOGSOP_TRANSPORT="http"`
- 检查防火墙设置

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

## 参考资料

- [LogsOP 客户端文档](file:///Users/Zhuanz/logsOP/packages/client/README.md)
- [LogsOP 快速开始](file:///Users/Zhuanz/logsOP/packages/client/QUICK_START.md)
