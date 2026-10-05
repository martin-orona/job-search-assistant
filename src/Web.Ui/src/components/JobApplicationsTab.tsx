import { useEffect, useState } from "react";

import { api } from "../utilities/api";
import { useSimpleDialogErrors } from "../utilities/componentState";
import { getPatch } from "../utilities/entities";
import type { DeleteEntityParams, SaveEntityParams } from "./Entity";
import { EntitySection } from "./EntitySection";
import { JobApplicationUi, type JobApplication, type SavedJobApplication } from "./JobApplication";

export function JobApplicationsTab() {
  const [savedApplications, setSavedApplications] = useState<SavedJobApplication[]>([]);
  const [_statusMessage, setStatusMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [deletionErrors, setDeletionError, clearDeletionError] = useSimpleDialogErrors();

  useEffect(() => {
    void loadSavedApplications();
  }, []);

  return (
    <section id="job-applications--container" className="job-applications">
      <h1>Job Applications</h1>
      <p>Track application activity, follow-ups, and interview progress.</p>

      <EntitySection<JobApplication>
        id="job-applications--saved-applications"
        title="Saved Applications"
        className="job-applications-list"
        data={savedApplications}
        ListItemUi={JobApplicationUi}
        itemPropName="application"
        isLoading={isLoading}
        emptyListMessage="No saved job applications yet."
        reloadData={loadSavedApplications}
        onCreateRecord={createNewApplication}
        onRemoveRecord={onRemoveApplicationFromDisplay}
        onSave={saveEditedApplication}
        onDelete={deleteApplication}
        deletionErrors={deletionErrors}
        setDeletionError={setDeletionError}
        clearDeletionError={clearDeletionError}
      />
    </section>
  );

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

  async function saveEditedApplication({ entity: updated }: SaveEntityParams<JobApplication>) {
    if (!updated) {
      throw new Error("Failed to save application. Updated application is required.");
    }

    if (!updated.id) {
      throw new Error("Failed to save application. Updated application is missing [id].");
    }

    const original = savedApplications.find((item) => item.id === updated.id);
    if (!original) {
      throw new Error("Failed to save application. No matching original application found.");
    }

    try {
      await api.patch<JobApplication>({
        endpoint: "/api/v1/job-applications",
        id: updated.id,
        data: getPatch(original, updated),
        defaultErrorMessage: "Unable to update the saved application.",
      });

      await loadSavedApplications();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to update the saved application.";
      setStatusMessage(message);
      throw error;
    }
  }

  async function fetchSavedJobApplications() {
    const response = await fetch("/api/v1/job-applications?deep=true");

    if (!response.ok) {
      throw new Error((await response.text()) || "Unable to load saved job applications.");
    }

    return (await response.json()) as SavedJobApplication[];
  }

  async function createNewApplication() {
    setSavedApplications((prev) => [{ id: 0 } as JobApplication, ...prev]);
  }

  async function onRemoveApplicationFromDisplay(id: number) {
    setSavedApplications((prev) => prev.filter((item) => item.id !== id));
  }

  async function deleteApplication({ id }: DeleteEntityParams) {
    await api.delete({ endpoint: "/api/v1/job-applications", id, defaultErrorMessage: `Unable to delete saved job application [${id}].` });
    onRemoveApplicationFromDisplay(id);
  }
}
