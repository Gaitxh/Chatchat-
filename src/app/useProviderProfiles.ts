import { useCallback, useEffect, useRef, useState } from "react";
import {
  closeProviderLoginWindow,
  createProviderProfile,
  createProviderProfileStore,
  openProviderLoginWindow,
  probeProviderPage,
  providerLoginRuntimeAvailable,
  type ProviderPageProbe,
  type ProviderProfile,
  type ProviderProfileBackend,
  type ProviderProfileStore,
} from "../provider-sdk/index.js";

export function useProviderProfiles() {
  const storeRef = useRef<ProviderProfileStore | null>(null);
  const [profiles, setProfiles] = useState<ProviderProfile[]>([]);
  const [backend, setBackend] = useState<ProviderProfileBackend | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginWindowProfileIds, setLoginWindowProfileIds] = useState<string[]>([]);
  const [probeResults, setProbeResults] = useState<Record<string, ProviderPageProbe>>({});
  const [probingProfileId, setProbingProfileId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const canOpenLogin = providerLoginRuntimeAvailable();

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
        if (!cancelled) setError(caught instanceof Error ? caught.message : String(caught));
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => { cancelled = true; };
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

  const openLogin = useCallback(async (profile: ProviderProfile) => {
    setLoginError(null);
    try {
      await openProviderLoginWindow(profile);
      setLoginWindowProfileIds((current) =>
        current.includes(profile.profileId) ? current : [...current, profile.profileId],
      );
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : String(caught);
      setLoginError(message);
      throw caught;
    }
  }, []);

  const probe = useCallback(async (profile: ProviderProfile) => {
    setLoginError(null);
    setProbingProfileId(profile.profileId);
    try {
      const result = await probeProviderPage(profile);
      setProbeResults((current) => ({ ...current, [profile.profileId]: result }));
      return result;
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : String(caught);
      setLoginError(message);
      throw caught;
    } finally {
      setProbingProfileId(null);
    }
  }, []);

  const remove = useCallback(async (profileId: string) => {
    const store = storeRef.current;
    if (!store) return;
    try { await closeProviderLoginWindow(profileId); } catch { /* already closed */ }
    await store.remove(profileId);
    setLoginWindowProfileIds((current) => current.filter((id) => id !== profileId));
    setProbeResults((current) => {
      const next = { ...current };
      delete next[profileId];
      return next;
    });
    await refresh();
  }, [refresh]);

  return {
    profiles,
    backend,
    error,
    loginError,
    loginWindowProfileIds,
    probeResults,
    probingProfileId,
    isLoading,
    canOpenLogin,
    invite,
    openLogin,
    probe,
    remove,
    refresh,
  };
}
