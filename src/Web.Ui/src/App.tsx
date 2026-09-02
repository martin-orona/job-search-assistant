import { useEffect, useState } from 'react'
import './App.css'
import { JobPostingsTab } from './components/JobPostingsTab'
import { ResumeAnalyzerTab } from './components/ResumeAnalyzerTab'

const tabs = [
  {
    id: 'job-listings',
    label: 'Job Postings',
  },
  {
    id: 'resume-analyzer',
    label: 'Resume Analyzer',
  },
] as const

export type SavedJobPostingSummary = {
  id: number
  title: string
  company: string
  location: string
  salary: string
  workModel: 'Unknown' | 'Remote' | 'InOffice' | 'Hybrid'
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

const ACTIVE_TAB_STORAGE_KEY = 'jobSearchAssistant.activeTab'
const SELECTED_JOB_POSTING_STORAGE_KEY =
  'jobSearchAssistant.selectedJobPosting'

type TabId = (typeof tabs)[number]['id']

function isTabId(value: string | null): value is TabId {
  return tabs.some((tab) => tab.id === value)
}

function getStoredActiveTab(): TabId {
  const stored = localStorage.getItem(ACTIVE_TAB_STORAGE_KEY)
  return isTabId(stored) ? stored : tabs[0].id
}

function getStoredSelectedJobPosting(): SavedJobPostingSummary | null {
  const stored = localStorage.getItem(SELECTED_JOB_POSTING_STORAGE_KEY)
  if (!stored) {
    return null
  }
  try {
    return JSON.parse(stored) as SavedJobPostingSummary
  } catch {
    return null
  }
}

function App() {
  const [activeTab, setActiveTab] = useState<TabId>(getStoredActiveTab)
  const [selectedJobPosting, setSelectedJobPosting] =
    useState<SavedJobPostingSummary | null>(getStoredSelectedJobPosting)

  useEffect(() => {
    localStorage.setItem(ACTIVE_TAB_STORAGE_KEY, activeTab)
  }, [activeTab])

  useEffect(() => {
    if (selectedJobPosting) {
      localStorage.setItem(
        SELECTED_JOB_POSTING_STORAGE_KEY,
        JSON.stringify(selectedJobPosting),
      )
    } else {
      localStorage.removeItem(SELECTED_JOB_POSTING_STORAGE_KEY)
    }
  }, [selectedJobPosting])

  const activeTabData = tabs.find((tab) => tab.id === activeTab) ?? tabs[0]

  return (
    <main className="app-shell">
      <section className="tabs" aria-label="Job search tools">
        <div role="tablist" aria-orientation="horizontal" className="tab-list">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              id={`${tab.id}-tab`}
              role="tab"
              type="button"
              aria-selected={tab.id === activeTab}
              aria-controls={`${tab.id}-panel`}
              tabIndex={tab.id === activeTab ? 0 : -1}
              className="tab-button"
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div
          id={`${activeTabData.id}-panel`}
          role="tabpanel"
          aria-labelledby={`${activeTabData.id}-tab`}
          className="tab-panel"
        >
          {activeTab === 'job-listings' ? (
            <JobPostingsTab
              onAnalyze={(jobPosting) => {
                setSelectedJobPosting(jobPosting)
                setActiveTab('resume-analyzer')
              }}
            />
          ) : (
            <ResumeAnalyzerTab jobPosting={selectedJobPosting} />
          )}
        </div>
      </section>
    </main>
  )
}

export default App
