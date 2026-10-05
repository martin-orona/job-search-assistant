import { useState } from "react";
import type { AiPrompt } from "./AiPrompt";
import type { Document } from "./Document";

import { prepForSave_Date_to_DateOnly } from "../utilities/apiFormatting";
import { useEntityEditor } from "../utilities/componentRendering";
import { formatDate } from "../utilities/uiFormatting";
import { ReadonlyAiPrompt } from "./AiPrompt";
import { ReadOnlyDocument } from "./Document";
import {
  DateFieldEditor,
  EditableListEditor,
  EntityDisplay,
  EntityEditor,
  EntityUi,
  EnumFieldEditor,
  NumberFieldEditor,
  TextFieldEditor,
  type CancelEntityHandler,
  type DeleteEntityHandler,
  type EntityExpansionProps,
  type EntityUiBuilderProps,
  type SavedEntity,
  type SaveEntityHandler,
  type SaveEntityParams,
} from "./Entity";
import "./JobApplication.css";
import { ReadonlyJobPosting, type JobPosting } from "./JobPosting";
import { type JobQuestion } from "./JobQuestion";
import { ReadonlyResume, type Resume } from "./Resume";

export type JobApplication = NewJobApplication & SavedJobApplication;

export type NewJobApplication = {
  company: string;
  role: string;
  appliedOnDate?: string | null;
  status: ApplicationStatus;
  source?: {
    id: number;
    name: string;
  } | null;
  pointsOfContact?: PointOfContact[] | null;
  questions?: JobQuestion[] | null;
  notes?: Note[] | null;
  jobPosting?: JobPosting;
  resume?: Resume | null;
  coverLetter?: Document | null;
  aiPrompt?: AiPrompt | null;
};

export type SavedJobApplication = SavedEntity & {
  sourceId: number;
  jobPostingId: number;
  resumeId?: number;
  coverLetterId?: number;
  aiPromptId?: number;
};

export type PointOfContact = {
  role: string;
  name: string;
  email?: string | null;
  phone?: string | null;
};

export type Note = {
  date?: string | null;
  content?: string | null;
};

const APPLICATION_STATUSES = [
  "Unknown",
  "Draft",
  "Saved",
  "Applied",
  "Interviewing",
  "Offer",
  "Accepted",
  "Rejected",
  "Withdrawn",
  "Ghosted",
  "Other",
] as const;

export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export function JobApplicationUi({ application, ...props }: EntityUiBuilderProps<JobApplication> & { application: JobApplication }) {
  return (
    <EntityUi entity={application} entityKey="application" DisplayUi={JobApplicationDisplay} EditUi={JobApplicationEditor} {...props} />
  );
}

function JobApplicationDisplay({
  application,
  readonly,
  onEdit,
  onDelete,
  children,
  ...expansionProps
}: EntityExpansionProps & {
  application: JobApplication;
  readonly?: boolean;
  onEdit: () => void;
  onDelete: DeleteEntityHandler;
  children?: React.ReactNode;
}) {
  return (
    <EntityDisplay
      {...expansionProps}
      id={`job-application-display--${application.id}`}
      readonly={readonly}
      onEdit={onEdit}
      onDelete={(event) => onDelete({ event, id: application.id ?? 0 })}
    >
      <>
        <div className="entity-display row summary">
          <span className="value id">{application.id}</span>
          <span className="separator">•</span>
          <span className="value company">{application.company ?? ""}</span>
          <span className="separator">•</span>
          <span className="value role">{application.role ?? ""}</span>
          <span className="separator">•</span>
          <span className="value status">{application.status}</span>
        </div>
        <div className="entity-display row">
          <span className="value source">{application.source?.name ?? ""}</span>
          {application.appliedOnDate && (
            <>
              <span className="separator">•</span>
              <span className="value applied-on-date">{formatDate(application.appliedOnDate)}</span>
            </>
          )}
        </div>
        <div className="entity-display row">
          <span className="value list-value points-of-contact">
            <label>Points of Contact</label>
            {application.pointsOfContact?.length! > 0 && (
              <>
                {application.pointsOfContact?.map((poc) => {
                  return (
                    <span className="point-of-contact row">
                      <span className="role">{poc.role}</span>
                      <span className="separator">•</span>
                      <span className="name">{poc.name ?? ""}</span>
                      {poc.email && (
                        <>
                          <span className="separator">•</span>
                          <span className="email">{`${poc.email}`}</span>
                        </>
                      )}
                      {poc.phone && (
                        <>
                          <span className="separator">•</span>
                          <span className="phone">{poc.phone}</span>
                        </>
                      )}
                    </span>
                  );
                })}
              </>
            )}
          </span>
        </div>

        <div className="entity-display row">
          <span className="value list-value questions">
            <label>Questions</label>
            {application.questions?.length! > 0 && (
              <>
                {application.questions?.map((question) => {
                  return (
                    <span className="question row">
                      <span className="question">{question.question}</span>
                      <span className="separator">•</span>
                      <span className="answer">{question.answer}</span>
                    </span>
                  );
                })}
              </>
            )}
          </span>
        </div>

        <div className="entity-display row">
          <span className="value list-value notes">
            <label>Notes</label>
            {application.notes?.length! > 0 && (
              <>
                {application.notes!.map((note) => {
                  return (
                    <span className="note row">
                      <span className="date">{formatDate(note.date)}</span>
                      <span className="separator">•</span>
                      <span className="content">{note.content ?? ""}</span>
                    </span>
                  );
                })}
              </>
            )}
          </span>
        </div>

        <div className="entity-display row">
          {application.jobPosting && (
            <label className="entity-reference label">
              <b>Job Posting</b>
              <ReadonlyJobPosting posting={application.jobPosting} readonly />
            </label>
          )}
        </div>

        <div className="entity-display row">
          <label className="entity-reference label resume">
            <b>Resume</b>
            {application.resume && <ReadonlyResume resume={application.resume} />}
          </label>
        </div>

        <div className="entity-display row">
          <label className="entity-reference label cover-letter">
            <b>Cover Letter</b>
            {application.coverLetter && <ReadOnlyDocument document={application.coverLetter} />}
          </label>
        </div>

        <div className="entity-display row">
          <label className="entity-reference label ai-prompt">
            <b>AI Prompt</b>
            {application.aiPrompt && <ReadonlyAiPrompt prompt={application.aiPrompt} />}
          </label>
        </div>

        {children}
      </>
    </EntityDisplay>
  );
}

function JobApplicationEditor({
  application,
  onSave,
  onCancel,
  editError,
}: {
  application: JobApplication;
  onSave?: SaveEntityHandler<JobApplication>;
  onCancel?: CancelEntityHandler;
  editError?: string;
}) {
  const [draft, updateField, handleSave, handleCancel] = useEntityEditor(
    { entity: application, onSave: saveWithLists, onCancel },
    //  () =>    onCancel?.({ event: new Event("cancel") as unknown as React.SyntheticEvent<Element>, id: application.id }),
  );
  const [pointsOfContact, setPointsOfContact] = useState<PointOfContact[]>(draft.pointsOfContact ?? []);
  const [questions, setQuestions] = useState<JobQuestion[]>(draft.questions ?? []);
  const [notes, setNotes] = useState<Note[]>(draft.notes ?? []);

  async function saveWithLists({ event, entity: updated }: SaveEntityParams<JobApplication>) {
    await onSave?.({
      event,
      entity: {
        ...updated,
        pointsOfContact,
        questions,
        notes: (notes ?? []).map((note) => ({
          date: prepForSave_Date_to_DateOnly(note?.date ?? ""),
          content: note?.content ?? "",
        })),
      },
    });
  }

  return (
    <EntityEditor
      id={`job-application--editor--${application.id}`}
      title="Edit Job Application"
      onCancel={async ({ event, id }: { event: React.SyntheticEvent<Element>; id: number }) => await handleCancel({ event, id })}
      onSave={handleSave}
    >
      <>
        <div className="job-application--editor entity-editor">
          {editError && <div className="edit-error">{editError}</div>}

          <NumberFieldEditor
            id={`job-application--editor--id--${draft.id}`}
            className="job-application--field readonly id"
            label="Id"
            readonly
            value={(draft.id as number) ?? 0}
            onChange={(value) => updateField((updated) => (updated.id = value))}
          />
          <TextFieldEditor
            id={`job-application--editor--company--${draft.id}`}
            className="job-application--field company"
            label="Company"
            value={draft.company ?? ""}
            onChange={(value) => updateField((updated) => (updated.company = value))}
          />
          <TextFieldEditor
            id={`job-application--editor--role--${draft.id}`}
            className="job-application--field role"
            label="Role"
            value={draft.role ?? ""}
            onChange={(value) => updateField((updated) => (updated.role = value))}
          />
          <DateFieldEditor
            id={`job-application--editor--applied-on-date--${draft.id}`}
            className="job-application--field applied-on-date"
            label="Applied On"
            value={draft.appliedOnDate ?? ""}
            onChange={(value) => updateField((updated) => (updated.appliedOnDate = value))}
          />
          <EnumFieldEditor
            id={`job-application--editor--status--${draft.id}`}
            className="job-application--field status"
            label="Status"
            options={APPLICATION_STATUSES}
            value={draft.status ?? ""}
            onChange={(value) => updateField((updated) => (updated.status = value as ApplicationStatus))}
          />

          <EditableListEditor
            label="Points of Contact"
            emptyText="No points of contact yet."
            items={pointsOfContact}
            createEmptyItem={() => ({ role: "", name: "", email: "", phone: "" })}
            onChange={setPointsOfContact}
            renderItem={(poc, index, updateItem) => (
              <>
                <TextFieldEditor
                  id={`point-of-contact--role--${index}`}
                  className="point-of-contact-field role"
                  label="Role"
                  value={poc.role ?? ""}
                  onChange={(value) => updateItem((updated) => (updated.role = value))}
                />
                <TextFieldEditor
                  id={`point-of-contact--name--${index}`}
                  className="point-of-contact-field name"
                  label="Name"
                  value={poc.name ?? ""}
                  onChange={(value) => updateItem((updated) => (updated.name = value))}
                />
                <TextFieldEditor
                  id={`point-of-contact--email--${index}`}
                  className="point-of-contact-field email"
                  label="Email"
                  value={poc.email ?? ""}
                  onChange={(value) => updateItem((updated) => (updated.email = value))}
                />
                <TextFieldEditor
                  id={`point-of-contact--phone--${index}`}
                  className="point-of-contact-field phone"
                  label="Phone"
                  value={poc.phone ?? ""}
                  onChange={(value) => updateItem((updated) => (updated.phone = value))}
                />
              </>
            )}
          />

          <EditableListEditor
            label="Questions"
            emptyText="No questions yet."
            items={questions}
            createEmptyItem={() =>
              ({
                question: "",
                answer: "",
              }) as unknown as JobQuestion
            }
            onChange={setQuestions}
            renderItem={(question, index, updateItem) => (
              <>
                <TextFieldEditor
                  id={`question--question--${index}`}
                  className="question-field question"
                  label="Question"
                  value={question.question ?? ""}
                  onChange={(value) => updateItem((updated) => (updated.question = value))}
                />
                <TextFieldEditor
                  id={`question--answer--${index}`}
                  className="question-field answer"
                  label="Answer"
                  value={question.answer ?? ""}
                  onChange={(value) => updateItem((updated) => (updated.answer = value))}
                />
              </>
            )}
          />

          <EditableListEditor
            label="Notes"
            emptyText="No notes yet."
            items={notes}
            createEmptyItem={() => ({
              date: new Date().toISOString().slice(0, 10),
              content: "",
            })}
            onChange={setNotes}
            renderItem={(note, index, updateItem) => (
              <>
                <TextFieldEditor
                  id={`note-content-${index}`}
                  className="note-field content"
                  label="Note"
                  value={note.content ?? ""}
                  onChange={(value) => updateItem((updated) => (updated.content = value))}
                />
                <DateFieldEditor
                  id={`note-date-${index}`}
                  className="note-field date"
                  label="Date"
                  value={note.date ?? ""}
                  onChange={(value) => updateItem((updated) => (updated.date = value))}
                />
              </>
            )}
          />

          <NumberFieldEditor
            id={`job-application--editor--source-id--${draft.id}`}
            className="job-application--field readonly source-id"
            label="Source Id"
            value={(draft.sourceId as number) ?? 0}
            onChange={(value) => updateField((updated) => (updated.sourceId = value))}
          />
          {draft.source && (
            <div className="entity-reference source">
              <span className="label">Source</span>
              <span className="value">{draft.source.name}</span>
            </div>
          )}

          <NumberFieldEditor
            id={`job-application--editor--job-posting-id--${draft.id}`}
            className="job-application--field readonly job-posting-id"
            label="Job Posting Id"
            value={(draft.jobPostingId as number) ?? 0}
            onChange={(value) => updateField((updated) => (updated.jobPostingId = value))}
          />
          {draft.jobPosting && (
            <div className="entity-reference job-posting">
              <span className="label">Job Posting</span>
              <ReadonlyJobPosting posting={draft.jobPosting} readonly />
            </div>
          )}

          <NumberFieldEditor
            id={`job-application--editor--resume-id--${draft.id}`}
            className="job-application--field readonly resume-id"
            label="Resume Id"
            value={(draft.resumeId as number) ?? 0}
            onChange={(value) => updateField((updated) => (updated.resumeId = value))}
          />
          {/* todo: add Resume display here */}

          <NumberFieldEditor
            id={`job-application--editor--cover-letter-id--${draft.id}`}
            className="job-application--field readonly cover-letter-id"
            label="Cover Letter Id"
            value={(draft.coverLetterId as number) ?? 0}
            onChange={(value) => updateField((updated) => (updated.coverLetterId = value))}
          />
          {/* todo: add Cover Letter display here */}

          <NumberFieldEditor
            id={`job-application--editor--ai-prompt-id--${draft.id}`}
            className="job-application--field readonly ai-prompt-id"
            label="AI Prompt Id"
            value={(draft.aiPromptId as number) ?? 0}
            onChange={(value) => updateField((updated) => (updated.aiPromptId = value))}
          />
          {/* todo: add AI Prompt display here */}
        </div>
      </>
    </EntityEditor>
  );
}
