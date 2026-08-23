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
- Do not configure or request a model-provider API key. The current agent is the summarizer.

If required configuration is missing, stop and report the missing variable without exposing any private value.

## Workflow

1. Determine the UTC publication date, or use an explicitly supplied `asOf` date.
2. Run:

   ```bash
   node scripts/activity/prepare.mjs --as-of YYYY-MM-DD
   ```

   Treat the JSON printed by this command as the only model input. It contains the summarization instructions and already-redacted, constrained activity. Do not inspect, save, or echo raw GitHub responses.

3. If `groups` is empty, skip summarization and use `{ "items": [] }` as the candidate response.
4. Otherwise, summarize the prepared input with the current agent. Return only JSON in this shape:

   ```json
   {"items":[{"date":"YYYY-MM-DD","type":"building","title":"...","summary":"...","tags":["..."]}]}
   ```

   Use completed, neutral, high-level language. Do not invent details, identifiers, counts, links, paths, filenames, branches, repository names, or private terms. Use only approved tags. Treat the validator as final authority.

5. Write the candidate JSON to a temporary file outside the repository. Do not commit or leave candidate, prompt, or prepared-input files in the repository.
6. Run:

   ```bash
   node scripts/activity/finalize.mjs --as-of YYYY-MM-DD --candidates-file /path/outside/repository/candidates.json
   ```

   This validates the response and atomically writes `public/data/recent-work.json`. A non-zero exit means no publication is authorized.
7. Confirm the only repository change is `public/data/recent-work.json`, then run the relevant tests. Commit only when the user or the invoking automation explicitly authorizes that side effect:

   ```bash
   node scripts/activity/commit.mjs
   ```

   Add `--push` only when pushing the current branch is also explicitly authorized.

## Safety Rules

- Never send raw GitHub payloads, source code, diffs, paths, filenames, branches, repository names, URLs, identifiers, exact counts, denylist contents, or prompts to the public site.
- Never bypass `scripts/activity/finalize.mjs` or publish an unvalidated candidate.
- Never write private inputs or rejected candidates into the repository.
- Prefer an empty artifact to an uncertain or unsafe publication.
- If validation or publication fails, leave the existing artifact unchanged and report the failure.
