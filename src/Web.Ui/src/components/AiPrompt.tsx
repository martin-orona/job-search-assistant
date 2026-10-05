import { useEntityEditor } from "../utilities/componentRendering";
import { ReadonlyAiPromptTemplate, type AiPromptTemplate } from "./AiPromptTemplate";
import { DocumentEmbeddedEditor, ReadOnlyDocument, type Document } from "./Document";
import {
  EntityDisplay,
  EntityEditor,
  EntityUi,
  NumberFieldEditor,
  TextFieldEditor,
  type CancelEntityHandler,
  type DeleteEntityHandler,
  type EntityExpansionProps,
  type EntityUiBuilderProps,
  type SavedEntity,
  type SaveEntityHandler,
} from "./Entity";
import { ReadonlyJobPosting, type JobPosting } from "./JobPosting";
import { ReadonlyResume, type Resume } from "./Resume";

export type AiPrompt = NewAiPrompt & SavedAiPrompt;

export type NewAiPrompt = {
  name: string;
  aiName: string;
  aiUrl: string;
  jobPosting: JobPosting;
  resume: Resume;
  aiPromptTemplate: AiPromptTemplate;
  promptDocument: Document;
  responseDocument: Document;
};

export type SavedAiPrompt = SavedEntity & {
  jobPostingId: number;
  resumeId: number;
  aiPromptTemplateId: number;
  promptDocumentId: number;
  responseDocumentId: number;
};

export function AiPromptUi({ prompt, ...rest }: EntityUiBuilderProps<AiPrompt> & { prompt: AiPrompt }) {
  return <EntityUi entity={prompt} entityKey="prompt" DisplayUi={AiPromptDisplay} EditUi={AiPromptEditor} {...rest} />;
}

export function ReadonlyAiPrompt({ prompt, children }: { prompt: AiPrompt; readonly?: boolean; children?: React.ReactNode }) {
  return (
    <AiPromptDisplay prompt={prompt} readonly={true} onEdit={() => {}} onDelete={async () => {}}>
      {children}
    </AiPromptDisplay>
  );
}

function AiPromptDisplay({
  prompt,
  readonly = false,
  onEdit,
  onDelete,
  children,
  ...expansionProps
}: EntityExpansionProps & {
  prompt: AiPrompt;
  readonly?: boolean;
  onEdit?: () => void;
  onDelete: DeleteEntityHandler;
  children?: React.ReactNode;
}) {
  return (
    <EntityDisplay
      {...expansionProps}
      id={`ai-prompt-template-display--${prompt.id}`}
      readonly={readonly}
      onEdit={onEdit}
      onDelete={async (event) => await onDelete({ event, id: prompt.id ?? 0 })}
    >
      <>
        <div className="entity-display row summary">
          <span className="value id">{prompt.id}</span>
          <span className="separator">•</span>
          <span className="value name">{prompt.name ?? "[missing name]"}</span>
          <span className="separator">•</span>
          <span className="value ai-name">{prompt.aiName ?? "[missing ai name]"}</span>
        </div>
        <div className="entity-display row">
          <span className="value ai-url">{prompt.aiUrl ?? "[missing ai url]"}</span>
        </div>
        <div className="entity-display row">
          <span className="value entity-reference job-posting">
            <label>Job Posting</label>
            {prompt.jobPosting && <ReadonlyJobPosting posting={prompt.jobPosting} />}
          </span>
        </div>
        <div className="entity-display row">
          <span className="value entity-reference resume">
            <label>Resume</label>
            {prompt.resume && <ReadonlyResume resume={prompt.resume} documentOpen={true} />}
          </span>
        </div>
        <div className="entity-display row">
          <span className="value entity-reference ai-prompt-template">
            <label>AI Prompt Template</label>
            {prompt.aiPromptTemplate && <ReadonlyAiPromptTemplate template={prompt.aiPromptTemplate} documentOpen={true} />}
          </span>
        </div>
        <div className="entity-display row">
          <span className="value entity-reference prompt-document">
            <label>Prompt Document</label>
            {prompt.promptDocument && <ReadOnlyDocument document={prompt.promptDocument} />}
          </span>
        </div>
        <div className="entity-display row">
          <span className="value entity-reference response-document">
            <label>Response Document</label>
            {prompt.responseDocument && <ReadOnlyDocument document={prompt.responseDocument} />}
          </span>
        </div>

        {children}
      </>
    </EntityDisplay>
  );
}

function AiPromptEditor({
  prompt,
  onCancel,
  onSave,
  editError,
}: {
  prompt: AiPrompt;
  onCancel?: CancelEntityHandler;
  onSave?: SaveEntityHandler<AiPrompt>;
  editError?: string;
}) {
  const [draft, updateField, handleSave, handleCancel] = useEntityEditor({ entity: prompt, onSave, onCancel });

  return (
    <EntityEditor id={`ai-prompt-template--editor--${prompt.id}`} title="Edit AI Prompt" onCancel={handleCancel} onSave={handleSave}>
      <>
        <div className="ai-prompt--editor entity-editor">
          {editError && <div className="edit-error">{editError}</div>}

          <NumberFieldEditor
            id={`ai-prompt--editor--id--${draft.id}`}
            className="ai-prompt--field readonly id"
            label="Id"
            readonly
            value={(draft.id as number) ?? 0}
            onChange={(value) =>
              updateField((updated) => {
                updated.id = value;
              })
            }
          />
          <TextFieldEditor
            id={`ai-prompt--editor--name--${draft.id}`}
            className="ai-prompt--field name"
            label="Name"
            value={draft.name ?? ""}
            onChange={(value) =>
              updateField((updated) => {
                updated.name = value;
              })
            }
          />
          <TextFieldEditor
            id={`ai-prompt--editor--ai-name--${draft.id}`}
            className="ai-prompt--field ai-name"
            label="AI Name"
            value={draft.aiName ?? ""}
            onChange={(value) =>
              updateField((updated) => {
                updated.aiName = value;
              })
            }
          />

          <TextFieldEditor
            id={`ai-prompt--editor--ai-url--${draft.id}`}
            className="ai-prompt--field ai-url"
            label="AI URL"
            value={draft.aiUrl ?? ""}
            onChange={(value) => updateField((updated) => { updated.aiUrl = value; })}
          />

          <NumberFieldEditor
            id={`ai-prompt--editor--job-posting-id--${draft.id}`}
            className="ai-prompt--field job-posting-id"
            label="Job Posting Id"
            value={(draft.jobPostingId as number) ?? 0}
            onChange={(value) =>
              updateField((updated) => {
                updated.jobPostingId = value;
              })
            }
          />

          <NumberFieldEditor
            id={`ai-prompt--editor--resume-id--${draft.id}`}
            className="ai-prompt--field resume-id"
            label="Resume Id"
            value={(draft.resumeId as number) ?? 0}
            onChange={(value) =>
              updateField((updated) => {
                updated.resumeId = value;
              })
            }
          />

          <NumberFieldEditor
            id={`ai-prompt--editor--ai-prompt-template-id--${draft.id}`}
            className="ai-prompt--field ai-prompt-template-id"
            label="AI Prompt Template Id"
            value={(draft.aiPromptTemplateId as number) ?? 0}
            onChange={(value) =>
              updateField((updated) => {
                updated.aiPromptTemplateId = value;
              })
            }
          />

          {draft.jobPosting && <div className="entity-reference job-posting"><ReadonlyJobPosting posting={draft.jobPosting} /></div>}
          {draft.resume && <div className="entity-reference resume"><ReadonlyResume resume={draft.resume} /></div>}
          {draft.aiPromptTemplate && <div className="entity-reference ai-prompt-template"><ReadonlyAiPromptTemplate template={draft.aiPromptTemplate} /></div>}

          <div id={`ai-prompt--editor--prompt-document--${draft.id}`} className={`field-editor document prompt--field readonly`}>
            <label>Prompt Document</label>

            <DocumentEmbeddedEditor
              document={draft.promptDocument as Document}
              onChange={(updatedDocument) => {
                updateField((updated) => {
                  updated.promptDocument = updatedDocument as Document;
                });
              }}
            />
          </div>

          <div id={`ai-prompt--editor--response-document--${draft.id}`} className={`field-editor document response--field readonly`}>
            <label>Response Document</label>
            <DocumentEmbeddedEditor
              document={draft.responseDocument as Document}
              onChange={(updatedDocument) => {
                updateField((updated) => {
                  updated.responseDocument = updatedDocument as Document;
                });
              }}
            />
          </div>
        </div>
      </>
    </EntityEditor>
  );
}
