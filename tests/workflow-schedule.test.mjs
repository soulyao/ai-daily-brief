import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const workflowUrl = new URL("../.github/workflows/daily.yml", import.meta.url);

test("news updates every two hours with additional morning retries", async () => {
  const workflow = await readFile(workflowUrl, "utf8");
  const schedules = [...workflow.matchAll(/-\s+cron:\s*["']([^"']+)["']/g)]
    .map((match) => match[1]);

  assert.equal(
    schedules.length,
    3,
    `expected three morning schedule attempts, found ${schedules.length}: ${schedules.join(", ")}`,
  );
  assert.equal(new Set(schedules).size, 3, "morning schedule attempts must be unique");
  assert.ok(schedules.includes('17 */2 * * *'), 'update throughout the day');
  assert.ok(schedules.includes('47 0 * * *'), 'retry at 08:47 Beijing');
  assert.ok(schedules.includes('17 1 * * *'), 'retry at 09:17 Beijing');
  assert.match(workflow, /node scripts\/collect-news\.mjs/);
  assert.match(workflow, /git add site\/index\.html site\/ai\.html site\/latest\.json site\/archive/);
});
