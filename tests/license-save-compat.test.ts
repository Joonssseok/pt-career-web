import { saveCertifications } from "../app/actions/certification";
const rpc = jest.fn();
const limit = jest.fn();
jest.mock("../lib/supabase/server", () => ({
  createClient: jest.fn(async () => ({
    auth: { getUser: async () => ({ data: { user: { id: "owner" } } }) },
    from: () => ({ select: () => ({ limit }) }),
    rpc,
  })),
}));
jest.mock("../lib/supabase/profile", () => ({ getOwnProfileId: jest.fn() }));
beforeEach(() => {
  jest.clearAllMocks();
  limit.mockResolvedValue({ error: { code: "42703" } });
  rpc.mockResolvedValue({ data: [{ ok: true, error: "" }], error: null });
});
test("legacy private license saving remains available while disclosure migration is held", async () => {
  const result = await saveCertifications({
    certifications: [
      {
        certName: "자격",
        documentPath: "owner/proof.png",
        documentPublic: false,
      },
    ],
  });
  expect(result.ok).toBe(true);
  expect(rpc.mock.calls[0][1].p_licenses[0]).not.toHaveProperty(
    "document_public",
  );
});
test("public evidence choice fails closed while disclosure migration is held", async () => {
  const result = await saveCertifications({
    certifications: [{ certName: "자격", documentPublic: true }],
  });
  expect(result.ok).toBe(false);
  expect(rpc).not.toHaveBeenCalled();
});
