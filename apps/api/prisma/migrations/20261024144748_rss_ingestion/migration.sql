-- AlterTable
ALTER TABLE "RssFeed" ADD COLUMN     "etag" TEXT,
ADD COLUMN     "failureCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lastError" TEXT,
ADD COLUMN     "lastItemAt" TIMESTAMP(3),
ADD COLUMN     "lastModified" TEXT,
ADD COLUMN     "origin" TEXT NOT NULL DEFAULT 'user',
ADD COLUMN     "source" TEXT;
