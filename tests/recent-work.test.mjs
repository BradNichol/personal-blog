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

test("selectRecentWork returns the latest valid items in date order", () => {
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
      {
        date: "2026-08-17",
        title: "Strengthened boundaries for scheduled work.",
      },
    ],
  );
});

test("selectRecentWork caps the public activity log at six items", () => {
  const items = Array.from({ length: 7 }, (_, index) => ({
    date: `2026-08-${String(24 - index).padStart(2, "0")}`,
    type: "building",
    title: `Activity note ${index + 1}`,
    summary: "A public activity note.",
  }));

  const selected = selectRecentWork({ items });

  assert.equal(selected.length, 6);
  assert.equal(selected.at(-1).title, "Activity note 6");
});

test("renderRecentWork shows every public field and escapes item content", () => {
  const artifact = readFixture("recent-work-one.json");
  artifact.items[0].title = "Improved <safe> processing & review";

  const rendered = renderRecentWork(artifact);

  assert.match(rendered, /23 Aug 2026/);
  assert.match(rendered, /Building/);
  assert.match(rendered, /Improved &lt;safe&gt; processing &amp; review/);
  assert.match(rendered, /Simplified streamed processing for large inputs\./);
  assert.match(rendered, /<span class="tag">Data<\/span>/);
  assert.doesNotMatch(rendered, /<safe>/);
});

test("renderRecentWork supports the editorial production layout", () => {
  const rendered = renderRecentWork(readFixture("recent-work-one.json"), {
    layout: "editorial",
  });

  assert.match(rendered, /class="recent-work-item"/);
  assert.match(rendered, /class="recent-work-tags"/);
  assert.doesNotMatch(rendered, /d-item|d-tags/);
});

test("renderRecentWork displays each supported work type", () => {
  const rendered = renderRecentWork({
    items: [
      {
        date: "2026-08-23",
        type: "building",
        title: "Product change",
        summary: "Changed product behavior.",
      },
      {
        date: "2026-08-22",
        type: "testing",
        title: "Test change",
        summary: "Improved test coverage.",
      },
      {
        date: "2026-08-21",
        type: "maintaining",
        title: "Maintenance change",
        summary: "Improved ongoing maintenance.",
      },
      {
        date: "2026-08-20",
        type: "documenting",
        title: "Documentation change",
        summary: "Improved documentation.",
      },
    ],
  });

  assert.match(rendered, /Building/);
  assert.match(rendered, /Testing/);
  assert.match(rendered, /Maintaining/);
  assert.match(rendered, /Documenting/);
});

test("renderRecentWork displays the expanded tag vocabulary", () => {
  const rendered = renderRecentWork({
    items: [{
      date: "2026-08-23",
      type: "testing",
      title: "Updated screen tests",
      summary: "Grouped tests by screen.",
      tags: ["TypeScript", "Testing", "Refactoring"],
    }],
  });

  assert.match(rendered, /<span class="tag">TypeScript<\/span>/);
  assert.match(rendered, /<span class="tag">Testing<\/span>/);
  assert.match(rendered, /<span class="tag">Refactoring<\/span>/);
});

test("renderRecentWork supports zero, one, and four item artifacts", () => {
  const empty = renderRecentWork(readFixture("recent-work-empty.json"));
  const one = renderRecentWork(readFixture("recent-work-one.json"));
  const three = renderRecentWork(readFixture("recent-work-three.json"));

  assert.match(empty, /No recent work to share right now\./);
  assert.equal((empty.match(/<article class="activity-item">/g) ?? []).length, 0);
  assert.equal((one.match(/<article class="activity-item">/g) ?? []).length, 1);
  assert.equal((three.match(/<article class="activity-item">/g) ?? []).length, 4);
  assert.doesNotMatch(one, /Architecture/);
});

test("renderRecentWork only shows approved tags and caps them at three", () => {
  const rendered = renderRecentWork({
    items: [
      {
        date: "2026-08-23",
        type: "building",
        title: "Kept public labels consistent",
        summary: "Used the approved vocabulary for the public projection.",
        tags: ["Java", "Uncontrolled", "Architecture", "Data", "Streaming", "Refactoring"],
      },
    ],
  });

  assert.match(rendered, /<span class="tag">Java<\/span>/);
  assert.match(rendered, /<span class="tag">Architecture<\/span>/);
  assert.match(rendered, /<span class="tag">Data<\/span>/);
  assert.doesNotMatch(rendered, /Uncontrolled|Streaming/);
  assert.equal((rendered.match(/class="tag"/g) ?? []).length, 3);
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
      {
        date: "2026-08-20",
        type: "learning",
        title: "Future activity type",
        summary: "Should not render in v1",
      },
    ],
  });

  assert.deepEqual(selected.map(({ title }) => title), ["Valid item"]);
});
