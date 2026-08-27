import { hasUnsafeText, redactText } from "./text.mjs";
import { APPROVED_TAGS, isCalendarDate } from "./contract.mjs";

const VALID_SIZE_BUCKETS = new Set(["small", "medium", "large"]);
const SAFE_LANGUAGE_PATTERN = /^[A-Za-z][A-Za-z0-9+#.-]{0,30}$/u;

export const MODEL_INSTRUCTIONS = "Return a JSON object with an items array. "
  + "Group related events into three to seven simple building themes when the source supports it. "
  + "Write for a general reader in plain English: describe what changed and why it matters in one short sentence. "
  + "Prefer concrete verbs such as added, removed, moved, grouped, fixed, or simplified. "
  + "Avoid buzzwords, vague wording, and internal architecture terms. "
  + "Choose the type that best fits the work: building for product changes, testing for test work, maintaining for refactoring or quality work, and documenting for documentation. "
  + "Use only these approved tags when they fit: Architecture, Data, Java, TypeScript, Testing, and Refactoring. "
  + "Use concise neutral completed-outcome language and only the approved labels as tags. "
  + "Do not include source-control, repository, personal, URL, path, identifier, or exact-count details.";

const safeTheme = (theme) => (Array.isArray(theme) ? theme : [])
  .filter((value) => typeof value === "string" && value.trim().length > 0)
  .filter((value) => value.length <= 40)
  .filter((value) => !hasUnsafeText(value))
  .map((value) => value.trim());

const safeLabels = (labels, language) => [...new Set([
  ...(Array.isArray(labels) ? labels : []),
  language,
])].filter((label) => APPROVED_TAGS.includes(label));

const safeLanguage = (language) => (
  typeof language === "string"
    && SAFE_LANGUAGE_PATTERN.test(language)
    && !hasUnsafeText(language)
    ? language
    : undefined
);

const safeModelText = (value, privateTerms) => {
  const redacted = redactText(value, privateTerms);
  return hasUnsafeText(redacted, privateTerms) ? "" : redacted;
};

const safeDate = (date) => (isCalendarDate(date) ? date : undefined);

export const buildSummarizerInput = (groups, options = {}) => ({
  instructions: MODEL_INSTRUCTIONS,
  groups: (Array.isArray(groups) ? groups : []).map(({ theme, events }) => ({
    theme: safeTheme(theme),
    events: (Array.isArray(events) ? events : []).map((event) => ({
      date: safeDate(event.date),
      title: safeModelText(event.title, [
        ...(options.denylist ?? []),
        ...(options.privateTerms ?? []),
      ]),
      description: safeModelText(event.description, [
        ...(options.denylist ?? []),
        ...(options.privateTerms ?? []),
      ]),
      labels: safeLabels(event.labels, event.language),
      language: safeLanguage(event.language),
      sizeBucket: VALID_SIZE_BUCKETS.has(event.sizeBucket) ? event.sizeBucket : undefined,
    })),
  })),
});
