import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { dirname, join, relative, resolve, sep } from "node:path";
import { earliestActivityDate, isCalendarDate } from "./contract.mjs";

export const ACTIVITY_STATE_VERSION = 1;

const defaultStatePath = (environment) => (
  environment.ACTIVITY_STATE_FILE
    || join(environment.XDG_CONFIG_HOME || join(homedir(), ".config"), "personal-blog", "recent-work-state.json")
);

const readJsonFile = (path, missingValue) => {
  if (!existsSync(path)) {
    return missingValue;
  }

  let parsed;
  try {
    parsed = JSON.parse(readFileSync(path, "utf8"));
  } catch {
    throw new Error(`Activity state file is not valid JSON: ${path}`);
  }

  return parsed;
};

const writeJsonAtomically = (path, value) => {
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  const temporaryPath = `${path}.tmp`;
  writeFileSync(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
  renameSync(temporaryPath, path);
};

const normalizeProcessed = (processed) => {
  if (!Array.isArray(processed)) {
    return [];
  }

  return processed
    .filter((entry) => entry
      && typeof entry.key === "string"
      && entry.key.length > 0
      && isCalendarDate(entry.date))
    .map(({ key, date }) => ({ key, date }));
};

const normalizeState = (value) => {
  if (value === null) {
    return {
      version: ACTIVITY_STATE_VERSION,
      initialized: false,
      processed: [],
    };
  }

  if (value?.version !== ACTIVITY_STATE_VERSION || typeof value.initialized !== "boolean") {
    throw new Error("Activity state file has an unsupported shape");
  }

  return {
    version: ACTIVITY_STATE_VERSION,
    initialized: value.initialized,
    processed: normalizeProcessed(value.processed),
  };
};

const normalizePendingRun = (value) => {
  if (value === null) {
    return null;
  }

  if (value?.version !== ACTIVITY_STATE_VERSION
    || !isCalendarDate(value.asOf)
    || !Array.isArray(value.groups)) {
    throw new Error("Pending activity run has an unsupported shape");
  }

  const groups = value.groups
    .filter((group) => group
      && typeof group.groupId === "string"
      && group.groupId.length > 0
      && Array.isArray(group.sources))
    .map((group) => ({
      groupId: group.groupId,
      sources: group.sources
        .filter((source) => source
          && typeof source.key === "string"
          && source.key.length > 0
          && isCalendarDate(source.date))
        .map(({ key, date }) => ({ key, date })),
    }));

  return {
    version: ACTIVITY_STATE_VERSION,
    asOf: value.asOf,
    fullRefresh: value.fullRefresh === true,
    groups,
  };
};

const pruneProcessed = (processed, asOf) => {
  const earliestDate = earliestActivityDate(asOf);
  const seen = new Set();

  return processed
    .filter(({ key, date }) => {
      if (!earliestDate || date < earliestDate || seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    });
};

export const sourceKeyForPullRequest = (repository, number) => createHash("sha256")
  .update(`${repository}#${number}`, "utf8")
  .digest("hex");

export const createActivityStateStore = (environment = process.env) => {
  const statePath = defaultStatePath(environment);
  const pendingPath = `${statePath}.pending`;
  const relativeStatePath = relative(resolve(process.cwd()), resolve(statePath));
  if (relativeStatePath === ""
    || (relativeStatePath !== ".." && !relativeStatePath.startsWith(`..${sep}`))) {
    throw new Error("Activity state must be stored outside the repository");
  }

  return Object.freeze({
    initialize({ processed = [], asOf }) {
      const state = {
        version: ACTIVITY_STATE_VERSION,
        initialized: true,
        processed: pruneProcessed(normalizeProcessed(processed), asOf),
      };
      writeJsonAtomically(statePath, state);
      return state;
    },

    read() {
      return normalizeState(readJsonFile(statePath, null));
    },

    markProcessed(sources, asOf) {
      const current = this.read();
      const processed = [
        ...current.processed,
        ...(Array.isArray(sources) ? sources : []),
      ];
      const next = {
        version: ACTIVITY_STATE_VERSION,
        initialized: true,
        processed: pruneProcessed(normalizeProcessed(processed), asOf),
      };
      writeJsonAtomically(statePath, next);
      return next;
    },

    readPending() {
      return normalizePendingRun(readJsonFile(pendingPath, null));
    },

    writePending(run) {
      writeJsonAtomically(pendingPath, {
        version: ACTIVITY_STATE_VERSION,
        asOf: run.asOf,
        fullRefresh: run.fullRefresh === true,
        groups: run.groups,
      });
    },

    clearPending() {
      if (existsSync(pendingPath)) {
        writeJsonAtomically(pendingPath, null);
      }
    },

    paths: Object.freeze({ statePath, pendingPath }),
  });
};
