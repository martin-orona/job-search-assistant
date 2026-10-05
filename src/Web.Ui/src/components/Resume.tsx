import { useEntityEditor } from "../utilities/componentRendering";
import { toDateInputValue } from "../utilities/uiFormatting";
import { DocumentEmbeddedEditor, ReadOnlyDocument, type Document } from "./Document";
import {
  DateFieldEditor,
  EntityDisplay,
  EntityEditor,
  EntityUi,
  NumberFieldEditor,
  TextFieldEditor,
  type CancelEntityHandler,
  type DeleteEntityHandler,
  type EntityExpansionProps,
  type EntityUiBuilderProps,
  type SavedEntity,
  type SaveEntityHandler,
} from "./Entity";

export type Resume = NewResume & SavedResume;

export type NewResume = {
  name: string;
  jobTitle: string;
  date: string;
  document: Document | null;
};

export type SavedResume = SavedEntity & {
  documentId: number;
};

export function ResumeUi({ resume, ...rest }: EntityUiBuilderProps<Resume> & { resume: Resume }) {
  return <EntityUi entity={resume} entityKey="resume" DisplayUi={ResumeDisplay} EditUi={ResumeEditor} {...rest} />;
}

export function ReadonlyResume({ resume, documentOpen }: { resume: Resume; documentOpen?: boolean }) {
  return <ResumeDisplay resume={resume} readonly={true} onEdit={() => {}} onDelete={async () => {}} documentOpen={documentOpen} />;
}

function ResumeDisplay({
  resume,
  readonly = false,
  documentOpen,
  onEdit,
  onDelete,
  children,
  ...expansionProps
}: EntityExpansionProps & {
  resume: Resume;
  readonly?: boolean;
  onEdit: () => void;
  onDelete: DeleteEntityHandler;
  documentOpen?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <EntityDisplay
      {...expansionProps}
      id={`resume-display--${resume.id}`}
      readonly={readonly}
      onEdit={onEdit}
      onDelete={async (event) => await onDelete({ event, id: resume.id ?? 0 })}
    >
      <>
        <div className="entity-display row summary">
          <span className="value id">{resume.id}</span>
          <span className="separator">•</span>
          <span className="value name">{resume.name ?? "[missing name]"}</span>
          <span className="separator">•</span>
          <span className="value job-title">{resume.jobTitle ?? "[missing job title]"}</span>
          <span className="separator">•</span>
          <span className="value date">{resume.date ? toDateInputValue(resume.date) : "[missing date]"}</span>
        </div>

        <div className="entity-display row entity-reference value document">
          {resume.document && <ReadOnlyDocument document={resume.document} open={documentOpen} />}
        </div>

        {children}
      </>
    </EntityDisplay>
  );
}

function ResumeEditor({
  resume,
  onCancel,
  onSave,
  editError,
}: {
  resume: Resume;
  onCancel?: CancelEntityHandler;
  onSave?: SaveEntityHandler<Resume>;
  editError?: string;
}) {
  const [draft, updateField, handleSave, handleCancel] = useEntityEditor<Resume>({ entity: resume, onSave, onCancel });

  return (
    <EntityEditor id={`resume--editor--${resume.id}`} title="Edit Resume" onCancel={handleCancel} onSave={handleSave}>
      <>
        <div className="resume--editor entity-editor">
          {editError && <div className="edit-error">{editError}</div>}

          <NumberFieldEditor
            id={`resume--editor--id--${draft.id}`}
            className="resume--field readonly id"
            label="Id"
            readonly
            value={(draft.id as number) ?? 0}
            onChange={(value) =>
              updateField((updated) => {
                updated.id = value;
              })
            }
          />
          <TextFieldEditor
            id={`resume--editor--name--${draft.id}`}
            className="resume--field name"
            label="Name"
            value={draft.name ?? ""}
            onChange={(value) => {
              updateField((updated) => {
                updated.name = value;
                updated.document!.title = value;
              });
            }}
          />
          <TextFieldEditor
            id={`resume--editor--job-title--${draft.id}`}
            className="resume--field job-title"
            label="Job Title"
            value={draft.jobTitle ?? ""}
            onChange={(value) =>
              updateField((updated) => {
                updated.jobTitle = value;
              })
            }
          />
          <DateFieldEditor
            id={`resume--editor--date--${draft.id}`}
            className="resume--field date"
            label="Date"
            value={toDateInputValue(draft.date ?? "")}
            onChange={(value) =>
              updateField((updated) => {
                updated.date = value;
              })
            }
          />
          <DocumentEmbeddedEditor
            document={draft.document as Document}
            onChange={(updatedDocument) => {
              updateField((updated) => {
                updated.document = updatedDocument as Document;
              });
            }}
          />
        </div>
      </>
    </EntityEditor>
  );
}

/*
function ResumeDisplay_reference({
  entity,
  targetEntity,
  resume,
  infix = "",
  onOpenRecord,
}: {
  entity: any;
  targetEntity: { key: EntityKey; recordId: (id: number) => string };
  resume: SavedResume;
  infix?: string;
  onOpenRecord?: (key: EntityKey, id: number | null | undefined) => void;
}) {
  verifyEntityType(entity, "resumes", infix);

  if (infix && !infix.endsWith("--")) {
    infix += "--";
  }
  if (infix && !infix.endsWith("display--")) {
    infix += "display--";
  }

  const isRootEntity = targetEntity.key === entity.key;

  return (
    <>
      {!isRootEntity && (
        <strong className="db-viewer-list-item-read-header">
          <span id={entity.recordControlId(resume.id, `editor--${infix}id`)}>{resume.id ?? ""}</span>
          <span aria-hidden="true" className="db-viewer-list-item-read-header-separator">
            •
          </span>
          <a
            className="db-viewer-list-item-read-header-link"
            href={`#${targetEntity.recordId(resume.id)}`}
            onClick={(event) => {
              event.preventDefault();
              onOpenRecord?.(targetEntity.key, resume.id);
            }}
          >
            <span id={entity.recordControlId(resume.id, `editor--${infix}name`)}>{resume.name ?? "[missing name]"}</span>
          </a>
        </strong>
      )}
      <div className="db-viewer-list-item-read-line">
        <span id={entity.recordControlId(resume.id, `editor--${infix}job-title`)}>{resume.jobTitle ?? ""}</span>
        <span id={entity.recordControlId(resume.id, `editor--${infix}date`)}>{toDateInputValue(resume.date) ?? ""}</span>
      </div>
      <div className="db-viewer-list-item-read-line">
        <DocumentDisplay entity={entity} document={resume.document} recordId={resume.id} infix={`${infix}document`} label="Document" />
      </div>
    </>
  );
}
 */
