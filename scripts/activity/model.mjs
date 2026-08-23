import { hasUnsafeText, redactText } from "./text.mjs";
import { APPROVED_TAGS, isCalendarDate } from "./contract.mjs";

const VALID_SIZE_BUCKETS = new Set(["small", "medium", "large"]);
const SAFE_LANGUAGE_PATTERN = /^[A-Za-z][A-Za-z0-9+#.-]{0,30}$/u;

export const MODEL_INSTRUCTIONS = "Return a JSON object with an items array. "
  + "Aggregate related events into three to seven high-level building themes when the source supports it. "
  + "Use concise neutral completed-outcome language and only the approved labels as tags. "
  + "Do not include source-control, repository, personal, URL, path, identifier, or exact-count details.";

const safeTheme = (theme) => (Array.isArray(theme) ? theme : [])
  .filter((value) => typeof value === "string" && value.trim().length > 0)
  .filter((value) => value.length <= 40)
  .filter((value) => !hasUnsafeText(value))
  .map((value) => value.trim());

const safeLabels = (labels) => (Array.isArray(labels) ? labels : [])
  .filter((label) => APPROVED_TAGS.includes(label));

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
      labels: safeLabels(event.labels),
      language: safeLanguage(event.language),
      sizeBucket: VALID_SIZE_BUCKETS.has(event.sizeBucket) ? event.sizeBucket : undefined,
    })),
  })),
});

export const createHostedLanguageModelAdapter = ({
  provider,
  endpoint,
  apiKey,
  policy,
  fetchImpl = globalThis.fetch,
}) => {
  if (typeof provider !== "string" || provider.trim().length === 0) {
    throw new Error("A model provider is required");
  }

  if (typeof endpoint !== "string" || !/^https:\/\//iu.test(endpoint)) {
    throw new Error("The model endpoint must use HTTPS");
  }

  if (typeof apiKey !== "string" || apiKey.length === 0) {
    throw new Error("A model API key is required");
  }

  if (policy?.approved !== true || policy?.noTraining !== true) {
    throw new Error("The model provider must have an approved no-training policy");
  }

  if (policy.provider !== provider || policy.endpoint !== endpoint) {
    throw new Error("The model privacy approval must be bound to this provider and endpoint");
  }

  if (policy.retention !== "minimal") {
    throw new Error("The model provider must have an approved minimal-retention policy");
  }

  if (typeof fetchImpl !== "function") {
    throw new Error("A fetch implementation is required");
  }

  return {
    provider,
    async summarize(input) {
      const response = await fetchImpl(endpoint, {
        method: "POST",
        headers: {
          authorization: `Bearer ${apiKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ provider, input }),
      });

      if (!response.ok) {
        throw new Error(`Model request failed with status ${response.status}`);
      }

      const payload = await response.json();
      return Array.isArray(payload) ? { items: payload } : payload;
    },
  };
};
