import type { Entity } from "../components/Entity";

export async function postRecord<T extends Entity>({
  endpoint,
  data,
  defaultErrorMessage,
}: {
  endpoint: string;
  data: T;
  defaultErrorMessage?: string;
}) {
  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });
  } catch (error) {
    throw new Error(
      (defaultErrorMessage || "Unable to save the record.") + " reason: " + (error instanceof Error ? error.message : String(error)),
      { cause: error instanceof Error ? error : undefined },
    );
  }

  if (!response.ok) {
    const detail = parseFailure(await response.text());
    throw new Error(detail || defaultErrorMessage || "Unable to save the record.");
  }

  const saved = (await response.json()) as T;
  return saved;
}

async function patchRecord<T extends Entity>({
  endpoint,
  id,
  data,
  defaultErrorMessage,
}: {
  endpoint: string;
  id: number;
  data: Partial<T>;
  defaultErrorMessage?: string;
}) {
  let response: Response;
  try {
    response = await fetch(`${endpoint}/${id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });
  } catch (error) {
    throw new Error(
      (defaultErrorMessage || `Unable to update record [${id}].`) + " reason: " + (error instanceof Error ? error.message : String(error)),
      { cause: error instanceof Error ? error : undefined },
    );
  }

  if (!response.ok) {
    const detail = parseFailure(await response.text());
    throw new Error(detail || defaultErrorMessage || `Unable to update record [${id}].`);
  }

  return (await response.json()) as T;
}

async function deleteRecord({ endpoint, id, defaultErrorMessage }: { endpoint: string; id: number; defaultErrorMessage?: string }) {
  let response: Response;
  try {
    response = await fetch(`${endpoint}/${id}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      // body: JSON.stringify({
      //   include: selectedReferences.map((reference) => ({
      //     entity: reference.entityKey,
      //     id: reference.id,
      //   })),
      // }),
    });
  } catch (deleteError) {
    throw deleteError;
  }

  if (!response.ok) {
    const detail = parseFailure(await response.text());
    throw new Error(detail || defaultErrorMessage || `Unable to delete record [${id}].`);
  }
}

function parseFailure(detailText: string) {
  let detail = detailText;
  try {
    const parsed = JSON.parse(detailText) as { error?: string };
    detail = parsed.error ?? detailText;
  } catch {
    // keep raw text fallback
  }
  return detail;
}

export const api = {
  delete: deleteRecord,
  patch: patchRecord,
  post: postRecord,
};
