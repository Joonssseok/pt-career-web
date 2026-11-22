import type { NaverMaps } from "@/components/experts/WorkplaceMap";
import { validLocation, type NaverLocation } from "./naver-location";

let sdk: Promise<NaverMaps> | undefined;
export function loadNaverMaps(): Promise<NaverMaps> {
  if (window.naver?.maps.Service) return Promise.resolve(window.naver.maps);
  if (sdk) return sdk;
  const clientId = process.env.NEXT_PUBLIC_NAVER_MAP_CLIENT_ID;
  if (!clientId)
    return Promise.reject(new Error("지도 연결 설정을 확인해주세요."));
  sdk = new Promise<NaverMaps>((resolve, reject) => {
    const src = `https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${encodeURIComponent(clientId)}&submodules=geocoder`;
    let script = Array.from(document.scripts).find(
      (element) => element.src === src,
    );
    let created = false;
    const deadline = Date.now() + 12000;
    const fail = () => {
      clearInterval(timer);
      if (created) script?.remove();
      reject(
        new Error(
          "네이버 지도에 연결하지 못했습니다. 잠시 후 다시 시도해주세요.",
        ),
      );
    };
    const timer = setInterval(() => {
      if (window.naver?.maps.Service) {
        clearInterval(timer);
        script?.removeEventListener("error", fail);
        resolve(window.naver.maps);
      } else if (Date.now() >= deadline) {
        script?.removeEventListener("error", fail);
        fail();
      }
    }, 100);
    if (!script) {
      created = true;
      script = document.createElement("script");
      script.src = src;
      script.async = true;
      script.addEventListener("error", fail, { once: true });
      document.head.appendChild(script);
    }
  }).catch((error) => {
    sdk = undefined;
    throw error;
  });
  return sdk;
}

export async function searchNaverAddresses(
  query: string,
): Promise<NaverLocation[]> {
  if (query.trim().length < 2 || query.length > 100)
    throw new Error("주소를 2~100자로 입력해주세요.");
  const maps = await loadNaverMaps();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error("주소 검색 응답이 늦습니다. 다시 시도해주세요.")),
      10000,
    );
    maps.Service!.geocode({ query: query.trim() }, (status, response) => {
      clearTimeout(timer);
      if (status !== maps.Service!.Status.OK) {
        reject(
          new Error(
            "주소를 검색하지 못했습니다. 도로명이나 지번을 확인해주세요.",
          ),
        );
        return;
      }
      resolve(
        (response?.v2?.addresses ?? []).slice(0, 10).flatMap((item) => {
          const address = item.roadAddress || item.jibunAddress;
          const latitude = Number(item.y),
            longitude = Number(item.x);
          if (
            !address ||
            !item.x.trim() ||
            !item.y.trim() ||
            !validLocation(latitude, longitude)
          )
            return [];
          return [{ name: "", address, latitude, longitude }];
        }),
      );
    });
  });
}
