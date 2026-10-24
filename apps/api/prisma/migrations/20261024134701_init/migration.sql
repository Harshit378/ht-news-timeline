-- CreateTable
CREATE TABLE "Article" (
    "id" TEXT NOT NULL,
    "headline" TEXT NOT NULL,
    "excerpt" TEXT NOT NULL,
    "body" TEXT,
    "source" TEXT NOT NULL,
    "sourceDomain" TEXT,
    "url" TEXT,
    "category" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3) NOT NULL,
    "imageUrl" TEXT,
    "sentiment" TEXT,
    "bias" TEXT,
    "importance" TEXT NOT NULL DEFAULT 'normal',
    "storyClusterId" TEXT,
    "tone" DOUBLE PRECISION,
    "inFeed" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Article_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Story" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "category" TEXT,
    "firstSeen" TIMESTAMP(3),
    "lastSeen" TIMESTAMP(3),
    "lastFetchedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Story_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoryArticle" (
    "storyId" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StoryArticle_pkey" PRIMARY KEY ("storyId","articleId")
);

-- CreateTable
CREATE TABLE "Bookmark" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL DEFAULT 'local',
    "articleId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Bookmark_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LiveEvent" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "lastUpdated" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LiveEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventUpdate" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "message" TEXT NOT NULL,
    "importance" TEXT NOT NULL DEFAULT 'normal',
    "sources" TEXT[] DEFAULT ARRAY[]::TEXT[],

    CONSTRAINT "EventUpdate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TopicSummary" (
    "id" TEXT NOT NULL,
    "topicName" TEXT NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "summary" TEXT NOT NULL,
    "keyPoints" TEXT[],
    "sentiment" TEXT NOT NULL,
    "articleCount" INTEGER NOT NULL,
    "sourceCount" INTEGER NOT NULL,
    "relatedTopics" TEXT[],
    "trend" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "TopicSummary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RssFeed" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastChecked" TIMESTAMP(3),
    "itemCount" INTEGER NOT NULL DEFAULT 0,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RssFeed_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Article_url_key" ON "Article"("url");

-- CreateIndex
CREATE INDEX "Article_category_publishedAt_idx" ON "Article"("category", "publishedAt" DESC);

-- CreateIndex
CREATE INDEX "Article_inFeed_publishedAt_idx" ON "Article"("inFeed", "publishedAt" DESC);

-- CreateIndex
CREATE INDEX "Article_storyClusterId_idx" ON "Article"("storyClusterId");

-- CreateIndex
CREATE UNIQUE INDEX "Story_key_key" ON "Story"("key");

-- CreateIndex
CREATE INDEX "StoryArticle_articleId_idx" ON "StoryArticle"("articleId");

-- CreateIndex
CREATE UNIQUE INDEX "Bookmark_userId_articleId_key" ON "Bookmark"("userId", "articleId");

-- CreateIndex
CREATE UNIQUE INDEX "LiveEvent_slug_key" ON "LiveEvent"("slug");

-- CreateIndex
CREATE INDEX "EventUpdate_eventId_timestamp_idx" ON "EventUpdate"("eventId", "timestamp" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "TopicSummary_topicName_key" ON "TopicSummary"("topicName");

-- CreateIndex
CREATE UNIQUE INDEX "RssFeed_url_key" ON "RssFeed"("url");

-- AddForeignKey
ALTER TABLE "StoryArticle" ADD CONSTRAINT "StoryArticle_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "Story"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoryArticle" ADD CONSTRAINT "StoryArticle_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bookmark" ADD CONSTRAINT "Bookmark_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventUpdate" ADD CONSTRAINT "EventUpdate_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "LiveEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
