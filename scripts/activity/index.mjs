export {
  APPROVED_TAGS,
  MAX_PUBLIC_ITEMS,
  MAX_SUMMARY_LENGTH,
  MAX_TAGS,
  MAX_TITLE_LENGTH,
  PUBLIC_ACTIVITY_TYPE,
  PUBLIC_ARTIFACT_VERSION,
  ROLLING_WINDOW_DAYS,
  createPublicArtifact,
  isCalendarDate,
  validatePublicArtifact,
  validatePublicCandidate,
} from "./contract.mjs";
export {
  aggregateRelatedActivity,
  selectEligiblePullRequests,
} from "./eligibility.mjs";
export {
  buildSummarizerInput,
  createHostedLanguageModelAdapter,
  MODEL_INSTRUCTIONS,
} from "./model.mjs";

import { aggregateRelatedActivity, selectEligiblePullRequests } from "./eligibility.mjs";
import { buildSummarizerInput } from "./model.mjs";
import { createPublicArtifact } from "./contract.mjs";

export const produceActivityArtifact = async ({
  activity,
  asOf,
  authorLogin,
  repositoryAllowlist,
  adapter,
  denylist = [],
}) => {
  if (!adapter || typeof adapter.summarize !== "function") {
    throw new Error("A summarizer adapter is required");
  }

  const eligible = selectEligiblePullRequests(activity, {
    asOf,
    authorLogin,
    repositoryAllowlist,
  });
  const groups = aggregateRelatedActivity(eligible);
  const privateTerms = [
    ...denylist,
    ...(Array.isArray(repositoryAllowlist) ? repositoryAllowlist : []),
    authorLogin,
    "master",
  ];
  if (groups.length === 0) {
    return createPublicArtifact({
      asOf,
      candidates: [],
      denylist: privateTerms,
    });
  }

  const proposal = await adapter.summarize(buildSummarizerInput(groups, {
    denylist,
    privateTerms,
  }));
  let candidates;
  if (Array.isArray(proposal)) {
    candidates = proposal;
  } else if (proposal && Array.isArray(proposal.items)) {
    candidates = proposal.items;
  } else {
    throw new Error("Model response did not contain a candidate item array");
  }

  return createPublicArtifact({
    asOf,
    candidates,
    denylist: privateTerms,
  });
};
