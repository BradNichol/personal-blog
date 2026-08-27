import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { readArgument, todayUtc } from "./cli.mjs";
import {
  createIncrementalArtifact,
  earliestActivityDate,
  stripCandidateRouting,
  validatePublicCandidate,
} from "./contract.mjs";
import { buildPrivateTerms, readActivityConfig } from "./config.mjs";
import { createActivityStateStore } from "./state.mjs";

const writeArtifactAtomically = (artifact) => {
  const artifactPath = join(process.cwd(), "public", "data", "recent-work.json");
  const temporaryPath = `${artifactPath}.tmp`;
  writeFileSync(temporaryPath, `${JSON.stringify(artifact, null, 2)}\n`, "utf8");
  renameSync(temporaryPath, artifactPath);
};

const readArtifactFromDisk = () => {
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

const hasSameJson = (left, right) => JSON.stringify(left) === JSON.stringify(right);

const routeCandidates = ({ candidates, pendingRun, asOf }) => {
  const pendingGroups = new Map((pendingRun?.groups ?? [])
    .map((group) => [group.groupId, group]));
  const claimedGroups = new Set();

  return (Array.isArray(candidates) ? candidates : [])
    .map((candidate) => {
      const groupIds = candidate?.groupIds;
      if (groupIds !== undefined) {
        if (!Array.isArray(groupIds)
          || groupIds.length === 0
          || groupIds.some((groupId) => typeof groupId !== "string")
          || new Set(groupIds).size !== groupIds.length) {
          return null;
        }

        if (pendingRun
          && groupIds.some((groupId) => !pendingGroups.has(groupId))) {
          return null;
        }

        if (groupIds.some((groupId) => claimedGroups.has(groupId))) {
          return null;
        }

        groupIds.forEach((groupId) => claimedGroups.add(groupId));
      } else if (pendingRun) {
        return null;
      }

      const publicCandidate = stripCandidateRouting(candidate);
      const validation = validatePublicCandidate(publicCandidate, {
        latestDate: asOf,
        earliestDate: earliestActivityDate(asOf),
      });

      return validation.valid ? { groupIds: groupIds ?? [], publicCandidate } : null;
    })
    .filter(Boolean);
};

export const readCandidateProposal = (value) => {
  let proposal;

  try {
    proposal = JSON.parse(value);
  } catch {
    throw new Error("Candidate input must contain valid JSON");
  }

  if (proposal && Array.isArray(proposal.items)) {
    return proposal.items;
  }

  throw new Error("Candidate input must contain an items array");
};

export const finalizeActivityArtifact = ({
  asOf = todayUtc(),
  candidates,
  config,
  writeArtifact = writeArtifactAtomically,
  existingArtifact = readArtifactFromDisk(),
  stateStore = createActivityStateStore(),
}) => {
  if (!config) {
    throw new Error("Local activity configuration is required");
  }

  const pendingRun = stateStore.readPending();
  if (pendingRun && pendingRun.asOf !== asOf) {
    throw new Error("Pending activity run date does not match publication date");
  }

  const routedCandidates = routeCandidates({
    candidates,
    pendingRun,
    asOf,
  });
  const publicCandidates = routedCandidates.map(({ publicCandidate }) => publicCandidate);
  const artifact = pendingRun?.fullRefresh
    ? createIncrementalArtifact({
      asOf,
      existingArtifact: null,
      candidates: publicCandidates,
      denylist: buildPrivateTerms(config),
    })
    : createIncrementalArtifact({
      asOf,
      existingArtifact,
      candidates: publicCandidates,
      denylist: buildPrivateTerms(config),
    });

  if (pendingRun?.fullRefresh
    && pendingRun.groups.length > 0
    && artifact.items.length === 0) {
    throw new Error("Full refresh did not produce a valid public item");
  }

  if (!existingArtifact || !hasSameJson(existingArtifact, artifact)) {
    writeArtifact(artifact);
  }

  if (pendingRun) {
    const includedCandidates = new Set(artifact.items.map((item) => JSON.stringify(item)));
    const processedSources = routedCandidates
      .filter(({ publicCandidate }) => includedCandidates.has(JSON.stringify(publicCandidate)))
      .flatMap(({ groupIds }) => groupIds)
      .flatMap((groupId) => pendingRun.groups
        .find((group) => group.groupId === groupId)?.sources ?? []);

    if (processedSources.length > 0) {
      stateStore.markProcessed(processedSources, asOf);
    }
    stateStore.clearPending();
  }

  return artifact;
};

export const finalizeActivityFromEnvironment = ({
  asOf = todayUtc(),
  candidates,
  env = process.env,
  writeArtifact = writeArtifactAtomically,
  existingArtifact,
  stateStore = createActivityStateStore(env),
} = {}) => {
  const config = readActivityConfig(env);

  return finalizeActivityArtifact({
    asOf,
    candidates,
    config,
    writeArtifact,
    existingArtifact,
    stateStore,
  });
};

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const asOf = readArgument(process.argv, "--as-of") || todayUtc();
  const candidatesFile = readArgument(process.argv, "--candidates-file");
  const candidateJson = candidatesFile
    ? readFileSync(candidatesFile, "utf8")
    : readFileSync(0, "utf8");

  try {
    const artifact = finalizeActivityFromEnvironment({
      asOf,
      candidates: readCandidateProposal(candidateJson),
    });
    process.stdout.write(`${JSON.stringify(artifact, null, 2)}\n`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
