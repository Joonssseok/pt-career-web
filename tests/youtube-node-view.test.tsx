/** @jest-environment jsdom */
import { act, fireEvent, waitFor, render } from "@testing-library/react";
import { Editor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { YoutubeVideoNode } from "@/components/profile-editor/DetailMediaNodes";

test("YouTube width updates the document, survives reopening and respects save-time editability", async () => {
  const element = document.createElement("div");
  document.body.append(element);
  let editor!: Editor;
  await act(async () => {
    editor = new Editor({
      element,
      extensions: [StarterKit, YoutubeVideoNode],
      content: {
        type: "doc",
        content: [
          {
            type: "youtubeVideo",
            attrs: { videoId: "abcdefghijk", widthPercent: 60 },
          },
        ],
      },
    });
  });
  const content = render(<EditorContent editor={editor} />);
  const host = content.container;
  try {
    const slider = host.querySelector(
      'input[aria-label="유튜브 너비"]',
    ) as HTMLInputElement;
    expect(slider.value).toBe("60");
    await act(async () => {
      fireEvent.change(slider, { target: { value: "45" } });
    });
    expect(editor.getJSON().content?.[0].attrs).toMatchObject({
      videoId: "abcdefghijk",
      widthPercent: 45,
    });
    const saved = editor.getJSON();
    await act(async () => {
      editor.commands.setContent(saved);
    });
    expect(
      (
        host.querySelector(
          'input[aria-label="유튜브 너비"]',
        ) as HTMLInputElement
      ).value,
    ).toBe("45");
    await act(async () => {
      editor.setEditable(false, false);
    });
    await waitFor(() =>
      expect(
        (
          host.querySelector(
            'input[aria-label="유튜브 너비"]',
          ) as HTMLInputElement
        ).disabled,
      ).toBe(true),
    );
    await act(async () => {
      editor.setEditable(true, false);
    });
    await waitFor(() =>
      expect(
        (
          host.querySelector(
            'input[aria-label="유튜브 너비"]',
          ) as HTMLInputElement
        ).disabled,
      ).toBe(false),
    );
    await act(async () => {
      fireEvent.click(
        Array.from(host.querySelectorAll("button")).find(
          (e) => e.textContent === "너비 초기화",
        )!,
      );
    });
    expect(editor.getJSON().content?.[0].attrs?.widthPercent).toBeNull();
  } finally {
    await act(async () => {
      editor.destroy();
    });
    content.unmount();
    element.remove();
  }
});
