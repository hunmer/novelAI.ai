-- CreateTable
CREATE TABLE "KnowledgeChatSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT '新对话',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "KnowledgeChatSession_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "KnowledgeChatMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "KnowledgeChatMessage_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "KnowledgeChatSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "KnowledgeChatSession_projectId_idx" ON "KnowledgeChatSession"("projectId");

-- CreateIndex
CREATE INDEX "KnowledgeChatSession_updatedAt_idx" ON "KnowledgeChatSession"("updatedAt");

-- CreateIndex
CREATE INDEX "KnowledgeChatMessage_sessionId_idx" ON "KnowledgeChatMessage"("sessionId");

-- CreateIndex
CREATE INDEX "KnowledgeChatMessage_createdAt_idx" ON "KnowledgeChatMessage"("createdAt");
