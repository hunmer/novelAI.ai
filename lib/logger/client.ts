import { LogsClient } from '@logsop/client';

/**
 * LogsOP 客户端实例
 * 用于在应用中统一的日志记录和调试
 */
class Logger {
  private static instance: Logger;
  private client: LogsClient | null = null;
  private enabled: boolean = false;
  private initialized: boolean = false;
  private initializing: boolean = false;
  private connected: boolean = false;
  private queue: Array<{ level: string; message: string; data?: Record<string, unknown> }> = []; // 初始化前的日志队列

  private constructor() {
    // 延迟初始化,等待环境变量加载
  }

  /**
   * 延迟初始化 - 在环境变量加载后调用
   */
  private async init() {
    if (this.initialized || this.initializing) return;
    this.initializing = true;

    // 从环境变量读取配置
    const server = process.env.LOGSOP_SERVER || 'http://localhost:8832';
    const transport = (process.env.LOGSOP_TRANSPORT || 'websocket') as 'http' | 'websocket';
    this.enabled = process.env.LOGSOP_ENABLED === 'true';

    if (this.enabled) {
      try {
        this.client = new LogsClient({
          server,
          transport,
        });

        // 如果是 WebSocket 传输,等待连接建立
        if (transport === 'websocket') {
          await new Promise<void>((resolve) => {
            const checkConnection = setInterval(() => {
              if (this.client?.transport?.connected) {
                this.connected = true;
                clearInterval(checkConnection);
                resolve();
              }
            }, 100);

            // 最多等待 3 秒
            setTimeout(() => {
              clearInterval(checkConnection);
              resolve();
            }, 3000);
          });
        } else {
          this.connected = true;
        }

        if (this.connected) {
          console.log(`[LogsOP] 已连接到 ${server} (传输方式: ${transport})`);

          // 发送队列中的日志
          await this.flushQueue();
        } else {
          console.warn(`[LogsOP] 连接超时,将使用 console 输出`);
          this.enabled = false;
          this.flushQueueToConsole();
        }
      } catch {
        console.warn(`[LogsOP] 初始化失败,将使用 console 输出:`, (error as Error).message);
        this.enabled = false;
        this.flushQueueToConsole();
      }
    }

    this.initialized = true;
    this.initializing = false;
  }

  /**
   * 发送队列中的日志到 LogsOP
   */
  private async flushQueue() {
    while (this.queue.length > 0) {
      const item = this.queue.shift();
      try {
        await this.client!.log(item);
      } catch {
        this.logToConsole(item);
      }
    }
  }

  /**
   * 将队列中的日志输出到 console
   */
  private flushQueueToConsole() {
    while (this.queue.length > 0) {
      const item = this.queue.shift();
      this.logToConsole(item);
    }
  }

  /**
   * 输出到标准 console
   */
  private logToConsole(item: { level: string; prefix: string; text: string }) {
    const { level, prefix, text } = item;
    const message = `[${prefix}] ${text}`;

    switch (level) {
      case 'error':
        console.error(message);
        break;
      case 'warn':
        console.warn(message);
        break;
      case 'debug':
        console.debug(message);
        break;
      default:
        console.log(message);
    }
  }

  public static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  /**
   * 记录信息级别日志
   */
  async info(text: string, prefix = 'app', metadata?: Record<string, unknown>) {
    let logData;

    if (metadata && Object.keys(metadata).length > 0) {
      // 有 metadata 时发送 JSON 格式
      logData = {
        prefix,
        level: 'info' as const,
        text: JSON.stringify({
          message: text,
          timestamp: new Date().toISOString(),
          ...metadata
        })
      };
    } else {
      // 无 metadata 时发送普通文本
      logData = { text, prefix, level: 'info' as const };
    }

    // 如果未初始化,先加入队列
    if (!this.initialized) {
      this.queue.push(logData);
      this.init(); // 触发初始化(异步,不等待)
      return;
    }

    // 如果已禁用,输出到 console
    if (!this.enabled || !this.client || !this.connected) {
      this.logToConsole(logData);
      return;
    }

    try {
      await this.client.log(logData);
    } catch {
      this.logToConsole(logData);
    }
  }

  /**
   * 记录警告级别日志
   */
  async warn(text: string, prefix = 'app', metadata?: Record<string, unknown>) {
    let logData;

    if (metadata && Object.keys(metadata).length > 0) {
      // 有 metadata 时发送 JSON 格式
      logData = {
        prefix,
        level: 'warn' as const,
        text: JSON.stringify({
          message: text,
          timestamp: new Date().toISOString(),
          ...metadata
        })
      };
    } else {
      // 无 metadata 时发送普通文本
      logData = { text, prefix, level: 'warn' as const };
    }

    if (!this.initialized) {
      this.queue.push(logData);
      this.init();
      return;
    }

    if (!this.enabled || !this.client || !this.connected) {
      this.logToConsole(logData);
      return;
    }

    try {
      await this.client.log(logData);
    } catch {
      this.logToConsole(logData);
    }
  }

  /**
   * 记录错误级别日志
   */
  async error(text: string, prefix = 'app', metadata?: Record<string, unknown>) {
    let logData;

    if (metadata && Object.keys(metadata).length > 0) {
      // 有 metadata 时发送 JSON 格式
      logData = {
        prefix,
        level: 'error' as const,
        text: JSON.stringify({
          message: text,
          timestamp: new Date().toISOString(),
          ...metadata
        })
      };
    } else {
      // 无 metadata 时发送普通文本
      logData = { text, prefix, level: 'error' as const };
    }

    if (!this.initialized) {
      this.queue.push(logData);
      this.init();
      return;
    }

    if (!this.enabled || !this.client || !this.connected) {
      this.logToConsole(logData);
      return;
    }

    try {
      await this.client.log(logData);
    } catch {
      this.logToConsole(logData);
    }
  }

  /**
   * 记录调试级别日志
   */
  async debug(text: string, prefix = 'app', metadata?: Record<string, unknown>) {
    let logData;

    if (metadata && Object.keys(metadata).length > 0) {
      // 有 metadata 时发送 JSON 格式
      logData = {
        prefix,
        level: 'debug' as const,
        text: JSON.stringify({
          message: text,
          timestamp: new Date().toISOString(),
          ...metadata
        })
      };
    } else {
      // 无 metadata 时发送普通文本
      logData = { text, prefix, level: 'debug' as const };
    }

    if (!this.initialized) {
      this.queue.push(logData);
      this.init();
      return;
    }

    if (!this.enabled || !this.client || !this.connected) {
      this.logToConsole(logData);
      return;
    }

    try {
      await this.client.log(logData);
    } catch {
      this.logToConsole(logData);
    }
  }

  /**
   * 开始日志片段
   * 用于追踪业务流程
   */
  startSnippet(options: { snippet_id: string; name: string }) {
    // 片段功能仅在连接成功时可用
    if (!this.initialized || !this.enabled || !this.client || !this.connected) {
      return null;
    }

    try {
      return this.client.startSnippet(options);
    } catch {
      return null;
    }
  }

  /**
   * 在片段中记录日志
   */
  async logSnippet(text: string, snippet_id: string, prefix = 'app', metadata?: Record<string, unknown>) {
    const logData = { text, prefix, snippet_id, ...metadata };

    if (!this.initialized || !this.enabled || !this.client || !this.connected) {
      this.logToConsole(logData);
      return;
    }

    try {
      await this.client.log(logData);
    } catch {
      this.logToConsole(logData);
    }
  }

  /**
   * 结束日志片段
   */
  async endSnippet(snippet_id: string) {
    if (!this.initialized || !this.enabled || !this.client || !this.connected) {
      return;
    }

    try {
      await this.client.endSnippet({ snippet_id });
    } catch {
      // 忽略片段结束错误
    }
  }
}

// 导出单例实例
export const logger = Logger.getInstance();
