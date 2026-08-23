import { selectEligiblePullRequests } from "./eligibility.mjs";
import { isCalendarDate } from "./contract.mjs";
import { redactText } from "./text.mjs";

export const DEFAULT_GITHUB_API_ROOT = "https://api.github.com";
export const GITHUB_API_VERSION = "2022-11-28";
export const GITHUB_PAGE_SIZE = 100;

const REPOSITORY_PATTERN = /^[A-Za-z0-9](?:[A-Za-z0-9._-]{0,99})\/[A-Za-z0-9](?:[A-Za-z0-9._-]{0,99})$/u;
const MAX_SOURCE_TITLE_LENGTH = 300;
const MAX_SOURCE_DESCRIPTION_LENGTH = 4_000;

export const expandRepositoryPrivateTerms = (repository) => [
  repository,
  ...repository.split("/"),
];

const trimSourceText = (value, maximum) => (
  typeof value === "string"
    ? value.replace(/\s+/gu, " ").trim().slice(0, maximum)
    : ""
);

export const validateRepositoryAllowlist = (repositories) => {
  if (!Array.isArray(repositories) || repositories.length === 0) {
    throw new Error("A non-empty repository allowlist is required");
  }

  const seen = new Set();
  const validated = repositories.map((repository) => {
    if (typeof repository !== "string"
      || repository !== repository.trim()
      || !REPOSITORY_PATTERN.test(repository)) {
      throw new Error("Every repository allowlist entry must use the owner/name format");
    }

    if (seen.has(repository)) {
      throw new Error(`The repository allowlist contains a duplicate repository: ${repository}`);
    }

    seen.add(repository);
    return repository;
  });

  return validated;
};

const validateApiRoot = (apiRoot) => {
  if (typeof apiRoot !== "string") {
    throw new Error("The GitHub API root must use HTTPS");
  }

  let url;
  try {
    url = new URL(apiRoot);
  } catch {
    throw new Error("The GitHub API root must use HTTPS");
  }

  if (url.protocol !== "https:" || url.search || url.hash) {
    throw new Error("The GitHub API root must use HTTPS");
  }

  return url.toString().replace(/\/$/u, "");
};

const validateCredential = (token, credentialPolicy) => {
  if (typeof token !== "string" || token.length === 0 || /\s/u.test(token)
    || !["fine-grained", "github-app"].includes(credentialPolicy?.type)
    || credentialPolicy?.readOnly !== true
    || credentialPolicy?.writeAccess !== false) {
    throw new Error("A dedicated read-only GitHub credential is required");
  }
};

const validateCredentialScope = (credentialPolicy, repositories) => {
  const policyRepositories = validateRepositoryAllowlist(credentialPolicy.repositories);
  if (policyRepositories.length !== repositories.length
    || policyRepositories.some((repository, index) => repository !== repositories[index])) {
    throw new Error("The GitHub credential policy must match the repository allowlist");
  }
};

const buildPullRequestUrl = (apiRoot, repository, page) => {
  const [owner, name] = repository.split("/");
  const url = new URL(apiRoot);
  const rootPath = url.pathname.replace(/\/$/u, "");
  url.pathname = `${rootPath}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/pulls`;
  url.searchParams.set("base", "master");
  url.searchParams.set("direction", "desc");
  url.searchParams.set("page", String(page));
  url.searchParams.set("per_page", String(GITHUB_PAGE_SIZE));
  url.searchParams.set("sort", "updated");
  url.searchParams.set("state", "closed");
  return url;
};

const readGithubJson = async (fetchImpl, url, token) => {
  const response = await fetchImpl(url, {
    method: "GET",
    headers: {
      accept: "application/vnd.github+json",
      authorization: `Bearer ${token}`,
      "x-github-api-version": GITHUB_API_VERSION,
    },
  });

  if (!response?.ok) {
    throw new Error(`GitHub request failed with status ${response?.status ?? "unknown"}`);
  }

  return response.json();
};

const normalizePullRequest = (pullRequest, repository, privateTerms) => {
  const authorLogin = pullRequest?.user?.login;
  const targetBranch = pullRequest?.base?.ref;
  const sourceBranch = pullRequest?.head?.ref;
  const textTerms = [
    ...privateTerms,
    ...expandRepositoryPrivateTerms(repository),
    authorLogin,
    targetBranch,
    sourceBranch,
  ];

  return {
    type: "pull_request",
    authorLogin,
    repository,
    targetBranch,
    mergedAt: pullRequest?.merged_at,
    title: redactText(
      trimSourceText(pullRequest?.title, MAX_SOURCE_TITLE_LENGTH),
      textTerms,
    ),
    body: redactText(
      trimSourceText(pullRequest?.body, MAX_SOURCE_DESCRIPTION_LENGTH),
      textTerms,
    ),
    labels: pullRequest?.labels,
    language: pullRequest?.base?.repo?.language ?? pullRequest?.language,
    additions: pullRequest?.additions,
    deletions: pullRequest?.deletions,
    changedFiles: pullRequest?.changed_files,
  };
};

const isPullRequestPayload = (pullRequest) => {
  if (pullRequest === null || typeof pullRequest !== "object" || Array.isArray(pullRequest)) {
    throw new Error("GitHub pull request response contained a malformed item");
  }

  if (pullRequest.type && pullRequest.type !== "pull_request") {
    return false;
  }

  if (typeof pullRequest.user?.login !== "string"
    || typeof pullRequest.base?.ref !== "string"
    || typeof pullRequest.title !== "string"
    || !Object.hasOwn(pullRequest, "merged_at")) {
    throw new Error("GitHub pull request response contained an incomplete item");
  }

  return true;
};

const fetchRepositoryPullRequests = async (
  repository,
  { apiRoot, fetchImpl, privateTerms, token },
) => {
  const activities = [];

  for (let page = 1; ; page += 1) {
    const url = buildPullRequestUrl(apiRoot, repository, page);
    const pullRequests = await readGithubJson(fetchImpl, url, token);

    if (!Array.isArray(pullRequests)) {
      throw new Error("GitHub pull request response was not an array");
    }

    activities.push(...pullRequests
      .filter(isPullRequestPayload)
      .map((pullRequest) => normalizePullRequest(pullRequest, repository, privateTerms)));

    if (pullRequests.length < GITHUB_PAGE_SIZE) {
      break;
    }
  }

  return activities;
};

export const createGithubActivityExtractor = ({
  apiRoot = DEFAULT_GITHUB_API_ROOT,
  credentialPolicy,
  fetchImpl = globalThis.fetch,
  token,
}) => {
  const validatedApiRoot = validateApiRoot(apiRoot);
  validateCredential(token, credentialPolicy);

  if (typeof fetchImpl !== "function") {
    throw new Error("A fetch implementation is required");
  }

  return Object.freeze({
    async extract({ asOf, authorLogin, privateTerms = [], repositoryAllowlist }) {
      if (!isCalendarDate(asOf)) {
        throw new Error("A valid activity date is required");
      }

      if (typeof authorLogin !== "string" || authorLogin.length === 0) {
        throw new Error("A GitHub author login is required");
      }

      const repositories = validateRepositoryAllowlist(repositoryAllowlist);
      validateCredentialScope(credentialPolicy, repositories);
      const sourceActivity = [];

      for (const repository of repositories) {
        sourceActivity.push(...await fetchRepositoryPullRequests(repository, {
          apiRoot: validatedApiRoot,
          fetchImpl,
          privateTerms: Array.isArray(privateTerms) ? privateTerms : [],
          token,
        }));
      }

      return selectEligiblePullRequests(sourceActivity, {
        asOf,
        authorLogin,
        repositoryAllowlist: repositories,
      });
    },
  });
};

export const extractGithubActivity = async (options) => {
  const {
    apiRoot,
    credentialPolicy,
    fetchImpl,
    token,
    ...request
  } = options ?? {};
  const extractor = createGithubActivityExtractor({
    apiRoot,
    credentialPolicy,
    fetchImpl,
    token,
  });
  return extractor.extract(request);
};
