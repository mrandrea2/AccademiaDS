import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { vector } from "@electric-sql/pglite-pgvector";
import { readFileSync } from "node:fs";
import { beforeAll, afterAll, describe, it, expect } from "vitest";
const alice = "11111111-1111-4111-8111-111111111111";
const bob = "22222222-2222-4222-8222-222222222222";
const plain = "44444444-4444-4444-8444-444444444444";
let db: PGlite;
let versionId: string;
let token: string;
let materialId: string;
beforeAll(async () => {
  db = new PGlite({ extensions: { pgcrypto, vector } });
  await db.exec(
    `create role anon;create role authenticated;create role service_role;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth,public to authenticated;grant execute on function auth.uid() to authenticated;`,
  );
  await db.exec(
    readFileSync("supabase/migrations/202610300001_academy.sql", "utf8"),
  );
  await db.exec(
    "alter default privileges in schema public grant all on tables to authenticated,anon",
  );
  await db.exec(
    readFileSync("supabase/migrations/202610300002_materials.sql", "utf8"),
  );
  await db.exec(
    `create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text);alter table storage.objects enable row level security;grant usage on schema storage to authenticated;grant select,insert,delete on storage.objects to authenticated;create function storage.foldername(name text) returns text[] language sql as $$select string_to_array(name,'/')$$;`,
  );
  await db.exec(
    readFileSync(
      "supabase/migrations/202610300003_material_storage.sql",
      "utf8",
    ),
  );
  await db.query("insert into auth.users values($1),($2),($3)", [
    alice,
    bob,
    plain,
  ]);
  await db.query("insert into public.material_admins values($1),($2)", [
    alice,
    bob,
  ]);
}, 60000);
afterAll(async () => {
  await db?.close();
});
async function as(id: string) {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
  await db.exec("set role authenticated");
}
describe.sequential("private acquisition database", () => {
  it("forces the application bucket private even if it already existed as public", async () => {
    const result = await db.query<{ public: boolean }>(
      "select public from storage.buckets where id='academy-materials'",
    );
    expect(result.rows[0].public).toBe(false);
  });
  it("removes broad inherited table privileges before granting owner CRUD", async () => {
    const result = await db.query<{ truncate: boolean; insert: boolean }>(
      "select has_table_privilege('authenticated','public.material_versions','TRUNCATE') as truncate,has_table_privilege('authenticated','public.material_admins','INSERT') as insert",
    );
    expect(result.rows[0]).toEqual({ truncate: false, insert: false });
  });
  it("does not allow self-promotion to administrator", async () => {
    await as(plain);
    expect(
      (
        await db.query<{ admin: boolean }>(
          "select public.is_material_admin() as admin",
        )
      ).rows[0].admin,
    ).toBe(false);
    await expect(
      db.query("insert into public.material_admins values($1)", [plain]),
    ).rejects.toThrow(/permission denied/);
    await expect(
      db.query(
        "select public.reserve_material('Test','test.pdf','application/pdf',100,false)",
      ),
    ).rejects.toThrow(/Administrator/);
  });
  it("reserves immutable version and isolates private storage paths", async () => {
    await as(alice);
    const result = await db.query<{ id: string; material_id: string }>(
      "select * from public.reserve_material('Manuale personale','manuale.pdf','application/pdf',100,true)",
    );
    versionId = result.rows[0].id;
    materialId = result.rows[0].material_id;
    await db.query(
      "insert into storage.objects(bucket_id,name) values('academy-materials',$1)",
      [`${alice}/${versionId}/original`],
    );
    await as(bob);
    expect(
      (await db.query("select * from public.material_versions")).rows,
    ).toHaveLength(0);
    expect((await db.query("select * from storage.objects")).rows).toHaveLength(
      0,
    );
    await expect(
      db.query(
        "insert into storage.objects(bucket_id,name) values('academy-materials',$1)",
        [`${alice}/${versionId}/original`],
      ),
    ).rejects.toThrow(/row-level security/);
  });
  it("leases jobs exclusively and persists batches atomically", async () => {
    await as(alice);
    const claim = await db.query<{ lease_token: string }>(
      "select * from public.claim_material_job($1)",
      [versionId],
    );
    token = claim.rows[0].lease_token;
    expect(
      (
        await db.query("select * from public.claim_material_job($1)", [
          versionId,
        ])
      ).rows,
    ).toHaveLength(0);
    await db.query("select public.register_material_hash($1,$2,$3)", [
      versionId,
      token,
      "a".repeat(64),
    ]);
    await expect(
      db.query("select public.commit_material_batch($1,$2,$3,1,true,1,$4,$5)", [
        versionId,
        bob,
        JSON.stringify([]),
        [],
        JSON.stringify({}),
      ]),
    ).rejects.toThrow(/Lease/);
    await db.query(
      "select public.commit_material_batch($1,$2,$3,1,true,1,$4,$5)",
      [
        versionId,
        token,
        JSON.stringify([
          {
            ordinal: 0,
            page: 1,
            section: "Pagina 1",
            text: "La collaborazione richiede ascolto e obiettivi misurabili.",
            kind: "text",
          },
        ]),
        [],
        JSON.stringify({ format: "pdf" }),
      ],
    );
    expect(
      (
        await db.query<{ status: string }>(
          "select status from public.material_versions where id=$1",
          [versionId],
        )
      ).rows[0].status,
    ).toBe("review");
  });
  it("refuses indexing before approval, then searches FTS and cosine only within owned sources", async () => {
    await as(alice);
    const embedding = [1, ...Array(1535).fill(0)];
    const chunks = JSON.stringify([
      {
        ordinal: 0,
        page: 1,
        section: "Pagina 1",
        content: "La collaborazione richiede ascolto e obiettivi misurabili.",
        start: 0,
        end: 57,
        embedding,
      },
    ]);
    await expect(
      db.query("select public.replace_material_index($1,$2,$3)", [
        versionId,
        chunks,
        "text-embedding-3-small",
      ]),
    ).rejects.toThrow(/Approvazione/);
    await db.query(
      "update public.material_versions set status='indexing',approved_at=now() where id=$1",
      [versionId],
    );
    await db.query("select public.replace_material_index($1,$2,$3)", [
      versionId,
      chunks,
      "text-embedding-3-small",
    ]);
    expect(
      (
        await db.query("select * from public.search_materials($1,$2,$3)", [
          "obiettivi",
          [materialId],
          null,
        ])
      ).rows,
    ).toHaveLength(1);
    expect(
      (
        await db.query("select * from public.search_materials($1,$2,$3)", [
          "senza riscontro lessicale",
          [materialId],
          JSON.stringify(embedding),
        ])
      ).rows,
    ).toHaveLength(1);
    expect(
      (
        await db.query("select * from public.search_materials($1,$2,$3)", [
          "obiettivi",
          [bob],
          null,
        ])
      ).rows,
    ).toHaveLength(0);
    await as(bob);
    expect(
      (
        await db.query("select * from public.search_materials($1,$2,$3)", [
          "obiettivi",
          [],
          JSON.stringify(embedding),
        ])
      ).rows,
    ).toHaveLength(0);
  });
  it("removes stored vectors on consent revocation and rejects late writes", async () => {
    await as(alice);
    await db.query(
      "update public.materials set external_consent=false where id=$1",
      [materialId],
    );
    expect(
      (
        await db.query<{ embedding: unknown }>(
          "select embedding from public.material_chunks where material_id=$1",
          [materialId],
        )
      ).rows.every((r) => r.embedding === null),
    ).toBe(true);
    await expect(
      db.query(
        "update public.material_chunks set embedding=$1 where material_id=$2",
        [JSON.stringify([1, ...Array(1535).fill(0)]), materialId],
      ),
    ).rejects.toThrow(/consent/);
  });
  it("deduplicates by per-owner content hash", async () => {
    await as(alice);
    const second = await db.query<{ id: string }>(
      "select * from public.reserve_material('Copia','copia.pdf','application/pdf',100,false)",
    );
    const id = second.rows[0].id;
    const claimed = await db.query<{ lease_token: string }>(
      "select * from public.claim_material_job($1)",
      [id],
    );
    const duplicate = await db.query<{ duplicate: string }>(
      "select public.register_material_hash($1,$2,$3) as duplicate",
      [id, claimed.rows[0].lease_token, "a".repeat(64)],
    );
    expect(duplicate.rows[0].duplicate).toBe(versionId);
    expect(
      (
        await db.query<{ status: string }>(
          "select status from public.material_versions where id=$1",
          [id],
        )
      ).rows[0].status,
    ).toBe("duplicate");
  });
  it("blocks unreviewed OCR pages even beyond a first API page of rows", async () => {
    await as(alice);
    const result = await db.query<{ id: string }>(
      "select * from public.reserve_material('Scansione','scan.pdf','application/pdf',100,false)",
    );
    const id = result.rows[0].id;
    await db.query(
      "update public.material_versions set status='review' where id=$1",
      [id],
    );
    await db.query(
      "insert into public.material_segments(version_id,user_id,ordinal,page,section,text,kind) values($1,$2,1001,1002,'Pagina 1002','testo OCR non verificato','ocr')",
      [id, alice],
    );
    await expect(
      db.query("select public.approve_material_extraction($1)", [id]),
    ).rejects.toThrow(/review/);
    await db.query(
      "update public.material_segments set reviewed=true where version_id=$1",
      [id],
    );
    await db.query("select public.approve_material_extraction($1)", [id]);
    expect(
      (
        await db.query<{ status: string }>(
          "select status from public.material_versions where id=$1",
          [id],
        )
      ).rows[0].status,
    ).toBe("indexing");
  });
  it("allows safe account erasure after admin revocation, without revealing other owners paths", async () => {
    await db.exec("reset role");
    await db.query("delete from public.material_admins where user_id=$1", [
      alice,
    ]);
    await as(alice);
    expect(
      (await db.query("select * from public.material_versions")).rows,
    ).toHaveLength(0);
    const paths = await db.query<{ storage_path: string }>(
      "select * from public.own_material_cleanup_paths()",
    );
    expect(paths.rows.length).toBeGreaterThan(0);
    expect(
      paths.rows.every((r) => r.storage_path.startsWith(alice + "/")),
    ).toBe(true);
    await db.query("delete from storage.objects where name=$1", [
      alice + "/" + versionId + "/original",
    ]);
    await as(bob);
    expect(
      (await db.query("select * from public.own_material_cleanup_paths()"))
        .rows,
    ).toHaveLength(0);
  });
  it("cannot read encrypted token store or token RPCs as an authenticated administrator", async () => {
    await as(alice);
    await expect(
      db.query("select * from academy_private.drive_connections"),
    ).rejects.toThrow(/permission denied/);
    await expect(
      db.query("select public.drive_connection_get($1)", [alice]),
    ).rejects.toThrow(/permission denied/);
  });
});
