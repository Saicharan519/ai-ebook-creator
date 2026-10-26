/*
  Warnings:

  - Added the required column `fingerprint` to the `consistency_warnings` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "consistency_warnings" ADD COLUMN     "fingerprint" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "dismissed_conflicts" (
    "book_id" UUID NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dismissed_conflicts_pkey" PRIMARY KEY ("book_id","fingerprint")
);

-- AddForeignKey
ALTER TABLE "dismissed_conflicts" ADD CONSTRAINT "dismissed_conflicts_book_id_fkey" FOREIGN KEY ("book_id") REFERENCES "books"("id") ON DELETE CASCADE ON UPDATE CASCADE;
