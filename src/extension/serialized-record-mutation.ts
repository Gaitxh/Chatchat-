export interface SerializedRecordMutation<T> {
  upsert(key: string, value: T): Promise<Record<string, T>>;
  merge(values: Readonly<Record<string, T>>): Promise<Record<string, T>>;
  /** Fill missing keys without allowing a stale hydration snapshot to overwrite newer persisted state. */
  defaults(values: Readonly<Record<string, T>>): Promise<Record<string, T>>;
  remove(key: string): Promise<Record<string, T>>;
  replace(values: Readonly<Record<string, T>>): Promise<Record<string, T>>;
}

export function createSerializedRecordMutation<T>(
  read: () => Promise<Record<string, T>>,
  write: (value: Record<string, T>) => Promise<void>,
): SerializedRecordMutation<T> {
  let tail: Promise<void> = Promise.resolve();

  function run(task: () => Promise<Record<string, T>>): Promise<Record<string, T>> {
    const result = tail.then(task, task);
    tail = result.then(() => undefined, () => undefined);
    return result;
  }

  return {
    upsert(key, value) {
      return run(async () => {
        const current = await read();
        const next = { ...current, [key]: value };
        await write(next);
        return next;
      });
    },
    merge(values) {
      return run(async () => {
        const current = await read();
        const next = { ...current, ...values };
        await write(next);
        return next;
      });
    },
    defaults(values) {
      return run(async () => {
        const current = await read();
        const next = { ...values, ...current };
        await write(next);
        return next;
      });
    },
    remove(key) {
      return run(async () => {
        const current = await read();
        const next = { ...current };
        delete next[key];
        await write(next);
        return next;
      });
    },
    replace(values) {
      return run(async () => {
        const next = { ...values };
        await write(next);
        return next;
      });
    },
  };
}
