/// <summary>
/// Generates a patch object containing only the properties that have changed between the original and updated objects.
/// </summary>
export function getPatch<T extends Record<any, any>>(original: T, updated: T): Partial<T> {
  const patch: Partial<T> = {};
  for (const key in updated) {
    const originalValue = original[key];
    const updatedValue = updated[key];
    if (JSON.stringify(updatedValue) === JSON.stringify(originalValue)) {
      continue;
    }
    if (originalValue != null && updatedValue != null
      && typeof originalValue === "object" && typeof updatedValue === "object"
      && !Array.isArray(originalValue) && !Array.isArray(updatedValue)) {
      const nestedPatch = getPatch(originalValue, updatedValue);
      patch[key] = ("id" in updatedValue
        ? { ...nestedPatch, id: updatedValue.id }
        : nestedPatch) as T[typeof key];
    } else {
      patch[key] = updatedValue;
    }
  }
  return patch;
}
