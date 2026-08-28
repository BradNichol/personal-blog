import { APPROVED_TAGS, ROLLING_WINDOW_DAYS, isCalendarDate } from "./contract.mjs";

const VALID_SIZE_BUCKETS = new Set(["small", "medium", "large"]);
const SAFE_LANGUAGE_PATTERN = /^[A-Za-z][A-Za-z0-9+#.-]{0,30}$/u;
const TARGET_BRANCH = "master";

const toCalendarDate = (value) => {
  if (typeof value !== "string") {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  const date = parsed.toISOString().slice(0, 10);
  return isCalendarDate(date) ? date : null;
};

const dateAtUtcMidnight = (date) => new Date(`${date}T00:00:00Z`);

const readRepositoryName = (activity) => {
  if (typeof activity.repository === "string") {
    return activity.repository;
  }

  if (typeof activity.repositoryName === "string") {
    return activity.repositoryName;
  }

  if (typeof activity.repositoryFullName === "string") {
    return activity.repositoryFullName;
  }

  if (activity.repository && typeof activity.repository.fullName === "string") {
    return activity.repository.fullName;
  }

  return null;
};

const readAuthorLogin = (activity) => {
  if (typeof activity.authorLogin === "string") {
    return activity.authorLogin;
  }

  if (activity.author && typeof activity.author.login === "string") {
    return activity.author.login;
  }

  if (activity.user && typeof activity.user.login === "string") {
    return activity.user.login;
  }

  return null;
};

const readTargetBranch = (activity) => {
  if (typeof activity.targetBranch === "string") {
    return activity.targetBranch;
  }

  if (typeof activity.baseRef === "string") {
    return activity.baseRef;
  }

  if (activity.base && typeof activity.base.ref === "string") {
    return activity.base.ref;
  }

  return null;
};

const readLabels = (labels) => {
  if (!Array.isArray(labels)) {
    return [];
  }

  return [...new Set(labels
    .map((label) => (typeof label === "string" ? label : label?.name))
    .filter((label) => APPROVED_TAGS.includes(label)))];
};

const readLanguage = (language) => (
  typeof language === "string" && SAFE_LANGUAGE_PATTERN.test(language)
    ? language
    : undefined
);

const classifyChangeSize = (activity) => {
  if (VALID_SIZE_BUCKETS.has(activity.sizeBucket)) {
    return activity.sizeBucket;
  }

  const hasChangeMetrics = [activity.additions, activity.deletions, activity.changedFiles]
    .some((value) => Number.isFinite(value));
  if (!hasChangeMetrics) {
    return "medium";
  }

  const additions = Number.isFinite(activity.additions) ? activity.additions : 0;
  const deletions = Number.isFinite(activity.deletions) ? activity.deletions : 0;
  const changedFiles = Number.isFinite(activity.changedFiles) ? activity.changedFiles : 0;
  const changedLines = additions + deletions;

  if (changedFiles <= 3 && changedLines <= 50) {
    return "small";
  }

  if (changedFiles <= 10 && changedLines <= 300) {
    return "medium";
  }

  return "large";
};

const isInWindow = (date, asOf, windowDays) => {
  const activityDate = dateAtUtcMidnight(date);
  const latestDate = dateAtUtcMidnight(asOf);
  const earliestDate = new Date(latestDate);
  earliestDate.setUTCDate(earliestDate.getUTCDate() - (windowDays - 1));

  return activityDate >= earliestDate && activityDate <= latestDate;
};

export const selectEligiblePullRequests = (activities, options = {}) => {
  const {
    asOf,
    authorLogin,
    repositoryAllowlist = [],
  } = options;

  if (!isCalendarDate(asOf)
    || typeof authorLogin !== "string"
    || !Array.isArray(repositoryAllowlist)) {
    return [];
  }

  const allowlistedRepositories = new Set(repositoryAllowlist.filter(
    (repository) => typeof repository === "string",
  ));

  return (Array.isArray(activities) ? activities : [])
    .filter((activity) => activity?.type === "pull_request")
    .filter((activity) => readAuthorLogin(activity) === authorLogin)
    .filter((activity) => readRepositoryName(activity) !== null
      && allowlistedRepositories.has(readRepositoryName(activity)))
    .filter((activity) => readTargetBranch(activity) === TARGET_BRANCH)
    .filter((activity) => activity.merged !== false && activity.mergedAt)
    .map((activity) => ({
      activity,
      date: toCalendarDate(activity.mergedAt),
    }))
    .filter(({ date }) => date && isInWindow(date, asOf, ROLLING_WINDOW_DAYS))
    .filter(({ activity }) => typeof activity.title === "string"
      && activity.title.trim().length > 0)
    .map(({ activity, date }) => {
      const description = typeof activity.body === "string" ? activity.body.trim() : "";

      return {
        date,
        sourceKey: typeof activity.sourceKey === "string" ? activity.sourceKey : undefined,
        title: activity.title.trim(),
        description,
        labels: readLabels(activity.labels),
        language: readLanguage(activity.language),
        sizeBucket: classifyChangeSize(activity),
      };
    })
    .sort((left, right) => right.date.localeCompare(left.date));
};

export const aggregateRelatedActivity = (activities) => {
  return (Array.isArray(activities) ? activities : [])
    .map((activity) => ({
      theme: activity.labels?.length > 0
        ? activity.labels
        : activity.language
          ? [activity.language]
          : ["General engineering"],
      sourceKeys: typeof activity.sourceKey === "string" && activity.sourceKey.length > 0
        ? [activity.sourceKey]
        : [],
      events: [{
        date: activity.date,
        title: activity.title,
        description: activity.description,
        labels: activity.labels,
        language: activity.language,
        sizeBucket: activity.sizeBucket,
      }],
    }))
    .sort((left, right) => right.events[0].date.localeCompare(left.events[0].date));
};
