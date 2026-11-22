import sharp from "sharp";
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const allowed = new Set(["image/jpeg", "image/png", "image/webp"]);
// Decode and re-encode rather than trusting a filename or browser-supplied MIME type.
// Re-encoding strips EXIF metadata, including any embedded location.
export async function prepareDressImage(
  bytes: Buffer,
  mime: string,
): Promise<Buffer> {
  if (
    !allowed.has(mime) ||
    bytes.length === 0 ||
    bytes.length > MAX_IMAGE_BYTES
  ) {
    throw new Error("اختر صورة JPEG أو PNG أو WebP بحد أقصى ٥ ميجابايت.");
  }
  const isJpeg =
    bytes.length >= 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff;
  const isPng = bytes
    .subarray(0, 8)
    .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  const isWebp =
    bytes.length >= 12 &&
    bytes.toString("ascii", 0, 4) === "RIFF" &&
    bytes.toString("ascii", 8, 12) === "WEBP";
  if (!isJpeg && !isPng && !isWebp)
    throw new Error("نوع الملف الفعلي غير مدعوم.");
  const header = await sharp(bytes, {
    limitInputPixels: 40_000_000,
  }).metadata();
  if (
    !header.format ||
    !["jpeg", "png", "webp"].includes(header.format) ||
    (header.pages ?? 1) > 1
  ) {
    throw new Error(
      "الصورة غير مدعومة. استخدم صورة ثابتة بصيغة JPEG أو PNG أو WebP.",
    );
  }
  const output = await sharp(bytes, {
    limitInputPixels: 40_000_000,
    failOn: "error",
  })
    .rotate()
    .resize({
      width: 1800,
      height: 2200,
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: 85 })
    .toBuffer();
  if (output.length > MAX_IMAGE_BYTES)
    throw new Error("الصورة أكبر من الحد المسموح بعد المعالجة.");
  return output;
}
