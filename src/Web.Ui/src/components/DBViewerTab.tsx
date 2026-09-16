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

type JobSourceSummary = {
  id: number;
  name: string;
  createdAt?: string;
};

type JobQuestionSummary = {
  id: number;
  question: string;
  answer?: string | null;
  jobApplicationId: number;
  createdAt?: string;
};

type JobApplicationSummary = {
  id: number;
  company: string;
  role: string;
  appliedOnDate?: string | null;
  status: string;
  sourceId: number;
  source?: JobSourceSummary | null;
  jobPostingId: number;
  jobPosting?: JobPostingSummary | null;
  questions?: JobQuestionSummary[];
  resume?: SavedResume | null;
  coverLetter?: Document | null;
  aiPrompt?: SavedAiPrompt | null;
  notes?: string[];
  createdAt?: string;
  updatedAt?: string;
};

type EntityKey = "job-postings" | "job-applications" | "job-sources" | "job-questions" | "resumes" | "ai-prompt-templates" | "ai-prompts";

type RecordReference = {
  key: string;
  label: string;
  recordId: number;
  targetEntity: { key: EntityKey; recordId: (id: number) => string };
};

type DeleteReference = {
  id: number;
  label: string;
  entityKey: EntityKey;
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
  deleteDialogId: string;
  deleteFailureDialogId: string;
  deleteConfirmButtonId: string;
  deleteCancelButtonId: string;
  deleteFailureDismissButtonId: string;
  deleteReferenceCheckboxId: (entityKey: EntityKey, id: number) => string;
  recordId: (id: number) => string;
  recordControlId: (id: number, controlName: string) => string;
  createButtonId: string;
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
  importButtonId: string;
  importDialogId: string;
  importFileInputId: string;
  importConfirmButtonId: string;
  importCancelButtonId: string;
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
  const [jobApplications, setJobApplications] = useState<JobApplicationSummary[]>([]);
  const [jobSources, setJobSources] = useState<JobSourceSummary[]>([]);
  const [jobQuestions, setJobQuestions] = useState<JobQuestionSummary[]>([]);
  const [resumes, setResumes] = useState<SavedResume[]>([]);
  const [aiPromptTemplates, setAiPromptTemplates] = useState<SavedPromptTemplate[]>([]);
  const [aiPrompts, setAiPrompts] = useState<SavedAiPrompt[]>([]);
  const [snapshotFiles, setSnapshotFiles] = useState<string[]>([]);
  const [loading, setLoading] = useState<Record<EntityKey, boolean>>({
    "job-postings": true,
    "job-applications": true,
    "job-sources": true,
    "job-questions": true,
    resumes: true,
    "ai-prompt-templates": true,
    "ai-prompts": true,
  });
  const [refreshErrors, setRefreshErrors] = useState<Record<EntityKey, string>>({
    "job-postings": "",
    "job-applications": "",
    "job-sources": "",
    "job-questions": "",
    resumes: "",
    "ai-prompt-templates": "",
    "ai-prompts": "",
  });
  const [editors, setEditors] = useState<Record<EntityKey, EditorState>>({
    "job-postings": { isOpen: false, itemId: null, draft: {} },
    "job-applications": { isOpen: false, itemId: null, draft: {} },
    "job-sources": { isOpen: false, itemId: null, draft: {} },
    "job-questions": { isOpen: false, itemId: null, draft: {} },
    resumes: { isOpen: false, itemId: null, draft: {} },
    "ai-prompt-templates": { isOpen: false, itemId: null, draft: {} },
    "ai-prompts": { isOpen: false, itemId: null, draft: {} },
  });
  const [expandedEntities, setExpandedEntities] = useState<Record<EntityKey, boolean>>({
    "job-postings": false,
    "job-applications": false,
    "job-sources": false,
    "job-questions": false,
    resumes: false,
    "ai-prompt-templates": false,
    "ai-prompts": false,
  });
  const [dbBackupsExpanded, setDbBackupsExpanded] = useState(false);
  const [dbBackupsLoading, setDbBackupsLoading] = useState(false);
  const [dbBackupsError, setDbBackupsError] = useState("");
  const [exportDialogOpen, setExportDialogOpen] = useState<Record<EntityKey, boolean>>({
    "job-postings": false,
    "job-applications": false,
    "job-sources": false,
    "job-questions": false,
    resumes: false,
    "ai-prompt-templates": false,
    "ai-prompts": false,
  });
  const [exportSelections, setExportSelections] = useState<Record<EntityKey, number[]>>({
    "job-postings": [],
    "job-applications": [],
    "job-sources": [],
    "job-questions": [],
    resumes: [],
    "ai-prompt-templates": [],
    "ai-prompts": [],
  });
  const [importDialogOpen, setImportDialogOpen] = useState<Record<EntityKey, boolean>>({
    "job-postings": false,
    "job-applications": false,
    "job-sources": false,
    "job-questions": false,
    resumes: false,
    "ai-prompt-templates": false,
    "ai-prompts": false,
  });
  const [importSelections, setImportSelections] = useState<Record<EntityKey, File | null>>({
    "job-postings": null,
    "job-applications": null,
    "job-sources": null,
    "job-questions": null,
    resumes: null,
    "ai-prompt-templates": null,
    "ai-prompts": null,
  });
  const [importFileName, setImportFileName] = useState<Record<EntityKey, string>>({
    "job-postings": "",
    "job-applications": "",
    "job-sources": "",
    "job-questions": "",
    resumes: "",
    "ai-prompt-templates": "",
    "ai-prompts": "",
  });
  const [deleteDialogState, setDeleteDialogState] = useState<Record<EntityKey, { itemId: number | null; selectedReferenceIds: string[] }>>({
    "job-postings": { itemId: null, selectedReferenceIds: [] },
    "job-applications": { itemId: null, selectedReferenceIds: [] },
    "job-sources": { itemId: null, selectedReferenceIds: [] },
    "job-questions": { itemId: null, selectedReferenceIds: [] },
    resumes: { itemId: null, selectedReferenceIds: [] },
    "ai-prompt-templates": { itemId: null, selectedReferenceIds: [] },
    "ai-prompts": { itemId: null, selectedReferenceIds: [] },
  });
  const [deleteFailureState, setDeleteFailureState] = useState<Record<EntityKey, { itemId: number | null; message: string }>>({
    "job-postings": { itemId: null, message: "" },
    "job-applications": { itemId: null, message: "" },
    "job-sources": { itemId: null, message: "" },
    "job-questions": { itemId: null, message: "" },
    resumes: { itemId: null, message: "" },
    "ai-prompt-templates": { itemId: null, message: "" },
    "ai-prompts": { itemId: null, message: "" },
  });
  const [error, setError] = useState("");
  const hasInitialLoadRef = useRef(false);
  const deleteDialogRefs = useRef<Record<EntityKey, HTMLDivElement | null>>({
    "job-postings": null,
    "job-applications": null,
    "job-sources": null,
    "job-questions": null,
    resumes: null,
    "ai-prompt-templates": null,
    "ai-prompts": null,
  });
  const deleteFailureDialogRefs = useRef<Record<EntityKey, HTMLDivElement | null>>({
    "job-postings": null,
    "job-applications": null,
    "job-sources": null,
    "job-questions": null,
    resumes: null,
    "ai-prompt-templates": null,
    "ai-prompts": null,
  });

  function getDeleteReferences(key: EntityKey, id: number): DeleteReference[] {
    if (key !== "ai-prompts") {
      return [];
    }

    const prompt = aiPrompts.find((item) => item.id === id);
    if (!prompt) {
      return [];
    }

    const references: DeleteReference[] = [];

    const addReference = (
      entityKey: EntityKey,
      record:
        | {
            id?: number;
            title?: string;
            name?: string;
            company?: string;
            jobTitle?: string;
            location?: string;
            salary?: string;
            workModel?: string;
          }
        | null
        | undefined,
      labelBuilder: (record: {
        id?: number;
        title?: string;
        name?: string;
        company?: string;
        jobTitle?: string;
        location?: string;
        salary?: string;
        workModel?: string;
      }) => string,
    ) => {
      if (!record || Number(record.id ?? 0) <= 0) {
        return;
      }

      references.push({
        id: Number(record.id ?? 0),
        label: labelBuilder(record),
        entityKey,
      });
    };

    const jobPosting = prompt.jobPosting;
    addReference(
      "job-postings",
      jobPosting,
      (record) => `${record.title || "Untitled job posting"} (Job Posting ${record.id ?? prompt.jobPostingId})`,
    );

    const resume = prompt.resume;
    addReference("resumes", resume, (record) => `${record.name || "Untitled resume"} (Resume ${record.id ?? prompt.resumeId})`);

    const template = prompt.aiPromptTemplate;
    addReference(
      "ai-prompt-templates",
      template,
      (record) => `${record.name || "Untitled AI prompt template"} (AI Prompt Template ${record.id ?? prompt.aiPromptTemplateId})`,
    );

    return references;
  }

  function handleDeleteDialogKeyDown(key: EntityKey, event: React.KeyboardEvent<HTMLDivElement>) {
    const normalizedKey = event.key.toLowerCase();
    const confirmKeys = [" ", "enter", "d", "y"];
    const cancelKeys = ["escape", "c", "n"];

    if (confirmKeys.includes(normalizedKey)) {
      event.preventDefault();
      const itemId = deleteDialogState[key]?.itemId;
      if (itemId === null || itemId === undefined) {
        return;
      }

      void confirmDeleteEntityRecord(key, itemId);
      return;
    }

    if (cancelKeys.includes(normalizedKey)) {
      event.preventDefault();
      closeDeleteDialog(key);
    }
  }

  function handleDeleteFailureKeyDown(key: EntityKey, event: React.KeyboardEvent<HTMLDivElement>) {
    const normalizedKey = event.key.toLowerCase();
    const dismissKeys = ["escape", "enter", " ", "d"];

    if (dismissKeys.includes(normalizedKey)) {
      event.preventDefault();
      closeDeleteDialog(key);
    }
  }

  function openDeleteDialog(key: EntityKey, id: number) {
    const references = getDeleteReferences(key, id);
    setDeleteDialogState((current) => ({
      ...current,
      [key]: {
        itemId: id,
        selectedReferenceIds: references.map((reference) => buildDeleteSelectionKey(reference.entityKey, reference.id)),
      },
    }));
    setError("");
  }

  function buildDeleteSelectionKey(entityKey: EntityKey, id: number): string {
    return `${entityKey}:${id}`;
  }

  function toggleDeleteReferenceSelection(key: EntityKey, reference: DeleteReference) {
    setDeleteDialogState((current) => {
      const active = current[key] ?? { itemId: null, selectedReferenceIds: [] };
      const selectionKey = buildDeleteSelectionKey(reference.entityKey, reference.id);
      const nextSelection = active.selectedReferenceIds.includes(selectionKey)
        ? active.selectedReferenceIds.filter((selectedId) => selectedId !== selectionKey)
        : [...active.selectedReferenceIds, selectionKey];

      return {
        ...current,
        [key]: {
          ...active,
          selectedReferenceIds: nextSelection,
        },
      };
    });
  }

  function closeDeleteDialog(key: EntityKey) {
    setDeleteDialogState((current) => ({
      ...current,
      [key]: { itemId: null, selectedReferenceIds: [] },
    }));
    setDeleteFailureState((current) => ({
      ...current,
      [key]: { itemId: null, message: "" },
    }));
    setError("");
  }

  function getDeleteRoute(key: EntityKey): string {
    switch (key) {
      case "job-postings":
        return "/api/v1/job-postings";
      case "job-applications":
        return "/api/v1/job-applications";
      case "job-sources":
        return "/api/v1/job-sources";
      case "job-questions":
        return "/api/v1/job-questions";
      case "resumes":
        return "/api/v1/resumes";
      case "ai-prompt-templates":
        return "/api/v1/ai-prompt-templates";
      case "ai-prompts":
        return "/api/v1/ai-prompts";
      default:
        return "/api/v1/ai-prompts";
    }
  }

  function getDeleteFailureMessage(message: string, fallback: string): string {
    const normalized = message.toLowerCase();
    if (normalized.includes("foreign key") || normalized.includes("referenced by other records") || normalized.includes("constraint")) {
      return message || "This record cannot be deleted because it is being referenced by other records.";
    }

    return message || fallback;
  }

  function renderDeleteFailureMessage(message: string): React.ReactNode {
    const entityPatterns: Array<{ label: string; entityKey: EntityKey; regex: RegExp }> = [
      { label: "AI Prompt", entityKey: "ai-prompts", regex: /AI Prompt \d+/gi },
      { label: "Job Application", entityKey: "job-applications", regex: /Job Application \d+/gi },
      { label: "Job Question", entityKey: "job-questions", regex: /Job Question \d+/gi },
      { label: "Job Posting", entityKey: "job-postings", regex: /Job Posting \d+/gi },
      { label: "Resume", entityKey: "resumes", regex: /Resume \d+/gi },
      { label: "AI Prompt Template", entityKey: "ai-prompt-templates", regex: /AI Prompt Template \d+/gi },
    ];

    const allMatches = entityPatterns
      .flatMap((pattern) =>
        [...message.matchAll(pattern.regex)].map((match) => ({
          entityKey: pattern.entityKey,
          raw: match[0],
          index: match.index ?? 0,
          id: Number.parseInt(match[0].replace(new RegExp(`^${pattern.label} `, "i"), ""), 10),
        })),
      )
      .sort((left, right) => left.index - right.index);

    if (allMatches.length === 0) {
      return message;
    }

    const nodes: React.ReactNode[] = [];
    let cursor = 0;

    allMatches.forEach((match, index) => {
      if (match.index > cursor) {
        nodes.push(message.slice(cursor, match.index));
      }

      if (Number.isFinite(match.id) && match.id > 0) {
        nodes.push(
          <a
            key={`${match.entityKey}-link-${match.id}-${index}`}
            className="db-viewer-list-item-read-header-link"
            href={`#${entityConfigs[match.entityKey].recordId(match.id)}`}
            onClick={(event) => {
              event.preventDefault();
              openEntityRecord(match.entityKey, match.id);
            }}
          >
            {match.raw}
          </a>,
        );
      } else {
        nodes.push(match.raw);
      }

      cursor = match.index + match.raw.length;
    });

    if (cursor < message.length) {
      nodes.push(message.slice(cursor));
    }

    return nodes;
  }

  async function confirmDeleteEntityRecord(key: EntityKey, id: number) {
    const entityConfig = entityConfigs[key];
    if (!entityConfig) {
      return;
    }

    const references = getDeleteReferences(key, id);
    const selectedKeys =
      deleteDialogState[key]?.selectedReferenceIds ??
      references.map((reference) => buildDeleteSelectionKey(reference.entityKey, reference.id));
    const row = document.getElementById(entityConfig.recordId(id));
    const label = entityConfig.label.toLowerCase();
    const endpoint = getDeleteRoute(key);
    const selectedReferences = references.filter((reference) =>
      selectedKeys.includes(buildDeleteSelectionKey(reference.entityKey, reference.id)),
    );

    row?.classList.add("db-viewer-list-item--removing");

    try {
      const response = await fetch(`${endpoint}/${id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          include: selectedReferences.map((reference) => ({
            entity: reference.entityKey,
            id: reference.id,
          })),
        }),
      });

      if (!response.ok) {
        const detailText = await response.text();
        let detail = detailText;
        try {
          const parsed = JSON.parse(detailText) as { error?: string };
          detail = parsed.error ?? detailText;
        } catch {
          // keep raw text fallback
        }

        throw new Error(
          getDeleteFailureMessage(detail || `Unable to delete this saved ${label}.`, `Unable to delete this saved ${label}.`),
        );
      }

      entityConfig.setState((current: any) =>
        current.filter((item: Record<string, unknown>) => Number((item as { id?: number }).id ?? 0) !== id),
      );

      for (const reference of selectedReferences) {
        switch (reference.entityKey) {
          case "job-postings":
            setJobPostings((current) => current.filter((item) => item.id !== reference.id));
            break;
          case "resumes":
            setResumes((current) => current.filter((item) => item.id !== reference.id));
            break;
          case "ai-prompt-templates":
            setAiPromptTemplates((current) => current.filter((item) => item.id !== reference.id));
            break;
          case "ai-prompts":
            setAiPrompts((current) => current.filter((item) => item.id !== reference.id));
            break;
        }
      }

      closeDeleteDialog(key);
      setError("");
    } catch (deleteError) {
      row?.classList.remove("db-viewer-list-item--removing");
      const message = deleteError instanceof Error ? deleteError.message : `Unable to delete this saved ${label}.`;
      setDeleteDialogState((current) => ({
        ...current,
        [key]: { itemId: null, selectedReferenceIds: [] },
      }));
      setDeleteFailureState((current) => ({
        ...current,
        [key]: { itemId: id, message },
      }));
      setError("");
    }
  }

  function getRefreshLabel(key: EntityKey): string {
    switch (key) {
      case "job-postings":
        return "job postings";
      case "job-applications":
        return "job applications";
      case "job-sources":
        return "job sources";
      case "job-questions":
        return "job questions";
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
      loadEntity<JobApplicationSummary>("job-applications", "/api/v1/job-applications?deep=true", setJobApplications),
      loadEntity<JobSourceSummary>("job-sources", "/api/v1/job-sources?deep=true", setJobSources),
      loadEntity<JobQuestionSummary>("job-questions", "/api/v1/job-questions?deep=true", setJobQuestions),
      loadEntity<SavedResume>("resumes", "/api/v1/resumes/?deep=true", setResumes),
      loadEntity<SavedPromptTemplate>("ai-prompt-templates", "/api/v1/ai-prompt-templates/?deep=true", setAiPromptTemplates),
      loadEntity<SavedAiPrompt>("ai-prompts", "/api/v1/ai-prompts/?deep=true", setAiPrompts),
      loadDbBackups(),
    ]);
  }, []);

  useEffect(() => {
    const activeKey = (Object.keys(deleteDialogState) as EntityKey[]).find((dialogKey) => {
      const state = deleteDialogState[dialogKey];
      return state?.itemId !== null && state?.itemId !== undefined;
    });

    if (!activeKey) {
      return;
    }

    const activeDialog = deleteDialogRefs.current[activeKey];
    if (!activeDialog) {
      return;
    }

    requestAnimationFrame(() => {
      activeDialog.focus();
    });
  }, [deleteDialogState]);

  useEffect(() => {
    const activeKey = (Object.keys(deleteFailureState) as EntityKey[]).find((dialogKey) => {
      const state = deleteFailureState[dialogKey];
      return state?.itemId !== null && state?.itemId !== undefined;
    });

    if (!activeKey) {
      return;
    }

    const activeDialog = deleteFailureDialogRefs.current[activeKey];
    if (!activeDialog) {
      return;
    }

    requestAnimationFrame(() => {
      activeDialog.focus();
    });
  }, [deleteFailureState]);

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

  function getCreateDraft(key: EntityKey): Record<string, string> {
    switch (key) {
      case "job-postings":
        return {
          title: "",
          company: "",
          location: "",
          salary: "",
          "work-model": "Remote",
          url: "",
          "document-type": "markdown",
          "document-content": "",
        };
      case "job-applications":
        return {
          company: "",
          role: "",
          "applied-on-date": "",
          status: "Draft",
          "source--id": "",
          "job-posting--id": "",
        };
      case "job-sources":
        return { name: "" };
      case "job-questions":
        return {
          question: "",
          answer: "",
          "job-application--id": "",
        };
      case "resumes":
        return {
          name: "",
          jobTitle: "",
          date: "",
          documentType: "markdown",
          documentContent: "",
        };
      case "ai-prompt-templates":
        return {
          name: "",
          documentType: "markdown",
          documentContent: "",
        };
      case "ai-prompts":
        return {
          name: "",
          aiUrl: "",
          "job-posting--id": "",
          "resume--id": "",
          "ai-prompt-template--id": "",
        };
      default:
        return {};
    }
  }

  function openCreateEditor(key: EntityKey) {
    setExpandedEntities((current) => ({ ...current, [key]: true }));
    setEditors((current) => ({
      ...current,
      [key]: {
        isOpen: true,
        itemId: 0,
        draft: getCreateDraft(key),
      },
    }));
  }

  function toggleEntity(key: EntityKey, nextOpen: boolean) {
    setExpandedEntities((current) => ({
      ...current,
      [key]: nextOpen,
    }));
  }

  function openImportDialog(key: EntityKey) {
    setExpandedEntities((current) => ({ ...current, [key]: true }));
    setImportDialogOpen((current) => ({ ...current, [key]: true }));
    setError("");
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

  function closeImportDialog(key: EntityKey) {
    setImportDialogOpen((current) => ({ ...current, [key]: false }));
    setImportSelections((current) => ({ ...current, [key]: null }));
    setError("");
  }

  function flashImportedRecords(key: EntityKey, recordIds: number[]) {
    if (recordIds.length === 0) {
      return;
    }

    const entityConfig = entityConfigs[key];
    if (!entityConfig) {
      return;
    }

    requestAnimationFrame(() => {
      for (const recordId of recordIds) {
        const recordElement = document.getElementById(entityConfig.recordId(recordId));
        if (!recordElement) {
          continue;
        }

        recordElement.classList.remove("db-viewer-list-item--highlight");
        void recordElement.offsetWidth;
        recordElement.classList.add("db-viewer-list-item--highlight");
        window.setTimeout(() => recordElement.classList.remove("db-viewer-list-item--highlight"), 1800);
      }
    });
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

  function stripImportedRecordIds<T>(value: T): T {
    if (Array.isArray(value)) {
      return value.map((item) => stripImportedRecordIds(item)) as T;
    }

    if (value && typeof value === "object") {
      const cleaned: Record<string, unknown> = {};
      for (const [key, childValue] of Object.entries(value as Record<string, unknown>)) {
        if (
          [
            "id",
            "createdAt",
            "updatedAt",
            "documentId",
            "jobPostingId",
            "resumeId",
            "aiPromptTemplateId",
            "promptDocumentId",
            "responseDocumentId",
          ].includes(key)
        ) {
          continue;
        }

        cleaned[key] = stripImportedRecordIds(childValue as never);
      }

      return cleaned as T;
    }

    return value;
  }

  function normalizeImportedRecord(key: EntityKey, record: Record<string, unknown>) {
    switch (key) {
      case "job-postings": {
        const document = (record.document as Record<string, unknown> | undefined) ?? {};
        return {
          id: Number(record.id ?? 0),
          title: String(record.title ?? ""),
          company: String(record.company ?? ""),
          location: String(record.location ?? ""),
          salary: String(record.salary ?? ""),
          workModel: (record.workModel as JobPostingSummary["workModel"]) ?? "Unknown",
          url: String(record.url ?? ""),
          documentId: Number((document.id as number | undefined) ?? 0),
          createdAt: String(record.createdAt ?? new Date().toISOString()),
          document: {
            id: Number((document.id as number | undefined) ?? 0),
            title: String((document.title as string | undefined) ?? "Document"),
            type: normalizeDocumentType(String((document.type as string | undefined) ?? "markdown")),
            content: String((document.content as string | undefined) ?? ""),
            source: (document.source as string | null | undefined) ?? null,
          },
        } as JobPostingSummary;
      }
      case "job-applications": {
        return {
          id: Number(record.id ?? 0),
          company: String(record.company ?? ""),
          role: String(record.role ?? ""),
          appliedOnDate: record.appliedOnDate == null ? null : String(record.appliedOnDate ?? ""),
          status: String(record.status ?? "Unknown"),
          sourceId: Number(record.sourceId ?? 0),
          source: record.source
            ? ({
                id: Number((record.source as Record<string, unknown>).id ?? 0),
                name: String((record.source as Record<string, unknown>).name ?? ""),
              } as JobSourceSummary)
            : null,
          jobPostingId: Number(record.jobPostingId ?? 0),
          jobPosting: record.jobPosting
            ? ({
                id: Number((record.jobPosting as Record<string, unknown>).id ?? 0),
                title: String((record.jobPosting as Record<string, unknown>).title ?? ""),
                company: String((record.jobPosting as Record<string, unknown>).company ?? ""),
                location: String((record.jobPosting as Record<string, unknown>).location ?? ""),
                salary: String((record.jobPosting as Record<string, unknown>).salary ?? ""),
                workModel: ((record.jobPosting as Record<string, unknown>).workModel as JobPostingSummary["workModel"]) ?? "Unknown",
                url: String((record.jobPosting as Record<string, unknown>).url ?? ""),
                documentId: Number((record.jobPosting as Record<string, unknown>).documentId ?? 0),
                createdAt: String((record.jobPosting as Record<string, unknown>).createdAt ?? new Date().toISOString()),
                document: ((record.jobPosting as Record<string, unknown>).document as Document | null) ?? null,
              } as JobPostingSummary)
            : null,
          createdAt: String(record.createdAt ?? new Date().toISOString()),
          updatedAt: String(record.updatedAt ?? new Date().toISOString()),
        } as JobApplicationSummary;
      }
      case "job-sources": {
        return {
          id: Number(record.id ?? 0),
          name: String(record.name ?? ""),
          createdAt: String(record.createdAt ?? new Date().toISOString()),
        } as JobSourceSummary;
      }
      case "job-questions": {
        return {
          id: Number(record.id ?? 0),
          question: String(record.question ?? ""),
          answer: record.answer == null ? null : String(record.answer ?? ""),
          jobApplicationId: Number(record.jobApplicationId ?? 0),
          createdAt: String(record.createdAt ?? new Date().toISOString()),
        } as JobQuestionSummary;
      }
      case "resumes": {
        const document = (record.document as Record<string, unknown> | undefined) ?? {};
        return {
          id: Number(record.id ?? 0),
          name: String(record.name ?? ""),
          jobTitle: String(record.jobTitle ?? ""),
          date: String(record.date ?? ""),
          documentId: Number((document.id as number | undefined) ?? 0),
          document: {
            id: Number((document.id as number | undefined) ?? 0),
            title: String((document.title as string | undefined) ?? "Document"),
            type: normalizeDocumentType(String((document.type as string | undefined) ?? "markdown")),
            content: String((document.content as string | undefined) ?? ""),
            source: (document.source as string | null | undefined) ?? null,
          },
        } as SavedResume;
      }
      case "ai-prompt-templates": {
        const document = (record.document as Record<string, unknown> | undefined) ?? {};
        return {
          id: Number(record.id ?? 0),
          name: String(record.name ?? ""),
          documentId: Number((document.id as number | undefined) ?? 0),
          createdAt: String(record.createdAt ?? new Date().toISOString()),
          document: {
            id: Number((document.id as number | undefined) ?? 0),
            title: String((document.title as string | undefined) ?? "Document"),
            type: normalizeDocumentType(String((document.type as string | undefined) ?? "markdown")),
            content: String((document.content as string | undefined) ?? ""),
            source: (document.source as string | null | undefined) ?? null,
          },
        } as SavedPromptTemplate;
      }
      case "ai-prompts": {
        const nestedJobPosting = (record.jobPosting as Record<string, unknown> | undefined) ?? {};
        const nestedResume = (record.resume as Record<string, unknown> | undefined) ?? {};
        const nestedTemplate = (record.aiPromptTemplate as Record<string, unknown> | undefined) ?? {};
        const promptDocument = (record.promptDocument as Record<string, unknown> | undefined) ?? {};
        const responseDocument = (record.responseDocument as Record<string, unknown> | undefined) ?? {};
        return {
          id: Number(record.id ?? 0),
          name: String(record.name ?? ""),
          aiUrl: String(record.aiUrl ?? ""),
          jobPostingId: Number(record.jobPostingId ?? Number((nestedJobPosting.id as number | undefined) ?? 0)),
          resumeId: Number(record.resumeId ?? Number((nestedResume.id as number | undefined) ?? 0)),
          aiPromptTemplateId: Number(record.aiPromptTemplateId ?? Number((nestedTemplate.id as number | undefined) ?? 0)),
          promptDocumentId: Number((promptDocument.id as number | undefined) ?? 0),
          responseDocumentId: Number((responseDocument.id as number | undefined) ?? 0),
          createdAt: String(record.createdAt ?? new Date().toISOString()),
          updatedAt: String(record.updatedAt ?? new Date().toISOString()),
          promptContent: String(record.promptContent ?? (record.promptDocument as Record<string, unknown> | undefined)?.content ?? ""),
          responseContent: String(
            record.responseContent ?? (record.responseDocument as Record<string, unknown> | undefined)?.content ?? "",
          ),
          jobPostingContent: String(
            record.jobPostingContent ?? (nestedJobPosting.document as Record<string, unknown> | undefined)?.content ?? "",
          ),
          resumeContent: String(record.resumeContent ?? (nestedResume.document as Record<string, unknown> | undefined)?.content ?? ""),
          jobPostingTitle: String(record.jobPostingTitle ?? (nestedJobPosting.title as string | undefined) ?? ""),
          jobPostingCompany: String(record.jobPostingCompany ?? (nestedJobPosting.company as string | undefined) ?? ""),
          jobPostingWorkModel: String(record.jobPostingWorkModel ?? (nestedJobPosting.workModel as string | undefined) ?? ""),
          jobPostingSalary: String(record.jobPostingSalary ?? (nestedJobPosting.salary as string | undefined) ?? ""),
          resumeName: String(record.resumeName ?? (nestedResume.name as string | undefined) ?? ""),
          resumeJobTitle: String(record.resumeJobTitle ?? (nestedResume.jobTitle as string | undefined) ?? ""),
          resumeDate: String(record.resumeDate ?? (nestedResume.date as string | undefined) ?? ""),
          aiPromptTemplateName: String(record.aiPromptTemplateName ?? (nestedTemplate.name as string | undefined) ?? ""),
          promptDocument: promptDocument.id
            ? { ...promptDocument, type: normalizeDocumentType(String((promptDocument.type as string | undefined) ?? "markdown")) }
            : null,
          responseDocument: responseDocument.id
            ? { ...responseDocument, type: normalizeDocumentType(String((responseDocument.type as string | undefined) ?? "markdown")) }
            : null,
          jobPosting: {
            id: Number((nestedJobPosting.id as number | undefined) ?? 0),
            title: String((nestedJobPosting.title as string | undefined) ?? ""),
            company: String((nestedJobPosting.company as string | undefined) ?? ""),
            location: String((nestedJobPosting.location as string | undefined) ?? ""),
            salary: String((nestedJobPosting.salary as string | undefined) ?? ""),
            workModel: (nestedJobPosting.workModel as JobPostingSummary["workModel"]) ?? "Unknown",
            url: String((nestedJobPosting.url as string | undefined) ?? ""),
            documentId: Number((nestedJobPosting.documentId as number | undefined) ?? 0),
            createdAt: String((nestedJobPosting.createdAt as string | undefined) ?? new Date().toISOString()),
            document: ((nestedJobPosting.document as Record<string, unknown> | undefined) ?? null) as Document | null,
          },
          resume: {
            id: Number((nestedResume.id as number | undefined) ?? 0),
            name: String((nestedResume.name as string | undefined) ?? ""),
            jobTitle: String((nestedResume.jobTitle as string | undefined) ?? ""),
            date: String((nestedResume.date as string | undefined) ?? ""),
            documentId: Number((nestedResume.documentId as number | undefined) ?? 0),
            document: ((nestedResume.document as Record<string, unknown> | undefined) ?? null) as Document | null,
          },
          aiPromptTemplate: {
            id: Number((nestedTemplate.id as number | undefined) ?? 0),
            name: String((nestedTemplate.name as string | undefined) ?? ""),
            documentId: Number((nestedTemplate.documentId as number | undefined) ?? 0),
            createdAt: String((nestedTemplate.createdAt as string | undefined) ?? new Date().toISOString()),
            document: ((nestedTemplate.document as Record<string, unknown> | undefined) ?? null) as Document | null,
          },
        } as SavedAiPrompt;
      }
      default:
        return record as Record<string, unknown>;
    }
  }

  async function importExportSelection(key: EntityKey, file: File | null) {
    if (!file) {
      setError("Select a file to import.");
      return;
    }

    try {
      const rawText = await file.text();
      const parsed = JSON.parse(rawText) as { records?: Record<string, unknown>[]; entity?: string };
      const records = Array.isArray(parsed.records) ? parsed.records : [];

      if (records.length === 0) {
        setError("The selected file does not contain any records to import.");
        return;
      }

      const imported = records
        .map((record) => normalizeImportedRecord(key, record))
        .filter((record) => Number((record as { id?: number }).id ?? 0) > 0);

      if (imported.length === 0) {
        setError("The selected file does not contain valid records for this entity.");
        return;
      }

      const persistedImported: Record<string, unknown>[] = [];

      for (const item of imported) {
        const payload = (() => {
          switch (key) {
            case "job-postings": {
              const posting = item as JobPostingSummary;
              return {
                title: posting.title,
                company: posting.company,
                location: posting.location,
                salary: posting.salary,
                workModel: posting.workModel,
                url: posting.url,
                document: {
                  title: posting.document?.title ?? posting.title,
                  type: posting.document?.type ?? "markdown",
                  content: posting.document?.content ?? "",
                  source: posting.document?.source ?? null,
                },
              };
            }
            case "job-applications": {
              const application = item as JobApplicationSummary;
              return {
                company: application.company,
                role: application.role,
                appliedOnDate: application.appliedOnDate ?? null,
                status: application.status,
                sourceId: application.sourceId,
                source: application.source ? { name: application.source.name } : undefined,
                jobPostingId: application.jobPostingId,
                jobPosting: application.jobPosting
                  ? {
                      title: application.jobPosting.title ?? "",
                      company: application.jobPosting.company ?? "",
                      location: application.jobPosting.location ?? "",
                      salary: application.jobPosting.salary ?? "",
                      workModel: application.jobPosting.workModel ?? "Unknown",
                      url: application.jobPosting.url ?? "",
                      document: application.jobPosting.document
                        ? {
                            title: application.jobPosting.document.title ?? application.jobPosting.title ?? application.company,
                            type: application.jobPosting.document.type ?? "markdown",
                            content: application.jobPosting.document.content ?? "",
                            source: application.jobPosting.document.source ?? null,
                          }
                        : undefined,
                    }
                  : undefined,
              };
            }
            case "job-sources": {
              const source = item as JobSourceSummary;
              return { name: source.name };
            }
            case "job-questions": {
              const question = item as JobQuestionSummary;
              return {
                question: question.question,
                answer: question.answer ?? null,
                jobApplicationId: question.jobApplicationId,
              };
            }
            case "resumes": {
              const resume = item as SavedResume;
              return {
                name: resume.name,
                jobTitle: resume.jobTitle,
                date: resume.date,
                document: {
                  title: resume.document?.title ?? resume.name,
                  type: resume.document?.type ?? "markdown",
                  content: resume.document?.content ?? "",
                  source: resume.document?.source ?? null,
                },
              };
            }
            case "ai-prompt-templates": {
              const template = item as SavedPromptTemplate;
              return {
                name: template.name,
                document: {
                  title: template.document?.title ?? template.name,
                  type: template.document?.type ?? "markdown",
                  content: template.document?.content ?? "",
                  source: template.document?.source ?? null,
                },
              };
            }
            case "ai-prompts": {
              const prompt = item as SavedAiPrompt;

              const jobPosting = prompt.jobPosting
                ? stripImportedRecordIds({
                    title: prompt.jobPosting.title ?? "",
                    company: prompt.jobPosting.company ?? "",
                    location: prompt.jobPosting.location ?? "",
                    salary: prompt.jobPosting.salary ?? "",
                    workModel: prompt.jobPosting.workModel ?? "Unknown",
                    url: prompt.jobPosting.url ?? "",
                    document: prompt.jobPosting.document
                      ? {
                          title: prompt.jobPosting.document.title ?? prompt.jobPosting.title ?? prompt.name,
                          type: normalizeDocumentType(String(prompt.jobPosting.document.type ?? "markdown")),
                          content: prompt.jobPosting.document.content ?? "",
                          source: prompt.jobPosting.document.source ?? null,
                        }
                      : undefined,
                  })
                : undefined;

              const resume = prompt.resume
                ? stripImportedRecordIds({
                    name: prompt.resume.name ?? "",
                    jobTitle: prompt.resume.jobTitle ?? "",
                    date: prompt.resume.date ?? "",
                    document: prompt.resume.document
                      ? {
                          title: prompt.resume.document.title ?? prompt.resume.name ?? prompt.name,
                          type: normalizeDocumentType(String(prompt.resume.document.type ?? "markdown")),
                          content: prompt.resume.document.content ?? "",
                          source: prompt.resume.document.source ?? null,
                        }
                      : undefined,
                  })
                : undefined;

              const aiPromptTemplate = prompt.aiPromptTemplate
                ? stripImportedRecordIds({
                    name: prompt.aiPromptTemplate.name ?? "",
                    document: prompt.aiPromptTemplate.document
                      ? {
                          title: prompt.aiPromptTemplate.document.title ?? prompt.aiPromptTemplate.name ?? prompt.name,
                          type: normalizeDocumentType(String(prompt.aiPromptTemplate.document.type ?? "markdown")),
                          content: prompt.aiPromptTemplate.document.content ?? "",
                          source: prompt.aiPromptTemplate.document.source ?? null,
                        }
                      : undefined,
                  })
                : undefined;

              return {
                name: prompt.name,
                aiUrl: prompt.aiUrl,
                ...(jobPosting ? { jobPosting } : prompt.jobPostingId > 0 ? { jobPostingId: prompt.jobPostingId } : {}),
                ...(resume ? { resume } : prompt.resumeId > 0 ? { resumeId: prompt.resumeId } : {}),
                ...(aiPromptTemplate
                  ? { aiPromptTemplate: aiPromptTemplate }
                  : prompt.aiPromptTemplateId > 0
                    ? { aiPromptTemplateId: prompt.aiPromptTemplateId }
                    : {}),
                promptDocument: prompt.promptDocument
                  ? {
                      title: prompt.promptDocument.title ?? `${prompt.name} prompt`,
                      type: prompt.promptDocument.type ?? "markdown",
                      content: prompt.promptDocument.content ?? "",
                      source: prompt.promptDocument.source ?? null,
                    }
                  : undefined,
                responseDocument: prompt.responseDocument
                  ? {
                      title: prompt.responseDocument.title ?? `${prompt.name} response`,
                      type: prompt.responseDocument.type ?? "markdown",
                      content: prompt.responseDocument.content ?? "",
                      source: prompt.responseDocument.source ?? null,
                    }
                  : undefined,
              };
            }
            default:
              return item;
          }
        })();

        const endpoint =
          key === "job-postings"
            ? "/api/v1/job-postings/"
            : key === "job-applications"
              ? "/api/v1/job-applications/"
              : key === "job-sources"
                ? "/api/v1/job-sources/"
                : key === "job-questions"
                  ? "/api/v1/job-questions/"
                  : key === "resumes"
                    ? "/api/v1/resumes/"
                    : key === "ai-prompt-templates"
                      ? "/api/v1/ai-prompt-templates/"
                      : "/api/v1/ai-prompts/";

        const response = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          const detail = await response.text();
          throw new Error(detail || `Unable to import ${key}.`);
        }

        const saved = (await response.json()) as Record<string, unknown>;
        if (saved && typeof saved === "object") {
          persistedImported.push(saved);
        }
      }

      const importedIds = persistedImported.map((record) => Number((record as { id?: number }).id ?? 0)).filter((id) => id > 0);

      if (importedIds.length === 0) {
        throw new Error("The server did not return any imported records.");
      }

      switch (key) {
        case "job-postings":
          await loadEntity("job-postings", "/api/v1/job-postings?deep=true", setJobPostings);
          break;
        case "job-applications":
          await loadEntity("job-applications", "/api/v1/job-applications?deep=true", setJobApplications);
          break;
        case "job-sources":
          await loadEntity("job-sources", "/api/v1/job-sources?deep=true", setJobSources);
          break;
        case "job-questions":
          await loadEntity("job-questions", "/api/v1/job-questions?deep=true", setJobQuestions);
          break;
        case "resumes":
          await loadEntity("resumes", "/api/v1/resumes/?deep=true", setResumes);
          break;
        case "ai-prompt-templates":
          await loadEntity("ai-prompt-templates", "/api/v1/ai-prompt-templates/?deep=true", setAiPromptTemplates);
          break;
        case "ai-prompts":
          await loadEntity("ai-prompts", "/api/v1/ai-prompts/?deep=true", setAiPrompts);
          break;
        default:
          break;
      }

      setImportDialogOpen((current) => ({ ...current, [key]: false }));
      setImportSelections((current) => ({ ...current, [key]: null }));
      setImportFileName((current) => ({ ...current, [key]: file.name }));
      setExpandedEntities((current) => ({ ...current, [key]: true }));
      flashImportedRecords(key, importedIds);
      setError("");
    } catch (importError) {
      const message = importError instanceof Error ? importError.message : "Unable to import selected file.";
      setError(`Unable to import file. (${message})`);
    }
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
        const expander = row.querySelector("details.db-viewer-record-expander") as HTMLDetailsElement | null;
        if (expander && !expander.open) {
          expander.open = true;
        }

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
    try {
      let payload: Record<string, unknown> = {};
      let savedRecord: Record<string, unknown> | null = null;
      const isCreate = itemId === null || itemId <= 0;

      switch (key) {
        case "job-postings": {
          if (!isCreate) {
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
            payload = next;
            savedRecord = next;
            break;
          }

          payload = {
            title: draft.title ?? "",
            company: draft.company ?? "",
            location: draft.location ?? "",
            salary: draft.salary ?? "",
            workModel: draft["work-model"] ?? draft.workModel ?? "Remote",
            url: draft.url ?? "",
            document: {
              title: draft.title ?? "",
              type: normalizeDocumentType(draft["document-type"] ?? draft.documentType ?? "markdown"),
              content: draft["document-content"] || draft.documentContent || (draft.title ? `# ${draft.title}` : ""),
              source: null,
            },
          };
          break;
        }
        case "job-applications": {
          if (!isCreate) {
            const current = jobApplications.find((item) => item.id === itemId);
            if (!current) {
              return;
            }
            const next = {
              ...current,
              company: draft.company || current.company,
              role: draft.role || current.role,
              appliedOnDate: draft.appliedOnDate ?? current.appliedOnDate ?? null,
              status: draft.status || current.status,
              sourceId: Number(draft["source--id"] ?? current.sourceId ?? 0),
              source: jobSources.find((item) => item.id === Number(draft["source--id"] ?? current.sourceId ?? 0)) ?? current.source ?? null,
              jobPostingId: Number(draft["job-posting--id"] ?? current.jobPostingId ?? 0),
              jobPosting:
                jobPostings.find((item) => item.id === Number(draft["job-posting--id"] ?? current.jobPostingId ?? 0)) ??
                current.jobPosting ??
                null,
            };
            payload = next;
            savedRecord = next;
            break;
          }

          payload = {
            company: draft.company ?? "",
            role: draft.role ?? "",
            appliedOnDate: draft["applied-on-date"] || draft.appliedOnDate || null,
            status: draft.status ?? "Draft",
            sourceId: Number(draft["source--id"] ?? draft["source-id"] ?? 0),
            jobPostingId: Number(draft["job-posting--id"] ?? draft["job-posting-id"] ?? 0),
          };
          break;
        }
        case "job-sources": {
          if (!isCreate) {
            const current = jobSources.find((item) => item.id === itemId);
            if (!current) {
              return;
            }
            payload = { ...current, name: draft.name || current.name };
            savedRecord = payload;
            break;
          }

          payload = { name: draft.name ?? "" };
          break;
        }
        case "job-questions": {
          if (!isCreate) {
            const current = jobQuestions.find((item) => item.id === itemId);
            if (!current) {
              return;
            }
            const next = {
              ...current,
              question: draft.question || current.question,
              answer: draft.answer ?? current.answer ?? null,
              jobApplicationId: Number(draft["job-application--id"] ?? current.jobApplicationId ?? 0),
            };
            payload = next;
            savedRecord = next;
            break;
          }

          payload = {
            question: draft.question ?? "",
            answer: draft.answer ?? null,
            jobApplicationId: Number(draft["job-application--id"] ?? 0),
          };
          break;
        }
        case "resumes": {
          if (!isCreate) {
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
            payload = next;
            savedRecord = next;
            break;
          }

          payload = {
            name: draft.name ?? "",
            jobTitle: draft.jobTitle ?? "",
            date: draft.date ?? "",
            document: {
              title: draft.name ?? "",
              type: normalizeDocumentType(draft.documentType ?? "markdown"),
              content: draft.documentContent ?? (draft.name ? `# ${draft.name}` : ""),
              source: null,
            },
          };
          break;
        }
        case "ai-prompt-templates": {
          if (!isCreate) {
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
            payload = next;
            savedRecord = next;
            break;
          }

          payload = {
            name: draft.name ?? "",
            document: {
              title: draft.name ?? "",
              type: normalizeDocumentType(draft.documentType ?? "markdown"),
              content: draft.documentContent ?? (draft.name ? `# ${draft.name}` : ""),
              source: null,
            },
          };
          break;
        }
        case "ai-prompts": {
          if (!isCreate) {
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
            payload = {
              ...next,
              jobPosting: undefined,
              resume: undefined,
              aiPromptTemplate: undefined,
            };
            savedRecord = next;
            break;
          }

          payload = {
            name: draft.name ?? "",
            aiUrl: draft.aiUrl ?? "",
            jobPostingId: Number(draft["job-posting--id"] ?? 0),
            resumeId: Number(draft["resume--id"] ?? 0),
            aiPromptTemplateId: Number(draft["ai-prompt-template--id"] ?? 0),
          };
          break;
        }
      }

      const endpoint = (() => {
        switch (key) {
          case "job-postings":
            return "/api/v1/job-postings";
          case "job-applications":
            return "/api/v1/job-applications";
          case "job-sources":
            return "/api/v1/job-sources";
          case "job-questions":
            return "/api/v1/job-questions";
          case "resumes":
            return "/api/v1/resumes";
          case "ai-prompt-templates":
            return "/api/v1/ai-prompt-templates";
          case "ai-prompts":
            return "/api/v1/ai-prompts";
          default:
            return "/api/v1/job-postings";
        }
      })();

      const response = await fetch(isCreate ? endpoint : `${endpoint}/${itemId}`, {
        method: isCreate ? "POST" : "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error((await response.text()) || "Unable to save the record.");
      }

      const saved = (await response.json()) as Record<string, unknown>;
      const normalizedDate =
        key === "resumes" ? toDateInputValue(String(saved.date ?? (savedRecord as { date?: string } | null)?.date ?? "")) : undefined;
      const updated = {
        ...(savedRecord ?? {}),
        ...saved,
        ...(normalizedDate ? { date: normalizedDate } : {}),
      };

      switch (key) {
        case "job-postings":
          if (isCreate) {
            setJobPostings((current) => [...current, updated as JobPostingSummary]);
          } else {
            setJobPostings((current) =>
              current.map((item) => (item.id === itemId ? { ...item, ...(updated as JobPostingSummary) } : item)),
            );
          }
          break;
        case "job-applications":
          if (isCreate) {
            setJobApplications((current) => [...current, updated as JobApplicationSummary]);
          } else {
            setJobApplications((current) =>
              current.map((item) => (item.id === itemId ? { ...item, ...(updated as JobApplicationSummary) } : item)),
            );
          }
          break;
        case "job-sources":
          if (isCreate) {
            setJobSources((current) => [...current, updated as JobSourceSummary]);
          } else {
            setJobSources((current) => current.map((item) => (item.id === itemId ? { ...item, ...(updated as JobSourceSummary) } : item)));
          }
          break;
        case "job-questions":
          if (isCreate) {
            setJobQuestions((current) => [...current, updated as JobQuestionSummary]);
          } else {
            setJobQuestions((current) =>
              current.map((item) => (item.id === itemId ? { ...item, ...(updated as JobQuestionSummary) } : item)),
            );
          }
          break;
        case "resumes":
          if (isCreate) {
            setResumes((current) => [...current, updated as SavedResume]);
          } else {
            setResumes((current) => current.map((item) => (item.id === itemId ? { ...item, ...(updated as SavedResume) } : item)));
          }
          break;
        case "ai-prompt-templates":
          if (isCreate) {
            setAiPromptTemplates((current) => [...current, updated as SavedPromptTemplate]);
          } else {
            setAiPromptTemplates((current) =>
              current.map((item) => (item.id === itemId ? { ...item, ...(updated as SavedPromptTemplate) } : item)),
            );
          }
          break;
        case "ai-prompts":
          if (isCreate) {
            setAiPrompts((current) => [...current, updated as SavedAiPrompt]);
          } else {
            setAiPrompts((current) => current.map((item) => (item.id === itemId ? { ...item, ...(updated as SavedAiPrompt) } : item)));
          }
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
    | EntityConfig<JobPostingSummary>
    | EntityConfig<JobApplicationSummary>
    | EntityConfig<JobSourceSummary>
    | EntityConfig<JobQuestionSummary>
    | EntityConfig<SavedResume>
    | EntityConfig<SavedPromptTemplate>
    | EntityConfig<SavedAiPrompt>
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
      deleteDialogId: "db-viewer--job-postings--delete-dialog",
      deleteFailureDialogId: "db-viewer--job-postings--delete-failure-dialog",
      deleteConfirmButtonId: "db-viewer--job-postings--delete-confirm-button",
      deleteCancelButtonId: "db-viewer--job-postings--delete-cancel-button",
      deleteFailureDismissButtonId: "db-viewer--job-postings--delete-failure-dismiss-button",
      deleteReferenceCheckboxId: (entityKey, id) => `db-viewer--${entityKey}--delete-reference-${id}-checkbox`,
      exportButtonId: "db-viewer--job-postings--export-button",
      exportDialogId: "db-viewer--job-postings--export-dialog",
      exportCheckboxId: (id) => `db-viewer--job-postings--export-record-${id}-checkbox`,
      exportConfirmButtonId: "db-viewer--job-postings--export-confirm-button",
      exportCancelButtonId: "db-viewer--job-postings--export-cancel-button",
      importButtonId: "db-viewer--job-postings--import-button",
      importDialogId: "db-viewer--job-postings--import-dialog",
      importFileInputId: "db-viewer--job-postings--import-file-input",
      importConfirmButtonId: "db-viewer--job-postings--import-confirm-button",
      importCancelButtonId: "db-viewer--job-postings--import-cancel-button",
      recordId: (id) => `db-viewer--job-postings--record-${id}`,
      recordControlId: (id, controlName) => `db-viewer--job-postings--${controlName}--record-${id}`,
      createButtonId: "db-viewer--job-postings--create-button",
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
    "job-applications": {
      key: "job-applications",
      label: "Job Application",
      fetchUrl: "/api/v1/job-applications?deep=true",
      state: jobApplications,
      setState: setJobApplications,
      countId: "db-viewer--job-applications--count",
      containerId: "db-viewer--job-applications--container",
      refreshStatusId: "db-viewer--job-applications--refresh-status",
      listId: "db-viewer--job-applications--list",
      refreshButtonId: "db-viewer--job-applications--refresh-button",
      deleteDialogId: "db-viewer--job-applications--delete-dialog",
      deleteFailureDialogId: "db-viewer--job-applications--delete-failure-dialog",
      deleteConfirmButtonId: "db-viewer--job-applications--delete-confirm-button",
      deleteCancelButtonId: "db-viewer--job-applications--delete-cancel-button",
      deleteFailureDismissButtonId: "db-viewer--job-applications--delete-failure-dismiss-button",
      deleteReferenceCheckboxId: (entityKey, id) => `db-viewer--${entityKey}--delete-reference-${id}-checkbox`,
      exportButtonId: "db-viewer--job-applications--export-button",
      exportDialogId: "db-viewer--job-applications--export-dialog",
      exportCheckboxId: (id) => `db-viewer--job-applications--export-record-${id}-checkbox`,
      exportConfirmButtonId: "db-viewer--job-applications--export-confirm-button",
      exportCancelButtonId: "db-viewer--job-applications--export-cancel-button",
      importButtonId: "db-viewer--job-applications--import-button",
      importDialogId: "db-viewer--job-applications--import-dialog",
      importFileInputId: "db-viewer--job-applications--import-file-input",
      importConfirmButtonId: "db-viewer--job-applications--import-confirm-button",
      importCancelButtonId: "db-viewer--job-applications--import-cancel-button",
      recordId: (id) => `db-viewer--job-applications--record-${id}`,
      recordControlId: (id, controlName) => `db-viewer--job-applications--${controlName}--record-${id}`,
      createButtonId: "db-viewer--job-applications--create-button",
      editorId: "db-viewer--job-applications--editor",
      editorSaveButtonId: "db-viewer--job-applications--editor--save-button",
      editorCancelButtonId: "db-viewer--job-applications--editor--cancel-button",
      editorFieldId: (field) => `db-viewer--job-applications--editor--${field}`,
      summary: (item: JobApplicationSummary) => ({
        primary: item.company || "Untitled job application",
        secondary: item.role || "Unknown role",
        tertiary: `${item.status || "Unknown status"}${item.appliedOnDate ? ` · ${toDateInputValue(item.appliedOnDate)}` : ""}`,
      }),
      buildDraft: (item: JobApplicationSummary) => ({
        company: item.company,
        role: item.role,
        appliedOnDate: toDateInputValue(item.appliedOnDate),
        status: item.status,
        "source--id": String(item.sourceId ?? ""),
        "job-posting--id": String(item.jobPostingId ?? ""),
      }),
    },
    "job-sources": {
      key: "job-sources",
      label: "Job Source",
      fetchUrl: "/api/v1/job-sources?deep=true",
      state: jobSources,
      setState: setJobSources,
      countId: "db-viewer--job-sources--count",
      containerId: "db-viewer--job-sources--container",
      refreshStatusId: "db-viewer--job-sources--refresh-status",
      listId: "db-viewer--job-sources--list",
      refreshButtonId: "db-viewer--job-sources--refresh-button",
      deleteDialogId: "db-viewer--job-sources--delete-dialog",
      deleteFailureDialogId: "db-viewer--job-sources--delete-failure-dialog",
      deleteConfirmButtonId: "db-viewer--job-sources--delete-confirm-button",
      deleteCancelButtonId: "db-viewer--job-sources--delete-cancel-button",
      deleteFailureDismissButtonId: "db-viewer--job-sources--delete-failure-dismiss-button",
      deleteReferenceCheckboxId: (entityKey, id) => `db-viewer--${entityKey}--delete-reference-${id}-checkbox`,
      exportButtonId: "db-viewer--job-sources--export-button",
      exportDialogId: "db-viewer--job-sources--export-dialog",
      exportCheckboxId: (id) => `db-viewer--job-sources--export-record-${id}-checkbox`,
      exportConfirmButtonId: "db-viewer--job-sources--export-confirm-button",
      exportCancelButtonId: "db-viewer--job-sources--export-cancel-button",
      importButtonId: "db-viewer--job-sources--import-button",
      importDialogId: "db-viewer--job-sources--import-dialog",
      importFileInputId: "db-viewer--job-sources--import-file-input",
      importConfirmButtonId: "db-viewer--job-sources--import-confirm-button",
      importCancelButtonId: "db-viewer--job-sources--import-cancel-button",
      recordId: (id) => `db-viewer--job-sources--record-${id}`,
      recordControlId: (id, controlName) => `db-viewer--job-sources--${controlName}--record-${id}`,
      createButtonId: "db-viewer--job-sources--create-button",
      editorId: "db-viewer--job-sources--editor",
      editorSaveButtonId: "db-viewer--job-sources--editor--save-button",
      editorCancelButtonId: "db-viewer--job-sources--editor--cancel-button",
      editorFieldId: (field) => `db-viewer--job-sources--editor--${field}`,
      summary: (item: JobSourceSummary) => ({
        primary: item.name || "Untitled job source",
        secondary: "",
      }),
      buildDraft: (item: JobSourceSummary) => ({
        name: item.name,
      }),
    },
    "job-questions": {
      key: "job-questions",
      label: "Job Question",
      fetchUrl: "/api/v1/job-questions?deep=true",
      state: jobQuestions,
      setState: setJobQuestions,
      countId: "db-viewer--job-questions--count",
      containerId: "db-viewer--job-questions--container",
      refreshStatusId: "db-viewer--job-questions--refresh-status",
      listId: "db-viewer--job-questions--list",
      refreshButtonId: "db-viewer--job-questions--refresh-button",
      deleteDialogId: "db-viewer--job-questions--delete-dialog",
      deleteFailureDialogId: "db-viewer--job-questions--delete-failure-dialog",
      deleteConfirmButtonId: "db-viewer--job-questions--delete-confirm-button",
      deleteCancelButtonId: "db-viewer--job-questions--delete-cancel-button",
      deleteFailureDismissButtonId: "db-viewer--job-questions--delete-failure-dismiss-button",
      deleteReferenceCheckboxId: (entityKey, id) => `db-viewer--${entityKey}--delete-reference-${id}-checkbox`,
      exportButtonId: "db-viewer--job-questions--export-button",
      exportDialogId: "db-viewer--job-questions--export-dialog",
      exportCheckboxId: (id) => `db-viewer--job-questions--export-record-${id}-checkbox`,
      exportConfirmButtonId: "db-viewer--job-questions--export-confirm-button",
      exportCancelButtonId: "db-viewer--job-questions--export-cancel-button",
      importButtonId: "db-viewer--job-questions--import-button",
      importDialogId: "db-viewer--job-questions--import-dialog",
      importFileInputId: "db-viewer--job-questions--import-file-input",
      importConfirmButtonId: "db-viewer--job-questions--import-confirm-button",
      importCancelButtonId: "db-viewer--job-questions--import-cancel-button",
      recordId: (id) => `db-viewer--job-questions--record-${id}`,
      recordControlId: (id, controlName) => `db-viewer--job-questions--${controlName}--record-${id}`,
      createButtonId: "db-viewer--job-questions--create-button",
      editorId: "db-viewer--job-questions--editor",
      editorSaveButtonId: "db-viewer--job-questions--editor--save-button",
      editorCancelButtonId: "db-viewer--job-questions--editor--cancel-button",
      editorFieldId: (field) => `db-viewer--job-questions--editor--${field}`,
      summary: (item: JobQuestionSummary) => ({
        primary: item.question || "Untitled job question",
        secondary: item.answer || "No answer yet",
      }),
      buildDraft: (item: JobQuestionSummary) => ({
        question: item.question,
        answer: item.answer ?? "",
        "job-application--id": String(item.jobApplicationId ?? ""),
      }),
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
      deleteDialogId: "db-viewer--resumes--delete-dialog",
      deleteFailureDialogId: "db-viewer--resumes--delete-failure-dialog",
      deleteConfirmButtonId: "db-viewer--resumes--delete-confirm-button",
      deleteCancelButtonId: "db-viewer--resumes--delete-cancel-button",
      deleteFailureDismissButtonId: "db-viewer--resumes--delete-failure-dismiss-button",
      deleteReferenceCheckboxId: (entityKey, id) => `db-viewer--${entityKey}--delete-reference-${id}-checkbox`,
      exportButtonId: "db-viewer--resumes--export-button",
      exportDialogId: "db-viewer--resumes--export-dialog",
      exportCheckboxId: (id) => `db-viewer--resumes--export-record-${id}-checkbox`,
      exportConfirmButtonId: "db-viewer--resumes--export-confirm-button",
      exportCancelButtonId: "db-viewer--resumes--export-cancel-button",
      importButtonId: "db-viewer--resumes--import-button",
      importDialogId: "db-viewer--resumes--import-dialog",
      importFileInputId: "db-viewer--resumes--import-file-input",
      importConfirmButtonId: "db-viewer--resumes--import-confirm-button",
      importCancelButtonId: "db-viewer--resumes--import-cancel-button",
      recordId: (id) => `db-viewer--resumes--record-${id}`,
      recordControlId: (id, controlName) => `db-viewer--resumes--${controlName}--record-${id}`,
      createButtonId: "db-viewer--resumes--create-button",
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
      deleteDialogId: "db-viewer--ai-prompt-templates--delete-dialog",
      deleteFailureDialogId: "db-viewer--ai-prompt-templates--delete-failure-dialog",
      deleteConfirmButtonId: "db-viewer--ai-prompt-templates--delete-confirm-button",
      deleteCancelButtonId: "db-viewer--ai-prompt-templates--delete-cancel-button",
      deleteFailureDismissButtonId: "db-viewer--ai-prompt-templates--delete-failure-dismiss-button",
      deleteReferenceCheckboxId: (entityKey, id) => `db-viewer--${entityKey}--delete-reference-${id}-checkbox`,
      exportButtonId: "db-viewer--ai-prompt-templates--export-button",
      exportDialogId: "db-viewer--ai-prompt-templates--export-dialog",
      exportCheckboxId: (id) => `db-viewer--ai-prompt-templates--export-record-${id}-checkbox`,
      exportConfirmButtonId: "db-viewer--ai-prompt-templates--export-confirm-button",
      exportCancelButtonId: "db-viewer--ai-prompt-templates--export-cancel-button",
      importButtonId: "db-viewer--ai-prompt-templates--import-button",
      importDialogId: "db-viewer--ai-prompt-templates--import-dialog",
      importFileInputId: "db-viewer--ai-prompt-templates--import-file-input",
      importConfirmButtonId: "db-viewer--ai-prompt-templates--import-confirm-button",
      importCancelButtonId: "db-viewer--ai-prompt-templates--import-cancel-button",
      recordId: (id) => `db-viewer--ai-prompt-templates--record-${id}`,
      recordControlId: (id, controlName) => `db-viewer--ai-prompt-templates--${controlName}--record-${id}`,
      createButtonId: "db-viewer--ai-prompt-templates--create-button",
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
      deleteDialogId: "db-viewer--ai-prompts--delete-dialog",
      deleteFailureDialogId: "db-viewer--ai-prompts--delete-failure-dialog",
      deleteConfirmButtonId: "db-viewer--ai-prompts--delete-confirm-button",
      deleteCancelButtonId: "db-viewer--ai-prompts--delete-cancel-button",
      deleteFailureDismissButtonId: "db-viewer--ai-prompts--delete-failure-dismiss-button",
      deleteReferenceCheckboxId: (entityKey, id) => `db-viewer--${entityKey}--delete-reference-${id}-checkbox`,
      exportButtonId: "db-viewer--ai-prompts--export-button",
      exportDialogId: "db-viewer--ai-prompts--export-dialog",
      exportCheckboxId: (id) => `db-viewer--ai-prompts--export-record-${id}-checkbox`,
      exportConfirmButtonId: "db-viewer--ai-prompts--export-confirm-button",
      exportCancelButtonId: "db-viewer--ai-prompts--export-cancel-button",
      importButtonId: "db-viewer--ai-prompts--import-button",
      importDialogId: "db-viewer--ai-prompts--import-dialog",
      importFileInputId: "db-viewer--ai-prompts--import-file-input",
      importConfirmButtonId: "db-viewer--ai-prompts--import-confirm-button",
      importCancelButtonId: "db-viewer--ai-prompts--import-cancel-button",
      recordId: (id) => `db-viewer--ai-prompts--record-${id}`,
      recordControlId: (id, controlName) => `db-viewer--ai-prompts--${controlName}--record-${id}`,
      createButtonId: "db-viewer--ai-prompts--create-button",
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

  function getIncomingReferences(targetEntity: EntityKey, targetId: number): RecordReference[] {
    if (targetId <= 0) {
      return [];
    }

    switch (targetEntity) {
      case "job-postings": {
        return [
          ...jobApplications
            .filter((application) => application.jobPostingId === targetId)
            .map((application) => ({
              key: `job-application-${application.id}`,
              label: `Job Application ${application.id} · ${application.company || "Untitled job application"}`,
              recordId: application.id,
              targetEntity: entityConfigs["job-applications"],
            })),
          ...getAiPromptReferences((candidate) => candidate.jobPostingId === targetId),
        ];
      }
      case "resumes": {
        return [
          ...jobApplications
            .filter((application) => application.resume?.id === targetId)
            .map((application) => ({
              key: `job-application-${application.id}`,
              label: `Job Application ${application.id} · ${application.company || "Untitled job application"}`,
              recordId: application.id,
              targetEntity: entityConfigs["job-applications"],
            })),
          ...getAiPromptReferences((candidate) => candidate.resumeId === targetId),
        ];
      }
      case "ai-prompt-templates": {
        return getAiPromptReferences((candidate) => candidate.aiPromptTemplateId === targetId);
      }
      case "job-sources": {
        return jobApplications
          .filter((application) => application.sourceId === targetId)
          .map((application) => ({
            key: `job-application-${application.id}`,
            label: `Job Application ${application.id} · ${application.company || "Untitled job application"}`,
            recordId: application.id,
            targetEntity: entityConfigs["job-applications"],
          }));
      }
      case "job-applications": {
        return jobQuestions
          .filter((question) => question.jobApplicationId === targetId)
          .map((question) => ({
            key: `job-question-${question.id}`,
            label: `Job Question ${question.id} · ${question.question || "Untitled job question"}`,
            recordId: question.id,
            targetEntity: entityConfigs["job-questions"],
          }));
      }
      default:
        return [];
    }
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
                    id={entity.createButtonId}
                    type="button"
                    className="button button--primary"
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      openCreateEditor(entity.key);
                    }}
                  >
                    Create
                  </button>
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
                    id={entity.importButtonId}
                    type="button"
                    className="button button--secondary"
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      openImportDialog(entity.key);
                    }}
                  >
                    Import
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

              {importDialogOpen[entity.key] ? (
                <div id={entity.importDialogId} className="db-viewer-export-dialog" role="dialog" aria-modal="false">
                  <div className="db-viewer-export-dialog__header">
                    <strong>Import {entity.label} records</strong>
                  </div>
                  <div className="db-viewer-export-dialog__list">
                    <label className="db-viewer-export-option" htmlFor={entity.importFileInputId}>
                      <span>Choose JSON file</span>
                    </label>
                    <input
                      id={entity.importFileInputId}
                      type="file"
                      accept="application/json,.json"
                      onChange={(event) => {
                        const nextFile = event.target.files?.[0] ?? null;
                        setImportSelections((current) => ({ ...current, [entity.key]: nextFile }));
                        if (nextFile) {
                          setImportFileName((current) => ({ ...current, [entity.key]: nextFile.name }));
                        }
                      }}
                    />
                    {importFileName[entity.key] ? <p className="db-viewer-status">Selected file: {importFileName[entity.key]}</p> : null}
                  </div>
                  <div className="db-viewer-export-dialog__actions">
                    <button
                      id={entity.importConfirmButtonId}
                      type="button"
                      className="button button--primary"
                      onClick={() => {
                        const selectedFile = importSelections[entity.key] ?? null;
                        void importExportSelection(entity.key, selectedFile);
                      }}
                    >
                      Import
                    </button>
                    <button
                      id={entity.importCancelButtonId}
                      type="button"
                      className="button button--secondary"
                      onClick={() => closeImportDialog(entity.key)}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : null}

              {editorState.isOpen && editorState.itemId === 0 ? (
                <div id={entity.editorId} className="db-viewer-editor">
                  {entity.key === "job-postings" ? (
                    <>
                      <label className="db-viewer-editor-label">
                        Title
                        <input
                          id={entity.editorFieldId("title")}
                          type="text"
                          value={editorState.draft.title ?? ""}
                          onChange={(event) => updateEditorValue(entity.key, "title", event.target.value)}
                        />
                      </label>
                      <label className="db-viewer-editor-label">
                        Company
                        <input
                          id={entity.editorFieldId("company")}
                          type="text"
                          value={editorState.draft.company ?? ""}
                          onChange={(event) => updateEditorValue(entity.key, "company", event.target.value)}
                        />
                      </label>
                      <label className="db-viewer-editor-label">
                        Location
                        <input
                          id={entity.editorFieldId("location")}
                          type="text"
                          value={editorState.draft.location ?? ""}
                          onChange={(event) => updateEditorValue(entity.key, "location", event.target.value)}
                        />
                      </label>
                      <label className="db-viewer-editor-label">
                        Salary
                        <input
                          id={entity.editorFieldId("salary")}
                          type="text"
                          value={editorState.draft.salary ?? ""}
                          onChange={(event) => updateEditorValue(entity.key, "salary", event.target.value)}
                        />
                      </label>
                      <label className="db-viewer-editor-label">
                        Work Model
                        <input
                          id={entity.editorFieldId("work-model")}
                          type="text"
                          value={editorState.draft["work-model"] ?? editorState.draft.workModel ?? ""}
                          onChange={(event) => updateEditorValue(entity.key, "work-model", event.target.value)}
                        />
                      </label>
                      <label className="db-viewer-editor-label">
                        URL
                        <input
                          id={entity.editorFieldId("url")}
                          type="text"
                          value={editorState.draft.url ?? ""}
                          onChange={(event) => updateEditorValue(entity.key, "url", event.target.value)}
                        />
                      </label>
                      <label className="db-viewer-editor-label">
                        Document type
                        <select
                          id={entity.editorFieldId("document-type")}
                          value={normalizeDocumentType(editorState.draft["document-type"] ?? editorState.draft.documentType ?? "")}
                          onChange={(event) => updateEditorValue(entity.key, "document-type", event.target.value)}
                        >
                          {DOCUMENT_TYPE_OPTIONS.map((option) => (
                            <option key={option} value={option.toLowerCase()}>
                              {option}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="db-viewer-editor-label">
                        Document content
                        <textarea
                          id={entity.editorFieldId("document-content")}
                          rows={10}
                          value={editorState.draft["document-content"] ?? editorState.draft.documentContent ?? ""}
                          onChange={(event) => updateEditorValue(entity.key, "document-content", event.target.value)}
                        />
                      </label>
                    </>
                  ) : null}

                  {entity.key === "job-applications" ? (
                    <>
                      <label className="db-viewer-editor-label">
                        Company
                        <input
                          id={entity.editorFieldId("company")}
                          type="text"
                          value={editorState.draft.company ?? ""}
                          onChange={(event) => updateEditorValue(entity.key, "company", event.target.value)}
                        />
                      </label>
                      <label className="db-viewer-editor-label">
                        Role
                        <input
                          id={entity.editorFieldId("role")}
                          type="text"
                          value={editorState.draft.role ?? ""}
                          onChange={(event) => updateEditorValue(entity.key, "role", event.target.value)}
                        />
                      </label>
                      <label className="db-viewer-editor-label">
                        Applied on date
                        <input
                          id={entity.editorFieldId("applied-on-date")}
                          type="date"
                          value={editorState.draft["applied-on-date"] ?? editorState.draft.appliedOnDate ?? ""}
                          onChange={(event) => updateEditorValue(entity.key, "applied-on-date", event.target.value)}
                        />
                      </label>
                      <label className="db-viewer-editor-label">
                        Status
                        <input
                          id={entity.editorFieldId("status")}
                          type="text"
                          value={editorState.draft.status ?? "Draft"}
                          onChange={(event) => updateEditorValue(entity.key, "status", event.target.value)}
                        />
                      </label>
                      <label className="db-viewer-editor-label">
                        Source ID
                        <input
                          id={entity.editorFieldId("source--id")}
                          type="number"
                          value={editorState.draft["source--id"] ?? editorState.draft["source-id"] ?? ""}
                          onChange={(event) => updateEditorValue(entity.key, "source--id", event.target.value)}
                        />
                      </label>
                      <label className="db-viewer-editor-label">
                        Job Posting ID
                        <input
                          id={entity.editorFieldId("job-posting--id")}
                          type="number"
                          value={editorState.draft["job-posting--id"] ?? editorState.draft["job-posting-id"] ?? ""}
                          onChange={(event) => updateEditorValue(entity.key, "job-posting--id", event.target.value)}
                        />
                      </label>
                    </>
                  ) : null}

                  {entity.key === "job-sources" ? (
                    <>
                      <label className="db-viewer-editor-label">
                        Name
                        <input
                          id={entity.editorFieldId("name")}
                          type="text"
                          value={editorState.draft.name ?? ""}
                          onChange={(event) => updateEditorValue(entity.key, "name", event.target.value)}
                        />
                      </label>
                    </>
                  ) : null}

                  {entity.key === "job-questions" ? (
                    <>
                      <label className="db-viewer-editor-label">
                        Question
                        <input
                          id={entity.editorFieldId("question")}
                          type="text"
                          value={editorState.draft.question ?? ""}
                          onChange={(event) => updateEditorValue(entity.key, "question", event.target.value)}
                        />
                      </label>
                      <label className="db-viewer-editor-label">
                        Answer
                        <input
                          id={entity.editorFieldId("answer")}
                          type="text"
                          value={editorState.draft.answer ?? ""}
                          onChange={(event) => updateEditorValue(entity.key, "answer", event.target.value)}
                        />
                      </label>
                      <label className="db-viewer-editor-label">
                        Job Application ID
                        <input
                          id={entity.editorFieldId("job-application--id")}
                          type="number"
                          value={editorState.draft["job-application--id"] ?? ""}
                          onChange={(event) => updateEditorValue(entity.key, "job-application--id", event.target.value)}
                        />
                      </label>
                    </>
                  ) : null}

                  {entity.key === "resumes" ? (
                    <>
                      <label className="db-viewer-editor-label">
                        Name
                        <input
                          id={entity.editorFieldId("name")}
                          type="text"
                          value={editorState.draft.name ?? ""}
                          onChange={(event) => updateEditorValue(entity.key, "name", event.target.value)}
                        />
                      </label>
                      <label className="db-viewer-editor-label">
                        Job title
                        <input
                          id={entity.editorFieldId("jobTitle")}
                          type="text"
                          value={editorState.draft.jobTitle ?? ""}
                          onChange={(event) => updateEditorValue(entity.key, "jobTitle", event.target.value)}
                        />
                      </label>
                      <label className="db-viewer-editor-label">
                        Date
                        <input
                          id={entity.editorFieldId("date")}
                          type="date"
                          value={editorState.draft.date ?? ""}
                          onChange={(event) => updateEditorValue(entity.key, "date", event.target.value)}
                        />
                      </label>
                      <label className="db-viewer-editor-label">
                        Document type
                        <select
                          id={entity.editorFieldId("documentType")}
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
                      <label className="db-viewer-editor-label">
                        Document content
                        <textarea
                          id={entity.editorFieldId("documentContent")}
                          rows={10}
                          value={editorState.draft.documentContent ?? ""}
                          onChange={(event) => updateEditorValue(entity.key, "documentContent", event.target.value)}
                        />
                      </label>
                    </>
                  ) : null}

                  {entity.key === "ai-prompt-templates" ? (
                    <>
                      <label className="db-viewer-editor-label">
                        Name
                        <input
                          id={entity.editorFieldId("name")}
                          type="text"
                          value={editorState.draft.name ?? ""}
                          onChange={(event) => updateEditorValue(entity.key, "name", event.target.value)}
                        />
                      </label>
                      <label className="db-viewer-editor-label">
                        Document type
                        <select
                          id={entity.editorFieldId("documentType")}
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
                      <label className="db-viewer-editor-label">
                        Document content
                        <textarea
                          id={entity.editorFieldId("documentContent")}
                          rows={10}
                          value={editorState.draft.documentContent ?? ""}
                          onChange={(event) => updateEditorValue(entity.key, "documentContent", event.target.value)}
                        />
                      </label>
                    </>
                  ) : null}

                  {entity.key === "ai-prompts" ? (
                    <>
                      <label className="db-viewer-editor-label">
                        Name
                        <input
                          id={entity.editorFieldId("name")}
                          type="text"
                          value={editorState.draft.name ?? ""}
                          onChange={(event) => updateEditorValue(entity.key, "name", event.target.value)}
                        />
                      </label>
                      <label className="db-viewer-editor-label">
                        AI URL
                        <input
                          id={entity.editorFieldId("aiUrl")}
                          type="text"
                          value={editorState.draft.aiUrl ?? ""}
                          onChange={(event) => updateEditorValue(entity.key, "aiUrl", event.target.value)}
                        />
                      </label>
                      <label className="db-viewer-editor-label">
                        Job Posting ID
                        <input
                          id={entity.editorFieldId("job-posting--id")}
                          type="number"
                          value={editorState.draft["job-posting--id"] ?? ""}
                          onChange={(event) => updateEditorValue(entity.key, "job-posting--id", event.target.value)}
                        />
                      </label>
                      <label className="db-viewer-editor-label">
                        Resume ID
                        <input
                          id={entity.editorFieldId("resume--id")}
                          type="number"
                          value={editorState.draft["resume--id"] ?? ""}
                          onChange={(event) => updateEditorValue(entity.key, "resume--id", event.target.value)}
                        />
                      </label>
                      <label className="db-viewer-editor-label">
                        AI Prompt Template ID
                        <input
                          id={entity.editorFieldId("ai-prompt-template--id")}
                          type="number"
                          value={editorState.draft["ai-prompt-template--id"] ?? ""}
                          onChange={(event) => updateEditorValue(entity.key, "ai-prompt-template--id", event.target.value)}
                        />
                      </label>
                    </>
                  ) : null}

                  <div className="db-viewer-editor-actions">
                    <button
                      id={entity.editorSaveButtonId}
                      type="button"
                      className="button button--primary"
                      onClick={() => void saveEditorItem(entity.key, editorState.itemId, editorState.draft)}
                    >
                      Save
                    </button>
                    <button
                      id={entity.editorCancelButtonId}
                      type="button"
                      className="button button--secondary"
                      onClick={() => closeEditor(entity.key)}
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

                      const summaryText = (() => {
                        if (entity.key === "job-postings") {
                          return `${jobposting.id ?? ""} • ${jobposting.title ?? "[missing title]"}`;
                        }

                        if (entity.key === "job-applications") {
                          const application = item as JobApplicationSummary;
                          return `${application.id ?? ""} • ${application.company ?? "[missing company]"}`;
                        }

                        if (entity.key === "job-sources") {
                          const source = item as JobSourceSummary;
                          return `${source.id ?? ""} • ${source.name ?? "[missing name]"}`;
                        }

                        if (entity.key === "job-questions") {
                          const question = item as JobQuestionSummary;
                          return `${question.id ?? ""} • ${question.question ?? "[missing question]"}`;
                        }

                        if (entity.key === "resumes") {
                          return `${resume.id ?? ""} • ${resume.name ?? "[missing name]"}`;
                        }

                        if (entity.key === "ai-prompt-templates") {
                          return `${prompttemplate.id ?? ""} • ${prompttemplate.name ?? "[missing name]"}`;
                        }

                        return `${prompt.id ?? ""} • ${prompt.name ?? "[missing name]"}`;
                      })();

                      return (
                        <li key={idField} id={entity.recordId(idField)} className="db-viewer-list-item">
                          <div className="db-viewer-list-item-main">
                            <div className="db-viewer-list-item-copy">
                              {deleteFailureState[entity.key]?.itemId === idField ? (() => {
                                const failureMessage = deleteFailureState[entity.key]?.message ?? "Unable to delete this saved record.";
                                return (
                                  <div
                                    id={entity.deleteFailureDialogId}
                                    className="db-viewer-export-dialog db-viewer-export-dialog--anchored"
                                    role="alertdialog"
                                    aria-modal="false"
                                    tabIndex={-1}
                                    ref={(node) => {
                                      deleteFailureDialogRefs.current[entity.key] = node;
                                    }}
                                    onKeyDown={(event) => handleDeleteFailureKeyDown(entity.key, event)}
                                  >
                                    <div className="db-viewer-export-dialog__header">
                                      <strong>Delete failed</strong>
                                    </div>
                                    <div className="db-viewer-export-dialog__list">
                                      <p className="db-viewer-status">{renderDeleteFailureMessage(failureMessage)}</p>
                                    </div>
                                    <div className="db-viewer-export-dialog__actions">
                                      <button
                                        id={entity.deleteFailureDismissButtonId}
                                        type="button"
                                        className="button button--secondary"
                                        onClick={() => closeDeleteDialog(entity.key)}
                                      >
                                        Dismiss
                                      </button>
                                    </div>
                                  </div>
                                );
                              })() : null}

                              {deleteDialogState[entity.key]?.itemId === idField ? (() => {
                                const itemId = deleteDialogState[entity.key].itemId ?? 0;
                                const references = getDeleteReferences(entity.key, itemId);
                                const selectedIds = deleteDialogState[entity.key].selectedReferenceIds;

                                return (
                                  <div
                                    id={entity.deleteDialogId}
                                    className="db-viewer-export-dialog db-viewer-export-dialog--anchored"
                                    role="dialog"
                                    aria-modal="false"
                                    tabIndex={-1}
                                    ref={(node) => {
                                      deleteDialogRefs.current[entity.key] = node;
                                    }}
                                    onKeyDown={(event) => handleDeleteDialogKeyDown(entity.key, event)}
                                  >
                                    <div className="db-viewer-export-dialog__header">
                                      <strong>Delete {entity.label}</strong>
                                    </div>
                                    <div className="db-viewer-export-dialog__list">
                                      <p className="db-viewer-status">
                                        This will permanently delete the selected {entity.label.toLowerCase()} record.
                                      </p>
                                      {references.length > 0 ? (
                                        <>
                                          <p className="db-viewer-status">Related records to include in the deletion:</p>
                                          {references.map((reference) => {
                                            const selectionKey = buildDeleteSelectionKey(reference.entityKey, reference.id);
                                            return (
                                              <label
                                                key={selectionKey}
                                                className="db-viewer-export-option"
                                                htmlFor={entity.deleteReferenceCheckboxId(reference.entityKey, reference.id)}
                                              >
                                                <input
                                                  id={entity.deleteReferenceCheckboxId(reference.entityKey, reference.id)}
                                                  type="checkbox"
                                                  checked={selectedIds.includes(selectionKey)}
                                                  onChange={() => toggleDeleteReferenceSelection(entity.key, reference)}
                                                />
                                                <span>{reference.label}</span>
                                              </label>
                                            );
                                          })}
                                        </>
                                      ) : null}
                                    </div>
                                    <div className="db-viewer-export-dialog__actions">
                                      <button
                                        id={entity.deleteConfirmButtonId}
                                        type="button"
                                        className="button button--primary"
                                        onClick={() => {
                                          const itemId = deleteDialogState[entity.key]?.itemId ?? 0;
                                          if (itemId <= 0) {
                                            return;
                                          }
                                          void confirmDeleteEntityRecord(entity.key, itemId);
                                        }}
                                      >
                                        Delete
                                      </button>
                                      <button
                                        id={entity.deleteCancelButtonId}
                                        type="button"
                                        className="button button--secondary"
                                        onClick={() => closeDeleteDialog(entity.key)}
                                      >
                                        Cancel
                                      </button>
                                    </div>
                                  </div>
                                );
                              })() : null}

                              <details className="db-viewer-record-expander">
                                <summary>
                                  <span className="db-viewer-record-expander-summary-text">{summaryText}</span>
                                </summary>
                                <div className="db-viewer-record-expander-content">
                                  {entity.key === "job-postings" && (
                                    <>
                                      <JobPostingDisplay
                                        entity={entity}
                                        targetEntity={jobPostingEntityConfig}
                                        jobposting={jobposting}
                                        onOpenRecord={openEntityRecord}
                                      />
                                      <ReferencedByDisplay
                                        references={getIncomingReferences("job-postings", jobposting.id)}
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
                                        references={getIncomingReferences("resumes", resume.id)}
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
                                        references={getIncomingReferences("ai-prompt-templates", prompttemplate.id)}
                                        onOpenRecord={openEntityRecord}
                                      />
                                    </>
                                  )}

                                  {entity.key === "job-sources" && (
                                    <>
                                      <div className="db-viewer-list-item-read-line">
                                        <strong>{(item as JobSourceSummary)?.name ?? "[missing name]"}</strong>
                                      </div>
                                      <ReferencedByDisplay
                                        references={getIncomingReferences("job-sources", Number((item as JobSourceSummary).id ?? 0))}
                                        onOpenRecord={openEntityRecord}
                                      />
                                    </>
                                  )}

                                  {entity.key === "job-applications" && (
                                    <>
                                      <div className="db-viewer-list-item-read-line">
                                        <strong>{(item as JobApplicationSummary)?.company ?? "[missing company]"}</strong>
                                        <span>{(item as JobApplicationSummary)?.role ?? "[missing role]"}</span>
                                      </div>
                                      <ReferencedByDisplay
                                        references={getIncomingReferences("job-applications", Number((item as JobApplicationSummary).id ?? 0))}
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
                              </details>
                            </div>

                            <div className="db-viewer-list-item-actions">
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
                              <button
                                id={entity.recordControlId(idField, "delete-button")}
                                type="button"
                                className="button button--delete"
                                onClick={() => openDeleteDialog(entity.key, idField)}
                              >
                                Delete
                              </button>
                            </div>
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
      {!isRootEntity && (
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
      {!isRootEntity && (
        <strong className="db-viewer-list-item-read-header">
          <span id={entity.recordControlId(template.id, `editor--${infix}id`)}>{template.id ?? ""}</span>
          <span aria-hidden="true" className="db-viewer-list-item-read-header-separator">
            •
          </span>
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
        </strong>
      )}

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
