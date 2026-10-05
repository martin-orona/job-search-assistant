import React from "react";
import { ActionableExpander_new, ExpandableDataListItem_new } from "./Expander";

import { useHybridBoolean } from "../utilities/componentState";
import "./Entity.css";

export type Entity = NewEntity & SavedEntity;

export type NewEntity = {};

export type SavedEntity = {
  id: number;
  createdAt: string;
  updatedAt: string;
};

export type EntityKey =
  | "job-postings"
  | "job-applications"
  | "job-sources"
  | "job-questions"
  | "resumes"
  | "ai-prompt-templates"
  | "ai-prompts";

export type EntityUiProps_0<T> = {
  entity: T;
  displayUi: React.ReactNode;
  editorUi: React.ReactNode;
  onSave: (entity: T) => void;
};
export type EntityDisplayProps_0<T> = Omit<EntityUiProps_0<T>, "displayUi" | "editorUi" | "onSave"> & {
  readonly?: boolean;
  onStartEditing?: () => void;
  children: React.ReactNode;
};
export type EntityEditorProps_0<T> = Omit<EntityUiProps_0<T>, "displayUi" | "editorUi"> & {
  title: string;
  onCancelEditing: () => void;
  children: React.ReactNode;
};

export type EntityUiProps = {
  id: string;
  className?: string;
  displayUi: React.ReactNode;
  editorUi: React.ReactNode;
  onSave: (event: React.MouseEvent<HTMLButtonElement>) => void;
};

export type EntityExpansionProps = {
  open?: boolean;
  additionalActions?: React.ReactNode;
  onExpanded?: (event: React.SyntheticEvent<Element>) => void;
  onCollapsed?: (event: React.SyntheticEvent<Element>) => void;
};

export type EntityDisplayProps = Omit<EntityUiProps, "displayUi" | "editorUi" | "onSave"> &
  EntityExpansionProps & {
    readonly?: boolean;
    expandable?: boolean;
    onEdit?: () => void;
    onDelete: (event: React.MouseEvent<HTMLButtonElement>) => void;
    children: React.ReactNode;
  };

export type EntityEditorProps = Omit<EntityUiProps, "displayUi" | "editorUi"> & {
  title: string;
  onCancel: CancelEntityHandler;
  children: React.ReactNode;
};

type EntityActionParams<T extends Entity> = { event: React.SyntheticEvent<Element>; entity: T };
type IdActionParams = { event: React.SyntheticEvent<Element>; id: number };
// export type SaveEntityParams<T extends Entity> = { event: React.SyntheticEvent<Element>; updated: T };
export type SaveEntityParams<T extends Entity> = EntityActionParams<T>;
export type SaveEntityHandler<T extends Entity> = (params: SaveEntityParams<T>) => Promise<void>;

export type CancelEntityParams = IdActionParams;
export type CancelEntityHandler = (params: CancelEntityParams) => Promise<void>;

export type DeleteEntityParams = IdActionParams & {
  shouldPropagateError?: boolean;
};
export type DeleteEntityHandler = (params: DeleteEntityParams) => Promise<void>;

export type EntityUiBuilderProps<T extends Entity> = EntityExpansionProps & {
  readonly?: boolean;
  className?: string;

  inEditMode?: boolean;
  setInEditMode?: (value: boolean, id: number) => void;
  onSave: SaveEntityHandler<T>;
  onCancelEditing?: CancelEntityHandler;
  editError?: string;

  onDelete: DeleteEntityHandler;
  children?: React.ReactNode;
};

export type InstantiatedEntityUiBuilderProps<T extends Entity> = EntityUiBuilderProps<T> & {
  entity: T;
  entityKey: string;
  DisplayUi: React.ComponentType<any>;
  EditUi: React.ComponentType<any>;
};

export function InstantiatedEntityUi<T extends Entity>(
  //   {
  //   entity,
  //   entityKey,
  //   DisplayUi,

  //   EditUi,
  //   inEditMode,
  //   setInEditMode,
  //   onSave,
  //   onCancelEditing,
  //   editError,

  //   onDelete,
  //   config,
  //   readonly = false,

  //   children,
  // }
  props: InstantiatedEntityUiBuilderProps<T>,
) {
  // const editing = inEditMode ?? false;
  return <EntityUi {...props} />;
  // return (
  //   <EntityUi
  //     entity={entity}
  //     inEditMode={inEditMode}
  //     setInEditMode={setInEditMode}
  //     onSave={onSave}
  //     onCancelEditing={onCancelEditing}
  //     DisplayUi={
  //       <DisplayUi {...{ [entityKey]: entity }} readonly={readonly} onDelete={onDelete}>
  //         {children}
  //       </DisplayUi>
  //     }
  //     EditUi={
  //       <EditUi {...{ [entityKey]: entity }} config={config} inEditMode={inEditMode} setInEditMode={setInEditMode} editError={editError} />
  //     }
  //   />
  // );
}

export type EntityUiPropsG<T extends Entity> = {
  entity: T;
  onSave: SaveEntityHandler<T>;
  onCancelEditing?: CancelEntityHandler;
  DisplayUi: React.ComponentType<any>;
  EditUi: React.ComponentType<any>;
  inEditMode?: boolean;
  setInEditMode?: (value: boolean, id: number) => void;
};

/* export function EntityUi_reference<T extends Entity>({ entity, onSave, displayUi, editUi, onCancelEditing }: EntityUiPropsG<T>) {
  const isNew = !entity?.id;
  const [isEditing, setIsEditing] = useState(isNew);

  return (
    <>
      {!isEditing &&
        React.cloneElement(displayUi, {
          onEdit: () => setIsEditing(true),
        })}

      {isEditing &&
        React.cloneElement(editUi, {
          onCancel: () => {
            setIsEditing(false);
            onCancelEditing?.(entity?.id);
          },
          onSave: (params: SaveEntityParams<T>) => {
            onSave(params);
            setIsEditing(false);
          },
        })}
    </>
  );
}  */

// export function EntityUi_reference<T extends Entity>({
//   entity,
//   onSave,
//   DisplayUi: displayUi,
//   EditUi: editUi,
//   onCancelEditing,
//   inEditMode,
//   setInEditMode,
// }: EntityUiPropsG<T>) {
//   const isNew = !entity?.id;
//   // const [isEditing, setIsEditing] = useState(isNew);
//   const [isEditing, setIsEditing] = useHybridBoolean({
//     fromParent: inEditMode,
//     defaultValue: isNew,
//     onToggled: (_event: React.SyntheticEvent<Element>, value: boolean) => setInEditMode?.(value, entity.id),
//   });

//   function setIsEditingSetter(event: React.SyntheticEvent<Element, Event>, value?: boolean) {
//     setIsEditing(event, value);
//   }

//   return (
//     <>
//       {!isEditing &&
//         React.cloneElement(displayUi, {
//           onEdit: (event: React.SyntheticEvent<HTMLButtonElement>) => setIsEditingSetter(event, true),
//         })}

//       {isEditing &&
//         React.cloneElement(editUi, {
//           // onCancel: (event: React.SyntheticEvent<HTMLButtonElement>) => {
//           onCancel: ({ event, id }: CancelEntityParams<T>) => {
//             setIsEditingSetter(event, false);
//             onCancelEditing?.(entity?.id);
//           },
//           onSave: async (params: SaveEntityParams<T>) => {
//             try {
//               await onSave(params);
//               setIsEditingSetter(params?.event as React.SyntheticEvent<HTMLDivElement>, false);
//             } catch (error) {
//               console.error("Error saving entity:", error);
//             }
//           },
//         })}
//     </>
//   );
// }

export function EntityUi<T extends Entity>({
  entity,
  entityKey,

  DisplayUi,
  readonly,
  onDelete,
  children,

  EditUi,
  inEditMode,
  setInEditMode,
  editError,
  onSave,
  onCancelEditing,

  open,
  onExpanded,
  onCollapsed,
  className,
  additionalActions,
}: // EntityUiPropsG<T>)
EntityUiBuilderProps<T> & {
  entity: T;
  entityKey: string;
  DisplayUi: React.ComponentType<any>;
  EditUi: React.ComponentType<any>;
  className?: string;
}) {
  const isNew = !entity?.id;
  // const [isEditing, setIsEditing] = useState(isNew);
  const [isEditing, setIsEditing] = useHybridBoolean({
    fromParent: inEditMode,
    defaultValue: isNew,
    onToggled: (_event: React.SyntheticEvent<Element>, value: boolean) => setInEditMode?.(value, entity.id),
  });

  function setIsEditingSetter(event: React.SyntheticEvent<Element, Event>, value?: boolean) {
    setIsEditing(event, value);
  }

  return (
    <>
      {!isEditing && (
        <DisplayUi
          {...{ [entityKey]: entity }}
          readonly={readonly}
          className={className}
          open={open}
          additionalActions={additionalActions}
          onExpanded={onExpanded}
          onCollapsed={onCollapsed}
          onDelete={onDelete}
          onEdit={(event: React.SyntheticEvent<HTMLButtonElement>) => setIsEditingSetter(event, true)}
        >
          {children}
        </DisplayUi>
      )}

      {isEditing && (
        <EditUi
          {...{ [entityKey]: entity }}
          className={className}
          inEditMode={inEditMode}
          setInEditMode={setInEditMode}
          editError={editError}
          onSave={async (params: SaveEntityParams<T>) => {
            try {
              await onSave(params);
              setIsEditingSetter(params?.event as React.SyntheticEvent<HTMLDivElement>, false);
            } catch (error) {
              console.error("Error saving entity:", error);
            }
          }}
          onCancel={({ event, id }: CancelEntityParams) => {
            setIsEditingSetter(event, false);
            onCancelEditing?.({ event, id });
          }}
        />
      )}
    </>
  );
}

export function EntityDisplay({
  id,
  className,
  readonly,
  onEdit,
  onDelete,
  children,
  expandable = true,
  open,
  onExpanded,
  onCollapsed,
  additionalActions,
}: EntityDisplayProps) {
  const childrenArray = React.Children.toArray(children).flatMap((child) => {
    if (child && (child as any).type === React.Fragment) {
      return React.Children.toArray((child as any).props.children);
    }
    return [child];
  });
  const [header, ...rest] = childrenArray;

  return (
    <>
      <ExpandableDataListItem_new
        id={`entity-display-${id ?? 0}`}
        className={`entity-display ${className}`}
        expandable={expandable}
        open={expandable ? open : true}
        onExpanded={onExpanded}
        onCollapsed={onCollapsed}
        title={header || ""}
        actions={
          <>
            {!readonly && (
              <>
                {additionalActions}
                <button className="button" onClick={onEdit}>
                  Edit
                </button>
                <button
                  className="button button--delete"
                  onClick={async (event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    await onDelete?.(event);
                  }}
                >
                  Delete
                </button>
              </>
            )}
          </>
        }
      >
        {rest}
      </ExpandableDataListItem_new>
    </>
  );
}

export function EntityEditor({ id, className, title, onCancel, onSave, children }: EntityEditorProps) {
  return (
    <>
      <ActionableExpander_new
        id={`entity-editor-${id ?? 0}`}
        className={`entity-editor ${className}`}
        title={title}
        open={true}
        expandable={false}
        actions={<ActionButtons />}
      >
        <div className="entity-editor content">{children}</div>
        <ActionButtons />
      </ActionableExpander_new>
    </>
  );

  function ActionButtons() {
    return (
      <>
        <button className="button button--primary" onClick={onSave}>
          Save
        </button>
        <button className="button" onClick={onClick_Cancel}>
          Cancel
        </button>
      </>
    );
  }

  function onClick_Cancel(event: React.SyntheticEvent<Element>) {
    onCancel?.({ event, id: Number(id) });
  }

  // function save() {
  //   onSave(entity);
  // }
}

export function TextFieldEditor({
  id,
  className,
  label,
  value,
  onChange,
  readonly = false,
}: {
  id: string;
  className?: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  readonly?: boolean;
}) {
  return (
    <div id={`${id}--field-editor`} className={`field-editor text ${className}`}>
      <label htmlFor={`${id}--input`}> {label}</label>
      <input id={`${id}--input`} type="text" readOnly={readonly} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

export function TextareaFieldEditor({
  id,
  className,
  label,
  value,
  onChange,
  readonly = false,
}: {
  id: string;
  className?: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  readonly?: boolean;
}) {
  return (
    <div id={`${id}--field-editor`} className={`field-editor text ${className}`}>
      <label htmlFor={`${id}--input`}> {label}</label>
      <textarea id={`${id}--input`} readOnly={readonly} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

export function NumberFieldEditor({
  id,
  className,
  label,
  value,
  onChange,
  readonly = false,
}: {
  id: string;
  className?: string;
  label: string;
  value: number;
  onChange: (value: number) => void;
  readonly?: boolean;
}) {
  return (
    <div id={`${id}--field-editor`} className={`field-editor number ${className}`}>
      <label htmlFor={`${id}--input`}>{label}</label>
      <input id={`${id}--input`} type="number" readOnly={readonly} value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </div>
  );
}

export function DateFieldEditor({
  id,
  className,
  label,
  value,
  onChange,
  readonly = false,
}: {
  id: string;
  className?: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  readonly?: boolean;
}) {
  return (
    <div id={`${id}--field-editor`} className={`field-editor date ${className}`}>
      <label htmlFor={`${id}--input`}> {label}</label>
      <input id={`${id}--input`} type="date" readOnly={readonly} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

export function EnumFieldEditor({
  id,
  className,
  label,
  value,
  onChange,
  options,
}: {
  id: string;
  className?: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly string[];
}) {
  return (
    <div id={`${id}--field-editor`} className={`field-editor enum ${className}`}>
      <label htmlFor={`${id}--input`}> {label}</label>
      <select id={`${id}--input`} value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </div>
  );
}

export function EditableListEditor<T extends Record<string, any>>({
  label,
  emptyText,
  items,
  createEmptyItem,
  onChange,
  renderItem,
}: {
  label: string;
  emptyText: string;
  items: T[];
  createEmptyItem: () => T;
  onChange: (nextItems: T[]) => void;
  renderItem: (item: T, index: number, updateItem: (mutate: (updated: T) => void) => void) => React.ReactNode;
}) {
  function updateItem(index: number, mutate: (updated: T) => void) {
    onChange(
      items.map((item, currentIndex) => {
        if (currentIndex === index) {
          const updated = structuredClone(item);
          mutate(updated);
          return updated;
        } else {
          return item;
        }
      }),
    );
  }

  function addItem() {
    onChange([...items, createEmptyItem()]);
  }

  function removeItem(index: number) {
    onChange(items.filter((_, currentIndex) => currentIndex !== index));
  }

  return (
    <div className="editor-field editable-list-container">
      <label>{label}</label>
      <div className="editable-list">
        {items.length === 0 && <div className="empty-state">{emptyText}</div>}

        {items.map((item, index) => (
          <div key={`${label}-${index}`} className="editable-list-item">
            {renderItem(item, index, (mutate: (updated: T) => void) => updateItem(index, mutate))}
            <button className="button" type="button" onClick={() => removeItem(index)}>
              Remove
            </button>
          </div>
        ))}
        <button className="button" type="button" onClick={addItem}>
          Add {label.toLowerCase()}
        </button>
      </div>
    </div>
  );
}
