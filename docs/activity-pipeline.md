# Activity artifact pipeline

The public site consumes only `public/data/recent-work.json`. Publication is a
local agent workflow rather than a GitHub Actions job: invoke the
`skills/publish-recent-work/SKILL.md` workflow manually or through a local
Codex, Claude, or operating-system scheduler.

The v1 selector is fixed to Bradley-authored pull requests merged into
`master` during the rolling 30-day window. Repository names are used only for
the private allowlist filter and never become model or artifact fields.

The workflow has three deterministic boundaries:

1. `scripts/activity/prepare.mjs` fetches the private allowlist with a
   dedicated read-only credential, removes already processed pull requests
   during incremental runs, and prints only the constrained, redacted
   summarizer input. A stale-window run includes the complete current window.
   It never writes raw activity to the repository.
2. The private state store records hashed source keys and pending group routing
   metadata outside the repository. These values are never sent to the model
   or written to the public artifact.
3. `scripts/activity/finalize.mjs` accepts the current agent's candidate JSON,
   validates it deterministically, preserves existing public entries during
   incremental runs, and atomically writes the public artifact.

The current agent is the summarizer. No language-model provider, endpoint, or
API key is hard-coded in the repository. The agent receives calendar dates,
opaque group routing labels, redacted PR title and description text, approved
labels, coarse language metadata, and broad change-size buckets; it never
receives repository names, branches, paths, filenames, URLs, source
identifiers, exact change counts, or author identity.
When the existing artifact is older than the rolling window, preparation
automatically sends the whole current window for one thematic pass so related
work across codebases can be combined; otherwise normal runs remain
incremental.

Activity is kept independently routable at the model seam. The summarizer may
combine related events across codebases, but unrelated events remain separate
items where the public seven-item limit allows.

The model response is only a proposal. `scripts/activity/contract.mjs`
deterministically rejects malformed, over-specific, ambiguous, denylisted, or
uncontrolled content. Public entries may use the `building`, `testing`,
`maintaining`, or `documenting` type. Public tags are limited to `Architecture`,
`Data`, `Java`, `TypeScript`, `Testing`, and `Refactoring`.
Rejected proposals are dropped. A failed preparation, summarization, validation,
or finalization leaves the existing artifact unchanged because the finalizer
writes only after validation. A successful incremental run appends accepted
items to the existing artifact and prunes entries outside the rolling window;
it does not rewrite existing summaries. A stale-window run replaces the old
artifact with the accepted current-window themes. If there is no new activity,
the existing entries are retained unless the artifact itself is stale. An
explicit `--full-refresh` flag is also available for intentional regeneration.

Required local configuration is supplied through the environment and must not
be committed:

- `ACTIVITY_REPOSITORIES`: non-empty JSON array of `owner/name` repositories.
- `ACTIVITY_AUTHOR_LOGIN`: the private author filter.
- `ACTIVITY_GITHUB_TOKEN`: dedicated fine-grained or installation token.
- `ACTIVITY_GITHUB_TOKEN_POLICY`: JSON object asserting `type` is
  `fine-grained` or `github-app`, `readOnly: true`, `writeAccess: false`, and a
  `repositories` array exactly matching `ACTIVITY_REPOSITORIES`.
- `ACTIVITY_DENYLIST`: JSON array of private sensitive terms.
- `ACTIVITY_STATE_FILE` (optional): path outside the repository for the local
  processed-activity state. The default is
  `~/.config/personal-blog/recent-work-state.json`.

For first-time setup, run `bash scripts/activity/setup-local.sh`. The wizard
stores shell-escaped values at `~/.config/personal-blog/activity.env` (or the
path supplied through `ACTIVITY_CONFIG_FILE`), refuses repository-local
credential files, and generates `ACTIVITY_GITHUB_TOKEN_POLICY` from the
allowlist. Create the token as a fine-grained token restricted to the selected
repositories with only Metadata and Pull requests read permissions. The
[GitHub token guide](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens)
describes the current token-creation flow.

The publication skill automatically loads this external configuration through
`scripts/activity/run-with-config.sh` when no activity variables are already
present. Direct manual invocations should either use that wrapper or source the
configuration in the current shell.

On the first run after this incremental workflow is installed, an existing
current artifact is treated as the baseline and its current-window activity is
marked processed. This avoids duplicating the existing feed. A repository with
an empty or stale artifact is treated as new and will publish its current
eligible activity.

The local runner may commit and push only the sanitized artifact when that
side effect is explicitly authorized. `scripts/activity/commit.mjs` refuses to
commit when any other tracked or untracked file is changed; pass `--push` only
when pushing the current branch is also intended. CI runs the tests and syntax
checks but does not access private repositories, invoke the agent, or publish
the feed.
