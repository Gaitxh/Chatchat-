export const MODES = [
  ['balanced', '均衡讨论', '兼顾观点、证据与可行性'],
  ['explore', '探索可能', '拓展思路，发现遗漏的选项'],
  ['decide', '辅助决策', '比较选项、代价与约束'],
  ['verify', '核查论据', '检查主张、来源与不确定性'],
  ['stress_test', '压力测试', '寻找反例、风险与失效条件'],
];

export const SEAT_STATUS = {
  opening: ['正在打开', 'waiting'], needs_login: ['需要登录', 'warning'],
  ready: ['已就绪', 'ready'], attention: ['需要处理', 'warning'],
  closed: ['窗口已关闭', 'muted'], error: ['连接出错', 'error'],
};
export const MEETING_STATUS = {
  preparing: '正在准备', running: '讨论进行中', completed: '讨论已结束',
  cancelled: '已停止 · 保留已有记录', failed: '讨论未完成',
};
export const PHASES = { sealed: '独立思考', debate: '交流与质疑', final: '最终立场' };
export const EVENT_KINDS = {
  argument: '提出观点', challenge: '提出质疑', evidence: '补充证据', support: '支持',
  defense: '回应质疑', revision: '修正观点', concede: '接受修正', question: '追问',
  uncertain: '保留判断', final_position: '最终立场',
};

export function emptyState() {
  return {
    version: '0.10.2', runtime: { available: false, label: '桌面连接', message: '正在连接桌面应用…' },
    providers: [], seats: [], meeting: null, history: [], busy: false, synthesisAvailable: false,
  };
}

export function isState(value) {
  return Boolean(value && typeof value === 'object' && value.runtime &&
    typeof value.runtime.available === 'boolean' && Array.isArray(value.providers) &&
    Array.isArray(value.seats) && Array.isArray(value.history) &&
    (value.meeting === null || (value.meeting && typeof value.meeting.id === 'string')) &&
    typeof value.busy === 'boolean');
}

export function isRunning(state) {
  return ['preparing', 'running'].includes(state.meeting?.status) || ['drafting', 'reviewing'].includes(state.meeting?.synthesis?.status);
}

export function startBlocker(state, { connected = true, pending = false, proposal = '' } = {}) {
  if (!connected) return '桌面连接不可用，无法开始。请从已安装的 ChatChat 桌面应用打开。';
  if (!state.runtime.available) return state.runtime.message || '托管浏览器不可用，暂时无法开始。';
  if (isRunning(state)) return '讨论正在进行，可以随时停止并保留已有记录。';
  if (pending || state.busy) return '正在处理操作，请稍候。';
  const count = state.seats.filter((seat) => seat.status === 'ready').length;
  if (count < 2) return `还需 ${2 - count} 个就绪席位：添加 AI，在独立窗口登录后点击「检查」。`;
  if (state.seats.length > 8) return '一场讨论最多 8 个席位，请先移除多余席位。';
  if (!proposal.trim()) return '写下一个明确问题，再开始讨论。';
  if (proposal.trim().length > 8_000) return '提案过长，请缩短至 8,000 字以内。';
  return '';
}

// Site adapters remain experimental. Translate known runtime states into
// actionable help, without changing the machine-readable error codes or
// inventing a successful provider connection.
export function seatDisplayDetail(seat) {
  const detail = typeof seat?.detail === 'string' ? seat.detail.trim() : '';
  if (!detail) return seat?.status === 'ready'
    ? '页面已连接。正式发送前还会校验会话和输入控件。'
    : '点击「登录 / 打开」进入网站，然后点击「检查」。';
  const cases = [
    [/No reviewed automatic chat recipe|This site requires manual use/i,
      '此网站暂未通过自动协商适配验证。你仍可打开网站使用，会议可由其他已就绪席位开始。'],
    [/Sign in manually|Sign in in the managed browser/i,
      '请在应用打开的独立浏览器中自行登录，返回模型聊天页面后点击「检查」。'],
    [/page left its pinned provider origin/i,
      '网站已跳转至其他域名。请检查登录流程，回到原模型网站后重新检查。'],
    [/The page contains an existing or unexpected conversation/i,
      '检测到旧聊天或不符合预期的对话。需要为本场会议创建新的空白 Chat。'],
    [/The composer contains an unsent draft/i,
      '网页输入框中有未发送的草稿。请先自行处理草稿，再检查席位。'],
    [/The page is already generating a response/i,
      '该模型网页仍在生成回答。等它完成后再检查。'],
    [/A safe chat composer and send control could not be identified|multiple possible chat controls/i,
      '无法安全确认聊天输入框或发送按钮。网站界面可能已更新，本次暂停自动发送。'],
    [/A single assistant reply could not be identified|assistant reply exceeded/i,
      '无法可靠识别完整模型回答，本次不计作有效发言。请检查原网页。'],
    [/Submission may have reached the provider/i,
      '这条消息可能已经发出，系统不会自动重发。请先核对原网页，再决定是否开始新会议。'],
    [/Secure browser network tunnel could not start/i,
      '本机安全网络通道未能启动。请检查防火墙或安全软件，再重启 ChatChat。'],
    [/Bundled Chromium is unavailable|browser is incomplete or damaged/i,
      '内置浏览器文件不可用或可能损坏。请从可信来源重新安装 ChatChat。'],
    [/Browser work was cancelled|managed browser runtime is closed/i,
      '浏览器任务已停止。如需再次协商，请开始一场新会议。'],
    [/Browser operation timed out|browser operation failed/i,
      '模型网页响应超时或浏览器操作失败。请检查网站连接及登录状态。'],
    [/Empty chat controls detected/i,
      '已识别聊天输入框，但不代表已验证真实模型回复；正式发送前还会再次检查。'],
    [/Fresh chat prepared/i,
      '已为本轮建立独立空白聊天。自动网页适配仍属于实验性功能。'],
    [/Opening the separate managed browser/i,
      '正在打开此席位的独立浏览器窗口。'],
    [/Open this app-owned browser|Saved seat. Open/i,
      '点击「登录 / 打开」检查专用浏览器中的模型页面及账号状态。'],
    [/Managed browser closed|Chat page closed/i,
      '模型聊天窗口已关闭。需要时可以重新打开，不会复制个人浏览器数据。'],
  ];
  for (const [pattern, message] of cases) if (pattern.test(detail)) return message;
  return detail.slice(0, 600);
}

export function readableError(error) {
  const message = typeof error === 'string' ? error : error?.message;
  return (typeof message === 'string' && message.trim() ? message : '操作未完成，请重试。').slice(0, 1200);
}

export function reportView(report) {
  if (!report) return null;
  const positions = Array.isArray(report.positions) ? report.positions : [];
  const disagreements = Array.isArray(report.disagreements) ? report.disagreements : [];
  // Historical reports may retain a dissenting position only in disagreements.
  const all = [...positions];
  for (const dissent of disagreements) {
    if (!all.some((position) => position.participant?.id === dissent.participant?.id &&
      position.stance === dissent.stance && position.content === dissent.content)) all.push(dissent);
  }
  const failed = all.filter((position) => position.provenance?.source === 'runtime_fallback');
  const authored = all.filter((position) => position.provenance?.source !== 'runtime_fallback');
  const isDissent = (position) => disagreements.some((item) =>
    item.participant?.id === position.participant?.id && item.stance === position.stance);
  return {
    authored, failed, dissent: authored.filter(isDissent), isDissent,
    stance: typeof report.consensusStance === 'string' ? report.consensusStance : null,
    unanswered: Array.isArray(report.unansweredDirectRequestEventIds) ? report.unansweredDirectRequestEventIds.length : 0,
  };
}

export function actorName(state, id) {
  const report = reportView(state.meeting?.report);
  const position = report && [...report.authored, ...report.failed].find((item) => item.participant?.id === id);
  const knownName = position?.participant?.name || state.seats.find((seat) => seat.id === id)?.name;
  if (knownName) return knownName;
  const actors = [...new Set((state.meeting?.events || []).map((event) => event.actorId))];
  const index = actors.indexOf(id);
  return index < 0 ? '历史席位' : `历史席位 ${index + 1}`;
}

export function formatDate(value) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '时间未记录';
  return new Intl.DateTimeFormat('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(date);
}

export const BRIDGE_METHODS = [
  'getState', 'addSeat', 'openSeat', 'checkSeat', 'removeSeat', 'startMeeting', 'synthesizeMeeting',
  'stopMeeting', 'newMeeting', 'loadMeeting', 'exportMeeting', 'openDataFolder', 'onState',
];

// A state push is newer than a command's in-flight snapshot. Never paint an old
// response over it, including the initial getState response.
export function createSession({ bridge, onChange = () => {}, onError = () => {}, onNotice = () => {} }) {
  let state = emptyState();
  let connected = false;
  let epoch = 0;
  let disposed = false;
  let unsubscribe;
  const pending = new Set();
  const notify = () => { if (!disposed) onChange({ state, connected, pending: new Set(pending) }); };
  const accept = (next) => {
    if (!isState(next)) throw new Error('桌面应用返回了无法读取的状态，请重新打开应用。');
    if (disposed) return;
    state = next;
    connected = true;
    epoch += 1;
    notify();
  };
  return {
    async connect() {
      if (!bridge || BRIDGE_METHODS.some((method) => typeof bridge[method] !== 'function')) {
        state.runtime.message = '桌面连接不可用。请从已安装的 ChatChat 桌面应用打开；此页面无法独立运行。';
        onError(state.runtime.message);
        notify();
        return false;
      }
      try {
        unsubscribe = bridge.onState((next) => {
          try { accept(next); } catch (error) { onError(readableError(error)); }
        });
        const before = epoch;
        const initial = await bridge.getState();
        if (before === epoch) accept(initial);
        return !disposed;
      } catch (error) {
        state.runtime.message = '连接桌面应用失败，请重新打开应用。';
        onError(readableError(error));
        notify();
        return false;
      }
    },
    async run(method, argument) {
      if (disposed) return false;
      if (!connected) { onError('桌面连接不可用，无法执行此操作。'); return false; }
      if (!BRIDGE_METHODS.includes(method) || ['getState', 'onState'].includes(method)) {
        onError('无法执行此操作。'); return false;
      }
      if (pending.has(method) || (pending.size > 0 && method !== 'stopMeeting')) return false;
      pending.add(method);
      notify();
      const before = epoch;
      try {
        const result = argument === undefined ? await bridge[method]() : await bridge[method](argument);
        if (disposed) return false;
        if (method === 'exportMeeting') {
          if (typeof result?.saved !== 'boolean') throw new Error('未能确认导出结果，请重试。');
          onNotice(result.saved ? '讨论记录已导出。' : '已取消导出。');
        } else if (method === 'openDataFolder') {
          if (result?.opened !== true) throw new Error('未能打开数据文件夹，请重试。');
          onNotice('已打开本机数据文件夹。');
        } else if (before === epoch) accept(result);
        return true;
      } catch (error) {
        if (!disposed) onError(readableError(error));
        return false;
      } finally {
        pending.delete(method);
        notify();
      }
    },
    dispose() { disposed = true; if (typeof unsubscribe === 'function') unsubscribe(); },
  };
}
