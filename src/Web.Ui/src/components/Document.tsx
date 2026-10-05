import { useId } from "react";
import { renderEntityUi, useEntityEditor } from "../utilities/componentRendering";
import {
  EntityDisplay,
  EntityEditor,
  EnumFieldEditor,
  NumberFieldEditor,
  TextareaFieldEditor,
  TextFieldEditor,
  type CancelEntityHandler,
  type EntityUiBuilderProps,
  type SavedEntity,
  type SaveEntityHandler,
} from "./Entity";

import "./Document.css";

export type Document = NewDocument & SavedDocument;

export type NewDocument = {
  title: string;
  type: DocumentType;
  content: string;
  source?: string | null;
};

export type SavedDocument = SavedEntity & {};

const DOCUMENT_TYPES = ["Unknown", "HTML", "Markdown", "PDF", "Text", "Word", "Other"] as const;

export type DocumentType = (typeof DOCUMENT_TYPES)[number];

export function DocumentUi({ document, ...rest }: EntityUiBuilderProps<Document> & { document: Document }) {
  return renderEntityUi({
    entity: document,
    entityKey: "document",
    DisplayUi: ReadOnlyDocument,
    EditUi: DocumentEditor,
    ...rest,
  });
}

export function ReadOnlyDocument({ document, label, open }: { document: Document; label?: string; open?: boolean }) {
  return <DocumentDisplay document={document} readonly={true} label={label} onEdit={() => {}} onDelete={() => {}} open={open} />;
}

export function DocumentEmbeddedEditor({ document, onChange }: { document: Document; onChange: (value: Document) => void }) {
  const instanceId = useId();
  const documentId = document?.id || instanceId;
  return (
    <>
      <div className="document--editor embedded entity-editor">
        <EnumFieldEditor
          id={`document--editor--type--${documentId}`}
          className="document--field type"
          label="Type"
          options={DOCUMENT_TYPES}
          value={document?.type ?? "Unknown"}
          onChange={(value) => {
            onChange({ ...document, type: value as DocumentType });
          }}
        />
        <TextareaFieldEditor
          id={`document--editor--answer--${documentId}`}
          className="document--field content"
          label="Content"
          value={document?.content ?? ""}
          onChange={(value) => {
            onChange({ ...document, content: value });
          }}
        />
      </div>
    </>
  );
}

function DocumentDisplay({
  document,
  readonly,
  open,
  label,
  onEdit,
  onDelete,
}: {
  document: Document;
  readonly?: boolean;
  open?: boolean;
  onEdit: () => void;
  onDelete: (itemId: number) => void;

  label?: string;
}) {
  return (
    <>
      <EntityDisplay
        id={`document-display--${document?.id ?? 0}`}
        readonly={readonly}
        open={open}
        onEdit={onEdit}
        onDelete={() => onDelete(document?.id ?? 0)}
        className="entity-reference label document"
      >
        <>
          <div className="entity-display row summary">{label ?? "Document"}</div>
          <div className="entity-display row document">
            {document && (
              <>
                <div className="document-type">{document?.type}</div>
                <div className="document-content">{document?.content ?? ""}</div>
              </>
            )}
          </div>
        </>
      </EntityDisplay>
    </>
  );
}

function DocumentEditor({
  document,
  onCancel,
  onSave,
}: {
  document: Document;
  onCancel: CancelEntityHandler;
  onSave: SaveEntityHandler<Document>;
}) {
  const [draft, updateField, handleSave, handleCancel] = useEntityEditor({ entity: document, onSave, onCancel });

  return (
    <EntityEditor id={`document--editor--${document.id}`} title="Edit Document" onCancel={handleCancel} onSave={handleSave}>
      <>
        <div className="document--editor entity-editor">
          <NumberFieldEditor
            id={`document--editor--id--${draft.id}`}
            className="document--field readonly id"
            label="Id"
            readonly
            value={(draft.id as number) ?? 0}
            onChange={(value) => updateField((updated) => (updated.id = value))}
          />
          <TextFieldEditor
            id={`document--editor--title--${draft.id}`}
            className="document--field title"
            label="Title"
            value={draft.title ?? ""}
            onChange={(value) => updateField((updated) => (updated.title = value))}
          />
          <TextFieldEditor
            id={`document--editor--source--${draft.id}`}
            className="document--field source"
            label="Source"
            value={draft.source ?? ""}
            onChange={(value) => updateField((updated) => (updated.source = value))}
          />
          <DocumentEmbeddedEditor
            document={draft as Document}
            onChange={(updatedDocument) => {
              updateField((updated) => {
                updated.type = (updatedDocument as Document).type;
                updated.content = (updatedDocument as Document).content;
              });
            }}
          />
          {/* <EnumFieldEditor
            id={`document--editor--type--${draft.id ?? 0}`}
            className="document--field type"
            label="Type"
            options={DOCUMENT_TYPES}
            value={draft.type ?? "Unknown"}
            onChange={(value) => updateField((updated) => (updated.type = value as DocumentType))}
          />
          <TextareaFieldEditor
            id={`document--editor--answer--${draft.id}`}
            className="document--field content"
            label="Content"
            value={draft.content ?? ""}
            onChange={(value) => updateField((updated) => (updated.content = value))}
          /> */}
        </div>
      </>
    </EntityEditor>
  );
}
