# ERROR_LOG.md

> Auto-appended errors and fixes (self-healing)

## Format Example
```markdown
## [YYYY-MM-DD HH:MM] Phase X.Y — filename.py
**Error:** <error message>
**Cause:** <root cause>
**Fix:** <what was changed>
**Prevention:** <convention added to CLAUDE.md>
```

## [2026-04-10 16:54] Phase 1.7 — docker
**Error:** `zsh: command not found: docker`
**Cause:** Docker is not installed on the dev machine.
**Fix:** Marked Phase 1.7 as `[!]` (blocked).
**Prevention:** Added to CLAUDE.md gotchas that docker must be installed to run local Supabase.
