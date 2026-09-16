-- @ts-check sqlite

-- ========================================
-- table job_source
-- ----------------------------------------
-- creates the table and sets up full-text search support for it
-- ========================================

create table if not exists job_source (
    id integer primary key autoincrement,
    created_at datetime not null default CURRENT_TIMESTAMP,
    updated_at datetime not null default CURRENT_TIMESTAMP,
    name text not null
);

create trigger job_source_au_set_updated_at
after update on job_source
begin
    update job_source
    set updated_at = CURRENT_TIMESTAMP
    where id = NEW.id;
end;

create virtual table job_source_fts_index using fts5(
    name,
    content='job_source',
    content_rowid='id',
    tokenize='porter'
);

create trigger job_source_ai_fts after insert on job_source begin
    insert into job_source_fts_index(rowid, name)
    values (new.id, new.name);
end;

create trigger job_source_au_fts after update on job_source begin
    insert into job_source_fts_index(job_source_fts_index, rowid, name)
    values ('delete', old.id, old.name);
    insert into job_source_fts_index(rowid, name)
    values (new.id, new.name);
end;

create trigger job_source_ad_fts after delete on job_source begin
    insert into job_source_fts_index(job_source_fts_index, rowid, name)
    values ('delete', old.id, old.name);
end;
