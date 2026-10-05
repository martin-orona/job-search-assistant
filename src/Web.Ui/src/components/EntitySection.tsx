import { useState } from "react";
import { getComponentName } from "../utilities/componentRendering";
import { useDialogErrors } from "../utilities/componentState";
import { DeleteDialog } from "./Dialog";
import type {
  CancelEntityHandler,
  CancelEntityParams,
  DeleteEntityHandler,
  DeleteEntityParams,
  Entity,
  SaveEntityHandler,
  SaveEntityParams,
} from "./Entity";
import { ExpandableDataList_new } from "./Expander";

export function EntitySection<T extends Entity>({
  id,
  title,
  className,
  open,
  onExpanded,
  onCollapsed,
  data,
  expandedRecords,
  onRecordExpansionChange,
  ListItemUi,
  itemPropName,
  isLoading,
  emptyListMessage,
  reloadData,
  onSave,
  onCreateRecord,
  onRemoveRecord,
  additionalActions,
  importDialog,
  exportDialog,
  deleteDialog,
  renderRecordChildren,
  renderRecordActions,

  onDelete,
  deletionErrors,
  setDeletionError,
  clearDeletionError,
}: {
  id: string;
  title: string;
  className?: string;
  open?: boolean;
  onExpanded?: (event: React.SyntheticEvent<Element>) => void;
  onCollapsed?: (event: React.SyntheticEvent<Element>) => void;
  data: Entity[];
  expandedRecords?: Record<number, boolean>;
  onRecordExpansionChange?: (id: number, open: boolean) => void;
  isLoading: boolean;
  emptyListMessage?: string;
  reloadData: () => Promise<void>;

  onSave: SaveEntityHandler<T>;

  onCreateRecord: () => void;
  // Removes an unsaved placeholder record from the local list only.
  onRemoveRecord: (id: number) => void;

  ListItemUi: React.ComponentType<any>;
  itemPropName: string;
  additionalActions?: React.ReactNode;
  importDialog?: React.ReactNode;
  exportDialog?: React.ReactNode;
  deleteDialog?: (params: { itemId: number; onConfirm: DeleteEntityHandler; onCancel: (itemId: number) => void }) => React.ReactNode;
  renderRecordChildren?: (item: T) => React.ReactNode;
  renderRecordActions?: (item: T) => React.ReactNode;

  onDelete: DeleteEntityHandler;
  deletionErrors: Record<number, string>;
  setDeletionError: (itemId: number, error: string) => void;
  clearDeletionError: (itemId: number) => void;
}) {
  const [isImporting, setIsImporting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isListExpanded, setIsListExpanded] = useState(false);

  const [isEditing, setIsEditing] = useState<Record<number, boolean>>({});
  const [editErrors, setEditError, clearEditError] = useDialogErrors();

  const listItemUiName = getComponentName(ListItemUi);
  const additionalProps: any = {};
  if (isImporting || isExporting || isCreating) {
    additionalProps.open = true;
  }

  function setIsEditingSetter(status: boolean, id?: number) {
    setIsEditing((prev) => {
      return {
        ...prev,
        [id ?? 0]: status,
      };
    });
  }

  return (
    <ExpandableDataList_new
      open={open}
      {...additionalProps}
      onExpanded={(event) => {
        setIsListExpanded(true);
        onExpanded?.(event);
      }}
      onCollapsed={(event) => {
        setIsListExpanded(false);
        onCollapsed?.(event);
      }}
      id={id}
      title={title}
      className={className}
      data={data}
      emptyListMessage={emptyListMessage ?? `No ${title}s yet.`}
      isLoading={isLoading}
      loadingMessage={`Loading ${title}s...`}
      onRefresh={async (event) => {
        event.preventDefault();
        event.stopPropagation();
        await reloadData();
      }}
      generateListItem={(params) => {
        const itemIsInEditMode = isEditing[params?.item?.id];
        return generateListItem({
          ...params,
          //   className: params?.props?.className as string | undefined,
          ...params?.props,

          ListItemUi,
          itemPropName,
          listItemUiName,

          inEditMode: itemIsInEditMode,
          setInEditMode: setIsEditingSetter,
          onSave: onSave,
          onCancelEditing: async ({ id }: CancelEntityParams) => {
            clearEditError(listItemUiName, id);
            await toggleIsCreating(false);
            setIsEditingSetter(false, id);
          },
          editError: editErrors[listItemUiName]?.[params?.item?.id],
          setEditError: setEditError,
          clearEditError: clearEditError,
        });
      }}
      actions={
        <>
          <button
            id={`create-${id}--create-button`}
            type="button"
            className="button"
            onClick={async (event) => {
              event.preventDefault();
              event.stopPropagation();
              await toggleIsCreating(true);
            }}
          >
            Create
          </button>
          {additionalActions}
        </>
      }
      importDialog={importDialog}
      exportDialog={exportDialog}
      deleteDialog={deleteDialog ?? (({
        itemId,
        onConfirm,
        onCancel,
      }: {
        itemId: number;
        onConfirm: DeleteEntityHandler;
        onCancel: (itemId: number) => void;
      }) => (
        <DeleteDialog
          //   config={config}
          id={`delete-dialog--${itemId}`}
          label={`Delete ${title}`}
          itemId={itemId}
          error={deletionErrors[itemId]}
          confirmButtonId={`delete-dialog--confirm-button--${itemId}`}
          cancelButtonId={`delete-dialog--cancel-button--${itemId}`}
          onConfirm={async ({ event, id }: DeleteEntityParams) => {
            try {
              clearDeletionError(itemId);
              await onDelete({ event, id: itemId });
              await onConfirm({ event, id: itemId });
            } catch (error) {
              console.error(error);
              setDeletionError(itemId, (error as Error).message);
            }
          }}
          onCancel={async (itemId: number) => {
            clearDeletionError(itemId);
            await onCancel(itemId);
          }}
        />
      ))}
    ></ExpandableDataList_new>
  );

  async function toggleIsCreating(status: boolean) {
    if (isCreating && status) {
      return;
    }

    setIsCreating(status);

    if (status) {
      setIsEditingSetter(true);
      await onCreateRecord();
    } else {
      await onRemoveRecord(0);
      setIsEditingSetter(false);
    }
  }

  function generateListItem({
    item,
    className,

    inEditMode,
    setInEditMode,
    onSave,
    onCancelEditing,
    editError,
    setEditError,
    clearEditError,

    ListItemUi,
    itemPropName,
    listItemUiName,

    ...props
  }: {
    item: Entity;
    index: number;
    list: Entity[];

    className?: string;

    inEditMode?: boolean;
    setInEditMode?: (value: boolean) => void;
    onSave: SaveEntityHandler<T>;
    onCancelEditing?: CancelEntityHandler;
    editError?: string;
    setEditError: (componentName: string, itemId: number, message: string) => void;
    clearEditError: (componentName: string, itemId: number) => void;

    onDelete: DeleteEntityHandler;

    ListItemUi: React.ComponentType<any>;
    listItemUiName: string;
    itemPropName: string;

    props?: Record<string, unknown>;
  }) {
    return (
      <ListItemUi
        {...{ [itemPropName]: item as T }}
        className={className}
        inEditMode={inEditMode}
        additionalActions={renderRecordActions?.(item as T)}
        setInEditMode={setInEditMode}
        editError={editError}
        open={expandedRecords?.[item.id]}
        onExpanded={() => onRecordExpansionChange?.(item.id, true)}
        onCollapsed={() => onRecordExpansionChange?.(item.id, false)}
        onSave={async ({ event, entity: updated }: SaveEntityParams<T>) => {
          try {
            clearEditError(listItemUiName, item.id);
            await onSave({ event, entity: updated as unknown as T });
            await onCancelEditing?.({ event, id: updated.id });
            setInEditMode?.(false);
          } catch (error) {
            // TODO: Handle error appropriately. See DBViewerTab.tsx DeleteDialog implementation.
            console.error(error);
            setEditError(listItemUiName, item.id, (error as Error).message);
            // re-throw so EntityUi does not exit edit mode on failure.
            throw error;
          }
        }}
        onCancelEditing={async (params: CancelEntityParams) => {
          onCancelEditing?.({ event: params.event, id: item.id });
          setInEditMode?.(false);
        }}
        {...props}
      >
        {renderRecordChildren?.(item as T)}
      </ListItemUi>
    );
  }
}

// function renderEntitySection_dbviewer<T extends Entity>({
//   config,
//   ListItemUi,
//   itemPropName = "missing_item_prop_name",
//   exportLabel,
// }: {
//   config: EntityConfig;
//   ListItemUi: React.ComponentType<any>;
//   itemPropName?: string;
//   exportLabel?: (item: T) => string;
// }) {
//   return (
//     <EntitySection<T>
//       config={config}
//       generateListItem={({ item, index, list, onCancelEditing, onDelete, props }) =>
//         generateListItem({ config, item, index, list, onCancelEditing, onDelete, props })
//       }
//       isLoading={loading}
//       loadEntity={loadEntityFor}
//       saveEditorItem={saveEditorItem}
//       importExportSelection={importExportSelection}
//       confirmDeleteEntityRecord={confirmDeleteEntityRecord}
//       getIncomingReferences={getIncomingReferences}
//       openEntityRecord={openEntityRecord}
//       setError={setError}
//       setExpandedEntities={setExpandedEntities}
//       ensureExportSelection={ensureExportSelection}
//       exportLabel={exportLabel}
//     />
//   );

//   function generateListItem({
//     config,
//     item,
//     onCancelEditing,
//     onDelete,
//     props,
//   }: {
//     config: EntityConfig<T>;
//     item: Entity;
//     index: number;
//     list: Entity[];
//     onCancelEditing?: (id: number) => void;
//     onDelete: (itemId: number) => void;
//     props?: Record<string, unknown>;
//   }) {
//     return (
//       <ListItemUi
//         config={config}
//         {...{ [itemPropName]: item as T }}
//         onSave={({ entity }: SaveEntityParams<T>) => {
//           void saveEditorItem(config.key, entity.id, entity as T);
//           onCancelEditing?.(entity.id);
//         }}
//         onCancelEditing={onCancelEditing}
//         onDelete={onDelete}
//         {...props}
//       >
//         <ReferencedByDisplay references={getIncomingReferences(config.key, item.id)} onOpenRecord={openEntityRecord} />
//       </ListItemUi>
//     );
//   }
// }

// function EntitySection_dbviewer<T extends Entity>({
//   config,
//   isLoading,
//   generateListItem,
//   loadEntity,
//   importExportSelection,
//   confirmDeleteEntityRecord,
//   setError,
//   setExpandedEntities,
//   ensureExportSelection,
//   exportLabel,
// }: {
//   config: EntityConfig<T>;
//   isLoading: Record<string, boolean>;
//   generateListItem?: (params: {
//     item: Entity;
//     index: number;
//     list: Entity[];
//     onCancelEditing: (itemId: number) => void;
//     onDelete: (itemId: number) => void;
//     props?: Record<string, unknown>;
//   }) => React.ReactNode;
//   loadEntity: (key: EntityKey) => Promise<void>;
//   saveEditorItem: (key: EntityKey, itemId: number | null, updated: Record<string, string>) => Promise<void>;
//   getIncomingReferences: (key: EntityKey, itemId: number) => RecordReference[];
//   openEntityRecord: (key: EntityKey, id: number | null | undefined) => void;
//   importExportSelection: (key: EntityKey, file: File | null) => Promise<void>;
//   confirmDeleteEntityRecord: (key: EntityKey, itemId: number) => Promise<void>;
//   setError: React.Dispatch<React.SetStateAction<string>>;
//   setExpandedEntities: React.Dispatch<React.SetStateAction<Record<EntityKey, boolean>>>;
//   ensureExportSelection: (key: EntityKey, items: Array<{ id?: number }>) => void;
//   exportLabel?: (item: T) => string;
// }) {
//   const [isImporting, setIsImporting] = useState(false);
//   const [isExporting, setIsExporting] = useState(false);
//   const [isCreating, setIsCreating] = useState(false);
//   const [isListExpanded, setIsListExpanded] = useState(false);

//   const [deleteErrors, setDeleteError, clearDeleteError] = useDialogErrors();

//   const additionalProps: any = {};
//   if (isImporting || isExporting || isCreating) {
//     additionalProps.open = true;
//   }

//   return (
//     <ExpandableDataList_new
//       {...additionalProps}
//       onExpanded={(event) => setIsListExpanded(true)}
//       onCollapsed={(event) => setIsListExpanded(false)}
//       id={config.containerId}
//       title={`${config.label}s`}
//       className={config.key}
//       data={config?.state}
//       generateListItem={(params) =>
//         generateListItem?.({
//           ...params,
//           onCancelEditing: (id?: number) => {
//             toggleIsCreating(false);
//           },
//         })
//       }
//       isLoading={isLoading[config.key] ?? false}
//       loadingMessage={`Loading ${config.label}s...`}
//       emptyListMessage={`No ${config.label}s yet.`}
//       onRefresh={(event) => {
//         event.preventDefault();
//         event.stopPropagation();
//         void loadEntity(config.key);
//       }}
//       actions={
//         <ExpanderActions<T>
//           config={config}
//           setIsImporting={setIsImporting}
//           setIsExporting={setIsExporting}
//           setIsCreating={toggleIsCreating as React.Dispatch<React.SetStateAction<boolean>>}
//           setExpandedEntities={setExpandedEntities}
//           ensureExportSelection={ensureExportSelection}
//         />
//       }
//       importDialog={
//         <ImportDialog
//           isOpen={isImporting}
//           setIsOpen={setIsImporting}
//           entity={config}
//           importFile={importExportSelection}
//           setError={setError}
//         />
//       }
//       exportDialog={
//         <ExportDialog config={config} isOpen={isExporting} setIsOpen={setIsExporting} setError={setError} exportLabel={exportLabel} />
//       }
//       deleteDialog={({
//         itemId,
//         onConfirm,
//         onCancel,
//       }: {
//         itemId: number;
//         onConfirm: (itemId: number) => void;
//         onCancel: (itemId: number) => void;
//       }) => (
//         <DeleteDialog<T>
//           config={config}
//           itemId={itemId}
//           error={deleteErrors[config.key]?.[itemId]}
//           onConfirm={async (itemId: number) => {
//             try {
//               await confirmDeleteEntityRecord(config.key, itemId);
//               await onConfirm(itemId);
//             } catch (error) {
//               console.error(error);
//               setDeleteError(config.key, itemId, (error as Error).message);
//             }
//           }}
//           onCancel={async (itemId: number) => {
//             clearDeleteError(config.key, itemId);
//             await onCancel(itemId);
//           }}
//         />
//       )}
//     ></ExpandableDataList_new>
//   );

//   function toggleIsCreating(status: boolean) {
//     if (isCreating && status) {
//       return;
//     }

//     setIsCreating(status);

//     if (status) {
//       createNewRecord();
//     } else {
//       removeNewRecord();
//     }

//     function createNewRecord() {
//       const newone = { id: 0 } as unknown as T;
//       config.setState((current) => [newone, ...current]);
//     }

//     function removeNewRecord() {
//       config.setState((current) => current.filter((item) => (item as unknown as T).id !== 0));
//     }
//   }
// }
