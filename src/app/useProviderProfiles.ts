import { listen } from "@tauri-apps/api/event";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  adapterRecipeComplete,
  applyTeachSelection,
  cancelProviderTeach,
  cloneProviderProfile,
  closeProviderLoginWindow,
  createAdapterRecipeStore,
  createBrowserCouncilAgent,
  createProviderProfile,
  createProviderProfileStore,
  openProviderLoginWindow,
  probeProviderPage,
  providerLoginRuntimeAvailable,
  readProviderTeachSelection,
  startProviderTeach,
  testProviderSpeech,
  verifyProviderCouncilBridge,
  type AdapterRecipe,
  type AdapterRecipeStore,
  type AdapterSpeechResult,
  type CouncilBridgeVerificationResult,
  type ProviderPageProbe,
  type ProviderProfile,
  type ProviderProfileBackend,
  type ProviderProfileStore,
  type TeachRole,
} from "../provider-sdk/index.js";

interface TeachEventPayload {
  profileId: string;
}

const MAX_LIVE_ADVISORS = 4;

export function useProviderProfiles() {
  const storeRef = useRef<ProviderProfileStore | null>(null);
  const recipeStoreRef = useRef<AdapterRecipeStore | null>(null);
  const profilesRef = useRef<ProviderProfile[]>([]);
  const [profiles, setProfiles] = useState<ProviderProfile[]>([]);
  const [recipes, setRecipes] = useState<Record<string, AdapterRecipe>>({});
  const [backend, setBackend] = useState<ProviderProfileBackend | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginWindowProfileIds, setLoginWindowProfileIds] = useState<string[]>([]);
  const [probeResults, setProbeResults] = useState<Record<string, ProviderPageProbe>>({});
  const [probingProfileId, setProbingProfileId] = useState<string | null>(null);
  const [teaching, setTeaching] = useState<{ profileId: string; role: TeachRole } | null>(null);
  const [speechResults, setSpeechResults] = useState<Record<string, AdapterSpeechResult>>({});
  const [testingProfileId, setTestingProfileId] = useState<string | null>(null);
  const [bridgeResults, setBridgeResults] = useState<Record<string, CouncilBridgeVerificationResult>>({});
  const [verifyingProfileId, setVerifyingProfileId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const canOpenLogin = providerLoginRuntimeAvailable();

  const setProfileState = useCallback((next: ProviderProfile[]) => {
    profilesRef.current = next;
    setProfiles(next);
  }, []);

  const normalizeRuntimeProfiles = useCallback(async (
    store: ProviderProfileStore,
    incoming: ProviderProfile[],
  ): Promise<ProviderProfile[]> => {
    const normalized: ProviderProfile[] = [];
    for (const profile of incoming) {
      // Provider windows are runtime-local. A new app process must re-open the
      // user's isolated WebView and pass Council Gate before a seat is active.
      const needsReset =
        profile.seatState === "seated" ||
        profile.authState === "ready" ||
        profile.authState === "adapter_required";
      if (!needsReset) {
        normalized.push(profile);
        continue;
      }
      const next = cloneProviderProfile(profile, {
        authState: "login_required",
        seatState: "bench",
      });
      await store.save(next);
      normalized.push(next);
    }
    return normalized;
  }, []);

  const refresh = useCallback(async () => {
    const store = storeRef.current;
    if (!store) return;
    setProfileState(await store.list());
  }, [setProfileState]);

  const refreshRecipes = useCallback(async () => {
    const store = recipeStoreRef.current;
    if (!store) return;
    const list = await store.list();
    setRecipes(Object.fromEntries(list.map((recipe) => [recipe.profileId, recipe])));
  }, []);

  const invalidateGate = useCallback(async (profile: ProviderProfile) => {
    const store = storeRef.current;
    if (!store) return;
    if (profile.authState === "login_required" && profile.seatState === "bench") return;
    await store.save(cloneProviderProfile(profile, {
      authState: "login_required",
      seatState: "bench",
    }));
    setBridgeResults((current) => {
      const next = { ...current };
      delete next[profile.profileId];
      return next;
    });
    await refresh();
  }, [refresh]);

  const saveTeachSelection = useCallback(async (profile: ProviderProfile) => {
    const recipeStore = recipeStoreRef.current;
    if (!recipeStore) return;
    const selection = await readProviderTeachSelection(profile);
    if (!selection) return;
    const current = await recipeStore.get(profile.profileId);
    const next = applyTeachSelection(current, profile.profileId, selection);
    await recipeStore.save(next);
    await refreshRecipes();
    setSpeechResults((currentResults) => {
      const nextResults = { ...currentResults };
      delete nextResults[profile.profileId];
      return nextResults;
    });
    await invalidateGate(profile);
    setTeaching(null);
  }, [invalidateGate, refreshRecipes]);

  useEffect(() => {
    let cancelled = false;
    let unlisten: (() => void) | undefined;
    void (async () => {
      try {
        const [profileStore, recipeStore] = await Promise.all([
          createProviderProfileStore(),
          createAdapterRecipeStore(),
        ]);
        if (cancelled) return;
        storeRef.current = profileStore;
        recipeStoreRef.current = recipeStore;
        setBackend(profileStore.backend);
        const normalized = await normalizeRuntimeProfiles(profileStore, await profileStore.list());
        if (cancelled) return;
        setProfileState(normalized);
        const recipeList = await recipeStore.list();
        setRecipes(Object.fromEntries(recipeList.map((recipe) => [recipe.profileId, recipe])));

        if (canOpenLogin) {
          unlisten = await listen<TeachEventPayload>("provider-teach-selected", (event) => {
            const profile = profilesRef.current.find((item) => item.profileId === event.payload.profileId);
            if (!profile) return;
            void saveTeachSelection(profile).catch((caught) => {
              setLoginError(caught instanceof Error ? caught.message : String(caught));
              setTeaching(null);
            });
          });
        }
      } catch (caught) {
        if (!cancelled) setError(caught instanceof Error ? caught.message : String(caught));
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => { cancelled = true; unlisten?.(); };
  }, [canOpenLogin, normalizeRuntimeProfiles, saveTeachSelection, setProfileState]);

  const invite = useCallback(async (url: string, displayName?: string) => {
    const store = storeRef.current;
    if (!store) throw new Error("Provider profile store is not ready yet.");
    const profile = createProviderProfile(displayName === undefined ? { url } : { url, displayName });
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
      setLoginError(caught instanceof Error ? caught.message : String(caught));
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
      setLoginError(caught instanceof Error ? caught.message : String(caught));
      throw caught;
    } finally {
      setProbingProfileId(null);
    }
  }, []);

  const teach = useCallback(async (profile: ProviderProfile, role: TeachRole) => {
    setLoginError(null);
    if (teaching) throw new Error("Finish or cancel the current Teach Mode selection first.");
    setTeaching({ profileId: profile.profileId, role });
    try {
      await startProviderTeach(profile, role);
    } catch (caught) {
      setTeaching(null);
      setLoginError(caught instanceof Error ? caught.message : String(caught));
      throw caught;
    }
  }, [teaching]);

  const cancelTeach = useCallback(async (profile: ProviderProfile) => {
    try { await cancelProviderTeach(profile); }
    finally { setTeaching(null); }
  }, []);

  const testSpeech = useCallback(async (profile: ProviderProfile, message: string) => {
    const recipe = recipes[profile.profileId];
    if (!recipe || !adapterRecipeComplete(recipe)) {
      throw new Error("Teach all three Adapter Recipe selectors before Test Speech.");
    }
    if (testingProfileId || verifyingProfileId) {
      throw new Error("Another advisor is already using the Provider execution channel.");
    }

    setLoginError(null);
    setTestingProfileId(profile.profileId);
    setSpeechResults((current) => {
      const next = { ...current };
      delete next[profile.profileId];
      return next;
    });
    setBridgeResults((current) => {
      const next = { ...current };
      delete next[profile.profileId];
      return next;
    });
    await invalidateGate(profile);

    try {
      const result = await testProviderSpeech(profile, recipe, message);
      setSpeechResults((current) => ({ ...current, [profile.profileId]: result }));
      return result;
    } catch (caught) {
      setLoginError(caught instanceof Error ? caught.message : String(caught));
      throw caught;
    } finally {
      setTestingProfileId(null);
    }
  }, [invalidateGate, recipes, testingProfileId, verifyingProfileId]);

  const verifyCouncil = useCallback(async (profile: ProviderProfile) => {
    const store = storeRef.current;
    const recipe = recipes[profile.profileId];
    if (!store || !recipe || !adapterRecipeComplete(recipe)) {
      throw new Error("Council Gate requires a complete 3/3 Adapter Recipe.");
    }
    if (!speechResults[profile.profileId]?.ok) {
      throw new Error("Pass Test Speech before opening Council Gate.");
    }
    if (!loginWindowProfileIds.includes(profile.profileId)) {
      throw new Error("Open the Provider login window before Council Gate.");
    }
    if (testingProfileId || verifyingProfileId) {
      throw new Error("Another advisor is already using the Provider execution channel.");
    }

    setLoginError(null);
    setVerifyingProfileId(profile.profileId);
    setBridgeResults((current) => {
      const next = { ...current };
      delete next[profile.profileId];
      return next;
    });

    try {
      const result = await verifyProviderCouncilBridge(profile, recipe);
      const ready = cloneProviderProfile(profile, {
        authState: "ready",
        seatState: "bench",
      });
      await store.save(ready);
      setBridgeResults((current) => ({ ...current, [profile.profileId]: result }));
      await refresh();
      return result;
    } catch (caught) {
      const failed = cloneProviderProfile(profile, {
        authState: "login_required",
        seatState: "bench",
      });
      await store.save(failed);
      await refresh();
      setLoginError(caught instanceof Error ? caught.message : String(caught));
      throw caught;
    } finally {
      setVerifyingProfileId(null);
    }
  }, [loginWindowProfileIds, recipes, refresh, speechResults, testingProfileId, verifyingProfileId]);

  const toggleSeat = useCallback(async (profile: ProviderProfile) => {
    const store = storeRef.current;
    if (!store) return;
    const takingSeat = profile.seatState !== "seated";
    if (takingSeat) {
      if (profile.authState !== "ready") {
        throw new Error("This advisor must pass Council Gate before taking a seat.");
      }
      if (!loginWindowProfileIds.includes(profile.profileId)) {
        throw new Error("Keep the Provider window open while the advisor is seated.");
      }
      const seatedCount = profilesRef.current.filter((item) => item.seatState === "seated").length;
      if (seatedCount >= MAX_LIVE_ADVISORS) {
        throw new Error(`v0.9 supports at most ${MAX_LIVE_ADVISORS} live web advisors per Council.`);
      }
    }
    await store.save(cloneProviderProfile(profile, {
      seatState: takingSeat ? "seated" : "bench",
    }));
    await refresh();
  }, [loginWindowProfileIds, refresh]);

  const remove = useCallback(async (profileId: string) => {
    const store = storeRef.current;
    if (!store) return;
    try { await closeProviderLoginWindow(profileId); } catch { /* already closed */ }
    await store.remove(profileId);
    await recipeStoreRef.current?.remove(profileId);
    setLoginWindowProfileIds((current) => current.filter((id) => id !== profileId));
    setProbeResults((current) => { const next = { ...current }; delete next[profileId]; return next; });
    setRecipes((current) => { const next = { ...current }; delete next[profileId]; return next; });
    setSpeechResults((current) => { const next = { ...current }; delete next[profileId]; return next; });
    setBridgeResults((current) => { const next = { ...current }; delete next[profileId]; return next; });
    await refresh();
  }, [refresh]);

  const seatedAgents = useMemo(() => profiles.flatMap((profile) => {
    const recipe = recipes[profile.profileId];
    if (
      profile.authState !== "ready" ||
      profile.seatState !== "seated" ||
      !recipe ||
      !adapterRecipeComplete(recipe)
    ) {
      return [];
    }
    return [createBrowserCouncilAgent(profile, recipe)];
  }), [profiles, recipes]);

  return {
    profiles,
    recipes,
    backend,
    error,
    loginError,
    loginWindowProfileIds,
    probeResults,
    probingProfileId,
    teaching,
    speechResults,
    testingProfileId,
    bridgeResults,
    verifyingProfileId,
    seatedAgents,
    liveSeatCount: seatedAgents.length,
    isLoading,
    canOpenLogin,
    invite,
    openLogin,
    probe,
    teach,
    cancelTeach,
    testSpeech,
    verifyCouncil,
    toggleSeat,
    remove,
    refresh,
    adapterRecipeComplete,
  };
}
