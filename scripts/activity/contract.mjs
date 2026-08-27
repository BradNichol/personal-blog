import { hasUnsafeText } from "./text.mjs";

export const PUBLIC_ARTIFACT_VERSION = 1;
export const PUBLIC_ACTIVITY_TYPES = Object.freeze([
  "building",
  "testing",
  "maintaining",
  "documenting",
]);
export const APPROVED_TAGS = Object.freeze([
  "Architecture",
  "Data",
  "Java",
  "TypeScript",
  "Testing",
  "Refactoring",
]);

export const MAX_PUBLIC_ITEMS = 7;
export const MAX_TITLE_LENGTH = 90;
export const MAX_SUMMARY_LENGTH = 240;
export const MAX_TAGS = 3;
export const ROLLING_WINDOW_DAYS = 30;

const CALENDAR_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const isObject = (value) => value !== null
  && typeof value === "object"
  && !Array.isArray(value);

export const isCalendarDate = (value) => {
  if (typeof value !== "string" || !CALENDAR_DATE_PATTERN.test(value)) {
    return false;
  }

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day;
};

const addCalendarDays = (value, days) => {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

export const earliestActivityDate = (asOf) => (
  isCalendarDate(asOf) ? addCalendarDays(asOf, -(ROLLING_WINDOW_DAYS - 1)) : undefined
);

const validateText = (value, field, maximum, denylist) => {
  const errors = [];

  if (typeof value !== "string" || value.trim().length === 0) {
    errors.push(`${field}-missing`);
    return errors;
  }

  if (value.length > maximum) {
    errors.push(`${field}-too-long`);
  }

  if (value !== value.trim() || /[\u0000-\u001f\u007f\n\r]/u.test(value)) {
    errors.push(`${field}-format`);
  }

  if (hasUnsafeText(value, denylist)) {
    errors.push(`${field}-unsafe`);
  }

  return errors;
};

const hasOnlyAllowedKeys = (value, allowedKeys) => (
  Object.keys(value).every((key) => allowedKeys.includes(key))
);

export const validatePublicCandidate = (candidate, options = {}) => {
  const { denylist = [], latestDate, earliestDate } = options;
  const errors = [];

  if (!isObject(candidate)) {
    return { valid: false, errors: ["candidate-shape"] };
  }

  if (!hasOnlyAllowedKeys(candidate, ["date", "type", "title", "summary", "tags"])) {
    errors.push("candidate-fields");
  }

  if (!isCalendarDate(candidate.date)) {
    errors.push("date-format");
  } else if (latestDate && isCalendarDate(latestDate) && candidate.date > latestDate) {
    errors.push("date-future");
  } else if (earliestDate && isCalendarDate(earliestDate) && candidate.date < earliestDate) {
    errors.push("date-stale");
  }

  if (!PUBLIC_ACTIVITY_TYPES.includes(candidate.type)) {
    errors.push("type-unsupported");
  }

  errors.push(...validateText(candidate.title, "title", MAX_TITLE_LENGTH, denylist));
  errors.push(...validateText(candidate.summary, "summary", MAX_SUMMARY_LENGTH, denylist));

  if (candidate.tags !== undefined) {
    if (!Array.isArray(candidate.tags)) {
      errors.push("tags-shape");
    } else {
      if (candidate.tags.length > MAX_TAGS) {
        errors.push("tags-too-many");
      }

      if (new Set(candidate.tags).size !== candidate.tags.length) {
        errors.push("tags-duplicate");
      }

      if (candidate.tags.some((tag) => !APPROVED_TAGS.includes(tag))) {
        errors.push("tags-unsupported");
      }
    }
  }

  return { valid: errors.length === 0, errors };
};

export const validatePublicArtifact = (artifact, options = {}) => {
  const { denylist = [] } = options;
  const errors = [];

  if (!isObject(artifact)) {
    return { valid: false, errors: ["artifact-shape"] };
  }

  if (!hasOnlyAllowedKeys(artifact, ["version", "updatedAt", "items"])) {
    errors.push("artifact-fields");
  }

  if (artifact.version !== PUBLIC_ARTIFACT_VERSION) {
    errors.push("version-unsupported");
  }

  if (!isCalendarDate(artifact.updatedAt)) {
    errors.push("updated-at-format");
  }

  if (!Array.isArray(artifact.items)) {
    errors.push("items-shape");
  } else {
    const earliestDate = isCalendarDate(artifact.updatedAt)
      ? addCalendarDays(artifact.updatedAt, -(ROLLING_WINDOW_DAYS - 1))
      : undefined;
    if (artifact.items.length > MAX_PUBLIC_ITEMS) {
      errors.push("items-too-many");
    }

    const seenItems = new Set();
    artifact.items.forEach((item) => {
      const result = validatePublicCandidate(item, {
        denylist,
        latestDate: artifact.updatedAt,
        earliestDate,
      });

      errors.push(...result.errors);

      const identity = JSON.stringify(item);
      if (seenItems.has(identity)) {
        errors.push("items-duplicate");
      }
      seenItems.add(identity);
    });
  }

  return { valid: errors.length === 0, errors };
};

export const createPublicArtifact = ({ asOf, candidates, denylist = [] }) => {
  if (!isCalendarDate(asOf)) {
    throw new Error("Cannot create an artifact with an invalid calendar date");
  }

  const accepted = (Array.isArray(candidates) ? candidates : [])
    .filter((candidate) => validatePublicCandidate(candidate, {
      denylist,
      latestDate: asOf,
      earliestDate: earliestActivityDate(asOf),
    }).valid)
    .sort((left, right) => right.date.localeCompare(left.date))
    .filter((candidate, index, allCandidates) => (
      allCandidates.findIndex((other) => JSON.stringify(other) === JSON.stringify(candidate)) === index
    ))
    .slice(0, MAX_PUBLIC_ITEMS);

  const artifact = {
    version: PUBLIC_ARTIFACT_VERSION,
    updatedAt: asOf,
    items: accepted,
  };

  const result = validatePublicArtifact(artifact, { denylist });
  if (!result.valid) {
    throw new Error("Generated artifact failed deterministic validation");
  }

  return artifact;
};
