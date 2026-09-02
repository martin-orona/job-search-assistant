-- @ts-check sqlite

-- ========================================
-- table ai_prompt
-- ----------------------------------------
-- creates the table and sets up full-text search support for it
-- ========================================

create table if not exists ai_prompt (
    id integer primary key autoincrement,
    created_at datetime not null default CURRENT_TIMESTAMP,
    updated_at datetime not null default CURRENT_TIMESTAMP,
    name text not null,
    ai_url text not null,
    job_posting_id integer not null,
    resume_id integer not null,
    ai_prompt_template_id integer not null,
    prompt_document_id integer not null,
    response_document_id integer not null,
    foreign key (job_posting_id) references job_posting(id),
    foreign key (resume_id) references resume(id),
    foreign key (ai_prompt_template_id) references ai_prompt_template(id),
    foreign key (prompt_document_id) references document(id),
    foreign key (response_document_id) references document(id)
);

-- ensure the updated_at column is up to date
-- NOTE: A before update trigger sounds good, but doesn't work in SQLite because you cannot modify the row being updated in a before update trigger.
create trigger ai_prompt_au_set_updated_at
after update on ai_prompt
begin
    update ai_prompt
    set updated_at = CURRENT_TIMESTAMP
    where id = NEW.id;
end;
