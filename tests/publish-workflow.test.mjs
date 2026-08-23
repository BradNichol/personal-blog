import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const workflow = readFileSync(
  ".github/workflows/publish-activity-artifact.yml",
  "utf8",
);

test("scheduled publication keeps private ingestion separate from the write credential", () => {
  assert.match(workflow, /schedule:\n\s+- cron:/u);
  assert.match(workflow, /workflow_dispatch:/u);
  assert.match(workflow, /permissions:\n\s+contents: write/u);
  assert.doesNotMatch(workflow, /^\s+GITHUB_TOKEN:/mu);
  assert.match(workflow, /- name: Produce the validated artifact\n\s+env:\n\s+ACTIVITY_AUTHOR_LOGIN:/u);
  assert.match(workflow, /ACTIVITY_GITHUB_TOKEN:/u);
  assert.match(workflow, /ACTIVITY_MODEL_API_KEY:/u);
  assert.match(workflow, /run: node scripts\/activity\/publish\.mjs/u);
  assert.match(workflow, /git diff --quiet -- public\/data\/recent-work\.json/u);
  assert.match(workflow, /git add public\/data\/recent-work\.json/u);
  assert.doesNotMatch(workflow, /git add \./u);
});
