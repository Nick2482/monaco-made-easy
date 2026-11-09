// Runs on GitHub's servers (which can reach the elevation tiles): how often do the three climbing levels give different routes?
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:8765/#/'); await p.waitForTimeout(3000);
  await p.waitForFunction(() => window.MMERouter && MMERouter.heightAt(MME.places.palace) !== null, null, { timeout: 60000 }).catch(() => {});
  const r = await p.evaluate(() => {
    const G = (window.MMEGuidePlaces || []).filter(x => x.lat > 43.724 && x.lat < 43.752 && x.lng > 7.405 && x.lng < 7.44);
    let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const out = [], stat = { n: 0, flatLess10: 0, flatMoreMin: [], hillsFaster3: 0, hillsSaved: [], none: 0 };
    for (let i = 0; i < 300; i++) {
      const a = G[Math.floor(rnd() * G.length)], z = G[Math.floor(rnd() * G.length)];
      if (!a || !z || a === z) continue;
      const R = [0, 1, 2].map(l => MMERouter.route(a, z, { climb: l }));
      if (R.some(x => !x)) { stat.none++; continue; }
      stat.n++;
      if (R[1].climbed - R[0].climbed >= 10) { stat.flatLess10++; stat.flatMoreMin.push(R[0].minutes - R[1].minutes); if (out.length < 12) out.push(`FLAT ${a.n} > ${z.n}: usual ${R[1].minutes}min climb ${R[1].climbed} | flat ${R[0].minutes}min climb ${R[0].climbed}`); }
      if (R[1].minutes - R[2].minutes >= 3) { stat.hillsFaster3++; stat.hillsSaved.push(R[1].minutes - R[2].minutes); if (out.length < 24) out.push(`HILLS ${a.n} > ${z.n}: usual ${R[1].minutes}min climb ${R[1].climbed} | hills ${R[2].minutes}min climb ${R[2].climbed}`); }
    }
    const avg = a => a.length ? (a.reduce((s, x) => s + x, 0) / a.length).toFixed(1) : '-';
    out.unshift(`pairs ${stat.n}, unreachable ${stat.none}; flat setting saves 10+ m climb on ${stat.flatLess10} (avg extra ${avg(stat.flatMoreMin)} min); hills setting saves 3+ min on ${stat.hillsFaster3} (avg ${avg(stat.hillsSaved)} min)`);
    return out;
  });
  console.log(r.join('\n')); console.log('errors', JSON.stringify(errs)); await b.close();
})();
