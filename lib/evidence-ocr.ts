import {
  requiredEvidenceText,
  sensitiveEvidenceText,
  type MaskWord,
} from "./evidence-masking";
export async function recognizeEvidence(
  source: HTMLCanvasElement,
  ownName: string,
  signal: AbortSignal,
): Promise<MaskWord[]> {
  const { createWorker } = await import("tesseract.js");
  let worker: Awaited<ReturnType<typeof createWorker>> | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let stopped = false;
  const cancel = () => {
    void worker?.terminate();
  };
  let rejectInterrupted: (error: Error) => void = () => {};
  const stop = () => {
    stopped = true;
    cancel();
    rejectInterrupted(new Error("글자를 찾지 못했어요. 끌어서 가려 주세요."));
  };
  const interrupted = new Promise<never>((_, reject) => {
    rejectInterrupted = reject;
    timer = setTimeout(stop, 20000);
    signal.addEventListener("abort", stop, { once: true });
  });
  try {
    return await Promise.race([
      interrupted,
      (async () => {
        worker = await createWorker(["kor", "eng"], 1, {
          workerPath: "/evidence-ocr/worker.min.js",
          corePath: "/evidence-ocr",
          langPath: "/evidence-ocr",
          workerBlobURL: false,
        });
        if (signal.aborted || stopped) {
          cancel();
          return [];
        }
        const scale = Math.min(1, 1800 / Math.max(source.width, source.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(source.width * scale);
        canvas.height = Math.round(source.height * scale);
        canvas
          .getContext("2d")!
          .drawImage(source, 0, 0, canvas.width, canvas.height);
        const result = await worker.recognize(
          canvas,
          {},
          { blocks: true, text: true },
        );
        const words: MaskWord[] = [];
        for (const block of result.data.blocks ?? [])
          for (const paragraph of block.paragraphs)
            for (const line of paragraph.lines) {
              const text = line.words.map((word) => word.text).join(" ");
              const sensitive = sensitiveEvidenceText(text.replace(/\s/g, ""));
              const identity = line.words.find((word) =>
                /\d{6}[-–]\d{7}/.test(word.text),
              );
              if (text.trim()) {
                const b = identity ? identity.bbox : line.bbox;
                const identityStart = identity
                  ? b.x0 + (b.x1 - b.x0) / 2
                  : b.x0;
                words.push({
                  id: String(words.length),
                  text: identity ? "주민등록번호 뒷자리" : text,
                  x: identityStart / canvas.width,
                  y: b.y0 / canvas.height,
                  width: (b.x1 - identityStart) / canvas.width,
                  height: (b.y1 - b.y0) / canvas.height,
                  sensitive,
                  required: !identity && requiredEvidenceText(text, ownName),
                });
              }
            }
        return words;
      })(),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
    signal.removeEventListener("abort", stop);
    cancel();
  }
}
