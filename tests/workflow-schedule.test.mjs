import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const workflowUrl = new URL("../.github/workflows/daily.yml", import.meta.url);

test("morning update has three staggered schedule attempts", async () => {
  const workflow = await readFile(workflowUrl, "utf8");
  const schedules = [...workflow.matchAll(/-\s+cron:\s*["']([^"']+)["']/g)]
    .map((match) => match[1]);

  assert.equal(
    schedules.length,
    3,
    `expected three morning schedule attempts, found ${schedules.length}: ${schedules.join(", ")}`,
  );
  assert.equal(new Set(schedules).size, 3, "morning schedule attempts must be unique");
});
