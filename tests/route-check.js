// Runs on GitHub's servers (which can reach the elevation tiles): compares routes at the three climbing levels.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:8765/#/'); await p.waitForTimeout(3000);
  await p.waitForFunction(() => window.MMERouter && MMERouter.heightAt(MME.places.palace) !== null, null, { timeout: 60000 }).catch(() => {});
  const r = await p.evaluate(() => {
    const P = MME.places, out = ['heights: palace ' + MMERouter.heightAt(P.palace) + ' m, port ' + MMERouter.heightAt(P.port) + ' m, exotic ' + MMERouter.heightAt(P.exotic) + ' m'];
    const pairs = [['port','palace'],['station','exotic'],['port','casino'],['casino','museum'],['fontvieille','exotic'],['larvotto','beausoleil'],['port','beausoleil'],['museum','casino'],['exotic','port']];
    pairs.forEach(([a, z]) => out.push(a + '>' + z + ' | ' + [0,1,2].map(l => { const x = MMERouter.route(P[a], P[z], { climb: l }); return x ? `L${l}: ${x.minutes}min ${x.metres}m climb${x.climbed} lifts${x.lifts} esc${x.escalators} steps${x.steps}` : 'none'; }).join(' | ')));
    return out;
  });
  console.log(r.join('\n')); console.log('errors', JSON.stringify(errs)); await b.close();
})();
