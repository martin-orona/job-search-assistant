import { useEffect, useRef } from "react";
import type { DeleteEntityHandler } from "./Entity";

import "./Dialog.css";

export function DeleteDialog({
  id,
  label,
  itemId,
  error,
  confirmButtonId,
  cancelButtonId,
  onConfirm,
  onCancel,
  children,
}: {
  id: string;
  label: string;
  itemId: number;
  error?: string;
  confirmButtonId: string;
  cancelButtonId: string;
  onConfirm: DeleteEntityHandler;
  onCancel: (itemId: number) => void;
  children?: React.ReactNode;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    dialogRef.current?.focus();
  }, [error]);
  return (
    <div
      ref={dialogRef}
      id={id}
      className="dialog delete-dialog"
      role={error ? "alertdialog" : "dialog"}
      aria-modal="false"
      tabIndex={-1}
      onKeyDown={(event) => {
        if (event.key === "Escape" || (error && event.target === event.currentTarget && ["Enter", " ", "d"].includes(event.key.toLowerCase() === "d" ? "d" : event.key))) {
          event.preventDefault();
          event.stopPropagation();
          onCancel(itemId);
        } else if (!error && event.key.toLowerCase() === "d" && event.target === event.currentTarget) {
          event.preventDefault();
          event.stopPropagation();
          void onConfirm({ event, id: itemId });
        }
      }}
    >
      <div className="header">
        <strong>{label}</strong>
      </div>
      {error && (
        <>
          <div className="content error">
            <p className="message error">{error}</p>
            {children}
          </div>
          <div className="actions">
            <button id={cancelButtonId} type="button" className="button button--primary" onClick={() => onCancel(itemId)}>
              Dismiss
            </button>
          </div>
        </>
      )}

      {!error && (
        <>
          <div className="content">
            <p className="message">
              Permanently delete {label.toLowerCase()} record [{itemId}]?
            </p>
            {children}
          </div>
          <div className="actions">
            <button
              id={confirmButtonId}
              type="button"
              className="button button--primary button--delete"
              onClick={(event: React.MouseEvent<Element>) => {
                event.preventDefault();
                event.stopPropagation();
                onConfirm({ event, id: itemId });
              }}
            >
              Delete
            </button>
            <button
              id={cancelButtonId}
              type="button"
              className="button button--secondary"
              onClick={(event: React.MouseEvent<Element>) => {
                event.preventDefault();
                event.stopPropagation();
                onCancel(itemId);
              }}
            >
              Cancel
            </button>
          </div>
        </>
      )}
    </div>
  );
}
