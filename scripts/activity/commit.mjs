import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

export const PUBLIC_ARTIFACT_PATH = "public/data/recent-work.json";

const runGit = (argumentsList) => execFileSync("git", argumentsList, {
  encoding: "utf8",
  stdio: ["ignore", "pipe", "pipe"],
}).trim();

export const assertOnlyArtifactChanged = ({
  staged = [],
  unstaged = [],
  untracked = [],
}) => {
  const changedFiles = [...new Set([...staged, ...unstaged, ...untracked])];

  if (changedFiles.length === 0) {
    throw new Error("The public artifact has not changed");
  }

  if (changedFiles.length !== 1 || changedFiles[0] !== PUBLIC_ARTIFACT_PATH) {
    throw new Error("Only public/data/recent-work.json may be committed");
  }
};

export const commitPublicArtifact = ({
  commitMessage = "chore: refresh recent work artifact",
  push = false,
  git = runGit,
} = {}) => {
  const staged = git(["diff", "--cached", "--name-only"])
    .split("\n")
    .filter(Boolean);
  const unstaged = git(["diff", "--name-only"])
    .split("\n")
    .filter(Boolean);
  const untracked = git(["ls-files", "--others", "--exclude-standard"])
    .split("\n")
    .filter(Boolean);

  assertOnlyArtifactChanged({ staged, unstaged, untracked });

  if (!staged.includes(PUBLIC_ARTIFACT_PATH)) {
    git(["add", "--", PUBLIC_ARTIFACT_PATH]);
  }

  git(["commit", "-m", commitMessage]);

  if (push) {
    git(["push"]);
  }
};

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    commitPublicArtifact({
      push: process.argv.includes("--push"),
    });
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
