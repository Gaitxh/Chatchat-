import { useCallback, useEffect, useRef, useState } from "react";
import {
  createProviderProfile,
  createProviderProfileStore,
  type ProviderProfile,
  type ProviderProfileBackend,
  type ProviderProfileStore,
} from "../provider-sdk/index.js";

export function useProviderProfiles() {
  const storeRef = useRef<ProviderProfileStore | null>(null);
  const [profiles, setProfiles] = useState<ProviderProfile[]>([]);
  const [backend, setBackend] = useState<ProviderProfileBackend | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    const store = storeRef.current;
    if (!store) return;
    setProfiles(await store.list());
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const store = await createProviderProfileStore();
        if (cancelled) return;
        storeRef.current = store;
        setBackend(store.backend);
        setProfiles(await store.list());
      } catch (caught) {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : String(caught));
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const invite = useCallback(async (url: string, displayName?: string) => {
    const store = storeRef.current;
    if (!store) throw new Error("Provider profile store is not ready yet.");
    const profile = createProviderProfile(
      displayName === undefined ? { url } : { url, displayName },
    );
    await store.save(profile);
    await refresh();
    return profile;
  }, [refresh]);

  const remove = useCallback(async (profileId: string) => {
    const store = storeRef.current;
    if (!store) return;
    await store.remove(profileId);
    await refresh();
  }, [refresh]);

  return {
    profiles,
    backend,
    error,
    isLoading,
    invite,
    remove,
    refresh,
  };
}
