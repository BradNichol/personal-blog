import assert from "node:assert/strict";
import { test } from "node:test";
import {
  aggregateRelatedActivity,
  buildSummarizerInput,
  createPublicArtifact,
  selectEligiblePullRequests,
  validatePublicCandidate,
  validatePublicArtifact,
} from "../scripts/activity/index.mjs";

const DENYLIST = ["fictional-client", "fictional-product"];

const eligibleSource = [
  {
    type: "pull_request",
    authorLogin: "bradley",
    repository: "fictional-service",
    targetBranch: "master",
    mergedAt: "2026-08-23T10:15:00Z",
    title: "Improved streamed processing for large inputs",
    body: "Kept the processing boundary easier to reason about.",
    labels: [{ name: "Streaming" }, { name: "uncontrolled-private-label" }],
    language: "Java",
    additions: 420,
    deletions: 18,
    changedFiles: 14,
  },
  {
    type: "pull_request",
    authorLogin: "bradley",
    repository: "fictional-service",
    targetBranch: "master",
    mergedAt: "2026-08-20T09:00:00Z",
    title: "Simplified reconciliation for imported data",
    body: "Made asynchronous flows easier to keep consistent.",
    labels: [{ name: "Data" }],
    language: "Java",
    additions: 8,
    deletions: 3,
    changedFiles: 2,
  },
];

const safeCandidate = {
  date: "2026-08-23",
  type: "building",
  title: "Improved large-file processing",
  summary: "Simplified streamed processing for large inputs.",
  tags: ["Java", "Streaming"],
};

test("selectEligiblePullRequests keeps only authored, merged, allowlisted master activity in the window", () => {
  const selected = selectEligiblePullRequests([
    ...eligibleSource,
    {
      ...eligibleSource[0],
      authorLogin: "someone-else",
    },
    {
      ...eligibleSource[0],
      repository: "another-fictional-service",
    },
    {
      ...eligibleSource[0],
      targetBranch: "develop",
    },
    {
      ...eligibleSource[0],
      mergedAt: "2026-07-01T09:00:00Z",
    },
    {
      ...eligibleSource[0],
      mergedAt: null,
    },
    {
      ...eligibleSource[0],
      type: "issue",
    },
  ], {
    asOf: "2026-08-23",
    authorLogin: "bradley",
    repositoryAllowlist: ["fictional-service"],
    targetBranch: "master",
    windowDays: 30,
  });

  assert.equal(selected.length, 2);
  assert.deepEqual(selected.map(({ date, title, labels, language, sizeBucket }) => ({
    date,
    title,
    labels,
    language,
    sizeBucket,
  })), [
    {
      date: "2026-08-23",
      title: "Improved streamed processing for large inputs",
      labels: ["Streaming"],
      language: "Java",
      sizeBucket: "large",
    },
    {
      date: "2026-08-20",
      title: "Simplified reconciliation for imported data",
      labels: ["Data"],
      language: "Java",
      sizeBucket: "small",
    },
  ]);

  assert.equal("repository" in selected[0], false);
  assert.equal("authorLogin" in selected[0], false);
  assert.equal("additions" in selected[0], false);
  assert.equal("changedFiles" in selected[0], false);
});

test("aggregateRelatedActivity groups related events without retaining source metadata", () => {
  const relatedActivity = {
    ...eligibleSource[0],
    title: "Strengthened streamed processing boundaries",
    mergedAt: "2026-08-22T09:00:00Z",
  };
  const groups = aggregateRelatedActivity(selectEligiblePullRequests([
    ...eligibleSource,
    relatedActivity,
  ], {
    asOf: "2026-08-23",
    authorLogin: "bradley",
    repositoryAllowlist: ["fictional-service"],
  }));

  assert.equal(groups.length, 2);
  assert.deepEqual(groups[0].events.map(({ date }) => date), ["2026-08-23", "2026-08-22"]);
  assert.deepEqual(groups[0].theme, ["Streaming"]);
  assert.equal("repository" in groups[0].events[0], false);
  assert.equal("authorLogin" in groups[0].events[0], false);
});

test("buildSummarizerInput exposes only the constrained model boundary", () => {
  const selected = selectEligiblePullRequests([
    {
      ...eligibleSource[0],
      title: "Improved fictional-product processing in src/jobs/worker.java #42",
      body: "Updated https://private.example/feature/secret and 42 files on feature/private-work.",
    },
  ], {
    asOf: "2026-08-23",
    authorLogin: "bradley",
    repositoryAllowlist: ["fictional-service"],
  });
  const input = buildSummarizerInput(aggregateRelatedActivity(selected), {
    denylist: DENYLIST,
    privateTerms: ["fictional-service", "feature/private-work", "bradley"],
  });
  const serialized = JSON.stringify(input);
  const serializedGroups = JSON.stringify(input.groups);

  assert.deepEqual(Object.keys(input), ["instructions", "groups"]);
  assert.deepEqual(Object.keys(input.groups[0]), ["theme", "events"]);
  assert.deepEqual(Object.keys(input.groups[0].events[0]), [
    "date",
    "title",
    "description",
    "labels",
    "language",
    "sizeBucket",
  ]);
  assert.doesNotMatch(serialized, /fictional-service|fictional-product|private\.example|worker\.java|feature\/private-work|#42|\b42\b/);
  assert.doesNotMatch(serializedGroups, /repository|authorLogin|targetBranch|additions|deletions|changedFiles/);
});

test("buildSummarizerInput redacts source-code and diff-shaped text", () => {
  const input = buildSummarizerInput([{
    theme: ["Architecture"],
    events: [{
      date: "2026-08-23",
      title: "```js const secret = value; ```",
      description: "diff --git a/private/file.js b/private/file.js\n+const secret = value;",
    }, {
      date: "2026-08-23",
      title: "if (ready) { process(); }",
      description: "if (ready) { process(); }",
    }, {
      date: "2026-08-23",
      title: "process()",
      description: "if (ready)",
    }],
  }]);
  const serialized = JSON.stringify(input);

  assert.doesNotMatch(serialized, /const secret|diff --git|private\/file\.js/);
});

test("validatePublicCandidate accepts the public contract and rejects unsafe or ambiguous proposals", () => {
  assert.deepEqual(validatePublicCandidate(safeCandidate, { denylist: DENYLIST }), {
    valid: true,
    errors: [],
  });

  const rejectedCandidates = [
    { ...safeCandidate, title: "fictional-product integration" },
    { ...safeCandidate, summary: "See https://example.invalid/private for details." },
    { ...safeCandidate, summary: "Updated src/jobs/worker.java on feature/secret-work." },
    { ...safeCandidate, summary: "Processed 42 files and guaranteed zero defects." },
    { ...safeCandidate, summary: "Tracked ABC-123 while const token = value." },
    { ...safeCandidate, title: "Improved Java 21 processing" },
    { ...safeCandidate, tags: ["Uncontrolled"] },
    { ...safeCandidate, summary: "This might describe work that is still being explored." },
    { ...safeCandidate, title: "" },
    { ...safeCandidate, summary: "A".repeat(241) },
    { ...safeCandidate, type: "learning" },
  ];

  for (const candidate of rejectedCandidates) {
    assert.equal(validatePublicCandidate(candidate, { denylist: DENYLIST }).valid, false);
  }
});

test("createPublicArtifact drops rejected candidates and caps the public history", () => {
  const themeNames = ["alpha", "bravo", "charlie", "delta", "echo", "foxtrot", "golf", "hotel"];
  const candidates = Array.from({ length: 8 }, (_, index) => ({
    ...safeCandidate,
    date: `2026-08-${String(23 - index).padStart(2, "0")}`,
    title: `Improved safe ${themeNames[index]} theme`,
  }));

  const artifact = createPublicArtifact({
    asOf: "2026-08-23",
    candidates: [
      ...candidates,
      { ...safeCandidate, title: "fictional-product details" },
      { ...safeCandidate, tags: ["Uncontrolled"] },
      { ...safeCandidate, date: "2026-07-01", title: "Stale safe theme" },
    ],
    denylist: DENYLIST,
  });

  assert.deepEqual(Object.keys(artifact), ["version", "updatedAt", "items"]);
  assert.equal(artifact.version, 1);
  assert.equal(artifact.updatedAt, "2026-08-23");
  assert.equal(artifact.items.length, 7);
  assert.equal(validatePublicArtifact(artifact, { denylist: DENYLIST }).valid, true);
  assert.equal(JSON.stringify(artifact).includes("fictional-product"), false);
  assert.equal(JSON.stringify(artifact).includes("Stale safe theme"), false);
});
