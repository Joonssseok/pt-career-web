"use client";

import { useEffect, useId, useRef, useState } from "react";
import { searchNaverBusinesses } from "@/app/actions/naver-location-search";
import { loadNaverMaps, searchNaverAddresses } from "@/lib/naver-maps-browser";
import { validLocation, type NaverLocation } from "@/lib/naver-location";
import styles from "./ContactInquiryPreview.module.css";

export function NaverLocationPicker({
  onSelect,
}: {
  onSelect: (location: NaverLocation) => void;
}) {
  const id = useId();
  const [mode, setMode] = useState<"business" | "address">("business");
  const [query, setQuery] = useState("");
  const [locations, setLocations] = useState<NaverLocation[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const request = useRef(0);
  useEffect(
    () => () => {
      request.current++;
    },
    [],
  );
  function resetSearch() {
    request.current++;
    setBusy(false);
    setLocations([]);
    setMessage("");
  }
  async function search() {
    if (busy) return;
    if (query.trim().length < 2) {
      setMessage("검색어를 두 글자 이상 입력해주세요.");
      return;
    }
    const current = ++request.current;
    setBusy(true);
    setLocations([]);
    setMessage("");
    try {
      let results: NaverLocation[];
      if (mode === "business") {
        const response = await searchNaverBusinesses(query);
        if (!response.ok) throw new Error(response.error);
        results = response.locations;
      } else results = await searchNaverAddresses(query);
      if (request.current !== current) return;
      setLocations(results);
      if (!results.length)
        setMessage(
          "검색 결과가 없습니다. 지역명과 함께 입력하거나 검색 방식을 바꿔주세요.",
        );
    } catch (error) {
      if (request.current === current)
        setMessage(
          error instanceof Error
            ? error.message
            : "검색하지 못했습니다. 다시 시도해주세요.",
        );
    } finally {
      if (request.current === current) setBusy(false);
    }
  }
  return (
    <div className={styles.locationSearch}>
      <div
        className={styles.searchModes}
        role="group"
        aria-label="네이버 검색 방식"
      >
        {(["business", "address"] as const).map((key) => (
          <button
            key={key}
            type="button"
            aria-pressed={mode === key}
            onClick={() => {
              resetSearch();
              setMode(key);
            }}
          >
            {key === "business" ? "업체명" : "주소"}
          </button>
        ))}
      </div>
      <label htmlFor={`${id}-query`} className={styles.searchLabel}>
        {mode === "business" ? "네이버 업체명 검색" : "네이버 주소 검색"}
      </label>
      <div className={styles.searchRow}>
        <input
          id={`${id}-query`}
          value={query}
          placeholder={
            mode === "business"
              ? "예: 성남 삼성마디탑의원"
              : "예: 성남시 산성대로 106"
          }
          maxLength={100}
          onChange={(event) => {
            resetSearch();
            setQuery(event.target.value);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.nativeEvent.isComposing) {
              event.preventDefault();
              void search();
            }
          }}
        />
        <button type="button" disabled={busy} onClick={() => void search()}>
          {busy ? "검색 중…" : "검색"}
        </button>
      </div>
      <p className={styles.searchHint}>
        검색어는 네이버에 전달됩니다. 상세주소는 검색에 사용하지 않습니다.
      </p>
      {message && (
        <p role="status" className={styles.searchHint}>
          {message}
        </p>
      )}
      {locations.length > 0 && (
        <ul className={styles.searchResults} aria-label="네이버 검색 결과">
          {locations.map((location, index) => (
            <li key={`${location.address}-${index}`}>
              <button
                type="button"
                onClick={() => {
                  onSelect(location);
                  resetSearch();
                }}
              >
                <strong>{location.name || location.address}</strong>
                {location.name && <span>{location.address}</span>}
                <span className={styles.resultAction}>선택</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function NaverContactMap({
  location,
}: {
  location: Pick<NaverLocation, "latitude" | "longitude">;
}) {
  const element = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let cancelled = false;
    let cleanup: (() => void) | undefined;
    setFailed(false);
    if (!validLocation(location.latitude, location.longitude)) {
      setFailed(true);
      return;
    }
    loadNaverMaps()
      .then((maps) => {
        if (cancelled || !element.current) return;
        const position = new maps.LatLng(location.latitude, location.longitude);
        const map = new maps.Map(element.current, {
          center: position,
          zoom: 16,
        });
        const marker = new maps.Marker({ map, position });
        cleanup = () => {
          (marker as { setMap?: (map: null) => void }).setMap?.(null);
          (map as { destroy?: () => void }).destroy?.();
        };
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [location.latitude, location.longitude]);
  return failed ? (
    <p role="status" className={styles.searchHint}>
      지도를 불러오지 못했습니다. 다시 확인해주세요.
    </p>
  ) : (
    <div
      ref={element}
      className={styles.contactMap}
      role="img"
      aria-label="선택한 근무지 위치 지도"
    />
  );
}
