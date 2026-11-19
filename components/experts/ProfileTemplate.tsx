"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { ComingSoonButton } from "@/components/ComingSoonButton";
import styles from "./ProfileTemplate.module.css";

const tabs = [
  { id: "home", label: "홈" },
  { id: "detail", label: "상세정보" },
  { id: "career", label: "이력" },
  { id: "board", label: "게시판" },
  { id: "video", label: "영상" },
] as const;

export type ProfileTemplateTab = (typeof tabs)[number]["id"];
export type ProfileTemplateProps = {
  identity: ReactNode;
  home: ReactNode;
  career: ReactNode;
  detail: ReactNode;
  video: ReactNode;
  ownerPreview: boolean;
  careerCount: number;
};

type SearchItem = {
  target: HTMLElement;
  tab: "home" | "detail" | "career";
  title: string;
  text: string;
};

const excludedText =
  'button, [data-order-handle], [role="tooltip"], [hidden], [aria-hidden="true"], [data-profile-search-exclude], script, style';

// Read rendered text only; attributes and the original private data are never searched.
function searchableText(element: HTMLElement) {
  const copy = element.cloneNode(true) as HTMLElement;
  copy.querySelectorAll(excludedText).forEach((node) => node.remove());
  return (copy.textContent || "").replace(/\s+/g, " ").trim();
}

function tabFromLocation(): ProfileTemplateTab {
  const value = new URL(window.location.href).searchParams.get("tab");
  return tabs.find((tab) => tab.id === value)?.id ?? "home";
}

export function ProfileTemplate({
  identity,
  home,
  career,
  detail,
  video,
  ownerPreview,
  careerCount,
}: ProfileTemplateProps) {
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const tabButtons = useRef<
    Partial<Record<ProfileTemplateTab, HTMLButtonElement | null>>
  >({});
  const [activeTab, setActiveTab] = useState<ProfileTemplateTab>("home");
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const searchInput = useRef<HTMLInputElement>(null);
  const searchButton = useRef<HTMLButtonElement>(null);
  const [items, setItems] = useState<SearchItem[] | null>(null);
  const [hasVideoLink, setHasVideoLink] = useState(false);
  const [destination, setDestination] = useState<{
    target: HTMLElement;
  } | null>(null);
  const keyword = query.trim().toLocaleLowerCase();
  const results = (items ?? []).filter((item) =>
    item.text.toLocaleLowerCase().includes(keyword),
  );
  const indexedCareerCount =
    items?.filter((item) => item.tab === "career").length ?? careerCount;

  useEffect(() => {
    if (searchOpen) searchInput.current?.focus();
  }, [searchOpen]);

  function closeSearch() {
    setSearchOpen(false);
    setQuery("");
    searchButton.current?.focus();
  }

  useEffect(() => {
    if (ownerPreview) return;
    const readTab = () => {
      setActiveTab(tabFromLocation());
      setQuery("");
    };
    readTab();
    window.addEventListener("popstate", readTab);
    return () => window.removeEventListener("popstate", readTab);
  }, [ownerPreview]);

  useEffect(() => {
    const container = root.current;
    if (!container) return;
    let sequence = 0;
    const rebuild = () => {
      setHasVideoLink(
        Boolean(
          container.querySelector(
            '[data-profile-panel="video"] a[href]:not([href=""])',
          ),
        ),
      );
      const next: SearchItem[] = [];
      for (const tab of ["home", "detail", "career"] as const) {
        const panel = container.querySelector<HTMLElement>(
          `[data-profile-panel="${tab}"]`,
        );
        if (!panel) continue;
        const tagged = Array.from(
          panel.querySelectorAll<HTMLElement>("[data-profile-search-item]"),
        );
        const fallback =
          tab === "career"
            ? Array.from(
                panel.querySelectorAll<HTMLElement>("[data-order-key]"),
              ).filter(
                (node) =>
                  !node.querySelector(
                    "[data-order-key], [data-profile-search-item]",
                  ) && !node.closest("[data-profile-search-item]"),
              )
            : [];
        for (const target of [...tagged, ...fallback]) {
          // A hidden tab is searchable; hidden content inside that tab is not.
          let current: HTMLElement | null = target;
          let excluded = false;
          while (current && current !== panel) {
            if (current.matches(excludedText)) {
              excluded = true;
              break;
            }
            current = current.parentElement;
          }
          if (
            excluded ||
            target.parentElement?.closest("[data-profile-search-item]")
          )
            continue;
          const text = searchableText(target);
          if (!text) continue;
          if (!target.id) target.id = `${id}-search-${++sequence}`;
          const title =
            target.getAttribute("data-profile-search-title")?.trim() || text;
          next.push({ target, tab, title, text });
        }
      }
      setItems((previous) =>
        previous &&
        previous.length === next.length &&
        previous.every(
          (item, index) =>
            item.target === next[index].target &&
            item.text === next[index].text &&
            item.title === next[index].title &&
            item.tab === next[index].tab,
        )
          ? previous
          : next,
      );
    };
    rebuild();
    const observer = new MutationObserver(rebuild);
    container.querySelectorAll("[data-profile-panel]").forEach((panel) =>
      observer.observe(panel, {
        subtree: true,
        childList: true,
        characterData: true,
        attributes: true,
        attributeFilter: [
          "data-profile-search-item",
          "data-profile-search-title",
          "data-profile-search-exclude",
          "data-order-key",
          "href",
          "hidden",
          "aria-hidden",
        ],
      }),
    );
    return () => observer.disconnect();
  }, [id]);

  useEffect(() => {
    if (!destination || !root.current?.contains(destination.target)) return;
    const target = destination.target;
    const previousTabIndex = target.getAttribute("tabindex");
    if (previousTabIndex === null) target.setAttribute("tabindex", "-1");
    target.focus({ preventScroll: true });
    target.scrollIntoView({ block: "center", behavior: "instant" });
    target.classList.add(styles.flash);
    const timer = window.setTimeout(() => {
      target.classList.remove(styles.flash);
      setDestination(null);
    }, 1400);
    return () => {
      window.clearTimeout(timer);
      target.classList.remove(styles.flash);
      if (previousTabIndex === null) target.removeAttribute("tabindex");
    };
  }, [destination]);

  function selectTab(tab: ProfileTemplateTab) {
    setActiveTab(tab);
    setQuery("");
    setDestination(null);
    if (!ownerPreview) {
      const url = new URL(window.location.href);
      if (url.searchParams.get("tab") !== tab) {
        url.searchParams.set("tab", tab);
        window.history.pushState(window.history.state, "", url);
      }
    }
  }

  function moveTab(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let next: number;
    switch (event.key) {
      case "ArrowRight":
        next = (index + 1) % tabs.length;
        break;
      case "ArrowLeft":
        next = (index + tabs.length - 1) % tabs.length;
        break;
      case "Home":
        next = 0;
        break;
      case "End":
        next = tabs.length - 1;
        break;
      default:
        return;
    }
    event.preventDefault();
    selectTab(tabs[next].id);
    tabButtons.current[tabs[next].id]?.focus();
  }

  const notice = (action: string) => (
    <div className={styles.empty} data-profile-search-exclude>
      <p>
        {ownerPreview
          ? "이 기능은 추후에 열릴 예정이에요. 열리면 여기에서 바로 올릴 수 있어요."
          : "아직 준비 중인 공간이에요. 곧 이곳에서 더 많은 이야기를 볼 수 있어요."}
      </p>
      {ownerPreview && (
        <ComingSoonButton className={styles.write}>{action}</ComingSoonButton>
      )}
    </div>
  );

  const content = {
    home,
    detail: (
      <>
        {detail}
        {notice("꾸미기")}
      </>
    ),
    career,
    video: (
      <>
        {video}
        {(ownerPreview || !hasVideoLink) && notice("영상 추가")}
      </>
    ),
    board: notice("글쓰기"),
  };

  return (
    <div
      ref={root}
      className={styles.profile}
      data-profile-template
      onClick={(event) => {
        const link = (event.target as HTMLElement).closest?.(
          "[data-profile-career-link]",
        );
        if (
          !link ||
          event.ctrlKey ||
          event.metaKey ||
          event.shiftKey ||
          event.altKey
        )
          return;
        event.preventDefault();
        selectTab("career");
        tabButtons.current.career?.focus();
        tabButtons.current.career?.scrollIntoView({
          block: "start",
          behavior: "instant",
        });
      }}
    >
      <div className={styles.wrap}>
        <aside className={styles.identity} aria-label="전문가 소개">
          {identity}
        </aside>
        <div className={styles.read}>
          <div className={styles.nav}>
            <div className={styles.tabRow}>
              <div
                className={styles.tabs}
                role="tablist"
                aria-label="전문가 프로필"
              >
                {tabs.map((tab, index) => (
                  <button
                    key={tab.id}
                    ref={(button) => {
                      tabButtons.current[tab.id] = button;
                    }}
                    type="button"
                    role="tab"
                    id={`${id}-tab-${tab.id}`}
                    aria-controls={`${id}-panel-${tab.id}`}
                    aria-selected={activeTab === tab.id}
                    tabIndex={activeTab === tab.id ? 0 : -1}
                    onClick={() => selectTab(tab.id)}
                    onKeyDown={(event) => moveTab(event, index)}
                  >
                    {tab.label}
                    {tab.id === "career" && indexedCareerCount > 0 && (
                      <sup>{indexedCareerCount}</sup>
                    )}
                  </button>
                ))}
              </div>
              <button
                ref={searchButton}
                type="button"
                className={styles.searchToggle}
                aria-label="프로필 검색"
                aria-expanded={searchOpen}
                aria-controls={`${id}-search-area`}
                onClick={() =>
                  searchOpen ? closeSearch() : setSearchOpen(true)
                }
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  aria-hidden="true"
                >
                  <circle cx="10.5" cy="10.5" r="6.5" />
                  <path d="m16 16 4.5 4.5" />
                </svg>
              </button>
            </div>
            <div
              id={`${id}-search-area`}
              hidden={!searchOpen}
              className={styles.find}
              role="search"
              aria-label="이 전문가의 프로필 검색"
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  event.preventDefault();
                  closeSearch();
                }
              }}
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                aria-hidden="true"
              >
                <circle cx="10.5" cy="10.5" r="6.5" />
                <path d="m16 16 4.5 4.5" />
              </svg>
              <label className={styles.sr} htmlFor={`${id}-search`}>
                이 전문가의 이력·글·영상에서 찾기
              </label>
              <input
                ref={searchInput}
                id={`${id}-search`}
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="이 전문가의 이력·글·영상에서 찾기 (예: 어깨)"
                autoComplete="off"
              />
              {query && (
                <button
                  type="button"
                  className={styles.clear}
                  aria-label="검색어 지우기"
                  onClick={() => {
                    setQuery("");
                    root.current
                      ?.querySelector<HTMLInputElement>("input")
                      ?.focus();
                  }}
                >
                  ×
                </button>
              )}
            </div>
          </div>
          {keyword && (
            <section className={styles.results} aria-label="프로필 검색 결과">
              <h2 role="status">검색 결과 {results.length}건</h2>
              {results.length ? (
                <ul>
                  {results.map((item) => (
                    <li key={item.target.id}>
                      <button
                        type="button"
                        onClick={() => {
                          selectTab(item.tab);
                          setDestination({ target: item.target });
                        }}
                      >
                        <span className={styles.where}>
                          {tabs.find((tab) => tab.id === item.tab)?.label}
                        </span>
                        <b>{item.title}</b>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className={styles.none}>
                  찾는 내용이 없어요. 다른 낱말로 찾아보세요.
                </p>
              )}
            </section>
          )}
          {tabs.map((tab) => (
            <section
              key={tab.id}
              id={`${id}-panel-${tab.id}`}
              data-profile-panel={tab.id}
              className={styles.page}
              role="tabpanel"
              aria-labelledby={`${id}-tab-${tab.id}`}
              tabIndex={0}
              hidden={Boolean(keyword) || activeTab !== tab.id}
            >
              {content[tab.id]}
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
