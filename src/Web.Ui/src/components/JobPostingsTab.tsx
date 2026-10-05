import { useEffect, useMemo, useState } from "react";
import { onAutoCaptureTrigger, requestCaptureByUrlFromExtension, requestOpenUrlFromExtension } from "../extensionBridge";
import { api } from "../utilities/api";
import { useSimpleDialogErrors } from "../utilities/componentState";
import { getPatch } from "../utilities/entities";
import type { NewDocument } from "./Document";
import { EntitySection } from "./EntitySection";
import { JobPostingUi, type JobPosting, type NewJobPosting } from "./JobPosting";

const jobPostUrlStorageKey = "job-post-url";
const jobPostHideImagesStorageKey = "job-post-hide-images";
const jobPostHideButtonsStorageKey = "job-post-hide-buttons";
const jobPostCaptureOpenStorageKey = "job-post-capture-open";
const jobPostSavedOpenStorageKey = "job-post-saved-open";
const jobPostPageOpenStorageKey = "job-post-page-open";
const jobPostFormattedOpenStorageKey = "job-post-formatted-open";
const jobPostMarkdownOpenStorageKey = "job-post-markdown-open";

type WorkModel = "Unknown" | "Remote" | "InOffice" | "Hybrid";

type CapturedSnapshot = {
  title?: string;
  url?: string;
  html?: string;
  text?: string;
};

type ExtractedJobPosting = {
  source: string;
  title: string;
  company: string;
  location: string;
  salary: string;
  workModel: WorkModel;
  formattedHtml: string;
  markdown: string;
  fileName: string;
};

function escapeHtml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}

function buildSrcDoc(title: string, url: string, html: string, text: string) {
  if (html) {
    const baseTag = `<base href="${escapeHtml(url)}" />`;

    if (html.includes("<head")) {
      return html.replace(/<head([^>]*)>/i, `<head$1>${baseTag}`);
    }

    return `<!doctype html>
<html>
  <head>
    ${baseTag}
  </head>
  <body>${html}</body>
</html>`;
  }

  return `<!doctype html>
<html>
  <head>
    <base href="${escapeHtml(url)}" />
    <meta charset="utf-8" />
    <title>${escapeHtml(title)}</title>
    <style>
      :root { color-scheme: light dark; }
      html, body { background: transparent; color: inherit; margin: 0; padding: 0; }
    </style>
  </head>
  <body>
    <pre style="white-space: pre-wrap; font: 14px/1.4 system-ui, sans-serif; padding: 1rem; margin: 0;">${escapeHtml(text)}</pre>
  </body>
</html>`;
}

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function firstNonEmpty(...values: Array<string | null | undefined>) {
  return values.map((value) => value?.trim()).find((value) => Boolean(value)) ?? "";
}

function getLocalDateToken(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}${month}${day}`;
}

function sanitizeFileName(value: string) {
  return normalizeWhitespace(value).replace(/[\\/:*?"<>|]/g, "-");
}

function extractTextLines(element: Element | null) {
  return (element?.textContent ?? "")
    .split(/\r?\n/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function removeMatchingElements(root: Element, patterns: RegExp[]) {
  const candidates = Array.from(root.querySelectorAll("*")).reverse();

  for (const element of candidates) {
    const text = normalizeWhitespace(element.textContent ?? "");
    if (text && patterns.some((pattern) => pattern.test(text))) {
      element.remove();
    }
  }
}

function extractSalaryText(...candidates: Array<string | null | undefined>) {
  for (const candidate of candidates) {
    const text = normalizeWhitespace(candidate ?? "");
    const match = text.match(/\$[\d,]+(?:\.\d+)?(?:\s*(?:-|to)\s*\$?[\d,]+(?:\.\d+)?)?(?:\s*(?:a year|per year|\/year|yr|year))?/i);

    if (match) {
      return match[0].replace(/\s+/g, " ").trim();
    }
  }

  return "";
}

function inferWorkModel(location: string, text: string): WorkModel {
  const combined = `${location} ${text}`.toLowerCase();

  if (/\bhybrid\b|mixed|split time|split between remote and office/.test(combined)) {
    return "Hybrid";
  }

  if (/\bremote\b|wfh|work from home|fully remote/.test(combined)) {
    return "Remote";
  }

  if (/\bin[- ]?office\b|\bonsite\b|\bon[- ]?site\b|\boffice\b/.test(combined)) {
    return "InOffice";
  }

  return combined.trim() ? "InOffice" : "Unknown";
}

function formatWorkModelLabel(workModel: WorkModel) {
  switch (workModel) {
    case "Remote":
      return "Remote";
    case "InOffice":
      return "In Office";
    case "Hybrid":
      return "Hybrid";
    default:
      return "Unknown";
  }
}

async function fetchSavedJobPostings() {
  const response = await fetch("/api/v1/job-postings" + "?deep=true");

  if (!response.ok) {
    throw new Error((await response.text()) || "Unable to load saved job postings.");
  }

  return (await response.json()) as JobPosting[];
}

/** Convert a DOM element's content to Markdown (headings, lists, paragraphs). */
function elementToMarkdown(el: Element | null): string {
  if (!el) return "";

  function nodeToMd(node: Node, depth = 0): string {
    if (node.nodeType === Node.TEXT_NODE) {
      return node.textContent ?? "";
    }

    if (node.nodeType !== Node.ELEMENT_NODE) return "";

    const element = node as Element;
    const tag = element.tagName.toLowerCase();
    const children = Array.from(element.childNodes)
      .map((c) => nodeToMd(c, depth))
      .join("");
    const trimmed = children.trim();

    switch (tag) {
      case "h1":
        return `\n# ${trimmed}\n`;
      case "h2":
        return `\n## ${trimmed}\n`;
      case "h3":
        return `\n### ${trimmed}\n`;
      case "h4":
        return `\n#### ${trimmed}\n`;
      case "h5":
        return `\n##### ${trimmed}\n`;
      case "h6":
        return `\n###### ${trimmed}\n`;
      case "p":
        return trimmed ? `\n${trimmed}\n` : "";
      case "br":
        return "\n";
      case "li":
        return `\n- ${trimmed}`;
      case "ul":
      case "ol":
        return `\n${trimmed}\n`;
      case "strong":
      case "b":
        return trimmed ? `**${trimmed}**` : "";
      case "em":
      case "i":
        return trimmed ? `_${trimmed}_` : "";
      case "a": {
        const href = element.getAttribute("href");
        return href ? `[${trimmed}](${href})` : trimmed;
      }
      case "script":
      case "style":
      case "noscript":
        return "";
      default:
        return children;
    }
  }

  return nodeToMd(el)
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function buildMarkdown(job: ExtractedJobPosting) {
  return `# ${job.title}

- Title: ${job.title}
- Company: ${job.company}
- Location: ${job.location}
- Salary: ${job.salary || "Unknown Salary"}
- Work Model: ${formatWorkModelLabel(job.workModel)}
- Source: ${job.source}
- Captured: ${getLocalDateToken()}

## Job Description

${job.markdown}`;
}

function extractIndeedJobPosting(snapshot: CapturedSnapshot): ExtractedJobPosting | null {
  if (!snapshot.html) {
    return null;
  }

  const doc = new DOMParser().parseFromString(snapshot.html, "text/html");
  const root = doc.querySelector(".jobsearch-JobComponent") ?? doc.body;
  const header = root.querySelector(".jobsearch-InfoHeaderContainer") ?? root;
  const body = root.querySelector(".jobsearch-BodyContainer") ?? root.querySelector(".jobsearch-JobComponent-description") ?? root;
  const description = root.querySelector(".jobsearch-JobComponent-description") ?? body;

  const title = firstNonEmpty(
    header.querySelector("h1")?.textContent,
    header.querySelector("h2")?.textContent,
    extractTextLines(header)[0],
    snapshot.title,
  );

  const headerLines = extractTextLines(header);

  const company = firstNonEmpty(
    header.querySelector('[data-testid*="company"]')?.textContent,
    header.querySelector("a")?.textContent,
    headerLines[1],
    "Unknown Company",
  );

  const location = firstNonEmpty(
    header.querySelector('[data-testid*="job-location"]')?.textContent,
    header.querySelector('[data-testid*="location"]')?.textContent,
    headerLines[2],
    "Unknown Location",
  );

  const salary = firstNonEmpty(
    extractSalaryText(
      header.querySelector('[data-testid*="salary"]')?.textContent,
      body.querySelector('[data-testid*="salary"]')?.textContent,
      header.textContent,
      body.textContent,
      snapshot.text,
    ),
    "Unknown Salary",
  );

  removeMatchingElements(root, [/^\d[\d,]*\s+reviews$/i, /^read what people are saying about working here\.?$/i]);

  const descriptionMarkdown = elementToMarkdown(description);
  const descriptionText =
    descriptionMarkdown ||
    normalizeWhitespace((description as HTMLElement | null)?.innerText ?? description?.textContent ?? snapshot.text ?? "");
  const workModel = inferWorkModel(location, `${location} ${descriptionText}`);
  const fileWorkMode = workModel.toLowerCase();
  const fileName = `${sanitizeFileName(company)} - ${sanitizeFileName(title)} - ${getLocalDateToken()} - ${fileWorkMode}.md`;

  return {
    title,
    company,
    location,
    salary,
    url: snapshot.url ?? "",
    workModel,
    source: snapshot.url ?? "",
    fileName,
    formattedHtml: root.outerHTML,
    markdown: descriptionText || "No job description found.",
  } as ExtractedJobPosting;
}

function extractGenericJobPosting(snapshot: CapturedSnapshot): ExtractedJobPosting {
  const title = firstNonEmpty(snapshot.title, "Job Posting");
  const descriptionText = normalizeWhitespace(snapshot.text ?? "");
  const workModel = inferWorkModel("Unknown Location", descriptionText);
  const fileWorkMode = workModel.toLowerCase();
  const fileName = `${sanitizeFileName("Unknown Company")} - ${sanitizeFileName(title)} - ${getLocalDateToken()} - ${fileWorkMode}.md`;

  return {
    source: snapshot.url ?? "",
    company: "Unknown Company",
    title,
    location: "Unknown Location",
    salary: "Unknown Salary",
    workModel,
    fileName,
    formattedHtml: snapshot.html ?? "",
    markdown: descriptionText || "No job description found.",
  };
}

function extractJobPosting(snapshot: CapturedSnapshot): ExtractedJobPosting {
  try {
    const hostname = new URL(snapshot.url ?? "").hostname.toLowerCase();
    if (hostname.includes("indeed.")) {
      return extractIndeedJobPosting(snapshot) ?? extractGenericJobPosting(snapshot);
    }
  } catch {
    // Fall back to generic extraction.
  }

  return extractGenericJobPosting(snapshot);
}

type JobPostingsTabProps = {};

export function JobPostingsTab({}: JobPostingsTabProps) {
  const [urlInput, setUrlInput] = useState(() => {
    return window.localStorage.getItem(jobPostUrlStorageKey) ?? "";
  });
  const [pageSnapshot, setPageSnapshot] = useState<CapturedSnapshot | null>(null);
  const [formattedHtml, setFormattedHtml] = useState("");
  const [markdownContent, setMarkdownContent] = useState("");
  const [capturedJobPosting, setCapturedJobPosting] = useState<ExtractedJobPosting | null>(null);
  const [savedJobPostings, setSavedJobPostings] = useState<JobPosting[]>([]);
  const [savedCardOpenState, setSavedCardOpenState] = useState<Record<number, boolean>>({});
  const [hideImages, setHideImages] = useState(() => {
    return window.localStorage.getItem(jobPostHideImagesStorageKey) === "true";
  });
  const [hideButtons, setHideButtons] = useState(() => {
    return window.localStorage.getItem(jobPostHideButtonsStorageKey) === "true";
  });
  const [captureOpen, setCaptureOpen] = useState(() => {
    const stored = window.localStorage.getItem(jobPostCaptureOpenStorageKey);
    return stored == null ? true : stored === "true";
  });
  const [savedOpen, setSavedOpen] = useState(() => {
    const stored = window.localStorage.getItem(jobPostSavedOpenStorageKey);
    return stored == null ? false : stored === "true";
  });
  const [jobPostPageOpen, setJobPostPageOpen] = useState(() => {
    const stored = window.localStorage.getItem(jobPostPageOpenStorageKey);
    return stored == null ? true : stored === "true";
  });
  const [formattedOpen, setFormattedOpen] = useState(() => {
    const stored = window.localStorage.getItem(jobPostFormattedOpenStorageKey);
    return stored == null ? false : stored === "true";
  });
  const [markdownOpen, setMarkdownOpen] = useState(() => {
    const stored = window.localStorage.getItem(jobPostMarkdownOpenStorageKey);
    return stored == null ? false : stored === "true";
  });
  const [status, setStatus] = useState("Enter a posting URL and click go.");

  const [deletionErrors, setDeletionError, clearDeletionError] = useSimpleDialogErrors();

  const refreshSavedJobPostings = async (announce = false) => {
    try {
      setSavedJobPostings(await fetchSavedJobPostings());
      if (announce) {
        setStatus("Saved job postings refreshed.");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to load saved job postings.";
      if (announce) {
        setStatus(`Unable to refresh saved job postings. (${message})`);
      }
    }
  };

  useEffect(() => {
    window.localStorage.setItem(jobPostUrlStorageKey, urlInput);
  }, [urlInput]);

  useEffect(() => {
    window.localStorage.setItem(jobPostHideImagesStorageKey, String(hideImages));
  }, [hideImages]);

  useEffect(() => {
    window.localStorage.setItem(jobPostHideButtonsStorageKey, String(hideButtons));
  }, [hideButtons]);

  useEffect(() => {
    window.localStorage.setItem(jobPostCaptureOpenStorageKey, String(captureOpen));
  }, [captureOpen]);

  useEffect(() => {
    window.localStorage.setItem(jobPostSavedOpenStorageKey, String(savedOpen));
  }, [savedOpen]);

  useEffect(() => {
    window.localStorage.setItem(jobPostPageOpenStorageKey, String(jobPostPageOpen));
  }, [jobPostPageOpen]);

  useEffect(() => {
    window.localStorage.setItem(jobPostFormattedOpenStorageKey, String(formattedOpen));
  }, [formattedOpen]);

  useEffect(() => {
    window.localStorage.setItem(jobPostMarkdownOpenStorageKey, String(markdownOpen));
  }, [markdownOpen]);

  useEffect(() => {
    void refreshSavedJobPostings(false);
  }, []);

  const srcDoc = useMemo(() => {
    if (!pageSnapshot) {
      return "<!doctype html><html><head><style>:root { color-scheme: light dark; } html, body { background: transparent; color: inherit; margin: 0; padding: 0; }</style></head><body></body></html>";
    }

    return buildSrcDoc(
      pageSnapshot.title ?? "Job Post Page",
      pageSnapshot.url ?? urlInput,
      pageSnapshot.html ?? "",
      pageSnapshot.text ?? "",
    );
  }, [pageSnapshot, urlInput]);

  const handleGo = async () => {
    const nextUrl = urlInput.trim();
    setUrlInput(nextUrl);

    if (!nextUrl) {
      setStatus("Enter a valid URL first.");
      return;
    }

    setStatus("Opening the page in a visible tab...");

    try {
      const response = await requestOpenUrlFromExtension(nextUrl);
      setPageSnapshot(null);
      setCapturedJobPosting(null);
      setFormattedHtml("");
      setMarkdownContent("");
      setStatus(`Opened ${response.snapshot?.url ?? nextUrl}. Use capture after you finish with the page.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to open the page.");
    }
  };

  const handleCapture = async () => {
    const targetUrl = urlInput.trim();

    if (!targetUrl) {
      setStatus("Enter a posting URL first.");
      return;
    }

    setStatus(`Looking for an open tab matching ${targetUrl}...`);

    try {
      const response = await requestCaptureByUrlFromExtension<{
        title?: string;
        url?: string;
        html?: string;
        text?: string;
      }>(targetUrl);
      const snapshot = response.snapshot ?? null;
      setPageSnapshot(snapshot);

      if (!snapshot) {
        setStatus("No page snapshot was returned.");
        return;
      }

      const jobPosting = extractJobPosting(snapshot);
      const markdown = buildMarkdown(jobPosting);
      setCapturedJobPosting(jobPosting);
      setFormattedHtml(jobPosting.formattedHtml);
      setMarkdownContent(markdown);
      setStatus(`Captured ${jobPosting.title}.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to capture the page.");
    }
  };

  useEffect(() => {
    return onAutoCaptureTrigger(() => {
      void handleCapture();
    });
  });

  const handleSave = () => {
    if (!capturedJobPosting || !markdownContent) {
      setStatus("Capture a job posting before saving.");
      return;
    }

    void (async () => {
      const data = convertToNewJobPosting(capturedJobPosting, markdownContent);
      await saveJobPosting({ posting: data as JobPosting });
    })().catch((error) => {
      setStatus(error instanceof Error ? error.message : "Unable to save the job posting.");
    });
  };

  return (
    <section id="job-postings--container" className="job-postings">
      <h1>Job Postings</h1>

      <details
        id="job-postings--capture--container"
        className="job-postings-expander"
        open={captureOpen}
        onToggle={(event) => setCaptureOpen(event.currentTarget.open)}
      >
        <summary>Capture</summary>
        <div className="job-postings-field">
          <label htmlFor="job-postings--capture--url">Posting URL</label>
          <div className="job-postings-input-row">
            <input
              id="job-postings--capture--url"
              type="url"
              value={urlInput}
              onChange={(event) => setUrlInput(event.target.value)}
              placeholder="https://example.com/job-posting"
            />
            <button id="job-postings--capture--go-button" className="button button--primary" type="button" onClick={handleGo}>
              Go
            </button>
            <button id="job-postings--capture--capture-button" className="button" type="button" onClick={handleCapture}>
              Capture
            </button>
            <button id="job-postings--capture--save-button" className="button" type="button" onClick={handleSave}>
              Save
            </button>
          </div>
        </div>

        <p className="job-postings-status">{status}</p>

        <details
          id="job-postings--job-post-page--container"
          className="job-postings-expander"
          open={jobPostPageOpen}
          onToggle={(event) => setJobPostPageOpen(event.currentTarget.open)}
        >
          <summary>Job Post Page</summary>
          <div className="job-postings-frame-wrap">
            <iframe
              id="job-postings--job-post-page--content"
              className="job-postings-frame"
              srcDoc={srcDoc}
              title="Job Post Page"
              sandbox=""
            />
          </div>
        </details>

        <details
          id="job-postings--formatted-content--container"
          className="job-postings-expander"
          open={formattedOpen}
          onToggle={(event) => setFormattedOpen(event.currentTarget.open)}
        >
          <summary>Formatted Content</summary>
          <div className="job-postings-toggle-row">
            <label className="job-postings-checkbox-label">
              <input
                id="job-postings--formatted-content--remove-images-toggle"
                type="checkbox"
                checked={hideImages}
                onChange={(e) => setHideImages(e.target.checked)}
              />
              Remove images
            </label>
            <label className="job-postings-checkbox-label">
              <input
                id="job-postings--formatted-content--remove-buttons-toggle"
                type="checkbox"
                checked={hideButtons}
                onChange={(e) => setHideButtons(e.target.checked)}
              />
              Remove buttons
            </label>
          </div>
          <div
            id="job-postings--formatted-content--display"
            className={`job-postings-formatted${
              hideImages ? " job-postings-formatted--no-images" : ""
            }${hideButtons ? " job-postings-formatted--no-buttons" : ""}`}
            dangerouslySetInnerHTML={{
              __html: formattedHtml || '<p style="color:#888">Capture a job posting to see formatted content here.</p>',
            }}
          />
        </details>

        <details
          id="job-postings--markdown-content--container"
          className="job-postings-expander"
          open={markdownOpen}
          onToggle={(event) => setMarkdownOpen(event.currentTarget.open)}
        >
          <summary>Markdown Content</summary>
          <textarea
            id="job-postings--markdown-content--editor"
            className="job-postings-markdown"
            readOnly
            value={markdownContent || "Capture a job posting to see markdown content here."}
          />
        </details>
      </details>

      <SavedJobPostings
        open={savedOpen}
        onExpanded={() => setSavedOpen(true)}
        onCollapsed={() => setSavedOpen(false)}
        data={savedJobPostings as JobPosting[]}
        reloadData={async () => await refreshSavedJobPostings(true)}
        onCreateRecord={createNewJobPosting}
        onRemoveRecord={onRemoveJobPostingFromDisplay}
        onSave={saveJobPosting}
        onDelete={deleteJobPosting}
        deletionErrors={deletionErrors}
        setDeletionError={setDeletionError}
        clearDeletionError={clearDeletionError}
      />
    </section>
  );

  function convertToNewJobPosting(captured: ExtractedJobPosting, markdownContent: string) {
    const data = {
      title: captured.title,
      company: captured.company,
      location: captured.location,
      salary: captured.salary,
      url: captured.source,
      workModel: captured.workModel,
      document: {
        title: captured.title,
        type: "Markdown",
        content: markdownContent,
        source: captured.source,
      } as NewDocument,
    } as NewJobPosting;
    return data;
  }

  async function createNewJobPosting() {
    setSavedJobPostings((prev) => [{ id: 0 } as JobPosting, ...prev]);
  }

  async function onRemoveJobPostingFromDisplay(id: number) {
    setSavedJobPostings((prev) => prev.filter((item) => item.id !== id));
  }

  async function saveJobPosting({ posting, shouldPropagateError }: { posting: JobPosting; shouldPropagateError?: boolean }) {
    try {
      const saved = posting.id ? await updateJobPosting(posting) : await createJobPosting(posting);

      setSavedJobPostings(await fetchSavedJobPostings());
      setStatus(`Saved ${saved.title} (${saved.company || "Unknown company"}).`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to save the job posting.");
      if (shouldPropagateError) {
        throw error;
      }
    }
  }

  async function createJobPosting(posting: JobPosting) {
    return await api.post<JobPosting>({
      endpoint: "/api/v1/job-postings",
      data: posting,
      defaultErrorMessage: "Unable to save the job posting.",
    });
  }

  async function updateJobPosting(updated: JobPosting) {
    const original = savedJobPostings.find((item) => item.id === updated.id);
    if (!original) {
      throw new Error(`Failed to save job posting. No matching original job posting [${updated.id}] found.`);
    }

    return await api.patch<JobPosting>({
      endpoint: "/api/v1/job-postings",
      id: updated.id,
      data: getPatch(original, updated),
      defaultErrorMessage: `Unable to update saved job posting [${updated.id}].`,
    });
  }

  async function deleteJobPosting({ id, shouldPropagateError }: { id: number; shouldPropagateError?: boolean }) {
    try {
      await api.delete({ endpoint: `/api/v1/job-postings`, id, defaultErrorMessage: `Unable to delete saved job posting [${id}].` });
      setSavedJobPostings((current) => current.filter((posting) => posting.id !== id));
      setSavedCardOpenState((current) => {
        const next = { ...current };
        delete next[id];
        return next;
      });
      setStatus("Job posting deleted.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : `Unable to delete saved job posting [${id}].`);
      if (shouldPropagateError) {
        throw error;
      }
    }
  }
}

function SavedJobPostings({
  open,
  onExpanded,
  onCollapsed,
  data,
  reloadData,
  onCreateRecord,
  onRemoveRecord,
  onSave,

  onDelete,
  deletionErrors,
  setDeletionError,
  clearDeletionError,
}: {
  open: boolean;
  onExpanded: () => void;
  onCollapsed: () => void;
  data: JobPosting[];
  reloadData: () => Promise<void>;
  onCreateRecord: () => void;
  onRemoveRecord: (id: number) => void;
  onSave: (params: { posting: JobPosting; shouldPropagateError?: boolean }) => Promise<void>;

  onDelete: (params: { id: number; shouldPropagateError?: boolean }) => Promise<void>;
  deletionErrors: Record<number, string>;
  setDeletionError: (itemId: number, error: string) => void;
  clearDeletionError: (itemId: number) => void;
}) {
  const [isLoading, setIsLoading] = useState(false);

  return (
    <EntitySection<JobPosting>
      id="job-postings--saved-job-postings--container"
      title="Saved Job Postings"
      className="job-postings-expander job-postings-list"
      open={open}
      onExpanded={onExpanded}
      onCollapsed={onCollapsed}
      data={data}
      isLoading={isLoading}
      reloadData={reloadData}
      onCreateRecord={onCreateRecord}
      onRemoveRecord={onRemoveRecord}
      onSave={async ({ entity }) => await onSave({ posting: entity, shouldPropagateError: true })}
      ListItemUi={JobPostingUi}
      itemPropName="posting"
      onDelete={({ id }) => onDelete({ id, shouldPropagateError: true })}
      deletionErrors={deletionErrors}
      setDeletionError={setDeletionError}
      clearDeletionError={clearDeletionError}
      // itemPropName="jobPosting"
    />
  );
}
