-- @ts-check sqlite

-- ========================================
-- table document
-- ----------------------------------------
-- creates the table and sets up full-text search support for it
-- ========================================

create table if not exists document (
    id integer primary key autoincrement,
    created_at datetime not null default CURRENT_TIMESTAMP,
    updated_at datetime not null default CURRENT_TIMESTAMP,
    title text not null,
    type text not null,
    content text not null,
    source text null
);

-- ensure the updated_at column is up to date
-- NOTE: A before update trigger sounds good, but doesn't work in SQLite because you cannot modify the row being updated in a before update trigger.
create trigger document_au_set_updated_at
after update on document
begin
    update document
    set updated_at = CURRENT_TIMESTAMP
    where id = NEW.id;
end;


-- ========================================
-- add full-text search support
-- ========================================
create virtual table document_fts_index using fts5(
    title,
    content,
    source,
    content='document',
    content_rowid='id',
    tokenize='porter'
);

create trigger document_ai_fts after insert on document begin
    insert into document_fts_index(rowid, title, content, source)
    values (new.id, new.title, new.content, new.source);
end;

create trigger document_au_fts after update on document begin
    insert into document_fts_index(document_fts_index, rowid, title, content, source)
    values ('delete', old.id, old.title, old.content, old.source);
    insert into document_fts_index(rowid, title, content, source)
    values (new.id, new.title, new.content, new.source);
end;

create trigger document_ad_fts after delete on document begin
    insert into document_fts_index(document_fts_index, rowid, title, content, source)
    values ('delete', old.id, old.title, old.content, old.source);
end;
