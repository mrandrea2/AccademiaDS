import { describe, it, expect, vi, beforeEach } from "vitest";
const mocks = vi.hoisted(() => ({
  inserted: [] as Record<string, unknown>[],
  db: {},
}));
vi.mock("@/lib/ingestion/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/ingestion/auth")>();
  return {
    ...actual,
    adminHandler:
      (handler: Parameters<typeof actual.adminHandler>[0]) =>
      async (request: Request) => {
        try {
          return await handler(request, {
            db: mocks.db,
            user: { id: "owner" },
          } as unknown as import("../lib/ingestion/auth").AdminContext);
        } catch (error) {
          return Response.json(
            { error: error instanceof Error ? error.message : "error" },
            { status: error instanceof actual.ApiError ? error.status : 500 },
          );
        }
      },
  };
});
vi.mock("@/lib/ingestion/service", () => ({
  versionFor: async () => ({
    id: "11111111-1111-4111-8111-111111111111",
    material_id: "22222222-2222-4222-8222-222222222222",
    status: "indexed",
  }),
}));
import { POST } from "../app/api/materials/drafts/route";
beforeEach(() => {
  mocks.inserted.length = 0;
  mocks.db = {
    from: (table: string) => {
      const query = {
        select: () => query,
        eq: () => query,
        insert: (data: Record<string, unknown>) => {
          mocks.inserted.push(data);
          return query;
        },
        single: async () =>
          table === "material_segments"
            ? {
                data: {
                  text: "La collaborazione richiede ascolto e obiettivi misurabili.",
                  page: 7,
                  section: "Pagina 7",
                },
                error: null,
              }
            : { data: mocks.inserted[0], error: null },
      };
      return query;
    },
  };
});
const request = (quote: string) =>
  new Request("https://academy.example/api/materials/drafts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      versionId: "11111111-1111-4111-8111-111111111111",
      body: {
        kind: "summary",
        title: "Una sintesi privata",
        body: "Una sintesi basata sulle evidenze della fonte.",
      },
      citations: [{ segmentOrdinal: 6, quote }],
    }),
  });
describe("teaching draft creation contract", () => {
  it("stores exact source locators and always creates an unpublished draft", async () => {
    const response = await POST(request("collaborazione richiede ascolto"));
    expect(response.status).toBe(200);
    expect(mocks.inserted[0]).toMatchObject({
      status: "draft",
      provenance: "personal",
      citations: [
        {
          segmentOrdinal: 6,
          page: 7,
          section: "Pagina 7",
          quote: "collaborazione richiede ascolto",
        },
      ],
    });
  });
  it("rejects invented source quotes without creating a draft", async () => {
    const response = await POST(request("Una fonte inesistente o inventata."));
    expect(response.status).toBe(400);
    expect(mocks.inserted).toHaveLength(0);
  });
});
