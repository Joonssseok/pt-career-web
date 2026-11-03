/** @jest-environment jsdom */
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { AuditLog } from "@/app/admin/AuditLog";
import { getAdminAuditLog } from "@/app/actions/admin";
jest.mock("@/app/actions/admin", () => ({getAdminAuditLog: jest.fn()}));
const load = getAdminAuditLog as jest.Mock;
beforeEach(() => {
  load.mockReset();
  load.mockImplementation(async ({limit, offset}) => ({ok: true, entries: Array.from({length: limit},(_,i)=>({
    id: String(offset+i),created_at:"2026-11-03T00:00:00Z",action_type:"profile_approved",memo:null,target_profile_id:null,
    target_display_name:`기록 ${offset+i}`,target_license_name:null,admin_user_id:"admin",admin_email:null,
  }))}));
});
test("기본 10개와 5/10/20/30/50 선택지를 제공",async()=>{
  render(<AuditLog admins={[]} />);
  await waitFor(()=>expect(screen.getAllByText(/^기록 \d+$/)).toHaveLength(10));
  expect(load).toHaveBeenCalledWith(expect.objectContaining({limit:10,offset:0}));
  expect(screen.getByLabelText("표시 개수")).toHaveValue("10");
  for(const n of [5,10,20,30,50]) expect(screen.getByRole("option",{name:`${n}개씩`})).toBeInTheDocument();
});
test("선택 변경은 첫 목록부터 교체하며 더 보기도 선택 개수를 사용",async()=>{
  render(<AuditLog admins={[]} />);
  await waitFor(()=>expect(screen.getAllByText(/^기록 \d+$/)).toHaveLength(10));
  fireEvent.change(screen.getByLabelText("표시 개수"),{target:{value:"5"}});
  await waitFor(()=>expect(screen.getAllByText(/^기록 \d+$/)).toHaveLength(5));
  expect(load).toHaveBeenLastCalledWith(expect.objectContaining({limit:5,offset:0}));
  fireEvent.click(screen.getByRole("button",{name:"더 보기"}));
  await waitFor(()=>expect(screen.getAllByText(/^기록 \d+$/)).toHaveLength(10));
  expect(load).toHaveBeenLastCalledWith(expect.objectContaining({limit:5,offset:5}));
  fireEvent.change(screen.getByLabelText("표시 개수"),{target:{value:"50"}});
  await waitFor(()=>expect(screen.getAllByText(/^기록 \d+$/)).toHaveLength(50));
  expect(load).toHaveBeenLastCalledWith(expect.objectContaining({limit:50,offset:0}));
});
test("조회 실패를 빈 이력으로 표시하지 않고 다시 조회 가능",async()=>{
  load.mockRejectedValueOnce(new Error("offline"));
  render(<AuditLog admins={[]} />);
  expect(await screen.findByRole("alert")).toHaveTextContent("감사로그를 불러오지 못했습니다");
  expect(screen.queryByText("조건에 맞는 이력이 없습니다.")).not.toBeInTheDocument();
  expect(screen.getByLabelText("표시 개수")).toBeEnabled();
  fireEvent.click(screen.getByRole("button",{name:"조회"}));
  await waitFor(()=>expect(screen.getAllByText(/^기록 \d+$/)).toHaveLength(10));
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});
