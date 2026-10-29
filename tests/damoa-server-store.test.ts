import { createClient } from "../lib/supabase/client";
import { Activity } from "../lib/damoa/categories";
import {
  saveActivity,
  importBrowserActivities,
  pendingBrowserActivities,
  cleanupUnusedFiles,
} from "../lib/damoa/server-store";
jest.mock("../lib/supabase/client", () => ({ createClient: jest.fn() }));
const rpc = jest.fn();
const upload = jest.fn();
const remove = jest.fn();
const single = jest.fn();
const maybeSingle = jest.fn();
const fileRows = jest.fn();
const chain: any = {
  select: jest.fn(),
  eq: jest.fn(),
  in: jest.fn(),
  order: jest.fn(),
  range: jest.fn(),
  single,
  maybeSingle,
  then: (resolve: any, reject: any) =>
    Promise.resolve(fileRows()).then(resolve, reject),
};
chain.select.mockReturnValue(chain);
chain.eq.mockReturnValue(chain);
chain.in.mockReturnValue(chain);
chain.order.mockReturnValue(chain);
chain.range.mockReturnValue(chain);
const client = {
  rpc,
  from: jest.fn(() => chain),
  storage: { from: jest.fn(() => ({ upload, remove })) },
};
const row = (override: Partial<Activity> = {}): Activity => ({
  owner: "owner",
  id: "activity",
  category: "volunteer",
  title: "실제 이력이 아닌 검증",
  period: "",
  description: "",
  learning: "",
  link: "",
  memo: "개인 메모",
  details: {},
  files: [],
  updated: "old",
  ...override,
});
const server = (a: Activity) => ({
  owner: a.owner,
  id: a.id,
  content: { ...a, files: a.files.map(({ blob, ...f }) => f) },
  updated_at: "new",
});
beforeEach(() => {
  jest.clearAllMocks();
  (createClient as jest.Mock).mockReturnValue(client);
  fileRows.mockReturnValue({ data: [], error: null });
});
test("수정할 때 기존 서버 시각을 보내 동시 수정 충돌을 방지", async () => {
  const a = row({ revision: "previous" });
  rpc.mockResolvedValue({ data: server(a), error: null });
  const saved = await saveActivity(a);
  expect(saved.revision).toBe("new");
  expect(rpc).toHaveBeenCalledWith(
    "damoa_save_activity",
    expect.objectContaining({ p_expected: "previous", p_create_only: false }),
  );
  expect(rpc.mock.calls[0][1].p_content).not.toHaveProperty("owner");
});
test("업로드 실패 시 기록 저장 성공으로 처리하지 않음", async () => {
  const a = row({
    files: [
      {
        id: "file",
        name: "test.pdf",
        type: "application/pdf",
        size: 1,
        blob: new Blob(["x"]),
      },
    ],
  });
  rpc.mockResolvedValue({
    data: { path: "owner/activity/file", ready: false },
    error: null,
  });
  upload.mockResolvedValue({
    error: { message: "업로드 실패", statusCode: "500" },
  });
  await expect(saveActivity(a)).rejects.toThrow("업로드 실패");
  expect(rpc).not.toHaveBeenCalledWith(
    "damoa_save_activity",
    expect.anything(),
  );
});
test("업로드 응답이 유실된 경우 기존 파일의 서버 확인 후 재시도", async () => {
  const a = row({
    files: [
      {
        id: "file",
        name: "test.pdf",
        type: "application/pdf",
        size: 1,
        blob: new Blob(["x"]),
      },
    ],
  });
  rpc.mockImplementation(async (name: string) => ({
    data:
      name === "damoa_reserve_file"
        ? { path: "owner/activity/file", ready: false }
        : name === "damoa_finish_file"
          ? { path: "owner/activity/file", bytes: 1 }
          : server(a),
    error: null,
  }));
  upload.mockResolvedValue({ error: { message: "exists", statusCode: "409" } });
  await expect(saveActivity(a)).resolves.toMatchObject({ revision: "new" });
  expect(a.files[0].path).toBeUndefined();
  expect(rpc).toHaveBeenCalledWith("damoa_finish_file", { p_id: "file" });
});
test("이전은 생성 전용이며 브라우저 원본을 바꾸지 않음", async () => {
  const original = row();
  const before = JSON.stringify(original);
  maybeSingle.mockResolvedValue({ data: null, error: null });
  single.mockResolvedValue({ data: { id: "activity" }, error: null });
  rpc.mockResolvedValue({ data: server(original), error: null });
  expect(await importBrowserActivities("owner", [original])).toBe(1);
  expect(JSON.stringify(original)).toBe(before);
  expect(rpc).toHaveBeenCalledWith(
    "damoa_save_activity",
    expect.objectContaining({ p_create_only: true }),
  );
});
test("다른 계정의 브라우저 기록은 옮기지 않음", async () => {
  await expect(importBrowserActivities("another", [row()])).rejects.toThrow(
    "다른 계정",
  );
  expect(rpc).not.toHaveBeenCalled();
});
test("이전 완료 기록은 삭제 후에도 브라우저 원본을 다시 제안하지 않음", async () => {
  fileRows.mockReturnValue({ data: [{ id: "activity" }], error: null });
  expect(await pendingBrowserActivities("owner", [row()])).toEqual([]);
});
test("파일 삭제 실패 시 예약 용량은 해제하지 않음", async () => {
  fileRows.mockReturnValue({
    data: [{ id: "file", activity_id: "activity" }],
    error: null,
  });
  rpc.mockResolvedValue({ data: "owner/activity/file", error: null });
  remove.mockResolvedValue({ error: { message: "삭제 실패" } });
  await expect(cleanupUnusedFiles("owner", "activity")).rejects.toThrow(
    "삭제 실패",
  );
  expect(rpc).not.toHaveBeenCalledWith("damoa_release_file", expect.anything());
});
test("다른 기록에 연결된 업로드는 함께 정리하지 않음", async () => {
  fileRows.mockReturnValue({
    data: [{ id: "file", activity_id: "different" }],
    error: null,
  });
  await cleanupUnusedFiles("owner", "activity");
  expect(remove).not.toHaveBeenCalled();
});
