import { renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  createHostedLanguageModelAdapter,
  produceActivityArtifact,
} from "./index.mjs";

const parseJsonSecret = (name) => {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required private configuration: ${name}`);
  }

  try {
    return JSON.parse(value);
  } catch {
    throw new Error(`Private configuration ${name} must contain valid JSON`);
  }
};

const todayUtc = () => new Date().toISOString().slice(0, 10);

const buildApiUrl = (apiRoot, repository, path = "") => {
  const [owner, name] = repository.split("/");
  if (!owner || !name || repository.split("/").length !== 2) {
    throw new Error("Every activity repository must use the owner/name format");
  }

  const url = new URL(apiRoot);
  const rootPath = url.pathname.replace(/\/$/u, "");
  url.pathname = `${rootPath}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}${path}`;
  return url;
};

const fetchGithubJson = async (url, token) => {
  const response = await fetch(url, {
    headers: {
      accept: "application/vnd.github+json",
      authorization: `Bearer ${token}`,
      "x-github-api-version": "2022-11-28",
    },
  });

  if (!response.ok) {
    throw new Error(`GitHub request failed with status ${response.status}`);
  }

  return response.json();
};

const fetchClosedPullRequests = async (repository, { apiRoot, token }) => {
  const activities = [];

  for (let page = 1; page <= 10; page += 1) {
    const url = buildApiUrl(apiRoot, repository, "/pulls");
    url.searchParams.set("base", "master");
    url.searchParams.set("direction", "desc");
    url.searchParams.set("per_page", "100");
    url.searchParams.set("page", String(page));
    url.searchParams.set("sort", "updated");
    url.searchParams.set("state", "closed");

    const pullRequests = await fetchGithubJson(url, token);
    if (!Array.isArray(pullRequests) || pullRequests.length === 0) {
      break;
    }

    activities.push(...pullRequests.map((pullRequest) => ({
      type: "pull_request",
      authorLogin: pullRequest.user?.login,
      repository,
      targetBranch: pullRequest.base?.ref,
      mergedAt: pullRequest.merged_at,
      title: pullRequest.title,
      body: pullRequest.body,
      labels: pullRequest.labels,
    })));

    if (pullRequests.length < 100) {
      break;
    }
  }

  return activities;
};

const writeArtifactAtomically = (artifact) => {
  const artifactPath = join(process.cwd(), "public", "data", "recent-work.json");
  const temporaryPath = `${artifactPath}.tmp`;
  writeFileSync(temporaryPath, `${JSON.stringify(artifact, null, 2)}\n`, "utf8");
  renameSync(temporaryPath, artifactPath);
};

export const publishActivityArtifact = async () => {
  const repositoryAllowlist = parseJsonSecret("ACTIVITY_REPOSITORIES");
  const denylist = parseJsonSecret("ACTIVITY_DENYLIST");
  const policy = parseJsonSecret("ACTIVITY_MODEL_POLICY");
  const authorLogin = process.env.ACTIVITY_AUTHOR_LOGIN;
  const githubToken = process.env.ACTIVITY_GITHUB_TOKEN;
  const asOf = todayUtc();

  if (!Array.isArray(repositoryAllowlist) || repositoryAllowlist.length === 0) {
    throw new Error("ACTIVITY_REPOSITORIES must be a non-empty JSON array");
  }

  if (!Array.isArray(denylist)) {
    throw new Error("ACTIVITY_DENYLIST must be a JSON array");
  }

  if (typeof authorLogin !== "string" || authorLogin.length === 0) {
    throw new Error("Missing required private configuration: ACTIVITY_AUTHOR_LOGIN");
  }

  if (typeof githubToken !== "string" || githubToken.length === 0) {
    throw new Error("Missing required private configuration: ACTIVITY_GITHUB_TOKEN");
  }

  const apiRoot = process.env.GITHUB_API_URL || "https://api.github.com";
  const activity = [];
  for (const repository of repositoryAllowlist) {
    activity.push(...await fetchClosedPullRequests(repository, {
      apiRoot,
      token: githubToken,
    }));
  }

  const adapter = createHostedLanguageModelAdapter({
    provider: process.env.ACTIVITY_MODEL_PROVIDER,
    endpoint: process.env.ACTIVITY_MODEL_ENDPOINT,
    apiKey: process.env.ACTIVITY_MODEL_API_KEY,
    policy,
  });
  const artifact = await produceActivityArtifact({
    activity,
    asOf,
    authorLogin,
    repositoryAllowlist,
    denylist,
    adapter,
  });

  writeArtifactAtomically(artifact);
};

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  publishActivityArtifact().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
