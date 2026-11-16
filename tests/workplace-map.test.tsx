/** @jest-environment jsdom */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { WorkplaceMap } from "@/components/experts/WorkplaceMap";
jest.mock('next/script', () => ({ __esModule: true, default: ({onReady}: {onReady:()=>void}) => <button onClick={onReady}>SDK ready</button> }));
const originalId = process.env.NEXT_PUBLIC_NAVER_MAP_CLIENT_ID;
afterEach(() => { cleanup(); if (originalId === undefined) delete process.env.NEXT_PUBLIC_NAVER_MAP_CLIENT_ID; else process.env.NEXT_PUBLIC_NAVER_MAP_CLIENT_ID=originalId; delete window.naver; });

test("지도 키가 없으면 지도 없이 네이버 지도 링크만 보여 준다", () => {
  delete process.env.NEXT_PUBLIC_NAVER_MAP_CLIENT_ID;
  render(<WorkplaceMap address="서울특별시 강남구 테헤란로 123" />);
  expect(screen.queryByRole("img")).not.toBeInTheDocument();
  expect(
    screen.getByRole("link", { name: "네이버 지도에서 보기" }),
  ).toHaveAttribute(
    "href",
    "https://map.naver.com/p/search/" +
      encodeURIComponent("서울특별시 강남구 테헤란로 123"),
  );
});

test('SDK and geocoding start only after an explicit map request, then create the map and marker',async()=>{
  process.env.NEXT_PUBLIC_NAVER_MAP_CLIENT_ID='fake-public-map-id';
  const geocode=jest.fn((options,callback)=>callback('OK',{v2:{addresses:[{x:'126.978',y:'37.5665'}]}}));
  const map=jest.fn(), marker=jest.fn();
  window.naver={maps:{LatLng:jest.fn(),Map:map,Marker:marker,Service:{Status:{OK:'OK'},geocode}}};
  render(<WorkplaceMap address="서울특별시 중구 세종대로 110"/>);
  expect(screen.queryByText('SDK ready')).toBeNull();
  expect(geocode).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button',{name:'지도 보기'}));
  fireEvent.click(screen.getByRole('button',{name:'SDK ready'}));
  await waitFor(()=>expect(map).toHaveBeenCalledTimes(1));
  expect(geocode.mock.calls[0][0]).toEqual({query:'서울특별시 중구 세종대로 110'});
  expect(marker).toHaveBeenCalledTimes(1);
});

test('geocoding failure preserves the external map link and removes the blank map',async()=>{
  process.env.NEXT_PUBLIC_NAVER_MAP_CLIENT_ID='fake-public-map-id';
  window.naver={maps:{LatLng:jest.fn(),Map:jest.fn(),Marker:jest.fn(),Service:{Status:{OK:'OK'},geocode:(_options,callback)=>callback('ERROR',{})}}};
  render(<WorkplaceMap address="예시 주소"/>);
  fireEvent.click(screen.getByRole('button',{name:'지도 보기'}));
  fireEvent.click(screen.getByRole('button',{name:'SDK ready'}));
  await waitFor(()=>expect(screen.queryByRole('img')).toBeNull());
  expect(screen.getByRole('link',{name:'네이버 지도에서 보기'})).toBeTruthy();
});
