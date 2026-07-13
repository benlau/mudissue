import { create } from "zustand";
import { GlobalConfigStorage } from "../utils/storage/GlobalConfigStorage.ts";
import type { GlobalConfig } from "../types/GlobalConfig.ts";

function isEnoent(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: unknown }).code === "ENOENT"
  );
}

type GlobalConfigStoreState = {
  globalConfig: GlobalConfig | null;
  ensureGlobalConfig: () => Promise<GlobalConfig>;
  reloadGlobalConfig: () => Promise<GlobalConfig>;
};

const initialState = {
  globalConfig: null as GlobalConfig | null,
};

async function readGlobalConfigFromDisk(): Promise<GlobalConfig> {
  try {
    const globalConfigStorage = new GlobalConfigStorage();
    return await globalConfigStorage.read();
  } catch (err) {
    if (!isEnoent(err)) {
      throw err;
    }
    return {};
  }
}

export const useGlobalConfigStore = create<GlobalConfigStoreState>()(
  (set, get) => ({
    ...initialState,
    ensureGlobalConfig: async () => {
      const { globalConfig } = get();
      if (globalConfig !== null) {
        return globalConfig;
      }
      const loaded = await readGlobalConfigFromDisk();
      set({ globalConfig: loaded });
      return loaded;
    },

    reloadGlobalConfig: async () => {
      const loaded = await readGlobalConfigFromDisk();
      set({ globalConfig: loaded });
      return loaded;
    },
  }),
);

export function resetGlobalConfigStore(): void {
  useGlobalConfigStore.setState({
    ...initialState,
  });
}
