import { expandRepositoryPrivateTerms, validateRepositoryAllowlist } from "./github.mjs";

const parseJsonEnvironment = (name, environment) => {
  const value = environment[name];

  if (!value) {
    throw new Error(`Missing required local configuration: ${name}`);
  }

  try {
    return JSON.parse(value);
  } catch {
    throw new Error(`Local configuration ${name} must contain valid JSON`);
  }
};

export const readActivityConfig = (
  environment = process.env,
  { requireGithubCredential = false } = {},
) => {
  const repositoryAllowlist = validateRepositoryAllowlist(
    parseJsonEnvironment("ACTIVITY_REPOSITORIES", environment),
  );
  const denylist = parseJsonEnvironment("ACTIVITY_DENYLIST", environment);
  const authorLogin = environment.ACTIVITY_AUTHOR_LOGIN;

  if (!Array.isArray(denylist)) {
    throw new Error("ACTIVITY_DENYLIST must be a JSON array");
  }

  if (typeof authorLogin !== "string" || authorLogin.length === 0) {
    throw new Error("Missing required local configuration: ACTIVITY_AUTHOR_LOGIN");
  }

  if (!requireGithubCredential) {
    return { authorLogin, denylist, repositoryAllowlist };
  }

  const credentialPolicy = parseJsonEnvironment("ACTIVITY_GITHUB_TOKEN_POLICY", environment);
  const githubToken = environment.ACTIVITY_GITHUB_TOKEN;

  if (typeof githubToken !== "string" || githubToken.length === 0) {
    throw new Error("Missing required local configuration: ACTIVITY_GITHUB_TOKEN");
  }

  if (environment.GITHUB_TOKEN && githubToken === environment.GITHUB_TOKEN) {
    throw new Error("ACTIVITY_GITHUB_TOKEN must be a dedicated read-only credential");
  }

  return {
    authorLogin,
    credentialPolicy,
    denylist,
    githubToken,
    repositoryAllowlist,
  };
};

export const buildPrivateTerms = ({
  authorLogin,
  denylist,
  repositoryAllowlist,
}) => [
  ...(Array.isArray(denylist) ? denylist : []),
  ...(Array.isArray(repositoryAllowlist) ? repositoryAllowlist : [])
    .flatMap(expandRepositoryPrivateTerms),
  authorLogin,
  "master",
].filter((term) => typeof term === "string" && term.length > 0);
