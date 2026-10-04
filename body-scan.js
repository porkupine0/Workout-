// Iron Log body scan: measures progress photos on the phone, fully offline. Photos never leave the device.
// MediaPipe's pose model finds the body (shoulders, hips, knees...), MediaPipe's selfie segmenter outlines it on a
// chin-to-knee crop, and the geometry below turns that outline into widths: shoulders, waist and hips in front/back
// photos, chest and belly depth in side photos. Every width is divided by torso length (shoulder midpoint to hip
// midpoint), so camera distance and photo size don't matter. Only relative URLs: the service worker caches ./vision/.
//
// Why two models: the pose model can output its own body mask, but on the CPU (WASM) backend that crashes inside
// MediaPipe (every tasks-vision release up to 1.1.0 aborts with "Check failed: 1 == ChannelSize()"), and the GPU
// backend is the less reliable choice on iPhones. The 250 KB segmenter runs on the CPU in about 20 ms, and on a crop
// around the torso it gives a sharper outline than the pose model's full-body mask would.

const VISION = './vision/';
const POSE_MODEL = 'pose_landmarker_lite.task', SEG_MODEL = 'selfie_segmenter.tflite';
const MAX_SIDE = 1024;                                  // photos are analyzed at most this many px on the long side
const POSES = ['front', 'side', 'back'];
const LM = { nose: 0, ls: 11, rs: 12, le: 13, re: 14, lw: 15, rw: 16, li: 19, ri: 20, lh: 23, rh: 24, lk: 25, rk: 26, la: 27, ra: 28 };
const PUBLIC_LM = ['ls', 'rs', 'lh', 'rh', 'nose', 'lk', 'rk', 'la', 'ra', 'le', 're', 'lw', 'rw'];
// Measuring bands, in torso lengths below the shoulder line (0 = shoulders, 1 = hips). The shoulder band stays at
// the joints: lower down, arms held away from the body widen the outline (A-pose added ~25% at 0.12, ~5% here).
const BAND = { shoulder: [0, .05], waist: [.5, .92], hip: [.9, 1.15], chest: [.22, .28], belly: [.55, 1] };
const SIDE_SEP = .25;      // shoulder joints closer than this (x torso length) across the body: a side photo
const SQUARE_SEP = .55;    // further apart than this: clearly facing (or facing away from) the camera
const UNSUPPORTED = "This browser can't run the photo analysis. It needs WebAssembly SIMD: iOS 16.4 or newer, or a current Chrome, Edge, Firefox or Safari.";
const MISSING = "Couldn't load the photo analysis files. Open the app once while online so it can save them for offline use.";

// ---------- loading ----------

let loading = null;
const scratch = {};        // reused canvases (iOS limits total canvas memory)

// Loads the WASM runtime and both models once. Throws an Error with a friendly .message when the browser
// can't run it or the files aren't available (offline before the first download); a later call retries.
export function ready() {
  return loading || (loading = load().catch(e => { loading = null; throw e; }));
}

async function load() {
  if (typeof WebAssembly !== 'object') throw new Error(UNSUPPORTED);
  let vision;
  try { vision = await import('./vision/vision_bundle.mjs'); } catch (e) { throw friendly(MISSING, e); }
  if (!(await vision.FilesetResolver.isSimdSupported())) throw new Error(UNSUPPORTED);
  const url = file => new URL(VISION + file, import.meta.url).href;
  const files = { wasmLoaderPath: url('vision_wasm_internal.js'), wasmBinaryPath: url('vision_wasm_internal.wasm') };
  const base = file => ({ modelAssetPath: url(file), delegate: 'CPU' });
  try {
    // numPoses 2 so a second person can be noticed; 0.3 still finds people whose legs are out of the frame
    const pose = await vision.PoseLandmarker.createFromOptions(files, { baseOptions: base(POSE_MODEL), runningMode: 'IMAGE',
      numPoses: 2, minPoseDetectionConfidence: .3, minPosePresenceConfidence: .3, outputSegmentationMasks: false });
    const seg = await vision.ImageSegmenter.createFromOptions(files, { baseOptions: base(SEG_MODEL), runningMode: 'IMAGE',
      outputConfidenceMasks: true, outputCategoryMask: false });
    return { pose, seg };
  } catch (e) { throw friendly(MISSING, e); }
}

function friendly(message, cause) { const e = new Error(message); e.cause = cause; return e; }

// ---------- analysis ----------

// source: HTMLImageElement | HTMLCanvasElement | ImageBitmap, already EXIF-oriented. pose: what the user says they took.
export async function analyze(source, pose) {
  const label = POSES.includes(pose) ? pose : 'front';
  let tasks;
  try { tasks = await ready(); } catch (e) { return fail('unsupported', label, { message: e.message }); }
  // everything below is synchronous, so concurrent calls can safely share the scratch canvases
  const img = fit(source), W = img.width, H = img.height;
  const people = findPeople(tasks.pose, img);
  if (!people.length) return fail('no-person', label);
  const P = refine(tasks.pose, img, people[0]) || people[0], lm = publicLm(P, W, H);
  if (outOfFrame(P, W, H)) return fail('cut-off', label, { lm });
  const seg = segmentBody(tasks.seg, img, P);
  const L = shift(P, -seg.x0, -seg.y0);
  if (!anklesInFrame(P, W, H) && !legsInMask(seg, L)) return fail('cut-off', label, { lm });
  if (people.slice(1).some(Q => isOther(Q, P)) || secondPerson(tasks.pose, img, P)) return fail('several-people', label, { lm });
  const sep = shoulderSep(P), poseGuess = Math.abs(sep) < SIDE_SEP ? 'side' : sep > 0 ? 'front' : 'back';
  const final = label === 'side' ? (Math.abs(sep) > SQUARE_SEP ? poseGuess : 'side') : (Math.abs(sep) < SIDE_SEP * .7 ? 'side' : label);
  const res = measure(seg.mask, seg.w, seg.h, L, final);
  if (!Object.keys(res.m).length) return fail('unclear', final, { lm });
  const F = bodyFrame(P), conf = confidence(P, seg, L, F);
  if (conf < .75 || F.T < 80) res.flags.push('low-confidence');
  return {
    ok: true, pose: final, poseGuess, lm, torso: round(F.T / H),
    m: res.m,
    lines: Object.fromEntries(Object.entries(res.lines).map(([k, [x1, y1, x2, y2]]) =>
      [k, [x1 + seg.x0, y1 + seg.y0, x2 + seg.x0, y2 + seg.y0].map((v, i) => round(v / (i % 2 ? H : W)))])),
    flags: res.flags,
    quality: round(Math.min(1, conf * Math.min(1, F.T / 150) * (final === label ? 1 : .8) * .88 ** res.flags.length), 2),
  };
}

function fail(reason, pose, extra = {}) {
  return { ok: false, reason, pose, poseGuess: null, lm: null, m: {}, lines: {}, flags: [], quality: 0, ...extra };
}

// Draws the photo onto a reusable canvas, at most MAX_SIDE px on the long side.
function fit(source) {
  const sw = source.naturalWidth || source.videoWidth || source.width, sh = source.naturalHeight || source.videoHeight || source.height;
  const k = Math.min(1, MAX_SIDE / Math.max(sw, sh));
  const c = canvas('photo', Math.max(1, Math.round(sw * k)), Math.max(1, Math.round(sh * k)));
  const g = c.getContext('2d');
  g.imageSmoothingQuality = 'high';
  g.drawImage(source, 0, 0, c.width, c.height);
  return c;
}

function canvas(key, w, h) {
  const c = scratch[key] || (scratch[key] = document.createElement('canvas'));
  c.width = w; c.height = h;
  return c;
}

// Detected people, biggest first, as { key: [x, y, visibility] } in pixels plus their torso length T.
function findPeople(landmarker, img) {
  const r = landmarker.detect(img);
  const people = r.landmarks.map(pts => {
    const P = {};
    for (const [k, i] of Object.entries(LM)) P[k] = [pts[i].x * img.width, pts[i].y * img.height, pts[i].visibility];
    P.T = dist(mid(P.ls, P.rs), mid(P.lh, P.rh));
    return P;
  });
  r.close();
  return people.sort((a, b) => b.T - a.T);
}

// A second, zoomed-in look at the main person: the model places joints more consistently when the body fills its
// view, so the readings don't drift with how far from the camera you stood. Returns null if the zoomed look fails.
function refine(landmarker, img, P) {
  const pts = Object.keys(LM).map(k => P[k]), xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
  const x0 = clamp(Math.min(...xs) - .7 * P.T, 0, img.width), x1 = clamp(Math.max(...xs) + .7 * P.T, 0, img.width);
  const y0 = clamp(Math.min(...ys) - .8 * P.T, 0, img.height), y1 = clamp(Math.max(...ys) + .4 * P.T, 0, img.height);
  const k = 900 / Math.max(x1 - x0, y1 - y0), c = canvas('zoom', Math.round((x1 - x0) * k), Math.round((y1 - y0) * k));
  const g = c.getContext('2d'); g.imageSmoothingQuality = 'high';
  g.drawImage(img, x0, y0, x1 - x0, y1 - y0, 0, 0, c.width, c.height);
  const Q = findPeople(landmarker, c)[0];
  if (!Q) return null;
  const R = {};
  for (const key of Object.keys(LM)) R[key] = [Q[key][0] / k + x0, Q[key][1] / k + y0, Q[key][2]];
  R.T = dist(mid(R.ls, R.rs), mid(R.lh, R.rh));
  // keep it only if it agrees with the first look: same torso, about the same length, shoulders above the hips
  const up = b => mid(b.lh, b.rh)[1] - mid(b.ls, b.rs)[1] > .5 * b.T;
  if (!up(R) || Math.abs(R.T / P.T - 1) > .25 || dist(torsoCenter(R), torsoCenter(P)) > .3 * P.T) return null;
  return R;
}

// A second detection counts as another person if it's at least half as big and stands beside the first one. The
// model sometimes adds a ghost torso on the same body (on the legs, or mirrored), which sits above or below it.
function isOther(Q, P) {
  return Q.T > .5 * P.T && Math.abs(torsoCenter(Q)[0] - torsoCenter(P)[0]) > .6 * P.T;
}

function torsoCenter(P) { return mid(mid(P.ls, P.rs), mid(P.lh, P.rh)); }

// The pose model often reports only the most prominent person. Paint over the main person and look again:
// a body at least half as big standing beside the painted box counts as someone else in the photo. (Shapes found
// above or below it, like big hair or a shadow, don't count: in a progress photo another person would stand beside.)
function secondPerson(landmarker, img, P) {
  const pts = Object.keys(LM).map(k => P[k]), xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
  const box = [Math.min(...xs) - .15 * P.T, Math.min(...ys) - .5 * P.T, Math.max(...xs) + .15 * P.T, Math.max(...ys) + .25 * P.T];
  const c = canvas('hide', img.width, img.height), g = c.getContext('2d');
  g.drawImage(img, 0, 0);
  g.fillStyle = '#808080';
  g.fillRect(box[0], box[1], box[2] - box[0], box[3] - box[1]);
  return findPeople(landmarker, c).some(Q => {
    const [x, y] = torsoCenter(Q);
    return Q.T > .5 * P.T && (x < box[0] || x > box[2]) && y > box[1] && y < box[3];
  });
}

const inFrame = (p, W, H, m) => p[0] >= m * W && p[0] <= (1 - m) * W && p[1] >= m * H && p[1] <= (1 - m) * H;

// Shoulders, hips and knees must be in the photo: the hip band needs body below it, and the knees let
// legsInMask() check that the hips weren't guessed (the model invents hips for belly-up photos).
function outOfFrame(P, W, H) {
  if (['ls', 'rs', 'lh', 'rh'].some(k => P[k][2] < .5 || !inFrame(P[k], W, H, .01))) return true;
  return ['lk', 'rk'].some(k => P[k][1] > H * .99);
}

// Crops chin-to-knee around the torso, runs the segmenter on it and returns the mask with the crop offset.
function segmentBody(segmenter, img, P) {
  const S = mid(P.ls, P.rs), Hm = mid(P.lh, P.rh), T = P.T;
  const x0 = clamp(Math.floor(Math.min(S[0], Hm[0]) - .95 * T), 0, img.width), x1 = clamp(Math.ceil(Math.max(S[0], Hm[0]) + .95 * T), 0, img.width);
  const y0 = clamp(Math.floor(Math.min(S[1], Hm[1]) - .5 * T), 0, img.height);
  const y1 = clamp(Math.ceil(Math.max(Hm[1] + 1.15 * T, P.lk[1] + .1 * T, P.rk[1] + .1 * T)), 0, img.height);
  const c = canvas('crop', x1 - x0, y1 - y0);
  c.getContext('2d').drawImage(img, x0, y0, c.width, c.height, 0, 0, c.width, c.height);
  const r = segmenter.segment(c);
  const m = r.confidenceMasks[0], mask = Float32Array.from(m.getAsFloat32Array());
  const out = { mask, w: m.width, h: m.height, x0, y0 };
  r.close();
  return out;
}

// The model invents hips and knees for photos cut at the belly. A full-length photo proves itself with both ankles
// clearly in the frame; otherwise the knees must sit on legs: on the outline, and narrower there than a torso
// (a photo cut at the belly has torso-wide "knees"; so, unfortunately, does a long coat).
function anklesInFrame(P, W, H) {
  return inFrame(P.la, W, H, .01) && inFrame(P.ra, W, H, .01) && P.la[2] + P.ra[2] >= 1;   // one may hide behind the other leg
}

function legsInMask(seg, L) {
  const F = bodyFrame(L), get = sampler(seg.mask, seg.w, seg.h);
  const runs = ['lk', 'rk'].map(k => { const [t, s] = F.ts(L[k]); return runAt(F, get, seg.w, seg.h, t, s); }).filter(Boolean);
  if (!runs.length || runs.some(r => r.cut)) return false;
  // width covered at knee height: one run when both knees share it (legs together), else both legs added up
  const [a, b] = runs, shared = b && a.l < b.r && b.l < a.r;
  const covered = shared ? Math.max(a.r, b.r) - Math.min(a.l, b.l) : runs.reduce((sum, r) => sum + r.w, 0);
  return covered < .8 * F.T;
}

// Signed shoulder-joint separation across the body, in torso lengths: + when the person faces the camera
// (their left shoulder appears on the right of the photo), - from behind, near 0 from the side.
function shoulderSep(P) {
  const F = bodyFrame(P);
  return ((P.ls[0] - P.rs[0]) * F.n[0] + (P.ls[1] - P.rs[1]) * F.n[1]) / F.T;
}

// 0..1: how sure the pose model is about the torso joints, and whether they sit on the outline.
function confidence(P, seg, L, F) {
  const vis = Math.min(...['ls', 'rs', 'lh', 'rh'].map(k => P[k][2]));
  const get = sampler(seg.mask, seg.w, seg.h), G = bodyFrame(L);
  let on = 0, n = 0;
  for (let t = 0; t <= 1; t += .05, n++) on += get(...G.at(t, 0)) >= .5;
  return vis * (on / n);
}

function publicLm(P, W, H) {
  return Object.fromEntries(PUBLIC_LM.map(k => [k, P[k][2] >= .5 && inFrame(P[k], W, H, 0) ? [round(P[k][0] / W), round(P[k][1] / H)] : null]));
}

// ---------- geometry (pure; exported for unit tests) ----------

// mask: Float32Array (width*height, row-major, 0..1 person probability). lmPx: { ls, rs, lh, rh, le, re, lw, rw,
// li, ri, ... } as [x, y] or [x, y, visibility] in mask pixels (elbows, wrists and index fingers are used to spot
// arms touching the body; missing ones are skipped). pose: "front" | "back" | "side".
// Returns { m, lines, flags }: widths divided by torso length, the measured lines in mask pixels, and warnings.
export function measure(mask, width, height, lmPx, pose) {
  const F = bodyFrame(lmPx);
  if (!F) return { m: {}, lines: {}, flags: ['low-confidence'] };
  const get = sampler(mask, width, height), arms = armCrossings(F, lmPx), side = pose === 'side';
  const band = name => scan(F, get, width, height, arms, BAND[name], side);
  const m = {}, lines = {}, flags = [];
  const take = (name, pick, mode) => {
    if (pick.arms) flags.push('arms-touching');
    if (!pick.line) return null;
    m[name] = round(pick.w / F.T);
    lines[name] = [...F.at(pick.line.t, pick.line.l), ...F.at(pick.line.t, pick.line.r)].map(v => round(v, 1));
    return pick.line;
  };
  if (side) {
    take('chest', choose(band('chest'), 'median', F.T));
    take('belly', choose(band('belly'), 'max', F.T));
  } else {
    const sh = take('shoulder', choose(band('shoulder'), 'max', F.T, true));
    take('waist', choose(band('waist'), 'min', F.T));
    const hp = take('hip', choose(band('hip'), 'max', F.T));
    if (m.shoulder && m.waist) m.taper = round(m.shoulder / m.waist);
    if (m.waist && m.hip) m.waistHip = round(m.waist / m.hip);
    if (isTurned(F, lmPx, [sh, hp])) flags.push('turned');
    if (armsOut(F, lmPx) > 35) flags.push('arms-out');   // shoulder reading includes more of the arms
    if (m.taper < 1.08) flags.push('loose-clothing?');   // a waist nearly as wide as the shoulders: usually a coat or baggy top
  }
  if (Math.abs(Math.atan2(F.u[0], F.u[1])) > 8 * Math.PI / 180) flags.push('tilted');
  return { m, lines, flags: [...new Set(flags)] };
}

// Body frame: S = shoulder midpoint, u = unit vector down the torso to the hip midpoint, n = across it
// (image-right when upright). A point is (t, s): t torso lengths down the axis from S, s pixels across.
function bodyFrame(L) {
  if (!L.ls || !L.rs || !L.lh || !L.rh) return null;
  const S = mid(L.ls, L.rs), H = mid(L.lh, L.rh), T = dist(S, H);
  if (!(T > 4)) return null;
  const u = [(H[0] - S[0]) / T, (H[1] - S[1]) / T], n = [u[1], -u[0]];
  return {
    S, T, u, n,
    at: (t, s) => [S[0] + u[0] * t * T + n[0] * s, S[1] + u[1] * t * T + n[1] * s],
    ts: p => [((p[0] - S[0]) * u[0] + (p[1] - S[1]) * u[1]) / T, (p[0] - S[0]) * n[0] + (p[1] - S[1]) * n[1]],
  };
}

// Bilinear mask lookup at a continuous pixel position; outside the image counts as background.
function sampler(mask, w, h) {
  const v = (i, j) => i < 0 || j < 0 || i >= w || j >= h ? 0 : mask[j * w + i];
  return (x, y) => {
    const fx = x - .5, fy = y - .5, i = Math.floor(fx), j = Math.floor(fy), a = fx - i, b = fy - j;
    return (v(i, j) * (1 - a) + v(i + 1, j) * a) * (1 - b) + (v(i, j + 1) * (1 - a) + v(i + 1, j + 1) * a) * b;
  };
}

const STEP = .5;   // px between samples along a measuring line

// The run of body pixels (mask >= .5) across the body at depth t that contains offset s0 (default: the midline).
// Edges are sub-pixel (interpolated where the mask crosses .5). null if s0 isn't on the body; cut: true when the
// run reaches the photo edge or 1.2 torso lengths (arms held out, something touching).
function runAt(F, get, w, h, t, s0 = 0) {
  const [ox, oy] = F.at(t, 0), [nx, ny] = F.n;
  const val = s => get(ox + nx * s, oy + ny * s);
  if (val(s0) < .5) return null;
  let cut = false;
  const edge = dir => {
    let prev = val(s0), s = s0;
    while (Math.abs(s - s0) < 1.2 * F.T) {
      s += dir * STEP;
      const v = val(s);
      if (v < .5) {
        const e = s - dir * STEP * (1 - (prev - .5) / (prev - v)), x = ox + nx * e, y = oy + ny * e;
        if (x < 1 || y < 1 || x > w - 1 || y > h - 1) cut = true;
        return e;
      }
      prev = v;
    }
    cut = true;
    return s;
  };
  const l = edge(-1), r = edge(1);
  return { t, l, r, w: r - l, cut };
}

// Where each arm (shoulder > elbow > wrist > index finger) crosses the measuring line at depth t: offset s of its
// centre line, and k = how much wider than the arm itself the crossing is (1 when the arm is square to the line).
function armCrossings(F, L) {
  const chains = [['ls', 'le', 'lw', 'li'], ['rs', 're', 'rw', 'ri']].map(c => c.filter(k => L[k]).map(k => F.ts(L[k])));
  return t => chains.flatMap(pts => pts.slice(1).flatMap((b, i) => {
    const a = pts[i], dt = (b[0] - a[0]) * F.T, ds = b[1] - a[1];
    if ((a[0] - t) * (b[0] - t) > 0 || !dt) return [];
    return [{ s: a[1] + ds * (t - a[0]) * F.T / dt, k: Math.min(3, Math.hypot(dt, ds) / Math.abs(dt)) }];
  }));
}

// Measures every line of a band (one per pixel down the axis) and marks lines an arm may be part of. Front/back:
// the arm's centre line lies inside the run (no gap to the torso). Side: the arm overlaps the torso anyway, so only
// an arm reaching the front or back edge counts (centre within its own half-width of the edge, plus some slack).
function scan(F, get, w, h, arms, [t0, t1], side) {
  const out = [], tol = .035 * F.T;
  for (let t = t0; t <= t1 + 1e-9; t += 1 / F.T) {
    const run = runAt(F, get, w, h, t);
    if (!run || run.cut) { out.push(null); continue; }
    run.arm = arms(t).some(({ s, k }) => {
      if (!side) return s > run.l - tol && s < run.r + tol;
      const zone = .06 * F.T * k + tol;
      return (s > run.l - tol && s < run.l + zone) || (s > run.r - zone && s < run.r + tol);
    });
    out.push(run);
  }
  return out;
}

// Picks the band's reading: widest, narrowest or median line, after averaging widths over +-1.5% of the torso
// (lines are 1 px apart). Skips the band (arms: true) when arms touch too many lines, and returns nothing when the
// outline is missing on most of it.
function choose(lines, mode, T, ignoreArms = false) {
  const valid = lines.filter(Boolean), clean = valid.filter(x => ignoreArms || !x.arm);
  if (valid.length < lines.length * .4) return {};
  if (clean.length < valid.length * .7 || !clean.length) return { arms: true };
  const k = Math.max(1, Math.round(.015 * T));
  const smooth = clean.map((x, i) => { const near = clean.slice(Math.max(0, i - k), i + k + 1); return near.reduce((a, y) => a + y.w, 0) / near.length; });
  let best = 0;
  if (mode === 'median') best = smooth.map((w, i) => [w, i]).sort((a, b) => a[0] - b[0])[smooth.length >> 1][1];
  else smooth.forEach((w, i) => { if (mode === 'max' ? w > smooth[best] : w < smooth[best]) best = i; });
  return { line: clean[best], w: smooth[best], arms: clean.length < valid.length * .85 };
}

// Front/back photo taken with the body turned: shoulder joints unusually close across the body, or the shoulder
// and hip outlines lopsided about the spine line (square-on they're within ~5%; about 30 degrees turned, ~13%).
function isTurned(F, L, lines) {
  const sep = Math.abs((L.ls[0] - L.rs[0]) * F.n[0] + (L.ls[1] - L.rs[1]) * F.n[1]) / F.T;
  const lop = lines.filter(Boolean).map(x => Math.abs(x.r + x.l) / (x.r - x.l));
  return sep < .42 || (lop.length > 0 && lop.reduce((a, b) => a + b) / lop.length > .1);
}

// Average angle (degrees) between the upper arms and the torso axis; 0 when hanging straight down.
function armsOut(F, L) {
  const angles = [['ls', 'le'], ['rs', 're']].filter(([s, e]) => L[s] && L[e]).map(([s, e]) => {
    const v = [L[e][0] - L[s][0], L[e][1] - L[s][1]];
    return Math.acos(clamp((v[0] * F.u[0] + v[1] * F.u[1]) / Math.hypot(v[0], v[1]), -1, 1)) * 180 / Math.PI;
  });
  return angles.length ? angles.reduce((a, b) => a + b) / angles.length : 0;
}

// ---------- small helpers ----------

function mid(a, b) { return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]; }
function dist(a, b) { return Math.hypot(a[0] - b[0], a[1] - b[1]); }
function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }
function round(v, d = 4) { const k = 10 ** d; return Math.round(v * k) / k; }
function shift(P, dx, dy) {
  return Object.fromEntries(Object.entries(P).map(([k, v]) => [k, Array.isArray(v) ? [v[0] + dx, v[1] + dy, ...v.slice(2)] : v]));
}
