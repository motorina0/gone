# Repository instructions

- Preserve the canonical `(x, y, elevation)` world; projection is the only screen-coordinate adapter.
- Never hard-code location content in generic systems. Keep editable JSON and SVG resources separate; do not inline game data or artwork.
- Preserve `/gone/` GitHub Pages paths and mobile pointer/safe-area behavior.
- Add deterministic unit and browser coverage for changed behavior. Run `npm run validate:content` and `npm run verify` before every push.
- Never push broken code, force-push, or add secrets. Work directly on `main` unless the user changes that instruction.
- Before completion, invoke the independent read-only verifier configured at `.codex/agents/verifier.toml`; resolve all blocking findings.
