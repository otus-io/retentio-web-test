import "@testing-library/jest-dom/vitest";

function createMemoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear() {
      map.clear();
    },
    getItem(key: string) {
      return map.get(String(key)) ?? null;
    },
    key(index: number) {
      return [...map.keys()][Number(index)] ?? null;
    },
    removeItem(key: string) {
      map.delete(String(key));
    },
    setItem(key: string, value: string) {
      map.set(String(key), String(value));
    },
  } as Storage;
}

function storageIsUsable(s: unknown): s is Storage {
  return (
    typeof s === "object" &&
    s !== null &&
    typeof (s as Storage).getItem === "function" &&
    typeof (s as Storage).setItem === "function" &&
    typeof (s as Storage).removeItem === "function" &&
    typeof (s as Storage).clear === "function"
  );
}

// Node may expose experimental `localStorage` when NODE_OPTIONS includes
// `--localstorage-file` with an invalid path; it often omits `clear`. Vitest
// workers can inherit that on both `globalThis` and `window`. Use one in-memory
// Storage so tests and components share a working API.
const w = globalThis as typeof globalThis & { window?: Window };
const globalBroken = !storageIsUsable(globalThis.localStorage);
const windowBroken = Boolean(w.window && !storageIsUsable(w.window.localStorage));
if (globalBroken || windowBroken) {
  const storage = createMemoryStorage();
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    enumerable: true,
    value: storage,
  });
  if (w.window) {
    Object.defineProperty(w.window, "localStorage", {
      configurable: true,
      enumerable: true,
      value: storage,
    });
  }
}
