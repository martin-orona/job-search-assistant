export function prepForSave_Date_to_DateOnly(date: string): string {
  const rawDate = date?.trim() ?? "";
  const validDate = /^\d{4}-\d{2}-\d{2}$/.test(rawDate) ? rawDate : new Date().toISOString().slice(0, 10);
  return validDate;
}
