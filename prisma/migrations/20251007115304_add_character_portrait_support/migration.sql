-- AlterTable
ALTER TABLE "Character" ADD COLUMN "paintingPrompt" TEXT;
ALTER TABLE "Character" ADD COLUMN "portraitImage" TEXT;
ALTER TABLE "Character" ADD COLUMN "portraitThumbnail" TEXT;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_GeneratedImage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT,
    "sceneId" TEXT,
    "characterId" TEXT,
    "prompt" TEXT NOT NULL,
    "modelProvider" TEXT NOT NULL,
    "modelName" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "thumbnailUrl" TEXT,
    "metadata" TEXT NOT NULL DEFAULT '{}',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GeneratedImage_sceneId_fkey" FOREIGN KEY ("sceneId") REFERENCES "Scene" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "GeneratedImage_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_GeneratedImage" ("createdAt", "id", "imageUrl", "metadata", "modelName", "modelProvider", "projectId", "prompt", "sceneId", "thumbnailUrl") SELECT "createdAt", "id", "imageUrl", "metadata", "modelName", "modelProvider", "projectId", "prompt", "sceneId", "thumbnailUrl" FROM "GeneratedImage";
DROP TABLE "GeneratedImage";
ALTER TABLE "new_GeneratedImage" RENAME TO "GeneratedImage";
CREATE INDEX "GeneratedImage_projectId_idx" ON "GeneratedImage"("projectId");
CREATE INDEX "GeneratedImage_sceneId_idx" ON "GeneratedImage"("sceneId");
CREATE INDEX "GeneratedImage_characterId_idx" ON "GeneratedImage"("characterId");
CREATE INDEX "GeneratedImage_createdAt_idx" ON "GeneratedImage"("createdAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
