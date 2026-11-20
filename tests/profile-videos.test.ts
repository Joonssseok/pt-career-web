import { profileVideoTitle, youtubeTitle } from "@/lib/profile-videos";
import { youtubeVideoId } from "@/lib/profile-versions/detail-document";

describe("video inputs", () => {
  it("uses existing strict YouTube parser", () => {
    for (const url of [
      "https://youtu.be/ABCDEFGHIJK",
      "https://www.youtube.com/watch?v=ABCDEFGHIJK",
      "https://youtube.com/shorts/ABCDEFGHIJK",
      "https://youtube.com/embed/ABCDEFGHIJK",
      "https://youtube.com/live/ABCDEFGHIJK",
    ])
      expect(youtubeVideoId(url)).toBe("ABCDEFGHIJK");
    for (const url of [
      "https://youtube.com.attacker.test/watch?v=ABCDEFGHIJK",
      "http://youtube.com/watch?v=ABCDEFGHIJK",
      "https://user:pass@youtube.com/watch?v=ABCDEFGHIJK",
      "javascript:alert(1)",
    ])
      expect(youtubeVideoId(url)).toBeNull();
  });
  it("requires plain nonempty title with 80 unicode characters maximum", () => {
    expect(profileVideoTitle("  제목  ")).toBe("제목");
    expect(profileVideoTitle("😀".repeat(80))).toBe("😀".repeat(80));
    expect(profileVideoTitle("가".repeat(81))).toBeNull();
    expect(profileVideoTitle("a\u0000b")).toBeNull();
    expect(profileVideoTitle(null)).toBeNull();
  });
});

describe("fixed upstream metadata", () => {
  it("requests only fixed YouTube endpoint, disables redirects and ignores response HTML", async () => {
    const fetcher = jest
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({ title: "영상 제목", html: "<script>bad</script>" }),
          { headers: { "content-type": "application/json" } },
        ),
      );
    expect(await youtubeTitle("ABCDEFGHIJK", fetcher)).toBe("영상 제목");
    const [url, options] = fetcher.mock.calls[0];
    expect(new URL(url).origin).toBe("https://www.youtube.com");
    expect(options).toMatchObject({ redirect: "error", cache: "no-store" });
  });
  it("does not fetch invalid IDs", async () => {
    const fetcher = jest.fn();
    expect(await youtubeTitle("http://localhost", fetcher)).toBe("");
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("falls back to manual title for errors, oversized JSON and unusable data", async () => {
    for (const response of [
      new Response("x".repeat(32769), {
        headers: { "content-type": "application/json" },
      }),
      new Response("bad", { status: 500 }),
      new Response(JSON.stringify({ title: "x".repeat(81) }), {
        headers: { "content-type": "application/json" },
      }),
    ]) {
      expect(
        await youtubeTitle(
          "ABCDEFGHIJK",
          jest.fn().mockResolvedValue(response),
        ),
      ).toBe("");
    }
    expect(
      await youtubeTitle(
        "ABCDEFGHIJK",
        jest.fn().mockRejectedValue(new Error("timeout")),
      ),
    ).toBe("");
  });
});
