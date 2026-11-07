const { chromium } = require("playwright");
const assert = require("node:assert/strict");

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1500, height: 1100 } });
    await page.goto("http://127.0.0.1:6080/vnc.html?autoconnect=1&resize=scale");
    await page.waitForFunction(() => {
      const canvas = document.querySelector("canvas");
      if (!canvas || canvas.width < 500 || canvas.height < 500) return false;
      const data = canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height).data;
      let yellow = 0, pink = 0;
      for (let i = 0; i < data.length; i += 64) {
        const [r, g, b] = data.slice(i, i + 3);
        if (r > 220 && g > 180 && b < 200) yellow++;
        if (r > 200 && g > 90 && g < 190 && b > 90 && b < 190) pink++;
      }
      return yellow > 1000 && pink > 1000;
    }, undefined, { timeout: 60000 });
    assert.equal(await page.locator("canvas").count(), 1);
    await page.screenshot({ path: "docker-smoke.png" });
    console.log("PASS: noVNC renders the VJOBE desktop with loaded visual assets");
  } finally { await browser.close(); }
})().catch((error) => { console.error(error); process.exitCode = 1; });
