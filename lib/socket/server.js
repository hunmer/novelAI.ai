/**
 * Socket.IO服务器端实时协作逻辑
 * 功能：房间管理、在线用户追踪、实时同步事件
 */

const onlineUsers = new Map(); // projectId -> Map<socketId, {userId, userName}>

module.exports = (io) => {
  io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);

    // 加入项目房间
    socket.on('join-project', (data) => {
      const { projectId, userId, userName } = data;
      const roomId = `project:${projectId}`;

      // 加入房间
      socket.join(roomId);

      // 记录在线用户
      if (!onlineUsers.has(projectId)) {
        onlineUsers.set(projectId, new Map());
      }
      onlineUsers.get(projectId).set(socket.id, { userId, userName });

      // 通知房间内所有用户
      io.to(roomId).emit('user-joined', {
        socketId: socket.id,
        userId,
        userName,
        users: Array.from(onlineUsers.get(projectId).values()),
      });

      console.log(`User ${userName} joined project ${projectId}`);
    });

    // 离开项目房间
    socket.on('leave-project', (projectId) => {
      const roomId = `project:${projectId}`;
      socket.leave(roomId);

      if (onlineUsers.has(projectId)) {
        const user = onlineUsers.get(projectId).get(socket.id);
        onlineUsers.get(projectId).delete(socket.id);

        // 通知房间内其他用户
        io.to(roomId).emit('user-left', {
          socketId: socket.id,
          users: Array.from(onlineUsers.get(projectId).values()),
        });

        console.log(`User ${user?.userName || 'unknown'} left project ${projectId}`);
      }
    });

    // 项目更新事件（发送增量数据）
    socket.on('project:update', (data) => {
      const { projectId, module, delta, version, userId } = data;
      const roomId = `project:${projectId}`;

      // 广播给房间内其他用户（不包括发送者）
      socket.to(roomId).emit('project:patch', {
        module,
        delta,
        version,
        userId,
        timestamp: Date.now(),
      });

      console.log(`Project ${projectId} - ${module} updated by user ${userId}`);
    });

    // 断线处理
    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id);

      // 清理在线用户记录
      onlineUsers.forEach((users, projectId) => {
        if (users.has(socket.id)) {
          const user = users.get(socket.id);
          users.delete(socket.id);

          // 通知房间内其他用户
          io.to(`project:${projectId}`).emit('user-left', {
            socketId: socket.id,
            users: Array.from(users.values()),
          });

          console.log(`User ${user.userName} disconnected from project ${projectId}`);
        }
      });
    });
  });
};
