---
name: Preview registration failures
description: Artifact registration failures can coexist with working preview routing.
---

An empty artifact list does not prove the public development preview is unavailable. Verify the actual preview URL before declaring it blocked.

**Why:** Artifact creation repeatedly returned `ARTIFACT_NOT_FOUND` even while the existing development URL still routed to surviving servers.

**How to apply:** Check the public frontend and same-origin API responses independently. Do not repeatedly recreate artifacts or ask the user to find an unverified artifact-manager recovery action.
