import { useLayoutEffect } from "react";
import { useEntityEditor } from "../utilities/componentRendering";
import { DocumentEmbeddedEditor, ReadOnlyDocument, type Document, type NewDocument } from "./Document";
import {
  EntityDisplay,
  EntityEditor,
  EntityUi,
  EnumFieldEditor,
  NumberFieldEditor,
  TextFieldEditor,
  type CancelEntityHandler,
  type EntityExpansionProps,
  type EntityUiBuilderProps,
  type SavedEntity,
  type SaveEntityHandler,
} from "./Entity";

export type JobPostingSummary = {
  id: number;
  title: string;
  company: string;
  location: string;
  salary: string;
  workModel: JobPostingWorkModel;
  url: string;
  documentId: number;
  createdAt: string;
  document?: Document | null;
};

export type JobPosting = NewJobPosting & SavedJobPosting;

export type NewJobPosting = {
  title: string;
  company: string;
  location: string | null;
  salary: string | null;
  url: string | null;
  workModel: JobPostingWorkModel;
  document: Document | NewDocument | null;
};

export type SavedJobPosting = SavedEntity & {
  documentId?: number;
};

const JOB_POSTING_WORK_MODEL = ["Unknown", "Remote", "InOffice", "Hybrid"] as const;
export type JobPostingWorkModel = (typeof JOB_POSTING_WORK_MODEL)[number];

export function JobPostingUi({ posting, ...props }: EntityUiBuilderProps<JobPosting> & { posting: JobPosting }) {
  return <EntityUi entity={posting} entityKey="posting" DisplayUi={JobPostingDisplay} EditUi={JobPostingEditor} {...props} />;
}

export function ReadonlyJobPosting({
  posting,
  className,
  children,
}: {
  posting: JobPosting;
  readonly?: boolean;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <JobPostingDisplay posting={posting} readonly={true} className={className} onEdit={() => {}} onDelete={() => {}}>
      {children}
    </JobPostingDisplay>
  );
}

function JobPostingDisplay({
  posting,
  readonly,
  className,
  onEdit,
  onDelete,

  children,
  ...expansionProps
}: EntityExpansionProps & {
  posting: JobPosting;
  readonly?: boolean;
  className?: string;
  onEdit: () => void;
  onDelete: (params: { id: number }) => void;
  children?: React.ReactNode;
}) {
  if (!onDelete) {
    throw new Error("onDelete handler is required");
  }

  return (
    <EntityDisplay
      {...expansionProps}
      id={`job-posting--display--${posting.id ?? 0}`}
      readonly={readonly}
      className={className}
      onEdit={onEdit}
      onDelete={() => onDelete({ id: posting.id ?? 0 })}
    >
      <>
        <div className="entity-display row summary">
          <span className="value id">{posting.id}</span>
          <span className="separator">•</span>
          <span className="value company">{posting.company ?? "[missing company]"}</span>
          <span className="separator">•</span>
          <span className="value title">{posting.title ?? "[missing title]"}</span>
        </div>

        <div className="entity-display row">
          <span className="value location">{posting.location ?? ""}</span>
          {posting.workModel && (
            <>
              <span className="separator">•</span>
              <span className="value work-model">{posting.workModel}</span>
            </>
          )}
          {posting.salary && (
            <>
              <span className="separator">•</span>
              <span className="value salary">{posting.salary}</span>
            </>
          )}
        </div>

        {posting.url && (
          <div className="entity-display row">
            <span className="value url">{posting.url}</span>
          </div>
        )}

        {posting.document && (
          <div className="entity-display row entity-reference value document">
            {posting.document && <ReadOnlyDocument document={posting.document as Document} />}
          </div>
        )}

        {children}
      </>
    </EntityDisplay>
  );
}

function JobPostingEditor({
  posting,
  className,
  onCancel,
  onSave,
  editError,
}: {
  posting: JobPosting;
  className?: string;
  onCancel?: CancelEntityHandler;
  onSave?: SaveEntityHandler<JobPosting>;
  editError?: string;
}) {
  const [draft, updateField, handleSave, handleCancel] = useEntityEditor({ entity: posting, onSave, onCancel });

  useLayoutEffect(() => {
    if (!draft?.document) {
      updateField((updated) => {
        updated.document = { title: "" } as Document;
      });
    }
  }, []);

  const recordId = (posting?.id ?? 0) as number;

  return (
    <EntityEditor
      id={`job-posting--editor--${recordId}`}
      title="Edit Job Posting"
      className={className}
      onCancel={handleCancel}
      onSave={handleSave}
    >
      <>
        <div className="job-posting--editor entity-editor">
          {editError && <div className="edit-error">{editError}</div>}

          <NumberFieldEditor
            id={`job-posting--editor--id--${recordId}`}
            className="job-posting--field readonly id"
            label="Id"
            readonly
            value={recordId}
            onChange={(value) => updateField((updated) => (updated.id = value))}
          />

          <TextFieldEditor
            id={`job-posting--editor--title--${recordId}`}
            className="job-posting--field title"
            label="Title"
            value={draft.title ?? ""}
            onChange={(value) =>
              updateField((updated) => {
                updated.title = value;
                updated.document!.title = value;
              })
            }
          />

          <TextFieldEditor
            id={`job-posting--editor--company--${recordId}`}
            className="job-posting--field company"
            label="Company"
            value={draft.company ?? ""}
            onChange={(value) => updateField((updated) => (updated.company = value))}
          />

          <TextFieldEditor
            id={`job-posting--editor--location--${recordId}`}
            className="job-posting--field location"
            label="Location"
            value={draft.location ?? ""}
            onChange={(value) => updateField((updated) => (updated.location = value))}
          />

          <TextFieldEditor
            id={`job-posting--editor--salary--${recordId}`}
            className="job-posting--field salary"
            label="Salary"
            value={draft.salary ?? ""}
            onChange={(value) => updateField((updated) => (updated.salary = value))}
          />

          <TextFieldEditor
            id={`job-posting--editor--url--${recordId}`}
            className="job-posting--field url"
            label="URL"
            value={draft.url ?? ""}
            onChange={(value) =>
              updateField((updated) => {
                updated.url = value;
                updated.document!.source = value;
              })
            }
          />

          <EnumFieldEditor
            id={`job-posting--editor--work-model--${recordId}`}
            className="job-posting--field work-model"
            label="Work Model"
            options={JOB_POSTING_WORK_MODEL}
            value={draft.workModel ?? "Unknown"}
            onChange={(value) => updateField((updated) => (updated.workModel = value as JobPostingWorkModel))}
          />

          <DocumentEmbeddedEditor
            document={draft.document as Document}
            onChange={(value) => updateField((updated) => (updated.document = value))}
          />
          {draft.document && (
            <div className="job-posting--field document">
              <label>Document</label>
              <ReadOnlyDocument document={draft.document as Document} />
            </div>
          )}
        </div>
      </>
    </EntityEditor>
  );
}

/*
export function JobPostingDisplay_reference({
  entity,
  targetEntity,
  jobposting,
  infix = "",
  onOpenRecord,
}: {
  entity: any;
  targetEntity: { key: EntityKey; recordId: (id: number) => string };
  jobposting: JobPosting;
  infix?: string;
  onOpenRecord?: (key: EntityKey, id: number | null | undefined) => void;
}) {
  // verifyEntityType(entity, "job-postings", infix);

  // if (infix && !infix.endsWith("--")) {
  //   infix += "--";
  // }
  // if (infix && !infix.endsWith("display--")) {
  //   infix += "display--";
  // }

  // const isRootEntity = targetEntity.key === entity.key;

  return (
    <>
      { {!isRootEntity && (
        <strong className="db-viewer-list-item-read-header">
          <span id={entity.recordControlId(jobposting.id, `editor--${infix}id`)}>{jobposting.id ?? ""}</span>
          <span aria-hidden="true" className="db-viewer-list-item-read-header-separator">
            •
          </span>
          <a
            className="db-viewer-list-item-read-header-link"
            href={`#${targetEntity.recordId(jobposting.id)}`}
            onClick={(event) => {
              event.preventDefault();
              onOpenRecord?.(targetEntity.key, jobposting.id);
            }}
          >
            <span id={entity.recordControlId(jobposting.id, `editor--${infix}title`)}>{jobposting.title ?? "[missing title]"}</span>
          </a>
        </strong>
      )}

      <div className="db-viewer-list-item-read-line">
        <span id={entity.recordControlId(jobposting.id, `editor--${infix}company`)}>{jobposting.company ?? ""}</span>

        <span id={entity.recordControlId(jobposting.id, `editor--${infix}work-model`)}>{jobposting.workModel ?? ""}</span>

        {jobposting.location ? (
          <span id={entity.recordControlId(jobposting.id, `editor--${infix}location`)}>{jobposting.location ?? ""}</span>
        ) : null}
      </div>

      {jobposting.salary ? (
        <div className="db-viewer-list-item-read-line">
          <span id={entity.recordControlId(jobposting.id, `editor--${infix}salary`)}>{jobposting.salary ?? ""}</span>
        </div>
      ) : null}

      {jobposting.url ? (
        <div className="db-viewer-list-item-read-line">
          <span id={entity.recordControlId(jobposting.id, `editor--${infix}url`)}>{jobposting.url ?? ""}</span>
        </div>
      ) : null}

      <div className="db-viewer-list-item-read-line">
        <DocumentDisplay entity={entity} document={jobposting.document} recordId={jobposting.id} infix={`${infix}document`} />
      </div> }
    </>
  );
}
  */
