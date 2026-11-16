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

  // RTS load chart: more reps at a weight = higher estimated max, and it's continuous at 10/11 reps
  const rts = await p.evaluate(() => [e1rm(100, 9), e1rm(100, 10), e1rm(100, 11), rtfAt(e1From(225, 5), 225)]);
  ok(rts[0] < rts[1] && rts[1] < rts[2] && rts[3] === 5, 'load chart is monotonic and invertible', rts);
  // muscle feedback: not sore + no progress → one more set; still sore → one fewer; on a cut only priority muscles get more
  const fbr = await p.evaluate(() => { const F = n => lib().find(e => e.n === n).id, S = (w, r) => ({ w:String(w), r:String(r), done:true }), W = 7*864e5, out = {};
    const run = (fb, phase, prio) => { expoCache.key = 'x'; state.active = null; state.light = null; state.phase = phase; state.goals.priority = prio || [];
      state.days = [{ id:'d1', name:'U', items:[{ ex:F('Incline Dumbbell Press'), sets:3, lo:8, hi:12, rest:120 }, { ex:F('Wide-Grip Lat Pulldown'), sets:3, lo:8, hi:12, rest:120 }] }];
      state.block = { id:'b', n:2, start:Date.now() - W - 864e5, weeks:6, intro:false, scheme:0 };
      state.sessions = [2,1].map(k => ({ id:'f'+k, dayId:'d1', start:Date.now()-k*W*.5-3600e3, end:Date.now()-k*W*.5, items:[{ ex:F('Incline Dumbbell Press'), sets:[S(60,10),S(60,9),S(60,9)] }, { ex:F('Wide-Grip Lat Pulldown'), sets:[S(140,10),S(140,9),S(140,9)] }] }));
      state.sessions[1].fb = fb; startSession(state.days[0], null); return state.active.items.map(it => it.sets.length).join(','); };
    out.base = run(null, 'maintain'); out.fb = run({ m:{ Chest:{ sore:0 }, Back:{ sore:2 } } }, 'maintain'); out.cut = run({ m:{ Chest:{ sore:0 } } }, 'cut'); out.cutPrio = run({ m:{ Chest:{ sore:0 } } }, 'cut', ['Chest']);
    state.active = null; return out; });
  ok(fbr.base === '3,3' && fbr.fb === '4,2' && fbr.cut === '3,3' && fbr.cutPrio === '4,3', 'muscle feedback adjusts sets', JSON.stringify(fbr));
  // on a cut, a flat lift is held, not reset
  const cutT = await p.evaluate(() => { const F = lib().find(e => e.n === 'Wide-Grip Lat Pulldown'), S = (w, r) => ({ w:String(w), r:String(r), done:true }); state.phase = 'cut'; expoCache.key = 'x';
    state.sessions = [4,3,2,1].map(k => ({ id:'c'+k, dayId:'d1', start:Date.now()-k*7*864e5-3600e3, end:Date.now()-k*7*864e5, items:[{ ex:F.id, sets:[S(140,10),S(140,9),S(140,8)] }] }));
    const t = targetFor({ ex:F.id, sets:3, lo:8, hi:12 }, { dayId:'d1', week:3, weeks:6, rir:[1,2] }); state.phase = undefined; return t.flag; });
  ok(cutT === 'cut', 'cutting holds a flat lift instead of resetting', cutT);
  // body-only data is converted when switching units, and a value corrected after a switch is not reverted
  const bu = await p.evaluate(() => { state.units = 'lb'; state.unitOrig = {}; state.sessions = []; state.days = []; state.active = null; state.body.log = { '2026-01-02':{ w:180, waist:34 } };
    const go = () => document.querySelector('[data-act="units"][data-v="kg"]');
    state.tab = 'program'; render(); const btn = go(); if (!btn) return 'no units button'; btn.click(); if (state.units !== 'kg') { go().click(); }
    const kg = { ...state.body.log['2026-01-02'] }; state.body.log['2026-01-02'].w = 79; convertUnits('lb'); state.units = 'lb';
    return { kg, back:state.body.log['2026-01-02'] }; });
  ok(bu.kg && bu.kg.w === 81.6 && bu.kg.waist === 86.4 && bu.back.w === 174.2 && bu.back.waist === 34, 'body-only units convert; corrections stick', JSON.stringify(bu));
  // typos in a weigh-in are caught
  const typo = await p.evaluate(() => { state.units = 'lb'; const k = dkey(Date.now()); state.body.log = {}; for (let i = 1; i < 7; i++) state.body.log[dkey(addDays(Date.now(), -i))] = { w:180 };
    state.tab = 'body'; render(); const save = v => { document.getElementById('bwIn').value = v; document.getElementById('bwSave').click(); return (state.body.log[k] || {}).w; };
    const r = [save('1800'), save('81.6'), save('81.6'), save('181')];
    // typed once, Save tapped twice: the box keeps the number and the second tap stores it
    delete state.body.log[k]; render(); document.getElementById('bwIn').value = '195'; document.getElementById('bwSave').click(); const kept = document.getElementById('bwIn').value; document.getElementById('bwSave').click();
    return [...r, kept, (state.body.log[k] || {}).w]; });
  ok(typo[0] == null && typo[1] == null && typo[2] === 81.6 && typo[3] === 181 && typo[4] === '195' && typo[5] === 195, 'weigh-in typos need a second tap or are refused', JSON.stringify(typo));
  // build week: no 4th set on the day the weight goes up; a 4th set on a same-weight day matches its note
  const bw = await p.evaluate(() => { const F = n => lib().find(e => e.n === n).id, W = 7*864e5, S = (w, r) => ({ w:String(w), r:String(r), done:true, rir:2 }); expoCache.key = 'x'; state.phase = 'maintain'; state.light = null; state.buildOn = true; state.goals.priority = [];
    state.days = [{ id:'d1', name:'U', items:[{ ex:F('Wide-Grip Lat Pulldown'), sets:3, lo:8, hi:12, rest:120 }, { ex:F('Incline Dumbbell Press'), sets:3, lo:8, hi:12, rest:120 }] }];
    state.block = { id:'b', n:2, start:Date.now() - 4.5*W, weeks:6, intro:false, scheme:0 };
    state.sessions = [{ id:'h0', dayId:'d1', start:Date.now()-2*W-3600e3, end:Date.now()-2*W, items:[{ ex:F('Wide-Grip Lat Pulldown'), sets:[S(150,11),S(150,10),S(150,9)] }, { ex:F('Incline Dumbbell Press'), sets:[S(60,10),S(60,9),S(60,9)] }] }, { id:'h1', dayId:'d1', start:Date.now()-W-3600e3, end:Date.now()-W, items:[{ ex:F('Wide-Grip Lat Pulldown'), sets:[S(150,12),S(150,10),S(150,9)] }, { ex:F('Incline Dumbbell Press'), sets:[S(60,10),S(60,10),S(60,9)] }] }];
    startSession(state.days[0], null); const a = state.active.items.map(it => ({ n:it.sets.length, kind:it.target.kind, reps:it.target.reps.join(', '), why:it.target.why || '' })); state.active = null; state.phase = undefined; return a; });
  ok(bw[0].kind === 'up' && bw[0].n === 3, 'no 4th set on a jump day', JSON.stringify(bw));
  ok(bw[1].n === 4 && bw[1].reps.split(', ').length === 4, 'build week still adds a 4th set on a same-weight day', JSON.stringify(bw));
  ok(bw[1].n !== 4 || !/\d+, \d+, \d+, \d+/.test(bw[1].why) || bw[1].why.includes(bw[1].reps), '4th-set note matches headline', JSON.stringify(bw[1]));
  // weight advice: stale logs are flagged, a typo doesn't flip the advice, a clearly fast cut is still called out
  const wa = await p.evaluate(() => { state.units = 'lb'; state.phase = 'cut'; const set = (f, from = 0) => { state.body.log = {}; for (let d = from; d < 28; d++) state.body.log[dkey(addDays(Date.now(), -d))] = { w:f(d) }; };
    const zig = d => (d % 2 ? .6 : -.6);
    set(d => 180 * (1 + .0075 * d / 7) + zig(d), 8); const stale = weightAdvice().txt;
    set(d => 180 * (1 + .0075 * d / 7) + zig(d)); state.body.log[dkey(addDays(Date.now(), -1))].w = 1800; const typo = weightAdvice().txt;
    set(d => 180 * (1 + .02 * d / 7) + zig(d)); const fast = weightAdvice().txt; state.phase = undefined; state.body.log = {}; return { stale, typo, fast }; });
  ok(/days ago/.test(wa.stale) && /On target/.test(wa.typo) && /calories more/.test(wa.fast), 'weight advice: stale, outlier, fast cut', JSON.stringify(wa));
  // a backup with wrong-typed fields can't break the app
  const badRestore = await p.evaluate(async () => { const n0 = state.sessions.length;
    const r = await restoreFrom(JSON.stringify({ days:[], sessions:[], body:'oops', goals:7, cardio:{ log:'x' } }), 'program');
    let drew = true; try{ drawPage(); }catch(e){ drew = false; } return { r, drew, body:typeof state.body, rescue:!!document.getElementById('rzSave') }; });
  ok(badRestore.drew && badRestore.body === 'object' && !badRestore.rescue, 'bad-typed backup is cleaned or refused', JSON.stringify(badRestore));
  // swapping the second exercise of a superset after a round keeps the pair together; removing a done set asks first
  const ssw = await p.evaluate(() => { const F = n => lib().find(e => e.n === n).id; state.days = [{ id:'dS', name:'Arms', items:[{ ex:F('Dumbbell Curl'), sets:3, lo:8, hi:12, rest:90, ss:true }, { ex:F('Rope Pushdown'), sets:3, lo:8, hi:12, rest:90 }] }];
    startSession(state.days[0], null); const a = state.active; a.items[0].sets[0].r = '10'; a.items[0].sets[0].done = true; a.items[1].sets[0].r = '10'; a.items[1].sets[0].done = true;
    swap = { x:1 }; applySwap(F('Overhead Cable Extension'), false); const order = a.items.map(it => exById(it.ex).n + (it.ss ? '+' : ''));
    a.items[0].sets.push({ w:'', r:'8', done:true }); const n0 = a.items[0].sets.length; const btn = () => document.querySelector('[data-act="rmSet"][data-x="0"]'); state.tab = 'train'; render(); btn().click(); const n1 = a.items[0].sets.length; btn().click(); const n2 = a.items[0].sets.length;
    state.active = null; return { order:order.join(' | '), n0, n1, n2 }; });
  ok(ssw.order === 'Rope Pushdown | Dumbbell Curl+ | Overhead Cable Extension' && ssw.n1 === ssw.n0 && ssw.n2 === ssw.n0 - 1, 'superset swap keeps the pair; removing a done set asks first', JSON.stringify(ssw));
  ok(errs.length === 0, 'no page errors', errs.join('\n'));
  // damaged saved data: rescue screen, and the stored data is not overwritten
  for (const [name, raw] of [['unreadable', '{"v":1,"units":"lb","days":[],"sessions":[{"id":"a"'], ['wrong-typed', JSON.stringify({ v:1, units:'lb', days:[], sessions:[{ id:'s', dayId:'d', start:1, end:2, items:[] }], body:'oops', goals:5 })]]){
    const qc = await b.newContext(), q = await qc.newPage(); const qe = []; q.on('pageerror', e => qe.push(e.message));
    await q.addInitScript(r => { if (!sessionStorage.getItem('seeded')){ sessionStorage.setItem('seeded', '1'); localStorage.setItem('iron-log-v1', r); } }, raw);
    await q.goto('file://' + path.resolve(__dirname, '../index.html')); await q.waitForTimeout(800);
    const res = await q.evaluate(() => ({ rescue:!!document.getElementById('rzSave'), kept:localStorage.getItem('iron-log-v1'), n:typeof state !== 'undefined' ? state.sessions.length : -1, tabs:['train','body','program','history','progress'].every(t => { state.tab = t; render(); return !document.getElementById('rzSave'); }) }));
    if (name === 'unreadable'){ ok(res.rescue && res.kept === raw, `${name} save opens rescue and is kept`, JSON.stringify({ rescue:res.rescue, same:res.kept === raw, qe }));
      await q.click('#rzFresh'); await q.click('#rzFresh'); await q.waitForTimeout(800);
      const fr = await q.evaluate(() => ({ app:!!document.getElementById('tab-train'), aside:localStorage.getItem('iron-log-v1-before-rescue') }));
      ok(fr.app && fr.aside === raw, 'rescue can start over and keeps the damaged data aside', JSON.stringify({ app:fr.app, aside:fr.aside === raw })); }
    else ok(!res.rescue && res.n === 1 && res.tabs && !qe.length, `${name} save is repaired and every tab opens`, JSON.stringify({ res, qe }));
    await qc.close(); }
  console.log(`${passes} passed, ${fails} failed`); await b.close(); process.exit(fails ? 1 : 0);
})();
