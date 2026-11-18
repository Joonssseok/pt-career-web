/** @jest-environment jsdom */
import { act, fireEvent, waitFor } from "@testing-library/react";
import { Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { ProfileMediaNode } from "@/components/profile-editor/DetailMediaNodes";
test("image node mounts before editor.view is exposed and tracks save-time editability", async () => {
  const element = document.createElement("div");
  document.body.appendChild(element);
  let editor!: Editor;
  await act(async () => {
    editor = new Editor({
      element,
      extensions: [StarterKit, ProfileMediaNode],
      content: {
        type: "doc",
        content: [
          {
            type: "profileMedia",
            attrs: {
              fileId: "11111111-1111-4111-8111-111111111111",
              mime: "image/png",
              src: "/original.png",
              widthPercent: 60,
            },
          },
        ],
      },
    });
  });
  try {
    const slider = element.querySelector(
      'input[aria-label="사진 너비"]',
    ) as HTMLInputElement;
    expect(slider).toBeTruthy();
    expect(slider.disabled).toBe(false);
    await act(async () => {
      editor.setEditable(false, false);
    });
    await waitFor(() => expect(slider.disabled).toBe(true));
    await act(async () => {
      editor.setEditable(true, false);
    });
    await waitFor(() => expect(slider.disabled).toBe(false));
    await act(async () => {
      fireEvent.keyDown(
        element.querySelector('button[aria-label="사진 오른쪽 크기 조절"]')!,
        { key: "ArrowLeft" },
      );
    });
    expect(editor.getJSON().content?.[0].attrs?.widthPercent).toBe(59);
    expect(editor.getJSON().content?.[0].attrs?.src).toBe("/original.png");
  } finally {
    await act(async () => {
      editor.destroy();
    });
    element.remove();
  }
});
