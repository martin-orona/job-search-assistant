-- @ts-check sqlite

-- ========================================
-- table job_application
-- ----------------------------------------
-- creates the table and sets up full-text search support for it
-- ========================================

create table if not exists job_application (
    id integer primary key autoincrement,
    created_at datetime not null default CURRENT_TIMESTAMP,
    updated_at datetime not null default CURRENT_TIMESTAMP,
    company text not null,
    role text not null,
    applied_on_date text,
    status text not null default 'Unknown',
    source_id integer not null,
    job_posting_id integer not null,
    resume_id integer,
    cover_letter_id integer,
    ai_prompt_id integer,
    foreign key (source_id) references job_source(id),
    foreign key (job_posting_id) references job_posting(id),
    foreign key (resume_id) references resume(id),
    foreign key (cover_letter_id) references document(id),
    foreign key (ai_prompt_id) references ai_prompt(id)
);

create trigger job_application_au_set_updated_at
after update on job_application
begin
    update job_application
    set updated_at = CURRENT_TIMESTAMP
    where id = NEW.id;
end;

create virtual table job_application_fts_index using fts5(
    company,
    role,
    status,
    content='job_application',
    content_rowid='id',
    tokenize='porter'
);

create trigger job_application_ai_fts after insert on job_application begin
    insert into job_application_fts_index(rowid, company, role, status)
    values (new.id, new.company, new.role, new.status);
end;

create trigger job_application_au_fts after update on job_application begin
    insert into job_application_fts_index(job_application_fts_index, rowid, company, role, status)
    values ('delete', old.id, old.company, old.role, old.status);
    insert into job_application_fts_index(rowid, company, role, status)
    values (new.id, new.company, new.role, new.status);
end;

create trigger job_application_ad_fts after delete on job_application begin
    insert into job_application_fts_index(job_application_fts_index, rowid, company, role, status)
    values ('delete', old.id, old.company, old.role, old.status);
end;
