-- Módulo de análisis: un PDF redactado por un analista se contrasta,
-- afirmación por afirmación, contra la biblioteca ya indexada.

-- 1) Distinguir documentos de biblioteca de documentos a analizar.
--    Un documento de análisis NO debe ser consultable como fuente: si lo
--    fuera, sus propias afirmaciones aparecerían como "evidencia" que las
--    respalda a sí mismas.
alter table documents
  add column if not exists kind text not null default 'library'
  check (kind in ('library', 'analysis'));

create index if not exists idx_documents_kind on documents (kind);

-- 2) Un análisis por documento de tipo 'analysis'.
create table if not exists analyses (
  id                  uuid primary key default gen_random_uuid(),
  document_id         uuid not null unique references documents (id) on delete cascade,
  status              text not null default 'pending'
                        check (status in ('pending', 'extracting_claims', 'verifying', 'ready', 'error')),
  progress            numeric(5,2) not null default 0,
  error_message       text,
  last_page_processed integer not null default 0,
  retry_count         integer not null default 0,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists idx_analyses_status on analyses (status);

-- 3) Cada afirmación extraída del documento del analista, con su veredicto.
create table if not exists analysis_claims (
  id              uuid primary key default gen_random_uuid(),
  analysis_id     uuid not null references analyses (id) on delete cascade,
  claim_text      text not null,
  page_number     integer,
  position        integer not null default 0,
  -- Veredicto calculado automáticamente contra la biblioteca.
  verdict         text not null default 'pending'
                    check (verdict in ('pending', 'supported', 'refuted', 'partial', 'not_found')),
  explanation     text,
  confidence      numeric(4,3),
  -- Capa editable por el analista: puede corregir el texto, anotar, o
  -- imponer su propio veredicto sin perder el automático.
  user_verdict    text check (user_verdict in ('supported', 'refuted', 'partial', 'not_found')),
  user_note       text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_analysis_claims_analysis_id on analysis_claims (analysis_id);
create index if not exists idx_analysis_claims_verdict on analysis_claims (verdict);

-- 4) Fuentes de la biblioteca que respaldan o refutan cada afirmación.
create table if not exists analysis_claim_sources (
  id           uuid primary key default gen_random_uuid(),
  claim_id     uuid not null references analysis_claims (id) on delete cascade,
  -- Desnormalizado a propósito: permite leer/borrar todas las fuentes de
  -- un análisis sin pasar una lista de cientos de claim_id por la URL
  -- (mismo problema que ya reventó con document_embeddings).
  analysis_id  uuid not null references analyses (id) on delete cascade,
  document_id  uuid not null references documents (id) on delete cascade,
  chunk_id     uuid references document_chunks (id) on delete set null,
  page_number  integer not null,
  quote        text not null,
  stance       text not null default 'supports'
                 check (stance in ('supports', 'refutes', 'context')),
  created_at   timestamptz not null default now()
);

create index if not exists idx_analysis_claim_sources_claim_id on analysis_claim_sources (claim_id);
create index if not exists idx_analysis_claim_sources_analysis_id on analysis_claim_sources (analysis_id);

-- 5) La búsqueda solo debe mirar documentos de biblioteca. Se excluyen
--    los de tipo 'analysis' en ambas funciones de recuperación.
create or replace function match_document_chunks (
  query_embedding vector(1536),
  match_count int default 12,
  filter_document_ids uuid[] default null
)
returns table (
  chunk_id uuid,
  document_id uuid,
  content text,
  page_start int,
  page_end int,
  chapter text,
  section text,
  similarity float
)
language sql stable
as $$
  select
    dc.id as chunk_id,
    dc.document_id,
    dc.content,
    dc.page_start,
    dc.page_end,
    dc.chapter,
    dc.section,
    1 - (de.embedding <=> query_embedding) as similarity
  from document_embeddings de
  join document_chunks dc on dc.id = de.chunk_id
  join documents d on d.id = dc.document_id
  where d.kind = 'library'
    and (filter_document_ids is null or dc.document_id = any (filter_document_ids))
  order by de.embedding <=> query_embedding
  limit match_count;
$$;

create or replace function search_document_chunks_fts (
  search_query text,
  match_count int default 12,
  filter_document_ids uuid[] default null
)
returns table (
  chunk_id uuid,
  document_id uuid,
  content text,
  page_start int,
  page_end int,
  chapter text,
  section text,
  rank float
)
language plpgsql
stable
as $$
declare
  terms text[];
  total_chunks bigint;
  tsq tsquery;
begin
  select array_agg(x.term)
  into terms
  from unnest(
    regexp_split_to_array(
      lower(regexp_replace(coalesce(search_query, ''), '[^a-z0-9áéíóúüñ]+', ' ', 'gi')),
      '\s+'
    )
  ) as x(term)
  where length(x.term) >= 3
    and x.term not in (
      'las','los','del','por','para','con','una','uno','sobre','como','este','esta','esto',
      'esos','esas','ese','esa','que','qué','cual','cuál','cuales','cuáles','donde','dónde',
      'cuando','cuándo','quien','quién','porque','existe','existen','hay','haya','dice','dicen',
      'algo','alguna','alguno','algunas','algunos','todo','toda','todos','todas','mas','más',
      'muy','pero','sino','desde','hasta','entre','segun','según','tambien','también','solo',
      'sólo','ser','son','fue','han','has','sus','les','nos','the','and','for','with',
      'that','this','from','are','was','were','have','had','you','your','can','all',
      'any','its','not','but','how','what','which','when','where','who','why','does','did'
    );

  if terms is null or array_length(terms, 1) = 0 then
    return;
  end if;

  select count(*) into total_chunks from document_chunks;
  if total_chunks = 0 then
    return;
  end if;

  tsq := to_tsquery('simple', array_to_string(terms, ' | '));

  return query
  with term_idf as (
    select
      y.term as term,
      ln(
        total_chunks::float
        / greatest(
            (
              select count(*)
              from document_chunks c
              where c.content_tsv @@ to_tsquery('simple', y.term)
            ),
            1
          )
      ) as idf
    from unnest(terms) as y(term)
  )
  select
    dc.id::uuid as chunk_id,
    dc.document_id::uuid,
    dc.content::text,
    dc.page_start::int,
    dc.page_end::int,
    dc.chapter::text,
    dc.section::text,
    scored.score::float as rank
  from document_chunks dc
  join documents d on d.id = dc.document_id
  join lateral (
    select coalesce(sum(ti.idf), 0) as score
    from term_idf ti
    where dc.content_tsv @@ to_tsquery('simple', ti.term)
  ) scored on true
  where d.kind = 'library'
    and dc.content_tsv @@ tsq
    and (filter_document_ids is null or dc.document_id = any (filter_document_ids))
  order by scored.score desc, ts_rank(dc.content_tsv, tsq) desc
  limit match_count;
end;
$$;
