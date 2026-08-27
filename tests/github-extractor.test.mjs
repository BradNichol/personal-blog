import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createGithubActivityExtractor,
  validateRepositoryAllowlist,
} from "../scripts/activity/index.mjs";

const asOf = "2026-08-23";
const repository = "fictional-owner/allowed-service";
const credentialPolicy = {
  type: "fine-grained",
  readOnly: true,
  writeAccess: false,
  repositories: [repository],
};

const pullRequest = (overrides = {}) => ({
  user: { login: "bradley" },
  base: {
    ref: "master",
    repo: { language: "Java" },
  },
  merged_at: "2026-08-23T10:15:00Z",
  title: "Improved streamed processing for large inputs",
  body: "Kept the processing boundary easier to reason about.",
  labels: [
    { name: "Streaming" },
    { name: "private-label" },
  ],
  additions: 420,
  deletions: 18,
  changed_files: 14,
  ...overrides,
});

test("extractGithubActivity keeps only eligible allowlisted pull requests", async () => {
  const requests = [];
  const extractor = createGithubActivityExtractor({
    credentialPolicy,
    token: "read-only-token",
    apiRoot: "https://api.github.test",
    fetchImpl: async (url, options) => {
      requests.push({ url: new URL(url), options });
      return {
        ok: true,
        async json() {
          return [
            pullRequest(),
            pullRequest({ user: { login: "someone-else" } }),
            pullRequest({ base: { ref: "develop", repo: { language: "Java" } } }),
            pullRequest({ merged_at: null }),
            pullRequest({ merged_at: "2026-07-24T23:59:00Z" }),
            pullRequest({ type: "issue" }),
          ];
        },
      };
    },
  });

  const activity = await extractor.extract({
    asOf,
    authorLogin: "bradley",
    repositoryAllowlist: [repository],
  });

  assert.deepEqual(activity, [{
    date: "2026-08-23",
    title: "Improved streamed processing for large inputs",
    description: "Kept the processing boundary easier to reason about.",
    labels: ["Streaming"],
    language: "Java",
    sizeBucket: "large",
  }]);

  assert.equal(requests.length, 1);
  assert.equal(requests[0].url.pathname, "/repos/fictional-owner/allowed-service/pulls");
  assert.equal(requests[0].url.searchParams.get("state"), "closed");
  assert.equal(requests[0].url.searchParams.get("base"), "master");
  assert.equal(requests[0].url.searchParams.get("per_page"), "100");
  assert.equal(requests[0].options.method, "GET");
  assert.equal("body" in requests[0].options, false);
  assert.equal(requests[0].options.headers.authorization, "Bearer read-only-token");

  const serialized = JSON.stringify(activity);
  assert.doesNotMatch(serialized, /fictional-owner|allowed-service|bradley|master|420|18|14/);
});

test("extractGithubActivity fetches every configured repository and never discovers another scope", async () => {
  const requests = [];
  const extractor = createGithubActivityExtractor({
    credentialPolicy: {
      ...credentialPolicy,
      repositories: [repository, "fictional-owner/another-service"],
    },
    token: "read-only-token",
    apiRoot: "https://api.github.test",
    fetchImpl: async (url) => {
      requests.push(new URL(url));
      return {
        ok: true,
        async json() {
          return [];
        },
      };
    },
  });

  await extractor.extract({
    asOf,
    authorLogin: "bradley",
    repositoryAllowlist: [repository, "fictional-owner/another-service"],
  });

  assert.deepEqual(requests.map((url) => url.pathname), [
    "/repos/fictional-owner/allowed-service/pulls",
    "/repos/fictional-owner/another-service/pulls",
  ]);
  assert.equal(requests.some((url) => url.pathname.includes("search")), false);
});

test("extractGithubActivity removes repository and branch terms before the summarisation boundary", async () => {
  const extractor = createGithubActivityExtractor({
    credentialPolicy,
    token: "read-only-token",
    apiRoot: "https://api.github.test",
    fetchImpl: async () => ({
      ok: true,
      async json() {
        return [pullRequest({
          head: { ref: "feature/private-work" },
          title: "Improved allowed-service processing",
          body: "Merged feature/private-work for the fictional-client boundary.",
        })];
      },
    }),
  });

  const activity = await extractor.extract({
    asOf,
    authorLogin: "bradley",
    privateTerms: ["fictional-client"],
    repositoryAllowlist: [repository],
  });

  const serialized = JSON.stringify(activity);
  assert.doesNotMatch(serialized, /allowed-service|private-work|fictional-client/);
  assert.match(activity[0].title, /\[redacted\]/u);
});

test("extractGithubActivity preserves titles with parenthesized issue references", async () => {
  const extractor = createGithubActivityExtractor({
    credentialPolicy,
    token: "read-only-token",
    apiRoot: "https://api.github.test",
    fetchImpl: async () => ({
      ok: true,
      async json() {
        return [
          pullRequest({
            title: "test: mirror __tests__ structure to per-screen folders (#252)",
          }),
          pullRequest({
            title: "Apply and enforce Screen Composition convention (#250)",
          }),
        ];
      },
    }),
  });

  const activity = await extractor.extract({
    asOf,
    authorLogin: "bradley",
    repositoryAllowlist: [repository],
  });

  assert.deepEqual(activity.map(({ title }) => title), [
    "test: mirror __tests__ structure to per-screen folders",
    "Apply and enforce Screen Composition convention",
  ]);
});

test("validateRepositoryAllowlist rejects implicit or malformed repository scope", () => {
  assert.deepEqual(validateRepositoryAllowlist([repository]), [repository]);
  assert.throws(
    () => validateRepositoryAllowlist([]),
    /non-empty repository allowlist/,
  );
  assert.throws(
    () => validateRepositoryAllowlist(["https://github.com/fictional-owner/allowed-service"]),
    /owner\/name/,
  );
  assert.throws(
    () => validateRepositoryAllowlist([repository, repository]),
    /duplicate repository/,
  );
});

test("createGithubActivityExtractor fails closed for invalid credentials and API responses", async () => {
  assert.throws(
    () => createGithubActivityExtractor({
      token: "",
      credentialPolicy,
      fetchImpl: async () => ({ ok: true, async json() { return []; } }),
    }),
    /read-only GitHub credential/,
  );

  const extractor = createGithubActivityExtractor({
    credentialPolicy,
    token: "read-only-token",
    fetchImpl: async () => ({
      ok: false,
      status: 403,
      async json() {
        return { message: "forbidden" };
      },
    }),
  });

  await assert.rejects(
    () => extractor.extract({
      asOf,
      authorLogin: "bradley",
      repositoryAllowlist: [repository],
    }),
    /GitHub request failed with status 403/,
  );

  const malformedExtractor = createGithubActivityExtractor({
    credentialPolicy,
    token: "read-only-token",
    fetchImpl: async () => ({
      ok: true,
      async json() {
        return [null];
      },
    }),
  });

  await assert.rejects(
    () => malformedExtractor.extract({
      asOf,
      authorLogin: "bradley",
      repositoryAllowlist: [repository],
    }),
    /malformed item/,
  );

  const incompleteExtractor = createGithubActivityExtractor({
    credentialPolicy,
    token: "read-only-token",
    fetchImpl: async () => ({
      ok: true,
      async json() {
        return [{}];
      },
    }),
  });

  await assert.rejects(
    () => incompleteExtractor.extract({
      asOf,
      authorLogin: "bradley",
      repositoryAllowlist: [repository],
    }),
    /incomplete item/,
  );
});
