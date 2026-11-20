import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const destination = path.resolve("public/evidence-ocr");
fs.mkdirSync(destination, { recursive: true });
const roots = Object.fromEntries(
  [
    "tesseract.js",
    "tesseract.js-core",
    "@tesseract.js-data/kor",
    "@tesseract.js-data/eng",
  ].map((name) => [
    name,
    path.dirname(require.resolve(`${name}/package.json`)),
  ]),
);
const entries = [
  [roots["tesseract.js"], "dist/worker.min.js", "worker.min.js"],
  ...[
    "tesseract-core.wasm.js",
    "tesseract-core-simd.wasm.js",
    "tesseract-core-lstm.wasm.js",
    "tesseract-core-simd-lstm.wasm.js",
  ].map((name) => [roots["tesseract.js-core"], name, name]),
  ...["kor", "eng"].map((lang) => [
    roots[`@tesseract.js-data/${lang}`],
    "4.0.0_best_int/" + lang + ".traineddata.gz",
    lang + ".traineddata.gz",
  ]),
];
for (const [root, source, target] of entries)
  fs.copyFileSync(path.join(root, source), path.join(destination, target));
for (const name of ["tesseract.js", "tesseract.js-core"])
  fs.copyFileSync(
    path.join(roots[name], name === "tesseract.js" ? "LICENSE.md" : "LICENSE"),
    path.join(destination, name + "-LICENSE.txt"),
  );
console.log(
  "Prepared local OCR worker, engine and Korean/English language assets.",
);
