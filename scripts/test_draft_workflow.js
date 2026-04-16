const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

(async () => {
  const baseUrl = 'http://127.0.0.1:3000';
  const requestId = 1;
  const draftSlides = [4, 5, 6];
  const outDir = '/home/ubuntu/cccd-vc-intake-inspect/test-artifacts';
  fs.mkdirSync(outDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
  await context.addInitScript(({ requestId, draftSlides }) => {
    window.localStorage.setItem(
      `vc-draft-deck:${requestId}`,
      JSON.stringify({ slide_numbers: draftSlides, updated_at: new Date().toISOString() })
    );
  }, { requestId, draftSlides });

  const page = await context.newPage();
  const results = {
    builder_loaded_draft: false,
    present_button_visible: false,
    presenter_loaded_draft: false,
    summary_slide_visible_at_end: false,
    builder_retained_draft_after_return: false,
    details: {}
  };

  try {
    await page.goto(`${baseUrl}/staff/${requestId}/deck`, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.getByText('Patient Deck (3 slides)').waitFor({ timeout: 15000 });
    await page.screenshot({ path: path.join(outDir, 'builder_loaded.png'), fullPage: true });

    const builderText = await page.locator('body').innerText();
    results.details.builder_text_excerpt = builderText.slice(0, 1200);
    results.builder_loaded_draft = builderText.includes('Patient Deck (3 slides)');
    results.present_button_visible = (await page.getByRole('link', { name: /present/i }).count()) > 0;

    await page.getByRole('link', { name: /present/i }).first().click();
    await page.waitForURL(`**/staff/${requestId}/deck/present`);
    await page.waitForLoadState('domcontentloaded');
    await page.screenshot({ path: path.join(outDir, 'presenter_start.png'), fullPage: true });

    const counterAtStart = await page.locator('header').innerText();
    results.details.presenter_header_start = counterAtStart;
    results.presenter_loaded_draft = /1\s*\/\s*[0-9]+/.test(counterAtStart) && !counterAtStart.includes('No deck assigned');

    for (let i = 0; i < draftSlides.length; i += 1) {
      await page.keyboard.press('ArrowRight');
      await page.waitForTimeout(150);
    }

    await page.screenshot({ path: path.join(outDir, 'presenter_summary.png'), fullPage: true });
    const presenterText = await page.locator('body').innerText();
    results.details.presenter_text_excerpt = presenterText.slice(0, 1500);
    results.summary_slide_visible_at_end = presenterText.includes('Treatment Suggestions Summary') || presenterText.includes('Treatment Suggestions');

    await page.getByRole('link', { name: /back to builder/i }).click();
    await page.waitForURL(`**/staff/${requestId}/deck`);
    await page.waitForLoadState('domcontentloaded');
    await page.getByText('Patient Deck (3 slides)').waitFor({ timeout: 15000 });
    await page.screenshot({ path: path.join(outDir, 'builder_returned.png'), fullPage: true });

    const returnText = await page.locator('body').innerText();
    results.details.builder_return_text_excerpt = returnText.slice(0, 1200);
    results.builder_retained_draft_after_return = returnText.includes('Patient Deck (3 slides)');
  } catch (error) {
    results.error = String(error && error.stack ? error.stack : error);
  } finally {
    await browser.close();
  }

  fs.writeFileSync(path.join(outDir, 'draft_workflow_results.json'), JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results, null, 2));
  if (results.error || Object.values(results).some((value) => value === false)) {
    process.exitCode = 1;
  }
})();
