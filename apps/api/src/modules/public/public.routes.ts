import { Router, type Response } from "express";
import { rateLimit } from "express-rate-limit";
import { AppError, NotFoundError } from "../../lib/errors";
import { idParam } from "../../lib/params";
import { SLUG_PATTERN } from "../../lib/slug";
import * as publicService from "./public.service";

function slugParam(value: string | string[] | undefined): string {
  if (typeof value !== "string" || value.length > 100 || !SLUG_PATTERN.test(value)) {
    throw new NotFoundError("Book not found");
  }
  return value;
}

/** Readers may cache a page briefly; an unpublished book disappears within a minute */
const cacheBriefly = (res: Response) => res.set("Cache-Control", "public, max-age=60");

/** Read-only pages for published books. Mounted at /public, with no login. */
export const publicRouter = Router();

publicRouter.use(
  rateLimit({
    windowMs: 60 * 1000,
    limit: 120,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    handler: (_req, _res, next) => {
      next(new AppError(429, "TOO_MANY_REQUESTS", "Too many requests. Try again in a minute."));
    },
  }),
);

publicRouter.get("/books/:slug", async (req, res) => {
  const book = await publicService.getPublicBook(slugParam(req.params.slug));
  cacheBriefly(res).json(book);
});

publicRouter.get("/books/:slug/chapters/:chapterId", async (req, res) => {
  const slug = slugParam(req.params.slug);
  const chapterId = idParam(req.params.chapterId, "Chapter");
  cacheBriefly(res).json(await publicService.getPublicChapter(slug, chapterId));
});
