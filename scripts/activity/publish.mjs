import { renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  createHostedLanguageModelAdapter,
  extractGithubActivity,
  produceActivityArtifact,
} from "./index.mjs";

const parseJsonSecret = (name, environment) => {
  const value = environment[name];

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

const writeArtifactAtomically = (artifact) => {
  const artifactPath = join(process.cwd(), "public", "data", "recent-work.json");
  const temporaryPath = `${artifactPath}.tmp`;
  writeFileSync(temporaryPath, `${JSON.stringify(artifact, null, 2)}\n`, "utf8");
  renameSync(temporaryPath, artifactPath);
};

export const publishActivityArtifact = async ({
  asOf = todayUtc(),
  env = process.env,
  fetchImpl = globalThis.fetch,
  modelFetchImpl = globalThis.fetch,
  writeArtifact = writeArtifactAtomically,
} = {}) => {
  const repositoryAllowlist = parseJsonSecret("ACTIVITY_REPOSITORIES", env);
  const credentialPolicy = parseJsonSecret("ACTIVITY_GITHUB_TOKEN_POLICY", env);
  const denylist = parseJsonSecret("ACTIVITY_DENYLIST", env);
  const policy = parseJsonSecret("ACTIVITY_MODEL_POLICY", env);
  const authorLogin = env.ACTIVITY_AUTHOR_LOGIN;
  const githubToken = env.ACTIVITY_GITHUB_TOKEN;

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

  if (env.GITHUB_TOKEN && githubToken === env.GITHUB_TOKEN) {
    throw new Error("ACTIVITY_GITHUB_TOKEN must be a dedicated read-only credential");
  }

  const apiRoot = env.GITHUB_API_URL || "https://api.github.com";
  const activity = await extractGithubActivity({
    apiRoot,
    authorLogin,
    credentialPolicy,
    fetchImpl,
    privateTerms: denylist,
    repositoryAllowlist,
    token: githubToken,
    asOf,
  });

  const adapter = createHostedLanguageModelAdapter({
    provider: env.ACTIVITY_MODEL_PROVIDER,
    endpoint: env.ACTIVITY_MODEL_ENDPOINT,
    apiKey: env.ACTIVITY_MODEL_API_KEY,
    policy,
    fetchImpl: modelFetchImpl,
  });
  const artifact = await produceActivityArtifact({
    eligibleActivity: activity,
    asOf,
    authorLogin,
    repositoryAllowlist,
    denylist,
    adapter,
  });

  writeArtifact(artifact);
  return artifact;
};

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  publishActivityArtifact().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
