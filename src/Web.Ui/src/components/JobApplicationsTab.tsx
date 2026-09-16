import { useEffect, useState } from "react";

type SavedJobApplicationSummary = {
  id: number;
  company: string;
  role: string;
  appliedOnDate?: string | null;
  status?: string | number;
  sourceId?: number;
  source?: {
    id: number;
    name: string;
  } | null;
  jobPostingId?: number;
  jobPosting?: {
    id: number;
    title: string;
    company?: string;
    location?: string;
    salary?: string;
    workModel?: string;
    url?: string;
  } | null;
  createdAt?: string;
  updatedAt?: string;
};

function formatApplicationStatus(value?: string | number) {
  if (typeof value === "string") {
    return value;
  }

  switch (value) {
    case 0:
      return "Unknown";
    case 1:
      return "Draft";
    case 2:
      return "Saved";
    case 3:
      return "Applied";
    case 4:
      return "Interviewing";
    case 5:
      return "Offer";
    case 6:
      return "Accepted";
    case 7:
      return "Rejected";
    case 8:
      return "Withdrawn";
    case 9:
      return "Ghosted";
    case 10:
      return "Other";
    default:
      return "Unknown";
  }
}

function formatApplicationDate(value?: string | null) {
  if (!value) {
    return "No date";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

async function fetchSavedJobApplications() {
  const response = await fetch("/api/v1/job-applications?deep=true");

  if (!response.ok) {
    throw new Error((await response.text()) || "Unable to load saved job applications.");
  }

  return (await response.json()) as SavedJobApplicationSummary[];
}

export function JobApplicationsTab() {
  const [savedApplications, setSavedApplications] = useState<SavedJobApplicationSummary[]>([]);
  const [statusMessage, setStatusMessage] = useState("");
  const [isExpanded, setIsExpanded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  async function loadSavedApplications() {
    setIsLoading(true);
    setStatusMessage("");

    try {
      const applications = await fetchSavedJobApplications();
      setSavedApplications(applications);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to load saved job applications.";
      setStatusMessage(message);
      setSavedApplications([]);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadSavedApplications();
  }, []);

  return (
    <section id="job-applications--container" className="job-applications">
      <h1>Job Applications</h1>
      <p>Track application activity, follow-ups, and interview progress.</p>

      <details
        id="job-applications--saved-applications--container"
        className="job-applications-expander"
        open={isExpanded}
        onToggle={(event) => setIsExpanded(event.currentTarget.open)}
      >
        <summary className="job-postings-expander-summary">
          <span>Saved Applications</span>
          <button
            id="job-applications--saved-applications--refresh-button"
            type="button"
            className="button expander-summary-button"
            aria-label="Refresh saved applications"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              void loadSavedApplications();
            }}
          >
            Refresh
          </button>
        </summary>

        {statusMessage ? <p className="job-applications-status">{statusMessage}</p> : null}

        {isLoading ? (
          <p className="job-applications-empty-state">Loading saved applications...</p>
        ) : savedApplications.length === 0 ? (
          <div id="job-applications--saved-applications--list" className="job-applications-list">
            <p className="job-applications-empty-state">No saved job applications yet.</p>
          </div>
        ) : (
          <div id="job-applications--saved-applications--list" className="job-applications-list">
            {savedApplications.map((application) => (
              <div key={application.id} className="job-applications-saved-item">
                <div className="job-applications-saved-summary">
                  <span>
                    {application.company} | {application.role}
                  </span>
                  <span>{formatApplicationStatus(application.status)}</span>
                </div>

                <div className="job-applications-saved-details">
                  <div>{formatApplicationDate(application.appliedOnDate)}</div>
                  {application.jobPosting ? (
                    <div>
                      {application.jobPosting.title}
                      {application.jobPosting.company ? ` · ${application.jobPosting.company}` : ""}
                    </div>
                  ) : null}
                  {application.source ? <div>{application.source.name}</div> : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </details>
    </section>
  );
}
