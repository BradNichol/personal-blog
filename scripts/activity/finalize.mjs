import { readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { readArgument, todayUtc } from "./cli.mjs";
import { createPublicArtifact } from "./contract.mjs";
import { buildPrivateTerms, readActivityConfig } from "./config.mjs";

const writeArtifactAtomically = (artifact) => {
  const artifactPath = join(process.cwd(), "public", "data", "recent-work.json");
  const temporaryPath = `${artifactPath}.tmp`;
  writeFileSync(temporaryPath, `${JSON.stringify(artifact, null, 2)}\n`, "utf8");
  renameSync(temporaryPath, artifactPath);
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
}) => {
  if (!config) {
    throw new Error("Local activity configuration is required");
  }

  const artifact = createPublicArtifact({
    asOf,
    candidates,
    denylist: buildPrivateTerms(config),
  });

  writeArtifact(artifact);
  return artifact;
};

export const finalizeActivityFromEnvironment = ({
  asOf = todayUtc(),
  candidates,
  env = process.env,
  writeArtifact = writeArtifactAtomically,
} = {}) => {
  const config = readActivityConfig(env);

  return finalizeActivityArtifact({
    asOf,
    candidates,
    config,
    writeArtifact,
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
