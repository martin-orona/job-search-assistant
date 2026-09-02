import { useEffect, useMemo, useState } from 'react'
import {
  onAutoCaptureTrigger,
  requestCaptureByUrlFromExtension,
  requestOpenUrlFromExtension,
} from '../extensionBridge'

const jobPostUrlStorageKey = 'job-post-url'
const jobPostHideImagesStorageKey = 'job-post-hide-images'
const jobPostHideButtonsStorageKey = 'job-post-hide-buttons'
const jobPostCaptureOpenStorageKey = 'job-post-capture-open'
const jobPostSavedOpenStorageKey = 'job-post-saved-open'
const jobPostPageOpenStorageKey = 'job-post-page-open'
const jobPostFormattedOpenStorageKey = 'job-post-formatted-open'
const jobPostMarkdownOpenStorageKey = 'job-post-markdown-open'

type WorkModel = 'Unknown' | 'Remote' | 'InOffice' | 'Hybrid'

type CapturedSnapshot = {
  title?: string
  url?: string
  html?: string
  text?: string
}

type ExtractedJobPosting = {
  source: string
  title: string
  company: string
  location: string
  salary: string
  workModel: WorkModel
  formattedHtml: string
  markdown: string
  fileName: string
}

type SaveJobPostingRequest = {
  title: string
  company: string
  location: string
  salary: string
  workModel: WorkModel
  source: string
  markdown: string
}

type SaveJobPostingResponse = {
  document: {
    id: number
    title: string
  }
  jobPosting: {
    id: number
    title: string
  }
}

type SavedJobPostingSummary = {
  id: number
  title: string
  company: string
  location: string
  salary: string
  workModel: WorkModel
  url: string
  documentId: number
  createdAt: string
  document?: {
    id: number
    title: string
    type: string
    content: string
    source: string | null
  } | null
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function buildSrcDoc(title: string, url: string, html: string, text: string) {
  if (html) {
    const baseTag = `<base href="${escapeHtml(url)}" />`

    if (html.includes('<head')) {
      return html.replace(/<head([^>]*)>/i, `<head$1>${baseTag}`)
    }

    return `<!doctype html>
<html>
  <head>
    ${baseTag}
  </head>
  <body>${html}</body>
</html>`
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
</html>`
}

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, ' ').trim()
}

function firstNonEmpty(...values: Array<string | null | undefined>) {
  return values.map((value) => value?.trim()).find((value) => Boolean(value)) ?? ''
}

function getLocalDateToken(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}${month}${day}`
}

function sanitizeFileName(value: string) {
  return normalizeWhitespace(value).replace(/[\\/:*?"<>|]/g, '-')
}

function extractTextLines(element: Element | null) {
  return (element?.textContent ?? '')
    .split(/\r?\n/)
    .map((part) => part.trim())
    .filter(Boolean)
}

function removeMatchingElements(root: Element, patterns: RegExp[]) {
  const candidates = Array.from(root.querySelectorAll('*')).reverse()

  for (const element of candidates) {
    const text = normalizeWhitespace(element.textContent ?? '')
    if (text && patterns.some((pattern) => pattern.test(text))) {
      element.remove()
    }
  }
}

function extractSalaryText(...candidates: Array<string | null | undefined>) {
  for (const candidate of candidates) {
    const text = normalizeWhitespace(candidate ?? '')
    const match = text.match(
      /\$[\d,]+(?:\.\d+)?(?:\s*(?:-|to)\s*\$?[\d,]+(?:\.\d+)?)?(?:\s*(?:a year|per year|\/year|yr|year))?/i,
    )

    if (match) {
      return match[0].replace(/\s+/g, ' ').trim()
    }
  }

  return ''
}

function inferWorkModel(location: string, text: string): WorkModel {
  const combined = `${location} ${text}`.toLowerCase()

  if (/\bhybrid\b|mixed|split time|split between remote and office/.test(combined)) {
    return 'Hybrid'
  }

  if (/\bremote\b|wfh|work from home|fully remote/.test(combined)) {
    return 'Remote'
  }

  if (/\bin[- ]?office\b|\bonsite\b|\bon[- ]?site\b|\boffice\b/.test(combined)) {
    return 'InOffice'
  }

  return combined.trim() ? 'InOffice' : 'Unknown'
}

function formatWorkModelLabel(workModel: WorkModel) {
  switch (workModel) {
    case 'Remote':
      return 'Remote'
    case 'InOffice':
      return 'In Office'
    case 'Hybrid':
      return 'Hybrid'
    default:
      return 'Unknown'
  }
}

function formatSavedDate(value: string) {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return value
  }

  return parsed.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

async function fetchSavedJobPostings() {
  const response = await fetch('/api/v1/job-postings')

  if (!response.ok) {
    throw new Error(await response.text() || 'Unable to load saved job postings.')
  }

  return (await response.json()) as SavedJobPostingSummary[]
}

/** Convert a DOM element's content to Markdown (headings, lists, paragraphs). */
function elementToMarkdown(el: Element | null): string {
  if (!el) return ''

  function nodeToMd(node: Node, depth = 0): string {
    if (node.nodeType === Node.TEXT_NODE) {
      return node.textContent ?? ''
    }

    if (node.nodeType !== Node.ELEMENT_NODE) return ''

    const element = node as Element
    const tag = element.tagName.toLowerCase()
    const children = Array.from(element.childNodes).map((c) => nodeToMd(c, depth)).join('')
    const trimmed = children.trim()

    switch (tag) {
      case 'h1': return `\n# ${trimmed}\n`
      case 'h2': return `\n## ${trimmed}\n`
      case 'h3': return `\n### ${trimmed}\n`
      case 'h4': return `\n#### ${trimmed}\n`
      case 'h5': return `\n##### ${trimmed}\n`
      case 'h6': return `\n###### ${trimmed}\n`
      case 'p': return trimmed ? `\n${trimmed}\n` : ''
      case 'br': return '\n'
      case 'li': return `\n- ${trimmed}`
      case 'ul':
      case 'ol': return `\n${trimmed}\n`
      case 'strong':
      case 'b': return trimmed ? `**${trimmed}**` : ''
      case 'em':
      case 'i': return trimmed ? `_${trimmed}_` : ''
      case 'a': {
        const href = element.getAttribute('href')
        return href ? `[${trimmed}](${href})` : trimmed
      }
      case 'script':
      case 'style':
      case 'noscript':
        return ''
      default:
        return children
    }
  }

  return nodeToMd(el)
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function buildMarkdown(job: ExtractedJobPosting) {
  return `# ${job.title}

- Title: ${job.title}
- Company: ${job.company}
- Location: ${job.location}
- Salary: ${job.salary || 'Unknown Salary'}
- Work Model: ${formatWorkModelLabel(job.workModel)}
- Source: ${job.source}
- Captured: ${getLocalDateToken()}

## Job Description

${job.markdown}`
}

function extractIndeedJobPosting(snapshot: CapturedSnapshot): ExtractedJobPosting | null {
  if (!snapshot.html) {
    return null
  }

  const doc = new DOMParser().parseFromString(snapshot.html, 'text/html')
  const root = doc.querySelector('.jobsearch-JobComponent') ?? doc.body
  const header = root.querySelector('.jobsearch-InfoHeaderContainer') ?? root
  const body =
    root.querySelector('.jobsearch-BodyContainer') ??
    root.querySelector('.jobsearch-JobComponent-description') ??
    root
  const description = root.querySelector('.jobsearch-JobComponent-description') ?? body

  const title = firstNonEmpty(
    header.querySelector('h1')?.textContent,
    header.querySelector('h2')?.textContent,
    extractTextLines(header)[0],
    snapshot.title,
  )

  const headerLines = extractTextLines(header)

  const company = firstNonEmpty(
    header.querySelector('[data-testid*="company"]')?.textContent,
    header.querySelector('a')?.textContent,
    headerLines[1],
    'Unknown Company',
  )

  const location = firstNonEmpty(
    header.querySelector('[data-testid*="job-location"]')?.textContent,
    header.querySelector('[data-testid*="location"]')?.textContent,
    headerLines[2],
    'Unknown Location',
  )

  const salary = firstNonEmpty(
    extractSalaryText(
      header.querySelector('[data-testid*="salary"]')?.textContent,
      body.querySelector('[data-testid*="salary"]')?.textContent,
      header.textContent,
      body.textContent,
      snapshot.text,
    ),
    'Unknown Salary',
  )

  removeMatchingElements(root, [
    /^\d[\d,]*\s+reviews$/i,
    /^read what people are saying about working here\.?$/i,
  ])

  const descriptionMarkdown = elementToMarkdown(description)
  const descriptionText = descriptionMarkdown || normalizeWhitespace(
    (description as HTMLElement | null)?.innerText ??
      description?.textContent ??
      snapshot.text ??
      '',
  )
  const workModel = inferWorkModel(location, `${location} ${descriptionText}`)
  const fileWorkMode = workModel.toLowerCase()
  const fileName = `${sanitizeFileName(company)} - ${sanitizeFileName(title)} - ${getLocalDateToken()} - ${fileWorkMode}.md`

  return {
    source: snapshot.url ?? '',
    title,
    company,
    location,
    salary,
    workModel,
    fileName,
    formattedHtml: root.outerHTML,
    markdown: descriptionText || 'No job description found.',
  }
}

function extractGenericJobPosting(snapshot: CapturedSnapshot): ExtractedJobPosting {
  const title = firstNonEmpty(snapshot.title, 'Job Posting')
  const descriptionText = normalizeWhitespace(snapshot.text ?? '')
  const workModel = inferWorkModel('Unknown Location', descriptionText)
  const fileWorkMode = workModel.toLowerCase()
  const fileName = `${sanitizeFileName('Unknown Company')} - ${sanitizeFileName(title)} - ${getLocalDateToken()} - ${fileWorkMode}.md`

  return {
    source: snapshot.url ?? '',
    company: 'Unknown Company',
    title,
    location: 'Unknown Location',
    salary: 'Unknown Salary',
    workModel,
    fileName,
    formattedHtml: snapshot.html ?? '',
    markdown: descriptionText || 'No job description found.',
  }
}

function extractJobPosting(snapshot: CapturedSnapshot): ExtractedJobPosting {
  try {
    const hostname = new URL(snapshot.url ?? '').hostname.toLowerCase()
    if (hostname.includes('indeed.')) {
      return extractIndeedJobPosting(snapshot) ?? extractGenericJobPosting(snapshot)
    }
  } catch {
    // Fall back to generic extraction.
  }

  return extractGenericJobPosting(snapshot)
}

type JobPostingsTabProps = {
  onAnalyze: (jobPosting: SavedJobPostingSummary) => void
}

export function JobPostingsTab({ onAnalyze }: JobPostingsTabProps) {
  const [urlInput, setUrlInput] = useState(() => {
    return window.localStorage.getItem(jobPostUrlStorageKey) ?? ''
  })
  const [pageSnapshot, setPageSnapshot] = useState<CapturedSnapshot | null>(null)
  const [formattedHtml, setFormattedHtml] = useState('')
  const [markdownContent, setMarkdownContent] = useState('')
  const [capturedJobPosting, setCapturedJobPosting] = useState<ExtractedJobPosting | null>(null)
  const [savedJobPostings, setSavedJobPostings] = useState<SavedJobPostingSummary[]>([])
  const [savedCardOpenState, setSavedCardOpenState] = useState<Record<number, boolean>>({})
  const [hideImages, setHideImages] = useState(() => {
    return window.localStorage.getItem(jobPostHideImagesStorageKey) === 'true'
  })
  const [hideButtons, setHideButtons] = useState(() => {
    return window.localStorage.getItem(jobPostHideButtonsStorageKey) === 'true'
  })
  const [captureOpen, setCaptureOpen] = useState(() => {
    const stored = window.localStorage.getItem(jobPostCaptureOpenStorageKey)
    return stored == null ? true : stored === 'true'
  })
  const [savedOpen, setSavedOpen] = useState(() => {
    const stored = window.localStorage.getItem(jobPostSavedOpenStorageKey)
    return stored == null ? false : stored === 'true'
  })
  const [jobPostPageOpen, setJobPostPageOpen] = useState(() => {
    const stored = window.localStorage.getItem(jobPostPageOpenStorageKey)
    return stored == null ? true : stored === 'true'
  })
  const [formattedOpen, setFormattedOpen] = useState(() => {
    const stored = window.localStorage.getItem(jobPostFormattedOpenStorageKey)
    return stored == null ? false : stored === 'true'
  })
  const [markdownOpen, setMarkdownOpen] = useState(() => {
    const stored = window.localStorage.getItem(jobPostMarkdownOpenStorageKey)
    return stored == null ? false : stored === 'true'
  })
  const [status, setStatus] = useState('Enter a posting URL and click go.')

  const refreshSavedJobPostings = async () => {
    try {
      setSavedJobPostings(await fetchSavedJobPostings())
      setStatus('Saved job postings refreshed.')
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Unable to load saved job postings.')
    }
  }

  useEffect(() => {
    window.localStorage.setItem(jobPostUrlStorageKey, urlInput)
  }, [urlInput])

  useEffect(() => {
    window.localStorage.setItem(jobPostHideImagesStorageKey, String(hideImages))
  }, [hideImages])

  useEffect(() => {
    window.localStorage.setItem(jobPostHideButtonsStorageKey, String(hideButtons))
  }, [hideButtons])

  useEffect(() => {
    window.localStorage.setItem(jobPostCaptureOpenStorageKey, String(captureOpen))
  }, [captureOpen])

  useEffect(() => {
    window.localStorage.setItem(jobPostSavedOpenStorageKey, String(savedOpen))
  }, [savedOpen])

  useEffect(() => {
    window.localStorage.setItem(jobPostPageOpenStorageKey, String(jobPostPageOpen))
  }, [jobPostPageOpen])

  useEffect(() => {
    window.localStorage.setItem(jobPostFormattedOpenStorageKey, String(formattedOpen))
  }, [formattedOpen])

  useEffect(() => {
    window.localStorage.setItem(jobPostMarkdownOpenStorageKey, String(markdownOpen))
  }, [markdownOpen])

  useEffect(() => {
    void refreshSavedJobPostings()
  }, [])

  const srcDoc = useMemo(() => {
    if (!pageSnapshot) {
      return '<!doctype html><html><head><style>:root { color-scheme: light dark; } html, body { background: transparent; color: inherit; margin: 0; padding: 0; }</style></head><body></body></html>'
    }

    return buildSrcDoc(
      pageSnapshot.title ?? 'Job Post Page',
      pageSnapshot.url ?? urlInput,
      pageSnapshot.html ?? '',
      pageSnapshot.text ?? '',
    )
  }, [pageSnapshot, urlInput])

  const handleGo = async () => {
    const nextUrl = urlInput.trim()
    setUrlInput(nextUrl)

    if (!nextUrl) {
      setStatus('Enter a valid URL first.')
      return
    }

    setStatus('Opening the page in a visible tab...')

    try {
      const response = await requestOpenUrlFromExtension(nextUrl)
      setPageSnapshot(null)
      setCapturedJobPosting(null)
      setFormattedHtml('')
      setMarkdownContent('')
      setStatus(
        `Opened ${response.snapshot?.url ?? nextUrl}. Use capture after you finish with the page.`,
      )
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Unable to open the page.')
    }
  }

  const handleCapture = async () => {
    const targetUrl = urlInput.trim()

    if (!targetUrl) {
      setStatus('Enter a posting URL first.')
      return
    }

    setStatus(`Looking for an open tab matching ${targetUrl}...`)

    try {
      const response = await requestCaptureByUrlFromExtension<{
        title?: string
        url?: string
        html?: string
        text?: string
      }>(targetUrl)
      const snapshot = response.snapshot ?? null
      setPageSnapshot(snapshot)

      if (!snapshot) {
        setStatus('No page snapshot was returned.')
        return
      }

      const jobPosting = extractJobPosting(snapshot)
      const markdown = buildMarkdown(jobPosting)
      setCapturedJobPosting(jobPosting)
      setFormattedHtml(jobPosting.formattedHtml)
      setMarkdownContent(markdown)
      setStatus(`Captured ${jobPosting.title}.`)
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Unable to capture the page.')
    }
  }

  useEffect(() => {
    return onAutoCaptureTrigger(() => {
      void handleCapture()
    })
  })

  const handleSave = () => {
    if (!capturedJobPosting || !markdownContent) {
      setStatus('Capture a job posting before saving.')
      return
    }

    void (async () => {
      const response = await fetch('/api/v1/job-postings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: capturedJobPosting.title,
          company: capturedJobPosting.company,
          location: capturedJobPosting.location,
          salary: capturedJobPosting.salary,
          workModel: capturedJobPosting.workModel,
          source: capturedJobPosting.source,
          markdown: markdownContent,
        } satisfies SaveJobPostingRequest),
      })

      if (!response.ok) {
        throw new Error(await response.text() || 'Unable to save the job posting.')
      }

      const saved = (await response.json()) as SaveJobPostingResponse
      setSavedJobPostings(await fetchSavedJobPostings())
      setStatus(`Saved ${saved.document.title} and job posting ${saved.jobPosting.id}.`)
    })().catch((error) => {
      setStatus(error instanceof Error ? error.message : 'Unable to save the job posting.')
    })
  }

  const handleDeleteJobPosting = async (id: number) => {
    const confirmed = window.confirm('Delete this saved job posting?')
    if (!confirmed) {
      return
    }

    try {
      const response = await fetch(`/api/v1/job-postings/${id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error(await response.text() || 'Unable to delete saved job posting.')
      }

      setSavedJobPostings((current) => current.filter((posting) => posting.id !== id))
      setSavedCardOpenState((current) => {
        const next = { ...current }
        delete next[id]
        return next
      })
      setStatus('Job posting deleted.')
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Unable to delete saved job posting.')
    }
  }

  return (
    <section className="job-postings">
      <h1>Job Postings</h1>

      <details
        className="job-postings-expander"
        open={captureOpen}
        onToggle={(event) => setCaptureOpen(event.currentTarget.open)}
      >
        <summary>Capture</summary>
        <div className="job-postings-field">
          <label htmlFor="job-post-url">Posting URL</label>
          <div className="job-postings-input-row">
            <input
              id="job-post-url"
              type="url"
              value={urlInput}
              onChange={(event) => setUrlInput(event.target.value)}
              placeholder="https://example.com/job-posting"
            />
            <button
              id="job-post-go-button"
              className="button button--primary"
              type="button"
              onClick={handleGo}
            >
              Go
            </button>
            <button
              className="button"
              type="button"
              onClick={handleCapture}
            >
              Capture
            </button>
            <button
              className="button"
              type="button"
              onClick={handleSave}
            >
              Save
            </button>
          </div>
        </div>

        <p className="job-postings-status">{status}</p>

        <details
          className="job-postings-expander"
          open={jobPostPageOpen}
          onToggle={(event) => setJobPostPageOpen(event.currentTarget.open)}
        >
          <summary>Job Post Page</summary>
          <div className="job-postings-frame-wrap">
            <iframe
              id="job-post-content"
              className="job-postings-frame"
              srcDoc={srcDoc}
              title="Job Post Page"
              sandbox=""
            />
          </div>
        </details>

        <details
          className="job-postings-expander"
          open={formattedOpen}
          onToggle={(event) => setFormattedOpen(event.currentTarget.open)}
        >
          <summary>Formatted Content</summary>
          <div className="job-postings-toggle-row">
            <label className="job-postings-checkbox-label">
              <input
                type="checkbox"
                checked={hideImages}
                onChange={(e) => setHideImages(e.target.checked)}
              />
              Hide images
            </label>
            <label className="job-postings-checkbox-label">
              <input
                type="checkbox"
                checked={hideButtons}
                onChange={(e) => setHideButtons(e.target.checked)}
              />
              Remove buttons
            </label>
          </div>
          <div
            className={`job-postings-formatted${
              hideImages ? ' job-postings-formatted--no-images' : ''
            }${hideButtons ? ' job-postings-formatted--no-buttons' : ''}`}
            dangerouslySetInnerHTML={{ __html: formattedHtml || '<p style="color:#888">Capture a job posting to see formatted content here.</p>' }}
          />
        </details>

        <details
          className="job-postings-expander"
          open={markdownOpen}
          onToggle={(event) => setMarkdownOpen(event.currentTarget.open)}
        >
          <summary>Markdown Content</summary>
          <textarea
            className="job-postings-markdown"
            readOnly
            value={markdownContent || 'Capture a job posting to see markdown content here.'}
          />
        </details>
      </details>

      <details
        id="job-postings--saved-job-postings--container"
        className="job-postings-expander"
        open={savedOpen}
        onToggle={(event) => setSavedOpen(event.currentTarget.open)}
      >
        <summary className="job-postings-expander-summary">
          <span>Saved Job Postings</span>
          <button
            type="button"
            className="button expander-summary-button"
            aria-label="Refresh saved job postings"
            onClick={(event) => {
              event.preventDefault()
              event.stopPropagation()
              void refreshSavedJobPostings()
            }}
          >
            Refresh
          </button>
        </summary>
        {savedJobPostings.length === 0 ? (
          <p className="job-postings-empty-state">No saved job postings yet.</p>
        ) : (
          <div className="job-postings-saved-list">
            {savedJobPostings.map((jobPosting) => {
              const isSavedCardOpen = savedCardOpenState[jobPosting.id] ?? false

              return (
                <div key={jobPosting.id} className="job-postings-saved-item">
                  <div
                    className="job-postings-saved-summary"
                    role="button"
                    tabIndex={0}
                    aria-expanded={isSavedCardOpen}
                    onClick={() =>
                      setSavedCardOpenState((current) => ({
                        ...current,
                        [jobPosting.id]: !current[jobPosting.id],
                      }))
                    }
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        setSavedCardOpenState((current) => ({
                          ...current,
                          [jobPosting.id]: !current[jobPosting.id],
                        }))
                      }
                    }}
                  >
                    <span>
                      {[
                        jobPosting.company,
                        jobPosting.title,
                        formatWorkModelLabel(jobPosting.workModel),
                        jobPosting.salary || 'Unknown Salary',
                      ].join(' | ')}
                    </span>
                    <div className="card-actions">
                      <button
                        type="button"
                        className="button"
                        onClick={(event) => {
                          event.stopPropagation()
                          onAnalyze(jobPosting)
                        }}
                      >
                        Analyze
                      </button>
                      <button
                        type="button"
                        className="button button--delete"
                        onClick={(event) => {
                          event.stopPropagation()
                          void handleDeleteJobPosting(jobPosting.id)
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>

                  {isSavedCardOpen && (
                    <div className="job-postings-saved-details">
                      <div>{jobPosting.salary || 'Unknown Salary'}</div>
                      <div>
                        {formatWorkModelLabel(jobPosting.workModel)} {jobPosting.location}
                      </div>
                      <div>
                        {formatSavedDate(jobPosting.createdAt)}
                        <span className="job-postings-saved-separator">·</span>
                        <a href={jobPosting.url} target="_blank" rel="noreferrer">
                          {jobPosting.url}
                        </a>
                      </div>

                      <details className="job-postings-saved-source-expander" open={false}>
                        <summary>Job Post</summary>
                        <textarea
                          className="job-postings-markdown job-postings-saved-markdown"
                          readOnly
                          value={jobPosting.document?.content || 'No markdown available for this posting.'}
                        />
                      </details>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </details>

    </section>
  )
}
