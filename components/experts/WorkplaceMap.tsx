"use client";

import Script from "next/script";
import { useEffect, useRef, useState } from "react";

// 네이버 지도(NCP Maps) Client ID. 웹페이지에 그대로 노출되는 공개용 값이며,
// 네이버 콘솔에 등록한 도메인에서만 동작한다. Client Secret은 여기서 쓰지 않는다.
const CLIENT_ID = process.env.NEXT_PUBLIC_NAVER_MAP_CLIENT_ID;

// 네이버 지도 SDK 중 이 파일에서 쓰는 부분만 적은 최소 타입.
type NaverMaps = {
  LatLng: new (lat: number, lng: number) => unknown;
  Map: new (el: HTMLElement, options: Record<string, unknown>) => unknown;
  Marker: new (options: Record<string, unknown>) => unknown;
  Service?: {
    Status: { OK: unknown };
    geocode: (
      options: { query: string },
      callback: (
        status: unknown,
        response: { v2?: { addresses?: { x: string; y: string }[] } },
      ) => void,
    ) => void;
  };
  onJSContentLoaded?: () => void;
};

declare global {
  interface Window {
    naver?: { maps: NaverMaps };
    navermap_authFailure?: () => void;
  }
}

/**
 * 공개 프로필 "근무 기관" 카드의 지도.
 * 이미 공개된 주소를 화면에서 좌표로 바꿔 보여 주기만 하고, 좌표를 저장하지 않는다.
 * 키가 없거나 인증·주소 변환에 실패하면 지도 없이 "네이버 지도에서 보기" 링크만 남는다.
 */
export function WorkplaceMap({ address }: { address: string }) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [sdkReady, setSdkReady] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!sdkReady || failed) return;
    const maps = window.naver?.maps;
    if (!maps) return;
    let cancelled = false;

    const draw = () => {
      // ponytail: 프로필을 열 때마다 주소 변환 1건(월 300만 건 무료). 지도 모아보기를
      // 만들 때는 좌표 저장 가능 여부(약관)를 확인한 뒤 저장 방식으로 바꾼다.
      maps.Service?.geocode({ query: address }, (status, response) => {
        if (cancelled || !mapRef.current) return;
        const found = response.v2?.addresses?.[0];
        if (status !== maps.Service?.Status.OK || !found) {
          setFailed(true);
          return;
        }
        const position = new maps.LatLng(Number(found.y), Number(found.x));
        const map = new maps.Map(mapRef.current, { center: position, zoom: 16 });
        new maps.Marker({ position, map });
      });
    };

    // geocoder(주소 변환) 부가 모듈은 본체보다 늦게 준비될 수 있다.
    if (maps.Service) draw();
    else maps.onJSContentLoaded = draw;

    return () => {
      cancelled = true;
    };
  }, [sdkReady, failed, address]);

  const showMap = Boolean(CLIENT_ID) && !failed;

  return (
    <div className="mt-3">
      {showMap && (
        <>
          <Script
            src={`https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${CLIENT_ID}&submodules=geocoder`}
            strategy="afterInteractive"
            onReady={() => {
              // 등록하지 않은 도메인 등 인증 실패 시 네이버 SDK가 호출한다.
              window.navermap_authFailure = () => setFailed(true);
              setSdkReady(true);
            }}
            onError={() => setFailed(true)}
          />
          <div
            ref={mapRef}
            role="img"
            aria-label={`근무 기관 위치 지도: ${address}`}
            className="h-48 w-full overflow-hidden rounded-xl bg-slate-100"
          />
        </>
      )}
      <a
        href={`https://map.naver.com/p/search/${encodeURIComponent(address)}`}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-2 flex min-h-tap items-center justify-center rounded-xl bg-slate-100 px-3 py-2.5 text-center text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-200 focus-visible:outline-2 focus-visible:outline-blue-600"
      >
        네이버 지도에서 보기
      </a>
    </div>
  );
}
