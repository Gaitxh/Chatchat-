let counter = 0;

export function createId(prefix: string): string {
  counter += 1;
  const random = Math.random().toString(36).slice(2, 9);
  return `${prefix}_${Date.now().toString(36)}_${counter.toString(36)}_${random}`;
}
