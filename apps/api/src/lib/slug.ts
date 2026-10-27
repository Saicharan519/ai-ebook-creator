import { randomBytes } from "node:crypto";

const MAX_WORDS_LENGTH = 60;

/** "Rain & Ruin: Book Ü" -> "rain-ruin-book-u" (ASCII only, so links survive copy and paste) */
export function slugify(text: string): string {
  const words = text
    .normalize("NFKD")
    // Accents split off by NFKD
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_WORDS_LENGTH)
    .replace(/-+$/, "");
  return words || "book";
}

/**
 * A readable, hard-to-guess public address: the title plus a random suffix,
 * so two books with the same title never collide and unpublished books can't
 * be found by guessing.
 */
export function bookSlug(title: string): string {
  // About 41 random bits, written in base 36 to stay lowercase and URL-safe
  const suffix = BigInt(`0x${randomBytes(8).toString("hex")}`)
    .toString(36)
    .padStart(8, "0");
  return `${slugify(title)}-${suffix.slice(-8)}`;
}

/** What a slug made by bookSlug can look like; anything else can't match a book */
export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
