-- @ts-check sqlite

-- ========================================
-- table job_posting
-- ----------------------------------------
-- creates the table and sets up full-text search support for it
-- ========================================

create table if not exists job_posting (
    id integer primary key autoincrement,
    created_at datetime not null default CURRENT_TIMESTAMP,
    updated_at datetime not null default CURRENT_TIMESTAMP,
    title text not null,
    company text not null,
    location text not null,
    salary text not null,
    url text not null,
    work_model boolean not null default 0,
    document_id integer not null,
    foreign key (document_id) references document(id)
);

-- ensure the updated_at column is up to date
-- NOTE: A before update trigger sounds good, but doesn't work in SQLite because you cannot modify the row being updated in a before update trigger.
create trigger job_posting_au_set_updated_at
after update on job_posting
begin
    update job_posting
    set updated_at = CURRENT_TIMESTAMP
    where id = NEW.id;
end;


-- ========================================
-- add full-text search support
-- ========================================
create virtual table job_posting_fts_index using fts5(
    title,
    company,
    location,
    salary,
    url,
    content='job_posting',
    content_rowid='id',
    tokenize='porter'
);

create trigger job_posting_ai_fts after insert on job_posting begin
    insert into job_posting_fts_index(rowid, title, company, location, salary, url)
    values (new.id, new.title, new.company, new.location, new.salary, new.url);
end;

create trigger job_posting_au_fts after update on job_posting begin
    insert into job_posting_fts_index(job_posting_fts_index, rowid, title, company, location, salary, url)
    values ('delete', old.id, old.title, old.company, old.location, old.salary, old.url);
    insert into job_posting_fts_index(rowid, title, company, location, salary, url)
    values (new.id, new.title, new.company, new.location, new.salary, new.url);
end;

create trigger job_posting_ad_fts after delete on job_posting begin
    insert into job_posting_fts_index(job_posting_fts_index, rowid, title, company, location, salary, url)
    values ('delete', old.id, old.title, old.company, old.location, old.salary, old.url);
end;
