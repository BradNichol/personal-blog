const MAX_ITEMS = 3;
const CALENDAR_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const ACTIVITY_TYPE_LABELS = {
  building: "Building",
};
const APPROVED_TAGS = new Set(["Architecture", "Data", "Java", "Streaming"]);

const isCalendarDate = (value) => {
  if (typeof value !== "string" || !CALENDAR_DATE_PATTERN.test(value)) {
    return false;
  }

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day;
};

const isRenderableItem = (item) => item !== null
  && typeof item === "object"
  && isCalendarDate(item.date)
  && Object.prototype.hasOwnProperty.call(ACTIVITY_TYPE_LABELS, item.type)
  && typeof item.title === "string"
  && item.title.trim().length > 0
  && typeof item.summary === "string"
  && item.summary.trim().length > 0;

const normalizeTags = (tags) => {
  if (!Array.isArray(tags)) {
    return [];
  }

  return [...new Set(tags)]
    .filter((tag) => APPROVED_TAGS.has(tag))
    .slice(0, 3);
};

export const selectRecentWork = (artifact) => {
  const items = Array.isArray(artifact?.items) ? artifact.items : [];

  return items
    .filter(isRenderableItem)
    .sort((left, right) => right.date.localeCompare(left.date))
    .slice(0, MAX_ITEMS)
    .map((item) => ({ ...item, tags: normalizeTags(item.tags) }));
};

const escapeHtml = (value) => String(value)
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#039;");

const formatCalendarDate = (value) => new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
}).format(new Date(`${value}T00:00:00Z`));

const renderTags = (tags) => {
  if (tags.length === 0) {
    return "";
  }

  return `<div class="tag-list">${tags
    .map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`)
    .join("")}</div>`;
};

const renderItem = (item) => `
  <article class="activity-item">
    <div class="activity-meta">
      <time class="date" datetime="${escapeHtml(item.date)}">${escapeHtml(formatCalendarDate(item.date))}</time>
      <span class="kind">${escapeHtml(ACTIVITY_TYPE_LABELS[item.type])}</span>
    </div>
    <div class="activity-content">
      <h3>${escapeHtml(item.title)}</h3>
      <p class="activity-summary">${escapeHtml(item.summary)}</p>
      ${renderTags(item.tags)}
    </div>
  </article>`;

const renderFieldSignalTags = (tags) => {
  if (tags.length === 0) {
    return "";
  }

  return `<div class="d-tags">${tags
    .map((tag) => `<span>${escapeHtml(tag)}</span>`)
    .join("")}</div>`;
};

const renderFieldSignalItem = (item, index) => `
  <article class="d-item">
    <div class="d-item-number">${String(index + 1).padStart(2, "0")}</div>
    <div class="d-item-content">
      <h3>${escapeHtml(item.title)}</h3>
      <p>${escapeHtml(item.summary)}</p>
      ${renderFieldSignalTags(item.tags)}
    </div>
    <div class="d-item-meta">
      <time class="d-item-date" datetime="${escapeHtml(item.date)}">${escapeHtml(formatCalendarDate(item.date))}</time>
      <span class="d-item-kind">${escapeHtml(ACTIVITY_TYPE_LABELS[item.type])}</span>
    </div>
  </article>`;

const renderFieldSignalWork = (artifact) => {
  const items = selectRecentWork(artifact);

  if (items.length === 0) {
    return '<p class="d-empty">No recent work to share right now.</p>';
  }

  return `<div class="d-items">${items.map(renderFieldSignalItem).join("")}\n</div>`;
};

export const renderRecentWork = (artifact, options = {}) => {
  if (options.variant === "field-signal") {
    return renderFieldSignalWork(artifact);
  }

  const items = selectRecentWork(artifact);

  if (items.length === 0) {
    return '<p class="activity-empty">No recent work to share right now.</p>';
  }

  return `<div class="activity-list">${items.map(renderItem).join("")}\n</div>`;
};

const renderUnavailable = (variant) => variant === "field-signal"
  ? '<p class="d-empty">Recent work is temporarily unavailable.</p>'
  : '<p class="activity-empty">Recent work is temporarily unavailable.</p>';

const updateRecentWork = async () => {
  const container = document.querySelector("[data-recent-work]");

  if (!container) {
    return;
  }

  const variant = container.dataset.recentWorkVariant;

  try {
    const response = await fetch("/data/recent-work.json");

    if (!response.ok) {
      throw new Error(`Recent work request failed with ${response.status}`);
    }

    const artifact = await response.json();
    container.innerHTML = renderRecentWork(artifact, { variant });

    const updatedAt = document.querySelector("[data-recent-work-updated]");
    if (updatedAt && isCalendarDate(artifact?.updatedAt)) {
      updatedAt.textContent = `Updated ${formatCalendarDate(artifact.updatedAt)}`;
    }
  } catch {
    container.innerHTML = renderUnavailable(variant);
  }
};

if (typeof document !== "undefined") {
  updateRecentWork();
}
