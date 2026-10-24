-- AlterTable
ALTER TABLE "TopicSummary" ADD COLUMN     "inputHash" TEXT,
ADD COLUMN     "kind" TEXT NOT NULL DEFAULT 'topic',
ADD COLUMN     "model" TEXT;
