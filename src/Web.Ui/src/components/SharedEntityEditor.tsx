import { type ReactNode } from "react";

type SharedEntityEditorProps = {
  title: string;
  children: ReactNode;
  onSave: () => void;
  onCancel: () => void;
  saveLabel?: string;
  cancelLabel?: string;
  className?: string;
};

export function SharedEntityEditor({
  title,
  children,
  onSave,
  onCancel,
  saveLabel = "Save",
  cancelLabel = "Cancel",
  className,
}: SharedEntityEditorProps) {
  return (
    <div
      className={["db-viewer-editor", "db-viewer-export-dialog", className].filter(Boolean).join(" ")}
      role="dialog"
      aria-modal="false"
      aria-label={title}
    >
      <div className="db-viewer-export-dialog__header">
        <strong>{title}</strong>
      </div>

      <div className="db-viewer-export-dialog__list">{children}</div>

      <div className="db-viewer-editor-actions db-viewer-export-dialog__actions">
        <button type="button" className="button button--primary" onClick={onSave}>
          {saveLabel}
        </button>
        <button type="button" className="button button--secondary" onClick={onCancel}>
          {cancelLabel}
        </button>
      </div>
    </div>
  );
}
