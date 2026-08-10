import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";

const siteUrl = new URL("../site/", import.meta.url);

test("homepage checks AI HOT directly while archives stay fixed snapshots", async () => {
  const homepage = await readFile(new URL("index.html", siteUrl), "utf8");
  const archiveFiles = (await readdir(new URL("archive/", siteUrl)))
    .filter((name) => /^\d{4}-\d{2}-\d{2}\.html$/.test(name))
    .sort()
    .reverse();
  const latestArchive = await readFile(new URL(`archive/${archiveFiles[0]}`, siteUrl), "utf8");

  assert.match(homepage, /<body[^>]*data-live-refresh/);
  assert.match(homepage, /data-report-date="\d{4}-\d{2}-\d{2}"/);
  assert.match(homepage, /id="sync-status"/);
  assert.match(homepage, /id="refresh-button"/);
  assert.match(homepage, /https:\/\/aihot\.virxact\.com\/api\/v1\/dailies\/latest/);
  assert.match(homepage, /cache:"no-store"/);
  assert.doesNotMatch(homepage, /API_URL\+"\?ts="/);
  assert.match(homepage, /addEventListener\("pageshow"/);
  assert.match(homepage, /addEventListener\("visibilitychange"/);
  assert.match(homepage, /checkLatest=async\(force=false,reveal=false\)/);
  assert.match(homepage, /checkLatest\(true,true\)/);
  assert.match(homepage, /共"\+latestTotal\+"条"/);
  assert.match(homepage, /scrollIntoView\(\{behavior:"smooth",block:"start"\}\)/);
  assert.doesNotMatch(latestArchive, /data-live-refresh/);
});

test("generated homepage remains a self-contained five-section dashboard", async () => {
  const homepage = await readFile(new URL("index.html", siteUrl), "utf8");

  assert.doesNotMatch(homepage, /<script[^>]+src=/i);
  assert.doesNotMatch(homepage, /<link[^>]+rel=["']stylesheet["']/i);
  assert.doesNotMatch(homepage, /\.total span\{display:block/);
  assert.match(homepage, /\.total>span\{display:block/);
  assert.equal((homepage.match(/class="daily-section"/g) ?? []).length, 5);
  assert.match(homepage, /target="_blank" rel="noopener noreferrer"/);
});
