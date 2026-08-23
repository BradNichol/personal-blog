## Personal Site

Minimal static site with a home page and contact page. No build step.

### Local preview

```bash
python3 -m http.server --directory public
```

## Refreshing Recent work

Run the reusable local workflow in `skills/publish-recent-work/SKILL.md` from
the repository root. It prepares redacted GitHub activity, lets the current
agent produce candidate summaries, and validates the result before writing
`public/data/recent-work.json`. The workflow can be invoked manually or by a
local scheduler. Use `node scripts/activity/commit.mjs` only when committing
the generated artifact is explicitly intended.
