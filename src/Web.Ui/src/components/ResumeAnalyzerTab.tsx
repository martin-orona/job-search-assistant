import { useEffect, useState } from 'react'
import type { SavedJobPostingSummary } from '../App'

type SavedPromptTemplate = {
  id: number
  name: string
  template: string
  createdAt: string
}

type SavedResume = {
  id: number
  name: string
  jobTitle: string
  date: string
  documentId: number
  document?: {
    id: number
    title: string
    type: string
    content: string
    source: string | null
  } | null
}

type SavedAiPrompt = {
  id: number
  name: string
  aiUrl: string
  jobPostingId: number
  resumeId: number
  aiPromptTemplateId: number
  promptDocumentId: number
  responseDocumentId: number
  createdAt: string
  updatedAt: string
  promptContent: string
  responseContent: string
  jobPostingContent: string
  resumeContent: string
  jobPostingTitle: string
  jobPostingCompany: string
  jobPostingWorkModel: string
  jobPostingSalary: string
  resumeName: string
  resumeJobTitle: string
  resumeDate: string
  aiPromptTemplateName: string
}

function formatWorkModelLabel(workModel: string) {
  return workModel === 'InOffice' ? 'In Office' : workModel || 'Unknown'
}

const DOCUMENT_TYPE_OPTIONS = ['HTML', 'PDF', 'Markdown', 'Text', 'Word', 'Other'] as const

// Best-effort guess used only when the user hasn't designated a document type.
function detectDocumentType(content: string): string {
  const trimmed = content.trim()
  if (!trimmed) {
    return 'Unknown'
  }
  if (/^<!doctype html|<html[\s>]|<\/html>/i.test(trimmed)) {
    return 'HTML'
  }
  if (/^%PDF-/.test(trimmed)) {
    return 'PDF'
  }
  if (/^(#{1,6}\s|[-*+]\s|\d+\.\s|```|\[.+\]\(.+\))/m.test(trimmed)) {
    return 'Markdown'
  }
  return 'Text'
}

function extractMatchPercent(responseContent: string) {
  const responseHeader = responseContent.slice(0, 1000)
  const match = responseHeader.match(/\bmatch(?:\s+percentage|\s+percent|\s+score)?\b[^\d%]{0,20}(\d{1,3})\s*%/i)
  return match ? `${match[1]}%` : 'Unknown'
}

type ResumeAnalyzerTabProps = {
  jobPosting: SavedJobPostingSummary | null
}

function toDateInputValue(value: string): string {
  if (!value) {
    return ''
  }
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return ''
  }
  const year = parsed.getFullYear()
  const month = String(parsed.getMonth() + 1).padStart(2, '0')
  const day = String(parsed.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const EXPANDER_STORAGE_KEY = 'jobSearchAssistant.resumeAnalyzer.expanders'
const LOADED_TEMPLATE_STORAGE_KEY = 'jobSearchAssistant.resumeAnalyzer.loadedTemplate'
const AI_URL_STORAGE_KEY = 'jobSearchAssistant.resumeAnalyzer.aiUrl'
const AI_PROMPT_CONTENT_STORAGE_KEY = 'jobSearchAssistant.resumeAnalyzer.aiPromptContent'
const AI_RESPONSE_STORAGE_KEY = 'jobSearchAssistant.resumeAnalyzer.aiResponse'

type LoadedTemplate = {
  id: string
  name: string
  template: string
}

function getStoredLoadedTemplate(): LoadedTemplate {
  const stored = localStorage.getItem(LOADED_TEMPLATE_STORAGE_KEY)
  if (!stored) {
    return { id: '', name: '', template: '' }
  }

  try {
    const parsed = JSON.parse(stored) as Partial<LoadedTemplate>
    return {
      id: typeof parsed.id === 'string' ? parsed.id : '',
      name: typeof parsed.name === 'string' ? parsed.name : '',
      template: typeof parsed.template === 'string' ? parsed.template : '',
    }
  } catch {
    return { id: '', name: '', template: '' }
  }
}

const LOADED_RESUME_STORAGE_KEY = 'jobSearchAssistant.resumeAnalyzer.loadedResume'

type LoadedResume = {
  id: string
  name: string
  jobTitle: string
  date: string
  documentId: string
  documentType: string
  content: string
}

function getStoredLoadedResume(): LoadedResume {
  const stored = localStorage.getItem(LOADED_RESUME_STORAGE_KEY)
  if (!stored) {
    return { id: '', name: '', jobTitle: '', date: '', documentId: '', documentType: '', content: '' }
  }

  try {
    const parsed = JSON.parse(stored) as Partial<LoadedResume>
    return {
      id: typeof parsed.id === 'string' ? parsed.id : '',
      name: typeof parsed.name === 'string' ? parsed.name : '',
      jobTitle: typeof parsed.jobTitle === 'string' ? parsed.jobTitle : '',
      date: typeof parsed.date === 'string' ? parsed.date : '',
      documentId: typeof parsed.documentId === 'string' ? parsed.documentId : '',
      documentType: typeof parsed.documentType === 'string' ? parsed.documentType : '',
      content: typeof parsed.content === 'string' ? parsed.content : '',
    }
  } catch {
    return { id: '', name: '', jobTitle: '', date: '', documentId: '', documentType: '', content: '' }
  }
}

type ExpanderState = {
  aiPrompt: boolean
  aiPromptContent: boolean
  aiResponseContent: boolean
  jobDescription: boolean
  jobDescriptionContent: boolean
  resume: boolean
  resumeContent: boolean
  savedResumes: boolean
  promptTemplate: boolean
  promptTemplateContent: boolean
  savedTemplates: boolean
  savedAiPrompts: boolean
  savedTemplateCards: Record<number, boolean>
  savedResumeCards: Record<number, boolean>
  savedAiPromptCards: Record<number, boolean>
}

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
}

function getStoredExpanderState(): ExpanderState {
  const stored = localStorage.getItem(EXPANDER_STORAGE_KEY)
  if (!stored) {
    return defaultExpanderState
  }

  try {
    const parsed = JSON.parse(stored) as Partial<ExpanderState>
    return {
      ...defaultExpanderState,
      ...parsed,
      savedTemplateCards: parsed.savedTemplateCards ?? {},
      savedResumeCards: parsed.savedResumeCards ?? {},
      savedAiPromptCards: parsed.savedAiPromptCards ?? {},
      savedResumes: parsed.savedResumes ?? true,
      savedAiPrompts: parsed.savedAiPrompts ?? true,
    }
  } catch {
    return defaultExpanderState
  }
}

export function ResumeAnalyzerTab({ jobPosting }: ResumeAnalyzerTabProps) {
  const [expanderState, setExpanderState] =
    useState<ExpanderState>(getStoredExpanderState)
  const [savedTemplates, setSavedTemplates] = useState<SavedPromptTemplate[]>([])
  const [savedResumes, setSavedResumes] = useState<SavedResume[]>([])
  const [savedAiPrompts, setSavedAiPrompts] = useState<SavedAiPrompt[]>([])
  const [resumeId, setResumeId] = useState(() => getStoredLoadedResume().id)
  const [resumeName, setResumeName] = useState(() => getStoredLoadedResume().name)
  const [resumeJobTitle, setResumeJobTitle] = useState(() => getStoredLoadedResume().jobTitle)
  const [resumeDate, setResumeDate] = useState(() => getStoredLoadedResume().date)
  const [resumeDocumentId, setResumeDocumentId] = useState(() => getStoredLoadedResume().documentId)
  const [resumeDocumentType, setResumeDocumentType] = useState(() => getStoredLoadedResume().documentType)
  const [resumeContent, setResumeContent] = useState(() => getStoredLoadedResume().content)
  const [templateId, setTemplateId] = useState(() => getStoredLoadedTemplate().id)
  const [templateName, setTemplateName] = useState(() => getStoredLoadedTemplate().name)
  const [templateContent, setTemplateContent] = useState(() => getStoredLoadedTemplate().template)
  const [aiUrl, setAiUrl] = useState(() => localStorage.getItem(AI_URL_STORAGE_KEY) || '')
  const [aiPromptContent, setAiPromptContent] = useState(() => localStorage.getItem(AI_PROMPT_CONTENT_STORAGE_KEY) || '')
  const [aiResponseText, setAiResponseText] = useState(() => localStorage.getItem(AI_RESPONSE_STORAGE_KEY) || '')
  const [status, setStatus] = useState('Ready')

  useEffect(() => {
    localStorage.setItem(EXPANDER_STORAGE_KEY, JSON.stringify(expanderState))
  }, [expanderState])

  useEffect(() => {
    localStorage.setItem(
      LOADED_TEMPLATE_STORAGE_KEY,
      JSON.stringify({ id: templateId, name: templateName, template: templateContent }),
    )
  }, [templateId, templateName, templateContent])

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
    )
  }, [resumeId, resumeName, resumeJobTitle, resumeDate, resumeDocumentId, resumeDocumentType, resumeContent])

  useEffect(() => {
    localStorage.setItem(AI_URL_STORAGE_KEY, aiUrl)
  }, [aiUrl])

  useEffect(() => {
    localStorage.setItem(AI_PROMPT_CONTENT_STORAGE_KEY, aiPromptContent)
  }, [aiPromptContent])

  useEffect(() => {
    localStorage.setItem(AI_RESPONSE_STORAGE_KEY, aiResponseText)
  }, [aiResponseText])

  function setExpanderOpen(
    expander: keyof Omit<ExpanderState, 'savedTemplateCards' | 'savedResumeCards' | 'savedAiPromptCards'>,
    open: boolean,
  ) {
    setExpanderState((current) => ({ ...current, [expander]: open }))
  }

  async function refreshSavedAiPrompts() {
    try {
      const response = await fetch('/api/v1/ai-prompts/')
      if (!response.ok) {
        throw new Error('Unable to load saved AI prompts.')
      }

      setSavedAiPrompts((await response.json()) as SavedAiPrompt[])
      setStatus('Saved AI prompts refreshed.')
    } catch (error: unknown) {
      setStatus(error instanceof Error ? error.message : 'Unable to load saved AI prompts.')
    }
  }

  async function refreshSavedResumes() {
    try {
      const response = await fetch('/api/v1/resumes/')
      if (!response.ok) {
        throw new Error('Unable to load saved resumes.')
      }

      setSavedResumes((await response.json()) as SavedResume[])
      setStatus('Saved resumes refreshed.')
    } catch (error: unknown) {
      setStatus(error instanceof Error ? error.message : 'Unable to load saved resumes.')
    }
  }

  async function refreshSavedTemplates() {
    try {
      const response = await fetch('/api/v1/ai-prompt-templates/')
      if (!response.ok) {
        throw new Error('Unable to load saved prompt templates.')
      }

      setSavedTemplates((await response.json()) as SavedPromptTemplate[])
      setStatus('Saved templates refreshed.')
    } catch (error: unknown) {
      setStatus(error instanceof Error ? error.message : 'Unable to load saved prompt templates.')
    }
  }

  useEffect(() => {
    void fetch('/api/v1/ai-prompt-templates/')
      .then(async (response) => {
        if (!response.ok) {
          throw new Error('Unable to load saved prompt templates.')
        }
        return (await response.json()) as SavedPromptTemplate[]
      })
      .then(setSavedTemplates)
      .catch((error: unknown) => {
        setStatus(error instanceof Error ? error.message : 'Unable to load saved prompt templates.')
      })
  }, [])

  useEffect(() => {
    void fetch('/api/v1/ai-prompts/')
      .then(async (response) => {
        if (!response.ok) {
          throw new Error('Unable to load saved AI prompts.')
        }
        return (await response.json()) as SavedAiPrompt[]
      })
      .then(setSavedAiPrompts)
      .catch((error: unknown) => {
        setStatus(error instanceof Error ? error.message : 'Unable to load saved AI prompts.')
      })
  }, [])

  useEffect(() => {
    void fetch('/api/v1/resumes/')
      .then(async (response) => {
        if (!response.ok) {
          throw new Error('Unable to load saved resumes.')
        }
        return (await response.json()) as SavedResume[]
      })
      .then(setSavedResumes)
      .catch((error: unknown) => {
        setStatus(error instanceof Error ? error.message : 'Unable to load saved resumes.')
      })
  }, [])

  async function handleSaveTemplate() {
    if (!templateName.trim() || !templateContent.trim()) {
      setStatus('Enter a template name and content before saving.')
      return
    }

    const response = await fetch('/api/v1/ai-prompt-templates/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: templateName.trim(), template: templateContent }),
    })
    if (!response.ok) {
      setStatus('Unable to save the prompt template.')
      return
    }

    const saved = (await response.json()) as SavedPromptTemplate
    setSavedTemplates((current) => [saved, ...current])
    setTemplateId(String(saved.id))
    setStatus('Prompt template saved.')
  }

  async function handleDeleteTemplate(id: number) {
    const response = await fetch(`/api/v1/ai-prompt-templates/${id}`, { method: 'DELETE' })
    if (!response.ok) {
      setStatus('Unable to delete the prompt template.')
      return
    }
    setSavedTemplates((current) => current.filter((template) => template.id !== id))
    setStatus('Prompt template deleted.')
  }

  async function handleSaveResume() {
    console.log('[ResumeAnalyzer] handleSaveResume: starting', {
      resumeName,
      resumeJobTitle,
      resumeDate,
      resumeContentLength: resumeContent.length,
    })

    if (!resumeName.trim() || !resumeContent.trim()) {
      console.log('[ResumeAnalyzer] handleSaveResume: validation failed (missing name or content)')
      setStatus('Enter a resume name and content before saving.')
      return
    }

    const isUpdate = resumeId.trim() !== ''
    const documentType = resumeDocumentType || detectDocumentType(resumeContent)

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
        }

    const url = isUpdate ? `/api/v1/resumes/${resumeId}` : '/api/v1/resumes/'
    const method = isUpdate ? 'PUT' : 'POST'
    console.log(`[ResumeAnalyzer] handleSaveResume: sending ${method} request to ${url}`, payload)

    try {
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      console.log('[ResumeAnalyzer] handleSaveResume: response received', {
        status: response.status,
        ok: response.ok,
      })

      if (!response.ok) {
        const errorBody = await response.text()
        console.error('[ResumeAnalyzer] handleSaveResume: request failed', errorBody)
        setStatus(`Unable to save the resume. (${response.status}: ${errorBody})`)
        return
      }

      const saved = (await response.json()) as SavedResume
      console.log('[ResumeAnalyzer] handleSaveResume: saved successfully', saved)
      setSavedResumes((current) =>
        isUpdate
          ? current.map((resume) => (resume.id === saved.id ? saved : resume))
          : [saved, ...current],
      )
      setResumeId(String(saved.id))
      setResumeDocumentId(String(saved.documentId))
      setResumeDocumentType(saved.document?.type ?? documentType)
      setStatus(isUpdate ? 'Resume updated.' : 'Resume saved.')
      refreshSavedResumes();
    } catch (error) {
      console.error('[ResumeAnalyzer] handleSaveResume: exception thrown', error)
      setStatus(error instanceof Error ? `Unable to save the resume: ${error.message}` : 'Unable to save the resume.')
    }
  }

  async function handleDeleteResume(id: number) {
    const response = await fetch(`/api/v1/resumes/${id}`, { method: 'DELETE' })
    if (!response.ok) {
      setStatus('Unable to delete the resume.')
      return
    }
    setSavedResumes((current) => current.filter((saved) => saved.id !== id))
    setStatus('Resume deleted.')
  }

  async function handleSaveAiPrompt() {
    if (!jobPosting) {
      setStatus('Select a saved job posting before saving the AI prompt.')
      return
    }
    if (!resumeId) {
      setStatus('Load or save a resume before saving the AI prompt.')
      return
    }
    if (!templateId) {
      setStatus('Load or save a prompt template before saving the AI prompt.')
      return
    }
    if (!aiPromptContent.trim()) {
      setStatus('Generate or enter prompt content before saving the AI prompt.')
      return
    }

    const name = `${resumeName || 'Resume'} vs ${jobPosting.title || 'Job Posting'}`.trim()

    const response = await fetch('/api/v1/ai-prompts/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        aiUrl,
        jobPostingId: jobPosting.id,
        resumeId: Number(resumeId),
        aiPromptTemplateId: Number(templateId),
        promptContent: aiPromptContent,
        responseContent: aiResponseText,
      }),
    })
    if (!response.ok) {
      setStatus('Unable to save the AI prompt.')
      return
    }

    const saved = (await response.json()) as {
      id: number
      name: string
      aiUrl: string
      jobPostingId: number
      resumeId: number
      aiPromptTemplateId: number
      promptDocumentId: number
      responseDocumentId: number
      createdAt: string
      updatedAt: string
      promptContent: string
      responseContent: string
      jobPostingContent: string
      resumeContent: string
      jobPostingWorkModel: string
      jobPostingSalary: string
      resumeJobTitle: string
      resumeDate: string
    }

    setSavedAiPrompts((current) => [
      {
        ...saved,
        jobPostingTitle: jobPosting.title,
        jobPostingCompany: jobPosting.company,
        resumeName,
        aiPromptTemplateName: templateName,
        jobPostingContent: jobPosting.document?.content ?? '',
        resumeContent,
        jobPostingWorkModel: jobPosting.workModel,
        jobPostingSalary: jobPosting.salary,
        resumeJobTitle,
        resumeDate,
      },
      ...current,
    ])
    setStatus('AI prompt saved.')
  }

  async function handleDeleteAiPrompt(id: number) {
    const response = await fetch(`/api/v1/ai-prompts/${id}`, { method: 'DELETE' })
    if (!response.ok) {
      setStatus('Unable to delete the saved AI prompt.')
      return
    }
    setSavedAiPrompts((current) => current.filter((saved) => saved.id !== id))
    setStatus('Saved AI prompt deleted.')
  }

  function handleGeneratePrompt(): string {
    const template = templateContent || ''
    const resume = resumeContent || ''
    const description = jobPosting?.document?.content || ''

    const output = template
      .split('[YOUR RESUME HERE]').join(resume)
      .split('[JOB DESCRIPTION HERE]').join(description)

    setAiPromptContent(output)
    setStatus('Prompt generated.')
    return output
  }

  async function handleCopyPrompt(overrideContent?: string): Promise<boolean> {
    const textToCopy = overrideContent !== undefined ? overrideContent : aiPromptContent
    if (!textToCopy) {
      setStatus('No prompt content to copy.')
      return false
    }

    try {
      await navigator.clipboard.writeText(textToCopy)
      setStatus('Prompt copied to clipboard.')
      return true
    } catch (error: unknown) {
      setStatus(error instanceof Error ? error.message : 'Unable to copy prompt to clipboard.')
      return false
    }
  }

  async function handleOpenAi(overrideContent?: string) {
    const prompt = overrideContent !== undefined ? overrideContent : aiPromptContent
    let url = aiUrl.trim()
    if (!url) {
      url = 'https://copilot.microsoft.com'
    } else if (!/^https?:\/\//i.test(url)) {
      url = `https://${url}`
    }

    const copied = await handleCopyPrompt(prompt)
    window.open(url, '_blank', 'noopener,noreferrer')
    setStatus(
      copied
        ? 'Opened AI tab and copied prompt to clipboard. Paste it into the AI chat.'
        : 'Opened AI tab (prompt was not copied to clipboard).',
    )
  }

  async function handlePromptAi() {
    const generated = handleGeneratePrompt()
    await handleOpenAi(generated)
  }

  return (
    <section className="resume-analyzer">
      <h1>Resume Analyzer</h1>

      <div className="resume-analyzer-status">{status}</div>

      <details className="resume-analyzer-expander ai-prompt-container" open={expanderState.aiPrompt} onToggle={(event) => setExpanderOpen('aiPrompt', event.currentTarget.open)}>
        <summary>AI Prompt</summary>
        <div className="resume-analyzer-body">
          <div className="resume-analyzer-actions-row">
            <button type="button" className="button button--primary" onClick={() => void handlePromptAi()}>
              Prompt AI
            </button>
            <button type="button" className="button" onClick={handleGeneratePrompt}>
              Generate Prompt
            </button>
            <button type="button" className="button" onClick={() => void handleCopyPrompt()}>
              Copy Prompt
            </button>
            <button type="button" className="button" onClick={() => void handleOpenAi()}>
              Open AI
            </button>
            <button type="button" className="button" onClick={() => void handleSaveAiPrompt()}>
              Save
            </button>
            <input
              type="url"
              value={aiUrl}
              onChange={(event) => setAiUrl(event.target.value)}
              placeholder="AI URL (e.g., https://chatgpt.com)"
              aria-label="AI URL"
            />
          </div>

          <details className="resume-analyzer-inner-expander ai-prompt-content" open={expanderState.aiPromptContent} onToggle={(event) => setExpanderOpen('aiPromptContent', event.currentTarget.open)}>
            <summary>Content</summary>
            <textarea
              className="resume-analyzer-editor"
              value={aiPromptContent}
              onChange={(event) => setAiPromptContent(event.target.value)}
              placeholder="Generated prompt will appear here..."
              aria-label="AI Prompt content"
            />
          </details>

          <details className="resume-analyzer-inner-expander ai-response-content" open={expanderState.aiResponseContent} onToggle={(event) => setExpanderOpen('aiResponseContent', event.currentTarget.open)}>
            <summary>AI Response</summary>
            <textarea
              className="resume-analyzer-editor"
              value={aiResponseText}
              onChange={(event) => setAiResponseText(event.target.value)}
              placeholder="Captured AI response will appear here..."
              aria-label="AI Response content"
            />
          </details>

          <details
            id="resume-analyzer--saved-ai-prompts--container"
            className="resume-analyzer-inner-expander saved-ai-prompts"
            open={expanderState.savedAiPrompts}
            onToggle={(event) => setExpanderOpen('savedAiPrompts', event.currentTarget.open)}
          >
            <summary>
              Saved AI Prompts
              <button
                type="button"
                className="button expander-summary-button"
                aria-label="Refresh saved AI prompts"
                onClick={(event) => {
                  event.preventDefault()
                  event.stopPropagation()
                  void refreshSavedAiPrompts()
                }}
              >
                Refresh
              </button>
            </summary>
            <div className="resume-analyzer-saved-list saved-ai-prompts-list">
              {savedAiPrompts.length === 0 ? (
                <p className="resume-analyzer-empty-state">No saved AI prompts yet.</p>
              ) : (
                savedAiPrompts.map((savedAiPrompt) => (
                  <div key={savedAiPrompt.id} className="resume-analyzer-saved-item saved-ai-prompt-container">
                    <details
                      className="resume-analyzer-saved-resume saved-ai-prompt"
                      open={expanderState.savedAiPromptCards[savedAiPrompt.id] ?? false}
                      onToggle={(event) => {
                        const isOpen = event.currentTarget.open
                        setExpanderState((current) => ({
                          ...current,
                          savedAiPromptCards: {
                            ...current.savedAiPromptCards,
                            [savedAiPrompt.id]: isOpen,
                          },
                        }))
                      }}
                    >
                      <summary className="resume-analyzer-saved-summary summary">
                        <span className="ai-prompt-name">{savedAiPrompt.name}</span>
                        <span className="ai-prompt-job-posting-title">{savedAiPrompt.jobPostingTitle}</span>
                        <span className="ai-prompt-resume-name">{savedAiPrompt.resumeName}</span>
                        <div className="card-actions">
                          <button
                            type="button"
                            className="button"
                            onClick={() => {
                              setAiPromptContent(savedAiPrompt.promptContent)
                              setAiResponseText(savedAiPrompt.responseContent)
                              setAiUrl(savedAiPrompt.aiUrl)
                              setStatus(`Loaded AI prompt: ${savedAiPrompt.name}`)
                            }}
                          >
                            Load
                          </button>
                          <button
                            type="button"
                            className="button button--delete"
                            onClick={() => {
                              void handleDeleteAiPrompt(savedAiPrompt.id)
                            }}
                          >
                            Delete
                          </button>
                        </div>
                      </summary>
                      <div className="resume-analyzer-saved-details details">
                        <div className="ai-url">AI URL: {savedAiPrompt.aiUrl || 'Not specified'}</div>
                        <details className="resume-analyzer-inner-expander">
                          <summary>
                            {`Job Posting: ${[
                              savedAiPrompt.jobPostingCompany,
                              savedAiPrompt.jobPostingTitle || 'Not specified',
                              formatWorkModelLabel(savedAiPrompt.jobPostingWorkModel),
                              savedAiPrompt.jobPostingSalary || 'Unknown Salary',
                            ].join(' | ')}`}
                          </summary>
                          <div className="resume-analyzer-document-content">{savedAiPrompt.jobPostingContent}</div>
                        </details>
                        <details className="resume-analyzer-inner-expander">
                          <summary>
                            {`Resume: ${[
                              savedAiPrompt.resumeName || 'Not specified',
                              savedAiPrompt.resumeJobTitle || 'Not specified',
                              toDateInputValue(savedAiPrompt.resumeDate) || 'No date',
                            ].join(' | ')}`}
                          </summary>
                          <div className="resume-analyzer-document-content">{savedAiPrompt.resumeContent}</div>
                        </details>
                        <details className="resume-analyzer-inner-expander">
                          <summary>Prompt document</summary>
                          <div className="resume-analyzer-document-content">{savedAiPrompt.promptContent}</div>
                        </details>
                        <details className="resume-analyzer-inner-expander">
                          <summary>Response: {extractMatchPercent(savedAiPrompt.responseContent)}</summary>
                          <div className="resume-analyzer-document-content">{savedAiPrompt.responseContent}</div>
                        </details>
                      </div>
                    </details>
                  </div>
                ))
              )}
            </div>
          </details>
        </div>
      </details>

      <details className="resume-analyzer-expander" open={expanderState.jobDescription} onToggle={(event) => setExpanderOpen('jobDescription', event.currentTarget.open)}>
        <summary>
          Job Description
          {!expanderState.jobDescription && jobPosting && (
            <>: {[jobPosting.company, jobPosting.title, jobPosting.salary, jobPosting.url].filter(Boolean).join(' ')}</>
          )}
        </summary>
        <div className="resume-analyzer-body">
          <div className="resume-analyzer-actions-row">
            <input type="text" value={jobPosting?.url ?? ''} readOnly placeholder="File path..." />
          </div>

          <details className="resume-analyzer-inner-expander" open={expanderState.jobDescriptionContent} onToggle={(event) => setExpanderOpen('jobDescriptionContent', event.currentTarget.open)}>
            <summary>Content</summary>
            <textarea
              className="resume-analyzer-editor"
              readOnly
              value={jobPosting?.document?.content || 'Select a saved job posting to load its job description.'}
            />
          </details>
        </div>
      </details>

      <details id="resume-analyzer--resume--container" className="resume-analyzer-expander" open={expanderState.resume} onToggle={(event) => setExpanderOpen('resume', event.currentTarget.open)}>
        <summary>
          Resume
          {!expanderState.resume && resumeName.trim() && (
            <>: {resumeName.trim()}{resumeDate ? ` (${resumeDate})` : ''}</>
          )}
        </summary>
        <div className="resume-analyzer-body">
          <div className="resume-analyzer-card">
            <div className="resume-analyzer-resume-primary-row">
              <input
                type="text"
                value={resumeName}
                onChange={(event) => setResumeName(event.target.value)}
                placeholder="Resume name..."
                aria-label="Resume name"
              />
              <input
                type="text"
                value={resumeJobTitle}
                onChange={(event) => setResumeJobTitle(event.target.value)}
                placeholder="Job title..."
                aria-label="Resume job title"
              />
            </div>
            <div className="resume-analyzer-actions-row">
              <input
                type="date"
                value={resumeDate}
                onChange={(event) => setResumeDate(event.target.value)}
                aria-label="Resume date"
              />
              <input
                type="number"
                min="0"
                value={resumeId}
                placeholder="Resume ID..."
                aria-label="Resume ID"
                readOnly
              />
              <select
                value={resumeDocumentType}
                onChange={(event) => setResumeDocumentType(event.target.value)}
                aria-label="Resume document type"
              >
                <option value="">Auto-detect type</option>
                {DOCUMENT_TYPE_OPTIONS.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
              <button type="button" className="button" onClick={() => void handleSaveResume()}>Save</button>
              <button
                type="button"
                className="button"
                onClick={() => {
                  setResumeId('')
                  setResumeName('')
                  setResumeJobTitle('')
                  setResumeDate('')
                  setResumeDocumentId('')
                  setResumeDocumentType('')
                  setResumeContent('')
                }}
              >
                New
              </button>
            </div>

          </div>

          <details
            className="resume-analyzer-inner-expander"
            open={expanderState.resumeContent}
            onToggle={(event) => setExpanderOpen('resumeContent', event.currentTarget.open)}
          >
            <summary>Content</summary>
            <textarea
              className="resume-analyzer-editor"
              value={resumeContent}
              onChange={(event) => setResumeContent(event.target.value)}
              placeholder="Edit resume content..."
              aria-label="Resume content"
            />
          </details>

          <details
            className="resume-analyzer-inner-expander"
            open={expanderState.savedResumes}
            onToggle={(event) => setExpanderOpen('savedResumes', event.currentTarget.open)}
          >
            <summary>
              Saved Resumes
              <button
                type="button"
                className="button expander-summary-button"
                aria-label="Refresh saved resumes"
                onClick={(event) => {
                  event.preventDefault()
                  event.stopPropagation()
                  void refreshSavedResumes()
                }}
              >
                Refresh
              </button>
            </summary>
            <div className="resume-analyzer-saved-list">
              {savedResumes.length === 0 ? (
                <p className="resume-analyzer-empty-state">No saved resumes yet.</p>
              ) : (
                savedResumes.map((resume) => (
                  <div key={resume.id} className="resume-analyzer-saved-item">
                    <details
                      className="resume-analyzer-saved-resume"
                      open={expanderState.savedResumeCards[resume.id] ?? false}
                      onToggle={(event) => {
                        const isOpen = event.currentTarget.open
                        setExpanderState((current) => ({
                          ...current,
                          savedResumeCards: {
                            ...current.savedResumeCards,
                            [resume.id]: isOpen,
                          },
                        }))
                      }}
                    >
                      <summary className="resume-analyzer-saved-summary">
                        <span>{[resume.name, resume.jobTitle, toDateInputValue(resume.date) || 'No date'].filter(Boolean).join(' ')}</span>
                        <div className="card-actions">
                          <button
                            type="button"
                            className="button"
                            onClick={() => {
                              setResumeId(String(resume.id))
                              setResumeName(resume.name)
                              setResumeJobTitle(resume.jobTitle)
                              setResumeDate(toDateInputValue(resume.date))
                              setResumeDocumentId(String(resume.documentId))
                              setResumeDocumentType(resume.document?.type ?? '')
                              setResumeContent(resume.document?.content ?? '')
                              setStatus(`Loaded resume: ${resume.name}`)
                            }}
                          >
                            Load
                          </button>
                          <button
                            type="button"
                            className="button button--delete"
                            onClick={() => {
                              void handleDeleteResume(resume.id)
                            }}
                          >
                            Delete
                          </button>
                        </div>
                      </summary>
                      <div className="resume-analyzer-saved-details">
                        <div>Job title: {resume.jobTitle || 'Not specified'}</div>
                        <div>Date: {toDateInputValue(resume.date) || 'Not specified'}</div>
                        <div>Document ID: {resume.documentId || 'Not specified'}</div>
                        <div className="resume-analyzer-resume-content">{resume.document?.content ?? ''}</div>
                      </div>
                    </details>
                  </div>
                ))
              )}
            </div>
          </details>
        </div>
      </details>

      <details id="resume-analyzer--prompt-template--container" className="resume-analyzer-expander" open={expanderState.promptTemplate} onToggle={(event) => setExpanderOpen('promptTemplate', event.currentTarget.open)}>
        <summary>
          AI Prompt Template
          {!expanderState.promptTemplate && templateName.trim() && (
            <>: {templateName.trim()}</>
          )}
        </summary>
        <div className="resume-analyzer-body">
          <div className="resume-analyzer-actions-row">
            <input
              type="text"
              value={templateName}
              onChange={(event) => setTemplateName(event.target.value)}
              placeholder="Template name..."
              aria-label="Template name"
            />
            <button type="button" className="button" onClick={() => void handleSaveTemplate()}>Save</button>
            <button
              type="button"
              className="button"
              onClick={() => {
                setTemplateId('')
                setTemplateName('')
                setTemplateContent('')
              }}
            >
              New
            </button>
          </div>

          <details className="resume-analyzer-inner-expander" open={expanderState.promptTemplateContent} onToggle={(event) => setExpanderOpen('promptTemplateContent', event.currentTarget.open)}>
            <summary>Content</summary>
            <textarea
              className="resume-analyzer-editor"
              value={templateContent}
              onChange={(event) => setTemplateContent(event.target.value)}
              placeholder="Prompt template content..."
            />
          </details>

          <details
            id="resume-analyzer--saved-prompt-templates--container"
            className="resume-analyzer-inner-expander"
            open={expanderState.savedTemplates}
            onToggle={(event) => setExpanderOpen('savedTemplates', event.currentTarget.open)}
          >
            <summary>
              Saved Templates
              <button
                type="button"
                className="button expander-summary-button"
                aria-label="Refresh saved templates"
                onClick={(event) => {
                  event.preventDefault()
                  event.stopPropagation()
                  void refreshSavedTemplates()
                }}
              >
                Refresh
              </button>
            </summary>
            {savedTemplates.length === 0 ? (
              <p className="resume-analyzer-empty-state">No saved prompt templates yet.</p>
            ) : (
              <div className="resume-analyzer-saved-list">
                {savedTemplates.map((savedTemplate) => {
                  const isOpen = expanderState.savedTemplateCards[savedTemplate.id] ?? false
                  return (
                    <div key={savedTemplate.id} className="resume-analyzer-saved-item">
                      <div
                        className="resume-analyzer-saved-summary"
                        role="button"
                        tabIndex={0}
                        aria-expanded={isOpen}
                        onClick={() => setExpanderState((current) => ({
                          ...current,
                          savedTemplateCards: { ...current.savedTemplateCards, [savedTemplate.id]: !isOpen },
                        }))}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault()
                            setExpanderState((current) => ({
                              ...current,
                              savedTemplateCards: { ...current.savedTemplateCards, [savedTemplate.id]: !isOpen },
                            }))
                          }
                        }}
                      >
                        <span>{savedTemplate.name}</span>
                        <div className="card-actions">
                          <button
                            type="button"
                            className="button"
                            onClick={(event) => {
                              event.stopPropagation()
                              setTemplateId(String(savedTemplate.id))
                              setTemplateName(savedTemplate.name)
                              setTemplateContent(savedTemplate.template)
                              setStatus(`Loaded template: ${savedTemplate.name}`)
                            }}
                          >
                            Load
                          </button>
                          <button
                            type="button"
                            className="button button--delete"
                            onClick={(event) => {
                              event.stopPropagation()
                              void handleDeleteTemplate(savedTemplate.id)
                            }}
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                      {isOpen && <div className="resume-analyzer-saved-details">{savedTemplate.template}</div>}
                    </div>
                  )
                })}
              </div>
            )}
          </details>
        </div>
      </details>
    </section>
  )
}
