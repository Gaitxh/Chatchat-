import { canJoinConsultation, type ConsultationParticipantIdentity } from "../consultation/equality.js";
import { detectProviderUrl } from "../provider-sdk/catalog.js";
import { automaticTeamLaunchUrl } from "./automatic-team.js";

type Detection = ReturnType<typeof detectProviderUrl>;

export class FreshSeatError extends Error {
  constructor(readonly code: "invalid-url" | "custom-confirmation-required" | "unexpected-destination"
    | "duplicate-origin" | "capacity" | "tab-create-failed" | "cleanup-failed") {
    super(code);
  }
}

export interface FreshSeatPlan {
  readonly source: Detection;
  readonly destination: Detection;
  readonly startUrl: string;
  readonly permissionOrigins: readonly string[];
  readonly sourceTabId?: number;
}

export interface FreshSeatParticipant extends ConsultationParticipantIdentity {
  seatId: string;
  url: string;
  hostname: string;
  startUrl: string;
  createdByChatChat: boolean;
}

function validatedDetection(input: string): Detection {
  try {
    const detection = detectProviderUrl(input);
    const url = new URL(detection.normalizedUrl);
    if (url.username || url.password) throw new Error("Credentials are not a seat URL.");
    // Custom sites may use hash routes for their explicitly confirmed new-chat entry.
    const fragment = input.trim().indexOf("#");
    if (detection.kind === "custom" && fragment >= 0) url.hash = input.trim().slice(fragment);
    return { ...detection, normalizedUrl: url.href };
  } catch {
    throw new FreshSeatError("invalid-url");
  }
}

/** Catalog recognition selects an entry URL; it does NOT prove a fresh provider session. */
export function planFreshSeat(input: string, options: {
  confirmedCustomUrl?: string | undefined;
  sourceTabId?: number | undefined;
} = {}): FreshSeatPlan {
  const source = validatedDetection(input);
  if (source.kind === "custom"
    && (!options.confirmedCustomUrl
      || validatedDetection(options.confirmedCustomUrl).normalizedUrl !== source.normalizedUrl)) {
    throw new FreshSeatError("custom-confirmation-required");
  }
  const catalogUrl = automaticTeamLaunchUrl(source);
  // The catalog's Claude root can reopen the last conversation; use its new-chat entry.
  const startUrl = source.providerId === "anthropic-claude"
    ? new URL("/new", catalogUrl).href
    : catalogUrl;
  const destination = validatedDetection(startUrl);
  if (source.kind !== destination.kind || source.providerId !== destination.providerId) {
    throw new FreshSeatError("unexpected-destination");
  }
  return {
    source,
    destination,
    startUrl: destination.normalizedUrl,
    permissionOrigins: [...new Set([source.origin, destination.origin])],
    ...(options.sourceTabId === undefined ? {} : { sourceTabId: options.sourceTabId }),
  };
}

export interface FreshSeatIO {
  readParticipants(): Promise<FreshSeatParticipant[]>;
  writeParticipants(participants: FreshSeatParticipant[]): Promise<void>;
  requestPermissions(origins: readonly string[]): Promise<void>;
  createTab(url: string): Promise<{ id?: number }>;
  waitForTab(tabId: number): Promise<void>;
  getTab(tabId: number): Promise<{ url?: string }>;
  removeTab(tabId: number): Promise<void>;
}

export async function waitForFreshSeatTab(
  tabId: number,
  getTab: (tabId: number) => Promise<{ status?: string }>,
  timeoutMs = 35_000,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if ((await getTab(tabId)).status === "complete") return;
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new FreshSeatError("tab-create-failed");
}

let mutations: Promise<unknown> = Promise.resolve();

/** Web Locks also serialize the panel and Full Room across extension documents. */
export function withFreshSeatLock<T>(operation: () => Promise<T>): Promise<T> {
  if (typeof navigator !== "undefined" && navigator.locks) {
    return navigator.locks.request("chatchat.fresh-seat.participants", operation);
  }
  const next = mutations.then(operation, operation);
  mutations = next.catch(() => undefined);
  return next;
}

function assertCanJoin(current: readonly FreshSeatParticipant[], candidate: FreshSeatParticipant) {
  const result = canJoinConsultation(current, candidate);
  if (!result.ok) throw new FreshSeatError(result.reason);
}

/** No browser operation ever targets the discovered/source tab. Only a committed new tab may connect. */
export async function createFreshSeat(plan: FreshSeatPlan, io: FreshSeatIO) {
  return withFreshSeatLock(async () => {
    const candidate: FreshSeatParticipant = {
      participantId: "pending",
      seatId: "pending",
      tabId: -1,
      providerId: plan.destination.providerId,
      providerName: plan.destination.displayName,
      origin: plan.destination.origin,
      hostname: plan.destination.hostname,
      url: plan.startUrl,
      startUrl: plan.startUrl,
      createdByChatChat: true,
    };
    assertCanJoin(await io.readParticipants(), candidate);
    await io.requestPermissions(plan.permissionOrigins);
    let createdTabId: number | undefined;
    try {
      const tab = await io.createTab(plan.startUrl);
      if (!tab.id || tab.id === plan.sourceTabId) throw new FreshSeatError("tab-create-failed");
      createdTabId = tab.id;
      await io.waitForTab(tab.id);
      const loaded = await io.getTab(tab.id);
      if (!loaded.url) throw new FreshSeatError("unexpected-destination");
      const actual = validatedDetection(loaded.url);
      // Redirects never gain injection authority from permissions on another origin.
      if (actual.origin !== plan.destination.origin || actual.providerId !== plan.destination.providerId) {
        throw new FreshSeatError("unexpected-destination");
      }
      const seatId = `extension:${actual.providerId}:${tab.id}`;
      const participant = { ...candidate, tabId: tab.id, seatId, participantId: seatId, url: actual.normalizedUrl };
      const current = await io.readParticipants();
      assertCanJoin(current, participant);
      const participants = [...current, participant];
      await io.writeParticipants(participants);
      return { participant, participants };
    } catch (error) {
      if (createdTabId !== undefined) {
        try { await io.removeTab(createdTabId); }
        catch { throw new FreshSeatError("cleanup-failed"); }
      }
      throw error;
    }
  });
}
