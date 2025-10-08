'use client';

import Image from 'next/image';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  ChatBubble,
  ChatBubbleAvatar,
  ChatBubbleMessage,
  ChatBubbleAction,
  ChatBubbleActionWrapper,
  ChatBubbleTimestamp,
} from '@/components/ui/chat/chat-bubble';
import { ChatInput } from '@/components/ui/chat/chat-input';
import { ChatMessageList } from '@/components/ui/chat/chat-message-list';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { Copy, History, Loader2, MessageCircle, Pencil, Plus, Trash2 } from 'lucide-react';

interface CharacterSummary {
  id: string;
  name: string;
  portraitImage?: string | null;
  portraitThumbnail?: string | null;
}

interface ChatSession {
  id: string;
  characterId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

interface ChatMessage {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
  pending?: boolean;
}

interface ApiMessage {
  id: string;
  sessionId: string;
  role: string;
  content: string;
  createdAt: string;
}

interface CharacterChatTabProps {
  projectId: string;
}

export function CharacterChatTab({ projectId }: CharacterChatTabProps) {
  const [characters, setCharacters] = useState<CharacterSummary[]>([]);
  const [selectedCharacterId, setSelectedCharacterId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  const [inputValue, setInputValue] = useState('');
  const [charactersLoading, setCharactersLoading] = useState(false);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [creatingSession, setCreatingSession] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [contextLimit, setContextLimit] = useState(20);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [activeMessageId, setActiveMessageId] = useState<string | null>(null);
  const chatInputRef = useRef<HTMLTextAreaElement | null>(null);

  const selectedCharacter = useMemo(
    () => characters.find((item) => item.id === selectedCharacterId) ?? null,
    [characters, selectedCharacterId]
  );

  const selectedSession = useMemo(
    () => sessions.find((item) => item.id === selectedSessionId) ?? null,
    [sessions, selectedSessionId]
  );

  const loadCharacters = useCallback(async () => {
    setCharactersLoading(true);
    try {
      const response = await fetch(`/api/characters?projectId=${projectId}`);
      if (!response.ok) {
        throw new Error('获取角色失败');
      }
      const data = await response.json();
      const list: CharacterSummary[] = data.characters ?? [];
      setCharacters(list);
      setSelectedCharacterId((prev) => {
        if (prev && list.some((character) => character.id === prev)) {
          return prev;
        }
        return list.length ? list[0].id : null;
      });
    } catch (error) {
      console.error('加载角色列表失败:', error);
      setCharacters([]);
      setSelectedCharacterId(null);
    } finally {
      setCharactersLoading(false);
    }
  }, [projectId]);

  const fetchSessions = useCallback(
    async (characterId: string, preferSessionId?: string | null) => {
      setSessionsLoading(true);
      try {
        const response = await fetch(`/api/character-chat/sessions?characterId=${characterId}`);
        if (!response.ok) {
          throw new Error('获取会话失败');
        }
        const data = await response.json();
        const list: ChatSession[] = data.sessions ?? [];
        setSessions(list);
        setSelectedSessionId((prev) => {
          if (preferSessionId && list.some((session) => session.id === preferSessionId)) {
            return preferSessionId;
          }
          if (prev && list.some((session) => session.id === prev)) {
            return prev;
          }
          return list.length ? list[0].id : null;
        });
      } catch (error) {
        console.error('加载会话失败:', error);
        setSessions([]);
        setSelectedSessionId(null);
      } finally {
        setSessionsLoading(false);
      }
    },
    [],
  );

  const fetchMessages = useCallback(async (sessionId: string) => {
    setMessagesLoading(true);
    try {
      const response = await fetch(`/api/character-chat/sessions/${sessionId}/messages`);
      if (!response.ok) {
        throw new Error('获取聊天记录失败');
      }
      const data = await response.json();
      const list: ApiMessage[] = data.messages ?? [];
      setMessages(list.map(normalizeMessage));
    } catch (error) {
      console.error('加载聊天记录失败:', error);
      setMessages([]);
    } finally {
      setMessagesLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCharacters();
  }, [loadCharacters]);

  useEffect(() => {
    if (!selectedCharacterId) {
      setSessions([]);
      setSelectedSessionId(null);
      setMessages([]);
      return;
    }
    fetchSessions(selectedCharacterId);
  }, [selectedCharacterId, fetchSessions]);

  useEffect(() => {
    if (!selectedSessionId) {
      setMessages([]);
      return;
    }
    fetchMessages(selectedSessionId);
  }, [selectedSessionId, fetchMessages]);

  const handleSelectCharacter = useCallback(
    (characterId: string) => {
      if (characterId === selectedCharacterId) return;
      setSelectedCharacterId(characterId);
    },
    [selectedCharacterId],
  );

  const handleSelectSession = useCallback(
    (sessionId: string) => {
      if (sessionId === selectedSessionId) return;
      setSelectedSessionId(sessionId);
    },
    [selectedSessionId],
  );

  const handleCreateSession = useCallback(async () => {
    if (!selectedCharacterId) return;

    setCreatingSession(true);
    try {
      const response = await fetch('/api/character-chat/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ characterId: selectedCharacterId }),
      });

      if (!response.ok) {
        throw new Error('创建会话失败');
      }

      const data = await response.json();
      const session: ChatSession = data.session;
      setSessions((prev) => [session, ...prev]);
      setSelectedSessionId(session.id);
      setMessages([]);
    } catch (error) {
      console.error('创建会话失败:', error);
    } finally {
      setCreatingSession(false);
    }
  }, [selectedCharacterId]);

  const handleSend = useCallback(async () => {
    if (!selectedSessionId || !inputValue.trim() || sendingMessage) return;

    const content = inputValue.trim();
    setInputValue('');

    const userPlaceholder: ChatMessage = {
      id: `temp-user-${Date.now()}`,
      sessionId: selectedSessionId,
      role: 'user',
      content,
      createdAt: new Date().toISOString(),
      pending: true,
    };

    const assistantPlaceholder: ChatMessage = {
      id: `temp-assistant-${Date.now()}`,
      sessionId: selectedSessionId,
      role: 'assistant',
      content: '',
      createdAt: new Date().toISOString(),
      pending: true,
    };

    setMessages((prev) => [...prev, userPlaceholder, assistantPlaceholder]);
    setSendingMessage(true);

    try {
      const response = await fetch(`/api/character-chat/sessions/${selectedSessionId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, contextLimit }),
      });

      if (!response.ok) {
        throw new Error('发送消息失败');
      }

      const data = await response.json();
      const userMessage = normalizeMessage(data.userMessage as ApiMessage);
      const assistantMessage = normalizeMessage(data.assistantMessage as ApiMessage);

      setMessages((prev) =>
        prev
          .filter((message) => message.id !== userPlaceholder.id && message.id !== assistantPlaceholder.id)
          .concat(userMessage, assistantMessage)
      );

      if (selectedCharacterId) {
        fetchSessions(selectedCharacterId, selectedSessionId);
      }
    } catch (error) {
      console.error('发送聊天消息失败:', error);
      setMessages((prev) =>
        prev.filter((message) => message.id !== userPlaceholder.id && message.id !== assistantPlaceholder.id)
      );
      setInputValue(content);
    } finally {
      setSendingMessage(false);
    }
  }, [
    selectedSessionId,
    inputValue,
    sendingMessage,
    selectedCharacterId,
    contextLimit,
    fetchSessions,
  ]);

  const handleCopyMessage = useCallback(async (message: ChatMessage) => {
    try {
      await navigator.clipboard.writeText(message.content);
    } catch (error) {
      console.error('复制聊天消息失败:', error);
    }
  }, []);

  const handleEditMessage = useCallback(
    (message: ChatMessage) => {
      setInputValue(message.content);
      requestAnimationFrame(() => {
        chatInputRef.current?.focus();
      });
    },
    [],
  );

  const handleDeleteMessage = useCallback((message: ChatMessage) => {
    setMessages((prev) => prev.filter((item) => item.id !== message.id));
  }, []);

  useEffect(() => {
    if (activeMessageId && !messages.some((item) => item.id === activeMessageId)) {
      setActiveMessageId(null);
    }
  }, [activeMessageId, messages]);

  const renderChatArea = () => {
    if (!selectedCharacter) {
      return (
        <Card className="flex h-full items-center justify-center border-dashed text-muted-foreground">
          请选择角色以开始对话
        </Card>
      );
    }

    const hasActiveSession = Boolean(selectedSessionId);

    return (
      <Card className="flex h-full flex-col overflow-hidden">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div>
            <div className="flex items-center gap-2 text-base font-semibold">
              <MessageCircle className="h-4 w-4 text-primary" />
              {selectedSession?.title || selectedCharacter.name}
            </div>
            <div className="text-xs text-muted-foreground">
              {hasActiveSession && selectedSession ? formatDateTime(selectedSession.updatedAt) : ''}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={handleCreateSession}
              disabled={creatingSession}
            >
              {creatingSession ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
              新建对话
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="secondary" disabled={sessionsLoading || !sessions.length}>
                  {sessionsLoading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <History className="mr-2 h-4 w-4" />
                  )}
                  历史对话
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                {sessions.length ? (
                  sessions.map((session) => (
                    <DropdownMenuItem
                      key={session.id}
                      onSelect={() => handleSelectSession(session.id)}
                      className={cn('flex flex-col items-start gap-1', {
                        'bg-accent text-accent-foreground': session.id === selectedSessionId,
                      })}
                    >
                      <span className="text-sm font-medium line-clamp-1">{session.title}</span>
                      <span className="text-xs text-muted-foreground">
                        {formatDateTime(session.updatedAt)}
                      </span>
                    </DropdownMenuItem>
                  ))
                ) : (
                  <DropdownMenuItem disabled className="text-muted-foreground">
                    暂无历史记录
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div className="flex-1 overflow-hidden bg-muted/10">
          {hasActiveSession ? (
            messagesLoading ? (
              <div className="flex h-full items-center justify-center text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                正在加载聊天记录...
              </div>
            ) : messages.length ? (
              <ChatMessageList smooth className="h-full">
                {messages.map((message) => (
                  <ChatBubble
                    key={message.id}
                    variant={message.role === 'user' ? 'sent' : 'received'}
                    onMouseEnter={() => setActiveMessageId(message.id)}
                    onMouseLeave={() =>
                      setActiveMessageId((current) => (current === message.id ? null : current))
                    }
                    onFocusCapture={() => setActiveMessageId(message.id)}
                    onBlurCapture={() =>
                      setActiveMessageId((current) => (current === message.id ? null : current))
                    }
                  >
                    <ChatBubbleAvatar
                      src={message.role === 'assistant' ? selectedCharacter.portraitThumbnail || selectedCharacter.portraitImage : undefined}
                      fallback={message.role === 'assistant' ? (selectedCharacter.name?.[0] ?? '角') : '我'}
                    />
                    <ChatBubbleMessage
                      variant={message.role === 'user' ? 'sent' : 'received'}
                      isLoading={Boolean(message.pending && message.role === 'assistant')}
                    >
                      {message.content}
                    </ChatBubbleMessage>
                    {!message.pending && (
                      <ChatBubbleActionWrapper
                        data-visible={activeMessageId === message.id}
                      >
                        <ChatBubbleAction
                          icon={<Copy className="h-4 w-4" />}
                          aria-label="复制消息"
                          onClick={() => handleCopyMessage(message)}
                          onFocus={() => setActiveMessageId(message.id)}
                          onBlur={() =>
                            setActiveMessageId((current) => (current === message.id ? null : current))
                          }
                        />
                        <ChatBubbleAction
                          icon={<Pencil className="h-4 w-4" />}
                          aria-label="编辑消息"
                          onClick={() => handleEditMessage(message)}
                          onFocus={() => setActiveMessageId(message.id)}
                          onBlur={() =>
                            setActiveMessageId((current) => (current === message.id ? null : current))
                          }
                        />
                        <ChatBubbleAction
                          icon={<Trash2 className="h-4 w-4" />}
                          aria-label="删除消息"
                          onClick={() => handleDeleteMessage(message)}
                          onFocus={() => setActiveMessageId(message.id)}
                          onBlur={() =>
                            setActiveMessageId((current) => (current === message.id ? null : current))
                          }
                        />
                      </ChatBubbleActionWrapper>
                    )}
                    {!message.pending && (
                      <ChatBubbleTimestamp timestamp={formatTime(message.createdAt)} />
                    )}
                  </ChatBubble>
                ))}
              </ChatMessageList>
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
                <MessageCircle className="h-12 w-12" />
                <p>还没有对话，先向角色说点什么吧。</p>
              </div>
            )
          ) : (
            <div className="flex h-full items-center justify-center px-6 text-center text-sm text-muted-foreground">
              当前角色没有聊天记录，点击右上角“新建对话”开始交流
            </div>
          )}
        </div>

        {hasActiveSession ? (
          <>
            <Separator />

            <div className="px-4 py-3">
              <div className="rounded-lg border bg-background p-3">
                <ChatInput
                  value={inputValue}
                  onChange={(event) => setInputValue(event.target.value)}
                  ref={chatInputRef}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && !event.shiftKey) {
                      event.preventDefault();
                      handleSend();
                    }
                  }}
                  disabled={sendingMessage}
                  placeholder={`以${selectedCharacter.name}的身份继续对话...`}
                />
                <div className="mt-3 flex items-center justify-end">
                  <Button onClick={handleSend} disabled={sendingMessage || !inputValue.trim()}>
                    {sendingMessage ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    发送
                  </Button>
                </div>
              </div>
            </div>
          </>
        ) : null}
      </Card>
    );
  };

  return (
    <div className="grid h-[calc(100vh-220px)] grid-cols-[280px_1fr] gap-6 max-lg:grid-cols-1">
      <div className="flex flex-col gap-4 overflow-hidden">
        <Card className="flex-1 overflow-y-auto p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-medium">角色</span>
            {charactersLoading ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : null}
          </div>
          <div className="flex flex-col gap-2">
            {characters.length === 0 && !charactersLoading ? (
              <div className="py-10 text-center text-sm text-muted-foreground">暂无角色，请先在“角色”标签页创建角色</div>
            ) : null}
            {characters.map((character) => (
              <button
                key={character.id}
                type="button"
                onClick={() => handleSelectCharacter(character.id)}
                className={cn(
                  'flex items-center gap-3 rounded-lg border px-3 py-2 text-left transition-colors',
                  selectedCharacterId === character.id
                    ? 'border-primary bg-primary/5'
                    : 'hover:border-primary/40'
                )}
              >
                <div className="relative h-10 w-10 overflow-hidden rounded-full bg-secondary">
                  {character.portraitThumbnail || character.portraitImage ? (
                    <Image
                      src={character.portraitThumbnail || character.portraitImage || ''}
                      alt={`${character.name ?? '角色'}头像`}
                      fill
                      className="object-cover"
                    />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center text-sm font-semibold text-secondary-foreground">
                      {character.name?.slice(0, 2) ?? '角色'}
                    </span>
                  )}
                </div>
                <div className="flex-1">
                  <div className="text-sm font-medium line-clamp-1">{character.name}</div>
                  <div className="text-xs text-muted-foreground">点击查看对话</div>
                </div>
              </button>
            ))}
          </div>
          <div className="mt-4">
            <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
              <DialogTrigger asChild>
                <Button type="button" variant="outline" className="w-full">
                  设置
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>聊天上下文设置</DialogTitle>
                  <DialogDescription>控制每次请求发送到模型的历史消息数量。</DialogDescription>
                </DialogHeader>
                <div className="flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="context-limit" className="text-sm font-medium">
                      最大上下文消息数
                    </Label>
                    <span className="text-sm text-muted-foreground">{contextLimit}</span>
                  </div>
                  <input
                    id="context-limit"
                    type="range"
                    min={1}
                    max={50}
                    step={1}
                    value={contextLimit}
                    onChange={(event) => setContextLimit(Number(event.target.value) || 1)}
                    className="w-full"
                  />
                  <p className="text-xs text-muted-foreground">
                    从最近的消息开始向上读取，最多保留上述数量的消息进入模型上下文。
                  </p>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </Card>
      </div>

      <div className="flex h-full flex-col">{renderChatArea()}</div>
    </div>
  );
}

function normalizeMessage(message: ApiMessage): ChatMessage {
  return {
    id: message.id,
    sessionId: message.sessionId,
    role: message.role === 'assistant' ? 'assistant' : 'user',
    content: message.content,
    createdAt: message.createdAt,
  };
}

function formatDateTime(value: string) {
  try {
    return new Date(value).toLocaleString('zh-CN', {
      hour12: false,
    });
  } catch (_error) {
    return value;
  }
}

function formatTime(value: string) {
  try {
    return new Date(value).toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  } catch (_error) {
    return value;
  }
}
