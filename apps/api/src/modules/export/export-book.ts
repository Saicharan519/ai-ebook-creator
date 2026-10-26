import type { ImageType } from "../../lib/image-type";

/** Everything an exporter needs, already loaded and checked. */
export interface ExportBook {
  title: string;
  subtitle: string;
  author: string;
  cover: { data: Buffer; type: ImageType } | null;
  chapters: { title: string; content: string }[];
}
