const definitions = [
  ['openai-chatgpt', 'ChatGPT', 'https://chatgpt.com/'],
  ['anthropic-claude', 'Claude', 'https://claude.ai/new'],
  ['deepseek-chat', 'DeepSeek', 'https://chat.deepseek.com/'],
  ['qwen-chat', 'Qwen', 'https://chat.qwen.ai/'],
  ['google-gemini', 'Gemini', 'https://gemini.google.com/app'],
  ['minimax-chat', 'MiniMax', 'https://chat.minimax.io/'],
  ['xiaomi-mimo', 'Xiaomi MiMo', 'https://mimo.xiaomi.com/'],
];

export const PROVIDERS = Object.freeze(definitions.map(([id, name, url]) =>
  Object.freeze({ id, name, url, automation: ['minimax-chat', 'xiaomi-mimo'].includes(id) ? 'manual' : 'experimental' })));

// These are intentionally narrow, experimental DOM recipes, not compatibility claims.
// A site with a changed/ambiguous layout is unavailable until its recipe is reviewed.
export const ADAPTERS = Object.freeze({
  'openai-chatgpt': {
    scope: 'main', composer: 'textarea#prompt-textarea, [contenteditable="true"]#prompt-textarea',
    send: 'button[data-testid="send-button"], button[aria-label="Send prompt"], button[aria-label="发送提示"]',
    user: '[data-message-author-role="user"]', assistant: '[data-message-author-role="assistant"]',
    text: '.markdown', complete: 'button[data-testid="copy-turn-action-button"], button[aria-label="Copy response"]',
    busy: 'button[data-testid="stop-button"], button[aria-label="Stop streaming"]',
  },
  'anthropic-claude': {
    scope: 'main, [role="main"]', composer: '[contenteditable="true"].ProseMirror[role="textbox"], [contenteditable="true"][data-testid="chat-input"]',
    send: 'button[aria-label="Send message"], button[aria-label="发送消息"]',
    user: '[data-testid="user-message"]', assistant: '[data-is-streaming]',
    text: '.font-claude-response, [data-testid="assistant-message"]', complete: 'button[aria-label="Copy"], button[aria-label="Copy response"]',
    busy: '[data-is-streaming="true"], button[aria-label="Stop response"]',
  },
  'deepseek-chat': {
    scope: 'main, [role="main"], .chat-container', composer: 'textarea#chat-input',
    send: 'button[aria-label="Send"], button[aria-label="Send message"], button[aria-label="发送"]',
    user: '[data-message-role="user"], [data-role="user"]', assistant: '[data-message-role="assistant"], [data-role="assistant"]',
    text: '.ds-markdown, .markdown', complete: 'button[aria-label="Copy"], button[aria-label="复制"]',
    busy: 'button[aria-label="Stop generating"], button[aria-label="停止生成"]',
  },
  'qwen-chat': {
    scope: 'main, [role="main"], .chat-container', composer: 'textarea#chat-input, textarea#prompt-textarea',
    send: 'button[aria-label="Send"], button[aria-label="Send message"], button[aria-label="发送"]',
    user: '[data-message-role="user"], [data-role="user"]', assistant: '[data-message-role="assistant"], [data-role="assistant"]',
    text: '.markdown, .qwen-markdown', complete: 'button[aria-label="Copy"], button[aria-label="复制"]',
    busy: 'button[aria-label="Stop generating"], button[aria-label="停止生成"]',
  },
  'google-gemini': {
    scope: 'main, [role="main"], chat-window', composer: 'rich-textarea [contenteditable="true"][role="textbox"]',
    send: 'button.send-button, button[aria-label="Send message"], button[aria-label="发送消息"]',
    user: 'user-query', assistant: 'model-response', text: '.model-response-text, message-content',
    complete: 'button[aria-label="Copy response"], button[aria-label="复制回答"]',
    busy: 'button[aria-label="Stop response"], button[aria-label="停止回答"], .response-container[aria-busy="true"]',
  },
});
