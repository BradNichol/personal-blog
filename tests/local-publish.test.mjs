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
import {
  createActivityStateStore,
  sourceKeyForPullRequest,
} from "../scripts/activity/state.mjs";

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
  const stateDirectory = mkdtempSync(join(tmpdir(), "recent-work-state-"));
  const requests = [];
  try {
    const prepared = await prepareActivityInput({
      asOf: "2026-08-23",
      env: environment,
      stateStore: createActivityStateStore({
        ...environment,
        ACTIVITY_STATE_FILE: join(stateDirectory, "state.json"),
      }),
      existingArtifact: { version: 1, updatedAt: "2026-08-23", items: [] },
      fetchImpl: async (url, options) => {
        requests.push({ url: new URL(url), options });
        return {
          ok: true,
          async json() {
            return [{
              number: 252,
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
  } finally {
    rmSync(stateDirectory, { recursive: true, force: true });
  }
});

test("prepareActivityInput bootstraps from the current artifact instead of duplicating it", async () => {
  const stateDirectory = mkdtempSync(join(tmpdir(), "recent-work-bootstrap-"));
  const stateStore = createActivityStateStore({
    ...environment,
    ACTIVITY_STATE_FILE: join(stateDirectory, "state.json"),
  });

  try {
    const prepared = await prepareActivityInput({
      asOf: "2026-08-23",
      env: environment,
      existingArtifact: {
        version: 1,
        updatedAt: "2026-08-23",
        items: [safeCandidate],
      },
      stateStore,
      fetchImpl: async () => ({
        ok: true,
        async json() {
          return [{
            number: 252,
            user: { login: "bradley" },
            base: { ref: "master", repo: { language: "Java" } },
            merged_at: "2026-08-23T10:15:00Z",
            title: "Improved allowed-service processing",
            body: "Kept the processing boundary easier to reason about.",
            labels: [{ name: "Data" }],
          }];
        },
      }),
    });

    assert.equal(prepared.input.groups.length, 0);
    assert.equal(stateStore.read().processed.length, 1);
  } finally {
    rmSync(stateDirectory, { recursive: true, force: true });
  }
});

test("prepareActivityInput only sends unseen merged pull requests after publication", async () => {
  const stateDirectory = mkdtempSync(join(tmpdir(), "recent-work-incremental-"));
  const stateStore = createActivityStateStore({
    ...environment,
    ACTIVITY_STATE_FILE: join(stateDirectory, "state.json"),
  });
  const fetchImpl = async () => ({
    ok: true,
    async json() {
      return [{
        number: 253,
        user: { login: "bradley" },
        base: { ref: "master", repo: { language: "TypeScript" } },
        merged_at: "2026-08-23T10:15:00Z",
        title: "Grouped screen tests",
        body: "Kept related screen tests together.",
        labels: [{ name: "Testing" }],
      }];
    },
  });

  try {
    const first = await prepareActivityInput({
      asOf: "2026-08-23",
      env: environment,
      existingArtifact: { version: 1, updatedAt: "2026-08-23", items: [] },
      stateStore,
      fetchImpl,
    });
    assert.equal(first.input.groups.length, 1);
    assert.equal(stateStore.readPending().fullRefresh, false);

    const pending = stateStore.readPending();
    stateStore.markProcessed(pending.groups[0].sources, "2026-08-23");
    stateStore.clearPending();

    const second = await prepareActivityInput({
      asOf: "2026-08-23",
      env: environment,
      existingArtifact: { version: 1, updatedAt: "2026-08-23", items: [] },
      stateStore,
      fetchImpl,
    });
    assert.equal(second.input.groups.length, 0);
    assert.equal(stateStore.readPending().fullRefresh, false);
  } finally {
    rmSync(stateDirectory, { recursive: true, force: true });
  }
});

test("prepareActivityInput rebuilds a stale artifact from the complete current window", async () => {
  const stateDirectory = mkdtempSync(join(tmpdir(), "recent-work-stale-refresh-"));
  const stateStore = createActivityStateStore({
    ...environment,
    ACTIVITY_STATE_FILE: join(stateDirectory, "state.json"),
  });
  stateStore.initialize({
    processed: [{
      key: sourceKeyForPullRequest(repository, 254),
      date: "2026-08-27",
    }],
    asOf: "2026-08-27",
  });

  try {
    const prepared = await prepareActivityInput({
      asOf: "2026-08-28",
      env: environment,
      stateStore,
      existingArtifact: {
        version: 1,
        updatedAt: "2026-06-28",
        items: [safeCandidate],
      },
      fetchImpl: async () => ({
        ok: true,
        async json() {
          return [{
            number: 254,
            user: { login: "bradley" },
            base: { ref: "master", repo: { language: "TypeScript" } },
            merged_at: "2026-08-27T13:50:14Z",
            title: "Mirrored screen test structure",
            body: "Grouped related screen tests with the screen implementation.",
            labels: [],
          }];
        },
      }),
    });

    assert.equal(prepared.input.groups.length, 1);
    assert.equal(stateStore.readPending().fullRefresh, true);
    assert.equal(stateStore.readPending().groups[0].sources.length, 1);

    const artifact = finalizeActivityFromEnvironment({
      asOf: "2026-08-28",
      candidates: [{
        groupIds: [stateStore.readPending().groups[0].groupId],
        date: "2026-08-27",
        type: "maintaining",
        title: "Grouped screen test structure",
        summary: "Kept related screen tests together.",
        tags: ["TypeScript", "Testing", "Refactoring"],
      }],
      env: {
        ...environment,
        ACTIVITY_STATE_FILE: join(stateDirectory, "state.json"),
      },
      existingArtifact: {
        version: 1,
        updatedAt: "2026-06-28",
        items: [safeCandidate],
      },
      stateStore,
      writeArtifact: () => {},
    });

    assert.deepEqual(artifact.items, [{
      date: "2026-08-27",
      type: "maintaining",
      title: "Grouped screen test structure",
      summary: "Kept related screen tests together.",
      tags: ["TypeScript", "Testing", "Refactoring"],
    }]);
  } finally {
    rmSync(stateDirectory, { recursive: true, force: true });
  }
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
    existingArtifact: { version: 1, updatedAt: "2026-08-23", items: [] },
    writeArtifact: (value) => {
      writtenArtifact = value;
    },
  });

  assert.deepEqual(artifact, writtenArtifact);
  assert.deepEqual(artifact.items, [safeCandidate]);
  assert.match(renderRecentWork(artifact), /Improved large-file processing/u);
});

test("finalizeActivityFromEnvironment preserves existing items when there is no new activity", () => {
  const stateDirectory = mkdtempSync(join(tmpdir(), "recent-work-noop-"));
  const existingArtifact = {
    version: 1,
    updatedAt: "2026-08-23",
    items: [safeCandidate],
  };
  let writes = 0;

  try {
    const artifact = finalizeActivityFromEnvironment({
      asOf: "2026-08-23",
      candidates: [],
      env: {
        ...environment,
        ACTIVITY_STATE_FILE: join(stateDirectory, "state.json"),
      },
      existingArtifact,
      writeArtifact: () => {
        writes += 1;
      },
    });

    assert.deepEqual(artifact, existingArtifact);
    assert.equal(writes, 0);
  } finally {
    rmSync(stateDirectory, { recursive: true, force: true });
  }
});

test("finalizeActivityFromEnvironment appends routed items and records their source keys", () => {
  const stateDirectory = mkdtempSync(join(tmpdir(), "recent-work-routing-"));
  const stateStore = createActivityStateStore({
    ...environment,
    ACTIVITY_STATE_FILE: join(stateDirectory, "state.json"),
  });
  const source = { key: "hashed-source-key", date: "2026-08-23" };
  stateStore.initialize({ processed: [], asOf: "2026-08-23" });
  stateStore.writePending({
    asOf: "2026-08-23",
    groups: [{ groupId: "group-1", sources: [source] }],
  });

  let writtenArtifact;
  try {
    const artifact = finalizeActivityFromEnvironment({
      asOf: "2026-08-23",
      candidates: [{
        groupIds: ["group-1"],
        date: "2026-08-23",
        type: "testing",
        title: "Grouped screen tests",
        summary: "Kept related screen tests together.",
        tags: ["Testing"],
      }],
      env: {
        ...environment,
        ACTIVITY_STATE_FILE: join(stateDirectory, "state.json"),
      },
      existingArtifact: {
        version: 1,
        updatedAt: "2026-08-22",
        items: [safeCandidate],
      },
      stateStore,
      writeArtifact: (value) => {
        writtenArtifact = value;
      },
    });

    assert.deepEqual(artifact, writtenArtifact);
    assert.equal(artifact.items.length, 2);
    assert.equal("groupIds" in artifact.items[1], false);
    assert.deepEqual(stateStore.read().processed, [source]);
    assert.equal(stateStore.readPending(), null);
  } finally {
    rmSync(stateDirectory, { recursive: true, force: true });
  }
});

test("finalizeActivityFromEnvironment only replaces existing items for an explicit full refresh", () => {
  const stateDirectory = mkdtempSync(join(tmpdir(), "recent-work-full-refresh-"));
  const stateStore = createActivityStateStore({
    ...environment,
    ACTIVITY_STATE_FILE: join(stateDirectory, "state.json"),
  });
  stateStore.initialize({ processed: [], asOf: "2026-08-23" });
  stateStore.writePending({
    asOf: "2026-08-23",
    fullRefresh: true,
    groups: [{
      groupId: "group-1",
      sources: [{ key: "full-refresh-source", date: "2026-08-23" }],
    }],
  });

  try {
    const artifact = finalizeActivityFromEnvironment({
      asOf: "2026-08-23",
      candidates: [{
        groupIds: ["group-1"],
        date: "2026-08-23",
        type: "testing",
        title: "Grouped screen tests",
        summary: "Kept related screen tests together.",
        tags: ["Testing"],
      }],
      env: {
        ...environment,
        ACTIVITY_STATE_FILE: join(stateDirectory, "state.json"),
      },
      existingArtifact: {
        version: 1,
        updatedAt: "2026-08-22",
        items: [safeCandidate],
      },
      stateStore,
      writeArtifact: () => {},
    });

    assert.deepEqual(artifact.items, [{
      date: "2026-08-23",
      type: "testing",
      title: "Grouped screen tests",
      summary: "Kept related screen tests together.",
      tags: ["Testing"],
    }]);
  } finally {
    rmSync(stateDirectory, { recursive: true, force: true });
  }
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
