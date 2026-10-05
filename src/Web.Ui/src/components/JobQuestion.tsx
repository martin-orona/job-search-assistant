import { useEntityEditor } from "../utilities/componentRendering";
import {
  EntityDisplay,
  EntityEditor,
  EntityUi,
  NumberFieldEditor,
  TextareaFieldEditor,
  TextFieldEditor,
  type CancelEntityHandler,
  type DeleteEntityHandler,
  type EntityExpansionProps,
  type EntityUiBuilderProps,
  type SavedEntity,
  type SaveEntityHandler,
} from "./Entity";

export type JobQuestion = NewJobQuestion & SavedJobQuestion;

export type NewJobQuestion = {
  question: string;
  answer: string;
};

export type SavedJobQuestion = SavedEntity & {};

export function JobQuestionUi({ question, ...rest }: EntityUiBuilderProps<JobQuestion> & { question: JobQuestion }) {
  return <EntityUi entity={question} entityKey="question" DisplayUi={JobQuestionDisplay} EditUi={JobQuestionEditor} {...rest} />;
}

export function JobQuestionDisplay({
  question,
  readonly,
  onEdit,
  onDelete,
  children,
  ...expansionProps
}: EntityExpansionProps & {
  question: JobQuestion;
  readonly?: boolean;
  onEdit: () => void;
  onDelete: DeleteEntityHandler;
  children?: React.ReactNode;
}) {
  return (
    <EntityDisplay
      {...expansionProps}
      id={`job-application-display--${question.id}`}
      readonly={readonly}
      onEdit={onEdit}
      onDelete={(event) => onDelete({ event, id: question.id ?? 0 })}
    >
      <>
        <div className="entity-display row summary">
          <span className="value id">{question.id}</span>
          <span className="separator">•</span>
          <span className="value question">{question.question ?? ""}</span>
        </div>
        <div className="entity-display row summary">
          <span className="value answer">{question.answer ?? "&nbsp;"}</span>
        </div>

        {children}
      </>
    </EntityDisplay>
  );
}

export function JobQuestionEditor({
  question,
  onCancel,
  onSave,
  editError,
}: {
  question: JobQuestion;
  onCancel?: CancelEntityHandler;
  onSave?: SaveEntityHandler<JobQuestion>;
  editError?: string;
}) {
  const [draft, updateField, handleSave, handleCancel] = useEntityEditor({ entity: question, onSave, onCancel });

  return (
    <EntityEditor id={`job-question--editor--${question.id}`} title="Edit Job Question" onCancel={handleCancel} onSave={handleSave}>
      <>
        <div className="job-question--editor entity-editor">
          {editError && <div className="edit-error">{editError}</div>}

          <NumberFieldEditor
            id={`job-question--editor--id--${draft.id}`}
            className="job-question--field readonly id"
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
            id={`job-question--editor--question--${draft.id}`}
            className="job-question--field question"
            label="Question"
            value={draft.question ?? ""}
            onChange={(value) =>
              updateField((updated) => {
                updated.question = value;
              })
            }
          />
          <TextareaFieldEditor
            id={`job-question--editor--answer--${draft.id}`}
            className="job-question--field answer"
            label="Answer"
            value={draft.answer ?? ""}
            onChange={(value) =>
              updateField((updated) => {
                updated.answer = value;
              })
            }
          />
        </div>
      </>
    </EntityEditor>
  );
}
