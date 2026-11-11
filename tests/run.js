// Iron Log engine tests. Run from the repo folder:  npm i -D playwright && npx playwright install chromium && node tests/run.js
// Loads index.html in headless Chromium, feeds training histories to the progression engine and checks the answers.
const path = require('path');
const { chromium } = require('playwright');
let fails = 0, passes = 0;
const ok = (cond, name, detail) => { if (cond){ passes++; } else { fails++; console.log('FAIL', name, detail || ''); } };
(async () => {
  const b = await chromium.launch(), p = await b.newPage({ viewport:{ width:390, height:844 } }); const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.resolve(__dirname, '../index.html')); await p.waitForTimeout(500);
  await p.evaluate(() => { window.__T = (name, hist, ctxx = {}, tplx = {}) => {
    const F = lib().find(e => e.n === name), W = 7*864e5, n = hist.length; expoCache.key = 'x'; state.light = null;
    state.sessions = hist.map((h, k) => { const t = Date.now() - (n - k) * W * (h.gap || 1);
      return { id:'s'+k, dayId:'d1', start:t-3600e3, end:t, ...(h.ready ? { ready:{ level:h.ready } } : {}), ...(h.easy ? { easy:true } : {}),
        items:[{ ex:F.id, sets:h.s.map(([w, r, rir]) => ({ w:w === '' ? '' : String(w), r:String(r), done:true, ...(rir != null ? { rir } : {}) })), ...(h.back ? { back:h.back } : {}), ...(h.pain ? { pain:true } : {}), ...(h.extra ? { extra:true } : {}), ...(h.flag ? { target:{ flag:h.flag } } : {}) }] }; });
    return targetFor({ ex:F.id, sets:3, lo:8, hi:12, ...tplx }, { dayId:'d1', week:3, weeks:5, intro:false, rir:[1,2], ...ctxx }); }; });
  const T = (...a) => p.evaluate(a => __T(...a), a), S = (...s) => ({ s });
  const PD = 'Wide-Grip Lat Pulldown';
  let t;
  t = await T(PD, [S([140,10],[140,9],[140,8])]); ok(t.kind === 'same' && t.w === 140 && t.reps[0] === 11, 'adds a rep', t);
  t = await T(PD, [S([140,12],[140,10],[140,9])]); ok(t.kind === 'up' && t.w === 145, 'moves up when ready', t);
  t = await T(PD, [S([140,10],[140,10],[140,10])]); ok(t.flag === 'test' && t.w === 145, 'flat reps test a jump', t);
  t = await T(PD, [S([140,10],[140,10],[140,10]), { s:[[145,9],[145,7],[145,6]], back:{ w:140, reps:[11,10,10] } }, S([140,11],[140,11],[140,11])]); ok(t.flag !== 'test', 'no re-test after a failed test', t);
  t = await T(PD, [{ s:[[140,10],[140,9],[140,8]], pain:true }]); ok(t.kind === 'deload' && t.w < 140, 'pain backs off', t);
  t = await T(PD, [{ s:[[140,10],[140,9],[140,8]], gap:7 }]); ok(t.kind === 'down' && t.w < 140, 'long layoff restarts lighter', t);
  t = await T(PD, Array(4).fill(S([140,10],[140,9],[140,8]))); ok(t.flag === 'reset', 'stall resets', t);
  t = await T(PD, Array(4).fill(S([140,10,3],[140,9,3],[140,8,3]))); ok(t.flag === 'push', 'stall with reps left says push', t);
  t = await T(PD, [{ s:[[140,12],[140,10],[140,9],[140,7]], extra:true }]); ok(t.kind === 'up', 'tired 4th set does not block a jump', t);
  t = await T(PD, [S([140,11],[140,10],[140,9])], { easy:true, rir:[3,4] }); ok(t.kind === 'deload' && t.w === 140, 'easier week holds weight', t);
  t = await T('Back Squat', [S([225,8],[225,7],[225,6])], { rir:[0,1], week:5 }, { lo:5, hi:8 }); ok(t.kind === 'up' && t.w === 235, 'squat +10', t);
  t = await T('Lateral Raise', [S([15,12],[15,11],[15,10])]); ok(t.kind === 'same', 'big isolation jump waits', t);
  t = await T('Assisted Pull-Up', [S([50,12],[50,12],[50,12])]); ok(t.kind === 'up' && t.w === 45, 'assisted: less help', t);
  // no bouncing: a lifter who loses ~1.5 reps a set, 10 weeks, the "went heavy" box should stay quiet
  const bounce = await p.evaluate(() => {
    const F = n => lib().find(e => e.n === n).id, W = 7*864e5, ex = exById(F('Chest-Supported Dumbbell Row')); let e1 = 100 * (1 + 13/30), boxes = 0, ws = [];
    const realNow = Date.now; let now = realNow(); Date.now = () => now;
    state.sessions = []; state.light = null; state.block = { id:'b', n:1, start:now, weeks:20, intro:false, scheme:0 };
    for (let w = 0; w < 10; w++){ expoCache.key = 'x'; now += W;
      const it = buildSessionItem({ ex:ex.id, sets:3, lo:10, hi:12, rest:90 }, { dayId:'d1', week:3, weeks:20, intro:false, rir:[1,2] }, true);
      const wt = num(it.sets[0].w) || 100; ws.push(wt);
      it.sets.forEach((s, k) => { s.w = String(wt); s.r = String(Math.max(1, Math.floor(30 * (e1 / wt - 1)) - 1 - Math.round(k * 1.5))); s.done = true; });
      if (overreach({ items:[it] }).length) boxes++;
      state.sessions.push({ id:'w'+w, dayId:'d1', start:now - 3600e3, end:now, items:[it] }); e1 *= 1.01; }
    Date.now = realNow; return { boxes, ws };
  });
  ok(bounce.boxes === 0, 'no step-back box for normal fatigue', JSON.stringify(bounce));
  ok(bounce.ws.every((w, k) => !k || w >= bounce.ws[k-1]), 'weights never bounce down', JSON.stringify(bounce.ws));
  ok(bounce.ws[bounce.ws.length - 1] > bounce.ws[0], 'weight goes up over 10 weeks', JSON.stringify(bounce.ws));
  // security: names can't carry markup
  const xss = await p.evaluate(() => { const st = cleanState({ custom:[{ id:'c1', n:'<img src=x onerror=alert(1)>' }], days:[], sessions:[] }); return st.custom[0].n; });
  ok(!/[<>]/.test(xss), 'custom names are cleaned', xss);

  // effort cap: heavy barbell lifts stay 1-2 reps short in the hardest week
  const cap = await p.evaluate(() => { const F = lib().find(e => e.n === 'Back Squat'); state.sessions = [{ id:'h', dayId:'d1', start:Date.now()-8*864e5, end:Date.now()-7*864e5, items:[{ ex:F.id, sets:[{w:'225',r:'8',done:true},{w:'225',r:'7',done:true},{w:'225',r:'6',done:true}] }] }]; expoCache.key = 'x';
    const a = targetFor({ ex:F.id, sets:3, lo:5, hi:8 }, { dayId:'d1', week:5, weeks:5, rir:[0,1] }), b = targetFor({ ex:F.id, sets:3, lo:5, hi:8 }, { dayId:'d1', week:5, weeks:5, rir:[1,2] }); return [a.reps[0], b.reps[0]]; });
  ok(cap[0] === cap[1], 'heavy lifts ignore 0-1 RIR', cap);
  // lb -> kg -> lb is exact
  const rt = await p.evaluate(() => { const F = lib().find(e => e.n === 'Back Squat'); state.units = 'lb'; state.unitOrig = {}; state.sessions = [{ id:'u', dayId:'d1', start:1, end:2, items:[{ ex:F.id, sets:[{ w:'50', r:'8', done:true }, { w:'227.5', r:'8', done:true }], target:{ w:50, reps:[8] } }] }];
    state.body.log['2026-01-01'] = { w:181.3, waist:33.5 }; convertUnits('kg'); state.units = 'kg'; const mid = state.sessions[0].items[0].sets[0].w; convertUnits('lb'); state.units = 'lb';
    return { mid, back:state.sessions[0].items[0].sets.map(q => q.w), t:state.sessions[0].items[0].target.w, body:state.body.log['2026-01-01'] }; });
  ok(rt.back[0] === '50' && rt.back[1] === '227.5' && rt.t === 50 && rt.body.w === 181.3 && rt.body.waist === 33.5, 'unit round trip is lossless', JSON.stringify(rt));
  // hostile backup: nothing in it can run
  const hostile = await p.evaluate(async () => { window.__pwn = 0; const bad = '<img src=x onerror="window.__pwn++">';
    await restoreFrom(JSON.stringify({ units:'lb' + bad, bar:bad, custom:[{ id:'c1', n:bad, m:'Chest', e:'MA', t:'reps' }], days:[{ id:'d', name:bad, items:[{ ex:'c1', sets:bad, lo:bad, hi:bad, rest:bad }] }],
      block:{ n:bad, weeks:bad, start:Date.now() }, sessions:[{ id:'s', dayName:bad, start:1, end:Date.now(), items:[{ ex:'c1', sets:[{ w:bad, r:bad, done:true }], target:{ w:bad, reps:[bad], why:bad } }] }] }), 'program');
    for (const t of ['train','body','program','history','progress']){ state.tab = t; render(); } await new Promise(r => setTimeout(r, 300)); return { pwn:window.__pwn, units:state.units }; });
  ok(hostile.pwn === 0 && hostile.units === 'lb', 'hostile backup cannot run code', JSON.stringify(hostile));
  // left/right: the set counts as the weaker side, history shows both
  const lr = await p.evaluate(() => fmtSet({ w:'15', r:'9', rl:'11', rr:'9' }, 'reps'));
  ok(lr === '15×11L/9R', 'left/right shown in history', lr);
  // six lifter types x 10 weeks: no step-back box from normal fatigue, steady climb
  for (const [policy, dropPer] of [['rir',1],['rir',1.5],['rir',2],['target',1],['target',1.5],['target',2]]){
    const r = await p.evaluate(([policy, dropPer]) => {
      const F = n => lib().find(e => e.n === n).id, W = 7*864e5, ex = exById(F('Chest-Supported Dumbbell Row')); let e1 = 100 * (1 + 13/30), boxes = 0, ws = [];
      const realNow = Date.now; let now = realNow(); Date.now = () => now; state.units = 'lb'; state.sessions = []; state.light = null; state.calib = []; state.block = { id:'b', n:1, start:now, weeks:20, intro:false, scheme:0 };
      for (let w = 0; w < 10; w++){ expoCache.key = 'x'; now += W;
        const it = buildSessionItem({ ex:ex.id, sets:3, lo:8, hi:12, rest:90 }, { dayId:'d1', week:3, weeks:20, intro:false, rir:[1,2] }, true), wt = num(it.sets[0].w) || 100; ws.push(wt);
        it.sets.forEach((s, k) => { const cap = Math.floor(30 * (e1 / wt - 1)) - Math.round(k * dropPer), tg = num(s.r) || 8; s.w = String(wt); s.r = String(Math.max(1, policy === 'target' ? Math.min(cap, tg) : cap - 1)); s.done = true; });
        if (overreach({ items:[it] }).length) boxes++;
        state.sessions.push({ id:'w'+w, dayId:'d1', start:now - 3600e3, end:now, items:[it] }); e1 *= 1.01; }
      Date.now = realNow; return { boxes, ws }; }, [policy, dropPer]);
    ok(r.boxes === 0 && r.ws.every((w, k) => !k || w >= r.ws[k-1]), `lifter ${policy}/${dropPer}: no bounce`, JSON.stringify(r));
  }
  ok(errs.length === 0, 'no page errors', errs.join('\n'));
  console.log(`${passes} passed, ${fails} failed`); await b.close(); process.exit(fails ? 1 : 0);
})();
