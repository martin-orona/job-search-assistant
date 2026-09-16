-- @ts-check sqlite

-- ========================================
-- table job_question
-- ----------------------------------------
-- creates the table and sets up full-text search support for it
-- ========================================

create table if not exists job_question (
    id integer primary key autoincrement,
    created_at datetime not null default CURRENT_TIMESTAMP,
    updated_at datetime not null default CURRENT_TIMESTAMP,
    question text not null,
    answer text,
    job_application_id integer not null,
    foreign key (job_application_id) references job_application(id)
);

create trigger job_question_au_set_updated_at
after update on job_question
begin
    update job_question
    set updated_at = CURRENT_TIMESTAMP
    where id = NEW.id;
end;

create virtual table job_question_fts_index using fts5(
    question,
    answer,
    content='job_question',
    content_rowid='id',
    tokenize='porter'
);

create trigger job_question_ai_fts after insert on job_question begin
    insert into job_question_fts_index(rowid, question, answer)
    values (new.id, new.question, new.answer);
end;

create trigger job_question_au_fts after update on job_question begin
    insert into job_question_fts_index(job_question_fts_index, rowid, question, answer)
    values ('delete', old.id, old.question, old.answer);
    insert into job_question_fts_index(rowid, question, answer)
    values (new.id, new.question, new.answer);
end;

create trigger job_question_ad_fts after delete on job_question begin
    insert into job_question_fts_index(job_question_fts_index, rowid, question, answer)
    values ('delete', old.id, old.question, old.answer);
end;
