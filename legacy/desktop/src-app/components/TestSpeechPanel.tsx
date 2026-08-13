import { useState } from "react";
import {
  DEFAULT_TEST_SPEECH,
  type AdapterRecipe,
  type AdapterSpeechResult,
  type ProviderProfile,
} from "../../provider-sdk/index.js";
import "../speech.css";

interface TestSpeechPanelProps {
  profile: ProviderProfile;
  recipe: AdapterRecipe;
  result: AdapterSpeechResult | undefined;
  testing: boolean;
  disabled: boolean;
  onRun(profile: ProviderProfile, message: string): Promise<AdapterSpeechResult>;
}

export function TestSpeechPanel({
  profile,
  recipe,
  result,
  testing,
  disabled,
  onRun,
}: TestSpeechPanelProps) {
  const [message, setMessage] = useState(DEFAULT_TEST_SPEECH);

  return (
    <div className="speech-console">
      <div className="speech-console__header">
        <div>
          <strong>🎻 试奏 · Test Speech</strong>
          <span>显式发送一条测试消息，并且只读取你教过的 Response 区域。</span>
        </div>
        {result?.ok ? <span className="speech-pass">TEST PASSED</span> : null}
      </div>

      <div className="speech-console__row">
        <textarea
          rows={2}
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          disabled={disabled || testing}
          aria-label={`Test speech for ${profile.displayName}`}
        />
        <button
          type="button"
          className="speech-run"
          disabled={disabled || testing || message.trim().length === 0}
          onClick={() => void onRun(profile, message)}
        >
          {testing ? "试奏中…" : "▶ 试奏"}
        </button>
      </div>

      <div className="speech-scope">
        <span>将写入</span><code>{recipe.composerSelector}</code>
        <span>→ 点击</span><code>{recipe.sendSelector}</code>
        <span>→ 只观察</span><code>{recipe.responseSelector}</code>
      </div>

      {testing ? (
        <div className="speech-waiting">
          正在等待 taught response 发生变化，并连续稳定约 3 秒；最长等待 120 秒。
        </div>
      ) : null}

      {result ? (
        <div className="speech-result">
          <div className="speech-result__meta">
            <strong>真实网页回复</strong>
            <span>{(result.elapsedMs / 1000).toFixed(1)}s · {result.responseCount} response matches · stable {result.stablePolls} polls{result.truncated ? " · truncated" : ""}</span>
          </div>
          <pre>{result.responseText}</pre>
          <small>
            TEST PASSED 只证明当前 Recipe 能完成一次页面往返；它还不是 READY，也还没有进入 Council。
          </small>
        </div>
      ) : null}
    </div>
  );
}
