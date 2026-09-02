-- @ts-check sqlite

-- ========================================
-- table ai_prompt_template
-- ----------------------------------------
-- creates the table and sets up full-text search support for it
-- ========================================

create table if not exists ai_prompt_template (
    id integer primary key autoincrement,
    created_at datetime not null default CURRENT_TIMESTAMP,
    updated_at datetime not null default CURRENT_TIMESTAMP,
    name text not null,
    template text not null
);

-- ensure the updated_at column is up to date
-- NOTE: A before update trigger sounds good, but doesn't work in SQLite because you cannot modify the row being updated in a before update trigger.
create trigger ai_prompt_template_au_set_updated_at
after update on ai_prompt_template
begin
    update ai_prompt_template
    set updated_at = CURRENT_TIMESTAMP
    where id = NEW.id;
end;
