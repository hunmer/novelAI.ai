'use client';

import { useEffect, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

/**
 * Socket客户端单例实例
 * 确保全局只有一个Socket连接
 */
let socket: Socket | null = null;

export interface OnlineUser {
  userId: string;
  userName: string;
}

export interface ProjectPatchEvent {
  module: string;
  delta: any;
  version: number;
  userId: string;
  timestamp: number;
}

/**
 * Socket客户端Hook
 * 功能：自动连接、房间管理、在线用户追踪、事件订阅
 */
export function useSocket(
  projectId?: string,
  userId?: string,
  userName?: string
) {
  const [isConnected, setIsConnected] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);

  useEffect(() => {
    if (!projectId || !userId || !userName) return;

    // 初始化Socket连接（单例模式）
    if (!socket) {
      socket = io({
        path: '/api/socket',
      });

      socket.on('connect', () => {
        console.log('Socket connected:', socket?.id);
        setIsConnected(true);
      });

      socket.on('disconnect', () => {
        console.log('Socket disconnected');
        setIsConnected(false);
      });

      socket.on('connect_error', (error) => {
        console.error('Socket connection error:', error);
        setIsConnected(false);
      });
    }

    // 加入项目房间
    socket.emit('join-project', { projectId, userId, userName });

    // 监听用户加入事件
    const handleUserJoined = (data: {
      socketId: string;
      userId: string;
      userName: string;
      users: OnlineUser[];
    }) => {
      console.log('User joined:', data.userName);
      setOnlineUsers(data.users);
    };

    // 监听用户离开事件
    const handleUserLeft = (data: { socketId: string; users: OnlineUser[] }) => {
      console.log('User left:', data.socketId);
      setOnlineUsers(data.users);
    };

    socket.on('user-joined', handleUserJoined);
    socket.on('user-left', handleUserLeft);

    // 清理函数
    return () => {
      if (socket) {
        socket.emit('leave-project', projectId);
        socket.off('user-joined', handleUserJoined);
        socket.off('user-left', handleUserLeft);
      }
    };
  }, [projectId, userId, userName]);

  /**
   * 发送事件
   */
  const emit = useCallback((event: string, data: any) => {
    if (socket?.connected) {
      socket.emit(event, data);
    } else {
      console.warn('Socket not connected, cannot emit event:', event);
    }
  }, []);

  /**
   * 订阅事件
   */
  const on = useCallback((event: string, handler: (data: any) => void) => {
    socket?.on(event, handler);
  }, []);

  /**
   * 取消订阅事件
   */
  const off = useCallback((event: string, handler?: (data: any) => void) => {
    if (handler) {
      socket?.off(event, handler);
    } else {
      socket?.off(event);
    }
  }, []);

  return {
    isConnected,
    onlineUsers,
    emit,
    on,
    off,
  };
}
