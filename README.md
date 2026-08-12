<div align="center">
  <img src="assets/chatchat-avatar-pixel.png" width="180" alt="ChatChat pixel-art council avatar" />

# ChatChat

**You ask. They debate.**

</div>

ChatChat is a local-first, open-source AI Council where multiple AI models independently answer a user's question, challenge one another on a shared blackboard, revise their positions, and produce a final council report.

Development is starting with the council protocol and a deterministic mock demo before real provider adapters are connected.

## v0.1 target

```text
King / User
    ↓
Council Engine
    ↓
Independent Positions
    ↓
Blackboard
    ↓
Automatic Challenge / Rebuttal / Revision
    ↓
Council Report
```

The first implementation will keep the council engine provider-agnostic and local-first, using mock providers before connecting real model services.
