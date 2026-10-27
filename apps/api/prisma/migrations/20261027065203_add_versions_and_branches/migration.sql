-- CreateEnum
CREATE TYPE "VersionReason" AS ENUM ('manual', 'autosave', 'before_ai', 'before_restore', 'before_keep');

-- CreateTable
CREATE TABLE "chapter_versions" (
    "id" UUID NOT NULL,
    "chapter_id" UUID NOT NULL,
    "branch_id" UUID,
    "reason" "VersionReason" NOT NULL,
    "label" TEXT NOT NULL DEFAULT '',
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "word_count" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chapter_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chapter_branches" (
    "id" UUID NOT NULL,
    "chapter_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "word_count" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chapter_branches_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "chapter_versions_chapter_id_branch_id_created_at_idx" ON "chapter_versions"("chapter_id", "branch_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "chapter_branches_chapter_id_name_key" ON "chapter_branches"("chapter_id", "name");

-- AddForeignKey
ALTER TABLE "chapter_versions" ADD CONSTRAINT "chapter_versions_chapter_id_fkey" FOREIGN KEY ("chapter_id") REFERENCES "chapters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chapter_versions" ADD CONSTRAINT "chapter_versions_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "chapter_branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chapter_branches" ADD CONSTRAINT "chapter_branches_chapter_id_fkey" FOREIGN KEY ("chapter_id") REFERENCES "chapters"("id") ON DELETE CASCADE ON UPDATE CASCADE;
