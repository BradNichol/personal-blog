import { spawnSync } from "node:child_process";
import assert from "node:assert/strict";
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { renderRecentWork } from "../public/scripts/recent-work.js";
import {
  assertOnlyArtifactChanged,
  PUBLIC_ARTIFACT_PATH,
} from "../scripts/activity/commit.mjs";
import {
  finalizeActivityFromEnvironment,
  prepareActivityInput,
  readCandidateProposal,
} from "../scripts/activity/index.mjs";

const repository = "fictional-owner/allowed-service";
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
  ACTIVITY_REPOSITORIES: JSON.stringify([repository]),
  GITHUB_API_URL: "https://api.github.test",
};

const safeCandidate = {
  date: "2026-08-23",
  type: "building",
  title: "Improved large-file processing",
  summary: "Simplified streamed processing for large inputs.",
  tags: ["Java", "Data"],
};

const finalizeScript = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "scripts",
  "activity",
  "finalize.mjs",
);

test("prepareActivityInput gives the current agent only the constrained summarizer input", async () => {
  const requests = [];
  const prepared = await prepareActivityInput({
    asOf: "2026-08-23",
    env: environment,
    fetchImpl: async (url, options) => {
      requests.push({ url: new URL(url), options });
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
            labels: [{ name: "Data" }],
            additions: 420,
            deletions: 18,
            changed_files: 14,
          }];
        },
      };
    },
  });

  assert.equal(prepared.asOf, "2026-08-23");
  assert.deepEqual(Object.keys(prepared.input), ["instructions", "groups"]);
  assert.equal(prepared.input.groups.length, 1);
  assert.doesNotMatch(
    JSON.stringify(prepared.input),
    /allowed-service|private-work|fictional-client|bradley|420|18|14/u,
  );
  assert.equal(requests.length, 1);
  assert.equal(requests[0].options.method, "GET");
  assert.equal("body" in requests[0].options, false);
});

test("finalizeActivityFromEnvironment validates the agent response before writing and rendering it", () => {
  let writtenArtifact;
  const artifact = finalizeActivityFromEnvironment({
    asOf: "2026-08-23",
    candidates: [
      safeCandidate,
      { ...safeCandidate, title: "fictional-client work" },
    ],
    env: environment,
    writeArtifact: (value) => {
      writtenArtifact = value;
    },
  });

  assert.deepEqual(artifact, writtenArtifact);
  assert.deepEqual(artifact.items, [safeCandidate]);
  assert.match(renderRecentWork(artifact), /Improved large-file processing/u);
});

test("readCandidateProposal accepts the documented object response and rejects other shapes", () => {
  assert.deepEqual(readCandidateProposal(JSON.stringify({ items: [safeCandidate] })), [safeCandidate]);
  assert.throws(
    () => readCandidateProposal(JSON.stringify([safeCandidate])),
    /items array/u,
  );
  assert.throws(
    () => readCandidateProposal(JSON.stringify({ candidate: safeCandidate })),
    /items array/u,
  );
});

test("assertOnlyArtifactChanged rejects unrelated or missing repository changes", () => {
  assert.doesNotThrow(() => assertOnlyArtifactChanged({
    unstaged: [PUBLIC_ARTIFACT_PATH],
  }));
  assert.throws(
    () => assertOnlyArtifactChanged({
      unstaged: [PUBLIC_ARTIFACT_PATH, "skills/publish-recent-work/SKILL.md"],
    }),
    /Only public\/data\/recent-work\.json/u,
  );
  assert.throws(
    () => assertOnlyArtifactChanged({}),
    /has not changed/u,
  );
});

test("finalize.mjs writes the validated artifact when run as a local CLI", () => {
  const temporaryDirectory = mkdtempSync(join(tmpdir(), "publish-recent-work-"));
  const dataDirectory = join(temporaryDirectory, "public", "data");
  const candidatesPath = join(temporaryDirectory, "candidates.json");
  mkdirSync(dataDirectory, { recursive: true });
  writeFileSync(candidatesPath, JSON.stringify({ items: [safeCandidate] }), "utf8");

  try {
    const result = spawnSync(process.execPath, [
      finalizeScript,
      "--as-of",
      "2026-08-23",
      "--candidates-file",
      candidatesPath,
    ], {
      cwd: temporaryDirectory,
      encoding: "utf8",
      env: { ...process.env, ...environment },
    });

    assert.equal(result.status, 0, result.stderr);
    const artifact = JSON.parse(readFileSync(
      join(dataDirectory, "recent-work.json"),
      "utf8",
    ));
    assert.deepEqual(JSON.parse(result.stdout), artifact);
    assert.deepEqual(artifact.items, [safeCandidate]);
  } finally {
    rmSync(temporaryDirectory, { recursive: true, force: true });
  }
});
