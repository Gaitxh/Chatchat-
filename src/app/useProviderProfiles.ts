import { listen } from "@tauri-apps/api/event";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  adapterRecipeComplete,
  applyTeachSelection,
  cancelProviderTeach,
  closeProviderLoginWindow,
  createAdapterRecipeStore,
  createProviderProfile,
  createProviderProfileStore,
  openProviderLoginWindow,
  probeProviderPage,
  providerLoginRuntimeAvailable,
  readProviderTeachSelection,
  startProviderTeach,
  testProviderSpeech,
  type AdapterRecipe,
  type AdapterRecipeStore,
  type AdapterSpeechResult,
  type ProviderPageProbe,
  type ProviderProfile,
  type ProviderProfileBackend,
  type ProviderProfileStore,
  type TeachRole,
} from "../provider-sdk/index.js";

interface TeachEventPayload { profileId: string; }

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
  const [isLoading, setIsLoading] = useState(true);
  const canOpenLogin = providerLoginRuntimeAvailable();

  const setProfileState = useCallback((next: ProviderProfile[]) => {
    profilesRef.current = next;
    setProfiles(next);
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
    setTeaching(null);
  }, [refreshRecipes]);

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
        setProfileState(await profileStore.list());
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
  }, [canOpenLogin, saveTeachSelection, setProfileState]);

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
      setLoginWindowProfileIds((current) => current.includes(profile.profileId) ? current : [...current, profile.profileId]);
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
    } finally { setProbingProfileId(null); }
  }, []);

  const teach = useCallback(async (profile: ProviderProfile, role: TeachRole) => {
    setLoginError(null);
    if (teaching) throw new Error("Finish or cancel the current Teach Mode selection first.");
    setTeaching({ profileId: profile.profileId, role });
    try { await startProviderTeach(profile, role); }
    catch (caught) { setTeaching(null); setLoginError(caught instanceof Error ? caught.message : String(caught)); throw caught; }
  }, [teaching]);

  const cancelTeach = useCallback(async (profile: ProviderProfile) => {
    try { await cancelProviderTeach(profile); } finally { setTeaching(null); }
  }, []);

  const testSpeech = useCallback(async (profile: ProviderProfile, message: string) => {
    const recipe = recipes[profile.profileId];
    if (!recipe || !adapterRecipeComplete(recipe)) {
      throw new Error("Teach all three Adapter Recipe selectors before Test Speech.");
    }
    if (testingProfileId) throw new Error("Another advisor is already performing a Test Speech.");

    setLoginError(null);
    setTestingProfileId(profile.profileId);
    setSpeechResults((current) => {
      const next = { ...current };
      delete next[profile.profileId];
      return next;
    });

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
  }, [recipes, testingProfileId]);

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
    await refresh();
  }, [refresh]);

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
    isLoading,
    canOpenLogin,
    invite,
    openLogin,
    probe,
    teach,
    cancelTeach,
    testSpeech,
    remove,
    refresh,
    adapterRecipeComplete,
  };
}
