import { createHash } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, rmdirSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import { PDFArray, PDFDict, PDFDocument, PDFHexString, PDFName, PDFNumber, PDFRawStream, PDFRef, PDFString, StandardFonts, decodePDFRawStream, degrees, rgb } from "pdf-lib";
import { PublicEvidenceIdentity, watermarkEvidence } from "../lib/profile-evidence/watermark";

const identity: PublicEvidenceIdentity = {
  reviewId: "11111111-1111-4111-8111-111111111111",
  fileId: "22222222-2222-4222-8222-222222222222",
};
const namespace = "urn:pt-career:public-copy:1";
const expectedCopyId = createHash("sha256").update(namespace)
  .update(JSON.stringify([identity.reviewId, identity.fileId])).digest("hex").slice(0, 32);
const privateMarker = "PRIVATE_SYNTHETIC_SOURCE_METADATA";
const sheet = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="720" height="480">
  <rect width="720" height="480" fill="white"/><rect x="25" y="25" width="670" height="430" fill="none" stroke="black"/>
  <g fill="black" font-family="sans-serif" font-size="22"><text x="45" y="65">NOT A REAL DOCUMENT</text>
  <text x="45" y="115">Synthetic example / 40 hours</text><text x="45" y="380">Original text must remain readable.</text></g></svg>`);
const oldXmp = `<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"><rdf:Description xmlns:old="urn:test" old:secret="${privateMarker}"/></rdf:RDF></x:xmpmeta>`;

function xmpIdentity(packet: string) {
  const text = packet.match(/<pt:copy>(.*?)<\/pt:copy>/s)?.[1];
  expect(text).toBeDefined();
  return JSON.parse(text!.replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&"));
}

function expectIdentity(data: Record<string, unknown>, copyId = expectedCopyId) {
  expect(data).toEqual({ label: "PT Career public copy", copyId });
  expect(JSON.stringify(data)).not.toMatch(/review|verified|verification|authentic|credential|C2PA|signature|AI|https?:/i);
  expect(JSON.stringify(data)).not.toContain(identity.reviewId);
  expect(JSON.stringify(data)).not.toContain(identity.fileId);
}

function traceIndices(width: number, height: number, length: number) {
  const count = width * height;
  const seed = createHash("sha256").update(`${namespace}:png:${width}x${height}`).digest();
  let step = seed.readUInt32BE(4) % count || 1;
  const gcd = (a: number, b: number): number => b ? gcd(b, a % b) : a;
  while (gcd(step, count) !== 1) step = (step + 1) % count || 1;
  return Array.from({ length }, (_, i) => (seed.readUInt32BE(0) + i * step) % count);
}

async function decodePngTrace(bytes: Buffer) {
  const { data, info } = await sharp(bytes).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const messageLength = Buffer.byteLength(`${namespace}:`) + 32;
  const length = messageLength + 8;
  const bits = length * 8;
  const repeats = Math.min(3, Math.floor(info.width * info.height / bits));
  const indices = traceIndices(info.width, info.height, bits * repeats);
  for (let repeat = 0; repeat < repeats; repeat++) {
    const payload = Buffer.alloc(length);
    for (let bit = 0; bit < bits; bit++) {
      payload[bit >>> 3] |= (data[indices[repeat * bits + bit] * info.channels + 2] & 1) << (7 - (bit & 7));
    }
    const message = payload.subarray(0, messageLength);
    if (!createHash("sha256").update(message).digest().subarray(0, 8).equals(payload.subarray(messageLength))) continue;
    const text = message.toString("ascii");
    if (text.startsWith(`${namespace}:`) && /^[a-f0-9]{32}$/.test(text.slice(-32))) return text.slice(-32);
  }
  return undefined;
}

function stripPdfMetadata(doc: PDFDocument) {
  const metadata = doc.catalog.get(PDFName.of("Metadata"));
  if (metadata instanceof PDFRef) doc.context.delete(metadata);
  doc.catalog.delete(PDFName.of("Metadata"));
  const info = doc.context.trailerInfo.Info;
  if (info instanceof PDFRef) doc.context.delete(info);
  doc.context.trailerInfo.Info = undefined;
}

function pdfTraceBlock(operators: string, copyId: string) {
  const hex = Buffer.from(`${namespace}:${copyId}`).toString("hex").toUpperCase();
  return operators.match(new RegExp(`q\\n(?:(?!\\nQ)[\\s\\S])*<${hex}> Tj(?:(?!\\nQ)[\\s\\S])*\\nQ\\n?`))?.[0];
}

async function fixturePdf() {
  const doc = await PDFDocument.create();
  doc.setAuthor(privateMarker);
  doc.setTitle(privateMarker);
  doc.setSubject(privateMarker);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const layouts = [[500, 700, 0], [700, 500, 0], [700, 500, 90], [500, 700, 270], [500, 700, 180]];
  for (const [i, [width, height, rotation]] of layouts.entries()) {
    const page = doc.addPage([width, height]);
    page.drawRectangle({ x: 30, y: 40, width: 120, height: 60, color: rgb(0.8, 0.1, 0.1) });
    page.drawText(`NOT A REAL DOCUMENT / page ${i + 1}`, { x: 40, y: height - 80, size: 16, font });
    page.setRotation(degrees(rotation));
    if (i === 3) page.setCropBox(20, 30, width - 40, height - 60);
  }
  doc.addJavaScript("unsafeSynthetic", "app.alert('UNSAFE_SYNTHETIC_SCRIPT')");
  await doc.attach(Buffer.from("UNSAFE_SYNTHETIC_ATTACHMENT"), "private.txt");
  const action = doc.context.register(doc.context.obj({ S: "JavaScript", JS: PDFString.of("UNSAFE_SYNTHETIC_ACTION") }));
  const annotation = doc.context.register(doc.context.obj({
    Type: "Annot", Subtype: "Link", Rect: [0, 0, 100, 100], Border: [0, 0, 0], A: action,
  }));
  doc.getPage(0).node.set(PDFName.of("Annots"), doc.context.obj([annotation]));
  doc.getPage(1).node.set(PDFName.of("AA"), doc.context.obj({ O: action }));
  doc.catalog.set(PDFName.of("OpenAction"), action);
  doc.catalog.set(PDFName.of("Metadata"), doc.context.register(doc.context.stream(Buffer.from(oldXmp), { Type: "Metadata", Subtype: "XML" })));
  return Buffer.from(await doc.save({ useObjectStreams: false }));
}

async function fixtureFormPdf() {
  const doc = await PDFDocument.create();
  const form = doc.getForm();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const text = form.createTextField("synthetic.review");
  text.setText("SYNTHETIC FORM VALUE / 40 HOURS");
  for (const rotation of [0, 90]) {
    const page = doc.addPage([500, 700]);
    page.setRotation(degrees(rotation));
    page.drawText("NOT A REAL DOCUMENT", { x: 40, y: 620, font });
    text.addToPage(page, { x: 40, y: 480, width: 390, height: 50, font });
  }
  const checkbox = form.createCheckBox("synthetic.confirmed");
  checkbox.addToPage(doc.getPage(0), { x: 40, y: 400, width: 24, height: 24 });
  checkbox.check();
  const radio = form.createRadioGroup("synthetic.choice");
  radio.addOptionToPage("first", doc.getPage(0), { x: 90, y: 400, width: 24, height: 24 });
  radio.addOptionToPage("second", doc.getPage(0), { x: 140, y: 400, width: 24, height: 24 });
  radio.select("second");
  form.updateFieldAppearances(font);
  // A different Unicode value proves the renderer never regenerates the supplied appearances.
  text.acroField.dict.set(PDFName.of("V"), PDFString.of("표시를 재생성하지 않음"));
  const action = doc.context.register(doc.context.obj({ S: "JavaScript", JS: PDFString.of("UNSAFE_SYNTHETIC_WIDGET") }));
  text.acroField.getWidgets()[0].dict.set(PDFName.of("AA"), doc.context.obj({ K: action }));
  return Buffer.from(await doc.save({ useObjectStreams: false, updateFieldAppearances: false }));
}

test("flattens every existing PDFForm text/check/radio appearance without regeneration or source mutation", async () => {
  const source = await fixtureFormPdf();
  const before = Buffer.from(source);
  const original = await PDFDocument.load(source);
  const appearances = original.getForm().getTextField("synthetic.review").acroField.getWidgets()
    .map((widget) => widget.getAppearances()!.normal as PDFRawStream);
  const output = await watermarkEvidence(source, "application/pdf", identity);
  const repeated = await watermarkEvidence(source, "application/pdf", identity);
  expect(source.equals(before)).toBe(true);
  expect(output.bytes.equals(repeated.bytes)).toBe(true);
  expect(output.sha256).toBe(createHash("sha256").update(output.bytes).digest("hex"));
  const doc = await PDFDocument.load(output.bytes, { updateMetadata: false });
  expect(doc.getPageCount()).toBe(2);
  expect(doc.catalog.has(PDFName.of("AcroForm"))).toBe(false);
  expectIdentity(JSON.parse(doc.getSubject()!));
  const streams = doc.context.enumerateIndirectObjects().map(([, object]) => object)
    .filter((object): object is PDFRawStream => object instanceof PDFRawStream);
  for (const appearance of appearances) {
    expect(streams.some((stream) => Buffer.from(stream.contents).equals(Buffer.from(appearance.contents)))).toBe(true);
  }
  for (const page of doc.getPages()) {
    expect(page.node.has(PDFName.of("Annots"))).toBe(false);
    const contents = page.node.Contents() as PDFArray;
    expect(Buffer.from(decodePDFRawStream(contents.lookup(0, PDFRawStream)).decode()).toString()).toContain("505420436172656572");
  }
  expect(output.bytes.toString("latin1")).not.toMatch(/UNSAFE_SYNTHETIC|\/JavaScript|\/AA\b|\/Widget\b/);
});

test.each(["XFA", "needs appearances", "missing AP", "unsupported state AP", "nonstream AP", "invalid AP type", "action AP", "scaled AP", "hidden widget", "orphan widget", "wrong widget page", "unknown field", "mismatched radio state", "external AP"])(
  "rejects unsupported form content instead of changing its appearance: %s", async (kind) => {
    const doc = await PDFDocument.load(await fixtureFormPdf());
    const form = doc.getForm();
    const widget = form.getTextField("synthetic.review").acroField.getWidgets()[0];
    if (kind === "XFA") form.acroForm.dict.set(PDFName.of("XFA"), doc.context.obj([PDFString.of("template"), doc.context.register(doc.context.stream("<template/>"))]));
    if (kind === "needs appearances") form.acroForm.dict.set(PDFName.of("NeedAppearances"), doc.context.obj(true));
    if (kind === "missing AP") widget.dict.delete(PDFName.of("AP"));
    if (kind === "unsupported state AP") widget.setNormalAppearance(doc.context.obj({ On: widget.getNormalAppearance() }));
    if (kind === "nonstream AP") widget.setNormalAppearance(doc.context.register(doc.context.obj({ Type: "XObject", Subtype: "Form", BBox: [0, 0, 391, 51] })));
    if (kind === "invalid AP type") (widget.getAppearances()!.normal as PDFRawStream).dict.set(PDFName.of("Type"), PDFName.of("Metadata"));
    if (kind === "action AP") (widget.getAppearances()!.normal as PDFRawStream).dict.set(PDFName.of("S"), PDFName.of("JavaScript"));
    if (kind === "scaled AP") (widget.getAppearances()!.normal as PDFRawStream).dict.set(PDFName.of("BBox"), doc.context.obj([0, 0, 20, 20]));
    if (kind === "hidden widget") widget.setFlags(2);
    if (kind === "orphan widget") doc.getPage(0).node.Annots()!.remove(0);
    if (kind === "wrong widget page") widget.dict.set(PDFName.of("P"), doc.getPage(1).ref);
    if (kind === "unknown field") form.getTextField("synthetic.review").acroField.dict.set(PDFName.of("FT"), PDFName.of("Unsupported"));
    if (kind === "external AP") (widget.getAppearances()!.normal as PDFRawStream).dict.set(PDFName.of("F"), PDFString.of("https://unsafe.example/appearance"));
    if (kind === "mismatched radio state") {
      const radioWidget = form.getRadioGroup("synthetic.choice").acroField.getWidgets()[0];
      radioWidget.setAppearanceState(PDFName.of("0"));
    }
    const source = Buffer.from(await doc.save({ updateFieldAppearances: false }));
    const before = Buffer.from(source);
    await expect(watermarkEvidence(source, "application/pdf", identity)).rejects.toThrow(/^EVIDENCE_DERIVATIVE_REJECTED$/);
    expect(source.equals(before)).toBe(true);
  },
);

test.each(["FreeText", "Stamp", "Highlight", "Link border", "Link border style", "Link appearance", "RichMedia", "orphan Widget"])(
  "rejects visible or unsupported annotations instead of silently discarding them: %s", async (kind) => {
    const doc = await PDFDocument.create();
    const page = doc.addPage([500, 700]);
    page.drawText("Synthetic source content");
    const appearance = doc.context.register(doc.context.stream("0 0 100 40 re f", {
      Type: "XObject", Subtype: "Form", BBox: [0, 0, 100, 40], Resources: {},
    }));
    const annotation = doc.context.obj({ Type: "Annot", Subtype: kind.startsWith("Link") ? "Link" : kind === "orphan Widget" ? "Widget" : kind,
      Rect: [40, 400, 140, 440], Contents: PDFString.of("Visible synthetic annotation"),
      Border: [0, 0, kind === "Link border" ? 2 : 0], AP: { N: appearance } });
    if (kind === "FreeText" || kind.startsWith("Link border")) annotation.delete(PDFName.of("AP"));
    if (kind === "Link border style") annotation.set(PDFName.of("BS"), doc.context.obj({ W: 2, S: "S" }));
    page.node.set(PDFName.of("Annots"), doc.context.obj([doc.context.register(annotation)]));
    const source = Buffer.from(await doc.save());
    await expect(watermarkEvidence(source, "application/pdf", identity)).rejects.toThrow(/^EVIDENCE_DERIVATIVE_REJECTED$/);
  },
);

test.each(["png", "jpeg", "webp"] as const)("%s becomes deterministic PNG without changing its source", async (format) => {
  const source = await sharp(sheet).toFormat(format).toBuffer();
  const before = Buffer.from(source);
  const first = await watermarkEvidence(source, `image/${format}`, identity);
  const second = await watermarkEvidence(source, `image/${format}`, identity);
  expect(source.equals(before)).toBe(true);
  expect(first.bytes.equals(source)).toBe(false);
  expect(first.mime).toBe("image/png");
  expect(first.extension).toBe("png");
  expect(first.bytes.equals(second.bytes)).toBe(true);
  expect(first.sha256).toBe(second.sha256);
  expect(first.sha256).toBe(createHash("sha256").update(first.bytes).digest("hex"));
  expect(first.copyId).toBe(expectedCopyId);
  expect(first.copyId).toMatch(/^[a-f0-9]{32}$/);
  const metadata = await sharp(first.bytes).metadata();
  expect(metadata.width).toBe(720);
  expect(metadata.height).toBeGreaterThan(480);
  expect(metadata.hasAlpha).toBe(false);
  expectIdentity(xmpIdentity(metadata.xmp!.toString()));
});

test("watermark changes actual image pixels subtly and keeps black source text", async () => {
  const source = await sharp(sheet).png().toBuffer();
  const output = await watermarkEvidence(source, "image/png", identity);
  const original = await sharp(source).removeAlpha().raw().toBuffer();
  const watermarked = await sharp(output.bytes).extract({ left: 0, top: 0, width: 720, height: 480 }).removeAlpha().raw().toBuffer();
  let changed = 0, black = 0;
  for (let i = 0; i < original.length; i += 3) {
    if (original[i] !== watermarked[i] || original[i + 1] !== watermarked[i + 1] || original[i + 2] !== watermarked[i + 2]) changed++;
    if (original[i] === 0 && original[i + 1] === 0 && original[i + 2] === 0) {
      black++;
      expect(watermarked[i] + watermarked[i + 1] + watermarked[i + 2]).toBeLessThan(60);
    }
  }
  expect(changed).toBeGreaterThan(1000);
  expect(changed).toBeLessThan(720 * 480 / 4);
  expect(black).toBeGreaterThan(300);
});

test("normalizes EXIF rotation, flattens transparency and strips source metadata", async () => {
  const source = await sharp({ create: { width: 800, height: 640, channels: 4, background: { r: 200, g: 0, b: 0, alpha: 0 } } })
    .withMetadata({ orientation: 6 }).withExifMerge({ IFD0: { Artist: privateMarker } }).withXmp(oldXmp).png().toBuffer();
  const before = Buffer.from(source);
  const output = await watermarkEvidence(source, "image/png", identity);
  const metadata = await sharp(output.bytes).metadata();
  expect(source.equals(before)).toBe(true);
  expect(metadata.width).toBe(640);
  expect(metadata.height).toBeGreaterThan(800);
  expect(metadata.orientation).toBeUndefined();
  expect(metadata.exif).toBeUndefined();
  expect(metadata.icc).toBeUndefined();
  expect(metadata.iptc).toBeUndefined();
  expect(metadata.xmp!.toString()).not.toContain(privateMarker);
  expectIdentity(xmpIdentity(metadata.xmp!.toString()));
  const pixel = await sharp(output.bytes).extract({ left: 0, top: 0, width: 1, height: 1 }).raw().toBuffer();
  expect([...pixel].slice(0, 2)).toEqual([255, 255]);
  expect(pixel[2]).toBeGreaterThanOrEqual(254);
});

test("copy ID uses only the publisher and unambiguous review/file pair across formats", async () => {
  const source = await sharp(sheet).png().toBuffer();
  const ordinary = await watermarkEvidence(source, "image/png", identity);
  const obsolete = { ...identity, reviewedAt: "ignored", verificationUrl: "https://synthetic.example/ignored", sourceName: privateMarker };
  const repeated = await watermarkEvidence(source, "image/png", obsolete);
  expect(repeated.bytes.equals(ordinary.bytes)).toBe(true);
  expect((await watermarkEvidence(await fixturePdf(), "application/pdf", identity)).copyId).toBe(ordinary.copyId);
  const pairs = [{ reviewId: "ab", fileId: "c" }, { reviewId: "a", fileId: "bc" },
    { ...identity, reviewId: "other-review" }, { ...identity, fileId: "other-file" }];
  const ids = [ordinary.copyId];
  for (const pair of pairs) ids.push((await watermarkEvidence(source, "image/png", pair)).copyId);
  expect(new Set(ids).size).toBe(ids.length);
});

test("PNG trace survives metadata stripping and exact file copies with blue-only delta at most one", async () => {
  const source = await sharp(sheet).png().toBuffer();
  const output = await watermarkEvidence(source, "image/png", identity);
  const stripped = await sharp(output.bytes).png().toBuffer();
  const metadata = await sharp(stripped).metadata();
  expect(metadata.xmp).toBeUndefined();
  expect(metadata.exif).toBeUndefined();
  expect(await decodePngTrace(Buffer.from(stripped))).toBe(output.copyId);
  expect(await decodePngTrace(Buffer.from(output.bytes))).toBe(output.copyId);
  const overlay = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="720" height="524">
    <defs><pattern id="mark" width="260" height="150" patternUnits="userSpaceOnUse">
      <text x="24" y="80" transform="rotate(-20 24 80)" font-family="sans-serif" font-size="24" fill="#2563a6" opacity="0.10">PT Career</text>
    </pattern></defs><rect width="720" height="480" fill="url(#mark)"/>
    <rect y="480" width="720" height="44" fill="white"/>
    <path d="M0 481H720" stroke="#2563a6"/>
    <text x="12" y="504" font-family="monospace" font-size="14" fill="#174b80">PT Career</text></svg>`);
  const visibleOnly = await sharp(source).flatten({ background: "white" }).removeAlpha()
    .extend({ left: 0, right: 0, top: 0, bottom: 44, background: "white" })
    .composite([{ input: overlay }]).toColourspace("srgb").removeAlpha().raw().toBuffer();
  const traced = await sharp(output.bytes).raw().toBuffer();
  expect(traced.equals(await sharp(stripped).raw().toBuffer())).toBe(true);
  const indices = traceIndices(720, 524, (Buffer.byteLength(`${namespace}:`) + 32 + 8) * 8 * 3);
  expect(new Set(indices).size).toBe(indices.length);
  expect(Math.max(...indices) - Math.min(...indices)).toBeGreaterThan(720 * 524 * 0.95);
  const selected = new Set(indices);
  let maxRed = 0, maxGreen = 0, maxBlue = 0, changed = 0, unexpected = 0;
  for (let p = 0; p < traced.length; p += 3) {
    maxRed = Math.max(maxRed, Math.abs(traced[p] - visibleOnly[p]));
    maxGreen = Math.max(maxGreen, Math.abs(traced[p + 1] - visibleOnly[p + 1]));
    maxBlue = Math.max(maxBlue, Math.abs(traced[p + 2] - visibleOnly[p + 2]));
    if (traced[p + 2] !== visibleOnly[p + 2]) {
      changed++;
      if (!selected.has(p / 3)) unexpected++;
    }
  }
  expect([maxRed, maxGreen, maxBlue, unexpected]).toEqual([0, 0, 1, 0]);
  expect(changed).toBeGreaterThan(0);
  expect(changed).toBeLessThanOrEqual(indices.length);
});

test.each([[1, 1], [37, 13], [721, 481]])("PNG trace round-trips on %s x %s grayscale inputs", async (width, height) => {
  const source = await sharp({ create: { width, height, channels: 3, background: "white" } }).greyscale().png().toBuffer();
  const output = await watermarkEvidence(source, "image/png", identity);
  expect(await decodePngTrace(await sharp(output.bytes).png().toBuffer())).toBe(expectedCopyId);
});

test("PNG trace repeats recover one damaged payload and the checksum rejects damage in every copy", async () => {
  const output = await watermarkEvidence(await sharp(sheet).png().toBuffer(), "image/png", identity);
  const { data, info } = await sharp(output.bytes).raw().toBuffer({ resolveWithObject: true });
  const bits = (Buffer.byteLength(`${namespace}:`) + 32 + 8) * 8;
  const indices = traceIndices(info.width, info.height, bits * 3);
  const mutate = (repeat: number) => { data[indices[repeat * bits + Buffer.byteLength(`${namespace}:`) * 8] * 3 + 2] ^= 1; };
  const encode = () => sharp(data, { raw: info }).png().toBuffer();
  mutate(0);
  expect(await decodePngTrace(await encode())).toBe(expectedCopyId);
  mutate(1);
  mutate(2);
  expect(await decodePngTrace(await encode())).toBeUndefined();
});

test("fresh PDF covers every page, preserves orientation and has public-copy metadata without authenticity claims", async () => {
  const source = await fixturePdf();
  const before = Buffer.from(source);
  const first = await watermarkEvidence(source, "application/pdf", identity);
  const second = await watermarkEvidence(source, "application/pdf", identity);
  expect(source.equals(before)).toBe(true);
  expect(first.bytes.equals(second.bytes)).toBe(true);
  expect(first.sha256).toBe(second.sha256);
  expect(first.sha256).toBe(createHash("sha256").update(first.bytes).digest("hex"));
  expect(first.mime).toBe("application/pdf");
  expect(first.extension).toBe("pdf");
  expect(first.copyId).toBe(expectedCopyId);
  const doc = await PDFDocument.load(first.bytes, { updateMetadata: false });
  expect(doc.getPageCount()).toBe(5);
  expect(doc.getTitle()).toBe("PT Career public copy");
  expect(doc.getAuthor()).toBeUndefined();
  expect(doc.getCreator()).toBeUndefined();
  expect(doc.getProducer()).toBeUndefined();
  expect(doc.getCreationDate()).toBeUndefined();
  expect(doc.getModificationDate()).toBeUndefined();
  expectIdentity(JSON.parse(doc.getSubject()!));
  const packet = doc.catalog.lookup(PDFName.of("Metadata")) as PDFRawStream;
  expectIdentity(xmpIdentity(Buffer.from(packet.contents).toString()));
  const sizes = [[500, 700], [700, 500], [500, 700], [640, 460], [500, 700]];
  for (const [i, page] of doc.getPages().entries()) {
    expect(page.getWidth()).toBe(sizes[i][0]);
    expect(page.getHeight()).toBeGreaterThan(sizes[i][1]);
    expect(page.getRotation().angle).toBe(0);
    const contents = page.node.Contents() as PDFArray;
    const operators = Array.from({ length: contents.size() }, (_, j) =>
      Buffer.from(decodePDFRawStream(contents.lookup(j, PDFRawStream)).decode()).toString()).join("\n");
    expect(operators).toContain("505420436172656572");
    const texts = [...operators.matchAll(/<([\da-f]+)> Tj/gi)].map((match) => PDFHexString.of(match[1]).decodeText());
    expect(texts).toContain(`${namespace}:${first.copyId}`);
    expect(new Set(texts.filter((text) => text !== `${namespace}:${first.copyId}`))).toEqual(new Set(["PT Career"]));
    expect(texts.join("\n")).not.toMatch(/admin|reviewed|verified|verification|authentic|credential|https?:/i);
    expect(texts.join("\n")).not.toContain(identity.reviewId);
    expect(texts.join("\n")).not.toContain(identity.fileId);
    expect(operators).toContain(" Do");
    expect((operators.match(/505420436172656572/g) ?? []).length).toBeGreaterThan(2);
  }
  for (const [, object] of doc.context.enumerateIndirectObjects()) {
    const dict = object instanceof PDFRawStream ? object.dict : object instanceof PDFDict ? object : undefined;
    if (!dict) continue;
    for (const key of ["Annots", "AA", "A", "OpenAction", "JS", "JavaScript", "EmbeddedFiles", "EF", "AF", "AcroForm", "XFA"]) {
      expect(dict.has(PDFName.of(key))).toBe(false);
    }
  }
  expect(first.bytes.toString("latin1")).not.toMatch(/UNSAFE_SYNTHETIC|PRIVATE_SYNTHETIC/);
  expect(first.bytes.toString("latin1")).not.toContain(Buffer.from(privateMarker, "utf16le").swap16().toString("hex").toUpperCase());
});

test("every PDF page retains zero-opacity trace text after removing XMP and info metadata", async () => {
  const output = await watermarkEvidence(await fixturePdf(), "application/pdf", identity);
  const stripped = await PDFDocument.load(output.bytes, { updateMetadata: false });
  stripPdfMetadata(stripped);
  const doc = await PDFDocument.load(await stripped.save({ useObjectStreams: false }), { updateMetadata: false });
  expect(doc.catalog.has(PDFName.of("Metadata"))).toBe(false);
  expect(doc.context.trailerInfo.Info).toBeUndefined();
  for (const page of doc.getPages()) {
    const contents = page.node.Contents() as PDFArray;
    const operators = Array.from({ length: contents.size() }, (_, j) =>
      Buffer.from(decodePDFRawStream(contents.lookup(j, PDFRawStream)).decode()).toString()).join("\n");
    const block = pdfTraceBlock(operators, output.copyId);
    expect(block).toBeDefined();
    const text = block!.match(/<([\da-f]+)> Tj/i)![1];
    expect(PDFHexString.of(text).decodeText()).toBe(`${namespace}:${output.copyId}`);
    const stateName = block!.match(/\/([^\s]+) gs/)![1];
    const state = page.node.Resources()!.lookup(PDFName.of("ExtGState"), PDFDict).lookup(PDFName.of(stateName), PDFDict);
    expect(state.lookup(PDFName.of("ca"), PDFNumber).asNumber()).toBe(0);
  }
});

test("unsafe objects smuggled through page resources are stripped, including shared actions", async () => {
  const doc = await PDFDocument.create();
  const page = doc.addPage([500, 700]);
  page.drawText("Synthetic content remains");
  const action = doc.context.register(doc.context.obj({ S: "Launch", F: PDFString.of("UNSAFE_SYNTHETIC_RESOURCE") }));
  page.node.Resources()!.set(PDFName.of("Properties"), doc.context.obj({ First: action, Second: action }));
  const source = Buffer.from(await doc.save());
  const output = await watermarkEvidence(source, "application/pdf", identity);
  expect(output.bytes.toString("latin1")).not.toMatch(/UNSAFE_SYNTHETIC|\/Launch/);
});

const renderPdfTest = spawnSync("pdftoppm", ["-v"], { stdio: "ignore" }).status === 0 ? test : test.skip;
renderPdfTest.each([["artwork", fixturePdf], ["form appearances", fixtureFormPdf]] as const)("PDF pages really render %s plus a visible blue watermark and separate footer", async (_, fixture) => {
  const source = await fixture();
  const output = await watermarkEvidence(source, "application/pdf", identity);
  const folder = mkdtempSync(join(tmpdir(), "pt-evidence-test-"));
  try {
    const visibleOnly = await PDFDocument.load(output.bytes, { updateMetadata: false });
    stripPdfMetadata(visibleOnly);
    let removed = 0;
    for (const page of visibleOnly.getPages()) {
      const contents = page.node.Contents() as PDFArray;
      for (let j = 0; j < contents.size(); j++) {
        const operators = Buffer.from(decodePDFRawStream(contents.lookup(j, PDFRawStream)).decode()).toString();
        const block = pdfTraceBlock(operators, output.copyId);
        if (!block) continue;
        removed++;
        visibleOnly.context.assign(contents.get(j) as PDFRef, visibleOnly.context.flateStream(operators.replace(block, "")));
      }
    }
    expect(removed).toBe(visibleOnly.getPageCount());
    writeFileSync(join(folder, "source.pdf"), source);
    writeFileSync(join(folder, "public.pdf"), output.bytes);
    writeFileSync(join(folder, "visible-only.pdf"), await visibleOnly.save({ useObjectStreams: false }));
    for (const name of ["source", "public", "visible-only"]) {
      execFileSync("pdftoppm", ["-cropbox", "-r", "72", "-png", join(folder, `${name}.pdf`), join(folder, name)], { stdio: "ignore" });
    }
    for (let i = 1; i <= (await PDFDocument.load(source)).getPageCount(); i++) {
      const original = await sharp(readFileSync(join(folder, `source-${i}.png`))).removeAlpha().raw().toBuffer({ resolveWithObject: true });
      const markedBytes = readFileSync(join(folder, `public-${i}.png`));
      const rendered = await sharp(markedBytes).raw().toBuffer();
      expect(rendered.equals(await sharp(readFileSync(join(folder, `visible-only-${i}.png`))).raw().toBuffer())).toBe(true);
      const marked = await sharp(markedBytes).extract({ left: 0, top: 0, width: original.info.width, height: original.info.height })
        .removeAlpha().raw().toBuffer();
      let changes = 0, retainedDark = 0, originalDark = 0;
      for (let p = 0; p < marked.length; p += 3) {
        if (!marked.subarray(p, p + 3).equals(original.data.subarray(p, p + 3))) changes++;
        if (original.data[p] < 80 && original.data[p + 1] < 80 && original.data[p + 2] < 80) {
          originalDark++;
          const pixel = p / 3, x = pixel % original.info.width, y = Math.floor(pixel / original.info.width);
          const nearby = [-1, 0, 1].some((dy) => [-1, 0, 1].some((dx) => {
            if (x + dx < 0 || x + dx >= original.info.width || y + dy < 0 || y + dy >= original.info.height) return false;
            const q = ((y + dy) * original.info.width + x + dx) * 3;
            return marked[q] < 100 && marked[q + 1] < 100 && marked[q + 2] < 100;
          }));
          if (nearby) retainedDark++;
        }
      }
      expect(changes).toBeGreaterThan(1000);
      expect(changes).toBeLessThan(original.info.width * original.info.height / 4);
      expect(originalDark).toBeGreaterThan(100);
      expect(retainedDark / originalDark).toBeGreaterThan(0.98);
      const meta = await sharp(markedBytes).metadata();
      const band = await sharp(markedBytes).extract({ left: 0, top: original.info.height + 2,
        width: meta.width!, height: meta.height! - original.info.height - 2 }).stats();
      expect(band.channels[0].min).toBeLessThan(100);
    }
  } finally {
    for (const name of readdirSync(folder)) unlinkSync(join(folder, name));
    rmdirSync(folder);
  }
});

test.each([
  ["image/png", Buffer.from("not an image")],
  ["application/pdf", Buffer.from("%PDF-1.7\ninvalid\n%%EOF")],
  ["image/svg+xml", sheet],
  ["image/gif", Buffer.from("GIF89a")],
  ["image/png", Buffer.from("%PDF-1.7\n%%EOF")],
])("rejects unsupported/malformed input without fallback: %s", async (mime, source) => {
  await expect(watermarkEvidence(source, mime, identity)).rejects.toThrow("EVIDENCE_DERIVATIVE_REJECTED");
});

test("rejects valid files mislabeled with another accepted MIME", async () => {
  const png = await sharp(sheet).png().toBuffer();
  for (const mime of ["image/jpeg", "image/webp", "application/pdf"]) {
    await expect(watermarkEvidence(png, mime, identity)).rejects.toThrow("EVIDENCE_DERIVATIVE_REJECTED");
  }
  await expect(watermarkEvidence(await fixturePdf(), "image/png", identity)).rejects.toThrow("EVIDENCE_DERIVATIVE_REJECTED");
});

test("rejects byte and decoded pixel limits", async () => {
  await expect(watermarkEvidence(Buffer.alloc(10 * 1024 * 1024 + 1), "image/png", identity)).rejects.toThrow("EVIDENCE_DERIVATIVE_REJECTED");
  const large = await sharp({ create: { width: 10_000, height: 4001, channels: 3, background: "white" } }).png().toBuffer();
  expect(large.length).toBeLessThan(10 * 1024 * 1024);
  await expect(watermarkEvidence(large, "image/png", identity)).rejects.toThrow("EVIDENCE_DERIVATIVE_REJECTED");
});

test("rejects animated WebP and APNG rather than returning the first frame", async () => {
  const pixels = Buffer.alloc(64 * 128 * 3, 255);
  pixels.fill(0, 64 * 64 * 3);
  const animated = await sharp(pixels, { raw: { width: 64, height: 128, pageHeight: 64, channels: 3 } })
    .webp({ loop: 0, delay: [100, 100] }).toBuffer();
  expect((await sharp(animated, { animated: true }).metadata()).pages).toBe(2);
  await expect(watermarkEvidence(animated, "image/webp", identity)).rejects.toThrow("EVIDENCE_DERIVATIVE_REJECTED");
  const png = await sharp(sheet).png().toBuffer();
  const chunk = (type: string, data: Buffer) => {
    const bytes = Buffer.concat([Buffer.alloc(4), Buffer.from(type), data, Buffer.alloc(4)]);
    bytes.writeUInt32BE(data.length);
    let crc = 0xffffffff;
    for (const byte of bytes.subarray(4, -4)) {
      crc ^= byte;
      for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
    }
    bytes.writeUInt32BE((crc ^ 0xffffffff) >>> 0, bytes.length - 4);
    return bytes;
  };
  const idat: Buffer[] = [];
  for (let p = 8; p + 12 <= png.length;) {
    const length = png.readUInt32BE(p);
    if (png.toString("ascii", p + 4, p + 8) === "IDAT") idat.push(png.subarray(p + 8, p + 8 + length));
    p += length + 12;
  }
  const control = Buffer.alloc(8);
  control.writeUInt32BE(2);
  const frame = Buffer.alloc(26);
  frame.writeUInt32BE(720, 4); frame.writeUInt32BE(480, 8);
  frame.writeUInt16BE(1, 20); frame.writeUInt16BE(10, 22);
  const secondFrame = Buffer.from(frame); secondFrame.writeUInt32BE(1);
  const sequence = Buffer.alloc(4); sequence.writeUInt32BE(2);
  const apng = Buffer.concat([png.subarray(0, 33), chunk("acTL", control), chunk("fcTL", frame),
    chunk("IDAT", Buffer.concat(idat)), chunk("fcTL", secondFrame),
    chunk("fdAT", Buffer.concat([sequence, ...idat])), chunk("IEND", Buffer.alloc(0))]);
  await expect(watermarkEvidence(apng, "image/png", identity)).rejects.toThrow("EVIDENCE_DERIVATIVE_REJECTED");
});

test("rejects encrypted, excessive-page and pathological PDF inputs", async () => {
  const encrypted = await PDFDocument.create();
  encrypted.addPage();
  encrypted.context.trailerInfo.Encrypt = encrypted.context.register(encrypted.context.obj({ Filter: "Standard", V: 1, R: 2 }));
  await expect(watermarkEvidence(Buffer.from(await encrypted.save()), "application/pdf", identity)).rejects.toThrow("EVIDENCE_DERIVATIVE_REJECTED");
  const many = await PDFDocument.create();
  for (let i = 0; i < 51; i++) many.addPage();
  await expect(watermarkEvidence(Buffer.from(await many.save()), "application/pdf", identity)).rejects.toThrow("EVIDENCE_DERIVATIVE_REJECTED");
  for (const dimensions of [[20_000, 700], [0, 700], [500, -1]]) {
    const doc = await PDFDocument.create();
    doc.addPage().node.set(PDFName.of("MediaBox"), doc.context.obj([0, 0, ...dimensions]));
    await expect(watermarkEvidence(Buffer.from(await doc.save()), "application/pdf", identity)).rejects.toThrow("EVIDENCE_DERIVATIVE_REJECTED");
  }
});

test("rejects invalid identity data without leaking parser errors", async () => {
  const source = await sharp(sheet).png().toBuffer();
  const invalid = [undefined, null, 42, {}, [], "", "   ", "bad\nidentity", "bad\u0000identity", "bad\u007fidentity", "x".repeat(4097)];
  for (const key of ["reviewId", "fileId"]) {
    for (const value of invalid) {
      await expect(watermarkEvidence(source, "image/png", { ...identity, [key]: value } as PublicEvidenceIdentity))
        .rejects.toThrow(/^EVIDENCE_DERIVATIVE_REJECTED$/);
    }
  }
  for (const value of [null, undefined]) {
    await expect(watermarkEvidence(source, "image/png", value as unknown as PublicEvidenceIdentity))
      .rejects.toThrow(/^EVIDENCE_DERIVATIVE_REJECTED$/);
  }
});
