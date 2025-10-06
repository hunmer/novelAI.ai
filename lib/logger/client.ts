import { LogsClient } from '@logsop/client';

/**
 * LogsOP 客户端实例
 * 用于在应用中统一的日志记录和调试
 */
class Logger {
  private static instance: Logger;
  private client: LogsClient | null = null;
  private enabled: boolean = false;

  private constructor() {
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
        console.log(`[LogsOP] 已连接到 ${server} (传输方式: ${transport})`);
      } catch (error) {
        console.error('[LogsOP] 初始化失败:', error);
      }
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
  async info(text: string, prefix = 'app', metadata?: Record<string, any>) {
    if (!this.enabled || !this.client) return;

    try {
      await this.client.log({
        text,
        prefix,
        level: 'info',
        ...metadata,
      });
    } catch (error) {
      console.error('[LogsOP] 日志记录失败:', error);
    }
  }

  /**
   * 记录警告级别日志
   */
  async warn(text: string, prefix = 'app', metadata?: Record<string, any>) {
    if (!this.enabled || !this.client) return;

    try {
      await this.client.log({
        text,
        prefix,
        level: 'warn',
        ...metadata,
      });
    } catch (error) {
      console.error('[LogsOP] 日志记录失败:', error);
    }
  }

  /**
   * 记录错误级别日志
   */
  async error(text: string, prefix = 'app', metadata?: Record<string, any>) {
    if (!this.enabled || !this.client) return;

    try {
      await this.client.log({
        text,
        prefix,
        level: 'error',
        ...metadata,
      });
    } catch (error) {
      console.error('[LogsOP] 日志记录失败:', error);
    }
  }

  /**
   * 记录调试级别日志
   */
  async debug(text: string, prefix = 'app', metadata?: Record<string, any>) {
    if (!this.enabled || !this.client) return;

    try {
      await this.client.log({
        text,
        prefix,
        level: 'debug',
        ...metadata,
      });
    } catch (error) {
      console.error('[LogsOP] 日志记录失败:', error);
    }
  }

  /**
   * 开始日志片段
   * 用于追踪业务流程
   */
  startSnippet(options: { snippet_id: string; name: string }) {
    if (!this.enabled || !this.client) return null;

    try {
      return this.client.startSnippet(options);
    } catch (error) {
      console.error('[LogsOP] 启动片段失败:', error);
      return null;
    }
  }

  /**
   * 在片段中记录日志
   */
  async logSnippet(text: string, snippet_id: string, prefix = 'app', metadata?: Record<string, any>) {
    if (!this.enabled || !this.client) return;

    try {
      await this.client.log({
        text,
        prefix,
        snippet_id,
        ...metadata,
      });
    } catch (error) {
      console.error('[LogsOP] 片段日志记录失败:', error);
    }
  }

  /**
   * 结束日志片段
   */
  async endSnippet(snippet_id: string) {
    if (!this.enabled || !this.client) return;

    try {
      await this.client.endSnippet({ snippet_id });
    } catch (error) {
      console.error('[LogsOP] 结束片段失败:', error);
    }
  }
}

// 导出单例实例
export const logger = Logger.getInstance();
