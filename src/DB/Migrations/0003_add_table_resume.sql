-- @ts-check sqlite

-- ========================================
-- table resume
-- ----------------------------------------
-- creates the table and sets up full-text search support for it
-- ========================================

create table if not exists resume (
    id integer primary key autoincrement,
    created_at datetime not null default CURRENT_TIMESTAMP,
    updated_at datetime not null default CURRENT_TIMESTAMP,
    name text not null,
    job_title text not null,
    date datetime not null,
    document_id integer not null,
    foreign key (document_id) references document(id)
);

-- ensure the updated_at column is up to date
-- NOTE: A before update trigger sounds good, but doesn't work in SQLite because you cannot modify the row being updated in a before update trigger.
create trigger resume_au_set_updated_at
after update on resume
begin
    update resume
    set updated_at = CURRENT_TIMESTAMP
    where id = NEW.id;
end;


-- ========================================
-- add full-text search support
-- ========================================
create virtual table resume_fts_index using fts5(
    name,
    job_title,
    content='resume',
    content_rowid='id',
    tokenize='porter'
);

create trigger resume_ai_fts after insert on resume begin
    insert into resume_fts_index(rowid, name, job_title)
    values (new.id, new.name, new.job_title);
end;

create trigger resume_au_fts after update on resume begin
    insert into resume_fts_index(resume_fts_index, rowid, name, job_title)
    values ('delete', old.id, old.name, old.job_title);
    insert into resume_fts_index(rowid, name, job_title)
    values (new.id, new.name, new.job_title);
end;

create trigger resume_ad_fts after delete on resume begin
    insert into resume_fts_index(resume_fts_index, rowid, name, job_title)
    values ('delete', old.id, old.name, old.job_title);
end;
