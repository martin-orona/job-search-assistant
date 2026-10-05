import { ReadonlyJobPosting, type JobPosting } from "./JobPosting";

type JobPostingLike = {
  id: number;
  title?: string | null;
  company?: string | null;
  location?: string | null;
  workModel?: string | null;
  salary?: string | null;
  url?: string | null;
};

type JobSourceLike = {
  id: number;
  name?: string | null;
};

type LinkedRecordReferenceProps<T> = {
  label: string;
  record: T | null | undefined;
  renderRecord: (record: T) => React.ReactNode;
};

export function LinkedRecordReference<T>({ label, record, renderRecord }: LinkedRecordReferenceProps<T>) {
  if (!record) {
    return null;
  }

  return (
    <div className="db-viewer-list-item-read-line foreign-reference">
      <label>{label}</label>
      {renderRecord(record)}
    </div>
  );
}

export function JobPostingReferenceDisplay({
  jobPosting,
  label = "Job Posting",
}: {
  jobPosting: JobPosting | null | undefined;
  label?: string;
}) {
  if (!jobPosting) {
    return null;
  }

  return <ReadonlyJobPosting posting={jobPosting} />;
}

export function JobSourceReferenceDisplay({ source, label = "Source" }: { source: JobSourceLike | null | undefined; label?: string }) {
  if (!source) {
    return null;
  }

  return (
    <div className="db-viewer-list-item-read-header">
      <span>{source.id ?? ""}</span>
      <span aria-hidden="true" className="db-viewer-list-item-read-header-separator">
        •
      </span>
      <span>{source.name ?? "[missing name]"}</span>
    </div>
  );
}
