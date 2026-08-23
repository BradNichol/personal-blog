const REDACTED = "[redacted]";
const URL_PATTERN = /\b(?:https?:\/\/|www\.)\S+/giu;
const PATH_PATTERN = /(?:^|[\s([{"'])((?:\.\.?\/|[A-Za-z0-9_.-]+\/)+[^\s)\]}"']+)/gu;
const FILENAME_PATTERN = /\b[\w-]+\.(?:java|js|mjs|ts|tsx|jsx|py|go|rb|rs|sql|xml|json|ya?ml|md|gradle)\b/giu;
const BRANCH_PATTERN = /\b(?:feature|bugfix|hotfix|chore|release|task|refactor)\/[A-Za-z0-9._-]+\b/giu;
const IDENTIFIER_PATTERN = /(?:#|\b(?:GH|PR)-)\d+\b|\b[0-9a-f]{7,40}\b|\b[0-9a-f]{8}-[0-9a-f-]{27,35}\b/giu;
const TICKET_PATTERN = /\b[A-Z]{2,10}-\d{1,8}\b/giu;
const DOMAIN_PATTERN = /\b(?:[a-z0-9-]+\.)+(?:com|co\.uk|org|net|io|dev|internal|local|example|invalid)\b/giu;
const EXACT_COUNT_PATTERN = /\b\d[\d,.]*\s*(?:files?|lines?|commits?|pull requests?|records?|events?|items?|endpoints?)\b/iu;
const WORDED_COUNT_PATTERN = /\b(?:one|two|three|four|five|six|seven|eight|nine|ten)\s+(?:files?|lines?|commits?|pull requests?|records?|events?|items?|endpoints?)\b/iu;
const STANDALONE_NUMBER_PATTERN = /\b\d[\d,.]*\b/u;
const FIRST_PERSON_PATTERN = /\b(?:i|me|my|mine|our|ours|we|us|we're|i'm)\b/iu;
const UNSUPPORTED_CLAIM_PATTERN = /\b(?:guarantee[ds]?|ensur(?:e|es|ed|ing)|always|never|completely|perfectly|zero defects?|no (?:known )?issues?)\b/iu;
const AMBIGUOUS_PATTERN = /\b(?:maybe|might|could|possibly|potentially|probably|likely|appear(?:s|ed)?|seem(?:s|ed)?|perhaps|tbd|todo|wip|explor(?:e|ed|ing))\b/iu;
const SOURCE_CODE_PATTERN = /\b(?:const|let|var|function|class|interface|import|export|return|public|private|protected)\s+[A-Za-z_$][\w$]*(?:\s*(?:=|\(|\{|;)|\s+from\b)/giu;
const ASSIGNMENT_PATTERN = /\b[A-Za-z_$][\w$]*\s*(?:=|=>|===|!==)\s*[A-Za-z_$'"0-9]/giu;
const NUMBER_PATTERN = /\b\d[\d,.]*\b/gu;

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const normalizePrivateTerms = (privateTerms) => (
  Array.isArray(privateTerms)
    ? privateTerms
      .filter((term) => typeof term === "string")
      .map((term) => term.trim())
      .filter(Boolean)
    : []
);

const matches = (pattern, value) => {
  pattern.lastIndex = 0;
  return pattern.test(value);
};

const containsPrivateTerm = (value, privateTerms) => {
  const normalizedValue = value.toLocaleLowerCase();
  return normalizePrivateTerms(privateTerms)
    .some((term) => normalizedValue.includes(term.toLocaleLowerCase()));
};

export const hasUnsafeText = (value, privateTerms = []) => (
  matches(URL_PATTERN, value)
  || matches(PATH_PATTERN, value)
  || matches(FILENAME_PATTERN, value)
  || matches(BRANCH_PATTERN, value)
  || matches(IDENTIFIER_PATTERN, value)
  || matches(TICKET_PATTERN, value)
  || matches(DOMAIN_PATTERN, value)
  || EXACT_COUNT_PATTERN.test(value)
  || WORDED_COUNT_PATTERN.test(value)
  || STANDALONE_NUMBER_PATTERN.test(value)
  || FIRST_PERSON_PATTERN.test(value)
  || UNSUPPORTED_CLAIM_PATTERN.test(value)
  || AMBIGUOUS_PATTERN.test(value)
  || matches(SOURCE_CODE_PATTERN, value)
  || matches(ASSIGNMENT_PATTERN, value)
  || value.includes("?")
  || value.includes("<")
  || value.includes(">")
  || containsPrivateTerm(value, privateTerms)
);

export const redactText = (value, privateTerms = []) => {
  let result = typeof value === "string" ? value : "";

  for (const term of normalizePrivateTerms(privateTerms)) {
    result = result.replace(new RegExp(escapeRegExp(term), "giu"), REDACTED);
  }

  return result
    .replace(URL_PATTERN, REDACTED)
    .replace(BRANCH_PATTERN, REDACTED)
    .replace(PATH_PATTERN, REDACTED)
    .replace(FILENAME_PATTERN, REDACTED)
    .replace(IDENTIFIER_PATTERN, REDACTED)
    .replace(TICKET_PATTERN, REDACTED)
    .replace(DOMAIN_PATTERN, REDACTED)
    .replace(SOURCE_CODE_PATTERN, REDACTED)
    .replace(ASSIGNMENT_PATTERN, REDACTED)
    .replace(NUMBER_PATTERN, REDACTED)
    .replace(/\s+/gu, " ")
    .trim();
};
