import type { Locale } from "../../i18n/index.js";
import type {
  ProviderPublicPayloadIntegrityModel,
  ProviderPublicPayloadRound,
} from "../../theater/provider-memory-payload-integrity.js";
import "./provider-memory-payload-integrity.css";

interface ProviderMemoryPayloadIntegrityProps {
  model: ProviderPublicPayloadIntegrityModel;
  locale: Locale;
  archive?: boolean;
}

export function ProviderMemoryPayloadIntegrity({ model, locale, archive = false }: ProviderMemoryPayloadIntegrityProps) {
  const zh = locale === "zh-CN";
  if (!model.turns.length) return null;
  const visibleRounds = model.rounds.slice(-5).reverse();
  return (
    <section
      className={`provider-memory-payload state-${model.state}`}
      data-provider-payload-integrity={model.state}
      data-provider-payload-session={model.sessionId ?? ""}
      data-provider-payload-view={archive ? "archive" : "live"}
      data-provider-payload-fingerprinted-turns={model.fingerprintedTurnCount}
      data-provider-payload-total-turns={model.auditedTurnCount}
      data-provider-payload-unverified-turns={model.unverifiedTurnCount}
      data-provider-payload-peer-drift-rounds={model.peerPayloadDriftRoundCount}
      data-provider-payload-repair-used={model.repairUsedTurnCount}
      data-provider-payload-repair-drift={model.repairDeckDriftTurnCount}
      data-provider-payload-repair-payload-drift={model.repairPayloadDriftTurnCount}
      data-provider-payload-repair-selection-drift={model.repairSelectionDriftTurnCount}
    >
      <header>
        <div>
          <span>PUBLIC PAYLOAD INTEGRITY</span>
          <strong>{title(model, zh)}</strong>
          <p>{body(model, zh)}</p>
        </div>
        <div className="provider-memory-payload__stats">
          <b>{model.fingerprintedTurnCount}/{model.auditedTurnCount}<small>{zh ? "完整精确 payload 票据" : "complete payload receipts"}</small></b>
          <b className={model.peerPayloadDriftRoundCount ? "is-bad" : model.unverifiedTurnCount ? "" : "is-ok"}>{model.peerPayloadDriftRoundCount ? `!${model.peerPayloadDriftRoundCount}` : model.unverifiedTurnCount ? `?${model.unverifiedTurnCount}` : "✓"}<small>{zh ? "同轮 payload 对账" : "peer payload parity"}</small></b>
          <b className={model.repairDeckDriftTurnCount ? "is-bad" : "is-ok"}>{model.repairUsedTurnCount ? `${model.repairUsedTurnCount}` : "—"}<small>{zh ? "repair 上下文" : "repair contexts"}</small></b>
        </div>
      </header>
      <div className="provider-memory-payload__rounds">
        {visibleRounds.map((round) => <PayloadRound key={round.key} round={round} zh={zh} />)}
      </div>
      <footer>{zh
        ? "eq64 是对真正进入 RUN_SPEECH 的 CONSULTATION_EVENTS_JSON 原始 UTF-8 序列化文本计算的 64-bit 非密码学相等性辅助值；它不是签名、真实性证明、防篡改凭证、证据质量分或答案正确率。Repair 还必须保留相同 snapshot / pinned / pin-source / latest provenance。缺少 Prompt payload 票据的真实 Provider turn 仍留在分母里，绝不会靠消失变成 verified。"
        : "eq64 is a 64-bit non-cryptographic equality aid computed over the raw UTF-8 serialized CONSULTATION_EVENTS_JSON text that actually entered RUN_SPEECH. It is not a signature, authenticity proof, tamper-proof receipt, evidence-quality score, or answer-correctness signal. Repair must also preserve the same snapshot / pinned / pin-source / latest provenance. A real Provider turn missing Prompt-payload evidence remains in the denominator; it never disappears to manufacture verification."}</footer>
    </section>
  );
}

function PayloadRound({ round, zh }: { round: ProviderPublicPayloadRound; zh: boolean }) {
  const parity = round.payloadsConsistent === null
    ? (zh ? `? ${round.unverifiedSeatCount} 席票据不完整` : `? ${round.unverifiedSeatCount} SEAT(S) UNVERIFIED`)
    : round.payloadsConsistent
      ? (zh ? "✓ 精确公共 payload 一致" : "✓ EXACT PUBLIC PAYLOAD MATCH")
      : (zh ? "! 精确公共 payload 漂移" : "! EXACT PUBLIC PAYLOAD DRIFT");
  const repair = repairLabel(round, zh);
  return (
    <article
      className={`provider-memory-payload__round ${round.payloadsConsistent === false || round.repairDriftSeatCount ? "is-bad" : ""}`}
      data-provider-payload-round={round.round}
      data-provider-payload-phase={round.phase}
      data-provider-payload-seat-count={round.seatCount}
      data-provider-payload-fingerprinted-seats={round.fingerprintedSeatCount}
      data-provider-payload-unverified-seats={round.unverifiedSeatCount}
      data-provider-payload-consistent={round.payloadsConsistent === null ? "unknown" : round.payloadsConsistent ? "true" : "false"}
      data-provider-payload-fingerprint-count={round.uniquePayloadFingerprints.length}
      data-provider-payload-receipt-count={round.uniquePayloadReceipts.length}
      data-provider-repair-used-seats={round.repairUsedSeatCount}
      data-provider-repair-matched-seats={round.repairMatchedSeatCount}
      data-provider-repair-drift-seats={round.repairDriftSeatCount}
      data-provider-repair-payload-drift-seats={round.repairPayloadDriftSeatCount}
      data-provider-repair-selection-drift-seats={round.repairSelectionDriftSeatCount}
      data-provider-repair-unverified-seats={round.repairUnverifiedSeatCount}
    >
      <strong>{round.phase.toUpperCase()} · R{round.round}</strong>
      <span>{round.fingerprintedSeatCount}/{round.seatCount} {zh ? "席位有完整 payload 票据" : "complete payload receipts"}</span>
      <em>{parity}</em>
      <small>{repair}</small>
    </article>
  );
}

function repairLabel(round: ProviderPublicPayloadRound, zh: boolean): string {
  if (round.repairUsedSeatCount === 0) return zh ? "未使用 repair" : "no repair used";
  if (round.repairUnverifiedSeatCount > 0) {
    return `${round.repairUnverifiedSeatCount} ${zh ? "个 repair 票据不完整" : "repair context unverified"}`;
  }
  if (round.repairDriftSeatCount > 0) {
    const parts: string[] = [];
    if (round.repairPayloadDriftSeatCount) {
      parts.push(`${round.repairPayloadDriftSeatCount} ${zh ? "序列化 payload 漂移" : "serialized payload drift"}`);
    }
    if (round.repairSelectionDriftSeatCount) {
      parts.push(`${round.repairSelectionDriftSeatCount} ${zh ? "selection provenance 漂移" : "selection provenance drift"}`);
    }
    return parts.join(" · ") || (zh ? "repair 上下文漂移" : "repair context drift");
  }
  return `${round.repairMatchedSeatCount}/${round.repairUsedSeatCount} ${zh ? "repair 上下文完全一致" : "repair contexts fully matched"}`;
}

function title(model: ProviderPublicPayloadIntegrityModel, zh: boolean): string {
  if (model.state === "verified") return zh ? "相同 public event IDs，也对应相同的精确序列化公共内容" : "Same public event IDs also carry the same exact serialized public content";
  if (model.state === "peer_payload_drift") return zh ? "同轮平等 Provider 收到了不同的精确序列化公共内容" : "Equal Providers received different exact serialized public content in the same round";
  if (model.state === "repair_deck_drift") return zh ? "Repair 改变了本轮公共会议上下文" : "A repair attempt changed the public meeting context";
  if (model.state === "payload_unverified") return zh ? "至少一个真实 Provider turn 缺少完整 payload 相等性票据" : "At least one real Provider turn lacks a complete payload-equality receipt";
  return zh ? "尚无可审计 public payload" : "No auditable public payload yet";
}

function body(model: ProviderPublicPayloadIntegrityModel, zh: boolean): string {
  if (model.state === "verified") {
    const repair = model.repairUsedTurnCount
      ? ` · ${model.repairUsedTurnCount} ${zh ? "次 repair 的 serialized payload 与 selection provenance 都保持不变" : "repair turn(s) preserved both serialized payload and selection provenance"}`
      : ` · ${zh ? "本场未使用 repair" : "no repair was used"}`;
    return `${model.fingerprintedTurnCount}/${model.auditedTurnCount} ${zh ? "轮从实际 RUN_SPEECH 提取了完整公共 payload receipt，同轮未发现内容漂移" : "turns have complete public-payload receipts from actual RUN_SPEECH; no same-round content drift was found"}${repair}.`;
  }
  if (model.state === "peer_payload_drift") return zh ? `${model.peerPayloadDriftRoundCount} 轮出现同 IDs/同轮条件下的精确序列化公共 payload 不一致。` : `${model.peerPayloadDriftRoundCount} round(s) contain exact serialized public-payload disagreement among equal peers.`;
  if (model.state === "repair_deck_drift") {
    const causes = [
      model.repairPayloadDriftTurnCount ? `${model.repairPayloadDriftTurnCount} ${zh ? "轮 payload 漂移" : "payload drift"}` : "",
      model.repairSelectionDriftTurnCount ? `${model.repairSelectionDriftTurnCount} ${zh ? "轮 selection provenance 漂移" : "selection provenance drift"}` : "",
    ].filter(Boolean).join(" · ");
    return zh
      ? `${model.repairDeckDriftTurnCount} 个 repair attempt 改变了公共会议上下文${causes ? `（${causes}）` : ""}。Repair 只能修输出格式，不能换会议记忆。`
      : `${model.repairDeckDriftTurnCount} repair attempt(s) changed public meeting context${causes ? ` (${causes})` : ""}. Repair may correct output format, not meeting memory.`;
  }
  if (model.state === "payload_unverified") {
    return zh
      ? `${model.unverifiedTurnCount} / ${model.auditedTurnCount} 个真实 Provider turn 没有完整现代 payload receipt。它们仍然计入分母；未知就是未知，不事后升级。`
      : `${model.unverifiedTurnCount} / ${model.auditedTurnCount} real Provider turn(s) lack complete modern payload receipts. They remain in the denominator; unknown stays unknown and is never upgraded after the fact.`;
  }
  return zh ? "还没有可归属到正式 sealed / debate / final turn 的 Provider transport。" : "No Provider transport can yet be attributed to a formal sealed / debate / final turn.";
}
