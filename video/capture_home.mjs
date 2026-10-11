// Re-captures only the two home-page states (after the live counters settle), keeping
// the rest of public/screens untouched. Usage: node capture_home.mjs
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const BASE = "https://d4i9n8m04ddaa.cloudfront.net/";
const OUT = path.resolve("public/screens");
const manifest = JSON.parse(fs.readFileSync(path.join(OUT, "manifest.json"), "utf8"));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });

async function box(locator) {
  const b = await locator.boundingBox();
  return b ? { x: b.x + b.width / 2, y: b.y + b.height / 2, w: b.width, h: b.height } : null;
}

await page.goto(BASE + "#/");
await page.waitForLoadState("networkidle");
await wait(4500);
await page.screenshot({ path: path.join(OUT, "home/000.jpg"), type: "jpeg", quality: 90 });
const first = { file: "home/000.jpg", t: Date.now(), scrollY: 0, target: await box(page.getByRole("button", { name: "Read a filing" }).first()) };
const choose = page.getByRole("button", { name: "Choose PDF" });
await choose.scrollIntoViewIfNeeded();
await page.evaluate(() => window.scrollBy(0, -160));
await wait(2500);
await page.screenshot({ path: path.join(OUT, "home/001.jpg"), type: "jpeg", quality: 90 });
const second = { file: "home/001.jpg", t: Date.now(), scrollY: await page.evaluate(() => window.scrollY), target: await box(choose), click: true };
manifest.shots.home = [first, second];
fs.writeFileSync(path.join(OUT, "manifest.json"), JSON.stringify(manifest, null, 2));
console.log(JSON.stringify(manifest.shots.home));
await browser.close();
