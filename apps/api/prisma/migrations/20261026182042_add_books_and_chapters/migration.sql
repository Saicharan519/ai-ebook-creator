-- CreateEnum
CREATE TYPE "BookStatus" AS ENUM ('draft', 'published');

-- CreateTable
CREATE TABLE "books" (
    "id" UUID NOT NULL,
    "owner_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "subtitle" TEXT NOT NULL DEFAULT '',
    "author" TEXT NOT NULL,
    "genre" TEXT NOT NULL DEFAULT '',
    "premise" TEXT NOT NULL DEFAULT '',
    "writing_style" TEXT NOT NULL DEFAULT '',
    "cover_key" TEXT,
    "status" "BookStatus" NOT NULL DEFAULT 'draft',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "books_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chapters" (
    "id" UUID NOT NULL,
    "book_id" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "content" TEXT NOT NULL DEFAULT '',
    "word_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chapters_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "books_owner_id_updated_at_idx" ON "books"("owner_id", "updated_at");

-- CreateIndex
CREATE INDEX "chapters_book_id_position_idx" ON "chapters"("book_id", "position");

-- AddForeignKey
ALTER TABLE "books" ADD CONSTRAINT "books_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chapters" ADD CONSTRAINT "chapters_book_id_fkey" FOREIGN KEY ("book_id") REFERENCES "books"("id") ON DELETE CASCADE ON UPDATE CASCADE;
