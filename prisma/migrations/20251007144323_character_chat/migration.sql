-- CreateTable
CREATE TABLE "CharacterChatSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "characterId" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT '新对话',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CharacterChatSession_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CharacterChatMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CharacterChatMessage_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "CharacterChatSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "CharacterChatSession_characterId_idx" ON "CharacterChatSession"("characterId");

-- CreateIndex
CREATE INDEX "CharacterChatSession_updatedAt_idx" ON "CharacterChatSession"("updatedAt");

-- CreateIndex
CREATE INDEX "CharacterChatMessage_sessionId_idx" ON "CharacterChatMessage"("sessionId");

-- CreateIndex
CREATE INDEX "CharacterChatMessage_createdAt_idx" ON "CharacterChatMessage"("createdAt");
