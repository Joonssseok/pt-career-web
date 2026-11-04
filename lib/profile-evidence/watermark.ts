import { createHash } from "node:crypto";
import sharp from "sharp";
import {
  PDFAcroNonTerminal, PDFArray, PDFCheckBox, PDFDict, PDFDocument, PDFName, PDFNumber,
  PDFObject, PDFPage, PDFRadioGroup, PDFRef, PDFStream,
  StandardFonts, degrees, rgb,
} from "pdf-lib";

export type PublicEvidenceIdentity = {
  reviewId: string;
  fileId: string;
};

const MAX_BYTES = 10 * 1024 * 1024;
const MAX_PIXELS = 40_000_000;
const PUBLISHER_NAMESPACE = "urn:pt-career:public-copy:1";
const xml = (s: string) => s.replace(/[<>&"']/g, (c) => ({
  "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;",
})[c]!);
function fail(): never { throw new Error("EVIDENCE_DERIVATIVE_REJECTED"); }

function embedPngTrace(pixels: Buffer, width: number, height: number, copyId: string) {
  const message = Buffer.from(`${PUBLISHER_NAMESPACE}:${copyId}`, "ascii");
  const payload = Buffer.concat([message, createHash("sha256").update(message).digest().subarray(0, 8)]);
  const count = width * height;
  const seed = createHash("sha256").update(`${PUBLISHER_NAMESPACE}:png:${width}x${height}`).digest();
  let step = seed.readUInt32BE(4) % count || 1;
  const gcd = (a: number, b: number): number => b ? gcd(b, a % b) : a;
  while (gcd(step, count) !== 1) step = (step + 1) % count || 1;
  const bits = payload.length * 8;
  const repeats = Math.min(3, Math.floor(count / bits));
  if (!repeats) fail();
  let pixel = seed.readUInt32BE(0) % count;
  for (let i = 0; i < bits * repeats; i++) {
    const bit = i % bits;
    const blue = pixel * 3 + 2;
    pixels[blue] = (pixels[blue] & 0xfe) | ((payload[bit >>> 3] >>> (7 - (bit & 7))) & 1);
    pixel = (pixel + step) % count;
  }
}

function checkPng(input: Buffer) {
  let offset = 8;
  while (offset + 12 <= input.length) {
    const length = input.readUInt32BE(offset);
    const type = input.toString("ascii", offset + 4, offset + 8);
    if (length > input.length - offset - 12 || type === "acTL") fail();
    offset += length + 12;
    if (type === "IEND") return offset === input.length && length === 0 ? undefined : fail();
  }
  fail();
}

async function image(input: Buffer, mime: string, copyId: string, xmp: string) {
  const formats: Record<string, string> = { "image/jpeg": "jpeg", "image/png": "png", "image/webp": "webp" };
  if (!Object.prototype.hasOwnProperty.call(formats, mime)) fail();
  if (mime === "image/png") {
    if (!input.subarray(0, 8).equals(Buffer.from("89504e470d0a1a0a", "hex"))) fail();
    checkPng(input);
  }
  if (mime === "image/jpeg" && input.toString("hex", 0, 3) !== "ffd8ff") fail();
  if (mime === "image/webp" && (input.toString("ascii", 0, 4) !== "RIFF" ||
    input.toString("ascii", 8, 12) !== "WEBP" || input.readUInt32LE(4) + 8 !== input.length)) fail();
  const pipeline = sharp(input, { limitInputPixels: MAX_PIXELS, failOn: "warning" });
  const metadata = await pipeline.metadata();
  if (metadata.format !== formats[mime] || (metadata.pages ?? 1) !== 1 ||
    !metadata.width || !metadata.height || metadata.width * metadata.height > MAX_PIXELS) fail();
  const { data, info } = await pipeline.rotate().flatten({ background: "white" }).removeAlpha()
    .png().toBuffer({ resolveWithObject: true });
  const width = Math.max(640, info.width);
  const band = 44;
  const height = info.height + band;
  if (width * height > MAX_PIXELS + 2_000_000) fail();
  const left = Math.floor((width - info.width) / 2);
  const overlay = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <defs><pattern id="mark" width="260" height="150" patternUnits="userSpaceOnUse">
      <text x="24" y="80" transform="rotate(-20 24 80)" font-family="sans-serif" font-size="24" fill="#2563a6" opacity="0.10">PT Career</text>
    </pattern></defs><rect width="${width}" height="${info.height}" fill="url(#mark)"/>
    <rect y="${info.height}" width="${width}" height="${band}" fill="white"/>
    <path d="M0 ${info.height + 1}H${width}" stroke="#2563a6"/>
    <text x="12" y="${info.height + 24}" font-family="monospace" font-size="14" fill="#174b80">PT Career</text></svg>`;
  const painted = await sharp(data, { limitInputPixels: MAX_PIXELS }).extend({
    left, right: width - info.width - left, top: 0, bottom: band, background: "white",
  }).composite([{ input: Buffer.from(overlay) }]).toColourspace("srgb").removeAlpha().raw().toBuffer({ resolveWithObject: true });
  embedPngTrace(painted.data, width, height, copyId);
  return sharp(painted.data, { raw: painted.info, limitInputPixels: MAX_PIXELS + 2_000_000 })
    .withXmp(xmp).png({ palette: false }).toBuffer();
}

function scrub(value: PDFObject, doc: PDFDocument, seen = new Set<PDFObject>(), depth = 0): boolean {
  if (depth > 64 || seen.size > 100_000) fail();
  const object = doc.context.lookup(value);
  if (!object) return true;
  const dict = object instanceof PDFStream ? object.dict : object instanceof PDFDict ? object : undefined;
  if (dict) {
    const type = dict.lookupMaybe(PDFName.of("Type"), PDFName)?.decodeText();
    const actionValue = dict.get(PDFName.of("S"));
    const action = actionValue ? doc.context.lookup(actionValue) : undefined;
    if (object instanceof PDFStream && dict.has(PDFName.of("F"))) fail();
    if (/^(Action|Annot|Filespec|EmbeddedFile|Metadata)$/.test(type ?? "") ||
      (action instanceof PDFName && /^(JavaScript|Launch|GoTo|GoToR|GoToE|URI|SubmitForm|ImportData|Rendition|Movie|Sound|Hide|Named|SetOCGState|ResetForm|Thread|Trans|GoTo3DView)$/.test(action.decodeText()))) return false;
    if (seen.has(object)) return true;
    seen.add(object);
    for (const [key, child] of dict.entries()) {
      if (/^(AA|Annots|OpenAction|JS|JavaScript|Names|EmbeddedFiles|EF|AF|AcroForm|XFA|Metadata|PieceInfo|LastModified|Thumb|PresSteps|RichMediaContent|RichMediaSettings|Collection)$/.test(key.decodeText()) ||
        !scrub(child, doc, seen, depth + 1)) dict.delete(key);
    }
  } else if (object instanceof PDFArray) {
    if (seen.has(object)) return true;
    seen.add(object);
    for (let i = object.size() - 1; i >= 0; i--) {
      if (!scrub(object.get(i), doc, seen, depth + 1)) object.remove(i);
    }
  }
  return true;
}

function numbers(array: PDFArray | undefined, length: number): number[] {
  if (!array || array.size() !== length) return fail();
  const values = Array.from({ length }, (_, i) => array.lookup(i, PDFNumber).asNumber());
  if (!values.every(Number.isFinite)) fail();
  return values;
}

function flattenExistingAppearances(doc: PDFDocument) {
  const acroForm = doc.catalog.lookupMaybe(PDFName.of("AcroForm"), PDFDict);
  // getForm() silently deletes XFA; reject it before accessing the form.
  if (acroForm?.has(PDFName.of("XFA")) || doc.catalog.has(PDFName.of("XFA")) ||
    doc.catalog.has(PDFName.of("NeedsRendering")) || doc.catalog.has(PDFName.of("OCProperties")) ||
    (acroForm?.has(PDFName.of("NeedAppearances")) && acroForm.get(PDFName.of("NeedAppearances"))?.toString() !== "false")) fail();
  const form = acroForm ? doc.getForm() : undefined;
  const fields = form?.getFields() ?? [];
  const fieldRefs = new Set(fields.map((field) => field.ref));
  if (form?.acroForm.getAllFields().some(([field, ref]) => !(field instanceof PDFAcroNonTerminal) && !fieldRefs.has(ref))) fail();
  const widgets = new Set<PDFDict>();
  for (const field of fields) {
    for (const widget of field.acroField.getWidgets()) {
      if (widgets.has(widget.dict) || widget.dict.lookupMaybe(PDFName.of("Subtype"), PDFName)?.decodeText() !== "Widget" ||
        widget.dict.has(PDFName.of("OC"))) fail();
      widgets.add(widget.dict);
      const flags = widget.getFlags();
      if (!Number.isSafeInteger(flags) || flags < 0 || flags > 0x7fffffff || (flags & ~(4 | 64 | 128 | 512))) fail();
      const rect = widget.getRectangle();
      if (!Object.values(rect).every(Number.isFinite) || rect.width <= 0 || rect.height <= 0) fail();
      let appearanceRef = widget.getNormalAppearance();
      if (appearanceRef instanceof PDFDict) {
        if (!(field instanceof PDFCheckBox || field instanceof PDFRadioGroup)) fail();
        const state = widget.getAppearanceState();
        const selected = appearanceRef.get(field.acroField.getValue()) ?? appearanceRef.get(PDFName.of("Off"));
        if (!state || selected !== appearanceRef.get(state)) fail();
        appearanceRef = selected as PDFRef;
      }
      if (!(appearanceRef instanceof PDFRef)) fail();
      const appearance = doc.context.lookup(appearanceRef);
      if (!(appearance instanceof PDFStream) || appearance.dict.lookupMaybe(PDFName.of("Subtype"), PDFName)?.decodeText() !== "Form" ||
        (appearance.dict.has(PDFName.of("Type")) && appearance.dict.lookup(PDFName.of("Type"), PDFName).decodeText() !== "XObject") ||
        appearance.dict.has(PDFName.of("OC")) || appearance.dict.has(PDFName.of("S"))) fail();
      const [x0, y0, x1, y1] = numbers(appearance.dict.lookupMaybe(PDFName.of("BBox"), PDFArray), 4);
      const matrix = appearance.dict.lookupMaybe(PDFName.of("Matrix"), PDFArray);
      const [a, b, c, d, e, f] = matrix ? numbers(matrix, 6) : [1, 0, 0, 1, 0, 0];
      const corners = [[x0, y0], [x0, y1], [x1, y0], [x1, y1]].map(([x, y]) => [a * x + c * y + e, b * x + d * y + f]);
      const bounds = [Math.min(...corners.map(([x]) => x)), Math.min(...corners.map(([, y]) => y)),
        Math.max(...corners.map(([x]) => x)), Math.max(...corners.map(([, y]) => y))];
      // pdf-lib's flatten draws at native size, without fitting the AP bounds to Rect.
      if (x1 <= x0 || y1 <= y0 || bounds.some((value, i) => !Number.isFinite(value) || Math.abs(value - [0, 0, rect.width, rect.height][i]) > 0.000001)) fail();
    }
  }
  const placed = new Set<PDFDict>();
  for (const page of doc.getPages()) {
    const annots = page.node.lookupMaybe(PDFName.of("Annots"), PDFArray);
    for (let i = 0; i < (annots?.size() ?? 0); i++) {
      const ref = annots!.get(i);
      const annotation = doc.context.lookup(ref, PDFDict);
      if (widgets.has(annotation)) {
        const pageRef = annotation.get(PDFName.of("P"));
        if (!(ref instanceof PDFRef) || placed.has(annotation) || (pageRef && pageRef !== page.ref)) fail();
        placed.add(annotation);
      } else {
        const border = annotation.lookupMaybe(PDFName.of("Border"), PDFArray);
        if (annotation.lookupMaybe(PDFName.of("Subtype"), PDFName)?.decodeText() !== "Link" ||
          annotation.has(PDFName.of("AP")) || annotation.has(PDFName.of("BS")) || annotation.has(PDFName.of("OC")) ||
          !border || border.size() < 3 || border.lookup(2, PDFNumber).asNumber() !== 0) fail();
      }
    }
  }
  if (placed.size !== widgets.size) fail();
  form?.flatten({ updateFieldAppearances: false });
}

async function pdf(input: Buffer, copyId: string, json: string, xmp: string) {
  if (!/^%PDF-(1\.[0-7]|2\.0)/.test(input.toString("ascii", 0, 8)) ||
    !/%%EOF\s*$/.test(input.subarray(-1024).toString("latin1"))) fail();
  const original = await PDFDocument.load(input, { updateMetadata: false, throwOnInvalidObject: true });
  if (original.isEncrypted || original.getPageCount() < 1 || original.getPageCount() > 50) fail();
  flattenExistingAppearances(original);
  const output = await PDFDocument.create({ updateMetadata: false });
  const font = await output.embedFont(StandardFonts.Courier);
  for (const sourcePage of original.getPages()) {
    const media = sourcePage.getMediaBox();
    const crop = sourcePage.getCropBox();
    for (const box of [media, crop]) {
      if (!Object.values(box).every(Number.isFinite) || box.width < 36 || box.height < 36 ||
        box.width > 14_400 || box.height > 14_400 || Math.abs(box.x) > 14_400 || Math.abs(box.y) > 14_400) fail();
    }
    const userUnit = sourcePage.node.get(PDFName.of("UserUnit"));
    if (userUnit && userUnit.toString() !== "1") fail();
    const rotation = ((sourcePage.getRotation().angle % 360) + 360) % 360;
    if (![0, 90, 180, 270].includes(rotation)) fail();
    const left = Math.max(media.x, crop.x), bottom = Math.max(media.y, crop.y);
    const right = Math.min(media.x + media.width, crop.x + crop.width);
    const top = Math.min(media.y + media.height, crop.y + crop.height);
    const w = right - left, h = top - bottom;
    if (w < 36 || h < 36) fail();
    const width = rotation % 180 ? h : w, height = rotation % 180 ? w : h;
    const band = 35;
    const page = output.addPage([Math.max(width, 240), height + band]);
    const artwork = PDFPage.create(original);
    artwork.setMediaBox(left, bottom, w, h);
    const resources = sourcePage.node.Resources() ?? original.context.obj({});
    const contents = sourcePage.node.Contents() ?? original.context.obj([]);
    if (!scrub(resources, original) || !scrub(contents, original)) fail();
    artwork.node.set(PDFName.of("Resources"), resources);
    artwork.node.set(PDFName.of("Contents"), contents);
    const embedded = await output.embedPage(artwork, { left, bottom, right, top });
    page.drawPage(embedded, {
      x: rotation === 180 ? w : rotation === 270 ? h : 0,
      y: band + (rotation === 90 ? w : rotation === 180 ? h : 0), rotate: degrees(-rotation),
    });
    for (let y = band + Math.min(36, height / 2); y < height + band; y += 120) {
      for (let x = 16; x < page.getWidth() - 70; x += 190) {
        page.drawText("PT Career", { x, y, size: 18, font, color: rgb(0.145, 0.388, 0.65), opacity: 0.1, rotate: degrees(20) });
      }
    }
    page.drawLine({ start: { x: 0, y: band }, end: { x: page.getWidth(), y: band }, color: rgb(0.145, 0.388, 0.65), thickness: 0.5 });
    page.drawText("PT Career", { x: 12, y: band - 18, font, size: 8, color: rgb(0.09, 0.29, 0.5) });
    page.drawText(`${PUBLISHER_NAMESPACE}:${copyId}`, { x: 12, y: 4, font, size: 1, opacity: 0 });
    page.node.delete(PDFName.of("Annots"));
  }
  output.setTitle("PT Career public copy");
  output.setSubject(json);
  output.catalog.set(PDFName.of("Metadata"), output.context.register(output.context.stream(Buffer.from(xmp), {
    Type: "Metadata", Subtype: "XML",
  })));
  return Buffer.from(await output.save({ useObjectStreams: false, updateFieldAppearances: false }));
}

export async function watermarkEvidence(source: Buffer, mime: string, identity: PublicEvidenceIdentity): Promise<{
  bytes: Buffer; mime: "image/png" | "application/pdf"; extension: "png" | "pdf"; sha256: string; copyId: string;
}> {
  try {
    if (!Buffer.isBuffer(source) || !source.length || source.length > MAX_BYTES) fail();
    for (const value of [identity.reviewId, identity.fileId]) {
      if (typeof value !== "string" || !value.trim() || value.length > 4096 || /[\x00-\x1f\x7f]/.test(value)) fail();
    }
    const copyId = createHash("sha256").update(PUBLISHER_NAMESPACE)
      .update(JSON.stringify([identity.reviewId, identity.fileId])).digest("hex").slice(0, 32);
    const json = JSON.stringify({ label: "PT Career public copy", copyId });
    const xmp = `<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"><rdf:Description rdf:about="" xmlns:pt="${PUBLISHER_NAMESPACE}"><pt:copy>${xml(json)}</pt:copy></rdf:Description></rdf:RDF></x:xmpmeta>`;
    const input = Buffer.from(source);
    const isPdf = mime === "application/pdf";
    const bytes = isPdf ? await pdf(input, copyId, json, xmp) : await image(input, mime, copyId, xmp);
    return { bytes, mime: isPdf ? "application/pdf" : "image/png", extension: isPdf ? "pdf" : "png",
      sha256: createHash("sha256").update(bytes).digest("hex"), copyId };
  } catch {
    return fail();
  }
}
