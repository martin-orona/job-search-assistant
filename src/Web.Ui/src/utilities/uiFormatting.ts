export function formatDate(value?: string | null) {
  if (!value) {
    return "No date";
  }

  const rawDate = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (rawDate) {
    const [, year, month, day] = rawDate;
    const parsed = new Date(Number(year), Number(month) - 1, Number(day));
    return parsed.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
export function toDateInputValue(value: string | null | undefined): string {
  if (!value) {
    return "";
  }

  const rawDate = value.match(/^(\d{4}-\d{2}-\d{2})/);
  if (rawDate) {
    return rawDate[1];
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "";
  }

  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
