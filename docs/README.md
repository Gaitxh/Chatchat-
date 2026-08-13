# ChatChat Documentation

ChatChat is a **browser-first AI consultation** project. Start with the active product docs below; historical experiments live under [`archive/`](archive/README.md).

## Start here

| Area | Document |
| --- | --- |
| Install & browser workflow | [`BROWSER_EXTENSION.md`](BROWSER_EXTENSION.md) |
| 协商协议 / Consultation protocol | [`CONSULTATION_PROTOCOL.md`](CONSULTATION_PROTOCOL.md) · [`CONSULTATION_PROTOCOL.zh-CN.md`](CONSULTATION_PROTOCOL.zh-CN.md) |
| Product principles | [`PRODUCT_PRINCIPLES.md`](PRODUCT_PRINCIPLES.md) |
| Provider integration | [`PROVIDER_SDK.md`](PROVIDER_SDK.md) |
| Teach Mode | [`TEACH_MODE.md`](TEACH_MODE.md) |
| Provider compatibility | [`COMPATIBILITY.md`](COMPATIBILITY.md) |
| Community recipes | [`COMMUNITY_RECIPES.md`](COMMUNITY_RECIPES.md) |
| Internationalization | [`INTERNATIONALIZATION.md`](INTERNATIONALIZATION.md) |
| Manual Provider testing | [`MANUAL_PROVIDER_TEST.md`](MANUAL_PROVIDER_TEST.md) |
| Release notes / process | [`RELEASE.md`](RELEASE.md) |

## Active source map

```text
extension-public/   Manifest V3 runtime assets
extension/          Side Panel HTML entry
src/consultation/   equal-participant semantics
src/core/           Blackboard + orchestration + event protocol
src/extension/      browser Side Panel product
src/i18n/           English + 简体中文
src/provider-sdk/   Provider catalog, Teach Mode, browser bridge
src/theater/        Consultation Theater and replay
src/validation/     privacy-safe validation metadata
schemas/            shareable schemas
scripts/            build and product checks
tests/              automated regression tests
```

## Historical code still present

The repository still contains earlier Desktop/Tauri and AI House experiments. They are retained for reference but are **not the primary product line**. New product work should target the browser consultation flow unless a proposal explicitly revives an archived experiment.
