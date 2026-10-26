export type ImageType = "jpeg" | "png";

/**
 * Identifies an image by its first bytes rather than trusting the file name
 * or the browser-supplied MIME type, both of which the client controls.
 * Only JPEG and PNG are accepted because the PDF and DOCX exporters support them.
 */
export function detectImageType(data: Buffer): ImageType | null {
  if (data.length >= 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) {
    return "jpeg";
  }
  const pngSignature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (data.length >= 8 && pngSignature.every((byte, i) => data[i] === byte)) {
    return "png";
  }
  return null;
}

/** Pixel dimensions read from the image header, or null if they can't be found. */
export function imageSize(data: Buffer, type: ImageType): { width: number; height: number } | null {
  if (type === "png") {
    // The IHDR chunk always comes first: width and height at bytes 16-23
    return data.length >= 24
      ? { width: data.readUInt32BE(16), height: data.readUInt32BE(20) }
      : null;
  }

  // JPEG: walk the segments until a start-of-frame marker, which holds the size
  let offset = 2;
  while (offset + 9 < data.length) {
    if (data[offset] !== 0xff) return null;
    const marker = data[offset + 1]!;
    const isStartOfFrame =
      marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (isStartOfFrame) {
      return { height: data.readUInt16BE(offset + 5), width: data.readUInt16BE(offset + 7) };
    }
    offset += 2 + data.readUInt16BE(offset + 2);
  }
  return null;
}
