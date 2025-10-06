'use client';

import { useMemo } from 'react';
import { ProjectHeader } from './project-header';
import { useSocket } from '@/lib/socket/client';

interface ProjectHeaderWrapperProps {
  projectId: string;
  projectName: string;
}

/**
 * 项目头部包装组件 - 处理Socket连接和在线用户状态
 */
export function ProjectHeaderWrapper({ projectId, projectName }: ProjectHeaderWrapperProps) {
  // 生成稳定的用户ID
  const userId = useMemo(
    () => 'demo-user-' + Math.random().toString(36).substring(7),
    []
  );

  // Socket.IO实时协作
  const { isConnected, onlineUsers } = useSocket(
    projectId,
    userId,
    '访客用户'
  );

  return (
    <ProjectHeader
      projectName={projectName}
      onlineUsers={onlineUsers}
      isConnected={isConnected}
    />
  );
}
