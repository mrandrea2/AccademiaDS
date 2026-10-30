-- DS Academy: private by default. Apply with Supabase CLI or SQL editor.
begin;
create extension if not exists pgcrypto;
create type public.verification_status as enum ('unverified','verified','outdated');
create type public.content_provenance as enum ('manual','ai','official','demo','personal');
create table public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 display_name text not null default '',
 study_state jsonb,
 revision bigint not null default 0,
 created_at timestamptz not null default now(),
 constraint workspace_size check (octet_length(study_state::text) <= 3000000)
);
create table public.documents (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade,
 title text not null check (length(title) between 3 and 180), content text not null check(length(content)<=150000),
 tags text[] not null default '{}', provenance public.content_provenance not null default 'personal',
 verification public.verification_status not null default 'unverified', version text not null default '1',
 created_at timestamptz not null default now(), unique(id,user_id)
);
create table public.document_chunks (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade,
 document_id uuid not null, page integer not null check(page>0), chunk_index integer not null check(chunk_index>=0),
 content text not null, version text not null,
 search_vector tsvector generated always as (to_tsvector('italian',content)) stored,
 foreign key(document_id,user_id) references public.documents(id,user_id) on delete cascade,
 unique(document_id,page,chunk_index), unique(id,user_id)
);
create index chunks_search on public.document_chunks using gin(search_vector);
create table public.legal_sources (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade,
 title text not null, url text not null check(url ~ '^https://'), article text,
 effective_date date, verification public.verification_status not null default 'unverified',
 version text not null, history jsonb not null default '[]', unique(id,user_id)
);
create table public.topics (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade,
 slug text not null, title text not null, description text not null default '',unique(user_id,slug),unique(id,user_id)
);
create table public.lessons (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade,
 topic_id uuid not null, title text not null, body text not null, glossary jsonb not null default '{}',
 source_document_id uuid, page integer check(page>0), version text not null,
 provenance public.content_provenance not null, verification public.verification_status not null default 'unverified',
 foreign key(topic_id,user_id) references public.topics(id,user_id),
 foreign key(source_document_id,user_id) references public.documents(id,user_id),unique(id,user_id)
);
create table public.questions (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade,
 topic_id uuid not null, prompt text not null, explanation text not null, difficulty text not null check(difficulty in ('base','intermedia','avanzata')),
 correct_option_id uuid not null, source_document_id uuid, page integer check(page>0),version text not null,
 provenance public.content_provenance not null,verification public.verification_status not null default 'unverified',
 foreign key(topic_id,user_id) references public.topics(id,user_id),
 foreign key(source_document_id,user_id) references public.documents(id,user_id),unique(id,user_id)
);
create table public.answer_options (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade,
 question_id uuid not null, text text not null,
 foreign key(question_id,user_id) references public.questions(id,user_id) on delete cascade,
 unique(id,user_id),unique(id,question_id,user_id)
);
-- Deferred FK permits inserting question and options in one transaction, while ensuring the key belongs to that question.
alter table public.questions add constraint correct_answer_belongs_to_question
 foreign key(correct_option_id,id,user_id) references public.answer_options(id,question_id,user_id) deferrable initially deferred;
create table public.attempts (
 id uuid primary key default gen_random_uuid(),user_id uuid not null references public.profiles(id) on delete cascade,
 question_id uuid not null, selected_option_id uuid, correct boolean not null,seconds numeric not null check(seconds>=0),created_at timestamptz not null default now(),
 foreign key(question_id,user_id) references public.questions(id,user_id),
 foreign key(selected_option_id,question_id,user_id) references public.answer_options(id,question_id,user_id)
);
create table public.study_sessions (
 id uuid primary key default gen_random_uuid(),user_id uuid not null references public.profiles(id) on delete cascade,
 topic_id uuid,kind text not null check(kind in ('lesson','quiz','written','oral','review')),label text not null,
 minutes numeric not null check(minutes>=0),created_at timestamptz not null default now(),
 foreign key(topic_id,user_id) references public.topics(id,user_id)
);
create table public.flashcards (
 id uuid primary key default gen_random_uuid(),user_id uuid not null references public.profiles(id) on delete cascade,
 topic_id uuid not null, front text not null,back text not null,source_document_id uuid,page integer check(page>0),
 version text not null,provenance public.content_provenance not null,verification public.verification_status not null default 'unverified',
 foreign key(topic_id,user_id) references public.topics(id,user_id),
 foreign key(source_document_id,user_id) references public.documents(id,user_id),unique(id,user_id)
);
create table public.reviews (
 id uuid primary key default gen_random_uuid(),user_id uuid not null references public.profiles(id) on delete cascade,
 flashcard_id uuid not null,quality integer not null check(quality between 0 and 5),repetitions integer not null check(repetitions>=0),
 interval_days integer not null check(interval_days>=0),ease numeric not null check(ease>=1.3),due_at timestamptz not null,reviewed_at timestamptz not null default now(),
 foreign key(flashcard_id,user_id) references public.flashcards(id,user_id) on delete cascade
);
create table public.cases (
 id uuid primary key default gen_random_uuid(),user_id uuid not null references public.profiles(id) on delete cascade,
 title text not null,scenario text not null,source_document_id uuid,page integer check(page>0),version text not null,
 provenance public.content_provenance not null,verification public.verification_status not null default 'unverified',
 foreign key(source_document_id,user_id) references public.documents(id,user_id),unique(id,user_id)
);
create table public.written_submissions (
 id uuid primary key default gen_random_uuid(),user_id uuid not null references public.profiles(id) on delete cascade,
 case_id uuid not null,text text not null default '',rubric jsonb not null default '{}',updated_at timestamptz not null default now(),
 foreign key(case_id,user_id) references public.cases(id,user_id)
);
create table public.study_goals (
 id uuid primary key default gen_random_uuid(),user_id uuid not null references public.profiles(id) on delete cascade,
 weekly_minutes integer not null check(weekly_minutes between 15 and 2400),week_start date not null,unique(user_id,week_start)
);
-- Uniform ownership policies. Composite FKs also forbid references to another user's rows.
do $$ declare t text; begin
 foreach t in array array['profiles','documents','document_chunks','legal_sources','topics','lessons','questions','answer_options','attempts','study_sessions','flashcards','reviews','cases','written_submissions','study_goals'] loop
 execute format('alter table public.%I enable row level security',t);
 if t='profiles' then
 execute 'create policy own_profile on public.profiles for all to authenticated using ((select auth.uid())=id) with check ((select auth.uid())=id)';
 else
 execute format('create policy own_rows on public.%I for all to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id)',t);
 execute format('create index %I on public.%I(user_id)',t||'_owner_idx',t);
 end if;
 execute format('revoke all on public.%I from anon',t);
 execute format('grant select,insert,update,delete on public.%I to authenticated',t);
 end loop;
 end $$;
create index attempts_recent on public.attempts(user_id,created_at desc);
create index reviews_due on public.reviews(user_id,due_at);
create index sessions_recent on public.study_sessions(user_id,created_at desc);
create function public.create_profile() returns trigger language plpgsql security definer set search_path='' as $$
 begin insert into public.profiles(id) values(new.id);return new;end $$;
create trigger on_user_created after insert on auth.users for each row execute function public.create_profile();
insert into public.profiles(id) select id from auth.users on conflict do nothing;
-- Workspace is the canonical UI snapshot (stable demo IDs are not UUIDs). The normalized
-- tables above are available for curated content. Documents/chunks are materialized for RAG.
-- Security invoker preserves all row ownership checks; optimistic revision prevents stale writes.
create function public.save_workspace(workspace jsonb,expected_revision bigint) returns bigint
 language plpgsql security invoker set search_path='' as $$
 declare next_revision bigint;doc jsonb;pages text[];p integer;c integer;body text; previous_documents jsonb;
 begin
 if auth.uid() is null then raise exception 'Unauthorized' using errcode='28000';end if;
 if octet_length(workspace::text)>3000000 then raise exception 'Workspace too large';end if;
 select study_state->'documents' into previous_documents from public.profiles where id=auth.uid();
 update public.profiles set study_state=workspace,revision=revision+1
 where id=auth.uid() and revision=expected_revision returning revision into next_revision;
 if next_revision is null then raise exception 'Stale workspace' using errcode='40001';end if;
 -- Only reindex when the document collection changes.
 if coalesce(previous_documents,'[]'::jsonb) is distinct from coalesce(workspace->'documents','[]'::jsonb) then
 delete from public.documents where user_id=auth.uid() and id not in (select (value->>'id')::uuid from jsonb_array_elements(workspace->'documents'));
 delete from public.document_chunks where user_id=auth.uid();
 for doc in select value from jsonb_array_elements(workspace->'documents') loop
 insert into public.documents(id,user_id,title,content,tags,version,provenance,verification,created_at)
 values((doc->>'id')::uuid,auth.uid(),doc->>'title',doc->>'text',array(select jsonb_array_elements_text(doc->'tags')),doc->'source'->>'version',(doc->'source'->>'provenance')::public.content_provenance,'unverified',(doc->>'createdAt')::timestamptz)
 on conflict(id) do update set title=excluded.title,content=excluded.content,tags=excluded.tags,version=excluded.version,provenance=excluded.provenance;
 pages=string_to_array(doc->>'text',chr(12));
 for p in 1..coalesce(array_length(pages,1),0) loop
 body=pages[p];c=0;
 while length(body)>0 loop
 insert into public.document_chunks(user_id,document_id,page,chunk_index,content,version)
 values(auth.uid(),(doc->>'id')::uuid,p,c,left(body,1200),doc->'source'->>'version');
 body=substr(body,1201);c=c+1;
 end loop;
 end loop;
 end loop;
 end if;
 return next_revision;
 end $$;
create function public.search_private_chunks(search_query text)
 returns table(document_id uuid,title text,page integer,version text,content text)
 language sql stable security invoker set search_path='' as $$
 select d.id,d.title,c.page,c.version,c.content from public.document_chunks c
 join public.documents d on d.id=c.document_id and d.user_id=c.user_id
 where c.user_id=auth.uid() and c.search_vector @@ websearch_to_tsquery('italian',left(search_query,1000))
 order by ts_rank(c.search_vector,websearch_to_tsquery('italian',left(search_query,1000))) desc,c.id limit 4;
 $$;
-- Delete only the authenticated user's identity. All owned data cascades.
create function public.delete_own_account() returns void language plpgsql security definer set search_path='' as $$
 begin
 if auth.uid() is null then raise exception 'Unauthorized';end if;
 delete from auth.users where id=auth.uid();
 end $$;
revoke all on function public.create_profile() from public,anon,authenticated;
revoke all on function public.save_workspace(jsonb,bigint),public.search_private_chunks(text),public.delete_own_account() from public,anon;
grant execute on function public.save_workspace(jsonb,bigint),public.search_private_chunks(text),public.delete_own_account() to authenticated;
commit;
