-- AlterTable
ALTER TABLE "books" ADD COLUMN     "published_at" TIMESTAMP(3),
ADD COLUMN     "slug" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "books_slug_key" ON "books"("slug");

