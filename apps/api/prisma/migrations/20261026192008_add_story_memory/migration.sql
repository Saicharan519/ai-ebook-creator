-- CreateEnum
CREATE TYPE "EntityKind" AS ENUM ('character', 'place', 'item', 'group');

-- CreateEnum
CREATE TYPE "MemorySource" AS ENUM ('ai', 'author');

-- CreateEnum
CREATE TYPE "WarningStatus" AS ENUM ('open', 'dismissed');

-- AlterEnum
ALTER TYPE "AiKind" ADD VALUE 'memory';

-- AlterTable
ALTER TABLE "chapters" ADD COLUMN     "memory_hash" TEXT,
ADD COLUMN     "summary" TEXT NOT NULL DEFAULT '';

-- CreateTable
CREATE TABLE "chunks" (
    "id" UUID NOT NULL,
    "book_id" UUID NOT NULL,
    "chapter_id" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "embedding" vector(768) NOT NULL,

    CONSTRAINT "chunks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "entities" (
    "id" UUID NOT NULL,
    "book_id" UUID NOT NULL,
    "kind" "EntityKind" NOT NULL,
    "name" TEXT NOT NULL,
    "aliases" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "description" TEXT NOT NULL DEFAULT '',
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "source" "MemorySource" NOT NULL DEFAULT 'ai',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "entities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "facts" (
    "id" UUID NOT NULL,
    "entity_id" UUID NOT NULL,
    "chapter_id" UUID,
    "attribute" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "source" "MemorySource" NOT NULL DEFAULT 'ai',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "facts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mentions" (
    "entity_id" UUID NOT NULL,
    "chapter_id" UUID NOT NULL,
    "excerpt" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "mentions_pkey" PRIMARY KEY ("entity_id","chapter_id")
);

-- CreateTable
CREATE TABLE "consistency_warnings" (
    "id" UUID NOT NULL,
    "book_id" UUID NOT NULL,
    "fact_id" UUID NOT NULL,
    "conflicting_fact_id" UUID NOT NULL,
    "explanation" TEXT NOT NULL,
    "status" "WarningStatus" NOT NULL DEFAULT 'open',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "consistency_warnings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "chunks_book_id_idx" ON "chunks"("book_id");

-- CreateIndex
CREATE INDEX "chunks_chapter_id_idx" ON "chunks"("chapter_id");

-- CreateIndex
CREATE INDEX "entities_book_id_idx" ON "entities"("book_id");

-- CreateIndex
CREATE INDEX "facts_entity_id_attribute_idx" ON "facts"("entity_id", "attribute");

-- CreateIndex
CREATE INDEX "facts_chapter_id_idx" ON "facts"("chapter_id");

-- CreateIndex
CREATE INDEX "mentions_chapter_id_idx" ON "mentions"("chapter_id");

-- CreateIndex
CREATE INDEX "consistency_warnings_book_id_status_idx" ON "consistency_warnings"("book_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "consistency_warnings_fact_id_conflicting_fact_id_key" ON "consistency_warnings"("fact_id", "conflicting_fact_id");

-- AddForeignKey
ALTER TABLE "chunks" ADD CONSTRAINT "chunks_chapter_id_fkey" FOREIGN KEY ("chapter_id") REFERENCES "chapters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entities" ADD CONSTRAINT "entities_book_id_fkey" FOREIGN KEY ("book_id") REFERENCES "books"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "facts" ADD CONSTRAINT "facts_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "entities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "facts" ADD CONSTRAINT "facts_chapter_id_fkey" FOREIGN KEY ("chapter_id") REFERENCES "chapters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mentions" ADD CONSTRAINT "mentions_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "entities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mentions" ADD CONSTRAINT "mentions_chapter_id_fkey" FOREIGN KEY ("chapter_id") REFERENCES "chapters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consistency_warnings" ADD CONSTRAINT "consistency_warnings_book_id_fkey" FOREIGN KEY ("book_id") REFERENCES "books"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consistency_warnings" ADD CONSTRAINT "consistency_warnings_fact_id_fkey" FOREIGN KEY ("fact_id") REFERENCES "facts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consistency_warnings" ADD CONSTRAINT "consistency_warnings_conflicting_fact_id_fkey" FOREIGN KEY ("conflicting_fact_id") REFERENCES "facts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
