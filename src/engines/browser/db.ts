// Minimal promise wrapper over IndexedDB for the browser engine's history.
// Stores: "jobs" (Job by id), "conversations" (API messages by job id) and
// "blobs" (photos, keyed "<job id>/<index>/<view|orig>").

const DB_NAME = "chizu";
const STORES = ["jobs", "conversations", "blobs"] as const;
export type Store = (typeof STORES)[number];

let opening: Promise<IDBDatabase> | undefined;

function db(): Promise<IDBDatabase> {
  opening ??= new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      for (const name of STORES) {
        if (!request.result.objectStoreNames.contains(name)) request.result.createObjectStore(name);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("indexedDB unavailable"));
  });
  return opening;
}

async function run<T>(
  store: Store,
  mode: IDBTransactionMode,
  op: (s: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const tx = (await db()).transaction(store, mode);
  const request = op(tx.objectStore(store));
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve(request.result);
    tx.onerror = () => reject(tx.error ?? new Error(`indexedDB ${store} failed`));
    tx.onabort = () => reject(tx.error ?? new Error(`indexedDB ${store} aborted`));
  });
}

export const idb = {
  get: <T>(store: Store, key: string) => run<T | undefined>(store, "readonly", (s) => s.get(key)),
  put: (store: Store, key: string, value: unknown) =>
    run(store, "readwrite", (s) => s.put(value, key)),
  all: <T>(store: Store) => run<T[]>(store, "readonly", (s) => s.getAll()),
  /** Deletes `key` and every key that starts with `key + "/"`. */
  remove: async (store: Store, key: string) => {
    await run(store, "readwrite", (s) => s.delete(key));
    await run(store, "readwrite", (s) => s.delete(IDBKeyRange.bound(`${key}/`, `${key}/￿`)));
  },
};
