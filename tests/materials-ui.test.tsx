// @vitest-environment jsdom
import {
  render,
  screen,
  fireEvent,
  waitFor,
  cleanup,
} from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { Materials } from "../components/modules/materials";
const fixture = vi.hoisted(() => ({ upload: vi.fn() }));
vi.mock("@/lib/supabase", () => ({
  hasSupabase: true,
  browserSupabase: () => ({
    storage: { from: () => ({ upload: fixture.upload }) },
  }),
}));
const id = "11111111-1111-4111-8111-111111111111";
const parent = "22222222-2222-4222-8222-222222222222";
function overview(versions: unknown[] = [], drafts: unknown[] = []) {
  return {
    versions,
    drafts,
    events: [],
    syncs: [],
    driveItems: [],
    total: versions.length,
    offset: 0,
    capabilities: {
      driveConfigured: false,
      driveConnected: false,
      embeddings: false,
      ocr: false,
    },
  };
}
function version(status = "review") {
  return {
    id,
    material_id: parent,
    user_id: "owner",
    file_name: "Manuale.pdf",
    storage_path: `owner/${id}/original`,
    mime_type: "application/pdf",
    byte_size: 1000,
    sha256: "a".repeat(64),
    version: 1,
    status,
    cursor: 1,
    page_count: 1,
    warnings: [],
    error_message: null,
    embedding_model: null,
    metadata: {},
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    materials: {
      id: parent,
      title: "Manuale personale",
      area: "lavoro",
      verification: "unverified",
      source: "upload",
      source_id: null,
      external_consent: false,
      created_at: new Date().toISOString(),
    },
  };
}
function respond(data: unknown, status = 200) {
  return { ok: status < 400, status, json: async () => data };
}
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.resetAllMocks();
});
describe("private administrative workflow", () => {
  it("uploads binary only to private Storage and sends metadata to the Vercel API", async () => {
    fixture.upload.mockResolvedValue({ error: null });
    const fetch = vi
      .fn()
      .mockImplementation(async (path: string) =>
        path === "/api/materials/upload"
          ? respond({ version: version("uploaded") })
          : respond(overview()),
      );
    vi.stubGlobal("fetch", fetch);
    render(<Materials />);
    await screen.findByRole("heading", { name: "Carica PDF o DOCX" });
    expect(
      screen.queryByRole("button", { name: "Sincronizza manualmente" }),
    ).toBeNull();
    fireEvent.change(screen.getByLabelText("File privati"), {
      target: {
        files: [
          new File(["%PDF-1.7 fixture"], "Manuale.pdf", {
            type: "application/pdf",
          }),
        ],
      },
    });
    fireEvent.click(screen.getByLabelText(/Confermo i diritti d’uso/));
    fireEvent.submit(
      screen
        .getByRole("button", { name: "Carica in storage privato" })
        .closest("form")!,
    );
    await waitFor(() => expect(fixture.upload).toHaveBeenCalledTimes(1));
    const request = fetch.mock.calls.find(
      (c) => c[0] === "/api/materials/upload",
    );
    expect(JSON.parse(request![1].body)).toMatchObject({
      fileName: "Manuale.pdf",
      licenseConfirmed: true,
      externalConsent: false,
    });
    expect(request![1].body).not.toContain("%PDF-1.7");
    expect(fixture.upload.mock.calls[0][1]).toBeInstanceOf(File);
    expect(fixture.upload.mock.calls[0][2]).toMatchObject({
      upsert: false,
      contentType: "application/pdf",
    });
  });
  it("does not index a reviewed document until the explicit approval action", async () => {
    const fetch = vi
      .fn()
      .mockImplementation(async (path: string, options?: { body: string }) =>
        path.startsWith("/api/materials/review?")
          ? respond({
              segment: {
                ordinal: 0,
                page: 1,
                section: "Pagina 1",
                text: "Testo estratto da controllare con attenzione.",
                kind: "text",
                reviewed: false,
              },
              count: 1,
            })
          : options
            ? respond({ status: "indexed" })
            : respond(overview([version()])),
      );
    vi.stubGlobal("fetch", fetch);
    render(<Materials />);
    await screen.findByText("Manuale personale", { selector: "strong" });
    fireEvent.click(
      screen.getByText("Manuale personale", { selector: "strong" }),
    );
    await screen.findByLabelText("Trascrizione della pagina/sezione privata");
    expect(
      fetch.mock.calls.some((c) => c[0] === "/api/materials/review" && c[1]),
    ).toBe(false);
    fireEvent.click(
      screen.getByRole("button", { name: "Approva estrazione e indicizza" }),
    );
    await waitFor(() =>
      expect(
        fetch.mock.calls.some(
          (c) =>
            c[0] === "/api/materials/review" &&
            JSON.parse(c[1].body).action === "approve",
        ),
      ).toBe(true),
    );
  });
  it("fails closed for accounts without administrative permission", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          respond(
            { error: "Account non abilitato all’amministrazione materiali." },
            403,
          ),
        ),
    );
    render(<Materials />);
    await screen.findByRole("alert");
    expect(screen.queryByLabelText("File privati")).toBeNull();
    expect(screen.getByRole("alert").textContent).toContain("non abilitato");
  });
});
