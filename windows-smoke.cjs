const { _electron: electron } = require("playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");

async function main() {
  const profile = await fs.mkdtemp(path.join(os.tmpdir(), "vjobe-smoke-"));
  const executablePath = process.env.VJOBE_TEST_EXECUTABLE || path.join(__dirname, "dist", "win-unpacked", "VJOBE Community.exe");
  const desktop = await electron.launch({ executablePath, args: ["--user-data-dir=" + profile] });
  try {
    const page = await desktop.firstWindow();
    page.setDefaultTimeout(15000);
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    async function checkImages() {
      await page.waitForFunction(() => Array.from(document.images).every((image) => image.complete && image.naturalWidth > 0));
    }
    assert.equal(await fs.realpath(await desktop.evaluate(({ app }) => app.getPath("userData"))), await fs.realpath(profile));
    const initial = await page.evaluate(() => ({ applications: state.applications, saved: state.savedVacancies, events: state.events, user: state.user }));
    assert.deepEqual(initial.applications, []);
    assert.deepEqual(initial.saved, []);
    assert.deepEqual(initial.events, []);
    assert.equal(initial.user.cv, "");
    for (const route of ["statistics", "saved", "data", "calendar", "applications"]) {
      await page.locator(`[data-route="${route}"]`).click();
      await checkImages();
    }
    await page.locator("[data-add-company]").click();
    await page.locator('[data-app-field="company"]').fill("Synthetic Windows Test");
    await page.locator('[data-app-field="notes"]').fill("Test note");
    await page.locator("[data-save-application]").click();
    await page.reload();
    await page.locator("[data-open-application]").click();
    assert.equal(await page.locator('[data-app-field="company"]').inputValue(), "Synthetic Windows Test");
    const source = path.join(profile, "source.txt");
    const destination = path.join(profile, "download.txt");
    await fs.writeFile(source, "Synthetic attachment");
    await desktop.evaluate(({ dialog }, { source, destination }) => {
      dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [source] });
      dialog.showSaveDialog = async () => ({ canceled: false, filePath: destination });
    }, { source, destination });
    await page.locator("[data-add-file]").click();
    await page.getByRole("button", { name: "Download source.txt", exact: true }).click();
    // Download runs through asynchronous IPC; retry only while the destination is absent.
    for (let attempt = 0; attempt < 50; attempt++) {
      try { if (await fs.readFile(destination, "utf8") === "Synthetic attachment") break; }
      catch (error) { if (error.code !== "ENOENT") throw error; }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    assert.equal(await fs.readFile(destination, "utf8"), "Synthetic attachment");
    await page.screenshot({ path: "dist/windows-smoke.png" });
    assert.deepEqual(errors, []);
    console.log("PASS: isolated empty profile, navigation, persistence, attachment upload/download");
  } finally {
    await desktop.close();
    await fs.rm(profile, { recursive: true, force: true });
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
