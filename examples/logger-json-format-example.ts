/**
 * LogsOP JSON 格式日志使用示例
 *
 * 这个文件展示了如何使用 logger 的 JSON 格式功能
 */

import { logger } from '@/lib/logger/client';

/**
 * 示例 1: 基本 JSON 格式日志
 */
async function basicJsonLogExample() {
  // 有 metadata 时自动发送 JSON 格式
  await logger.info('用户操作', 'user-action', {
    userId: 'user123',
    action: 'click',
    target: 'button'
  });

  // 发送的内容:
  // {
  //   "message": "用户操作",
  //   "timestamp": "2025-01-06T10:30:00.000Z",
  //   "userId": "user123",
  //   "action": "click",
  //   "target": "button"
  // }
}

/**
 * 示例 2: 定时任务进度追踪
 */
async function intervalTaskExample() {
  const totalCount = 10;

  for (let i = 0; i < totalCount; i++) {
    // 有 metadata 时自动发送 JSON 格式
    await logger.info('定时任务执行', 'cron-interval', {
      index: i + 1,
      total: totalCount,
      progress: ((i + 1) / totalCount * 100).toFixed(2) + '%',
      data: {
        count: i + 1,
        format: 'json'
      }
    });

    // 模拟任务执行
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
}

/**
 * 示例 3: 错误日志记录
 */
async function errorLogExample() {
  try {
    // 模拟错误
    throw new Error('数据库连接失败');
  } catch (error) {
    // 有 metadata 时自动发送 JSON 格式
    await logger.error('操作失败', 'db-error', {
      errorMessage: (error as Error).message,
      errorStack: (error as Error).stack,
      retryCount: 3,
      timestamp: Date.now()
    });
  }
}

/**
 * 示例 4: API 请求日志
 */
async function apiRequestLogExample() {
  const requestData = {
    method: 'POST',
    url: '/api/users',
    requestId: 'req-12345',
    duration: 125,  // ms
    statusCode: 200,
    responseSize: 1024  // bytes
  };

  // 有 metadata 时自动发送 JSON 格式
  await logger.info('API 请求完成', 'api-request', requestData);
}

/**
 * 示例 5: 对比普通格式和 JSON 格式
 */
async function comparisonExample() {
  const metadata = {
    userId: 'user123',
    action: 'login',
    ip: '192.168.1.1'
  };

  // 无 metadata - 发送普通文本
  await logger.info('用户登录', 'auth');

  // 有 metadata - 自动发送 JSON 格式
  await logger.info('用户登录', 'auth', metadata);
}

// 运行示例
async function runExamples() {
  console.log('=== LogsOP JSON 格式日志示例 ===\n');

  console.log('1. 基本 JSON 格式日志');
  await basicJsonLogExample();
  console.log('✓ 完成\n');

  console.log('2. 定时任务进度追踪');
  await intervalTaskExample();
  console.log('✓ 完成\n');

  console.log('3. 错误日志记录');
  await errorLogExample();
  console.log('✓ 完成\n');

  console.log('4. API 请求日志');
  await apiRequestLogExample();
  console.log('✓ 完成\n');

  console.log('5. 格式对比示例');
  await comparisonExample();
  console.log('✓ 完成\n');

  console.log('=== 所有示例执行完成 ===');
}

// 如果直接运行此文件
if (require.main === module) {
  runExamples().catch(console.error);
}

export {
  basicJsonLogExample,
  intervalTaskExample,
  errorLogExample,
  apiRequestLogExample,
  comparisonExample
};
