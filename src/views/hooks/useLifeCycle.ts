import { useEffect } from "react";
import { useLifeCycleStore } from "../../store/LifeCycleStore.ts";

export function useLifeCycle(id: string): void {
  useEffect(() => {
    useLifeCycleStore.getState().mount(id);
    return () => {
      useLifeCycleStore.getState().unmount(id);
    };
  }, [id]);
}
