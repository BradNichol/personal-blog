import assert from "node:assert/strict";
import { test } from "node:test";
import { renderRecentWork } from "../public/scripts/recent-work.js";
import { publishActivityArtifact } from "../scripts/activity/publish.mjs";

const repository = "fictional-owner/allowed-service";
const safeCandidate = {
  date: "2026-08-23",
  type: "building",
  title: "Improved large-file processing",
  summary: "Simplified streamed processing for large inputs.",
  tags: ["Java", "Streaming"],
};

const environment = {
  ACTIVITY_AUTHOR_LOGIN: "bradley",
  ACTIVITY_DENYLIST: JSON.stringify(["fictional-client"]),
  ACTIVITY_GITHUB_TOKEN: "read-only-token",
  ACTIVITY_GITHUB_TOKEN_POLICY: JSON.stringify({
    type: "fine-grained",
    readOnly: true,
    writeAccess: false,
    repositories: [repository],
  }),
  ACTIVITY_MODEL_API_KEY: "model-key",
  ACTIVITY_MODEL_ENDPOINT: "https://model.github.test/summarize",
  ACTIVITY_MODEL_POLICY: JSON.stringify({
    approved: true,
    noTraining: true,
    retention: "minimal",
    provider: "fictional-provider",
    endpoint: "https://model.github.test/summarize",
  }),
  ACTIVITY_MODEL_PROVIDER: "fictional-provider",
  ACTIVITY_REPOSITORIES: JSON.stringify([repository]),
  GITHUB_API_URL: "https://api.github.test",
};

test("publishActivityArtifact keeps GitHub ingestion private and writes only the validated artifact", async () => {
  const githubRequests = [];
  let modelRequest;
  let writtenArtifact;
  const artifact = await publishActivityArtifact({
    asOf: "2026-08-23",
    env: environment,
    fetchImpl: async (url, options) => {
      githubRequests.push({ url: new URL(url), options });
      return {
        ok: true,
        async json() {
          return [{
            user: { login: "bradley" },
            base: { ref: "master", repo: { language: "Java" } },
            head: { ref: "feature/private-work" },
            merged_at: "2026-08-23T10:15:00Z",
            title: "Improved allowed-service processing",
            body: "Merged feature/private-work for fictional-client.",
            labels: [{ name: "Streaming" }],
            additions: 420,
            deletions: 18,
            changed_files: 14,
          }];
        },
      };
    },
    modelFetchImpl: async (_url, options) => {
      modelRequest = JSON.parse(options.body);
      return {
        ok: true,
        async json() {
          return { items: [safeCandidate] };
        },
      };
    },
    writeArtifact: (value) => {
      writtenArtifact = value;
    },
  });

  assert.deepEqual(artifact, writtenArtifact);
  assert.deepEqual(artifact.items, [safeCandidate]);
  const rendered = renderRecentWork(artifact);
  assert.match(rendered, /23 Aug 2026/);
  assert.match(rendered, /Improved large-file processing/);
  assert.equal(githubRequests.length, 1);
  assert.equal(githubRequests[0].options.method, "GET");
  assert.equal("body" in githubRequests[0].options, false);
  assert.doesNotMatch(JSON.stringify(modelRequest), /allowed-service|private-work|fictional-client|bradley|420|18|14/);
});

test("publishActivityArtifact rejects reuse of the workflow write credential for private ingestion", async () => {
  await assert.rejects(
    () => publishActivityArtifact({
      asOf: "2026-08-23",
      env: {
        ...environment,
        GITHUB_TOKEN: environment.ACTIVITY_GITHUB_TOKEN,
      },
      fetchImpl: async () => {
        throw new Error("GitHub must not be contacted");
      },
      writeArtifact: () => {
        throw new Error("No artifact may be written");
      },
    }),
    /dedicated read-only credential/,
  );
});
