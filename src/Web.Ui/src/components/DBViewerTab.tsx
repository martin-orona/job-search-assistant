import { useEffect, useRef, useState } from "react";

type Document = {
  id: number;
  title: string;
  type: string;
  content: string;
  source: string | null;
};
type JobPostingSummary = {
  id: number;
  title: string;
  company: string;
  location: string;
  salary: string;
  workModel: "Unknown" | "Remote" | "InOffice" | "Hybrid";
  url: string;
  documentId: number;
  createdAt: string;
  document?: Document | null;
};

type SavedResume = {
  id: number;
  name: string;
  jobTitle: string;
  date: string;
  documentId: number;
  document?: Document | null;
};

type SavedPromptTemplate = {
  id: number;
  name: string;
  documentId: number;
  document?: Document | null;
  createdAt: string;
};

type SavedAiPrompt = {
  id: number;
  name: string;
  aiUrl: string;
  jobPostingId: number;
  resumeId: number;
  aiPromptTemplateId: number;
  promptDocument?: Document | null;
  promptDocumentId: number;
  responseDocument?: Document | null;
  responseDocumentId: number;
  createdAt: string;
  updatedAt: string;
  promptContent: string;
  responseContent: string;
  jobPostingContent: string;
  resumeContent: string;
  jobPostingTitle: string;
  jobPostingCompany: string;
  jobPostingWorkModel: string;
  jobPostingSalary: string;
  resumeName: string;
  resumeJobTitle: string;
  resumeDate: string;
  aiPromptTemplateName: string;
  jobPosting: JobPostingSummary;
  resume: SavedResume;
  aiPromptTemplate: SavedPromptTemplate;
  // jobPosting?: {
  //   title?: string;
  //   company?: string;
  //   workModel?: string;
  //   salary?: string;
  //   document?: {
  //     content?: string;
  //     type?: string;
  //   } | null;
  // } | null;
  // resume?: {
  //   name?: string;
  //   jobTitle?: string;
  //   date?: string;
  //   document?: {
  //     content?: string;
  //     type?: string;
  //   } | null;
  // } | null;
  // aiPromptTemplate?: {
  //   name?: string;
  // } | null;
};

type EntityKey = "job-postings" | "resumes" | "ai-prompt-templates" | "ai-prompts";

type RecordReference = {
  key: string;
  label: string;
  recordId: number;
  targetEntity: { key: EntityKey; recordId: (id: number) => string };
};

type EntityConfig<T> = {
  key: EntityKey;
  label: string;
  fetchUrl: string;
  state: T[];
  //   setState: (value: T[]) => void
  //   setState: (value: React.SetStateAction<T[]>) => void
  setState: React.Dispatch<React.SetStateAction<T[]>>;
  countId: string;
  containerId: string;
  refreshStatusId: string;
  listId: string;
  refreshButtonId: string;
  recordId: (id: number) => string;
  recordControlId: (id: number, controlName: string) => string;
  editorId: string;
  editorSaveButtonId: string;
  editorCancelButtonId: string;
  editorFieldId: (field: string) => string;
  summary: (item: T) => {
    primary: string;
    secondary: string;
    tertiary?: string;
  };
  buildDraft: (item: T) => Record<string, string>;
  exportButtonId: string;
  exportDialogId: string;
  exportCheckboxId: (id: number) => string;
  exportConfirmButtonId: string;
  exportCancelButtonId: string;
};

type EditorState = {
  isOpen: boolean;
  itemId: number | null;
  draft: Record<string, string>;
};

function toDateInputValue(value: string | null | undefined): string {
  if (!value) {
    return "";
  }

  const rawDate = value.match(/^(\d{4}-\d{2}-\d{2})/);
  if (rawDate) {
    return rawDate[1];
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "";
  }

  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

const DOCUMENT_TYPE_OPTIONS = ["HTML", "PDF", "Markdown", "Text", "Word", "Other"] as const;

function normalizeDocumentType(value: string | null | undefined): string {
  const normalized = (value ?? "markdown").trim();
  return normalized === "" ? "markdown" : normalized.toLowerCase();
}

function getDocumentWithFallback(
  document: Document | null | undefined,
  fallback: Partial<Document> & { id?: number; title?: string; content?: string; source?: string | null; type?: string },
): Document {
  if (document) {
    return document;
  }

  return {
    id: fallback.id ?? 0,
    title: fallback.title ?? "Document",
    type: normalizeDocumentType(fallback.type ?? "markdown"),
    content: fallback.content ?? "",
    source: fallback.source ?? null,
  };
}

function getAiPromptSnapshot(prompt: SavedAiPrompt) {
  const nestedJobPosting = prompt.jobPosting;
  const nestedResume = prompt.resume;
  const nestedTemplate = prompt.aiPromptTemplate;

  return {
    jobPostingTitle: prompt.jobPostingTitle ?? nestedJobPosting?.title ?? "",
    jobPostingCompany: prompt.jobPostingCompany ?? nestedJobPosting?.company ?? "",
    jobPostingWorkModel: prompt.jobPostingWorkModel ?? nestedJobPosting?.workModel ?? "",
    jobPostingSalary: prompt.jobPostingSalary ?? nestedJobPosting?.salary ?? "",
    resumeName: prompt.resumeName ?? nestedResume?.name ?? "",
    resumeJobTitle: prompt.resumeJobTitle ?? nestedResume?.jobTitle ?? "",
    resumeDate: prompt.resumeDate ?? nestedResume?.date ?? "",
    aiPromptTemplateName: prompt.aiPromptTemplateName ?? nestedTemplate?.name ?? "",
    jobPostingContent: prompt.jobPostingContent ?? nestedJobPosting?.document?.content ?? "",
    resumeContent: prompt.resumeContent ?? nestedResume?.document?.content ?? "",
  };
}

function DBViewerTab() {
  const [jobPostings, setJobPostings] = useState<JobPostingSummary[]>([]);
  const [resumes, setResumes] = useState<SavedResume[]>([]);
  const [aiPromptTemplates, setAiPromptTemplates] = useState<SavedPromptTemplate[]>([]);
  const [aiPrompts, setAiPrompts] = useState<SavedAiPrompt[]>([]);
  const [snapshotFiles, setSnapshotFiles] = useState<string[]>([]);
  const [loading, setLoading] = useState<Record<EntityKey, boolean>>({
    "job-postings": true,
    resumes: true,
    "ai-prompt-templates": true,
    "ai-prompts": true,
  });
  const [refreshErrors, setRefreshErrors] = useState<Record<EntityKey, string>>({
    "job-postings": "",
    resumes: "",
    "ai-prompt-templates": "",
    "ai-prompts": "",
  });
  const [editors, setEditors] = useState<Record<EntityKey, EditorState>>({
    "job-postings": { isOpen: false, itemId: null, draft: {} },
    resumes: { isOpen: false, itemId: null, draft: {} },
    "ai-prompt-templates": { isOpen: false, itemId: null, draft: {} },
    "ai-prompts": { isOpen: false, itemId: null, draft: {} },
  });
  const [expandedEntities, setExpandedEntities] = useState<Record<EntityKey, boolean>>({
    "job-postings": false,
    resumes: false,
    "ai-prompt-templates": false,
    "ai-prompts": false,
  });
  const [dbBackupsExpanded, setDbBackupsExpanded] = useState(false);
  const [dbBackupsLoading, setDbBackupsLoading] = useState(false);
  const [dbBackupsError, setDbBackupsError] = useState("");
  const [exportDialogOpen, setExportDialogOpen] = useState<Record<EntityKey, boolean>>({
    "job-postings": false,
    resumes: false,
    "ai-prompt-templates": false,
    "ai-prompts": false,
  });
  const [exportSelections, setExportSelections] = useState<Record<EntityKey, number[]>>({
    "job-postings": [],
    resumes: [],
    "ai-prompt-templates": [],
    "ai-prompts": [],
  });
  const [error, setError] = useState("");
  const hasInitialLoadRef = useRef(false);

  function getRefreshLabel(key: EntityKey): string {
    switch (key) {
      case "job-postings":
        return "job postings";
      case "resumes":
        return "resumes";
      case "ai-prompt-templates":
        return "AI prompt templates";
      case "ai-prompts":
        return "AI prompts";
      default:
        return key;
    }
  }

  async function loadJson<T>(url: string): Promise<T> {
    const response = await fetch(url);
    if (!response.ok) {
      const detail = (await response.text()).trim();
      throw new Error(`${response.status}: ${detail || "No server details provided."}`);
    }
    return (await response.json()) as T;
  }

  async function loadEntity<T>(key: EntityKey, url: string, setter: React.Dispatch<React.SetStateAction<T[]>>) {
    try {
      setLoading((current) => ({ ...current, [key]: true }));
      const data = await loadJson<T[]>(url);
      setter(data);
      setRefreshErrors((current) => ({ ...current, [key]: "" }));
      setError("");
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : "Unable to load data.";
      setRefreshErrors((current) => ({ ...current, [key]: `Unable to refresh ${getRefreshLabel(key)}. (${message})` }));
    } finally {
      setLoading((current) => ({ ...current, [key]: false }));
    }
  }

  async function loadDbBackups() {
    try {
      setDbBackupsLoading(true);
      setDbBackupsError("");
      const data = await loadJson<string[]>("/api/v1/admin/db-backups");
      setSnapshotFiles(data);
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : "Unable to load daily backups.";
      setDbBackupsError(`Unable to load DB backups. (${message})`);
    } finally {
      setDbBackupsLoading(false);
    }
  }

  useEffect(() => {
    if (hasInitialLoadRef.current) {
      return;
    }

    hasInitialLoadRef.current = true;
    void Promise.all([
      loadEntity<JobPostingSummary>("job-postings", "/api/v1/job-postings?deep=true", setJobPostings),
      loadEntity<SavedResume>("resumes", "/api/v1/resumes/?deep=true", setResumes),
      loadEntity<SavedPromptTemplate>("ai-prompt-templates", "/api/v1/ai-prompt-templates/?deep=true", setAiPromptTemplates),
      loadEntity<SavedAiPrompt>("ai-prompts", "/api/v1/ai-prompts/?deep=true", setAiPrompts),
      loadDbBackups(),
    ]);
  }, []);

  function getEditorState(key: EntityKey) {
    return editors[key] ?? { isOpen: false, itemId: null, draft: {} };
  }

  function openEditor<T>(key: EntityKey, item: T, buildDraft: (item: T) => Record<string, string>) {
    setEditors((current) => ({
      ...current,
      [key]: {
        isOpen: true,
        itemId: Number((item as { id?: number }).id ?? 0),
        draft: buildDraft(item),
      },
    }));
  }

  function updateEditorValue(key: EntityKey, field: string, value: string) {
    setEditors((current) => ({
      ...current,
      [key]: {
        ...current[key],
        draft: {
          ...current[key].draft,
          [field]: value,
        },
      },
    }));
  }

  function closeEditor(key: EntityKey) {
    setEditors((current) => ({
      ...current,
      [key]: { isOpen: false, itemId: null, draft: {} },
    }));
  }

  function toggleEntity(key: EntityKey, nextOpen: boolean) {
    setExpandedEntities((current) => ({
      ...current,
      [key]: nextOpen,
    }));
  }

  function ensureExportSelection(key: EntityKey, items: Array<{ id?: number }>) {
    setExportSelections((current) => {
      const nextSelection = items.map((item) => Number(item.id ?? 0)).filter((id) => id > 0);

      return {
        ...current,
        [key]: nextSelection,
      };
    });
  }

  function toggleExportSelection(key: EntityKey, id: number) {
    setExportSelections((current) => {
      const currentSelection = current[key] ?? [];
      const nextSelection = currentSelection.includes(id)
        ? currentSelection.filter((selectedId) => selectedId !== id)
        : [...currentSelection, id];

      return {
        ...current,
        [key]: nextSelection,
      };
    });
  }

  function normalizeExportRecord(entityKey: EntityKey, item: Record<string, unknown>) {
    switch (entityKey) {
      case "job-postings":
      case "resumes":
      case "ai-prompt-templates":
        return item;
      case "ai-prompts":
        return item;
      default:
        return item;
    }
  }

  function closeExportDialog(key: EntityKey) {
    setExportDialogOpen((current) => ({ ...current, [key]: false }));
    setError("");
  }

  function downloadExportSelection(key: EntityKey, items: Record<string, unknown>[]) {
    const selectedIds = exportSelections[key] ?? [];
    const payload = items.filter((item) => {
      const id = Number((item as { id?: number }).id ?? 0);
      return id > 0 && selectedIds.includes(id);
    });

    if (payload.length === 0) {
      setError("Select at least one record to export.");
      return;
    }

    const exportDocument = {
      generatedAt: new Date().toISOString(),
      entity: entityConfigs[key].label,
      records: payload.map((record) => normalizeExportRecord(key, record)),
    };

    const blob = new Blob([JSON.stringify(exportDocument, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${entityConfigs[key].label.toLowerCase().replace(/\s+/g, "-")}-export-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    closeExportDialog(key);
  }

  function openEntityRecord(key: EntityKey, id: number | null | undefined) {
    if (!id || id <= 0) {
      return;
    }

    setExpandedEntities((current) => ({
      ...current,
      [key]: true,
    }));

    requestAnimationFrame(() => {
      const entityConfig = entityConfigs[key];
      if (!entityConfig) {
        throw new Error(`Cannot open record for entity key ${key}: missing entity config.`);
      }

      const targetId = entityConfig.recordId(id);
      const target = document.getElementById(targetId);
      if (!target) {
        return;
      }

      const row = target.closest(".db-viewer-list-item") as HTMLElement | null;
      if (row) {
        row.classList.remove("db-viewer-list-item--highlight");
        // read the element’s layout property to make the browser flush pending style changes, ensuring your CSS animation restart works
        void row.offsetWidth;
        row.classList.add("db-viewer-list-item--highlight");
        window.setTimeout(() => row.classList.remove("db-viewer-list-item--highlight"), 1800);
      }

      target.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }

  async function saveEditorItem(key: EntityKey, itemId: number | null, draft: Record<string, string>) {
    if (itemId === null || itemId <= 0) {
      return;
    }

    try {
      let updatePayload: Record<string, unknown> = {};
      let updatedRecord: Record<string, unknown> | null = null;

      switch (key) {
        case "job-postings": {
          const current = jobPostings.find((item) => item.id === itemId);
          if (!current) {
            return;
          }
          const next = {
            ...current,
            title: draft.title || current.title,
            company: draft.company || current.company,
            location: draft.location || current.location,
            salary: draft.salary || current.salary,
            url: draft.url || current.url,
            workModel: (draft.workModel || current.workModel) as JobPostingSummary["workModel"],
            document: {
              ...(current.document ?? {}),
              type: normalizeDocumentType(draft.documentType || current.document?.type || "markdown"),
              content: draft.documentContent || current.document?.content || "",
            },
          };
          updatePayload = next;
          updatedRecord = next;
          break;
        }
        case "resumes": {
          const current = resumes.find((item) => item.id === itemId);
          if (!current) {
            return;
          }
          const next = {
            ...current,
            name: draft.name || current.name,
            jobTitle: draft.jobTitle || current.jobTitle,
            date: draft.date || current.date,
            document: {
              ...(current.document ?? {}),
              type: normalizeDocumentType(draft.documentType || current.document?.type || "markdown"),
              content: draft.documentContent || current.document?.content || "",
            },
          };
          updatePayload = next;
          updatedRecord = next;
          break;
        }
        case "ai-prompt-templates": {
          const current = aiPromptTemplates.find((item) => item.id === itemId);
          if (!current) {
            return;
          }
          const next = {
            ...current,
            name: draft.name || current.name,
            document: {
              ...(current.document ?? {}),
              type: normalizeDocumentType(draft.documentType || current.document?.type || "markdown"),
              content: draft.documentContent || current.document?.content || "",
            },
          };
          updatePayload = next;
          updatedRecord = next;
          break;
        }
        case "ai-prompts": {
          const current = aiPrompts.find((item) => item.id === itemId);
          if (!current) {
            return;
          }
          const jobPostingId = Number(draft["job-posting--id"] ?? current.jobPostingId);
          const resumeId = Number(draft["resume--id"] ?? current.resumeId);
          const aiPromptTemplateId = Number(draft["ai-prompt-template--id"] ?? current.aiPromptTemplateId);
          const next = {
            ...current,
            name: draft.name || current.name,
            aiUrl: draft.aiUrl || current.aiUrl,
            jobPostingId,
            resumeId,
            aiPromptTemplateId,
            jobPosting: jobPostings.find((item) => item.id === jobPostingId) ?? current.jobPosting,
            resume: resumes.find((item) => item.id === resumeId) ?? current.resume,
            aiPromptTemplate: aiPromptTemplates.find((item) => item.id === aiPromptTemplateId) ?? current.aiPromptTemplate,
          };
          updatePayload = {
            ...next,
            jobPosting: undefined,
            resume: undefined,
            aiPromptTemplate: undefined,
          };
          updatedRecord = next;
          break;
        }
      }

      if (!updatedRecord) {
        return;
      }

      const response = await fetch(
        `${key === "job-postings" ? "/api/v1/job-postings" : key === "resumes" ? "/api/v1/resumes" : key === "ai-prompt-templates" ? "/api/v1/ai-prompt-templates" : "/api/v1/ai-prompts"}/${itemId}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updatePayload),
        },
      );

      if (!response.ok) {
        throw new Error((await response.text()) || "Unable to save the record.");
      }

      const saved = (await response.json()) as Record<string, unknown>;
      const normalizedDate = key === "resumes" ? toDateInputValue(String(saved.date ?? updatedRecord.date ?? "")) : undefined;
      const updated = {
        ...updatedRecord,
        ...saved,
        ...(normalizedDate ? { date: normalizedDate } : {}),
      };

      switch (key) {
        case "job-postings":
          setJobPostings((current) => current.map((item) => (item.id === itemId ? { ...item, ...(updated as JobPostingSummary) } : item)));
          break;
        case "resumes":
          setResumes((current) => current.map((item) => (item.id === itemId ? { ...item, ...(updated as SavedResume) } : item)));
          break;
        case "ai-prompt-templates":
          setAiPromptTemplates((current) =>
            current.map((item) => (item.id === itemId ? { ...item, ...(updated as SavedPromptTemplate) } : item)),
          );
          break;
        case "ai-prompts":
          setAiPrompts((current) => current.map((item) => (item.id === itemId ? { ...item, ...(updated as SavedAiPrompt) } : item)));
          break;
      }

      closeEditor(key);
      setError("");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save the record.");
    }
  }

  function nestedTemplateName(template: SavedPromptTemplate | null | undefined) {
    return template?.name ?? "";
  }

  const entityConfigs: Record<
    EntityKey,
    EntityConfig<JobPostingSummary> | EntityConfig<SavedResume> | EntityConfig<SavedPromptTemplate> | EntityConfig<SavedAiPrompt>
  > = {
    "job-postings": {
      key: "job-postings",
      label: "Job Posting",
      fetchUrl: "/api/v1/job-postings?deep=true",
      state: jobPostings,
      setState: setJobPostings,
      countId: "db-viewer--job-postings--count",
      containerId: "db-viewer--job-postings--container",
      refreshStatusId: "db-viewer--job-postings--refresh-status",
      listId: "db-viewer--job-postings--list",
      refreshButtonId: "db-viewer--job-postings--refresh-button",
      exportButtonId: "db-viewer--job-postings--export-button",
      exportDialogId: "db-viewer--job-postings--export-dialog",
      exportCheckboxId: (id) => `db-viewer--job-postings--export-record-${id}-checkbox`,
      exportConfirmButtonId: "db-viewer--job-postings--export-confirm-button",
      exportCancelButtonId: "db-viewer--job-postings--export-cancel-button",
      recordId: (id) => `db-viewer--job-postings--record-${id}`,
      recordControlId: (id, controlName) => `db-viewer--job-postings--${controlName}--record-${id}`,
      editorId: "db-viewer--job-postings--editor",
      editorSaveButtonId: "db-viewer--job-postings--editor--save-button",
      editorCancelButtonId: "db-viewer--job-postings--editor--cancel-button",
      editorFieldId: (field) => `db-viewer--job-postings--editor--${field}`,
      summary: (item: JobPostingSummary) => {
        const posting = item as JobPostingSummary;
        return {
          primary: posting.title || "Untitled job posting",
          secondary: `${posting.company || "Unknown company"}${posting.company && posting.location ? " · " : ""}${posting.location || ""}`,
          tertiary: `${posting.salary || "Unknown salary"}${posting.workModel ? ` · ${posting.workModel}` : ""}`,
        };
      },
      buildDraft: (item: JobPostingSummary) => {
        const posting = item as JobPostingSummary;
        return {
          title: posting.title,
          company: posting.company,
          location: posting.location,
          salary: posting.salary,
          workModel: posting.workModel,
          url: posting.url,
          documentType: normalizeDocumentType(posting.document?.type),
          documentContent: posting.document?.content ?? "",
        };
      },
    },
    resumes: {
      key: "resumes",
      label: "Resume",
      fetchUrl: "/api/v1/resumes/?deep=true",
      state: resumes,
      setState: setResumes,
      countId: "db-viewer--resumes--count",
      containerId: "db-viewer--resumes--container",
      refreshStatusId: "db-viewer--resumes--refresh-status",
      listId: "db-viewer--resumes--list",
      refreshButtonId: "db-viewer--resumes--refresh-button",
      exportButtonId: "db-viewer--resumes--export-button",
      exportDialogId: "db-viewer--resumes--export-dialog",
      exportCheckboxId: (id) => `db-viewer--resumes--export-record-${id}-checkbox`,
      exportConfirmButtonId: "db-viewer--resumes--export-confirm-button",
      exportCancelButtonId: "db-viewer--resumes--export-cancel-button",
      recordId: (id) => `db-viewer--resumes--record-${id}`,
      recordControlId: (id, controlName) => `db-viewer--resumes--${controlName}--record-${id}`,
      editorId: "db-viewer--resumes--editor",
      editorSaveButtonId: "db-viewer--resumes--editor--save-button",
      editorCancelButtonId: "db-viewer--resumes--editor--cancel-button",
      editorFieldId: (field) => `db-viewer--resumes--editor--${field}`,
      summary: (item: SavedResume) => {
        const resume = item as SavedResume;
        return {
          primary: resume.name || "Untitled resume",
          secondary: resume.jobTitle || "Unknown job title",
          tertiary: toDateInputValue(resume.date) || "Unknown date",
        };
      },
      buildDraft: (item: SavedResume) => {
        const resume = item as SavedResume;
        return {
          name: resume.name,
          jobTitle: resume.jobTitle,
          date: toDateInputValue(resume.date),
          documentType: normalizeDocumentType(resume.document?.type),
          documentContent: resume.document?.content ?? "",
        };
      },
    },
    "ai-prompt-templates": {
      key: "ai-prompt-templates",
      label: "AI Prompt Template",
      fetchUrl: "/api/v1/ai-prompt-templates/?deep=true",
      state: aiPromptTemplates,
      setState: setAiPromptTemplates,
      countId: "db-viewer--ai-prompt-templates--count",
      containerId: "db-viewer--ai-prompt-templates--container",
      refreshStatusId: "db-viewer--ai-prompt-templates--refresh-status",
      listId: "db-viewer--ai-prompt-templates--list",
      refreshButtonId: "db-viewer--ai-prompt-templates--refresh-button",
      exportButtonId: "db-viewer--ai-prompt-templates--export-button",
      exportDialogId: "db-viewer--ai-prompt-templates--export-dialog",
      exportCheckboxId: (id) => `db-viewer--ai-prompt-templates--export-record-${id}-checkbox`,
      exportConfirmButtonId: "db-viewer--ai-prompt-templates--export-confirm-button",
      exportCancelButtonId: "db-viewer--ai-prompt-templates--export-cancel-button",
      recordId: (id) => `db-viewer--ai-prompt-templates--record-${id}`,
      recordControlId: (id, controlName) => `db-viewer--ai-prompt-templates--${controlName}--record-${id}`,
      editorId: "db-viewer--ai-prompt-templates--editor",
      editorSaveButtonId: "db-viewer--ai-prompt-templates--editor--save-button",
      editorCancelButtonId: "db-viewer--ai-prompt-templates--editor--cancel-button",
      editorFieldId: (field) => `db-viewer--ai-prompt-templates--editor--${field}`,
      summary: (item: SavedPromptTemplate) => {
        const template = item as SavedPromptTemplate;
        return {
          primary: template.name || "Untitled template",
          secondary: template.document?.content || "No template content",
        };
      },
      buildDraft: (item: SavedPromptTemplate) => {
        const template = item as SavedPromptTemplate;
        return {
          name: template.name,
          documentType: normalizeDocumentType(template.document?.type),
          documentContent: template.document?.content ?? "",
        };
      },
    },
    "ai-prompts": {
      key: "ai-prompts",
      label: "AI Prompt",
      fetchUrl: "/api/v1/ai-prompts/?deep=true",
      state: aiPrompts,
      setState: setAiPrompts,
      countId: "db-viewer--ai-prompts--count",
      containerId: "db-viewer--ai-prompts--container",
      refreshStatusId: "db-viewer--ai-prompts--refresh-status",
      listId: "db-viewer--ai-prompts--list",
      refreshButtonId: "db-viewer--ai-prompts--refresh-button",
      exportButtonId: "db-viewer--ai-prompts--export-button",
      exportDialogId: "db-viewer--ai-prompts--export-dialog",
      exportCheckboxId: (id) => `db-viewer--ai-prompts--export-record-${id}-checkbox`,
      exportConfirmButtonId: "db-viewer--ai-prompts--export-confirm-button",
      exportCancelButtonId: "db-viewer--ai-prompts--export-cancel-button",
      recordId: (id) => `db-viewer--ai-prompts--record-${id}`,
      recordControlId: (id, controlName) => `db-viewer--ai-prompts--${controlName}--record-${id}`,
      editorId: "db-viewer--ai-prompts--editor",
      editorSaveButtonId: "db-viewer--ai-prompts--editor--save-button",
      editorCancelButtonId: "db-viewer--ai-prompts--editor--cancel-button",
      editorFieldId: (field) => `db-viewer--ai-prompts--editor--${field}`,
      summary: (item: SavedAiPrompt) => {
        const prompt = item as SavedAiPrompt;
        const snapshot = getAiPromptSnapshot(prompt);
        return {
          primary: prompt.name || "Untitled AI prompt",
          secondary: prompt.aiUrl || "No AI URL",
          tertiary: snapshot.aiPromptTemplateName || "No template",
        };
      },
      buildDraft: (item: SavedAiPrompt) => {
        const prompt = item as SavedAiPrompt;
        const snapshot = getAiPromptSnapshot(prompt);
        return {
          name: prompt.name,
          aiUrl: prompt.aiUrl,
          "job-posting--id": String(prompt.jobPostingId ?? ""),
          "job-posting--title": snapshot.jobPostingTitle ?? "",
          "job-posting--company": snapshot.jobPostingCompany ?? "",
          "job-posting--work-model": snapshot.jobPostingWorkModel ?? "",
          "job-posting--salary": snapshot.jobPostingSalary ?? "",
          "resume--id": String(prompt.resumeId ?? ""),
          "resume--name": snapshot.resumeName ?? "",
          "resume--job-title": snapshot.resumeJobTitle ?? "",
          "resume--date": toDateInputValue(snapshot.resumeDate ?? "") ?? "",
          "ai-prompt-template--id": String(prompt.aiPromptTemplateId ?? ""),
          "ai-prompt-template--name": nestedTemplateName(prompt.aiPromptTemplate),
        };
      },
    },
  };

  const jobPostingEntityConfig = entityConfigs["job-postings"];
  const resumeEntityConfig = entityConfigs.resumes;
  const aiPromptTemplateEntityConfig = entityConfigs["ai-prompt-templates"];
  const aiPromptEntityConfig = entityConfigs["ai-prompts"];

  function getAiPromptReferences(predicate: (prompt: SavedAiPrompt) => boolean): RecordReference[] {
    return aiPrompts.filter(predicate).map((prompt) => ({
      key: `ai-prompt-${prompt.id}`,
      label: `AI Prompt ${prompt.id} · ${prompt.name || "Untitled AI prompt"}`,
      recordId: prompt.id,
      targetEntity: aiPromptEntityConfig,
    }));
  }

  return (
    <section className="db-viewer" id="db-viewer--container">
      <h1>DB Viewer</h1>

      {error ? <p className="db-viewer-status">{error}</p> : null}

      <details
        id="db-viewer--db-backups--container"
        className="db-viewer-entity"
        open={dbBackupsExpanded}
        onToggle={(event) => setDbBackupsExpanded(event.currentTarget.open)}
      >
        <summary id="db-viewer--db-backups--summary" className="db-viewer-entity-summary">
          <span>DB Backups</span>

          <div className="db-viewer-entity-actions">
            <span id="db-viewer--db-backups--count" className="db-viewer-entity-count">
              {dbBackupsLoading ? "Loading…" : `${snapshotFiles.length} saved`}
            </span>
            <button
              id="db-viewer--db-backups--create-snapshot-button"
              type="button"
              className="button button--primary"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                void (async () => {
                  try {
                    setDbBackupsLoading(true);
                    setDbBackupsError("");
                    const response = await fetch("/api/v1/admin/db-snapshot", { method: "GET" });
                    if (!response.ok) {
                      const detail = (await response.text()).trim();
                      throw new Error(`${response.status}: ${detail || "No server details provided."}`);
                    }

                    await loadDbBackups();
                  } catch (createError) {
                    const message = createError instanceof Error ? createError.message : "Unable to create a database snapshot.";
                    setDbBackupsError(`Unable to create snapshot. (${message})`);
                  } finally {
                    setDbBackupsLoading(false);
                  }
                })();
              }}
            >
              Create Snapshot
            </button>
            <button
              id="db-viewer--db-backups--refresh-button"
              type="button"
              className="button button--secondary"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                void loadDbBackups();
              }}
            >
              Refresh
            </button>
          </div>
        </summary>

        {dbBackupsError ? (
          <p id="db-viewer--db-backups--refresh-status" className="db-viewer-status" role="status" aria-live="polite">
            {dbBackupsError}
          </p>
        ) : null}

        {dbBackupsLoading ? (
          <p className="db-viewer-empty-state">Loading database backups...</p>
        ) : snapshotFiles.length === 0 ? (
          <p className="db-viewer-empty-state">No saved database backups yet.</p>
        ) : (
          <ul id="db-viewer--db-backups--list" className="db-viewer-list">
            {snapshotFiles.map((snapshot) => (
              <li key={snapshot} className="db-viewer-list-item">
                <div className="db-viewer-list-item-main">
                  <div className="db-viewer-list-item-copy">
                    <strong>{snapshot}</strong>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </details>

      {(() => {
        const rendered: React.ReactNode[] = [];
        for (const entity of Object.values(entityConfigs)) {
          const items = entity.state as Array<Record<string, unknown>>;
          const isLoading = loading[entity.key] ?? false;
          const editorState = getEditorState(entity.key);
          const isEntityOpen = expandedEntities[entity.key] ?? true;

          rendered.push(
            <details
              key={entity.key}
              id={entity.containerId}
              className="db-viewer-entity"
              open={isEntityOpen}
              onToggle={(event) => toggleEntity(entity.key, event.currentTarget.open)}
            >
              <summary id={`${entity.containerId}--summary`} className="db-viewer-entity-summary">
                <span>{entity.label}</span>
                <span id={entity.countId} className="db-viewer-entity-count">
                  {isLoading ? "Loading…" : `${items.length} saved`}
                </span>
                <div className="db-viewer-entity-actions">
                  <button
                    id={entity.exportButtonId}
                    type="button"
                    className="button button--secondary"
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      setExpandedEntities((current) => ({ ...current, [entity.key]: true }));
                      ensureExportSelection(entity.key, items as Array<{ id?: number }>);
                      setExportDialogOpen((current) => ({ ...current, [entity.key]: true }));
                    }}
                  >
                    Export
                  </button>
                  <button
                    id={entity.refreshButtonId}
                    type="button"
                    className="button button--secondary"
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      void loadEntity(entity.key, entity.fetchUrl, entity.setState as React.Dispatch<React.SetStateAction<unknown[]>>);
                    }}
                  >
                    Refresh
                  </button>
                </div>
              </summary>

              {refreshErrors[entity.key] ? (
                <p id={entity.refreshStatusId} className="db-viewer-status" role="status" aria-live="polite">
                  {refreshErrors[entity.key]}
                </p>
              ) : null}

              {exportDialogOpen[entity.key] ? (
                <div id={entity.exportDialogId} className="db-viewer-export-dialog" role="dialog" aria-modal="false">
                  <div className="db-viewer-export-dialog__header">
                    <strong>Export {entity.label} records</strong>
                  </div>
                  <div className="db-viewer-export-dialog__list">
                    {items.map((item) => {
                      const recordId = Number((item as { id?: number }).id ?? 0);
                      if (recordId <= 0) {
                        return null;
                      }

                      const isSelected = (exportSelections[entity.key] ?? []).includes(recordId);
                      return (
                        <label key={recordId} className="db-viewer-export-option" htmlFor={entity.exportCheckboxId(recordId)}>
                          <input
                            id={entity.exportCheckboxId(recordId)}
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleExportSelection(entity.key, recordId)}
                          />
                          <span>
                            {(item as { name?: string; title?: string }).name ?? (item as { title?: string }).title ?? `Record ${recordId}`}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                  <div className="db-viewer-export-dialog__actions">
                    <button
                      id={entity.exportConfirmButtonId}
                      type="button"
                      className="button button--primary"
                      onClick={() => downloadExportSelection(entity.key, items as Record<string, unknown>[])}
                    >
                      Confirm export
                    </button>
                    <button
                      id={entity.exportCancelButtonId}
                      type="button"
                      className="button button--secondary"
                      onClick={() => closeExportDialog(entity.key)}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : null}

              {isLoading ? (
                <p className="db-viewer-empty-state">Loading records...</p>
              ) : items.length === 0 ? (
                <p className="db-viewer-empty-state">No saved {entity.label.toLowerCase()} records yet.</p>
              ) : (
                <>
                  <ul id={entity.listId} className="db-viewer-list">
                    {items.map((item) => {
                      const idField = Number((item as { id?: number }).id ?? 0);
                      const isEditing = editorState.isOpen && editorState.itemId === idField;
                      const jobposting = item as JobPostingSummary;
                      const resume = item as SavedResume;
                      const prompttemplate = item as SavedPromptTemplate;
                      const prompt = item as SavedAiPrompt;

                      if (isEditing) {
                        return (
                          <li key={idField} id={entity.recordId(idField)} className="db-viewer-list-item db-viewer-list-item--editing">
                            <div id={entity.editorId} className="db-viewer-editor">
                              <label className="db-viewer-editor-label">
                                <label className="db-viewer-editor-label">
                                  ID
                                  <input id={entity.recordControlId(idField, "editor--id")} type="text" readOnly value={idField ?? ""} />
                                </label>
                                {entity.label === "Job Posting" ? "Title" : "Name"}
                                <input
                                  id={entity.recordControlId(idField, entity.label === "Job Posting" ? "editor--title" : "editor--name")}
                                  type="text"
                                  value={editorState.draft[entity.label === "Job Posting" ? "title" : "name"] ?? ""}
                                  onChange={(event) =>
                                    updateEditorValue(entity.key, entity.label === "Job Posting" ? "title" : "name", event.target.value)
                                  }
                                />
                              </label>

                              {entity.key === "job-postings" ? (
                                <>
                                  <label className="db-viewer-editor-label">
                                    Company
                                    <input
                                      id={entity.recordControlId(idField, "editor--company")}
                                      type="text"
                                      value={editorState.draft.company ?? ""}
                                      onChange={(event) => updateEditorValue(entity.key, "company", event.target.value)}
                                    />
                                  </label>
                                  <label className="db-viewer-editor-label">
                                    Location
                                    <input
                                      id={entity.recordControlId(idField, "editor--location")}
                                      type="text"
                                      value={editorState.draft.location ?? ""}
                                      onChange={(event) => updateEditorValue(entity.key, "location", event.target.value)}
                                    />
                                  </label>
                                  <label className="db-viewer-editor-label">
                                    Salary
                                    <input
                                      id={entity.recordControlId(idField, "editor--salary")}
                                      type="text"
                                      value={editorState.draft.salary ?? ""}
                                      onChange={(event) => updateEditorValue(entity.key, "salary", event.target.value)}
                                    />
                                  </label>
                                  <label className="db-viewer-editor-label">
                                    Work Model
                                    <input
                                      id={entity.recordControlId(idField, "editor--work-model")}
                                      type="text"
                                      value={editorState.draft.workModel ?? ""}
                                      onChange={(event) => updateEditorValue(entity.key, "workModel", event.target.value)}
                                    />
                                  </label>
                                  <label className="db-viewer-editor-label">
                                    URL
                                    <input
                                      id={entity.recordControlId(idField, "editor--url")}
                                      type="text"
                                      value={editorState.draft.url ?? ""}
                                      onChange={(event) => updateEditorValue(entity.key, "url", event.target.value)}
                                    />
                                  </label>
                                  <label className="db-viewer-editor-label">
                                    Document type
                                    <select
                                      id={entity.recordControlId(idField, "editor--document--type")}
                                      value={normalizeDocumentType(editorState.draft.documentType ?? "")}
                                      onChange={(event) => updateEditorValue(entity.key, "documentType", event.target.value)}
                                    >
                                      {DOCUMENT_TYPE_OPTIONS.map((option) => (
                                        <option key={option} value={option.toLowerCase()}>
                                          {option}
                                        </option>
                                      ))}
                                    </select>
                                  </label>
                                  <div className="db-viewer-entity line-item-expander">
                                    <details>
                                      <summary>Document content</summary>
                                      <textarea
                                        id={entity.recordControlId(idField, "editor--document--content")}
                                        rows={10}
                                        value={editorState.draft.documentContent ?? ""}
                                        onChange={(event) => updateEditorValue(entity.key, "documentContent", event.target.value)}
                                      />
                                    </details>
                                  </div>
                                </>
                              ) : null}

                              {entity.key === "resumes" ? (
                                <>
                                  <label className="db-viewer-editor-label">
                                    Job title
                                    <input
                                      id={entity.recordControlId(idField, "editor--job-title")}
                                      type="text"
                                      value={editorState.draft.jobTitle ?? ""}
                                      onChange={(event) => updateEditorValue(entity.key, "jobTitle", event.target.value)}
                                    />
                                  </label>
                                  <label className="db-viewer-editor-label">
                                    Date
                                    <input
                                      id={entity.recordControlId(idField, "editor--date")}
                                      type="date"
                                      value={editorState.draft.date ?? ""}
                                      onChange={(event) => updateEditorValue(entity.key, "date", event.target.value)}
                                    />
                                  </label>
                                  <label className="db-viewer-editor-label">
                                    Document type
                                    <select
                                      id={entity.recordControlId(idField, "editor--document--type")}
                                      value={normalizeDocumentType(editorState.draft.documentType ?? "")}
                                      onChange={(event) => updateEditorValue(entity.key, "documentType", event.target.value)}
                                    >
                                      {DOCUMENT_TYPE_OPTIONS.map((option) => (
                                        <option key={option} value={option.toLowerCase()}>
                                          {option}
                                        </option>
                                      ))}
                                    </select>
                                  </label>
                                  <div className="db-viewer-entity line-item-expander">
                                    <details>
                                      <summary>Document content</summary>
                                      <textarea
                                        id={entity.recordControlId(idField, "editor--document--content")}
                                        rows={10}
                                        value={editorState.draft.documentContent ?? ""}
                                        onChange={(event) => updateEditorValue(entity.key, "documentContent", event.target.value)}
                                      />
                                    </details>
                                  </div>
                                </>
                              ) : null}

                              {entity.key === "ai-prompt-templates" ? (
                                <>
                                  <label className="db-viewer-editor-label">
                                    Document type
                                    <select
                                      id={entity.recordControlId(idField, "editor--document--type")}
                                      value={normalizeDocumentType(editorState.draft.documentType ?? "")}
                                      onChange={(event) => updateEditorValue(entity.key, "documentType", event.target.value)}
                                    >
                                      {DOCUMENT_TYPE_OPTIONS.map((option) => (
                                        <option key={option} value={option.toLowerCase()}>
                                          {option}
                                        </option>
                                      ))}
                                    </select>
                                  </label>
                                  <div className="db-viewer-entity line-item-expander">
                                    <details>
                                      <summary>Template content</summary>
                                      <textarea
                                        id={entity.recordControlId(idField, "editor--document--content")}
                                        rows={10}
                                        value={editorState.draft.documentContent ?? ""}
                                        onChange={(event) => updateEditorValue(entity.key, "documentContent", event.target.value)}
                                      />
                                    </details>
                                  </div>
                                </>
                              ) : null}

                              {entity.key === "ai-prompts" ? (
                                <>
                                  <label className="db-viewer-editor-label">
                                    AI URL
                                    <input
                                      id={entity.recordControlId(idField, "editor--ai-url")}
                                      type="text"
                                      value={editorState.draft.aiUrl ?? ""}
                                      onChange={(event) => updateEditorValue(entity.key, "aiUrl", event.target.value)}
                                    />
                                  </label>

                                  <label className="db-viewer-editor-label">
                                    Job Posting ID
                                    <input
                                      id={entity.recordControlId(idField, "editor--job-posting--id")}
                                      type="number"
                                      value={editorState.draft["job-posting--id"] ?? ""}
                                      onChange={(event) => updateEditorValue(entity.key, "job-posting--id", event.target.value)}
                                    />
                                  </label>
                                  <div className="db-viewer-list-item-read-line foreign-reference">
                                    <label>Job Posting</label>
                                    {prompt.jobPosting && (
                                      <JobPostingDisplay
                                        entity={entity}
                                        targetEntity={jobPostingEntityConfig}
                                        jobposting={prompt.jobPosting}
                                        infix="job-posting"
                                        onOpenRecord={openEntityRecord}
                                      />
                                    )}
                                  </div>

                                  <label className="db-viewer-editor-label">
                                    Resume ID
                                    <input
                                      id={entity.recordControlId(idField, "editor--resume--id")}
                                      type="number"
                                      value={editorState.draft["resume--id"] ?? ""}
                                      onChange={(event) => updateEditorValue(entity.key, "resume--id", event.target.value)}
                                    />
                                  </label>
                                  <div className="db-viewer-list-item-read-line foreign-reference">
                                    <label>Resume</label>
                                    {prompt.resume && (
                                      <ResumeDisplay
                                        entity={entity}
                                        targetEntity={resumeEntityConfig}
                                        resume={prompt.resume}
                                        infix="resume"
                                        onOpenRecord={openEntityRecord}
                                      />
                                    )}
                                  </div>

                                  <label className="db-viewer-editor-label">
                                    AI Prompt Template ID
                                    <input
                                      id={entity.recordControlId(idField, "editor--ai-prompt-template--id")}
                                      type="number"
                                      value={editorState.draft["ai-prompt-template--id"] ?? ""}
                                      onChange={(event) => updateEditorValue(entity.key, "ai-prompt-template--id", event.target.value)}
                                    />
                                  </label>
                                  <div className="db-viewer-list-item-read-line foreign-reference">
                                    <label>AI Prompt Template</label>
                                    {prompt.aiPromptTemplate && (
                                      <AiPromptTemplateDisplay
                                        entity={entity}
                                        targetEntity={aiPromptTemplateEntityConfig}
                                        template={prompt.aiPromptTemplate}
                                        infix="ai-prompt-template"
                                        onOpenRecord={openEntityRecord}
                                      />
                                    )}
                                  </div>

                                  <div className="db-viewer-list-item-read-line foreign-reference">
                                    <label>Prompt Document</label>
                                    {prompt.promptDocument && (
                                      <DocumentDisplay entity={entity} document={prompt.promptDocument} infix="prompt-document" />
                                    )}
                                  </div>
                                  <div className="db-viewer-list-item-read-line foreign-reference">
                                    <label>Response Document</label>
                                    {prompt.responseDocument && (
                                      <DocumentDisplay entity={entity} document={prompt.responseDocument} infix="response-document" />
                                    )}
                                  </div>
                                </>
                              ) : null}

                              <div className="db-viewer-editor-actions">
                                <button
                                  id={entity.recordControlId(idField, "editor--save-button")}
                                  type="button"
                                  className="button button--primary"
                                  onClick={() => void saveEditorItem(entity.key, editorState.itemId, editorState.draft)}
                                >
                                  Save
                                </button>
                                <button
                                  id={entity.recordControlId(idField, "editor--cancel-button")}
                                  type="button"
                                  className="button button--secondary"
                                  onClick={() => closeEditor(entity.key)}
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          </li>
                        );
                      }

                      return (
                        <li key={idField} id={entity.recordId(idField)} className="db-viewer-list-item">
                          <div className="db-viewer-list-item-main">
                            <div className="db-viewer-list-item-copy">
                              {entity.key === "job-postings" && (
                                <>
                                  <JobPostingDisplay
                                    entity={entity}
                                    targetEntity={jobPostingEntityConfig}
                                    jobposting={jobposting}
                                    onOpenRecord={openEntityRecord}
                                  />
                                  <ReferencedByDisplay
                                    references={getAiPromptReferences((candidate) => candidate.jobPostingId === jobposting.id)}
                                    onOpenRecord={openEntityRecord}
                                  />
                                </>
                              )}

                              {entity.key === "resumes" && (
                                <>
                                  <ResumeDisplay
                                    entity={entity}
                                    targetEntity={resumeEntityConfig}
                                    resume={resume}
                                    onOpenRecord={openEntityRecord}
                                  />
                                  <ReferencedByDisplay
                                    references={getAiPromptReferences((candidate) => candidate.resumeId === resume.id)}
                                    onOpenRecord={openEntityRecord}
                                  />
                                </>
                              )}

                              {entity.key === "ai-prompt-templates" && (
                                <>
                                  <AiPromptTemplateDisplay
                                    entity={entity}
                                    targetEntity={aiPromptTemplateEntityConfig}
                                    template={prompttemplate}
                                    onOpenRecord={openEntityRecord}
                                  />
                                  <ReferencedByDisplay
                                    references={getAiPromptReferences((candidate) => candidate.aiPromptTemplateId === prompttemplate.id)}
                                    onOpenRecord={openEntityRecord}
                                  />
                                </>
                              )}

                              {entity.key === "ai-prompts" && (
                                <AiPromptDisplay
                                  entity={entity}
                                  prompt={prompt}
                                  onOpenRecord={openEntityRecord}
                                  jobPostingEntity={jobPostingEntityConfig}
                                  resumeEntity={resumeEntityConfig}
                                  aiPromptTemplateEntity={aiPromptTemplateEntityConfig}
                                />
                              )}
                            </div>

                            <button
                              id={entity.recordControlId(idField, "edit-button")}
                              type="button"
                              className="button button--secondary"
                              onClick={() =>
                                openEditor(entity.key, item as never, entity.buildDraft as (item: never) => Record<string, string>)
                              }
                            >
                              Edit
                            </button>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </>
              )}
            </details>,
          );
        }

        return rendered;
      })()}
    </section>
  );
}

function verifyEntityType(entity: { key?: string }, expectedKey: EntityKey, infix: string | undefined) {
  if (!infix && entity.key !== expectedKey) {
    throw new Error(`The ${expectedKey} display requires an infix when used with entity key ${entity.key}.`);
  }
}

function ReferencedByDisplay({
  references,
  onOpenRecord,
}: {
  references: RecordReference[];
  onOpenRecord: (key: EntityKey, id: number | null | undefined) => void;
}) {
  if (references.length === 0) {
    return null;
  }

  return (
    <div className="db-viewer-list-item-read-line foreign-reference">
      <label>Referenced By</label>
      <ul className="db-viewer-reference-list">
        {references.map((reference) => (
          <li key={reference.key}>
            <a
              className="db-viewer-list-item-read-header-link"
              href={`#${reference.targetEntity.recordId(reference.recordId)}`}
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

function DocumentDisplay({
  entity,
  document,
  label,
  infix = "",
  recordId,
}: {
  entity: any;
  document?: Document | null;
  label?: string;
  infix?: string;
  recordId?: number;
}) {
  verifyEntityType(entity, "ai-prompts", infix);

  if (infix && !infix.endsWith("--")) {
    infix += "--";
  }
  if (infix && !infix.endsWith("display--")) {
    infix += "display--";
  }

  const targetRecordId = recordId ?? document?.id ?? 0;

  return (
    <details className="db-viewer-entity line-item-expander">
      <summary>{label ?? "Document"}</summary>
      {document && (
        <>
          <div className="db-viewer-document-meta">
            <span id={entity.recordControlId(targetRecordId, `editor--${infix}type`)}>{normalizeDocumentType(document?.type)}</span>
          </div>
          <div id={entity.recordControlId(targetRecordId, `editor--${infix}content`)} className="markdown-display">
            {document?.content ?? ""}
          </div>
        </>
      )}
    </details>
  );
}

function JobPostingDisplay({
  entity,
  targetEntity,
  jobposting,
  infix = "",
  onOpenRecord,
}: {
  entity: any;
  targetEntity: { key: EntityKey; recordId: (id: number) => string };
  jobposting: JobPostingSummary;
  infix?: string;
  onOpenRecord?: (key: EntityKey, id: number | null | undefined) => void;
}) {
  verifyEntityType(entity, "job-postings", infix);

  if (infix && !infix.endsWith("--")) {
    infix += "--";
  }
  if (infix && !infix.endsWith("display--")) {
    infix += "display--";
  }

  const isRootEntity = targetEntity.key === entity.key;

  return (
    <>
      <strong className="db-viewer-list-item-read-header">
        <span id={entity.recordControlId(jobposting.id, `editor--${infix}id`)}>{jobposting.id ?? ""}</span>
        <span aria-hidden="true" className="db-viewer-list-item-read-header-separator">
          •
        </span>
        {isRootEntity ? (
          <span id={entity.recordControlId(jobposting.id, `editor--${infix}title`)}>{jobposting.title ?? "[missing title]"}</span>
        ) : (
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
        )}
      </strong>

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
      </div>
    </>
  );
}

function ResumeDisplay({
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
      <strong className="db-viewer-list-item-read-header">
        <span id={entity.recordControlId(resume.id, `editor--${infix}id`)}>{resume.id ?? ""}</span>
        <span aria-hidden="true" className="db-viewer-list-item-read-header-separator">
          •
        </span>
        {isRootEntity ? (
          <span id={entity.recordControlId(resume.id, `editor--${infix}name`)}>{resume.name ?? "[missing name]"}</span>
        ) : (
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
        )}
      </strong>
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

function AiPromptTemplateDisplay({
  entity,
  targetEntity,
  template,
  infix = "",
  onOpenRecord,
}: {
  entity: any;
  targetEntity: { key: EntityKey; recordId: (id: number) => string };
  template: SavedPromptTemplate;
  infix?: string;
  onOpenRecord?: (key: EntityKey, id: number | null | undefined) => void;
}) {
  verifyEntityType(entity, "ai-prompt-templates", infix);

  if (infix && !infix.endsWith("--")) {
    infix += "--";
  }
  if (infix && !infix.endsWith("display--")) {
    infix += "display--";
  }

  const isRootEntity = targetEntity.key === entity.key;

  return (
    <>
      <strong className="db-viewer-list-item-read-header">
        <span id={entity.recordControlId(template.id, `editor--${infix}id`)}>{template.id ?? ""}</span>
        <span aria-hidden="true" className="db-viewer-list-item-read-header-separator">
          •
        </span>
        {isRootEntity ? (
          <span id={entity.recordControlId(template.id, `editor--${infix}name`)}>{template.name ?? "[missing name]"}</span>
        ) : (
          <a
            className="db-viewer-list-item-read-header-link"
            href={`#${targetEntity.recordId(template.id)}`}
            onClick={(event) => {
              event.preventDefault();
              onOpenRecord?.(targetEntity.key, template.id);
            }}
          >
            <span id={entity.recordControlId(template.id, `editor--${infix}name`)}>{template.name ?? "[missing name]"}</span>
          </a>
        )}
      </strong>

      <div className="db-viewer-list-item-read-line">
        <DocumentDisplay entity={entity} document={template.document} recordId={template.id} infix={`${infix}document`} label="Template" />
      </div>
    </>
  );
}

function AiPromptDisplay({
  entity,
  prompt,
  infix = "",
  onOpenRecord,
  jobPostingEntity,
  resumeEntity,
  aiPromptTemplateEntity,
}: {
  entity: any;
  prompt: SavedAiPrompt;
  infix?: string;
  onOpenRecord?: (key: EntityKey, id: number | null | undefined) => void;
  jobPostingEntity: { key: EntityKey; recordId: (id: number) => string };
  resumeEntity: { key: EntityKey; recordId: (id: number) => string };
  aiPromptTemplateEntity: { key: EntityKey; recordId: (id: number) => string };
}) {
  verifyEntityType(entity, "ai-prompts", infix);

  if (infix && !infix.endsWith("--")) {
    infix += "--";
  }
  if (infix && !infix.endsWith("display--")) {
    infix += "display--";
  }

  const promptDocument = getDocumentWithFallback(prompt.promptDocument, {
    id: prompt.promptDocumentId,
    title: "Prompt Document",
    type: "markdown",
    content: prompt.promptContent ?? "",
    source: null,
  });

  const responseDocument = getDocumentWithFallback(prompt.responseDocument, {
    id: prompt.responseDocumentId,
    title: "Response Document",
    type: "markdown",
    content: prompt.responseContent ?? "",
    source: null,
  });

  return (
    <>
      <strong className="db-viewer-list-item-read-header">
        <span id={entity.recordControlId(prompt.id, `editor--${infix}id`)}>{prompt.id ?? ""}</span>
        <span aria-hidden="true" className="db-viewer-list-item-read-header-separator">
          •
        </span>
        <span id={entity.recordControlId(prompt.id, `editor--${infix}name`)}>{prompt.name ?? "[missing name]"}</span>
      </strong>

      <div className="db-viewer-list-item-read-line">
        <div id={entity.recordControlId(prompt.id, `editor--${infix}ai-url`)}>{prompt.aiUrl}</div>
      </div>

      <div className="db-viewer-list-item-read-line foreign-reference">
        <label>Job Posting</label>
        <div>
          {prompt.jobPosting ? (
            <JobPostingDisplay
              entity={entity}
              targetEntity={jobPostingEntity}
              jobposting={prompt.jobPosting}
              infix="job-posting"
              onOpenRecord={onOpenRecord}
            />
          ) : (
            <>
              <div id={entity.recordControlId(prompt.id, `editor--${infix}job-posting-id`)}>{prompt.jobPostingId}</div>
            </>
          )}
        </div>
      </div>
      <div className="db-viewer-list-item-read-line foreign-reference">
        <label>Resume</label>
        {prompt.resume ? (
          <ResumeDisplay entity={entity} targetEntity={resumeEntity} resume={prompt.resume} infix="resume" onOpenRecord={onOpenRecord} />
        ) : (
          <>
            <div>Resume</div>
            <div id={entity.recordControlId(prompt.id, `editor--${infix}resume-id`)}>{prompt.resumeId}</div>
          </>
        )}
      </div>
      <div className="db-viewer-list-item-read-line foreign-reference">
        <label>AI Prompt Template</label>
        {prompt.aiPromptTemplate ? (
          <AiPromptTemplateDisplay
            entity={entity}
            targetEntity={aiPromptTemplateEntity}
            template={prompt.aiPromptTemplate}
            infix="ai-prompt-template"
            onOpenRecord={onOpenRecord}
          />
        ) : (
          <>
            <div>AI Prompt Template</div>
            <div id={entity.recordControlId(prompt.id, `editor--${infix}ai-prompt-template-id`)}>{prompt.aiPromptTemplateId}</div>
          </>
        )}
      </div>
      <div className="db-viewer-list-item-read-line foreign-reference">
        <label>Prompt Document</label>
        <DocumentDisplay entity={entity} document={promptDocument} recordId={prompt.id} infix={`${infix}prompt-document`} />
      </div>
      <div className="db-viewer-list-item-read-line foreign-reference">
        <label>Response Document</label>
        <DocumentDisplay entity={entity} document={responseDocument} recordId={prompt.id} infix={`${infix}response-document`} />
      </div>
    </>
  );
}

export { DBViewerTab };
