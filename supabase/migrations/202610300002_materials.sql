begin;
create schema if not exists extensions;
create extension if not exists vector with schema extensions;
grant usage on schema extensions to authenticated;
create table public.material_admins(user_id uuid primary key references auth.users(id) on delete cascade);
alter table public.material_admins enable row level security;
create policy own_admin_status on public.material_admins for select to authenticated using(user_id=(select auth.uid()));
revoke all on public.material_admins from anon,authenticated;
grant select on public.material_admins to authenticated;
create function public.is_material_admin() returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from public.material_admins where user_id=auth.uid())$$;
revoke all on function public.is_material_admin() from public,anon;
grant execute on function public.is_material_admin() to authenticated;
create table public.materials(
 id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,
 title text not null check(length(title) between 3 and 180), area text check(area in ('organizzazione','gestione','programmazione','diritto','amministrazione','lavoro','didattica','digitale','europa')),
 verification public.verification_status not null default 'unverified',source text not null check(source in ('upload','drive')),source_id text,
 license_confirmed_at timestamptz not null,external_consent boolean not null default false,created_at timestamptz not null default now(),
 unique(id,user_id),unique(user_id,source,source_id)
);
create table public.material_versions(
 id uuid primary key default gen_random_uuid(),material_id uuid not null,user_id uuid not null references auth.users(id) on delete cascade,
 version integer not null check(version>0),file_name text not null,storage_path text not null unique,mime_type text not null check(mime_type in ('application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document')),
 byte_size bigint not null check(byte_size>0 and byte_size<=52428800),sha256 text check(sha256 ~ '^[0-9a-f]{64}$'),
 status text not null default 'uploaded' check(status in ('uploaded','processing','needs_ocr','review','indexing','indexed','error','duplicate')),
 cursor integer not null default 0,page_count integer check(page_count>0),warnings text[] not null default '{}',metadata jsonb not null default '{}',
 error_message text,attempts integer not null default 0,lease_token uuid,lease_until timestamptz,embedding_model text,
 approved_at timestamptz,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 foreign key(material_id,user_id) references public.materials(id,user_id) on delete cascade,
 unique(material_id,version),unique(id,user_id),unique(id,material_id,user_id),
 check(storage_path=user_id::text||'/'||id::text||'/original')
);
create unique index material_content_dedup on public.material_versions(user_id,sha256) where status<>'duplicate';
create table public.material_segments(
 id uuid primary key default gen_random_uuid(),version_id uuid not null,user_id uuid not null references auth.users(id) on delete cascade,
 ordinal integer not null check(ordinal>=0),page integer check(page>0),section text not null,text text not null check(length(text)<=100000),
 kind text not null check(kind in ('text','table','ocr')),reviewed boolean not null default false,
 foreign key(version_id,user_id) references public.material_versions(id,user_id) on delete cascade,unique(version_id,ordinal)
);
create table public.material_chunks(
 id uuid primary key default gen_random_uuid(),version_id uuid not null,material_id uuid not null,user_id uuid not null references auth.users(id) on delete cascade,
 ordinal integer not null,page integer,section text not null,content text not null check(length(content)<=800),start_offset integer not null,end_offset integer not null,
 embedding extensions.vector(1536),embedding_model text,
 search_vector tsvector generated always as(to_tsvector('italian',content)) stored,
 foreign key(version_id,material_id,user_id) references public.material_versions(id,material_id,user_id) on delete cascade,unique(version_id,ordinal)
);
create function public.enforce_material_embedding_consent() returns trigger language plpgsql security invoker set search_path='' as $$
 begin if new.embedding is not null and not exists(select 1 from public.materials m where m.id=new.material_id and m.user_id=new.user_id and m.external_consent) then raise exception 'External processing consent required';end if;return new;end $$;
create trigger embedding_requires_consent before insert or update of embedding on public.material_chunks for each row execute function public.enforce_material_embedding_consent();
create function public.revoke_material_embeddings() returns trigger language plpgsql security invoker set search_path='' as $$
 begin if not new.external_consent then update public.material_chunks set embedding=null,embedding_model=null where material_id=new.id;update public.material_versions set embedding_model=null where material_id=new.id;end if;return new;end $$;
create trigger clear_embeddings_on_revoke after update of external_consent on public.materials for each row execute function public.revoke_material_embeddings();
revoke all on function public.enforce_material_embedding_consent(),public.revoke_material_embeddings() from public,anon,authenticated;
create index material_fts on public.material_chunks using gin(search_vector);
-- Exact cosine search avoids an ANN recall/ownership tradeoff for this bounded personal corpus.
create table public.ingestion_events(
 id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,
 version_id uuid,message text not null,level text not null check(level in ('info','warning','error')),created_at timestamptz not null default now(),
 foreign key(version_id,user_id) references public.material_versions(id,user_id) on delete cascade
);
create table public.teaching_drafts(
 id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,material_id uuid not null,version_id uuid not null,
 body jsonb not null,citations jsonb not null,provenance text not null check(provenance in ('personal','ai')),
 status text not null default 'draft' check(status in ('draft','approved','rejected')),review_note text,approved_at timestamptz,approved_by uuid references auth.users(id) on delete cascade,
 check(status<>'approved' or (approved_at is not null and approved_by is not null and length(review_note)>=10)),
 check(jsonb_typeof(body)='object' and jsonb_typeof(citations)='array' and jsonb_array_length(citations)>0),
 created_at timestamptz not null default now(),foreign key(version_id,material_id,user_id) references public.material_versions(id,material_id,user_id) on delete cascade
);
create table public.drive_sync_runs(
 id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,
 status text not null check(status in ('running','complete','error')),discovered integer not null default 0,imported integer not null default 0,skipped integer not null default 0,errors jsonb not null default '[]',
 started_at timestamptz not null default now(),finished_at timestamptz
);
create unique index one_drive_run on public.drive_sync_runs(user_id) where status='running';
create table public.drive_items(
 user_id uuid not null references auth.users(id) on delete cascade,file_id text not null,name text not null,modified_time text not null,remote_version text not null,
 mime_type text not null,status text not null,material_id uuid,last_seen_run uuid references public.drive_sync_runs(id) on delete set null,
 last_error text,lease_until timestamptz,primary key(user_id,file_id),foreign key(material_id,user_id) references public.materials(id,user_id) on delete cascade
);
-- Account erasure remains possible after administrative access is revoked.
create function public.own_material_cleanup_paths(page_offset integer default 0) returns table(storage_path text) language sql security definer set search_path='' as $$
 select v.storage_path from public.material_versions v where v.user_id=auth.uid() order by v.id limit 500 offset greatest(0,page_offset);
 $$;
revoke all on function public.own_material_cleanup_paths(integer) from public,anon;
grant execute on function public.own_material_cleanup_paths(integer) to authenticated;
-- Credentials live outside exposed public schema. Only server service_role can access.
create schema if not exists academy_private;
revoke all on schema academy_private from public,anon,authenticated;
create table academy_private.drive_connections(user_id uuid primary key references auth.users(id) on delete cascade,encrypted_tokens text not null,scopes text[] not null,connected_at timestamptz not null default now());
alter table academy_private.drive_connections enable row level security;
grant usage on schema academy_private to service_role;
grant all on academy_private.drive_connections to service_role;
-- Credentials are accessed through narrow service-role RPCs; never expose their schema through PostgREST.
create function public.drive_connection_get(owner_id uuid) returns text language sql security definer set search_path='' as $$select encrypted_tokens from academy_private.drive_connections where user_id=owner_id$$;
create function public.drive_connection_set(owner_id uuid,tokens text,granted_scopes text[]) returns void language sql security definer set search_path='' as $$insert into academy_private.drive_connections(user_id,encrypted_tokens,scopes) values(owner_id,tokens,granted_scopes) on conflict(user_id) do update set encrypted_tokens=excluded.encrypted_tokens,scopes=excluded.scopes$$;
create function public.drive_connection_delete(owner_id uuid) returns void language sql security definer set search_path='' as $$delete from academy_private.drive_connections where user_id=owner_id$$;
revoke all on function public.drive_connection_get(uuid),public.drive_connection_set(uuid,text,text[]),public.drive_connection_delete(uuid) from public,anon,authenticated;
grant execute on function public.drive_connection_get(uuid),public.drive_connection_set(uuid,text,text[]),public.drive_connection_delete(uuid) to service_role;
do $$declare t text;begin
 foreach t in array array['materials','material_versions','material_segments','material_chunks','ingestion_events','teaching_drafts','drive_sync_runs','drive_items'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('create policy owner_admin on public.%I for all to authenticated using(user_id=(select auth.uid()) and (select public.is_material_admin())) with check(user_id=(select auth.uid()) and (select public.is_material_admin()))',t);
 execute format('revoke all on public.%I from anon,authenticated',t);
 execute format('grant select,insert,update,delete on public.%I to authenticated',t);
 execute format('create index %I on public.%I(user_id)',t||'_user_idx',t);
 end loop;end $$;
create function public.reserve_material(file_title text,file_name text,mime text,bytes bigint,external_allowed boolean,parent_id uuid default null,remote_id text default null)
 returns public.material_versions language plpgsql security invoker set search_path='' as $$
 declare m public.materials;v public.material_versions;new_id uuid=gen_random_uuid();next_version integer;
 begin
 if not public.is_material_admin() then raise exception 'Administrator required';end if;
 if parent_id is null and remote_id is not null then select id into parent_id from public.materials where user_id=auth.uid() and source='drive' and source_id=remote_id;end if;
 if parent_id is null then
 insert into public.materials(user_id,title,source,source_id,external_consent,license_confirmed_at) values(auth.uid(),file_title,case when remote_id is null then 'upload' else 'drive' end,remote_id,external_allowed,now()) returning * into m;
 else select * into m from public.materials where id=parent_id and user_id=auth.uid() for update;
 if m.id is null then raise exception 'Material not found';end if;
 end if;
 select coalesce(max(version),0)+1 into next_version from public.material_versions where material_id=m.id;
 insert into public.material_versions(id,material_id,user_id,version,file_name,storage_path,mime_type,byte_size)
 values(new_id,m.id,auth.uid(),next_version,file_name,auth.uid()::text||'/'||new_id::text||'/original',mime,bytes) returning * into v;
 insert into public.ingestion_events(user_id,version_id,message,level) values(auth.uid(),new_id,'Caricamento riservato, originale privato','info');
 return v;end $$;
create function public.register_material_hash(job_id uuid,token uuid,content_hash text) returns uuid language plpgsql security invoker set search_path='' as $$
 declare duplicate_id uuid;
 begin
 if not exists(select 1 from public.material_versions where id=job_id and user_id=auth.uid() and lease_token=token and status='processing') then raise exception 'Lease not valid';end if;
 select id into duplicate_id from public.material_versions where user_id=auth.uid() and sha256=content_hash and status<>'duplicate' and id<>job_id;
 if duplicate_id is not null then
 update public.material_versions set status='duplicate',sha256=content_hash,metadata=metadata||jsonb_build_object('duplicate_of',duplicate_id),lease_token=null,lease_until=null,updated_at=now() where id=job_id;
 return duplicate_id;end if;
 begin update public.material_versions set sha256=content_hash where id=job_id;
 exception when unique_violation then
 select id into duplicate_id from public.material_versions where user_id=auth.uid() and sha256=content_hash and status<>'duplicate';
 update public.material_versions set status='duplicate',sha256=content_hash,metadata=metadata||jsonb_build_object('duplicate_of',duplicate_id),lease_token=null,lease_until=null,updated_at=now() where id=job_id;
 end;
 return duplicate_id;end $$;
revoke all on function public.reserve_material(text,text,text,bigint,boolean,uuid,text),public.register_material_hash(uuid,uuid,text) from public,anon;
grant execute on function public.reserve_material(text,text,text,bigint,boolean,uuid,text),public.register_material_hash(uuid,uuid,text) to authenticated;
create function public.record_drive_import(run_id uuid,remote_file_id text,parent_id uuid) returns void language plpgsql security invoker set search_path='' as $$
 begin
 if not exists(select 1 from public.drive_sync_runs where id=run_id and user_id=auth.uid() and status='running') then raise exception 'Sync not running';end if;
 update public.drive_items set status='imported',material_id=parent_id,last_error=null,lease_until=null where user_id=auth.uid() and file_id=remote_file_id and last_seen_run=run_id;
 if not found then raise exception 'File not in sync';end if;
 update public.drive_sync_runs set imported=imported+1 where id=run_id;
 end $$;
revoke all on function public.record_drive_import(uuid,text,uuid) from public,anon;
grant execute on function public.record_drive_import(uuid,text,uuid) to authenticated;
create function public.claim_material_job(job_id uuid) returns setof public.material_versions language plpgsql security invoker set search_path='' as $$
 begin return query update public.material_versions set status='processing',lease_token=gen_random_uuid(),lease_until=now()+interval '120 seconds',attempts=attempts+1,updated_at=now(),error_message=null
 where id=job_id and user_id=auth.uid() and attempts<20 and (status='uploaded' or (status='processing' and lease_until<now())) returning *;end $$;
create function public.commit_material_batch(job_id uuid,token uuid,segments jsonb,next_cursor integer,complete boolean,total_pages integer,batch_warnings text[],extra_metadata jsonb)
 returns void language plpgsql security invoker set search_path='' as $$
 declare job public.material_versions;item jsonb;scan boolean;
 begin
 select * into job from public.material_versions where id=job_id and user_id=auth.uid() and lease_token=token and status='processing' for update;
 if job.id is null then raise exception 'Lease not valid';end if;
 for item in select value from jsonb_array_elements(segments) loop
 insert into public.material_segments(version_id,user_id,ordinal,page,section,text,kind) values(job.id,auth.uid(),(item->>'ordinal')::integer,(item->>'page')::integer,item->>'section',item->>'text',item->>'kind')
 on conflict(version_id,ordinal) do update set text=excluded.text,page=excluded.page,section=excluded.section,kind=excluded.kind,reviewed=false;
 end loop;
 if (select coalesce(sum(length(text)),0) from public.material_segments where version_id=job.id)>8000000 then raise exception 'Extracted text limit exceeded';end if;
 select exists(select 1 from public.material_segments where version_id=job.id and length(regexp_replace(text,'\s','','g'))<25) into scan;
 update public.material_versions set cursor=next_cursor,page_count=coalesce(total_pages,page_count),warnings=warnings||batch_warnings,metadata=metadata||extra_metadata,
 status=case when complete then case when scan then 'needs_ocr' else 'review' end else 'uploaded' end,lease_token=null,lease_until=null,updated_at=now(),attempts=0 where id=job.id;
 insert into public.ingestion_events(user_id,version_id,message,level) values(auth.uid(),job.id,case when complete then 'Estrazione terminata, revisione richiesta' else 'Lotto estratto' end,'info');
 end $$;
create function public.approve_material_extraction(job_id uuid) returns void language plpgsql security invoker set search_path='' as $$
 begin
 if not exists(select 1 from public.material_versions where id=job_id and user_id=auth.uid() and status in ('review','needs_ocr','indexing')) then raise exception 'Extraction not ready';end if;
 if not exists(select 1 from public.material_segments where version_id=job_id and length(trim(text))>0) then raise exception 'No text to index';end if;
 if exists(select 1 from public.material_segments where version_id=job_id and not reviewed and (kind='ocr' or length(regexp_replace(text,'\s','','g'))<25)) then raise exception 'OCR or sparse pages require review';end if;
 update public.material_versions set status='indexing',approved_at=now(),updated_at=now() where id=job_id;
 end $$;
revoke all on function public.approve_material_extraction(uuid) from public,anon;
grant execute on function public.approve_material_extraction(uuid) to authenticated;
create function public.replace_material_index(job_id uuid,chunks jsonb,model_name text) returns void language plpgsql security invoker set search_path='' as $$
 declare job public.material_versions;item jsonb;
 begin
 select * into job from public.material_versions where id=job_id and user_id=auth.uid() and status='indexing' and approved_at is not null for update;
 if job.id is null then raise exception 'Approvazione richiesta';end if;
 delete from public.material_chunks where version_id=job.id;
 for item in select value from jsonb_array_elements(chunks) loop
 insert into public.material_chunks(version_id,material_id,user_id,ordinal,page,section,content,start_offset,end_offset,embedding,embedding_model)
 values(job.id,job.material_id,auth.uid(),(item->>'ordinal')::int,(item->>'page')::int,item->>'section',item->>'content',(item->>'start')::int,(item->>'end')::int,(item->>'embedding')::extensions.vector,model_name);
 end loop;
 update public.material_versions set status='indexed',embedding_model=model_name,error_message=null,updated_at=now() where id=job.id;
 insert into public.ingestion_events(user_id,version_id,message,level) values(auth.uid(),job.id,'Indice aggiornato, versione privata disponibile','info');
 end $$;
create function public.search_materials(search_query text,source_ids uuid[] default '{}',query_embedding extensions.vector(1536) default null)
 returns table(document_id uuid,version_id uuid,chunk_id uuid,title text,page integer,section text,version text,content text,verification text,rank double precision)
 language sql stable security invoker set search_path='' as $$
 with lex as(select to_tsquery('italian',string_agg(quote_literal(x),' | ')) as q from unnest(tsvector_to_array(to_tsvector('italian',left(search_query,1000)))) as x),
 candidates as(select m.id as document_id,v.id as version_id,c.id as chunk_id,m.title,c.page,c.section,v.version::text as version,left(c.content,600) as content,m.verification::text as verification,
 (case when c.search_vector @@ lex.q then 1+ts_rank(c.search_vector,lex.q) else 0 end + case when query_embedding is not null and c.embedding is not null then greatest(0,1-(c.embedding OPERATOR(extensions.<=>) query_embedding)) else 0 end)::double precision as rank
 from public.material_chunks c join public.material_versions v on v.id=c.version_id join public.materials m on m.id=c.material_id cross join lex
 where c.user_id=auth.uid() and v.status='indexed' and (cardinality(source_ids)=0 or m.id=any(source_ids))
 and v.version=(select max(v2.version) from public.material_versions v2 where v2.material_id=m.id and v2.status='indexed')
 and (c.search_vector @@ lex.q or (query_embedding is not null and c.embedding is not null and 1-(c.embedding OPERATOR(extensions.<=>) query_embedding)>=0.35)))
 select * from candidates order by rank desc,chunk_id limit 4;
 $$;
revoke all on function public.claim_material_job(uuid),public.commit_material_batch(uuid,uuid,jsonb,integer,boolean,integer,text[],jsonb),public.replace_material_index(uuid,jsonb,text),public.search_materials(text,uuid[],extensions.vector) from public,anon;
grant execute on function public.claim_material_job(uuid),public.commit_material_batch(uuid,uuid,jsonb,integer,boolean,integer,text[],jsonb),public.replace_material_index(uuid,jsonb,text),public.search_materials(text,uuid[],extensions.vector) to authenticated;
create function public.search_private_chunks_filtered(search_query text,source_ids uuid[] default '{}')
 returns table(document_id uuid,title text,page integer,version text,content text)
 language sql stable security invoker set search_path='' as $$
 select d.id,d.title,c.page,c.version,left(c.content,600) from public.document_chunks c
 join public.documents d on d.id=c.document_id and d.user_id=c.user_id
 where c.user_id=auth.uid() and (cardinality(source_ids)=0 or d.id=any(source_ids))
 and c.search_vector @@ websearch_to_tsquery('italian',left(search_query,1000))
 order by ts_rank(c.search_vector,websearch_to_tsquery('italian',left(search_query,1000))) desc,c.id limit 4;
 $$;
revoke all on function public.search_private_chunks_filtered(text,uuid[]) from public,anon;
grant execute on function public.search_private_chunks_filtered(text,uuid[]) to authenticated;
commit;
