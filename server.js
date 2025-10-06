const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const { Server } = require('socket.io');
const { logger } = require('./lib/logger/server');

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = parseInt(process.env.PORT || '3000', 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(async () => {
  await logger.info('Next.js 应用准备完成', 'server');

  const httpServer = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);

      // 记录请求
      // await logger.debug(`${req.method} ${req.url}`, 'http', {
      //   method: req.method,
      //   url: req.url,
      //   headers: req.headers,
      // });

      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error:', err);
      await logger.error(`请求处理错误: ${err.message}`, 'http', {
        error: err.stack,
        url: req.url,
      });
      res.statusCode = 500;
      res.end('Internal Server Error');
    }
  });

  const io = new Server(httpServer, {
    path: '/api/socket',
    cors: {
      origin: dev ? 'http://localhost:3000' : process.env.NEXT_PUBLIC_URL,
      methods: ['GET', 'POST'],
    },
  });

  require('./lib/socket/server')(io);

  httpServer.listen(port, async () => {
    console.log(`> Ready on http://${hostname}:${port}`);
    await logger.info(`服务器启动成功`, 'server', {
      hostname,
      port,
      environment: dev ? 'development' : 'production',
    });
  });
});
