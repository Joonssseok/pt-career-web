/** @jest-environment jsdom */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import {
  imageCropValid,
  imagePresentationValid,
  type ImageCrop,
} from "../lib/profile-versions/image-presentation";
import { validateDetailDocument } from "../lib/profile-versions/detail-document";
import { PhotoPresentation } from "../components/profile-editor/PhotoPresentation";
import { DetailContent } from "../components/profile-editor/DetailContent";

afterEach(cleanup);
const fileId = "11111111-1111-4111-8111-111111111111";
const imageAttrs = { fileId, mime: "image/gif" };
const crop: ImageCrop = { x: 10, y: 20, width: 50, height: 25 };
const doc = (attrs: Record<string, unknown>) => ({
  type: "doc",
  content: [{ type: "profileMedia", attrs }],
});

test.each([10, 50, 100])(
  "accepts and preserves integer widthPercent %s",
  (widthPercent) => {
    const attrs = { ...imageAttrs, widthPercent, crop };
    expect(imagePresentationValid(attrs)).toBe(true);
    const checked = validateDetailDocument(doc(attrs));
    expect(checked.ok).toBe(true);
    if (checked.ok) expect(checked.document.content[0].attrs).toEqual(attrs);
  },
);

test.each([9, 101, 10.1, NaN, Infinity, -Infinity, "50", null, undefined])(
  "rejects invalid widthPercent %s",
  (widthPercent) => {
    expect(imagePresentationValid({ ...imageAttrs, widthPercent })).toBe(false);
    expect(
      validateDetailDocument(doc({ ...imageAttrs, widthPercent })).ok,
    ).toBe(false);
  },
);

test.each([
  { x: 0, y: 0, width: 100, height: 100 },
  { x: 99, y: 99, width: 1, height: 1 },
  { x: 0.25, y: 1.5, width: 50.5, height: 25.25 },
  { x: 99.0000005, y: 0, width: 1, height: 100 },
  { x: 0, y: 99.0000005, width: 100, height: 1 },
])(
  "accepts bounded fractional crop %j and floating-point tolerance",
  (value) => {
    expect(imageCropValid(value)).toBe(true);
    expect(validateDetailDocument(doc({ ...imageAttrs, crop: value })).ok).toBe(
      true,
    );
  },
);

test.each([
  { ...crop, x: -1 },
  { ...crop, y: -1 },
  { ...crop, x: 101 },
  { ...crop, y: 101 },
  { ...crop, width: 0.99 },
  { ...crop, height: 0.99 },
  { ...crop, width: 101 },
  { ...crop, height: 101 },
  { ...crop, x: 99.000002, width: 1 },
  { ...crop, y: 99.000002, height: 1 },
  { ...crop, x: NaN },
  { ...crop, y: Infinity },
  { ...crop, width: -Infinity },
  { ...crop, height: NaN },
  { ...crop, x: "10" },
  { ...crop, width: null },
  { x: 0, y: 0, width: 10 },
  { ...crop, rotate: 90 },
  { ...crop, src: "https://external.test/image" },
  [],
  null,
  "crop",
])("rejects malformed or unsupported crop %j", (value) => {
  expect(imageCropValid(value)).toBe(false);
  expect(imagePresentationValid({ ...imageAttrs, crop: value })).toBe(false);
  expect(validateDetailDocument(doc({ ...imageAttrs, crop: value })).ok).toBe(
    false,
  );
});

test.each(["video/mp4", "video/webm"])(
  "rejects all presentation fields on %s while allowing legacy video nodes",
  (mime) => {
    const attrs = { fileId, mime };
    expect(imagePresentationValid(attrs)).toBe(true);
    expect(validateDetailDocument(doc(attrs)).ok).toBe(true);
    for (const geometry of [{ widthPercent: 100 }, { crop }, { crop: null }]) {
      expect(imagePresentationValid({ ...attrs, ...geometry })).toBe(false);
      expect(validateDetailDocument(doc({ ...attrs, ...geometry })).ok).toBe(
        false,
      );
    }
  },
);

test.each(["src", "style", "onerror", "transform", "width", "height"])(
  "rejects arbitrary media attribute %s",
  (key) => {
    const attrs = { ...imageAttrs, [key]: "untrusted" };
    expect(imagePresentationValid(attrs)).toBe(false);
    expect(validateDetailDocument(doc(attrs)).ok).toBe(false);
  },
);

test("legacy images without presentation attributes remain valid", () => {
  for (const mime of ["image/jpeg", "image/png", "image/webp", "image/gif"]) {
    expect(imagePresentationValid({ fileId, mime })).toBe(true);
    expect(validateDetailDocument(doc({ fileId, mime })).ok).toBe(true);
  }
});

function loadImage(image: HTMLImageElement, width: number, height: number) {
  Object.defineProperty(image, "naturalWidth", {
    value: width,
    configurable: true,
  });
  Object.defineProperty(image, "naturalHeight", {
    value: height,
    configurable: true,
  });
  fireEvent.load(image);
}

test("cropping keeps the original animated GIF URL and applies normalized viewport positions without canvas", () => {
  const onNaturalSize = jest.fn();
  const src = "/api/profile-detail-images/animated-gif?original=1";
  const { container } = render(
    <PhotoPresentation
      src={src}
      alt="원본 GIF"
      widthPercent={60}
      crop={crop}
      onNaturalSize={onNaturalSize}
    />,
  );
  const image = screen.getByRole("img", {
    name: "원본 GIF",
  }) as HTMLImageElement;
  expect(
    Number(screen.getByTestId("photo-presentation").style.aspectRatio),
  ).toBeCloseTo(2);
  loadImage(image, 1200, 800);
  const viewport = screen.getByTestId("photo-presentation");
  expect(viewport.style.width).toBe("60%");
  expect(viewport.style.maxWidth).toBe("100%");
  expect(viewport.style.overflow).toBe("hidden");
  expect(Number(viewport.style.aspectRatio)).toBeCloseTo(3);
  expect(image.style.position).toBe("absolute");
  expect(image.style.width).toBe("200%");
  expect(image.style.maxWidth).toBe("none");
  expect(image.style.left).toBe("-20%");
  expect(image.style.top).toBe("-80%");
  expect(image.getAttribute("src")).toBe(src);
  expect(image.hasAttribute("srcset")).toBe(false);
  expect(container.querySelector("canvas")).toBeNull();
  expect(onNaturalSize).toHaveBeenCalledWith({ width: 1200, height: 800 });
});

test("uncropped images retain natural auto height and full original pixels", () => {
  render(<PhotoPresentation src="/original" widthPercent={35} />);
  const image = screen.getByRole("img", {
    name: "상세소개 사진",
  }) as HTMLImageElement;
  loadImage(image, 600, 1200);
  expect(screen.getByTestId("photo-presentation").style.width).toBe("35%");
  expect(screen.getByTestId("photo-presentation").style.aspectRatio).toBe("");
  expect(image.style.height).toBe("auto");
  expect(image.style.width).toBe("100%");
  expect(image.style.position).toBe("");
  expect(image.getAttribute("src")).toBe("/original");
});

test("a changed original source never reuses the previous image's natural ratio", () => {
  const view = render(<PhotoPresentation src="/landscape" crop={crop} />);
  const image = screen.getByRole("img") as HTMLImageElement;
  loadImage(image, 1200, 800);
  expect(
    Number(screen.getByTestId("photo-presentation").style.aspectRatio),
  ).toBeCloseTo(3);
  view.rerender(<PhotoPresentation src="/portrait" crop={crop} />);
  expect(
    Number(screen.getByTestId("photo-presentation").style.aspectRatio),
  ).toBeCloseTo(2);
  loadImage(image, 600, 1200);
  expect(
    Number(screen.getByTestId("photo-presentation").style.aspectRatio),
  ).toBeCloseTo(1);
});

test("public DetailContent uses saved geometry with only an authorized original URL", () => {
  const src = `/api/profile-detail-images/${fileId}`;
  const { container } = render(
    <DetailContent
      document={doc({ ...imageAttrs, widthPercent: 40, crop })}
      images={[
        { id: fileId, name: "original.gif", size: 10, src, mime: "image/gif" },
      ]}
    />,
  );
  const image = screen.getByRole("img") as HTMLImageElement;
  loadImage(image, 1200, 800);
  expect(image.getAttribute("src")).toBe(src);
  expect(screen.getByTestId("photo-presentation").style.width).toBe("40%");
  expect(
    Number(screen.getByTestId("photo-presentation").style.aspectRatio),
  ).toBeCloseTo(3);
  expect(container.querySelector("canvas")).toBeNull();
});

test("public geometry cannot render an unregistered image", () => {
  const { container } = render(
    <DetailContent document={doc({ ...imageAttrs, crop })} images={[]} />,
  );
  expect(container.querySelector("img")).toBeNull();
});
