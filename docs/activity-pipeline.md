# Activity artifact pipeline

The public site consumes only `public/data/recent-work.json`. The scheduled
workflow in `.github/workflows/publish-activity-artifact.yml` is the private
processing boundary that produces it.

The v1 selector is fixed to Bradley-authored pull requests merged into
`master` during the rolling 30-day window. Repository names are used only for
the private allowlist filter and never become model or artifact fields.

The workflow reads its repository allowlist, author login, model credentials,
provider policy, and sensitive-term denylist from GitHub Actions secrets. None
of those values belong in this repository. The allowlist is passed to the
GitHub API only for private filtering. The model receives calendar dates,
redacted PR title and description text, approved labels, coarse language
metadata, and broad change-size buckets; it never receives repository names,
branches, paths, filenames, URLs, identifiers, exact change counts, or author
identity.

The model response is only a proposal. `scripts/activity/contract.mjs`
deterministically rejects malformed, over-specific, ambiguous, denylisted, or
uncontrolled content. Rejected proposals are dropped. The artifact is written
atomically only after validation, and the workflow stages only the sanitized
JSON file. A failed run therefore leaves the last known-good artifact in place.

Required private configuration is supplied as JSON where noted:

- `ACTIVITY_REPOSITORIES`: non-empty JSON array of `owner/name` repositories.
- `ACTIVITY_AUTHOR_LOGIN`: the private author filter.
- `ACTIVITY_GITHUB_TOKEN`: read-only token scoped to the allowlist.
- `ACTIVITY_DENYLIST`: JSON array of private sensitive terms.
- `ACTIVITY_MODEL_PROVIDER`, `ACTIVITY_MODEL_ENDPOINT`, and
  `ACTIVITY_MODEL_API_KEY`: hosted summariser configuration.
- `ACTIVITY_MODEL_POLICY`: JSON object with `approved: true`,
  `noTraining: true`, `retention: "minimal"`, and matching `provider` and
  `endpoint` fields.

The provider adapter refuses to start unless the explicit policy is present.
No default provider or fallback model is configured.
