import { type RecordReference } from "./DBViewerTab";
import type { EntityKey } from "./Entity";

export function ReferencedByDisplay({
  references,
  onOpenRecord,
  label = "Referenced By",
}: {
  references: RecordReference[];
  onOpenRecord: (key: EntityKey, id: number | null | undefined) => void;
  label?: string;
}) {
  if (references.length === 0) {
    return null;
  }

  return (
    <div className={`db-viewer-list-item-read-line ${label === "Referenced By" ? "foreign-reference" : "outgoing-reference"}`}>
      <label>{label}</label>
      <ul className="db-viewer-reference-list">
        {references.map((reference) => (
          <li key={reference.key}>
            <a
              className="db-viewer-list-item-read-header-link"
              href={`#${reference.targetEntity.containerId}--record-${reference.recordId}`}
              onClick={(event) => {
                event.preventDefault();
                onOpenRecord(reference.targetEntity.key, reference.recordId);
              }}
            >
              {reference.label}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
