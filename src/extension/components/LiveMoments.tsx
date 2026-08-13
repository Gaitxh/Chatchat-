import type { CouncilEvent } from "../../core/types.js";
import type { Locale } from "../../i18n/index.js";
import { LiveMoments as LiveMomentsBase } from "./LiveMomentsBase.js";
import { RelationshipMap } from "./RelationshipMap.js";

export function LiveMoments({
  participants,
  events,
  locale,
}: {
  participants: readonly { id: string; name: string }[];
  events: readonly CouncilEvent[];
  locale: Locale;
}) {
  return (
    <>
      <LiveMomentsBase participants={participants} events={events} locale={locale} />
      <RelationshipMap participants={participants} events={events} locale={locale} />
    </>
  );
}
