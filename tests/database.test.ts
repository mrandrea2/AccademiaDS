import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { readFileSync } from "node:fs";
import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { emptyState } from "../lib/content";
const alice = "11111111-1111-4111-8111-111111111111";
const bob = "22222222-2222-4222-8222-222222222222";
const doc = "33333333-3333-4333-8333-333333333333";
let db: PGlite;
beforeAll(async () => {
  db = new PGlite({ extensions: { pgcrypto } });
  // Minimal Supabase Auth contract. PostgreSQL RLS, FKs and functions are real.
  await db.exec(`create role anon;create role authenticated;create schema auth;
 create table auth.users(id uuid primary key);
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema auth,public to authenticated;grant execute on function auth.uid() to authenticated;`);
  await db.exec(
    readFileSync("supabase/migrations/202610300001_academy.sql", "utf8"),
  );
  await db.query("insert into auth.users values($1),($2)", [alice, bob]);
}, 30000);
afterAll(async () => {
  await db?.close();
});
async function asUser(id: string) {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
  await db.exec("set role authenticated");
}
describe.sequential("PostgreSQL migration and user isolation", () => {
  it("enables RLS on all 15 private tables", async () => {
    const rows = await db.query<{ tablename: string; rowsecurity: boolean }>(
      "select tablename,rowsecurity from pg_tables where schemaname='public'",
    );
    expect(rows.rows).toHaveLength(15);
    expect(rows.rows.every((r) => r.rowsecurity)).toBe(true);
  });
  it("saves a private workspace and indexes document pages atomically", async () => {
    await asUser(alice);
    const state = {
      ...emptyState(),
      documents: [
        {
          id: doc,
          title: "Appunti privati",
          text: "Collaborazione e gestione del gruppo.\fValutazione degli esiti del progetto.",
          tags: ["studio"],
          createdAt: new Date().toISOString(),
          source: {
            version: "1",
            provenance: "personal",
            verification: "unverified",
          },
        },
      ],
    };
    const saved = await db.query<{ revision: number }>(
      "select public.save_workspace($1::jsonb,0) as revision",
      [JSON.stringify(state)],
    );
    expect(Number(saved.rows[0].revision)).toBe(1);
    const hits = await db.query<{ page: number }>(
      "select * from public.search_private_chunks('valutazione')",
    );
    expect(hits.rows[0].page).toBe(2);
  });
  it("hides Alice documents and profile from Bob and rejects ownership spoofing", async () => {
    await asUser(bob);
    expect(
      (await db.query("select * from public.documents")).rows,
    ).toHaveLength(0);
    expect(
      (await db.query("select * from public.document_chunks")).rows,
    ).toHaveLength(0);
    expect((await db.query("select * from public.profiles")).rows).toHaveLength(
      1,
    );
    expect(
      (
        await db.query(
          "select * from public.search_private_chunks('valutazione')",
        )
      ).rows,
    ).toHaveLength(0);
    await expect(
      db.query(
        "insert into public.documents(user_id,title,content) values($1,$2,$3)",
        [alice, "Intrusione", "Testo"],
      ),
    ).rejects.toThrow(/row-level security/);
  });
  it("rejects cross-user references even when row ownership is valid", async () => {
    await asUser(bob);
    await expect(
      db.query(
        "insert into public.document_chunks(user_id,document_id,page,chunk_index,content,version) values($1,$2,3,0,$3,$4)",
        [bob, doc, "Estratto", "1"],
      ),
    ).rejects.toThrow(/foreign key/);
  });
  it("rejects stale revisions without destroying saved state", async () => {
    await asUser(alice);
    await expect(
      db.query("select public.save_workspace($1::jsonb,0)", [
        JSON.stringify(emptyState()),
      ]),
    ).rejects.toThrow(/Stale workspace/);
    expect(
      (await db.query("select * from public.documents")).rows,
    ).toHaveLength(1);
  });
  it("deletes indexed chunks when the owner deletes documents", async () => {
    await asUser(alice);
    await db.query("select public.save_workspace($1::jsonb,1)", [
      JSON.stringify(emptyState()),
    ]);
    expect(
      (await db.query("select * from public.document_chunks")).rows,
    ).toHaveLength(0);
  });
  it("cascades account deletion only to the calling user", async () => {
    await asUser(bob);
    await db.query("select public.delete_own_account()");
    await db.exec("reset role");
    expect((await db.query("select id from auth.users")).rows).toEqual([
      { id: alice },
    ]);
  });
});
