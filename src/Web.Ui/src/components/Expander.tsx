import React, { useEffect, useRef } from "react";

import { useHybridSplitBoolean } from "../utilities/componentState";
import type { CancelEntityHandler, DeleteEntityHandler, DeleteEntityParams, Entity } from "./Entity";
import "./Expander.css";

// // TODO: remove these old components
// // I replaced them because DETAILS doesn't play well with styling and putting buttons in the header summary
// export function ExpandableDataList_0({
//   id,
//   title,
//   onRefresh,
//   children,
// }: {
//   id: string;
//   title: string;
//   onRefresh: React.MouseEventHandler<HTMLButtonElement>;
//   children: React.ReactNode;
// }) {
//   return (
//     <>
//       <style>{`
//         .expandable-data-list-container {
//             display: flex;
//             align-items: flex-start; /* 1. Justifies the refresh button to the top */
//             gap: 0.5rem;            /* Puts a clean space between the count and the button */

//             /* Make the details element take up the remaining horizontal space */
//             & > details {
//                 flex-grow: 1;

//                 /* Optional: Removes the default full-width block behavior of summary */
//                 & > summary {
//                     /* display: inline-flex; */
//                     align-items: center;
//                     cursor: pointer;
//                 }
//             }
//         }
//     `}</style>
//       <div className="expandable-data-list-container">
//         <Expander id={id} title={title}>
//           {children}
//         </Expander>

//         <button
//           type="button"
//           className="data-list-refresh-button button expander-summary-button"
//           aria-label="Refresh records"
//           onClick={onRefresh}
//         >
//           {/* 🔄  */}
//           Refresh
//         </button>
//       </div>
//     </>
//   );
// }

export function ExpandableDataList({
  id,
  title,
  className,
  data,
  isLoading,
  loadingMessage,
  emptyListMessage,
  onRefresh,
  open,
  onToggle,
  actions,
  generateListItem = (item, index, list) => <li key={index}>List item generator not defined. Item {index}.</li>,
  children,
}: {
  id: string;
  title: string | React.ReactNode;
  className?: string;
  data: Entity[];
  isLoading?: boolean;
  loadingMessage?: string;
  emptyListMessage?: string;
  onRefresh: React.MouseEventHandler<HTMLButtonElement>;
  actions?: React.ReactNode;
  generateListItem?: (item: Entity, index: number, list: Entity[]) => React.ReactNode;
  children?: React.ReactNode;
  open?: boolean;
  onToggle?: (event: React.SyntheticEvent<HTMLDetailsElement>) => void;
}) {
  const [isExpanded, setIsExpanded] = React.useState(open ?? false);

  return (
    <ActionableExpander
      id={id}
      className={`expandable-data-list ${className ?? ""}`}
      title={
        <>
          <div className="header">
            <span className="title">{title}</span>
            <span className="count">{data?.length || 0} record(s)</span>
          </div>
        </>
      }
      actions={
        <>
          {actions && isExpanded && actions}

          <button
            type="button"
            className="data-list-refresh-button button expander-summary-button"
            aria-label="Refresh records"
            onClick={onRefresh}
          >
            Refresh
          </button>
        </>
      }
      open={isExpanded}
      onToggle={toggle}
    >
      <>
        {isLoading && <p className="empty-list loading">{loadingMessage ?? "Loading..."}</p>}

        {data.length === 0 && <p className="empty-list">{emptyListMessage ?? "No data."}</p>}

        {data.length > 0 && (
          <>
            <ul className="data-list">
              {data.map((item: Entity, index: number, list: Entity[]) => (
                <li key={item.id}>{generateListItem(item, index, list)}</li>
              ))}
            </ul>
          </>
        )}
      </>

      {children}
    </ActionableExpander>
  );

  function toggle(event: React.SyntheticEvent<HTMLDetailsElement>) {
    setIsExpanded(event.currentTarget.open);
    onToggle?.(event);
  }
}

export function ExpandableDataListItem({
  id,
  title,
  actions,
  children,
  open,
  onToggle,
}: {
  id: string;
  title: string | React.ReactNode;
  actions: React.ReactNode;
  children: React.ReactNode;
  open?: boolean;
  onToggle?: (event: React.SyntheticEvent<HTMLDetailsElement>) => void;
}) {
  const [isExpanded, setIsExpanded] = React.useState(open ?? false);

  return (
    <ActionableExpander id={id} title={title} actions={actions} inlineActionsWhenOpen={false} open={isExpanded} onToggle={toggle}>
      {children}
    </ActionableExpander>
  );

  function toggle(event: React.SyntheticEvent<HTMLDetailsElement>) {
    setIsExpanded(event.currentTarget.open);
    onToggle?.(event);
  }
}

export function ActionableExpander({
  id,
  title,
  className,
  actions,
  children,
  inlineActionsWhenOpen = true,
  open,
  onToggle,
}: {
  id: string;
  title: string | React.ReactNode;
  className?: string;
  actions: React.ReactNode;
  children: React.ReactNode;
  inlineActionsWhenOpen?: boolean;
  open?: boolean;
  onToggle?: (event: React.SyntheticEvent<HTMLDetailsElement>) => void;
}) {
  const [isExpanded, setIsExpanded] = React.useState(open ?? false);

  return (
    <>
      <div className={`actionable-expander container ${className ?? ""}`}>
        <Expander id={id} title={title} className={className} open={isExpanded} onToggle={toggle}>
          {isExpanded && inlineActionsWhenOpen && <Actions />}
          {children}
        </Expander>

        {(!isExpanded || !inlineActionsWhenOpen) && <Actions />}
      </div>
    </>
  );

  function Actions() {
    return <div className="actionable-expander actions">{actions}</div>;
  }

  function toggle(event: React.SyntheticEvent<HTMLDetailsElement>) {
    setIsExpanded(event.currentTarget.open);
    onToggle?.(event);
  }
}

export function Expander_Details({
  id,
  title,
  className,
  children,
  open,
  onToggle,
}: {
  id: string;
  title: string | React.ReactNode;
  className?: string;
  children: React.ReactNode;
  open?: boolean;
  onToggle?: (event: React.SyntheticEvent<HTMLDetailsElement>) => void;
}) {
  const [isExpanded, setIsExpanded] = React.useState(open ?? false);

  return (
    <details id={id} className={`expander ${className ?? ""}`} open={isExpanded} onToggle={toggle}>
      <summary className="expander-summary">{title}</summary>
      <div className="expander-content">{children}</div>
    </details>
  );

  function toggle(event: React.SyntheticEvent<HTMLDetailsElement>) {
    setIsExpanded(event.currentTarget.open);
    onToggle?.(event);
  }
}

export function Expander({
  id,
  title,
  className,
  children,
  open,
  onToggle,
}: {
  id: string;
  title: string | React.ReactNode;
  className?: string;
  children: React.ReactNode;
  open?: boolean;
  onToggle?: (event: React.SyntheticEvent<HTMLDetailsElement>) => void;
}) {
  const [isExpanded, setIsExpanded] = React.useState(open ?? false);

  useEffect(() => {
    (async () => {
      setIsExpanded(open ?? false);
    })();
  }, [open]);

  return (
    <details id={id} className={`expander ${className ?? ""}`} open={isExpanded} onToggle={toggle}>
      <summary className="expander-summary">{title}</summary>
      <div className="expander-content">{children}</div>
    </details>
  );

  function toggle(event: React.SyntheticEvent<HTMLDetailsElement>) {
    setIsExpanded(event.currentTarget.open);
    onToggle?.(event);
  }
}

export type ExpanderChild = React.ReactNode | ExpanderChildGenerator;

export interface ExpanderChildGenerator {
  (params: { isExpanded: boolean; expand: () => void; collapse: () => void }): React.ReactNode;
}

type ListItemGenerator = (params: {
  item: Entity;
  index: number;
  list: Entity[];
  onCancelEditing?: CancelEntityHandler;
  onDelete: DeleteEntityHandler;
  props?: Record<string, unknown>;
}) => React.ReactNode;

type DeleteDialogGenerator = (params: {
  itemId: number;
  onConfirm: (itemId: number) => void;
  onCancel: (itemId: number) => void;
}) => React.ReactNode;

export function ExpandableDataList_new({
  id,
  title,
  className,
  data,
  isLoading,
  loadingMessage,
  emptyListMessage,
  onRefresh,
  open,
  actions,
  onExpanded,
  onCollapsed,
  generateListItem = ({ item, index }) => (
    <li key={index}>
      List item generator not defined. Item [{index}]:{item.id}.
    </li>
  ),
  importDialog,
  exportDialog,
  deleteDialog,
  children,
}: {
  id: string;
  title: string | React.ReactNode;
  className?: string;
  data: Entity[];
  isLoading?: boolean;
  loadingMessage?: string;
  emptyListMessage?: string;
  onRefresh: React.MouseEventHandler<HTMLButtonElement>;
  actions?: React.ReactNode;
  generateListItem?: ListItemGenerator;
  importDialog?: React.ReactNode;
  exportDialog?: React.ReactNode;
  deleteDialog?: DeleteDialogGenerator;
  children?: React.ReactNode;
  open?: boolean;
  onExpanded?: (event: React.SyntheticEvent<Element>) => void;
  onCollapsed?: (event: React.SyntheticEvent<Element>) => void;
}) {
  const [isExpanded, setIsExpanded] = useHybridSplitBoolean({
    fromParent: open,
    onTrue: (event: React.SyntheticEvent<Element>) => onExpanded?.(event),
    onFalse: (event: React.SyntheticEvent<Element>) => onCollapsed?.(event),
  });
  const [beingDeleted, setBeingDeleted] = React.useState<Set<number>>(new Set());

  return (
    <ActionableExpander_new
      id={id}
      className={`expandable-data-list ${className ?? ""}`}
      title={
        <>
          <span className="title">{title}</span>
          <span className="count">{data?.length || 0} record(s)</span>
        </>
      }
      actions={
        <>
          {actions}

          <button
            type="button"
            className="data-list-refresh-button button expander-summary-button"
            aria-label="Refresh records"
            onClick={onRefresh}
          >
            Refresh
          </button>
        </>
      }
      open={isExpanded}
      onExpanded={expanded}
      onCollapsed={collapsed}
    >
      <>
        {importDialog ?? null}
        {exportDialog ?? null}

        {isLoading && <p className="empty-list loading">{loadingMessage ?? "Loading..."}</p>}

        {data.length === 0 && <p className="empty-list">{emptyListMessage ?? "No data."}</p>}

        {data.length > 0 && (
          <>
            <ul className="data-list">
              {data.map((item: Entity, index: number, list: Entity[]) => (
                // <li key={item.id}>{generateListItem(item, index, list)}</li>
                <li key={item.id} id={`${id}--record-${item.id}`}>
                  <ExpandableDataList_LineItem
                    item={item}
                    index={index}
                    list={list}
                    isBeingDeleted={beingDeleted.has(item.id)}
                    generateListItem={generateListItem}
                    deleteDialog={deleteDialog}
                    addToDeleteList={addToDeleteList}
                    removeFromDeleteList={removeFromDeleteList}
                  />
                </li>
              ))}
            </ul>
          </>
        )}
      </>

      {children}
    </ActionableExpander_new>
  );

  async function addToDeleteList({ id }: DeleteEntityParams) {
    setBeingDeleted((current) => {
      const newSet = new Set(current);
      newSet.add(id);
      return newSet;
    });
  }

  function removeFromDeleteList(itemId: number) {
    setBeingDeleted((current) => {
      const newSet = new Set(current);
      newSet.delete(itemId);
      return newSet;
    });
  }

  function expanded(event: React.SyntheticEvent<Element>) {
    setIsExpanded(event, true);
  }

  function collapsed(event: React.SyntheticEvent<Element>) {
    setIsExpanded(event, false);
  }
}

// Declared at module scope so React keeps a stable component type and preserves descendant state.
function ExpandableDataList_LineItem({
  item,
  index,
  list,
  isBeingDeleted,
  generateListItem,
  deleteDialog,
  addToDeleteList,
  removeFromDeleteList,
}: {
  item: Entity;
  index: number;
  list: Entity[];
  isBeingDeleted: boolean;
  generateListItem: ListItemGenerator;
  deleteDialog?: DeleteDialogGenerator;
  addToDeleteList: DeleteEntityHandler;
  removeFromDeleteList: (itemId: number) => void;
}) {
  let dialog: React.ReactNode;
  let listItem: React.ReactNode;

  if (isBeingDeleted) {
    dialog = deleteDialog?.({
      itemId: item.id,
      onConfirm: (itemId: number) => {
        removeFromDeleteList(itemId);
      },
      onCancel: removeFromDeleteList,
    });
    listItem = generateListItem({
      item,
      index,
      list,
      onDelete: addToDeleteList,

      props: { readonly: true, className: "being-deleted" },
    });
  } else {
    listItem = generateListItem({ item, index, list, onDelete: addToDeleteList, props: {} });
  }

  return (
    <>
      {dialog}
      {listItem}
    </>
  );
}

export function ExpandableDataListItem_new({
  id,
  className,
  expandable = true,
  title,
  actions,
  children,
  open,
  onExpanded,
  onCollapsed,
}: {
  id: string;
  className?: string;
  expandable?: boolean;
  title: string | React.ReactNode;
  actions: React.ReactNode;
  children: React.ReactNode;
  open?: boolean;
  onExpanded?: (event: React.SyntheticEvent<Element>) => void;
  onCollapsed?: (event: React.SyntheticEvent<Element>) => void;
}) {
  const [isExpanded, setIsExpanded] = useHybridSplitBoolean({
    fromParent: open,
    onTrue: (event: React.SyntheticEvent<Element>) => onExpanded?.(event),
    onFalse: (event: React.SyntheticEvent<Element>) => onCollapsed?.(event),
  });

  return (
    <ActionableExpander_new
      id={id}
      className={className}
      expandable={expandable}
      title={title}
      actions={actions}
      open={isExpanded}
      onExpanded={expanded}
      onCollapsed={collapsed}
    >
      {children}
    </ActionableExpander_new>
  );

  function expanded(event: React.SyntheticEvent<Element>) {
    setIsExpanded(event, true);
  }

  function collapsed(event: React.SyntheticEvent<Element>) {
    setIsExpanded(event, false);
  }
}

export function ActionableExpander_new({
  id,
  title,
  className,
  expandable = true,
  actions,
  children,
  open,
  onExpanded,
  onCollapsed,
}: {
  id: string;
  title: string | React.ReactNode;
  className?: string;
  expandable?: boolean;
  actions: React.ReactNode;
  children: React.ReactNode;
  open?: boolean;
  onExpanded?: (event: React.SyntheticEvent<Element>) => void;
  onCollapsed?: (event: React.SyntheticEvent<Element>) => void;
}) {
  const [isExpanded, setIsExpanded] = useHybridSplitBoolean({
    fromParent: open,
    onTrue: (event: React.SyntheticEvent<Element>) => onExpanded?.(event),
    onFalse: (event: React.SyntheticEvent<Element>) => onCollapsed?.(event),
  });

  return (
    <>
      <Expander_new
        id={id}
        title={
          <>
            <span className="normal-title">{title}</span>
            <span className="actions">{actions}</span>
          </>
        }
        className={`actionable-expander ${className ?? ""}`}
        open={isExpanded}
        expandable={expandable}
        onExpanded={expanded}
        onCollapsed={collapsed}
      >
        {children}
      </Expander_new>
    </>
  );

  function expanded(event: React.SyntheticEvent<Element>) {
    setIsExpanded(event, true);
  }

  function collapsed(event: React.SyntheticEvent<Element>) {
    setIsExpanded(event, false);
  }
}

export function Expander_new({
  id,
  className,
  title,
  subTitle,
  children,
  open,
  expandable = true,
  onExpanded,
  onCollapsed,
}: {
  id: string;
  className?: string;
  title: ExpanderChild;
  subTitle?: ExpanderChild;
  open?: boolean;
  expandable?: boolean;
  onExpanded?: (event: React.SyntheticEvent<Element>) => void;
  onCollapsed?: (event: React.SyntheticEvent<Element>) => void;
  children: ExpanderChild;
}) {
  const [isExpanded, setIsExpanded] = useHybridSplitBoolean({
    fromParent: open,
    onTrue: (event: React.SyntheticEvent<Element>) => onExpanded?.(event),
    onFalse: (event: React.SyntheticEvent<Element>) => onCollapsed?.(event),
  });
  const headerRef = useRef<HTMLDivElement>(null);

  const expandedIcon = expandable ? "▼" : <>&nbsp;&nbsp;&nbsp;</>;
  const collapsedIcon = expandable ? "▶" : <>&nbsp;&nbsp;&nbsp;</>;

  return (
    <div id={id} className={`ux component expander ${isExpanded ? "expanded" : "collapsed"} ${className ?? ""}`}>
      <div ref={headerRef} className="header" onClick={expandable ? onClick : undefined}>
        <div className="expanderIcon">{isExpanded ? expandedIcon : collapsedIcon}</div>
        <div className="title expander-content">{generateChild(title)}</div>
        {subTitle && <div className="subtitle expander-content">{generateChild(subTitle)}</div>}
      </div>
      {isExpanded && <div className="expanded expander-content">{generateChild(children)}</div>}
    </div>
  );

  function generateChild(child: ExpanderChild): React.ReactNode {
    if (typeof child === "function") {
      return child({ isExpanded, expand: expandContent, collapse: collapseContent });
    }

    return child;
  }

  function onClick(event: React.SyntheticEvent<Element>) {
    const isNowExpanded = !isExpanded;
    if (isNowExpanded) {
      expandContent(event);
    } else {
      collapseContent(event);
    }
  }

  function expandContent(event?: React.SyntheticEvent<Element>) {
    setIsExpanded(event as React.SyntheticEvent<Element>, true);
    // TODO: consider the impact of calling propagateClick here
    // propagateClick(event, onExpanded);
    // onExpanded?.(event ?? undefined);
  }

  function collapseContent(event?: React.SyntheticEvent<Element>) {
    setIsExpanded(event as React.SyntheticEvent<Element>, false);
  }
}
