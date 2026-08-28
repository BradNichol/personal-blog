import { aggregateRelatedActivity } from "./eligibility.mjs";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { readArgument, todayUtc } from "./cli.mjs";
import { extractGithubActivity } from "./github.mjs";
import { buildSummarizerInput, groupIdForIndex } from "./model.mjs";
import { buildPrivateTerms, readActivityConfig } from "./config.mjs";
import { createActivityStateStore } from "./state.mjs";
import { earliestActivityDate, isCalendarDate } from "./contract.mjs";

const readExistingArtifact = () => {
  const artifactPath = join(process.cwd(), "public", "data", "recent-work.json");
  if (!existsSync(artifactPath)) {
    return null;
  }

  try {
    return JSON.parse(readFileSync(artifactPath, "utf8"));
  } catch {
    throw new Error("The existing recent-work artifact is not valid JSON");
  }
};

const hasCurrentArtifactItems = (artifact, asOf) => {
  if (!Array.isArray(artifact?.items)) {
    return false;
  }

  const currentEarliest = new Date(`${asOf}T00:00:00Z`);
  currentEarliest.setUTCDate(currentEarliest.getUTCDate() - 29);
  return artifact.items.some((item) => {
    if (typeof item?.date !== "string") {
      return false;
    }

    const date = new Date(`${item.date}T00:00:00Z`);
    return !Number.isNaN(date.getTime()) && date >= currentEarliest && date <= new Date(`${asOf}T00:00:00Z`);
  });
};

const isArtifactStale = (artifact, asOf) => {
  const earliestDate = earliestActivityDate(asOf);

  return Boolean(artifact)
    && isCalendarDate(asOf)
    && (!isCalendarDate(artifact.updatedAt)
      || artifact.updatedAt < earliestDate);
};

const sourceEntries = (activity) => activity
  .filter(({ sourceKey, date }) => typeof sourceKey === "string" && sourceKey.length > 0)
  .map(({ sourceKey: key, date }) => ({ key, date }));

const buildPendingRun = (groups, activity) => {
  const datesBySourceKey = new Map(activity.map(({ sourceKey, date }) => [sourceKey, date]));

  return {
    groups: groups.map((group, index) => ({
      groupId: groupIdForIndex(index),
      sources: group.sourceKeys
        .map((key) => ({ key, date: datesBySourceKey.get(key) }))
        .filter(({ date }) => typeof date === "string"),
    })),
  };
};

export const prepareActivityInput = async ({
  asOf = todayUtc(),
  env = process.env,
  fetchImpl = globalThis.fetch,
  stateStore = createActivityStateStore(env),
  existingArtifact = readExistingArtifact(),
  fullRefresh = false,
} = {}) => {
  const config = readActivityConfig(env, { requireGithubCredential: true });
  const activity = await extractGithubActivity({
    apiRoot: env.GITHUB_API_URL || "https://api.github.com",
    asOf,
    authorLogin: config.authorLogin,
    credentialPolicy: config.credentialPolicy,
    fetchImpl,
    privateTerms: config.denylist,
    repositoryAllowlist: config.repositoryAllowlist,
    token: config.githubToken,
  });
  const state = stateStore.read();
  const rebuildCurrentWindow = fullRefresh || isArtifactStale(existingArtifact, asOf);
  let unprocessedActivity = activity;

  if (rebuildCurrentWindow) {
    if (!state.initialized) {
      stateStore.initialize({ processed: [], asOf });
    }
  } else if (!state.initialized) {
    const processed = hasCurrentArtifactItems(existingArtifact, asOf)
      ? sourceEntries(activity)
      : [];
    stateStore.initialize({ processed, asOf });
    unprocessedActivity = processed.length > 0 ? [] : activity;
  } else {
    const processedKeys = new Set(state.processed.map(({ key }) => key));
    unprocessedActivity = activity.filter(({ sourceKey }) => (
      typeof sourceKey !== "string" || !processedKeys.has(sourceKey)
    ));
  }

  const privateTerms = buildPrivateTerms(config);
  const groups = aggregateRelatedActivity(unprocessedActivity);
  stateStore.writePending({
    asOf,
    fullRefresh: rebuildCurrentWindow,
    groups: buildPendingRun(groups, unprocessedActivity).groups,
  });

  return {
    asOf,
    input: buildSummarizerInput(groups, {
      denylist: config.denylist,
      privateTerms,
    }),
  };
};

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  prepareActivityInput({
    asOf: readArgument(process.argv, "--as-of") || todayUtc(),
    fullRefresh: process.argv.includes("--full-refresh"),
  })
    .then(({ input }) => {
      process.stdout.write(`${JSON.stringify(input, null, 2)}\n`);
    })
    .catch((error) => {
      console.error(error.message);
      process.exitCode = 1;
    });
}
