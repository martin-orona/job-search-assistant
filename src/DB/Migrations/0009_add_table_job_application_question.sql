-- @ts-check sqlite

-- ========================================
-- table job_application_question
-- ----------------------------------------
-- joins applications to shared questions in a many-to-many relationship
-- ========================================

create table if not exists job_application_question (
    id integer primary key autoincrement,
    created_at datetime not null default CURRENT_TIMESTAMP,
    updated_at datetime not null default CURRENT_TIMESTAMP,
    job_application_id integer not null,
    job_question_id integer not null,
    unique (job_application_id, job_question_id),
    foreign key (job_application_id) references job_application(id),
    foreign key (job_question_id) references job_question(id)
);

create index if not exists idx_job_application_question_job_application_id
    on job_application_question (job_application_id);

create index if not exists idx_job_application_question_job_question_id
    on job_application_question (job_question_id);

create trigger job_application_question_au_set_updated_at
after update on job_application_question
begin
    update job_application_question
    set updated_at = CURRENT_TIMESTAMP
    where id = NEW.id;
end;
