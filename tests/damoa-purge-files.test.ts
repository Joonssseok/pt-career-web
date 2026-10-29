import { purgeDamoaFiles } from "../lib/damoa/purge-files";
function setup(paths: string[], removeError: any = null) {
  const remove = jest.fn().mockResolvedValue({ error: removeError });
  const q: any = {
    select: jest.fn(),
    eq: jest.fn(),
    order: jest.fn(),
    range: jest
      .fn()
      .mockResolvedValue({
        data: paths.map((path) => ({ path })),
        error: null,
      }),
  };
  q.select.mockReturnValue(q);
  q.eq.mockReturnValue(q);
  q.order.mockReturnValue(q);
  return {
    client: { from: () => q, storage: { from: () => ({ remove }) } } as any,
    remove,
  };
}
test("계정 삭제 대상자의 자료만 실제 저장소에서 삭제", async () => {
  const { client, remove } = setup(["owner/activity/file"]);
  await purgeDamoaFiles(client, "owner");
  expect(remove).toHaveBeenCalledWith(["owner/activity/file"]);
});
test("자료 삭제 실패 시 계정 삭제도 중단하여 재시도 가능", async () => {
  const error = new Error("storage failed");
  const { client } = setup(["owner/activity/file"], error);
  await expect(purgeDamoaFiles(client, "owner")).rejects.toThrow(error);
});
test("다른 계정의 경로가 섞이면 삭제를 중단", async () => {
  const { client, remove } = setup(["another/activity/file"]);
  await expect(purgeDamoaFiles(client, "owner")).rejects.toThrow("owner");
  expect(remove).not.toHaveBeenCalled();
});
