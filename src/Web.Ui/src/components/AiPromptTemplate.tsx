import { useLayoutEffect } from "react";
import { useEntityEditor } from "../utilities/componentRendering";
import { DocumentEmbeddedEditor, ReadOnlyDocument, type Document } from "./Document";
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

export type AiPromptTemplate = NewAiPromptTemplate & SavedAiPromptTemplate;

export type NewAiPromptTemplate = {
  name: string;
  document: Document | null;
};

export type SavedAiPromptTemplate = SavedEntity & {
  documentId: number;
};

export function AiPromptTemplateUi({ template, ...rest }: EntityUiBuilderProps<AiPromptTemplate> & { template: AiPromptTemplate }) {
  return <EntityUi entity={template} entityKey="template" DisplayUi={AiPromptTemplateDisplay} EditUi={AiPromptTemplateEditor} {...rest} />;
}

export function ReadonlyAiPromptTemplate({
  template,
  children,
  open,
  documentOpen,
}: {
  template: AiPromptTemplate;
  children?: React.ReactNode;
  open?: boolean;
  documentOpen?: boolean;
}) {
  return (
    <AiPromptTemplateDisplay
      template={template}
      readonly={true}
      onEdit={() => {}}
      onDelete={async () => {}}
      open={open}
      documentOpen={documentOpen}
    >
      {children}
    </AiPromptTemplateDisplay>
  );
}

function AiPromptTemplateDisplay({
  template,
  readonly = false,
  onEdit,
  onDelete,
  children,
  documentOpen,
  ...expansionProps
}: EntityExpansionProps & {
  template: AiPromptTemplate;
  readonly?: boolean;
  onEdit: () => void;
  onDelete: DeleteEntityHandler;
  children?: React.ReactNode;
  documentOpen?: boolean;
}) {
  return (
    <EntityDisplay
      {...expansionProps}
      id={`ai-prompt-template-display--${template.id}`}
      readonly={readonly}
      onEdit={onEdit}
      onDelete={async (event) => await onDelete({ event, id: template.id ?? 0 })}
    >
      <>
        <div className="entity-display row summary">
          <span className="value id">{template.id}</span>
          <span className="separator">•</span>
          <span className="value name">{template.name ?? "[missing name]"}</span>
        </div>

        {template.document && (
          <div className="entity-display row entity-reference value document">
            {template.document && <ReadOnlyDocument document={template.document} open={documentOpen ?? undefined} />}
          </div>
        )}

        {children}
      </>
    </EntityDisplay>
  );
}

function AiPromptTemplateEditor({
  template,
  onCancel,
  onSave,
  editError,
}: {
  template: AiPromptTemplate;
  onCancel?: CancelEntityHandler;
  onSave?: SaveEntityHandler<AiPromptTemplate>;
  editError?: string;
}) {
  const [draft, updateField, handleSave, handleCancel] = useEntityEditor({ entity: template, onSave, onCancel });

  useLayoutEffect(() => {
    if (!draft?.document) {
      updateField((updated) => {
        updated.document = (updated.document || {}) as Document;
      });
    }
  }, [template, draft, updateField]);

  return (
    <EntityEditor
      id={`ai-prompt-template--editor--${template.id}`}
      title="Edit AI Prompt Template"
      onCancel={handleCancel}
      onSave={handleSave}
    >
      <>
        <div className="ai-prompt-template--editor entity-editor">
          {editError && <div className="edit-error">{editError}</div>}

          <NumberFieldEditor
            id={`ai-prompt-template--editor--id--${draft.id}`}
            className="ai-prompt-template--field readonly id"
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
            id={`ai-prompt-template--editor--name--${draft.id}`}
            className="ai-prompt-template--field name"
            label="Name"
            value={draft.name ?? ""}
            onChange={(value) =>
              updateField((updated) => {
                updated.name = value;
                updated.document!.title = value;
              })
            }
          />
          <DocumentEmbeddedEditor
            document={(draft.document || {}) as Document}
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
