"use client";
import {
  forwardRef,
  useContext,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import {
  getOwnExternalLinks,
  saveExternalLinks,
} from "@/app/actions/external-links";
import {
  ExternalLinksPreview,
  type ExternalLinkDraft,
} from "@/components/profile-editor/ExternalLinksPreview";
import { CommonProfileSaveContext } from "@/components/CommonProfileSaveContext";
import {
  externalLinksValid,
  type SavedExternalLink,
} from "@/lib/external-links";
import type { SectionSaveHandle } from "./types";

const ExternalLinksSection = forwardRef<
  SectionSaveHandle,
  { onSaved: () => void }
>(function ExternalLinksSection({ onSaved }, ref) {
  const registry = useContext(CommonProfileSaveContext);
  const [loaded, setLoaded] = useState<SavedExternalLink[] | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [loadError, setLoadError] = useState(false);
  const [draft, setDraft] = useState<ExternalLinkDraft | null>(null);
  const fingerprint = useRef<string | null>(null);
  const saved = useRef<Omit<SavedExternalLink, "id">[]>([]);
  useEffect(() => {
    let active = true;
    setLoaded(null);
    setLoadError(false);
    setDraft(null);
    fingerprint.current = null;
    getOwnExternalLinks()
      .then((result) => {
        if (!active) return;
        if (result.ok) {
          saved.current = result.links.map(({ id, ...link }) => link);
          setLoaded(result.links);
        } else setLoadError(true);
      })
      .catch(() => {
        if (active) setLoadError(true);
      });
    return () => {
      active = false;
    };
  }, [attempt]);
  useEffect(() => {
    if (!draft) return;
    const serialized = JSON.stringify([draft.links, draft.pending]);
    if (fingerprint.current !== null && fingerprint.current !== serialized)
      registry.dirty?.();
    fingerprint.current = serialized;
    registry.preview?.({
      youtube_url: null,
      instagram_url: null,
      blog_url: null,
      threads_url: null,
      kakao_url: null,
      extra_links: draft.links.map((link) => ({
        ...link,
        is_primary: false,
      })),
    });
  }, [draft, registry]);
  function validate() {
    if (!loaded || !draft)
      return {
        ok: false,
        error: loadError
          ? "외부 링크를 불러오지 못했습니다. 다시 불러온 후 저장해주세요."
          : "외부 링크를 불러오는 중입니다.",
      };
    if (draft.pending)
      return {
        ok: false,
        error: "외부 링크의 추가·수정을 완료하거나 취소한 뒤 저장해주세요.",
      };
    return externalLinksValid(
      draft.links.map((link) => ({
        kind: link.kind,
        label: link.label,
        url: link.url,
        is_primary: false,
      })),
    )
      ? { ok: true }
      : {
          ok: false,
          error:
            "링크는 최대 15개까지 등록할 수 있습니다. 이름과 주소도 확인해주세요.",
        };
  }
  useImperativeHandle(ref, () => ({
    validate,
    save: async () => {
      const checked = validate();
      if (!checked.ok) return checked;
      const payload = draft!.links.map((link) => ({
        kind: link.kind,
        label: link.label.trim(),
        url: link.url.trim(),
        is_primary: false,
      }));
      const result = await saveExternalLinks(payload, saved.current);
      if (result.ok) {
        saved.current = payload;
        onSaved();
      }
      return result;
    },
  }));
  if (loadError)
    return (
      <div role="alert">
        <p>
          외부 링크를 불러오지 못했습니다. 기존 링크를 보호하기 위해 저장을
          중단합니다.
        </p>
        <button type="button" onClick={() => setAttempt((v) => v + 1)}>
          다시 불러오기
        </button>
      </div>
    );
  if (!loaded) return <p role="status">외부 링크를 불러오는 중입니다.</p>;
  return (
    <ExternalLinksPreview
      key={attempt}
      embedded
      initialLinks={loaded}
      displayName="내 프로필"
      onDraftChange={(next) =>
        setDraft((previous) =>
          JSON.stringify(previous) === JSON.stringify(next) ? previous : next,
        )
      }
    />
  );
});
export default ExternalLinksSection;
