import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { join } from "node:path";
import {
  renderRecentWork,
  selectRecentWork,
} from "../public/scripts/recent-work.js";

const fixturesDirectory = join(process.cwd(), "tests", "fixtures");

const readFixture = (name) => JSON.parse(
  readFileSync(join(fixturesDirectory, name), "utf8"),
);

test("selectRecentWork returns the latest three valid items in date order", () => {
  const selected = selectRecentWork(readFixture("recent-work-three.json"));

  assert.deepEqual(
    selected.map(({ date, title }) => ({ date, title })),
    [
      {
        date: "2026-08-23",
        title: "Refined boundaries around external data providers.",
      },
      {
        date: "2026-08-21",
        title: "Improved large-file processing in a Java service.",
      },
      {
        date: "2026-08-20",
        title: "Simplified reconciliation for imported activity data.",
      },
    ],
  );
});

test("renderRecentWork shows every public field and escapes item content", () => {
  const artifact = readFixture("recent-work-one.json");
  artifact.items[0].title = "Improved <safe> processing & review";

  const rendered = renderRecentWork(artifact);

  assert.match(rendered, /23 Aug 2026/);
  assert.match(rendered, /Building/);
  assert.match(rendered, /Improved &lt;safe&gt; processing &amp; review/);
  assert.match(rendered, /Simplified streamed processing for large inputs\./);
  assert.match(rendered, /<span class="tag">Streaming<\/span>/);
  assert.doesNotMatch(rendered, /<safe>/);
});

test("renderRecentWork supports zero, one, and three item artifacts", () => {
  const empty = renderRecentWork(readFixture("recent-work-empty.json"));
  const one = renderRecentWork(readFixture("recent-work-one.json"));
  const three = renderRecentWork(readFixture("recent-work-three.json"));

  assert.match(empty, /No recent work to share right now\./);
  assert.equal((empty.match(/<article class="activity-item">/g) ?? []).length, 0);
  assert.equal((one.match(/<article class="activity-item">/g) ?? []).length, 1);
  assert.equal((three.match(/<article class="activity-item">/g) ?? []).length, 3);
  assert.doesNotMatch(one, /Architecture/);
});

test("selectRecentWork ignores malformed or uncontrolled items", () => {
  const selected = selectRecentWork({
    items: [
      {
        date: "2026-08-23",
        type: "building",
        title: "Valid item",
        summary: "Valid summary",
      },
      {
        date: "2026-08-22T15:00:00Z",
        type: "building",
        title: "Has a time",
        summary: "Should not render",
      },
      {
        date: "2026-08-21",
        type: "shipping",
        title: "Uncontrolled type",
        summary: "Should not render",
      },
    ],
  });

  assert.deepEqual(selected.map(({ title }) => title), ["Valid item"]);
});
