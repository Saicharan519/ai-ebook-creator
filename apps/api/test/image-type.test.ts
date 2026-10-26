import { describe, expect, it } from "vitest";
import { detectImageType, imageSize } from "../src/lib/image-type";
import { makePng } from "./fixtures";

// Smallest useful JPEG header: SOI, an APP0 segment, then a SOF0 frame of 640x480
const jpegHeader = Buffer.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x04, 0x00, 0x00, 0xff, 0xc0, 0x00, 0x11, 0x08, 0x01, 0xe0, 0x02,
  0x80, 0x03,
]);

describe("detectImageType", () => {
  it("recognises PNG and JPEG by their signatures", () => {
    expect(detectImageType(makePng(1, 1))).toBe("png");
    expect(detectImageType(jpegHeader)).toBe("jpeg");
  });

  it("rejects anything else", () => {
    expect(detectImageType(Buffer.from("GIF89a"))).toBeNull();
    expect(detectImageType(Buffer.from("<svg></svg>"))).toBeNull();
    expect(detectImageType(Buffer.alloc(0))).toBeNull();
  });
});

describe("imageSize", () => {
  it("reads PNG dimensions", () => {
    expect(imageSize(makePng(300, 450), "png")).toEqual({ width: 300, height: 450 });
  });

  it("reads JPEG dimensions from the frame header", () => {
    expect(imageSize(jpegHeader, "jpeg")).toEqual({ width: 640, height: 480 });
  });
});
