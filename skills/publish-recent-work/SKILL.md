---
name: publish-recent-work
description: Publish a privacy-safe Recent work artifact from allowlisted GitHub activity using the current agent as the summarizer. Use when manually refreshing the personal site feed or when a local Codex, Claude, or OS scheduler invokes the publication workflow.
---

# Publish Recent Work

Prepare and publish the site's Recent work artifact locally without a hard-coded language-model provider. Keep extraction, redaction, and deterministic validation in the repository scripts; use the current agent only to turn the prepared safe input into candidate JSON.

## Preconditions

- Run from the repository root.
- Keep these local environment variables outside the repository and never print their values:
  - `ACTIVITY_REPOSITORIES`: JSON array of explicit `owner/name` repositories.
  - `ACTIVITY_AUTHOR_LOGIN`: the private GitHub author login.
  - `ACTIVITY_DENYLIST`: JSON array of private terms.
  - `ACTIVITY_GITHUB_TOKEN`: dedicated read-only GitHub credential.
  - `ACTIVITY_GITHUB_TOKEN_POLICY`: JSON policy matching the credential to the allowlist.
  - `ACTIVITY_STATE_FILE` (optional): external path for processed-activity state. Defaults to `~/.config/personal-blog/recent-work-state.json`.
- Do not configure or request a model-provider API key. The current agent is the summarizer.

When these activity variables are not already present, run publication commands
through `scripts/activity/run-with-config.sh`. It automatically loads the
wizard-managed configuration from `ACTIVITY_CONFIG_FILE` or
`~/.config/personal-blog/activity.env` without printing its values. Explicit
environment variables take precedence. If the file and environment are both
missing, stop and report the missing variable.

## Workflow

1. Determine the UTC publication date, or use an explicitly supplied `asOf` date.
2. Run:

   ```bash
   scripts/activity/run-with-config.sh node scripts/activity/prepare.mjs --as-of YYYY-MM-DD
   ```

   Normal runs are incremental while the current artifact is still inside the
   rolling window. If the artifact is stale, preparation automatically rebuilds
   the complete current window in one thematic pass. Use `--full-refresh` when
   an intentional regeneration is wanted regardless of artifact age.

   Treat the JSON printed by this command as the only model input. It contains the summarization instructions and already-redacted, constrained activity. Do not inspect, save, or echo raw GitHub responses.

3. If `groups` is empty, skip summarization and use `{ "items": [] }` as the candidate response.
4. Otherwise, summarize the prepared input with the current agent. Return only JSON in this shape:

   ```json
   {"items":[{"groupIds":["group-1"],"date":"YYYY-MM-DD","type":"testing","title":"...","summary":"...","tags":["..."]}]}
   ```

   Copy each opaque `groupId` from the prepared input into the item that summarises that group. Every prepared group should be covered once; one item may cover multiple closely related groups, including across codebases. If groups are not clearly related, keep them as separate items. `groupIds` are routing metadata and are removed before publication. Choose `building` for product changes, `testing` for test work, `maintaining` for refactoring or quality work, and `documenting` for documentation. Use completed, neutral, plain language. Do not invent details, identifiers, counts, links, paths, filenames, branches, repository names, or private terms. Use only approved tags: `Architecture`, `Data`, `Java`, `TypeScript`, `Testing`, and `Refactoring`. Treat the validator as final authority.

5. Write the candidate JSON to a temporary file outside the repository. Do not commit or leave candidate, prompt, or prepared-input files in the repository.
6. Run:

   ```bash
   scripts/activity/run-with-config.sh node scripts/activity/finalize.mjs --as-of YYYY-MM-DD --candidates-file /path/outside/repository/candidates.json
   ```

   This validates the response, preserves existing items during incremental
   runs, replaces a stale artifact with the accepted current-window themes, and
   atomically writes `public/data/recent-work.json`. A non-zero exit means no
   publication is authorized. If there is no new activity, the existing
   entries are retained unless the artifact is stale.
7. Confirm the only repository change is `public/data/recent-work.json`, then run the relevant tests. Commit only when the user or the invoking automation explicitly authorizes that side effect:

   ```bash
   node scripts/activity/commit.mjs
   ```

   Add `--push` only when pushing the current branch is also explicitly authorized.

## Safety Rules

- Never send raw GitHub payloads, source code, diffs, paths, filenames, branches, repository names, URLs, identifiers, exact counts, denylist contents, or prompts to the public site.
- Never commit the external processed-activity state or pending routing metadata.
- Do not use `--full-refresh` for routine publication; it intentionally replaces
  the current rolling-window entries with the newly summarised result.
- Never bypass `scripts/activity/finalize.mjs` or publish an unvalidated candidate.
- Never write private inputs or rejected candidates into the repository.
- Prefer an empty artifact to an uncertain or unsafe publication.
- If validation or publication fails, leave the existing artifact unchanged and report the failure.
