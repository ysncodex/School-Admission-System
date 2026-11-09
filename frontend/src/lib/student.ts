export function isValidStudentId(value: string): boolean {
  return /^[0-9]{17}$/.test(value.trim());
}

export function normalizeStudentId(value: string): string {
  return value.trim();
}
