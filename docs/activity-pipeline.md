# Activity artifact pipeline

The public site consumes only `public/data/recent-work.json`. Publication is a
local agent workflow rather than a GitHub Actions job: invoke the
`skills/publish-recent-work/SKILL.md` workflow manually or through a local
Codex, Claude, or operating-system scheduler.

The v1 selector is fixed to Bradley-authored pull requests merged into
`master` during the rolling 30-day window. Repository names are used only for
the private allowlist filter and never become model or artifact fields.

The workflow has two deterministic boundaries:

1. `scripts/activity/prepare.mjs` fetches the private allowlist with a
   dedicated read-only credential and prints only the constrained,
   redacted summarizer input. It never writes raw activity to the repository.
2. `scripts/activity/finalize.mjs` accepts the current agent's candidate JSON,
   validates it deterministically, and atomically writes the public artifact.

The current agent is the summarizer. No language-model provider, endpoint, or
API key is hard-coded in the repository. The agent receives calendar dates,
redacted PR title and description text, approved labels, coarse language
metadata, and broad change-size buckets; it never receives repository names,
branches, paths, filenames, URLs, identifiers, exact change counts, or author
identity.

The model response is only a proposal. `scripts/activity/contract.mjs`
deterministically rejects malformed, over-specific, ambiguous, denylisted, or
uncontrolled content. Rejected proposals are dropped. A failed preparation,
summarization, validation, or finalization leaves the existing artifact
unchanged because the finalizer writes only after validation.

Required local configuration is supplied through the environment and must not
be committed:

- `ACTIVITY_REPOSITORIES`: non-empty JSON array of `owner/name` repositories.
- `ACTIVITY_AUTHOR_LOGIN`: the private author filter.
- `ACTIVITY_GITHUB_TOKEN`: dedicated fine-grained or installation token.
- `ACTIVITY_GITHUB_TOKEN_POLICY`: JSON object asserting `type` is
  `fine-grained` or `github-app`, `readOnly: true`, `writeAccess: false`, and a
  `repositories` array exactly matching `ACTIVITY_REPOSITORIES`.
- `ACTIVITY_DENYLIST`: JSON array of private sensitive terms.

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

The local runner may commit and push only the sanitized artifact when that
side effect is explicitly authorized. `scripts/activity/commit.mjs` refuses to
commit when any other tracked or untracked file is changed; pass `--push` only
when pushing the current branch is also intended. CI runs the tests and syntax
checks but does not access private repositories, invoke the agent, or publish
the feed.
