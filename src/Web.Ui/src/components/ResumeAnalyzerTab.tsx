import { useEffect, useState } from "react";
import type { SavedJobPostingSummary } from "../App";
import { AiPromptUi, type AiPrompt } from "./AiPrompt";
import { AiPromptTemplateUi, type AiPromptTemplate } from "./AiPromptTemplate";
import type { Entity } from "./Entity";
import { getPatch } from "../utilities/entities";
import { useSimpleDialogErrors } from "../utilities/componentState";
import { EntitySection } from "./EntitySection";
import { ResumeUi, type Resume } from "./Resume";

type SavedPromptTemplate = AiPromptTemplate;

type SavedResume = Resume;

type SavedAiPrompt = AiPrompt;

const DOCUMENT_TYPE_OPTIONS = ["HTML", "PDF", "Markdown", "Text", "Word", "Other"] as const;

// Best-effort guess used only when the user hasn't designated a document type.
function detectDocumentType(content: string): string {
  const trimmed = content.trim();
  if (!trimmed) {
    return "Unknown";
  }
  if (/^<!doctype html|<html[\s>]|<\/html>/i.test(trimmed)) {
    return "HTML";
  }
  if (/^%PDF-/.test(trimmed)) {
    return "PDF";
  }
  if (/^(#{1,6}\s|[-*+]\s|\d+\.\s|```|\[.+\]\(.+\))/m.test(trimmed)) {
    return "Markdown";
  }
  return "Text";
}

function extractMatchPercent(responseContent: string | null | undefined) {
  if (!responseContent) {
    return "Unknown";
  }
  const responseHeader = responseContent.slice(0, 1000);
  const match = responseHeader.match(/\bmatch(?:\s+percentage|\s+percent|\s+score)?\b[^\d%]{0,20}(\d{1,3})\s*%/i);
  return match ? `${match[1]}%` : "Unknown";
}

type ResumeAnalyzerTabProps = {
  jobPosting: SavedJobPostingSummary | null;
};

function toDateInputValue(value: string): string {
  if (!value) {
    return "";
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

const EXPANDER_STORAGE_KEY = "jobSearchAssistant.resumeAnalyzer.expanders";
const LOADED_TEMPLATE_STORAGE_KEY = "jobSearchAssistant.resumeAnalyzer.loadedTemplate";
const AI_URL_STORAGE_KEY = "jobSearchAssistant.resumeAnalyzer.aiUrl";
const AI_PROMPT_CONTENT_STORAGE_KEY = "jobSearchAssistant.resumeAnalyzer.aiPromptContent";
const AI_RESPONSE_STORAGE_KEY = "jobSearchAssistant.resumeAnalyzer.aiResponse";

type LoadedTemplate = {
  id: string;
  name: string;
  template: string;
};

function getStoredLoadedTemplate(): LoadedTemplate {
  const stored = localStorage.getItem(LOADED_TEMPLATE_STORAGE_KEY);
  if (!stored) {
    return { id: "", name: "", template: "" };
  }

  try {
    const parsed = JSON.parse(stored) as Partial<LoadedTemplate>;
    return {
      id: typeof parsed.id === "string" ? parsed.id : "",
      name: typeof parsed.name === "string" ? parsed.name : "",
      template: typeof parsed.template === "string" ? parsed.template : "",
    };
  } catch {
    return { id: "", name: "", template: "" };
  }
}

const LOADED_RESUME_STORAGE_KEY = "jobSearchAssistant.resumeAnalyzer.loadedResume";

type LoadedResume = {
  id: string;
  name: string;
  jobTitle: string;
  date: string;
  documentId: string;
  documentType: string;
  content: string;
};

function getStoredLoadedResume(): LoadedResume {
  const stored = localStorage.getItem(LOADED_RESUME_STORAGE_KEY);
  if (!stored) {
    return { id: "", name: "", jobTitle: "", date: "", documentId: "", documentType: "", content: "" };
  }

  try {
    const parsed = JSON.parse(stored) as Partial<LoadedResume>;
    return {
      id: typeof parsed.id === "string" ? parsed.id : "",
      name: typeof parsed.name === "string" ? parsed.name : "",
      jobTitle: typeof parsed.jobTitle === "string" ? parsed.jobTitle : "",
      date: typeof parsed.date === "string" ? parsed.date : "",
      documentId: typeof parsed.documentId === "string" ? parsed.documentId : "",
      documentType: typeof parsed.documentType === "string" ? parsed.documentType : "",
      content: typeof parsed.content === "string" ? parsed.content : "",
    };
  } catch {
    return { id: "", name: "", jobTitle: "", date: "", documentId: "", documentType: "", content: "" };
  }
}

type ExpanderState = {
  aiPrompt: boolean;
  aiPromptContent: boolean;
  aiResponseContent: boolean;
  jobDescription: boolean;
  jobDescriptionContent: boolean;
  resume: boolean;
  resumeContent: boolean;
  savedResumes: boolean;
  promptTemplate: boolean;
  promptTemplateContent: boolean;
  savedTemplates: boolean;
  savedAiPrompts: boolean;
  savedTemplateCards: Record<number, boolean>;
  savedResumeCards: Record<number, boolean>;
  savedAiPromptCards: Record<number, boolean>;
};

const defaultExpanderState: ExpanderState = {
  aiPrompt: false,
  aiPromptContent: false,
  aiResponseContent: true,
  jobDescription: false,
  jobDescriptionContent: true,
  resume: false,
  resumeContent: false,
  savedResumes: true,
  promptTemplate: false,
  promptTemplateContent: false,
  savedTemplates: false,
  savedAiPrompts: true,
  savedTemplateCards: {},
  savedResumeCards: {},
  savedAiPromptCards: {},
};

function getStoredExpanderState(): ExpanderState {
  const stored = localStorage.getItem(EXPANDER_STORAGE_KEY);
  if (!stored) {
    return defaultExpanderState;
  }

  try {
    const parsed = JSON.parse(stored) as Partial<ExpanderState>;
    return {
      ...defaultExpanderState,
      ...parsed,
      savedTemplateCards: parsed.savedTemplateCards ?? {},
      savedResumeCards: parsed.savedResumeCards ?? {},
      savedAiPromptCards: parsed.savedAiPromptCards ?? {},
      savedResumes: parsed.savedResumes ?? true,
      savedAiPrompts: parsed.savedAiPrompts ?? true,
    };
  } catch {
    return defaultExpanderState;
  }
}

export function ResumeAnalyzerTab({ jobPosting }: ResumeAnalyzerTabProps) {
  const [expanderState, setExpanderState] = useState<ExpanderState>(getStoredExpanderState);
  const [savedTemplates, setSavedTemplates] = useState<SavedPromptTemplate[]>([]);
  const [savedResumes, setSavedResumes] = useState<SavedResume[]>([]);
  const [resumesLoading, setResumesLoading] = useState(false);
  const [resumeDeletionErrors, setResumeDeletionError, clearResumeDeletionError] = useSimpleDialogErrors();
  const [savedAiPrompts, setSavedAiPrompts] = useState<SavedAiPrompt[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [promptsLoading, setPromptsLoading] = useState(false);
  const [templateDeletionErrors, setTemplateDeletionError, clearTemplateDeletionError] = useSimpleDialogErrors();
  const [promptDeletionErrors, setPromptDeletionError, clearPromptDeletionError] = useSimpleDialogErrors();
  const [resumeId, setResumeId] = useState(() => getStoredLoadedResume().id);
  const [resumeName, setResumeName] = useState(() => getStoredLoadedResume().name);
  const [resumeJobTitle, setResumeJobTitle] = useState(() => getStoredLoadedResume().jobTitle);
  const [resumeDate, setResumeDate] = useState(() => getStoredLoadedResume().date);
  const [resumeDocumentId, setResumeDocumentId] = useState(() => getStoredLoadedResume().documentId);
  const [resumeDocumentType, setResumeDocumentType] = useState(() => getStoredLoadedResume().documentType);
  const [resumeContent, setResumeContent] = useState(() => getStoredLoadedResume().content);
  const [templateId, setTemplateId] = useState(() => getStoredLoadedTemplate().id);
  const [templateName, setTemplateName] = useState(() => getStoredLoadedTemplate().name);
  const [templateContent, setTemplateContent] = useState(() => getStoredLoadedTemplate().template);
  const [aiUrl, setAiUrl] = useState(() => localStorage.getItem(AI_URL_STORAGE_KEY) || "");
  const [aiPromptContent, setAiPromptContent] = useState(() => localStorage.getItem(AI_PROMPT_CONTENT_STORAGE_KEY) || "");
  const [aiResponseText, setAiResponseText] = useState(() => localStorage.getItem(AI_RESPONSE_STORAGE_KEY) || "");
  const [status, setStatus] = useState("Ready");

  useEffect(() => {
    localStorage.setItem(EXPANDER_STORAGE_KEY, JSON.stringify(expanderState));
  }, [expanderState]);

  useEffect(() => {
    localStorage.setItem(LOADED_TEMPLATE_STORAGE_KEY, JSON.stringify({ id: templateId, name: templateName, template: templateContent }));
  }, [templateId, templateName, templateContent]);

  useEffect(() => {
    localStorage.setItem(
      LOADED_RESUME_STORAGE_KEY,
      JSON.stringify({
        id: resumeId,
        name: resumeName,
        jobTitle: resumeJobTitle,
        date: resumeDate,
        documentId: resumeDocumentId,
        documentType: resumeDocumentType,
        content: resumeContent,
      }),
    );
  }, [resumeId, resumeName, resumeJobTitle, resumeDate, resumeDocumentId, resumeDocumentType, resumeContent]);

  useEffect(() => {
    localStorage.setItem(AI_URL_STORAGE_KEY, aiUrl);
  }, [aiUrl]);

  useEffect(() => {
    localStorage.setItem(AI_PROMPT_CONTENT_STORAGE_KEY, aiPromptContent);
  }, [aiPromptContent]);

  useEffect(() => {
    localStorage.setItem(AI_RESPONSE_STORAGE_KEY, aiResponseText);
  }, [aiResponseText]);

  function setExpanderOpen(
    expander: keyof Omit<ExpanderState, "savedTemplateCards" | "savedResumeCards" | "savedAiPromptCards">,
    open: boolean,
  ) {
    setExpanderState((current) => ({ ...current, [expander]: open }));
  }

  async function refreshSavedAiPrompts() {
    setPromptsLoading(true);
    try {
      const response = await fetch("/api/v1/ai-prompts/?deep=true");
      if (!response.ok) {
        const detail = (await response.text()).trim();
        throw new Error(`${response.status}: ${detail || "No server details provided."}`);
      }

      setSavedAiPrompts((await response.json()) as SavedAiPrompt[]);
      setStatus("Saved AI prompts refreshed.");
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unable to load saved AI prompts.";
      setStatus(`Unable to refresh saved AI prompts. (${message})`);
    } finally {
      setPromptsLoading(false);
    }
  }

  async function refreshSavedResumes() {
    setResumesLoading(true);
    try {
      const response = await fetch("/api/v1/resumes/?deep=true");
      if (!response.ok) {
        const detail = (await response.text()).trim();
        throw new Error(`${response.status}: ${detail || "No server details provided."}`);
      }

      setSavedResumes((await response.json()) as SavedResume[]);
      setStatus("Saved resumes refreshed.");
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unable to load saved resumes.";
      setStatus(`Unable to refresh saved resumes. (${message})`);
    } finally {
      setResumesLoading(false);
    }
  }

  async function refreshSavedTemplates() {
    setTemplatesLoading(true);
    try {
      const response = await fetch("/api/v1/ai-prompt-templates/?deep=true");
      if (!response.ok) {
        const detail = (await response.text()).trim();
        throw new Error(`${response.status}: ${detail || "No server details provided."}`);
      }

      setSavedTemplates((await response.json()) as SavedPromptTemplate[]);
      setStatus("Saved templates refreshed.");
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unable to load saved prompt templates.";
      setStatus(`Unable to refresh saved templates. (${message})`);
    } finally {
      setTemplatesLoading(false);
    }
  }

  useEffect(() => {
    void refreshSavedTemplates();
  }, []);

  useEffect(() => {
    void refreshSavedAiPrompts();
  }, []);

  useEffect(() => {
    void refreshSavedResumes();
  }, []);

  async function handleSaveTemplate() {
    if (!templateName.trim() || !templateContent.trim()) {
      setStatus("Enter a template name and content before saving.");
      return;
    }

    const payload = {
      name: templateName.trim(),
      document: {
        title: templateName.trim(),
        type: "Markdown",
        content: templateContent,
      },
    };

    const response = await fetch("/api/v1/ai-prompt-templates/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      const errorBody = await response.text();
      setStatus(`Unable to save the prompt template. (${response.status}: ${errorBody})`);
      return;
    }

    const saved = (await response.json()) as SavedPromptTemplate;
    const savedContent = saved.document?.content ?? templateContent;
    setSavedTemplates((current) => [saved, ...current]);
    setTemplateId(String(saved.id));
    setTemplateContent(savedContent);
    setStatus("Prompt template saved.");
  }

  async function handleDeleteTemplate(id: number) {
    const response = await fetch(`/api/v1/ai-prompt-templates/${id}`, { method: "DELETE" });
    if (!response.ok) {
      throw new Error((await response.text()) || "Unable to delete the prompt template.");
    }
    setSavedTemplates((current) => current.filter((template) => template.id !== id));
    setStatus("Prompt template deleted.");
  }

  async function handleSaveResume() {
    console.log("[ResumeAnalyzer] handleSaveResume: starting", {
      resumeName,
      resumeJobTitle,
      resumeDate,
      resumeContentLength: resumeContent.length,
    });

    if (!resumeName.trim() || !resumeContent.trim()) {
      console.log("[ResumeAnalyzer] handleSaveResume: validation failed (missing name or content)");
      setStatus("Enter a resume name and content before saving.");
      return;
    }

    const isUpdate = resumeId.trim() !== "";
    const documentType = resumeDocumentType || detectDocumentType(resumeContent);

    // A PUT is a full update, so the server needs the complete document
    // (including its id) rather than just the content.
    const payload = isUpdate
      ? {
          id: Number(resumeId),
          name: resumeName.trim(),
          jobTitle: resumeJobTitle.trim(),
          date: resumeDate || null,
          documentId: Number(resumeDocumentId),
          document: {
            id: Number(resumeDocumentId),
            title: resumeJobTitle.trim(),
            type: documentType,
            content: resumeContent,
          },
        }
      : {
          name: resumeName.trim(),
          jobTitle: resumeJobTitle.trim(),
          date: resumeDate || null,
          document: {
            title: resumeJobTitle.trim(),
            type: documentType,
            content: resumeContent,
          },
        };

    const url = isUpdate ? `/api/v1/resumes/${resumeId}` : "/api/v1/resumes/";
    const method = isUpdate ? "PUT" : "POST";
    console.log(`[ResumeAnalyzer] handleSaveResume: sending ${method} request to ${url}`, payload);

    try {
      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      console.log("[ResumeAnalyzer] handleSaveResume: response received", {
        status: response.status,
        ok: response.ok,
      });

      if (!response.ok) {
        const errorBody = await response.text();
        console.error("[ResumeAnalyzer] handleSaveResume: request failed", errorBody);
        setStatus(`Unable to save the resume. (${response.status}: ${errorBody})`);
        return;
      }

      const saved = (await response.json()) as SavedResume;
      console.log("[ResumeAnalyzer] handleSaveResume: saved successfully", saved);
      setSavedResumes((current) => (isUpdate ? current.map((resume) => (resume.id === saved.id ? saved : resume)) : [saved, ...current]));
      setResumeId(String(saved.id));
      setResumeDocumentId(String(saved.documentId));
      setResumeDocumentType(saved.document?.type ?? documentType);
      setStatus(isUpdate ? "Resume updated." : "Resume saved.");
      refreshSavedResumes();
    } catch (error) {
      console.error("[ResumeAnalyzer] handleSaveResume: exception thrown", error);
      setStatus(error instanceof Error ? `Unable to save the resume: ${error.message}` : "Unable to save the resume.");
    }
  }

  async function handleDeleteResume(id: number) {
    const response = await fetch(`/api/v1/resumes/${id}`, { method: "DELETE" });
    if (!response.ok) {
      throw new Error((await response.text()) || "Unable to delete the resume.");
    }
    setSavedResumes((current) => current.filter((saved) => saved.id !== id));
    setStatus("Resume deleted.");
  }

  async function handleSaveAiPrompt() {
    if (!jobPosting) {
      setStatus("Select a saved job posting before saving the AI prompt.");
      return;
    }
    if (!resumeId) {
      setStatus("Load or save a resume before saving the AI prompt.");
      return;
    }
    if (!templateId) {
      setStatus("Load or save a prompt template before saving the AI prompt.");
      return;
    }
    if (!aiPromptContent.trim()) {
      setStatus("Generate or enter prompt content before saving the AI prompt.");
      return;
    }

    const name = `${resumeName || "Resume"} vs ${jobPosting.title || "Job Posting"}`.trim();

    const response = await fetch("/api/v1/ai-prompts/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        aiUrl,
        jobPostingId: jobPosting.id,
        resumeId: Number(resumeId),
        aiPromptTemplateId: Number(templateId),
        promptDocument: {
          title: `${name} prompt`,
          type: "Markdown",
          content: aiPromptContent,
        },
        responseDocument: {
          title: `${name} response`,
          type: "Markdown",
          content: aiResponseText || "",
        },
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      const detail = errorBody || "No server details provided.";
      setStatus(`Unable to save the AI prompt. (${response.status}: ${detail})`);
      return;
    }

    await refreshSavedAiPrompts();
    setStatus("AI prompt saved.");
  }

  async function handleDeleteAiPrompt(id: number) {
    const response = await fetch(`/api/v1/ai-prompts/${id}`, { method: "DELETE" });
    if (!response.ok) {
      throw new Error((await response.text()) || "Unable to delete the saved AI prompt.");
    }
    setSavedAiPrompts((current) => current.filter((saved) => saved.id !== id));
    setStatus("Saved AI prompt deleted.");
  }

  async function saveListingRecord<T extends Entity>(endpoint: string, entity: T, records: T[], reload: () => Promise<void>) {
    const original = records.find((record) => record.id === entity.id);
    if (entity.id > 0 && !original) throw new Error("The original record is no longer available.");
    const response = await fetch(entity.id > 0 ? `${endpoint}${entity.id}` : endpoint, {
      method: entity.id > 0 ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(entity.id > 0 && original ? getPatch(original, entity) : entity),
    });
    if (!response.ok) throw new Error((await response.text()) || "Unable to save the record.");
    await reload();
  }

  function handleGeneratePrompt(): string {
    const template = templateContent || "";
    const resume = resumeContent || "";
    const description = jobPosting?.document?.content || "";

    const output = template.split("[YOUR RESUME HERE]").join(resume).split("[JOB DESCRIPTION HERE]").join(description);

    setAiPromptContent(output);
    setStatus("Prompt generated.");
    return output;
  }

  async function handleCopyPrompt(overrideContent?: string): Promise<boolean> {
    const textToCopy = overrideContent !== undefined ? overrideContent : aiPromptContent;
    if (!textToCopy) {
      setStatus("No prompt content to copy.");
      return false;
    }

    try {
      await navigator.clipboard.writeText(textToCopy);
      setStatus("Prompt copied to clipboard.");
      return true;
    } catch (error: unknown) {
      setStatus(error instanceof Error ? error.message : "Unable to copy prompt to clipboard.");
      return false;
    }
  }

  async function handleOpenAi(overrideContent?: string) {
    const prompt = overrideContent !== undefined ? overrideContent : aiPromptContent;
    let url = aiUrl.trim();
    if (!url) {
      url = "https://copilot.microsoft.com";
    } else if (!/^https?:\/\//i.test(url)) {
      url = `https://${url}`;
    }

    const copied = await handleCopyPrompt(prompt);
    window.open(url, "_blank", "noopener,noreferrer");
    setStatus(
      copied
        ? "Opened AI tab and copied prompt to clipboard. Paste it into the AI chat."
        : "Opened AI tab (prompt was not copied to clipboard).",
    );
  }

  async function handlePromptAi() {
    const generated = handleGeneratePrompt();
    await handleOpenAi(generated);
  }

  return (
    <section className="resume-analyzer" id="resume-analyzer--container">
      <h1>Resume Analyzer</h1>

      <div className="resume-analyzer-status">{status}</div>

      <details
        id="resume-analyzer--ai-prompt--container"
        className="resume-analyzer-expander ai-prompt-container"
        open={expanderState.aiPrompt}
        onToggle={(event) => setExpanderOpen("aiPrompt", event.currentTarget.open)}
      >
        <summary>AI Prompt</summary>
        <div className="resume-analyzer-body">
          <div className="resume-analyzer-actions-row">
            <button
              id="resume-analyzer--ai-prompt--prompt-ai-button"
              type="button"
              className="button button--primary"
              onClick={() => void handlePromptAi()}
            >
              Prompt AI
            </button>
            <button id="resume-analyzer--ai-prompt--generate-prompt-button" type="button" className="button" onClick={handleGeneratePrompt}>
              Generate Prompt
            </button>
            <button
              id="resume-analyzer--ai-prompt--copy-prompt-button"
              type="button"
              className="button"
              onClick={() => void handleCopyPrompt()}
            >
              Copy Prompt
            </button>
            <button id="resume-analyzer--ai-prompt--open-ai-button" type="button" className="button" onClick={() => void handleOpenAi()}>
              Open AI
            </button>
            <button
              id="resume-analyzer--ai-prompt--save-ai-prompt-button"
              type="button"
              className="button"
              onClick={() => void handleSaveAiPrompt()}
            >
              Save
            </button>
            <input
              id="resume-analyzer--ai-prompt--ai-url"
              type="url"
              value={aiUrl}
              onChange={(event) => setAiUrl(event.target.value)}
              placeholder="AI URL (e.g., https://chatgpt.com)"
              aria-label="AI URL"
            />
          </div>

          <div id="resume-analyzer--ai-prompt--editor--container" className="resume-analyzer-card">
            <input
              id="resume-analyzer--ai-prompt--editor--ai-url"
              type="url"
              value={aiUrl}
              onChange={(event) => setAiUrl(event.target.value)}
              placeholder="AI URL (e.g., https://chatgpt.com)"
              aria-label="AI URL"
            />

            <details
              id="resume-analyzer--ai-prompt--editor--prompt--container"
              className="resume-analyzer-inner-expander ai-prompt-content"
              open={expanderState.aiPromptContent}
              onToggle={(event) => setExpanderOpen("aiPromptContent", event.currentTarget.open)}
            >
              <summary>Content</summary>
              <textarea
                id="resume-analyzer--ai-prompt--editor--ai-prompt-editor"
                className="resume-analyzer-editor"
                value={aiPromptContent}
                onChange={(event) => setAiPromptContent(event.target.value)}
                placeholder="Generated prompt will appear here..."
                aria-label="AI Prompt content"
              />
            </details>

            <details
              id="resume-analyzer--ai-prompt--editor--ai-response--container"
              className="resume-analyzer-inner-expander ai-response-content"
              open={expanderState.aiResponseContent}
              onToggle={(event) => setExpanderOpen("aiResponseContent", event.currentTarget.open)}
            >
              <summary>AI Response</summary>
              <textarea
                id="resume-analyzer--ai-prompt--editor--ai-response--editor"
                className="resume-analyzer-editor"
                value={aiResponseText}
                onChange={(event) => setAiResponseText(event.target.value)}
                placeholder="Captured AI response will appear here..."
                aria-label="AI Response content"
              />
            </details>
          </div>

          <EntitySection<AiPrompt>
            id="resume-analyzer--ai-prompt--saved-ai-prompts--container"
            title="Saved AI Prompts"
            className="saved-ai-prompts"
            data={savedAiPrompts}
            ListItemUi={AiPromptUi}
            itemPropName="prompt"
            isLoading={promptsLoading}
            emptyListMessage="No saved AI prompts yet."
            open={expanderState.savedAiPrompts}
            onExpanded={() => setExpanderOpen("savedAiPrompts", true)}
            onCollapsed={() => setExpanderOpen("savedAiPrompts", false)}
            expandedRecords={expanderState.savedAiPromptCards}
            onRecordExpansionChange={(id, open) => setExpanderState((current) => ({ ...current, savedAiPromptCards: { ...current.savedAiPromptCards, [id]: open } }))}
            reloadData={refreshSavedAiPrompts}
            onCreateRecord={() => setSavedAiPrompts((current) => [{ id: 0, name: "", aiName: "", aiUrl: "", jobPostingId: jobPosting?.id ?? 0, resumeId: Number(resumeId), aiPromptTemplateId: Number(templateId), promptDocument: { title: "Prompt", type: "Markdown", content: "" }, responseDocument: { title: "Response", type: "Markdown", content: "" } } as AiPrompt, ...current])}
            onRemoveRecord={(id) => setSavedAiPrompts((current) => current.filter((prompt) => prompt.id !== id))}
            onSave={async ({ entity }) => saveListingRecord("/api/v1/ai-prompts/", entity, savedAiPrompts, refreshSavedAiPrompts)}
            onDelete={async ({ id }) => handleDeleteAiPrompt(id)}
            deletionErrors={promptDeletionErrors}
            setDeletionError={setPromptDeletionError}
            clearDeletionError={clearPromptDeletionError}
            renderRecordChildren={(prompt) => <div className="value match-percent">Response: {extractMatchPercent(prompt.responseDocument?.content)}</div>}
            renderRecordActions={(prompt) => <button id={`resume-analyzer--saved-ai-prompt--load-button--${prompt.id}`} type="button" className="button" onClick={(event) => {
              event.stopPropagation();
              setAiPromptContent(prompt.promptDocument?.content ?? "");
              setAiResponseText(prompt.responseDocument?.content ?? "");
              setAiUrl(prompt.aiUrl);
              setStatus(`Loaded AI prompt: ${prompt.name}`);
            }}>Load</button>}
          />
        </div>
      </details>

      <details
        id="resume-analyzer--job-description--container"
        className="resume-analyzer-expander"
        open={expanderState.jobDescription}
        onToggle={(event) => setExpanderOpen("jobDescription", event.currentTarget.open)}
      >
        <summary>
          Job Description
          {!expanderState.jobDescription && jobPosting && (
            <>: {[jobPosting.company, jobPosting.title, jobPosting.salary, jobPosting.url].filter(Boolean).join(" ")}</>
          )}
        </summary>
        <div className="resume-analyzer-body">
          <div className="resume-analyzer-actions-row">
            <input type="text" value={jobPosting?.url ?? ""} readOnly placeholder="File path..." />
          </div>

          <details
            id="resume-analyzer--job-description--content--container"
            className="resume-analyzer-inner-expander"
            open={expanderState.jobDescriptionContent}
            onToggle={(event) => setExpanderOpen("jobDescriptionContent", event.currentTarget.open)}
          >
            <summary>Content</summary>
            <textarea
              id="resume-analyzer--job-description--content--editor"
              className="resume-analyzer-editor"
              readOnly
              value={jobPosting?.document?.content || "Select a saved job posting to load its job description."}
            />
          </details>
        </div>
      </details>

      <details
        id="resume-analyzer--resume--container"
        className="resume-analyzer-expander"
        open={expanderState.resume}
        onToggle={(event) => setExpanderOpen("resume", event.currentTarget.open)}
      >
        <summary>
          Resume
          {!expanderState.resume && resumeName.trim() && (
            <>
              : {resumeName.trim()}
              {resumeDate ? ` (${resumeDate})` : ""}
            </>
          )}
        </summary>
        <div className="resume-analyzer-body">
          <div id="resume-analyzer--resume--editor" className="resume-analyzer-card">
            <div className="resume-analyzer-resume-primary-row">
              <input
                id="resume-analyzer--resume--editor--name"
                type="text"
                value={resumeName}
                onChange={(event) => setResumeName(event.target.value)}
                placeholder="Resume name..."
                aria-label="Resume name"
              />
              <input
                id="resume-analyzer--resume--editor--job-title"
                type="text"
                value={resumeJobTitle}
                onChange={(event) => setResumeJobTitle(event.target.value)}
                placeholder="Job title..."
                aria-label="Resume job title"
              />
            </div>

            <div className="resume-analyzer-actions-row">
              <input
                id="resume-analyzer--resume--editor--date"
                type="date"
                value={resumeDate}
                onChange={(event) => setResumeDate(event.target.value)}
                aria-label="Resume date"
              />
              <input
                id="resume-analyzer--resume--editor--id"
                type="number"
                min="0"
                value={resumeId}
                placeholder="Resume ID..."
                aria-label="Resume ID"
                readOnly
              />
              <select
                id="resume-analyzer--resume--editor--document-type"
                value={resumeDocumentType}
                onChange={(event) => setResumeDocumentType(event.target.value)}
                aria-label="Resume document type"
              >
                <option value="">Auto-detect type</option>
                {DOCUMENT_TYPE_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
              <button
                id="resume-analyzer--resume--editor--save-button"
                type="button"
                className="button"
                onClick={() => void handleSaveResume()}
              >
                Save
              </button>
              <button
                id="resume-analyzer--resume--editor--new-button"
                type="button"
                className="button"
                onClick={() => {
                  setResumeId("");
                  setResumeName("");
                  setResumeJobTitle("");
                  setResumeDate("");
                  setResumeDocumentId("");
                  setResumeDocumentType("");
                  setResumeContent("");
                }}
              >
                New
              </button>
            </div>

            <details
              id="resume-analyzer--resume--editor--content--container"
              className="resume-analyzer-inner-expander"
              open={expanderState.resumeContent}
              onToggle={(event) => setExpanderOpen("resumeContent", event.currentTarget.open)}
            >
              <summary>Content</summary>
              <textarea
                id="resume-analyzer--resume--editor--content--editor"
                className="resume-analyzer-editor"
                value={resumeContent}
                onChange={(event) => setResumeContent(event.target.value)}
                placeholder="Edit resume content..."
                aria-label="Resume content"
              />
            </details>
          </div>

          <EntitySection<Resume>
            id="resume-analyzer--saved-resumes--container"
            title="Saved Resumes"
            className="saved-resumes"
            data={savedResumes}
            ListItemUi={ResumeUi}
            itemPropName="resume"
            isLoading={resumesLoading}
            emptyListMessage="No saved resumes yet."
            open={expanderState.savedResumes}
            onExpanded={() => setExpanderOpen("savedResumes", true)}
            onCollapsed={() => setExpanderOpen("savedResumes", false)}
            expandedRecords={expanderState.savedResumeCards}
            onRecordExpansionChange={(id, open) => setExpanderState((current) => ({ ...current, savedResumeCards: { ...current.savedResumeCards, [id]: open } }))}
            reloadData={refreshSavedResumes}
            onCreateRecord={() => setSavedResumes((current) => [{ id: 0, name: "", jobTitle: "", date: "", document: { title: "", type: "Markdown", content: "" } } as Resume, ...current])}
            onRemoveRecord={(id) => setSavedResumes((current) => current.filter((resume) => resume.id !== id))}
            onSave={async ({ entity }) => saveListingRecord("/api/v1/resumes/", entity, savedResumes, refreshSavedResumes)}
            onDelete={async ({ id }) => handleDeleteResume(id)}
            deletionErrors={resumeDeletionErrors}
            setDeletionError={setResumeDeletionError}
            clearDeletionError={clearResumeDeletionError}
            renderRecordActions={(resume) => <button type="button" className="button" onClick={(event) => {
              event.stopPropagation();
              setResumeId(String(resume.id));
              setResumeName(resume.name);
              setResumeJobTitle(resume.jobTitle);
              setResumeDate(toDateInputValue(resume.date));
              setResumeDocumentId(String(resume.documentId));
              setResumeDocumentType(resume.document?.type ?? "");
              setResumeContent(resume.document?.content ?? "");
              setStatus(`Loaded resume: ${resume.name}`);
            }}>Load</button>}
          />
        </div>
      </details>

      <details
        id="resume-analyzer--prompt-template--container"
        className="resume-analyzer-expander"
        open={expanderState.promptTemplate}
        onToggle={(event) => setExpanderOpen("promptTemplate", event.currentTarget.open)}
      >
        <summary>
          AI Prompt Template
          {!expanderState.promptTemplate && templateName.trim() && <>: {templateName.trim()}</>}
        </summary>
        <div className="resume-analyzer-body">
          <div id="resume-analyzer--prompt-template--editor" className="resume-analyzer-card">
            <div className="resume-analyzer-actions-row">
              <input
                id="resume-analyzer--prompt-template--editor--name"
                type="text"
                value={templateName}
                onChange={(event) => setTemplateName(event.target.value)}
                placeholder="Template name..."
                aria-label="Template name"
              />
              <button
                id="resume-analyzer--prompt-template--editor--save-button"
                type="button"
                className="button"
                onClick={() => void handleSaveTemplate()}
              >
                Save
              </button>
              <button
                id="resume-analyzer--prompt-template--editor--new-button"
                type="button"
                className="button"
                onClick={() => {
                  setTemplateId("");
                  setTemplateName("");
                  setTemplateContent("");
                }}
              >
                New
              </button>
            </div>

            <details
              id="resume-analyzer--prompt-template--editor--content--container"
              className="resume-analyzer-inner-expander"
              open={expanderState.promptTemplateContent}
              onToggle={(event) => setExpanderOpen("promptTemplateContent", event.currentTarget.open)}
            >
              <summary>Content</summary>
              <textarea
                id="resume-analyzer--prompt-template--editor--content--editor"
                className="resume-analyzer-editor"
                value={templateContent}
                onChange={(event) => setTemplateContent(event.target.value)}
                placeholder="Prompt template content..."
              />
            </details>
          </div>

          <EntitySection<AiPromptTemplate>
            id="resume-analyzer--saved-prompt-templates--container"
            title="Saved Templates"
            className="saved-templates"
            data={savedTemplates}
            ListItemUi={AiPromptTemplateUi}
            itemPropName="template"
            isLoading={templatesLoading}
            emptyListMessage="No saved prompt templates yet."
            open={expanderState.savedTemplates}
            onExpanded={() => setExpanderOpen("savedTemplates", true)}
            onCollapsed={() => setExpanderOpen("savedTemplates", false)}
            expandedRecords={expanderState.savedTemplateCards}
            onRecordExpansionChange={(id, open) => setExpanderState((current) => ({ ...current, savedTemplateCards: { ...current.savedTemplateCards, [id]: open } }))}
            reloadData={refreshSavedTemplates}
            onCreateRecord={() => setSavedTemplates((current) => [{ id: 0, name: "", document: { title: "", type: "Markdown", content: "" } } as AiPromptTemplate, ...current])}
            onRemoveRecord={(id) => setSavedTemplates((current) => current.filter((template) => template.id !== id))}
            onSave={async ({ entity }) => saveListingRecord("/api/v1/ai-prompt-templates/", entity, savedTemplates, refreshSavedTemplates)}
            onDelete={async ({ id }) => handleDeleteTemplate(id)}
            deletionErrors={templateDeletionErrors}
            setDeletionError={setTemplateDeletionError}
            clearDeletionError={clearTemplateDeletionError}
            renderRecordActions={(template) => <button type="button" className="button" onClick={(event) => {
              event.stopPropagation();
              setTemplateId(String(template.id));
              setTemplateName(template.name);
              setTemplateContent(template.document?.content ?? "");
              setStatus(`Loaded template: ${template.name}`);
            }}>Load</button>}
          />
        </div>
      </details>
    </section>
  );
}
