'use client';

import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Users } from 'lucide-react';

export interface OnlineUser {
  userId: string;
  userName: string;
}

interface OnlineUsersProps {
  users: OnlineUser[];
  isConnected: boolean;
}

/**
 * 在线用户显示组件
 * 功能：显示在线用户列表、在线人数徽章、连接状态
 */
export function OnlineUsers({ users, isConnected }: OnlineUsersProps) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Users className="h-4 w-4" />
          <span>在线用户</span>
          <Badge variant="secondary">{users.length}</Badge>
        </div>
        <Badge variant={isConnected ? 'default' : 'destructive'} className="text-xs">
          {isConnected ? '已连接' : '未连接'}
        </Badge>
      </div>

      <div className="space-y-2">
        {users.length === 0 ? (
          <p className="text-sm text-muted-foreground">暂无在线用户</p>
        ) : (
          users.map((user, index) => (
            <div
              key={`${user.userId}-${index}`}
              className="flex items-center gap-2 text-sm"
            >
              <div className="h-2 w-2 rounded-full bg-green-500" />
              <span className="text-muted-foreground">{user.userName}</span>
            </div>
          ))
        )}
      </div>
    </Card>
  );
}
