import { useEntityEditor } from "../utilities/componentRendering";
import { type Document } from "./Document";
import {
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

export type JobSource = NewJobSource & SavedJobSource;

export type NewJobSource = {
  name: string;
  jobTitle: string;
  date: string;
  document: Document | null;
};

export type SavedJobSource = SavedEntity & {
  documentId: number;
};

export function JobSourceUi({ source, ...rest }: EntityUiBuilderProps<JobSource> & { source: JobSource }) {
  return <EntityUi entity={source} entityKey="source" DisplayUi={JobSourceDisplay} EditUi={JobSourceEditor} {...rest} />;
}

export function JobSourceDisplay({
  source,
  readonly,
  onEdit,
  onDelete,
  children,
  ...expansionProps
}: EntityExpansionProps & {
  source: JobSource;
  readonly?: boolean;
  onEdit: () => void;
  onDelete: DeleteEntityHandler;
  children?: React.ReactNode;
}) {
  return (
    <EntityDisplay
      {...expansionProps}
      id={`job-application-display--${source.id}`}
      readonly={readonly}
      expandable={false}
      onEdit={onEdit}
      onDelete={(event) => onDelete({ event, id: source.id ?? 0 })}
    >
      <>
        <div className="entity-display row summary">
          <span className="value id">{source.id}</span>
          <span className="separator">•</span>
          <span className="value name">{source.name ?? ""}</span>
        </div>

        {children}
      </>
    </EntityDisplay>
  );
}

export function JobSourceEditor({
  source,
  onCancel,
  onSave,
  editError,
}: {
  source: JobSource;
  onCancel?: CancelEntityHandler;
  onSave?: SaveEntityHandler<JobSource>;
  editError?: string;
}) {
  const [draft, updateField, handleSave, handleCancel] = useEntityEditor({ entity: source, onSave, onCancel });

  return (
    <EntityEditor id={`job-source--editor--${source.id}`} title="Edit Job Source" onCancel={handleCancel} onSave={handleSave}>
      <>
        <div className="job-source--editor entity-editor">
          {editError && <div className="edit-error">{editError}</div>}

          <NumberFieldEditor
            id={`job-source--editor--id--${draft.id}`}
            className="job-source--field readonly id"
            label="Id"
            readonly
            value={(draft.id as number) ?? 0}
            onChange={(value: number) =>
              updateField((updated) => {
                updated.id = value;
              })
            }
          />
          <TextFieldEditor
            id={`job-source--editor--name--${draft.id}`}
            className="job-source--field name"
            label="Name"
            value={draft.name ?? ""}
            onChange={(value: string) =>
              updateField((updated) => {
                updated.name = value;
              })
            }
          />
        </div>
      </>
    </EntityEditor>
  );
}
