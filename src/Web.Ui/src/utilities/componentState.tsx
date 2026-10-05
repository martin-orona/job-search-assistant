import type React from "react";
import { useState } from "react";

export function useHybridSplitBoolean({
  fromParent,
  defaultValue = false,
  onTrue,
  onFalse,
}: {
  fromParent?: boolean;
  onTrue?: (event: React.SyntheticEvent<Element>) => void;
  onFalse?: (event: React.SyntheticEvent<Element>) => void;
  defaultValue?: boolean;
}): readonly [boolean, (event: React.SyntheticEvent<Element, Event>, value?: boolean) => void] {
  return useHybridBoolean({
    fromParent,
    defaultValue,
    onToggled: (event: React.SyntheticEvent<Element>, value: boolean) => {
      if (value) {
        onTrue?.(event);
      } else {
        onFalse?.(event);
      }
    },
  });
}

export function useHybridBoolean({
  fromParent,
  defaultValue = false,
  onToggled,
}: {
  fromParent?: boolean;
  defaultValue?: boolean;
  onToggled?: (event: React.SyntheticEvent<Element>, value: boolean) => void;
}): readonly [boolean, (event: React.SyntheticEvent<Element, Event>, value?: boolean) => void] {
  const [internalValue, setInternalValue] = useState(defaultValue);

  const isControlled = fromParent !== undefined;
  const actualValue = isControlled ? fromParent : internalValue;

  const toggle = (event: React.SyntheticEvent<Element>, value?: boolean) => {
    event.preventDefault();
    event.stopPropagation();

    const newValue = value ?? !actualValue;

    if (!isControlled) {
      setInternalValue(newValue);
    }

    onToggled?.(event, newValue);
  };

  const result = [actualValue, toggle] as const;
  return result;
}

export function useDialogErrors() {
  type RecordErrorDictionary = Record<string, Record<number, string>>;

  const [errors, setErrors] = useState<RecordErrorDictionary>({});

  function setError(key: string, itemId: number, error: string) {
    setErrors((prev) => {
      const errors = { ...prev };
      if (!errors[key]) {
        errors[key] = {};
      }
      errors[key][itemId] = error;
      return errors;
    });
  }

  function clearError(key: string, itemId: number) {
    setErrors((prev) => {
      const errors = { ...prev };
      if (errors[key]) {
        delete errors[key][itemId];
      }
      return errors;
    });
  }

  return [errors, setError, clearError] as const;
}

export function useSimpleDialogErrors() {
  type ErrorDictionary = Record<number, string>;

  const [errors, setErrors] = useState<ErrorDictionary>({});

  function setError(itemId: number, error: string) {
    setErrors((prev) => {
      const errors = { ...prev };
      errors[itemId] = error;
      return errors;
    });
  }

  function clearError(itemId: number) {
    setErrors((prev) => {
      const errors = { ...prev };
      delete errors[itemId];
      return errors;
    });
  }

  return [errors, setError, clearError] as const;
}
