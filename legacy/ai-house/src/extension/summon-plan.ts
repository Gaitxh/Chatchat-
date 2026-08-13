import { MAX_DELEGATION_SEATS, MAX_HOUSE_SEATS } from "../house/delegations.js";
import { detectProviderUrl } from "../provider-sdk/catalog.js";

export interface SummonBrowserTab {
  id?: number;
  url?: string;
  title?: string;
}

export interface SummonExistingSeat {
  tabId: number;
  origin: string;
  providerId: string;
}

export interface SummonCandidate {
  tabId: number;
  url: string;
  origin: string;
  hostname: string;
  providerId: string;
  providerName: string;
  delegationId: string;
  delegationName: string;
  startUrl: string;
}

export interface SummonPlan {
  candidates: SummonCandidate[];
  ignoredUnknownTabs: number;
  ignoredDuplicateTabs: number;
  ignoredDelegationLimit: number;
  ignoredHouseLimit: number;
}

/**
 * Build a deterministic, conservative bulk-summon plan.
 *
 * Only catalog-recognized AI pages are eligible for automatic summoning.
 * Unknown/custom pages remain an explicit per-tab action in the Side Panel.
 * This function never grants permissions, injects scripts or marks a seat ready.
 */
export function planOpenAiTabsForHouse(
  tabs: readonly SummonBrowserTab[],
  existingSeats: readonly SummonExistingSeat[],
): SummonPlan {
  const existingTabIds = new Set(existingSeats.map((seat) => seat.tabId));
  const delegationCounts = new Map<string, number>();
  for (const seat of existingSeats) {
    const key = `${seat.providerId}@${seat.origin}`;
    delegationCounts.set(key, (delegationCounts.get(key) ?? 0) + 1);
  }

  const plan: SummonPlan = {
    candidates: [],
    ignoredUnknownTabs: 0,
    ignoredDuplicateTabs: 0,
    ignoredDelegationLimit: 0,
    ignoredHouseLimit: 0,
  };

  const stableTabs = [...tabs].sort((a, b) => (a.id ?? Number.MAX_SAFE_INTEGER) - (b.id ?? Number.MAX_SAFE_INTEGER));

  for (const tab of stableTabs) {
    if (!tab.id || !tab.url || !/^https?:/i.test(tab.url)) continue;
    if (existingTabIds.has(tab.id)) {
      plan.ignoredDuplicateTabs += 1;
      continue;
    }

    let detection;
    try {
      detection = detectProviderUrl(tab.url);
    } catch {
      continue;
    }
    if (detection.kind !== "known" || !detection.manifest) {
      plan.ignoredUnknownTabs += 1;
      continue;
    }

    if (existingSeats.length + plan.candidates.length >= MAX_HOUSE_SEATS) {
      plan.ignoredHouseLimit += 1;
      continue;
    }

    const delegationId = `${detection.providerId}@${detection.origin}`;
    const count = delegationCounts.get(delegationId) ?? 0;
    if (count >= MAX_DELEGATION_SEATS) {
      plan.ignoredDelegationLimit += 1;
      continue;
    }

    plan.candidates.push({
      tabId: tab.id,
      url: detection.normalizedUrl,
      origin: detection.origin,
      hostname: detection.hostname,
      providerId: detection.providerId,
      providerName: detection.displayName,
      delegationId,
      delegationName: `${detection.displayName} Delegation`,
      startUrl: detection.manifest.defaultUrl,
    });
    delegationCounts.set(delegationId, count + 1);
  }

  return plan;
}

export function summarizeSummonPlan(plan: SummonPlan): string {
  if (!plan.candidates.length) return "没有发现新的、可自动召集的已知 AI 标签页。";
  const delegations = new Map<string, number>();
  for (const candidate of plan.candidates) {
    delegations.set(candidate.providerName, (delegations.get(candidate.providerName) ?? 0) + 1);
  }
  return [...delegations.entries()]
    .map(([name, count]) => `${name} ×${count}`)
    .join(" · ");
}
