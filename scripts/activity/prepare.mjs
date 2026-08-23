import { aggregateRelatedActivity } from "./eligibility.mjs";
import { fileURLToPath } from "node:url";
import { readArgument, todayUtc } from "./cli.mjs";
import { extractGithubActivity } from "./github.mjs";
import { buildSummarizerInput } from "./model.mjs";
import { buildPrivateTerms, readActivityConfig } from "./config.mjs";

export const prepareActivityInput = async ({
  asOf = todayUtc(),
  env = process.env,
  fetchImpl = globalThis.fetch,
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
  const privateTerms = buildPrivateTerms(config);
  const groups = aggregateRelatedActivity(activity);

  return {
    asOf,
    input: buildSummarizerInput(groups, {
      denylist: config.denylist,
      privateTerms,
    }),
  };
};

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  prepareActivityInput({ asOf: readArgument(process.argv, "--as-of") || todayUtc() })
    .then(({ input }) => {
      process.stdout.write(`${JSON.stringify(input, null, 2)}\n`);
    })
    .catch((error) => {
      console.error(error.message);
      process.exitCode = 1;
    });
}
