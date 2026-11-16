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
  t = await T(PD, [{ s:[[140,12],[140,10],[140,9]], gap:4 }]); ok(t.kind === 'same' && t.w === 140, '3-5 weeks off holds the weight, no jump', t);
  t = await T(PD, [{ s:[[140,12],[140,10],[140,9]], gap:2 }]); ok(t.kind === 'up', '2 weeks off can still move up', t);
  t = await T(PD, [{ s:[[140,10],[140,9],[140,8]], gap:4 }]); ok(t.kind === 'same' && t.w === 140 && t.reps[0] === 11, '3-5 weeks off: reps can still go up', t);
  t = await T(PD, [{ s:[[140,11],[140,10],[140,9]], gap:4 }, { s:[[140,12],[140,10],[140,9]], gap:4 }]); ok(t.kind === 'up', 'a lift done every 4 weeks still moves up', t);
  t = await T(PD, [{ s:[[140,12],[140,10],[140,9]], gap:4, pain:true }]); ok(t.kind === 'deload', 'pain wins over the layoff hold', t);
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
    const run = (fb, phase, prio, prevFb, better) => { expoCache.key = 'x'; state.active = null; state.light = null; state.phase = phase; state.goals.priority = prio || [];
      state.days = [{ id:'d1', name:'U', items:[{ ex:F('Incline Dumbbell Press'), sets:3, lo:8, hi:12, rest:120 }, { ex:F('Wide-Grip Lat Pulldown'), sets:3, lo:8, hi:12, rest:120 }] }];
      state.block = { id:'b', n:2, start:Date.now() - W - 864e5, weeks:6, intro:false, scheme:0 };
      state.sessions = [2,1].map(k => ({ id:'f'+k, dayId:'d1', start:Date.now()-k*W*.5-3600e3, end:Date.now()-k*W*.5, items:[{ ex:F('Incline Dumbbell Press'), sets:[S(60,10),S(60,9),S(60,9)] }, { ex:F('Wide-Grip Lat Pulldown'), sets:[S(140,10),S(140,9),S(140,9)] }] }));
      if (better) state.sessions[1].items[0].sets = [S(60,11),S(60,10),S(60,10)]; state.sessions[1].fb = fb; if (prevFb) state.sessions[0].fb = prevFb; startSession(state.days[0], null); return state.active.items.map(it => it.sets.length).join(','); };
    const C0 = { m:{ Chest:{ sore:0 } } };
    out.base = run(null, 'maintain'); out.once = run({ m:{ Chest:{ sore:0 }, Back:{ sore:2 } } }, 'maintain'); out.fb = run({ m:{ Chest:{ sore:0 }, Back:{ sore:2 } } }, 'maintain', null, C0); out.cut = run(C0, 'cut', null, C0); out.cutPrio = run(C0, 'cut', ['Chest'], C0);
    out.pump = run({ m:{ Chest:{ sore:0 } }, x:{ [F('Incline Dumbbell Press')]:{ stim:0 } } }, 'maintain', null, C0, true);
    state.active = null; return out; });
  ok(fbr.base === '3,3' && fbr.once === '3,2' && fbr.fb === '4,2' && fbr.cut === '3,3' && fbr.cutPrio === '4,3' && fbr.pump === '3,3', 'muscle feedback: sore removes at once, adding needs two sessions, pump alone never adds', JSON.stringify(fbr));
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
  // per-session volume counts helper sets as half, like the weekly targets
  const cs = await p.evaluate(() => { const F = n => lib().find(e => e.n === n).id; const items = [{ ex:F('Dumbbell Curl'), sets:3 }, { ex:F('Barbell Row'), sets:4 }, { ex:F('Wide-Grip Lat Pulldown'), sets:4 }];
    state.phase = 'maintain'; const r = { biceps:creditSets(items, 'Biceps', x => x.sets), back:creditSets(items, 'Back', x => x.sets), cap:volCaps().day }; state.phase = undefined; return r; });
  ok(cs.biceps === 7 && cs.back === 8 && cs.cap === 11, 'session volume: helper sets count half; cap 11', JSON.stringify(cs));
  // weight-jump day: "still sore" still removes a set from the jumping lift
  const jd = await p.evaluate(() => { const F = n => lib().find(e => e.n === n).id, S = (w, r) => ({ w:String(w), r:String(r), done:true, rir:2 }), W = 7*864e5; expoCache.key = 'x'; state.phase = 'maintain'; state.light = null; state.goals.priority = [];
    state.days = [{ id:'dJ', name:'P', items:[{ ex:F('Wide-Grip Lat Pulldown'), sets:3, lo:8, hi:12, rest:120 }] }]; state.block = { id:'bJ', n:2, start:Date.now() - 1.5*W, weeks:6, intro:false, scheme:0 };
    state.sessions = [{ id:'j1', dayId:'dJ', start:Date.now()-W-3600e3, end:Date.now()-W, items:[{ ex:F('Wide-Grip Lat Pulldown'), sets:[S(150,12),S(150,10),S(150,9)] }], fb:{ m:{ Back:{ sore:2 } } } }];
    startSession(state.days[0], null); const it = state.active.items[0], r = { kind:it.target.kind, n:it.sets.length }; state.active = null; state.phase = undefined; return r; });
  ok(jd.kind === 'up' && jd.n === 2, 'jump day: sore still removes a set', JSON.stringify(jd));
  // focus mode: a finished exercise stays open until a set elsewhere is logged, then shrinks to one line; tap reopens
  const fm = await p.evaluate(() => { const F = n => lib().find(e => e.n === n).id; state.days = [{ id:'dF', name:'F', items:[{ ex:F('Dumbbell Curl'), sets:2, lo:8, hi:12, rest:60 }, { ex:F('Rope Pushdown'), sets:2, lo:8, hi:12, rest:60 }] }];
    startSession(state.days[0], null); const a = state.active, t0 = Date.now(); a.items[0].sets.forEach((q, k) => { q.r = '10'; q.done = true; q.ts = t0 + k; }); a.lastDone = t0 + 1; render();
    const openAfterOwn = !document.getElementById('open-0'); a.items[1].sets[0].r = '10'; a.items[1].sets[0].done = true; a.items[1].sets[0].ts = t0 + 5; a.lastDone = t0 + 5; render();
    const shut = !!document.getElementById('open-0'); document.getElementById('open-0').click(); const reopened = !!document.getElementById('w-0-0'); state.active = null; return { openAfterOwn, shut, reopened }; });
  ok(fm.openAfterOwn && fm.shut && fm.reopened, 'focus mode collapses finished exercises after you move on', JSON.stringify(fm));
  // merge restore: adds what's missing, keeps what's here, refuses a unit mismatch
  const mg = await p.evaluate(async () => { const F = lib()[0].id, S = (id, end) => ({ id, dayId:'d', dayName:id, start:end - 3600e3, end, items:[{ ex:F, sets:[{ w:'100', r:'8', done:true }] }] });
    state.units = 'lb'; state.days = [{ id:'keep', name:'Mine', items:[] }]; state.sessions = [S('a', 1e12), S('b', 1.2e12)]; state.body.log = { '2026-01-01':{ w:180 } }; state.cardio.log = [];
    const bk = { units:'lb', days:[{ id:'other', name:'Theirs', items:[] }], sessions:[S('b', 1.2e12), S('c', 1.1e12)], body:{ log:{ '2026-01-01':{ w:181, waist:33 }, '2026-01-02':{ w:179 } }, photos:[] }, cardio:{ log:[{ id:'k1', at:5, min:30, kind:'walk' }] } };
    const ok1 = await restoreFrom(JSON.stringify(bk), 'program', true);
    const r = { ok1, ids:state.sessions.map(x => x.id).join(''), day1:state.body.log['2026-01-01'], day2:state.body.log['2026-01-02'], days:state.days.map(d => d.id).join(), cardio:state.cardio.log.length };
    const ok2 = await restoreFrom(JSON.stringify({ ...bk, units:'kg', sessions:[S('z', 1.3e12)] }), 'program', true); r.ok2 = ok2; r.after = state.sessions.length; return r; });
  ok(mg.ok1 && mg.ids === 'acb' && mg.day1.w === 180 && mg.day1.waist === 33 && mg.day2.w === 179 && mg.days === 'keep' && mg.cardio === 1 && mg.ok2 === false && mg.after === 3, 'merge restore adds, keeps, refuses unit mismatch', JSON.stringify(mg));
  // photo repeatability: 4 back-to-back shots set a per-metric threshold (2.77 x pooled spread, never under 2%);
  // with 2% noise, months with no real change stay quiet; flagged photos aren't a comparison base
  const pc = await p.evaluate(() => { state.body.photos = []; state.body.prep = {}; const m = (taper, waist, shoulder, hip) => ({ ok:true, m:{ taper, waist, shoulder, hip }, flags:[] });
    const P = (id, at, a) => ({ id, at, pose:'front', a });
    const base = P('p1', 1000, m(1.50, .80, 1.20, .90)), flagged = P('p2', 2000, { ...m(1.40, .90, 1.20, .90), flags:['turned'] }), now = P('p3', 3000, m(1.535, .79, 1.21, .90));
    state.body.photos.push(base, flagged, now); const before = photoSummary(now), prev = prevOf(now).id, floor0 = photoTh('front', 'taper');
    let seed = 123456789; const rnd = () => { seed = (seed * 48271) % 2147483647; return seed / 2147483647; }, gauss = () => { let u = 0; while (!u) u = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rnd()); };
    const shot = () => ({ taper:1.5 * (1 + .02 * gauss()), waist:.8 * (1 + .02 * gauss()), shoulder:1.2 * (1 + .02 * gauss()), hip:.9 * (1 + .02 * gauss()) });
    state.body.prep = { front:{ sessions:[0, 1, 2].map(k => ({ at:k, shots:[shot(), shot(), shot(), shot()] })) } };
    const th = photoTh('front', 'waist'); let calls = 0; for (let i = 0; i < 400; i++){ const a = shot().waist, b = shot().waist; if (Math.abs(a - b) / b >= th) calls++; }
    const after = photoSummary(now); state.body.photos = []; state.body.prep = {}; return { prev, before, floor0, th:+th.toFixed(3), falseRate:calls / 400, after }; });
  ok(pc.prev === 'p1' && /ratio up/.test(pc.before) && pc.floor0 === .02 && pc.th > .04 && pc.th < .08 && pc.falseRate < .1 && !/ratio up/.test(pc.after), 'photo repeatability: quiet when nothing changed; flagged photos skipped', JSON.stringify(pc));
  // blocks side by side: one column per block, e1RM and weekly sets from that block's workouts
  const bc = await p.evaluate(() => { const F = n => lib().find(e => e.n === n).id, W = 7*864e5, t0 = Date.now() - 8*W; state.units = 'lb';
    state.sessions = [0, 1, 4, 5].map(w => ({ id:'k'+w, dayId:'d', dayName:'D', start:t0 + w*W - 3600e3, end:t0 + w*W, items:[{ ex:F('Barbell Bench Press'), sets:[{ w:String(w < 4 ? 135 : 145), r:'8', done:true }] }] }));
    state.blocks = [{ id:'x1', n:1, start:t0 - 864e5, end:t0 + 3*W, weeks:3, days:[] }]; state.block = { id:'x2', n:2, start:t0 + 3*W, weeks:6, intro:false, scheme:0 };
    const h = blockCompare(), d = document.createElement('div'); d.innerHTML = h; const cells = [...d.querySelectorAll('tr')].find(r => /Bench/.test(r.textContent)); return { heads:d.querySelectorAll('thead th').length, bench:cells ? [...cells.querySelectorAll('td')].slice(1).map(td => td.textContent) : null }; });
  ok(bc.heads === 3 && bc.bench && /^\d+$/.test(bc.bench[0]) && /\+7%/.test(bc.bench[1]), 'blocks side by side', JSON.stringify(bc));
  // exercise page: opens from the workout card, saves its fields through the normal handlers, closes back in place
  const xpg = await p.evaluate(() => { const F = n => lib().find(e => e.n === n).id; state.days = [{ id:'dX', name:'X', items:[{ ex:F('Machine Chest Press'), sets:3, lo:8, hi:12, rest:90 }] }];
    startSession(state.days[0], null); state.tab = 'train'; render(); document.getElementById('xpg-0').click(); const open = !!document.getElementById('exPageClose');
    const el = document.getElementById('xp-base'); el.value = '30'; el.dispatchEvent(new Event('input', { bubbles:true })); document.getElementById('exPageClose').click();
    const r = { open, base:state.base[F('Machine Chest Press')], closed:!document.getElementById('exPageClose'), cardHasBase:!!document.getElementById('base-0') }; state.active = null; delete state.base[F('Machine Chest Press')]; return r; });
  ok(xpg.open && xpg.base === 30 && xpg.closed && !xpg.cardHasBase, 'exercise page opens, saves, closes', JSON.stringify(xpg));
  ok(errs.length === 0, 'no page errors', errs.join('\n'));
  // damaged saved data: rescue screen, and the stored data is not overwritten
  for (const [name, raw] of [['unreadable', '{"v":1,"units":"lb","days":[],"sessions":[{"id":"a"'], ['wrong-typed', JSON.stringify({ v:1, units:'lb', days:[], sessions:[{ id:'s', dayId:'d', start:1, end:2, items:[] }], body:'oops', goals:5 })]]){
    const qc = await b.newContext(), q = await qc.newPage(); const qe = []; q.on('pageerror', e => qe.push(e.message));
    await q.addInitScript(r => { if (!localStorage.getItem('test-seeded')){ localStorage.setItem('test-seeded', '1'); localStorage.setItem('iron-log-v1', r); } }, raw);
    await q.goto('file://' + path.resolve(__dirname, '../index.html')); await q.waitForSelector('#rzSave, #tab-train', { timeout:8000 }); await q.waitForTimeout(400);
    const res = await q.evaluate(() => ({ rescue:!!document.getElementById('rzSave'), kept:localStorage.getItem('iron-log-v1'), n:typeof state !== 'undefined' ? state.sessions.length : -1, tabs:['train','body','program','history','progress'].every(t => { state.tab = t; render(); return !document.getElementById('rzSave'); }) }));
    if (name === 'unreadable'){ ok(res.rescue && res.kept === raw, `${name} save opens rescue and is kept`, JSON.stringify({ rescue:res.rescue, same:res.kept === raw, qe }));
      // storage is checked before the page reloads: headless Chromium on file:// drops some writes across a reload
      const fr = await q.evaluate(() => { const b = document.getElementById('rzFresh'); b.click(); b.click(); return { app:localStorage.getItem('iron-log-v1') === null, aside:localStorage.getItem('iron-log-v1-before-rescue') }; });
      ok(fr.app && fr.aside === raw, 'rescue can start over and keeps the damaged data aside', JSON.stringify({ app:fr.app, aside:fr.aside === raw })); }
    else ok(!res.rescue && res.n === 1 && res.tabs && !qe.length, `${name} save is repaired and every tab opens`, JSON.stringify({ res, qe }));
    await qc.close(); }
  console.log(`${passes} passed, ${fails} failed`); await b.close(); process.exit(fails ? 1 : 0);
})();
