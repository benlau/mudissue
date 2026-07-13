import { create } from "zustand";

type PendingResolver = () => void;

export type LifeCycleStoreState = {
  mountedIds: Set<string>;
  mountedResolvers: Map<string, PendingResolver[]>;
  unmountedResolvers: Map<string, PendingResolver[]>;
  mount: (id: string) => void;
  unmount: (id: string) => void;
  waitUntilMounted: (id: string, timeout?: number) => Promise<void>;
  waitUnitUnmounted: (id: string, timeout?: number) => Promise<void>;
};

function removeResolver(
  map: Map<string, PendingResolver[]>,
  id: string,
  resolver: PendingResolver,
): boolean {
  const resolvers = map.get(id) ?? [];
  const idx = resolvers.indexOf(resolver);
  if (idx === -1) {
    return false;
  }
  resolvers.splice(idx, 1);
  if (resolvers.length === 0) {
    map.delete(id);
  } else {
    map.set(id, resolvers);
  }
  return true;
}

function enqueueResolver(
  map: Map<string, PendingResolver[]>,
  id: string,
  resolver: PendingResolver,
): void {
  const resolvers = map.get(id) ?? [];
  resolvers.push(resolver);
  map.set(id, resolvers);
}

export const useLifeCycleStore = create<LifeCycleStoreState>()((_, get) => ({
  mountedIds: new Set<string>(),
  mountedResolvers: new Map<string, PendingResolver[]>(),
  unmountedResolvers: new Map<string, PendingResolver[]>(),

  mount: (id) => {
    const { mountedIds, mountedResolvers } = get();
    mountedIds.add(id);
    const resolvers = mountedResolvers.get(id);
    if (resolvers?.length) {
      mountedResolvers.delete(id);
      for (const resolve of resolvers) {
        resolve();
      }
    }
  },

  unmount: (id) => {
    const { mountedIds, unmountedResolvers } = get();
    mountedIds.delete(id);
    const resolvers = unmountedResolvers.get(id);
    if (resolvers?.length) {
      unmountedResolvers.delete(id);
      for (const resolve of resolvers) {
        resolve();
      }
    }
  },

  waitUntilMounted: (id, timeout = -1) => {
    const { mountedIds, mountedResolvers } = get();
    if (mountedIds.has(id)) {
      return Promise.resolve();
    }
    return new Promise((resolve, reject) => {
      enqueueResolver(mountedResolvers, id, resolve);

      if (timeout >= 0) {
        globalThis.setTimeout(() => {
          const removed = removeResolver(mountedResolvers, id, resolve);
          if (removed) {
            reject(new Error(`waitUntilMounted("${id}") timed out`));
          }
        }, timeout);
      }
    });
  },

  waitUnitUnmounted: (id, timeout = -1) => {
    const { mountedIds, unmountedResolvers } = get();
    if (!mountedIds.has(id)) {
      return Promise.resolve();
    }
    return new Promise((resolve, reject) => {
      enqueueResolver(unmountedResolvers, id, resolve);

      if (timeout >= 0) {
        globalThis.setTimeout(() => {
          const removed = removeResolver(unmountedResolvers, id, resolve);
          if (removed) {
            reject(new Error(`waitUnitUnmounted("${id}") timed out`));
          }
        }, timeout);
      }
    });
  },
}));

export function resetLifeCycleStore(): void {
  useLifeCycleStore.setState({
    mountedIds: new Set<string>(),
    mountedResolvers: new Map<string, PendingResolver[]>(),
    unmountedResolvers: new Map<string, PendingResolver[]>(),
  });
}
