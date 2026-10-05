import { useEffect, useEffectEvent, useRef, useState } from "react";
import { useSimpleDialogErrors } from "../utilities/componentState";
import { getPatch } from "../utilities/entities";
import { toDateInputValue } from "../utilities/uiFormatting";
import { AiPromptUi, type AiPrompt } from "./AiPrompt";
import { AiPromptTemplateUi, type AiPromptTemplate } from "./AiPromptTemplate";
import { DeleteDialog } from "./Dialog";
import type { DeleteEntityHandler, DeleteEntityParams, Entity, EntityKey, SaveEntityParams } from "./Entity";
import { EntitySection as SharedEntitySection } from "./EntitySection";
import { ActionableExpander_new, ExpandableDataList_new } from "./Expander";
import { JobApplicationUi, type JobApplication } from "./JobApplication";
import { JobPostingUi, type JobPosting } from "./JobPosting";
import { JobQuestionUi, type JobQuestion } from "./JobQuestion";
import { JobSourceUi, type JobSource } from "./JobSource";
import { ReferencedByDisplay } from "./ReferencedByDisplay";
import { ResumeUi, type Resume } from "./Resume";

type RecordReference = {
  key: string;
  label: string;
  recordId: number;
  targetEntity: { key: EntityKey; containerId: string };
};

type DeleteReference = {
  id: number;
  label: string;
  entityKey: EntityKey;
};

export type EntityConfig<T> = {
  key: EntityKey;
  label: string;
  endpoint: string;
  state: T[];
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
  recordControlId: (id: number, controlName: string) => string;
  createButtonId: string;
  editorId: string;
  editorSaveButtonId: string;
  editorCancelButtonId: string;
  editorFieldId: (field: string) => string;
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

function DBViewerTab() {
  const [jobPostings, setJobPostings] = useState<JobPosting[]>([]);
  const [jobApplications, setJobApplications] = useState<JobApplication[]>([]);
  const [jobSources, setJobSources] = useState<JobSource[]>([]);
  const [jobQuestions, setJobQuestions] = useState<JobQuestion[]>([]);
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [aiPromptTemplates, setAiPromptTemplates] = useState<AiPromptTemplate[]>([]);
  const [aiPrompts, setAiPrompts] = useState<AiPrompt[]>([]);
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
  const [expandedEntities, setExpandedEntities] = useState<Record<EntityKey, boolean>>({
    "job-postings": false,
    "job-applications": false,
    "job-sources": false,
    "job-questions": false,
    resumes: false,
    "ai-prompt-templates": false,
    "ai-prompts": false,
  });
  const [expandedRecords, setExpandedRecords] = useState<Partial<Record<EntityKey, Record<number, boolean>>>>({});
  const [dbBackupsLoading, setDbBackupsLoading] = useState(false);
  const [dbBackupsError, setDbBackupsError] = useState("");
  const [error, setError] = useState("");
  const hasInitialLoadRef = useRef(false);

  type EntityKey = "job-postings" | "job-applications" | "job-sources" | "job-questions" | "resumes" | "ai-prompt-templates" | "ai-prompts";

  type EntityTypeMap = {
    "job-postings": JobPosting;
    "job-applications": JobApplication;
    "job-sources": JobSource;
    "job-questions": JobQuestion;
    resumes: Resume;
    "ai-prompt-templates": AiPromptTemplate;
    "ai-prompts": AiPrompt;
  };
  type EntityConfigMap = {
    [K in EntityKey]: EntityConfig<EntityTypeMap[K]>;
  };

  const entityConfigs: EntityConfigMap = {
    "job-postings": {
      key: "job-postings",
      label: "Job Posting",
      endpoint: "/api/v1/job-postings",
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
      recordControlId: (id, controlName) => `db-viewer--job-postings--${controlName}--record-${id}`,
      createButtonId: "db-viewer--job-postings--create-button",
      editorId: "db-viewer--job-postings--editor",
      editorSaveButtonId: "db-viewer--job-postings--editor--save-button",
      editorCancelButtonId: "db-viewer--job-postings--editor--cancel-button",
      editorFieldId: (field) => `db-viewer--job-postings--editor--${field}`,
    },
    "job-applications": {
      key: "job-applications",
      label: "Job Application",
      endpoint: "/api/v1/job-applications",
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
      recordControlId: (id, controlName) => `db-viewer--job-applications--${controlName}--record-${id}`,
      createButtonId: "db-viewer--job-applications--create-button",
      editorId: "db-viewer--job-applications--editor",
      editorSaveButtonId: "db-viewer--job-applications--editor--save-button",
      editorCancelButtonId: "db-viewer--job-applications--editor--cancel-button",
      editorFieldId: (field) => `db-viewer--job-applications--editor--${field}`,
    },
    "job-sources": {
      key: "job-sources",
      label: "Job Source",
      endpoint: "/api/v1/job-sources",
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
      recordControlId: (id, controlName) => `db-viewer--job-sources--${controlName}--record-${id}`,
      createButtonId: "db-viewer--job-sources--create-button",
      editorId: "db-viewer--job-sources--editor",
      editorSaveButtonId: "db-viewer--job-sources--editor--save-button",
      editorCancelButtonId: "db-viewer--job-sources--editor--cancel-button",
      editorFieldId: (field) => `db-viewer--job-sources--editor--${field}`,
    },
    "job-questions": {
      key: "job-questions",
      label: "Job Question",
      endpoint: "/api/v1/job-questions",
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
      recordControlId: (id, controlName) => `db-viewer--job-questions--${controlName}--record-${id}`,
      createButtonId: "db-viewer--job-questions--create-button",
      editorId: "db-viewer--job-questions--editor",
      editorSaveButtonId: "db-viewer--job-questions--editor--save-button",
      editorCancelButtonId: "db-viewer--job-questions--editor--cancel-button",
      editorFieldId: (field) => `db-viewer--job-questions--editor--${field}`,
    },
    resumes: {
      key: "resumes",
      label: "Resume",
      endpoint: "/api/v1/resumes",
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
      recordControlId: (id, controlName) => `db-viewer--resumes--${controlName}--record-${id}`,
      createButtonId: "db-viewer--resumes--create-button",
      editorId: "db-viewer--resumes--editor",
      editorSaveButtonId: "db-viewer--resumes--editor--save-button",
      editorCancelButtonId: "db-viewer--resumes--editor--cancel-button",
      editorFieldId: (field) => `db-viewer--resumes--editor--${field}`,
    },
    "ai-prompt-templates": {
      key: "ai-prompt-templates",
      label: "AI Prompt Template",
      endpoint: "/api/v1/ai-prompt-templates",
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
      recordControlId: (id, controlName) => `db-viewer--ai-prompt-templates--${controlName}--record-${id}`,
      createButtonId: "db-viewer--ai-prompt-templates--create-button",
      editorId: "db-viewer--ai-prompt-templates--editor",
      editorSaveButtonId: "db-viewer--ai-prompt-templates--editor--save-button",
      editorCancelButtonId: "db-viewer--ai-prompt-templates--editor--cancel-button",
      editorFieldId: (field) => `db-viewer--ai-prompt-templates--editor--${field}`,
    },
    "ai-prompts": {
      key: "ai-prompts",
      label: "AI Prompt",
      endpoint: "/api/v1/ai-prompts",
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
      recordControlId: (id, controlName) => `db-viewer--ai-prompts--${controlName}--record-${id}`,
      createButtonId: "db-viewer--ai-prompts--create-button",
      editorId: "db-viewer--ai-prompts--editor",
      editorSaveButtonId: "db-viewer--ai-prompts--editor--save-button",
      editorCancelButtonId: "db-viewer--ai-prompts--editor--cancel-button",
      editorFieldId: (field) => `db-viewer--ai-prompts--editor--${field}`,
    },
  };

  const loadInitialData = useEffectEvent(() => {
    void Promise.all([
      loadDbBackups(),
      ...Object.keys(entityConfigs).map((key) => {
        return loadEntityFor(key as EntityKey);
      }),
    ]);
  });

  useEffect(() => {
    if (hasInitialLoadRef.current) {
      return;
    }

    hasInitialLoadRef.current = true;
    loadInitialData();
  }, []);

  const aiPromptEntityConfig = entityConfigs["ai-prompts"];

  function getAiPromptReferences(predicate: (prompt: AiPrompt) => boolean): RecordReference[] {
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

    // TODO: this assumes that all records are loaded in the UI at the same time, that is not a safe assumption. Getting the references should be a query to the server.
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
      case "job-questions": {
        return jobApplications
          .filter((application) => application.questions?.some((question) => question.id === targetId))
          .map((application) => ({
            key: `job-application-${application.id}`,
            label: `Job Application ${application.id} · ${application.company || "Untitled job application"}`,
            recordId: application.id,
            targetEntity: entityConfigs["job-applications"],
          }));
      }
      case "job-applications":
      default:
        return [];
    }
  }

  return (
    <section className="db-viewer" id="db-viewer--container">
      <h1>DB Viewer</h1>

      {error ? <p className="db-viewer-status">{error}</p> : null}

      {(() => {
        return (
          <ExpandableDataList_new
            id="db-viewer--db-backups"
            className="db-backups"
            title="DB Backups"
            data={snapshotFiles.map((file, index) => {
              return { id: index + 1, name: file } as unknown as Entity;
            })}
            isLoading={dbBackupsLoading}
            loadingMessage="Loading database backups..."
            emptyListMessage="No saved database backups yet."
            actions={
              <button
                id="db-viewer--db-backups--create-snapshot-button"
                type="button"
                className="button button--secondary"
                disabled={dbBackupsLoading}
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  void createDbSnapshot();
                }}
              >
                Create Snapshot
              </button>
            }
            onRefresh={(event) => {
              event.preventDefault();
              event.stopPropagation();
              void loadDbBackups();
            }}
            generateListItem={({
              item,
            }: {
              item: Entity;
              index: number;
              list: Entity[];
              onDelete: DeleteEntityHandler;
              props?: Record<string, unknown>;
            }) => {
              return (
                <ActionableExpander_new
                  id={`db-viewer--db-backups--item-${item.id}`}
                  title={<>{(item as { name?: string }).name || (item as { title?: string }).title}</>}
                  className="db-backup"
                  expandable={false}
                  actions={<></>}
                >
                  <>
                    {dbBackupsError ? (
                      <p id="db-viewer--db-backups--refresh-status" className="db-viewer-status" role="status" aria-live="polite">
                        {dbBackupsError}
                      </p>
                    ) : null}
                  </>
                </ActionableExpander_new>
              );
            }}
          ></ExpandableDataList_new>
        );
      })()}

      <DBViewerEntitySection<JobApplication>
        config={entityConfigs["job-applications"]}
        ListItemUi={JobApplicationUi}
        itemPropName="application"
        isLoading={loading["job-applications"]}
        refreshError={refreshErrors["job-applications"]}
        open={expandedEntities["job-applications"]}
        expandedRecords={expandedRecords["job-applications"]}
        onRecordExpansionChange={(id, open) => setRecordExpanded("job-applications", id, open)}
        setOpen={(open) => setExpandedEntities((current) => ({ ...current, "job-applications": open }))}
        reloadData={() => loadEntityFor("job-applications")}
        onSave={async ({ entity }) => {
          await saveEditorItem("job-applications", entity.id, entity, true);
        }}
        onDelete={async ({ id }: DeleteEntityParams) => {
          await confirmDeleteEntityRecord("job-applications", id);
        }}
        importFile={importExportSelection}
        setError={setError}
        renderRecordChildren={(item) => (
          <ReferencedByDisplay references={getIncomingReferences("job-applications", item.id)} onOpenRecord={openEntityRecord} />
        )}
        exportLabel={(item) => item.role}
      />

      <DBViewerEntitySection<JobPosting>
        config={entityConfigs["job-postings"]}
        ListItemUi={JobPostingUi}
        itemPropName="posting"
        isLoading={loading["job-postings"]}
        refreshError={refreshErrors["job-postings"]}
        open={expandedEntities["job-postings"]}
        expandedRecords={expandedRecords["job-postings"]}
        onRecordExpansionChange={(id, open) => setRecordExpanded("job-postings", id, open)}
        setOpen={(open) => setExpandedEntities((current) => ({ ...current, "job-postings": open }))}
        reloadData={() => loadEntityFor("job-postings")}
        onSave={async ({ entity }) => {
          await saveEditorItem("job-postings", entity.id, entity, true);
        }}
        onDelete={async ({ id }: DeleteEntityParams) => {
          await confirmDeleteEntityRecord("job-postings", id);
        }}
        importFile={importExportSelection}
        setError={setError}
        renderRecordChildren={(item) => (
          <ReferencedByDisplay references={getIncomingReferences("job-postings", item.id)} onOpenRecord={openEntityRecord} />
        )}
        exportLabel={(item) => item.title}
      />

      <DBViewerEntitySection<JobSource>
        config={entityConfigs["job-sources"]}
        ListItemUi={JobSourceUi}
        itemPropName="source"
        isLoading={loading["job-sources"]}
        refreshError={refreshErrors["job-sources"]}
        open={expandedEntities["job-sources"]}
        expandedRecords={expandedRecords["job-sources"]}
        onRecordExpansionChange={(id, open) => setRecordExpanded("job-sources", id, open)}
        setOpen={(open) => setExpandedEntities((current) => ({ ...current, "job-sources": open }))}
        reloadData={() => loadEntityFor("job-sources")}
        onSave={async ({ entity }) => {
          await saveEditorItem("job-sources", entity.id, entity, true);
        }}
        onDelete={async ({ id }: DeleteEntityParams) => {
          await confirmDeleteEntityRecord("job-sources", id);
        }}
        importFile={importExportSelection}
        setError={setError}
        renderRecordChildren={(item) => (
          <ReferencedByDisplay references={getIncomingReferences("job-sources", item.id)} onOpenRecord={openEntityRecord} />
        )}
        exportLabel={(item) => item.name}
      />

      <DBViewerEntitySection<JobQuestion>
        config={entityConfigs["job-questions"]}
        ListItemUi={JobQuestionUi}
        itemPropName="question"
        isLoading={loading["job-questions"]}
        refreshError={refreshErrors["job-questions"]}
        open={expandedEntities["job-questions"]}
        expandedRecords={expandedRecords["job-questions"]}
        onRecordExpansionChange={(id, open) => setRecordExpanded("job-questions", id, open)}
        setOpen={(open) => setExpandedEntities((current) => ({ ...current, "job-questions": open }))}
        reloadData={() => loadEntityFor("job-questions")}
        onSave={async ({ entity }) => {
          await saveEditorItem("job-questions", entity.id, entity, true);
        }}
        onDelete={async ({ id }: DeleteEntityParams) => {
          await confirmDeleteEntityRecord("job-questions", id);
        }}
        importFile={importExportSelection}
        setError={setError}
        renderRecordChildren={(item) => (
          <ReferencedByDisplay references={getIncomingReferences("job-questions", item.id)} onOpenRecord={openEntityRecord} />
        )}
        exportLabel={(item) => item.question}
      />

      <DBViewerEntitySection<Resume>
        config={entityConfigs["resumes"]}
        ListItemUi={ResumeUi}
        itemPropName="resume"
        isLoading={loading["resumes"]}
        refreshError={refreshErrors["resumes"]}
        open={expandedEntities["resumes"]}
        expandedRecords={expandedRecords["resumes"]}
        onRecordExpansionChange={(id, open) => setRecordExpanded("resumes", id, open)}
        setOpen={(open) => setExpandedEntities((current) => ({ ...current, resumes: open }))}
        reloadData={() => loadEntityFor("resumes")}
        onSave={async ({ entity }) => {
          await saveEditorItem("resumes", entity.id, entity, true);
        }}
        onDelete={async ({ id }: DeleteEntityParams) => {
          await confirmDeleteEntityRecord("resumes", id);
        }}
        importFile={importExportSelection}
        setError={setError}
        renderRecordChildren={(item) => (
          <ReferencedByDisplay references={getIncomingReferences("resumes", item.id)} onOpenRecord={openEntityRecord} />
        )}
        exportLabel={(item) => item.name}
      />

      <DBViewerEntitySection<AiPromptTemplate>
        config={entityConfigs["ai-prompt-templates"]}
        ListItemUi={AiPromptTemplateUi}
        itemPropName="template"
        isLoading={loading["ai-prompt-templates"]}
        refreshError={refreshErrors["ai-prompt-templates"]}
        open={expandedEntities["ai-prompt-templates"]}
        expandedRecords={expandedRecords["ai-prompt-templates"]}
        onRecordExpansionChange={(id, open) => setRecordExpanded("ai-prompt-templates", id, open)}
        setOpen={(open) => setExpandedEntities((current) => ({ ...current, "ai-prompt-templates": open }))}
        reloadData={() => loadEntityFor("ai-prompt-templates")}
        onSave={async ({ entity }) => {
          await saveEditorItem("ai-prompt-templates", entity.id, entity, true);
        }}
        onDelete={async ({ id }: DeleteEntityParams) => {
          await confirmDeleteEntityRecord("ai-prompt-templates", id);
        }}
        importFile={importExportSelection}
        setError={setError}
        renderRecordChildren={(item) => (
          <ReferencedByDisplay references={getIncomingReferences("ai-prompt-templates", item.id)} onOpenRecord={openEntityRecord} />
        )}
        exportLabel={(item) => item.name}
      />

      <DBViewerEntitySection<AiPrompt>
        config={entityConfigs["ai-prompts"]}
        ListItemUi={AiPromptUi}
        itemPropName="prompt"
        isLoading={loading["ai-prompts"]}
        refreshError={refreshErrors["ai-prompts"]}
        open={expandedEntities["ai-prompts"]}
        expandedRecords={expandedRecords["ai-prompts"]}
        onRecordExpansionChange={(id, open) => setRecordExpanded("ai-prompts", id, open)}
        setOpen={(open) => setExpandedEntities((current) => ({ ...current, "ai-prompts": open }))}
        reloadData={() => loadEntityFor("ai-prompts")}
        onSave={async ({ entity }) => {
          await saveEditorItem("ai-prompts", entity.id, entity, true);
        }}
        onDelete={async ({ id, include }) => {
          await confirmDeleteEntityRecord("ai-prompts", id, include);
        }}
        deleteReferences={(id) => getDeleteReferences("ai-prompts", id)}
        importFile={importExportSelection}
        setError={setError}
        renderRecordChildren={(item) => (
          <>
            <ReferencedByDisplay
              label="References"
              references={getDeleteReferences("ai-prompts", item.id).map((reference) => ({
                key: `${reference.entityKey}:${reference.id}`,
                label: reference.label,
                recordId: reference.id,
                targetEntity: { key: reference.entityKey, containerId: entityConfigs[reference.entityKey].containerId },
              }))}
              onOpenRecord={openEntityRecord}
            />
            <ReferencedByDisplay references={getIncomingReferences("ai-prompts", item.id)} onOpenRecord={openEntityRecord} />
          </>
        )}
        exportLabel={(item) => item.name}
      />
    </section>
  );

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
      record: {
        id?: number;
      },
      label: string,
    ) => {
      if (!record || Number(record.id ?? 0) <= 0) {
        return;
      }

      references.push({
        id: Number(record.id ?? 0),
        label,
        entityKey,
      });
    };

    const jobPosting = prompt.jobPosting;
    addReference(
      "job-postings",
      jobPosting,
      `${jobPosting.title || "Untitled job posting"} (Job Posting ${jobPosting.id ?? prompt.jobPostingId})`,
    );

    const resume = prompt.resume;
    addReference("resumes", resume, `${resume.name || "Untitled resume"} (Resume ${resume.id ?? prompt.resumeId})`);

    const template = prompt.aiPromptTemplate;
    addReference(
      "ai-prompt-templates",
      template,
      `${template.name || "Untitled AI prompt template"} (AI Prompt Template ${template.id ?? prompt.aiPromptTemplateId})`,
    );

    return references;
  }

  async function confirmDeleteEntityRecord(key: EntityKey, id: number, selectedReferences: DeleteReference[] = []) {
    const entityConfig = entityConfigs[key];
    if (!entityConfig) {
      return;
    }

    const row = document.getElementById(`${entityConfig.containerId}--record-${id}`);
    const label = entityConfig.label.toLowerCase();
    const endpoint = entityConfigs[key].endpoint;

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

        throw new Error(detail || `Unable to delete this saved ${label}.`);
      }

      entityConfig.setState((current: any) =>
        current.filter((item: Record<string, unknown>) => Number((item as { id?: number }).id ?? 0) !== id),
      );

      for (const reference of selectedReferences) {
        entityConfigs[reference.entityKey].setState((current: any) =>
          current.filter((item: Record<string, unknown>) => Number((item as { id?: number }).id ?? 0) !== reference.id),
        );
      }

      setError("");
    } catch (deleteError) {
      row?.classList.remove("db-viewer-list-item--removing");
      setError("");
      throw deleteError;
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

  async function loadEntityFor<K extends EntityKey>(key: K) {
    const config = entityConfigs[key];

    return loadEntity<EntityTypeMap[K]>(
      key,
      config.endpoint + "?deep=true",
      config.setState as React.Dispatch<React.SetStateAction<EntityTypeMap[K][]>>,
    );
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
      setRefreshErrors((current) => ({ ...current, [key]: `Unable to refresh ${entityConfigs[key].label}. (${message})` }));
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

  async function createDbSnapshot() {
    try {
      setDbBackupsLoading(true);
      await loadJson<{ path: string }>("/api/v1/admin/db-snapshot");
      await loadDbBackups();
    } catch (snapshotError) {
      setDbBackupsError(snapshotError instanceof Error ? snapshotError.message : "Unable to create a database snapshot.");
    } finally {
      setDbBackupsLoading(false);
    }
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
        const recordElement = document.getElementById(`${entityConfig.containerId}--record-${recordId}`);
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

      const imported = records;

      if (imported.length === 0) {
        setError("The selected file does not contain valid records for this entity.");
        return;
      }

      function zeroOutIds(record: Record<string, unknown>) {
        record.id = 0;

        for (const key in record) {
          // if the property name ends with Id, and there is another property with the pre-Id name, zero out the Id
          if (key.endsWith("Id")) {
            const baseKey = key.slice(0, -2);
            if (record.hasOwnProperty(baseKey)) {
              record[key] = 0;
            }
          }

          // recursively zero out IDs for nested objects
          if (typeof record[key] === "object" && record[key] !== null) {
            zeroOutIds(record[key] as Record<string, unknown>);
          }
        }
      }

      const persistedImported: Record<string, unknown>[] = [];

      for (const item of imported) {
        zeroOutIds(item);

        const endpoint = entityConfigs[key].endpoint;

        const response = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(item),
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

      await loadEntityFor(key);

      setExpandedEntities((current) => ({ ...current, [key]: true }));
      flashImportedRecords(key, importedIds);
      setError("");
    } catch (importError) {
      const message = importError instanceof Error ? importError.message : "Unable to import selected file.";
      setError(`Unable to import file. (${message})`);
    }
  }

  function setRecordExpanded(key: EntityKey, id: number, open: boolean) {
    setExpandedRecords((current) => ({
      ...current,
      [key]: { ...current[key], [id]: open },
    }));
  }

  function openEntityRecord(key: EntityKey, id: number | null | undefined) {
    if (!id || id <= 0) {
      return;
    }

    setExpandedEntities((current) => ({
      ...current,
      [key]: true,
    }));
    setRecordExpanded(key, id, true);

    requestAnimationFrame(() => {
      const entityConfig = entityConfigs[key];
      if (!entityConfig) {
        throw new Error(`Cannot open record for entity key ${key}: missing entity config.`);
      }

      const targetId = `${entityConfig.containerId}--record-${id}`;
      const target = document.getElementById(targetId);
      if (!target) {
        return;
      }

      target.classList.remove("db-viewer-list-item--highlight");
      void target.offsetWidth;
      target.classList.add("db-viewer-list-item--highlight");
      window.setTimeout(() => target.classList.remove("db-viewer-list-item--highlight"), 1800);

      target.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }

  async function saveEditorItem(key: EntityKey, itemId: number | null, draft: Record<string, unknown>, propagateError = false) {
    try {
      let payload: Record<string, unknown> = {};
      let savedRecord: Record<string, unknown> | null = null;
      const isCreate = itemId === null || itemId <= 0;

      if (!isCreate) {
        const current = entityConfigs[key].state.find((item) => item.id === itemId);
        if (!current) {
          if (propagateError) {
            throw new Error("Unable to save the record: it is no longer in the loaded list.");
          }
          return;
        }
        const next = { ...current, ...draft };
        payload = getPatch(current, next);
        savedRecord = next;
      } else {
        payload = draft;
      }

      const endpoint = entityConfigs[key].endpoint;

      const response = await fetch(isCreate ? endpoint : `${endpoint}/${itemId}`, {
        method: isCreate ? "POST" : "PATCH",
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

      if (isCreate) {
        entityConfigs[key].setState((current: any) => [updated, ...current]);
      } else {
        await loadEntityFor(key);
      }

      setError("");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save the record.");
      if (propagateError) {
        throw saveError;
      }
    }
  }
}

function DBViewerEntitySection<T extends Entity>({
  config,
  ListItemUi,
  itemPropName,
  isLoading,
  refreshError,
  open,
  expandedRecords,
  onRecordExpansionChange,
  setOpen,
  reloadData,
  onSave,
  onDelete,
  importFile,
  setError,
  renderRecordChildren,
  exportLabel,
  deleteReferences,
}: {
  config: EntityConfig<T>;
  ListItemUi: React.ComponentType<any>;
  itemPropName: string;
  isLoading: boolean;
  refreshError: string;
  open: boolean;
  expandedRecords: Record<number, boolean> | undefined;
  onRecordExpansionChange: (id: number, open: boolean) => void;
  setOpen: (open: boolean) => void;
  reloadData: () => Promise<void>;
  onSave: (params: SaveEntityParams<T>) => Promise<void>;
  onDelete: (params: DeleteEntityParams & { include?: DeleteReference[] }) => Promise<void>;
  deleteReferences?: (id: number) => DeleteReference[];
  importFile: (key: EntityKey, file: File | null) => Promise<void>;
  setError: React.Dispatch<React.SetStateAction<string>>;
  renderRecordChildren: (item: T) => React.ReactNode;
  exportLabel: (item: T) => string;
}) {
  const [isImporting, setIsImporting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [deletionErrors, setDeletionError, clearDeletionError] = useSimpleDialogErrors();

  return (
    <>
      {refreshError && (
        <p id={config.refreshStatusId} className="db-viewer-status" role="status" aria-live="polite">
          {refreshError}
        </p>
      )}
      <SharedEntitySection<T>
        id={config.containerId}
        title={`${config.label}s`}
        className={config.key}
        data={config.state}
        expandedRecords={expandedRecords}
        onRecordExpansionChange={onRecordExpansionChange}
        ListItemUi={ListItemUi}
        itemPropName={itemPropName}
        isLoading={isLoading}
        open={open || isImporting || isExporting}
        onExpanded={() => setOpen(true)}
        onCollapsed={() => setOpen(false)}
        reloadData={reloadData}
        onCreateRecord={() => {
          const newRecord = getEmptyRecord(config.key);
          config.setState((current) => [newRecord as T, ...current]);
        }}
        onRemoveRecord={(id) => config.setState((current) => current.filter((item) => item.id !== id))}
        onSave={onSave}
        onDelete={onDelete}
        deletionErrors={deletionErrors}
        setDeletionError={setDeletionError}
        clearDeletionError={clearDeletionError}
        deleteDialog={({ itemId, onConfirm, onCancel }) => (
          <DBViewerDeleteDialog
            config={config}
            itemId={itemId}
            references={deleteReferences?.(itemId) ?? []}
            renderRecordChildren={renderRecordChildren}
            onDelete={onDelete}
            onConfirm={onConfirm}
            onCancel={onCancel}
          />
        )}
        renderRecordChildren={renderRecordChildren}
        additionalActions={
          <>
            <button
              id={config.exportButtonId}
              type="button"
              className="button button--secondary"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                setOpen(true);
                setIsExporting(true);
              }}
            >
              Export
            </button>
            <button
              id={config.importButtonId}
              type="button"
              className="button button--secondary"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                setIsImporting(true);
              }}
            >
              Import
            </button>
          </>
        }
        importDialog={
          <ImportDialog entity={config} isOpen={isImporting} setIsOpen={setIsImporting} importFile={importFile} setError={setError} />
        }
        exportDialog={
          <ExportDialog config={config} isOpen={isExporting} setIsOpen={setIsExporting} setError={setError} exportLabel={exportLabel} />
        }
      />
    </>
  );
}

function DBViewerDeleteDialog<T extends Entity>({
  config,
  itemId,
  references,
  renderRecordChildren,
  onDelete,
  onConfirm,
  onCancel,
}: {
  config: EntityConfig<T>;
  itemId: number;
  references: DeleteReference[];
  renderRecordChildren: (item: T) => React.ReactNode;
  onDelete: (params: DeleteEntityParams & { include?: DeleteReference[] }) => Promise<void>;
  onConfirm: DeleteEntityHandler;
  onCancel: (id: number) => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState("");
  const record = config.state.find((item) => item.id === itemId);
  return (
    <DeleteDialog
      id={error ? config.deleteFailureDialogId : config.deleteDialogId}
      label={config.label}
      itemId={itemId}
      error={error}
      confirmButtonId={config.deleteConfirmButtonId}
      cancelButtonId={error ? config.deleteFailureDismissButtonId : config.deleteCancelButtonId}
      onCancel={onCancel}
      onConfirm={async (params) => {
        try {
          await onDelete({ ...params, include: references.filter((reference) => selected.has(`${reference.entityKey}:${reference.id}`)) });
          await onConfirm(params);
        } catch (deleteError) {
          setError(deleteError instanceof Error ? deleteError.message : "Unable to delete this record.");
        }
      }}
    >
      {error
        ? record && renderRecordChildren(record)
        : references.length > 0 && (
            <div>
              <p>Related records to include in the deletion:</p>
              {references.map((reference) => (
                <label key={`${reference.entityKey}:${reference.id}`}>
                  <input
                    id={config.deleteReferenceCheckboxId(reference.entityKey, reference.id)}
                    type="checkbox"
                    checked={selected.has(`${reference.entityKey}:${reference.id}`)}
                    onChange={(event) => {
                      const checked = event.target.checked;
                      setSelected((current) => {
                        const next = new Set(current);
                        const key = `${reference.entityKey}:${reference.id}`;
                        if (checked) next.add(key);
                        else next.delete(key);
                        return next;
                      });
                    }}
                  />
                  {reference.label}
                </label>
              ))}
            </div>
          )}
    </DeleteDialog>
  );
}

function getEmptyRecord(key: string) {
  const document = { title: "", type: "Unknown", content: "" };
  switch (key) {
    case "resumes":
      return { id: 0, document: document };
    case "ai-prompts":
      return {
        id: 0,
        promptDocument: { ...document },
        responseDocument: { ...document },
      };
    default:
      return { id: 0 };
  }
}

function ImportDialog<T>({
  entity,
  isOpen,
  setIsOpen,
  importFile,
  setError,
}: {
  entity: EntityConfig<T>;
  isOpen: boolean;
  setIsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  importFile: (key: EntityKey, file: File | null) => Promise<void>;
  setError: React.Dispatch<React.SetStateAction<string>>;
}) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  if (!isOpen) {
    return null;
  }

  return (
    <div id={entity.importDialogId} className="dialog import-dialog" role="dialog" aria-modal="false">
      <div className="header">
        <strong>Import {entity.label} records</strong>
      </div>
      <div className="content">
        <label htmlFor={entity.importFileInputId}>
          <span>Choose a JSON file</span>
        </label>
        <input
          id={entity.importFileInputId}
          type="file"
          accept="application/json,.json"
          onChange={(event) => {
            const nextFile = event.target.files?.[0] ?? null;
            if (nextFile) {
              setSelectedFile(nextFile);
            }
          }}
        />
        {selectedFile ? <p className="status">Selected file: {selectedFile.name}</p> : null}
      </div>
      <div className="actions">
        <button
          id={entity.importConfirmButtonId}
          type="button"
          className="button button--primary"
          onClick={() => {
            void importFile(entity.key, selectedFile);
            closeImportDialog();
          }}
        >
          Import
        </button>
        <button id={entity.importCancelButtonId} type="button" className="button button--secondary" onClick={() => closeImportDialog()}>
          Cancel
        </button>
      </div>
    </div>
  );

  function closeImportDialog() {
    setIsOpen(false);
    setError("");
  }
}

function ExportDialog<T extends { id?: number }>({
  config,
  isOpen,
  setIsOpen,
  setError,
  exportLabel,
}: {
  config: EntityConfig<T>;
  isOpen: boolean;
  setIsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setError: React.Dispatch<React.SetStateAction<string>>;
  exportLabel?: (item: T) => string;
}) {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const [selections, setSelections] = useState<Set<number>>(new Set<number>());

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }

    const firstFocusable = dialog.querySelector<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');

    if (firstFocusable) {
      firstFocusable.focus();
      return;
    }

    dialog.focus();
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  const items = config?.state as T[];

  return (
    <div ref={dialogRef} id={config.exportDialogId} className="dialog export-dialog" role="dialog" aria-modal="false">
      <div className="header">
        <strong>Export {config.label} records</strong>
      </div>
      <div className="content export-list">
        {items.map((item) => {
          const recordId = Number((item as { id?: number }).id ?? 0);
          if (recordId <= 0) {
            return null;
          }

          const isSelected = selections.has(recordId);
          return (
            <label key={recordId} className="export-option" htmlFor={config.exportCheckboxId(recordId)}>
              <input
                id={config.exportCheckboxId(recordId)}
                type="checkbox"
                className="export-checkbox"
                checked={isSelected}
                onChange={() => {
                  setSelections((current) => {
                    const updated = new Set(current);

                    if (updated.has(recordId)) {
                      updated.delete(recordId);
                    } else {
                      updated.add(recordId);
                    }

                    return updated;
                  });
                }}
              />
              <span className="export-checkbox-label">
                {item.id} <span className="separator">•</span>{" "}
                {exportLabel?.(item) ?? (item as { name?: string }).name ?? `Record ${recordId}`}
              </span>
            </label>
          );
        })}
      </div>
      <div className="actions">
        <button
          id={config.exportConfirmButtonId}
          type="button"
          className="button button--primary"
          onClick={() => {
            const selected = items.filter((item) => selections.has(Number((item as { id?: number }).id ?? 0)));
            exportSelectedRecords(config, selected as Record<string, unknown>[]);
            closeExportDialog();
          }}
        >
          Export
        </button>
        <button id={config.exportCancelButtonId} type="button" className="button button--secondary" onClick={() => closeExportDialog()}>
          Cancel
        </button>
      </div>
    </div>
  );

  function closeExportDialog() {
    setIsOpen(false);
    setError("");
  }

  function exportSelectedRecords(config: EntityConfig<T>, payload: Record<string, unknown>[]) {
    if (payload.length === 0) {
      setError("Select at least one record to export.");
      return;
    }

    const exportDocument = {
      generatedAt: new Date().toISOString(),
      entity: config.label,
      records: payload,
    };

    const blob = new Blob([JSON.stringify(exportDocument, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${config.label.toLowerCase().replace(/\s+/g, "-")}-export-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}

export { DBViewerTab, type RecordReference };
