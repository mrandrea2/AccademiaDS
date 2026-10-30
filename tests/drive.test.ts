import { describe, it, expect, vi, afterEach } from "vitest";
import { createHash } from "node:crypto";
import {
  createAuthorization,
  validateOAuthState,
  driveConfigured,
  differential,
  DRIVE_SCOPE,
  exchangeCode,
} from "../lib/ingestion/drive";
import { unseal, seal } from "../lib/ingestion/crypto";
import { PDF_MIME, DOCX_MIME } from "../lib/ingestion/contracts";
import { validateCitations } from "../lib/ingestion/search";
const mocks = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({ rpc: mocks.rpc }),
}));
const key = Buffer.alloc(32, 3).toString("base64");
function config() {
  vi.stubEnv("GOOGLE_CLIENT_ID", "test-client-id");
  vi.stubEnv("GOOGLE_CLIENT_SECRET", "test-only-secret");
  vi.stubEnv("DRIVE_TOKEN_ENCRYPTION_KEY", key);
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-only-service-key");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("APP_URL", "https://academy.example");
}
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
  mocks.rpc.mockReset();
});
describe("independent authorized Drive OAuth", () => {
  it("stays disabled without app credentials", () => {
    vi.stubEnv("GOOGLE_CLIENT_ID", "");
    expect(driveConfigured()).toBe(false);
    expect(() => createAuthorization("owner")).toThrow(/Configura/);
  });
  it("uses read-only scope, fixed redirect, offline PKCE and state bound to owner", () => {
    config();
    const auth = createAuthorization("owner");
    const url = new URL(auth.url);
    expect(url.origin).toBe("https://accounts.google.com");
    expect(url.searchParams.get("scope")).toBe(DRIVE_SCOPE);
    expect(url.searchParams.get("scope")).not.toContain("drive ");
    expect(url.searchParams.get("redirect_uri")).toBe(
      "https://academy.example/api/drive/callback",
    );
    const state = validateOAuthState(
      auth.cookie,
      url.searchParams.get("state")!,
      "owner",
    );
    expect(url.searchParams.get("code_challenge")).toBe(
      createHash("sha256").update(state.verifier).digest("base64url"),
    );
    expect(() =>
      validateOAuthState(auth.cookie, state.state, "other-user"),
    ).toThrow();
    expect(() => validateOAuthState(auth.cookie, "forged", "owner")).toThrow();
    expect(() =>
      validateOAuthState(
        seal({ ...state, createdAt: Date.now() - 601000 }),
        state.state,
        "owner",
      ),
    ).toThrow();
  });
  it("exchanges only at official token endpoint and persists encrypted server-only tokens", async () => {
    config();
    const fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          access_token: "fixture-access",
          refresh_token: "fixture-refresh",
          expires_in: 3600,
          scope: DRIVE_SCOPE,
        }),
        { status: 200 },
      ),
    );
    vi.stubGlobal("fetch", fetch);
    mocks.rpc.mockResolvedValue({ error: null });
    await exchangeCode("owner", "fixture-code", "fixture-verifier");
    expect(fetch.mock.calls[0][0]).toBe("https://oauth2.googleapis.com/token");
    const parameters = mocks.rpc.mock.calls[0][1];
    expect(parameters.owner_id).toBe("owner");
    expect(parameters.tokens).not.toContain("fixture-refresh");
    expect(unseal(parameters.tokens, key)).toMatchObject({
      refresh_token: "fixture-refresh",
    });
  });
  it("rejects insufficient authorization without storing a connection", async () => {
    config();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            access_token: "fixture",
            expires_in: 3600,
            scope: "https://www.googleapis.com/auth/drive.file",
          }),
        ),
      ),
    );
    await expect(exchangeCode("owner", "code", "verifier")).rejects.toThrow(
      /insufficiente/,
    );
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("plans changed, unchanged, retry and unsupported files without assuming the folder count", () => {
    const base = {
      mimeType: PDF_MIME,
      modifiedTime: "2026-10-30T00:00:00Z",
      version: "1",
    };
    const files = [
      { ...base, id: "same", name: "same.pdf" },
      { ...base, id: "changed", name: "changed.pdf", version: "2" },
      { ...base, id: "retry", name: "retry.docx", mimeType: DOCX_MIME },
      {
        ...base,
        id: "source",
        name: "PreparazioneDS2027.jsx",
        mimeType: "text/javascript",
      },
    ];
    const known = new Map([
      [
        "same",
        { remote_version: `1:${base.modifiedTime}`, status: "imported" },
      ],
      [
        "changed",
        { remote_version: `1:${base.modifiedTime}`, status: "imported" },
      ],
      ["retry", { remote_version: `1:${base.modifiedTime}`, status: "error" }],
    ]);
    expect(differential(files, known).map((p) => p.action)).toEqual([
      "unchanged",
      "pending",
      "pending",
      "unsupported",
    ]);
  });
});
describe("RAG exact citations", () => {
  const sources = [
    {
      document_id: "d",
      version_id: "v",
      chunk_id: "c",
      title: "Fonte",
      page: 2,
      section: "Pagina 2",
      version: "1",
      content: "La collaborazione richiede ascolto e obiettivi misurabili.",
      verification: "unverified",
      rank: 1,
    },
  ];
  it("accepts only literal quotes within the actually retrieved excerpt", () => {
    expect(
      validateCitations(
        [{ source: 1, quote: "collaborazione richiede ascolto" }],
        sources,
      ),
    ).toHaveLength(1);
    expect(() =>
      validateCitations(
        [{ source: 1, quote: "una norma che non compare" }],
        sources,
      ),
    ).toThrow();
    expect(() =>
      validateCitations(
        [{ source: 2, quote: "collaborazione richiede ascolto" }],
        sources,
      ),
    ).toThrow();
  });
});
describe("external response limits", () => {
  it("bounds streamed response bytes before parsing, even without content-length", async () => {
    const { limitedJson } = await import("../lib/ingestion/net");
    await expect(
      limitedJson(new Response("x".repeat(100)), 20),
    ).rejects.toThrow(/limite/);
    await expect(
      limitedJson(new Response(JSON.stringify({ ok: true })), 100),
    ).resolves.toEqual({ ok: true });
  });
});
