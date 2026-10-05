import { useState } from "react";
import {
  InstantiatedEntityUi,
  type CancelEntityHandler,
  type Entity,
  type InstantiatedEntityUiBuilderProps,
  type SaveEntityHandler,
} from "../components/Entity";

export function renderEntityUi<T extends Entity>({ children, ...props }: InstantiatedEntityUiBuilderProps<T>) {
  return (
    <InstantiatedEntityUi<T>
      {...props}
      // entity={props.entity}
      // entityKey={props.entityKey}
      // DisplayUi={props.DisplayUi}
      // EditUi={props.EditUi}
      // onSave={props.onSave}
      // onCancelEditing={props.onCancelEditing}
      // editError={props.editError}
      // onDelete={props.onDelete}
      // config={props.config}
      // readonly={props.readonly}
    >
      {children}
    </InstantiatedEntityUi>
  );
}

export function getComponentName(Component: React.ComponentType<any>): string {
  return Component.displayName || Component.name || "Anonymous";
}

export function useEntityEditor<T extends Entity>({
  entity,
  onSave,
  onCancel,
}: {
  entity: T;
  onSave?: SaveEntityHandler<T>;
  onCancel?: CancelEntityHandler;
}) {
  if (!onSave) {
    throw new Error("onSave is required");
  }
  if (!onCancel) {
    throw new Error("onCancel is required");
  }

  const [draft, setDraft] = useState<T>(entity);

  function updateField(mutate: (updated: T) => void): T {
    let updated: T;
    setDraft((current) => {
      updated = structuredClone(current);
      mutate(updated);
      return updated;
    });
    return updated!;
  }

  async function handleSave(event: any) {
    event.preventDefault();
    event.stopPropagation();

    await onSave?.({ event, entity: draft });
  }

  async function handleCancel({ event, id }: { event: React.SyntheticEvent<Element>; id: number }) {
    setDraft(entity);
    onCancel!({ event, id });
  }

  return [draft, updateField, handleSave, handleCancel] as const;
}
