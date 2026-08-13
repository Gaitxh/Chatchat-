import {
  buildAdapterSpeechRequest,
  validateAdapterSpeechInput,
} from "../src/provider-sdk/speech-request.js";
import type { AdapterRecipe } from "../src/provider-sdk/recipe.js";
import type { ProviderProfile } from "../src/provider-sdk/types.js";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
}

const recipe: AdapterRecipe = {
  profileId: "provider-1",
  composerSelector: "#composer",
  sendSelector: "button[data-testid=send]",
  responseSelector: "[data-message-author-role=assistant]",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};
const profile: ProviderProfile = {
  profileId: "provider-1",
  providerId: "example",
  adapterId: "web.example",
  displayName: "Example",
  url: "https://example.com/chat",
  origin: "https://example.com",
  profileKey: "profile-1",
  authState: "login_required",
  seatState: "bench",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

validateAdapterSpeechInput(recipe, "hello");
const request = buildAdapterSpeechRequest(profile, recipe, "  hello  ");
assert(request.message === "hello", "Test Speech should trim the explicit test message.");
assert(request.responseSelector === recipe.responseSelector, "The taught response selector must be preserved.");

let rejectedIncomplete = false;
try { validateAdapterSpeechInput({ ...recipe, sendSelector: null }, "hello"); } catch { rejectedIncomplete = true; }
assert(rejectedIncomplete, "Incomplete recipes must not run Test Speech.");

let rejectedBlank = false;
try { validateAdapterSpeechInput(recipe, "   "); } catch { rejectedBlank = true; }
assert(rejectedBlank, "Blank Test Speech messages must be rejected.");

let rejectedLong = false;
try { validateAdapterSpeechInput(recipe, "x".repeat(4001)); } catch { rejectedLong = true; }
assert(rejectedLong, "Overlong Test Speech messages must be rejected.");

console.log("✓ ChatChat Test Speech request tests passed");
