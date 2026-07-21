import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 1400 } });
await page.goto('http://localhost:4399/', { waitUntil: 'networkidle' });
await page.evaluate(() => document.fonts.ready);

const data = await page.evaluate(() => {
  const gridEl = document.querySelector('.grid-overlay');
  const gridTop = gridEl.getBoundingClientRect().top;

  // True alphabetic baseline of an element's first line: an empty inline-block
  // with vertical-align:baseline sits its own baseline on the text baseline.
  function firstBaseline(el) {
    const m = document.createElement('span');
    m.style.cssText =
      'display:inline-block;width:0;height:0;overflow:hidden;vertical-align:baseline';
    el.insertBefore(m, el.firstChild);
    const y = m.getBoundingClientRect().top;
    m.remove();
    return y;
  }

  function report(label, el) {
    if (!el) return { label, missing: true };
    const cs = getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    const base = firstBaseline(el);
    const mod = (v) => {
      const r = ((v % 24) + 24) % 24;
      return +(r > 12 ? r - 24 : r).toFixed(2); // signed distance to nearest grid line
    };
    return {
      label,
      font: cs.fontFamily.split(',')[0].replace(/"/g, ''),
      size: cs.fontSize,
      lineHeight: cs.lineHeight,
      transform: cs.transform,
      shiftVar: cs.getPropertyValue('--_shift').trim(),
      display: cs.display,
      boxTop_fromGrid: +(rect.top - gridTop).toFixed(2),
      boxTop_offGrid: mod(rect.top - gridTop),
      baseline_fromGrid: +(base - gridTop).toFixed(2),
      baseline_offGrid: mod(base - gridTop),
    };
  }

  const q = (s) => document.querySelector(s);
  return {
    gridTop: +gridTop.toFixed(2),
    rows: [
      report('hero kicker', q('.hero .mono-label')),
      report('hero h1', q('.hero h1')),
      report('hero lede', q('.hero .lede')),
      report('hero chip text', q('.hero .chip .text')),
      report('hero stats (flex box)', q('.hero .stats')),
      report('hero stats first span', q('.hero .stats span')),
      report('section head title', q('.section-head .title')),
      report('featured card head', q('.card .mono-label')),
    ],
  };
});

console.log('grid overlay top (px, viewport):', data.gridTop);
console.log('(off-grid: signed px from nearest 24px line — 0 = on grid)\n');
for (const r of data.rows) {
  if (r.missing) {
    console.log(`${r.label}: NOT FOUND`);
    continue;
  }
  console.log(`${r.label}`);
  console.log(`  font=${r.font} ${r.size}/${r.lineHeight} display=${r.display}`);
  console.log(`  --_shift=${r.shiftVar || '(unset)'}  transform=${r.transform}`);
  console.log(`  baseline off grid: ${r.baseline_offGrid}\n`);
}

await browser.close();
