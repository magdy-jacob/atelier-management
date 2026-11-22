import test from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import {
  prepareDressImage,
  MAX_IMAGE_BYTES,
} from "../src/lib/image-processing";
test("image processing resizes and strips metadata", async () => {
  const input = await sharp({
    create: { width: 2000, height: 3000, channels: 3, background: "#81947c" },
  })
    .jpeg()
    .withMetadata({ orientation: 1 })
    .toBuffer();
  const result = await prepareDressImage(input, "image/jpeg");
  const m = await sharp(result).metadata();
  assert.equal(m.format, "webp");
  assert.ok((m.width ?? 0) <= 1800);
  assert.ok((m.height ?? 0) <= 2200);
  assert.equal(m.exif, undefined);
});
test("image processing rejects oversized or empty files", async () => {
  await assert.rejects(() =>
    prepareDressImage(Buffer.alloc(MAX_IMAGE_BYTES + 1), "image/png"),
  );
  await assert.rejects(() => prepareDressImage(Buffer.alloc(0), "image/png"));
});
test("image processing rejects disguised HTML and SVG before decoding", async () => {
  await assert.rejects(() =>
    prepareDressImage(Buffer.from("<html>not an image</html>"), "image/png"),
  );
  await assert.rejects(() =>
    prepareDressImage(
      Buffer.from(
        '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/>',
      ),
      "image/png",
    ),
  );
});
