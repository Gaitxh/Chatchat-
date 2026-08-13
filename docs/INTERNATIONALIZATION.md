# ChatChat Internationalization

ChatChat is an international open-source project. The primary browser interface ships with English and Simplified Chinese as first-class product languages.

## Supported UI locales

```text
en
zh-CN
```

The default locale follows the browser language. Users can switch language at any time from the Side Panel header.

## Source of truth

User-facing strings live in:

```text
src/i18n/index.ts
```

Do not add new primary Side Panel copy as an untranslated string when a shared message key is appropriate.

## Product vocabulary

| English | 中文 |
|---|---|
| AI Consultation | AI 协商会议 |
| User Proposal | 用户提案 |
| Equal AI participants | 平等 AI 参与者 |
| Independent views | 独立意见 / 独立思考 |
| Open consultation | 公开协商 / 共同协商 |
| Shared consultation space | 共享协商空间 |
| Final positions | 最终立场 |
| Consultation outcome | 协商结果 |
| Revision / changed mind | 修正 / 改口 |
| Concede | 让步 |
| Different positions remain visible | 不同意见继续保留 |

The primary product should not use hierarchy vocabulary such as King, House, Parliament, Delegation, Chairman, 众议院, 国王 or 代表团.

## Protocol vocabulary

Wire-level event identifiers stay language-neutral:

```text
argument
challenge
evidence
support
defense
revision
concede
question
uncertain
final_position
```

The UI translates their labels, while the protocol stays stable across languages.

## Documentation

The repository homepage is English-first for global discovery and links directly to a Chinese README. Core product/protocol guides should provide a Chinese counterpart when they are intended for end users.
