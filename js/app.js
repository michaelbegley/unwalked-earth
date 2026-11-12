let META = null,
  NAMES = null;
// researched notes for the dotted places and the named regions, loaded from data/places.json
let LANDMARKS = [],
  REGIONS = [];
const $ = (id) => document.getElementById(id);
const canvas = $("globe"),
  ctx = canvas.getContext("2d"),
  card = $("card");
const WORLD_W = 4096,
  WORLD_H = 2048,
  NAMES_W = 2048,
  NAMES_H = 1024;
let world = null,
  nameTex = null;
const calm = matchMedia("(prefers-reduced-motion: reduce)").matches;
const view = { lon: 25, lat: 12, k: 1, spin: !calm, sel: null, arc: null };
let spinning = false;
const buffer = document.createElement("canvas"),
  bufferCtx = buffer.getContext("2d");
let dpr = 1,
  canvasW = 0,
  canvasH = 0,
  baseRadius = 0,
  centerX = 0,
  centerY = 0;

// walked land is plain, unwalked land is orange
const RAMP = [
  [0, 238, 236, 230],
  [20, 238, 236, 230],
  [42, 251, 221, 178],
  [68, 255, 159, 10],
  [100, 226, 70, 0],
];
function ramp(s) {
  for (let i = 1; i < RAMP.length; i++) {
    if (s <= RAMP[i][0]) {
      const a = RAMP[i - 1],
        b = RAMP[i],
        t = (s - a[0]) / (b[0] - a[0]);
      return [a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t, a[3] + (b[3] - a[3]) * t];
    }
  }
  return [226, 70, 0];
}
const palette = new Uint8Array(768);
for (let r = 1; r < 256; r++) {
  const c = ramp((r - 1) / 2.54);
  palette[r * 3] = c[0];
  palette[r * 3 + 1] = c[1];
  palette[r * 3 + 2] = c[2];
}
palette[0] = 176;
palette[1] = 210;
palette[2] = 240; // sea
let levels = null; // the same grid at half, quarter and eighth size, for when the globe is small
let shown = null; // display scores, lightly smoothed so the land reads as clean shapes
function pyramid(base) {
  const n = WORLD_W * WORLD_H,
    land0 = new Uint8Array(n);
  for (let i = 0; i < n; i++) land0[i] = base[i] ? 255 : 0;
  const out = [{ land: land0, mean: base }];
  for (let lv = 1; lv <= 3; lv++) {
    const up = out[lv - 1],
      uw = WORLD_W >> (lv - 1),
      w = WORLD_W >> lv,
      h = WORLD_H >> lv,
      land = new Uint8Array(w * h),
      mean = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * 2 * uw + x * 2,
          a = up.land[i],
          b = up.land[i + 1],
          c = up.land[i + uw],
          d = up.land[i + uw + 1],
          sum = a + b + c + d;
        land[y * w + x] = (sum + 2) >> 2;
        if (sum)
          mean[y * w + x] =
            (up.mean[i] * a + up.mean[i + 1] * b + up.mean[i + uw] * c + up.mean[i + uw + 1] * d) / sum + 0.5;
      }
    }
    out.push({ land, mean });
  }
  return out;
}
function smooth() {
  const n = WORLD_W * WORLD_H,
    a = new Uint8Array(n),
    b = new Uint8Array(n);
  for (let i = 0; i < n; i++) a[i] = world[i * 4];
  for (let y = 0; y < WORLD_H; y++) {
    const o = y * WORLD_W;
    for (let x = 0; x < WORLD_W; x++) {
      const c = a[o + x];
      if (!c) continue;
      let s = 0,
        k = 0;
      for (let d = -2; d <= 2; d++) {
        const v = a[o + ((x + d + WORLD_W) % WORLD_W)];
        if (v) {
          s += v;
          k++;
        }
      }
      b[o + x] = (s / k + 0.5) | 0;
    }
  }
  for (let y = 0; y < WORLD_H; y++) {
    const o = y * WORLD_W;
    for (let x = 0; x < WORLD_W; x++) {
      const c = b[o + x];
      if (!c) continue;
      let s = 0,
        k = 0;
      for (let d = -2; d <= 2; d++) {
        const yy = y + d;
        if (yy < 0 || yy >= WORLD_H) continue;
        const v = b[yy * WORLD_W + x];
        if (v) {
          s += v;
          k++;
        }
      }
      a[o + x] = Math.max(1, (s / k + 0.5) | 0);
    }
  }
  shown = a;
  levels = pyramid(a);
}
function sky() {
  const c = $("sky"),
    x = c.getContext("2d");
  c.width = canvasW;
  c.height = canvasH;
  x.fillStyle = "#05060b";
  x.fillRect(0, 0, canvasW, canvasH);
  let s = 20261111;
  const rnd = () => {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const n = Math.round((canvasW * canvasH) / (2600 * dpr * dpr));
  for (let i = 0; i < n; i++) {
    const px = rnd() * canvasW,
      py = rnd() * canvasH,
      m = rnd(),
      r = (m > 0.985 ? 1.5 : m > 0.9 ? 1 : 0.6) * dpr,
      a = 0.25 + rnd() * 0.65,
      w = rnd();
    x.fillStyle =
      w > 0.9 ? `rgba(190,210,255,${a})` : w < 0.08 ? `rgba(255,232,205,${a})` : `rgba(255,255,255,${a})`;
    x.beginPath();
    x.arc(px, py, r, 0, 7);
    x.fill();
  }
}

// the card becomes a bottom sheet on phones and upright tablets; keep in step with style.css
const sheet = matchMedia("(max-width: 700px), (max-width: 1000px) and (orientation: portrait)");
function size() {
  dpr = Math.min(window.devicePixelRatio || 1, sheet.matches ? 2 : 1.5);
  canvasW = Math.max(200, Math.round(innerWidth * dpr));
  canvasH = Math.max(200, Math.round(innerHeight * dpr));
  canvas.width = canvasW;
  canvas.height = canvasH;
  const r = card.getBoundingClientRect();
  if (sheet.matches) {
    const free = (r.top - 8) * dpr;
    baseRadius = Math.min(canvasW, free) * 0.46;
    centerX = canvasW / 2;
    centerY = free / 2 + 4 * dpr;
  } else {
    const left = r.right * dpr;
    baseRadius = Math.min(canvasW - left, canvasH) * 0.46;
    centerX = left + (canvasW - left) / 2;
    centerY = canvasH / 2;
  }
  sky();
  draw(1);
}
const RAD = Math.PI / 180;
function sunAt(ms) {
  // where the sun is overhead: [lat, lon], good to a few degrees
  const d = new Date(ms),
    day =
      (Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - Date.UTC(d.getUTCFullYear(), 0, 0)) /
      864e5;
  const hrs = d.getUTCHours() + d.getUTCMinutes() / 60;
  return [-23.44 * Math.cos((2 * Math.PI * (day + 10)) / 365), ((180 - 15 * hrs + 540) % 360) - 180];
}
function isDay(lat, lon) {
  const s = sunAt(Date.now()),
    a = lat * RAD,
    b = s[0] * RAD;
  return Math.sin(a) * Math.sin(b) + Math.cos(a) * Math.cos(b) * Math.cos((lon - s[1]) * RAD) > 0;
}
function draw(q) {
  if (!world || !levels) return;
  const w = Math.max(2, Math.round(canvasW * q)),
    h = Math.max(2, Math.round(canvasH * q));
  if (buffer.width !== w || buffer.height !== h) {
    buffer.width = w;
    buffer.height = h;
  }
  const img = bufferCtx.createImageData(w, h),
    px = new Uint32Array(img.data.buffer);
  const R = baseRadius * view.k * q,
    cx = centerX * q,
    cy = centerY * q,
    sp = Math.sin(view.lat * RAD),
    cp = Math.cos(view.lat * RAD),
    l0 = view.lon * RAD;
  const x0 = Math.max(0, Math.floor(cx - R)),
    x1 = Math.min(w, Math.ceil(cx + R)),
    y0 = Math.max(0, Math.floor(cy - R)),
    y1 = Math.min(h, Math.ceil(cy + R));

  const iR = 1 / R,
    TWO = Math.PI * 2,
    fine = q >= 1,
    rim0 = (1 - 1.5 * iR) * (1 - 1.5 * iR),
    rim1 = (1 + 0.5 * iR) * (1 + 0.5 * iR),
    perPixel = WORLD_H / (R * Math.PI),
    crisp = Math.min(6, Math.max(1, 1.6 / perPixel));
  const sun = sunAt(Date.now()),
    sp2 = sun[0] * RAD,
    sd = (sun[1] - view.lon) * RAD,
    sc = Math.cos(sp2);
  const sunx = sc * Math.sin(sd),
    suny = cp * Math.sin(sp2) - sp * sc * Math.cos(sd),
    sunz = sp * Math.sin(sp2) + cp * sc * Math.cos(sd);
  for (let j = y0; j < y1; j++) {
    const yRow = (cy - j - 0.5) * iR,
      yy = yRow * yRow;
    let o = j * w + x0;
    for (let i = x0; i < x1; i++, o++) {
      let x = (i + 0.5 - cx) * iR,
        rr = x * x + yy;
      if (rr >= rim1) continue;
      // fade the last pixel so the edge of the globe is not stepped
      let y = yRow,
        edge = 255;
      if (rr > rim0) {
        const d = Math.sqrt(rr);
        edge = ((1 - d) * R + 0.5) * 255;
        edge = edge < 0 ? 0 : edge > 255 ? 255 : edge | 0;
        if (d > 1) {
          x /= d;
          y /= d;
          rr = 1;
        }
      }
      const z = Math.sqrt(1 - rr);
      const la = Math.asin(y * cp + z * sp);
      let lo = l0 + Math.atan2(x, z * cp - y * sp);
      lo -= TWO * Math.floor((lo + Math.PI) / TWO);
      // pick the map level whose cells are about one pixel here
      const span = perPixel / (z > 0.2 ? z : 0.2),
        lv = span <= 1.3 ? 0 : span <= 2.6 ? 1 : span <= 5.2 ? 2 : 3,
        lw = WORLD_W >> lv,
        lh = WORLD_H >> lv,
        land = levels[lv].land,
        mean = levels[lv].mean;
      const fx = ((lo + Math.PI) / TWO) * lw,
        fy = ((Math.PI / 2 - la) / Math.PI) * lh;
      let tx = fx | 0;
      if (tx >= lw) tx = lw - 1;
      let ty = fy | 0;
      if (ty >= lh) ty = lh - 1;
      const at = ty * lw + tx;
      let r = mean[at],
        f = land[at] / 255;
      if (fine) {
        // blend neighbouring cells so scores and coastlines are smooth
        const ax = fx - tx - 0.5,
          ay = fy - ty - 0.5,
          sx = ax < 0 ? -1 : 1,
          sy = ay < 0 ? -1 : 1,
          wx = Math.abs(ax),
          wy = Math.abs(ay);
        const tx2 = (tx + sx + lw) % lw,
          ty2 = Math.min(lh - 1, Math.max(0, ty + sy)),
          bt = ty * lw + tx2,
          ct = ty2 * lw + tx,
          dt = ty2 * lw + tx2;
        const w0 = (1 - wx) * (1 - wy) * land[at],
          w1 = wx * (1 - wy) * land[bt],
          w2 = (1 - wx) * wy * land[ct],
          w3 = wx * wy * land[dt],
          sum = w0 + w1 + w2 + w3;
        f = sum / 255;
        if (sum > 0)
          r = Math.max(1, ((mean[at] * w0 + mean[bt] * w1 + mean[ct] * w2 + mean[dt] * w3) / sum + 0.5) | 0);
        // tighten the coast as you zoom in, so it stays a clean line
        if (lv === 0) f = (f - 0.5) * crisp + 0.5;
        f = f < 0 ? 0 : f > 1 ? 1 : f;
      }
      let lit = (x * sunx + y * suny + z * sunz + 0.12) / 0.24;
      lit = lit < 0 ? 0 : lit > 1 ? 1 : lit;
      const sh = (0.9 + 0.1 * z) * (0.72 + 0.28 * lit),
        q3 = r * 3,
        g1 = 1 - f;
      px[o] =
        (edge << 24) |
        (((palette[q3 + 2] * f + palette[2] * g1) * sh) << 16) |
        (((palette[q3 + 1] * f + palette[1] * g1) * sh) << 8) |
        ((palette[q3] * f + palette[0] * g1) * sh);
    }
  }
  bufferCtx.putImageData(img, 0, 0);
  ctx.clearRect(0, 0, canvasW, canvasH);
  const RR = baseRadius * view.k,
    halo = ctx.createRadialGradient(centerX, centerY, RR * 0.98, centerX, centerY, RR * 1.07);
  halo.addColorStop(0, "rgba(120,175,255,.55)");
  halo.addColorStop(1, "rgba(120,175,255,0)");
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(centerX, centerY, RR * 1.07, 0, 7);
  ctx.fill();
  ctx.imageSmoothingEnabled = q < 1;
  ctx.drawImage(buffer, 0, 0, canvasW, canvasH);
  overlay();
}
function proj(lat, lon) {
  const p = lat * RAD,
    dl = (lon - view.lon) * RAD,
    sp = Math.sin(view.lat * RAD),
    cp = Math.cos(view.lat * RAD),
    c = Math.cos(p);
  const z = sp * Math.sin(p) + cp * c * Math.cos(dl);
  const R = baseRadius * view.k;
  return [centerX + c * Math.sin(dl) * R, centerY - (cp * Math.sin(p) - sp * c * Math.cos(dl)) * R, z];
}
function unproj(mx, my) {
  const R = baseRadius * view.k,
    x = (mx - centerX) / R,
    y = (centerY - my) / R,
    rr = x * x + y * y;
  if (rr >= 1) return null;
  const z = Math.sqrt(1 - rr),
    sp = Math.sin(view.lat * RAD),
    cp = Math.cos(view.lat * RAD);
  let lo = view.lon + Math.atan2(x, z * cp - y * sp) / RAD;
  lo = ((lo + 540) % 360) - 180;
  return [Math.asin(y * cp + z * sp) / RAD, lo];
}
function overlay() {
  const R = baseRadius * view.k;

  ctx.strokeStyle = "rgba(110,110,115,.38)";
  ctx.lineWidth = 0.7 * dpr;
  ctx.beginPath();
  for (const b of META.borders) {
    let pen = false;
    for (let i = 0; i < b.length; i += 2) {
      const p = proj(b[i + 1], b[i]);
      if (p[2] > 0.02) {
        pen ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]);
        pen = true;
      } else pen = false;
    }
  }
  ctx.stroke();
  for (const s of LANDMARKS) {
    const p = proj(s.lat, s.lon);
    if (p[2] < 0.05) continue;
    ctx.beginPath();
    ctx.arc(p[0], p[1], 4.5 * dpr, 0, 7);
    ctx.fillStyle = "#1d1d1f";
    ctx.fill();
    ctx.lineWidth = 1.5 * dpr;
    ctx.strokeStyle = "#fff";
    ctx.stroke();
  }
  if (view.arc) {
    const a = vec(view.arc[0], view.arc[1]),
      b = vec(view.arc[2], view.arc[3]),
      om = Math.acos(Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2])));
    if (om > 1e-4) {
      ctx.beginPath();
      let pen = false;
      for (let i = 0; i <= 64; i++) {
        const u = i / 64,
          s1 = Math.sin((1 - u) * om) / Math.sin(om),
          s2 = Math.sin(u * om) / Math.sin(om),
          x = a[0] * s1 + b[0] * s2,
          y = a[1] * s1 + b[1] * s2,
          z = a[2] * s1 + b[2] * s2,
          p = proj(Math.asin(z) / RAD, Math.atan2(y, x) / RAD);
        if (p[2] > 0.02) {
          pen ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]);
          pen = true;
        } else pen = false;
      }
      ctx.setLineDash([6 * dpr, 5 * dpr]);
      ctx.lineWidth = 2 * dpr;
      ctx.strokeStyle = "#0071e3";
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }
  if (view.sel) {
    const p = proj(view.sel[0], view.sel[1]);
    if (p[2] > 0.05) {
      ctx.beginPath();
      ctx.arc(p[0], p[1], 8 * dpr, 0, 7);
      ctx.lineWidth = 5 * dpr;
      ctx.strokeStyle = "#fff";
      ctx.stroke();
      ctx.lineWidth = 2.5 * dpr;
      ctx.strokeStyle = "#0071e3";
      ctx.stroke();
    }
  }
}
let raf = 0,
  settle = 0;
function kick() {
  if (!raf)
    raf = requestAnimationFrame(() => {
      raf = 0;
      draw(0.5);
    });
  clearTimeout(settle);
  settle = setTimeout(() => draw(1), 140);
}
let last = 0;
function spin(t) {
  if (!view.spin) return;
  if (last) {
    view.lon = ((view.lon + (t - last) * 0.003 + 540) % 360) - 180;
    draw(0.5);
  }
  last = t;
  requestAnimationFrame(spin);
}
function stopSpin() {
  if (view.spin) {
    view.spin = false;
    draw(1);
  }
}

// ---- moving the globe: grab a point and it stays under your finger, throw it and it keeps turning
let motion = 0,
  zoomGoal = 1,
  zoomAnchor = null,
  zoomFrame = 0,
  coasting = 0;
const KMIN = 0.8,
  KMAX = 10,
  clampK = (k) => Math.min(KMAX, Math.max(KMIN, k));
function hold(lat, lon, sx, sy) {
  // turn the globe so that (lat,lon) sits at screen point (sx,sy)
  const R = baseRadius * view.k;
  let x = (sx - centerX) / R,
    y = (centerY - sy) / R;
  const rr = Math.hypot(x, y);
  if (rr > 0.97) {
    x *= 0.97 / rr;
    y *= 0.97 / rr;
  }
  const p = lat * RAD,
    c = Math.cos(p),
    s = Math.sin(p);
  const dl = Math.asin(Math.max(-1, Math.min(1, x / Math.max(c, 1e-6)))),
    C = c * Math.cos(dl),
    Rm = Math.hypot(s, C) || 1e-6;
  const f = Math.acos(Math.max(-1, Math.min(1, y / Rm))) - Math.atan2(C, s);
  view.lat = Math.max(-89.5, Math.min(89.5, f / RAD));
  view.lon = ((lon - dl / RAD + 540) % 360) - 180;
}
function halt() {
  motion++;
  coasting = 0;
  spinning = false;
  if (zoomFrame) {
    cancelAnimationFrame(zoomFrame);
    zoomFrame = 0;
  }
  zoomGoal = view.k;
}
function zoomTo(k, anchor) {
  // ease toward a zoom level, keeping the anchored point where it is on screen
  stopSpin();
  coasting = 0;
  zoomGoal = clampK(k);
  zoomAnchor = anchor || null;
  if (zoomFrame) return;
  (function step() {
    view.k += (zoomGoal - view.k) * 0.22;
    if (Math.abs(zoomGoal - view.k) < 0.004 * view.k) view.k = zoomGoal;
    if (zoomAnchor) hold(zoomAnchor[0], zoomAnchor[1], zoomAnchor[2], zoomAnchor[3]);
    if (view.k === zoomGoal) {
      zoomFrame = 0;
      draw(1);
    } else {
      draw(0.5);
      zoomFrame = requestAnimationFrame(step);
    }
  })();
}
function throwIt(vlon, vlat) {
  const id = ++coasting;
  let last = performance.now();
  (function step(t) {
    if (id !== coasting) return;
    const dt = Math.min(50, t - last);
    last = t;
    view.lon = ((view.lon + vlon * dt + 540) % 360) - 180;
    view.lat += vlat * dt;
    if (view.lat > 89.5 || view.lat < -89.5) {
      view.lat = Math.max(-89.5, Math.min(89.5, view.lat));
      vlat = 0;
    }
    const d = Math.exp(-dt / 650);
    vlon *= d;
    vlat *= d;
    if (Math.hypot(vlon, vlat) < 0.003) {
      coasting = 0;
      draw(1);
    } else {
      draw(0.5);
      requestAnimationFrame(step);
    }
  })(last);
}
const pointers = new Map();
let pinch0 = 0,
  k0 = 1,
  moved = false,
  grab = null,
  pgrab = null,
  trail = [],
  lastTap = [0, 0, 0];
function pos(e) {
  const r = canvas.getBoundingClientRect();
  return [(e.clientX - r.left) * dpr, (e.clientY - r.top) * dpr];
}
function mid() {
  const a = [...ptrs.values()];
  return [(a[0][0] + a[1][0]) / 2, (a[0][1] + a[1][1]) / 2, Math.hypot(a[0][0] - a[1][0], a[0][1] - a[1][1])];
}
canvas.addEventListener("pointerdown", (e) => {
  stopSpin();
  halt();
  canvas.setPointerCapture(e.pointerId);
  const p = pos(e);
  pointers.set(e.pointerId, p);
  moved = false;
  canvas.classList.add("drag");
  trail = [];
  if (pointers.size === 1) {
    grab = unproj(p[0], p[1]);
  } else if (pointers.size === 2) {
    moved = true;
    const m = mid();
    pinch0 = m[2];
    k0 = view.k;
    pgrab = unproj(m[0], m[1]);
  }
});
canvas.addEventListener("pointermove", (e) => {
  if (!pointers.has(e.pointerId)) return;
  const was = pointers.get(e.pointerId),
    p = pos(e);
  pointers.set(e.pointerId, p);
  if (pointers.size === 2) {
    const m = mid();
    view.k = clampK((k0 * m[2]) / pinch0);
    zoomGoal = view.k;
    if (pgrab) hold(pgrab[0], pgrab[1], m[0], m[1]);
    kick();
    return;
  }
  if (Math.abs(p[0] - was[0]) + Math.abs(p[1] - was[1]) > 3 * dpr) moved = true;
  if (!moved) return;
  if (grab) hold(grab[0], grab[1], p[0], p[1]);
  else {
    const f = 1 / (baseRadius * view.k) / RAD;
    view.lon = ((view.lon - (p[0] - was[0]) * f + 540) % 360) - 180;
    view.lat = Math.max(-89.5, Math.min(89.5, view.lat + (p[1] - was[1]) * f));
  }
  const now = performance.now();
  trail.push([now, view.lon, view.lat]);
  while (trail.length > 2 && now - trail[0][0] > 110) trail.shift();
  kick();
});
function up(e) {
  if (!pointers.has(e.pointerId)) return;
  const p = pointers.get(e.pointerId),
    two = pointers.size === 2;
  pointers.delete(e.pointerId);
  if (!pointers.size) canvas.classList.remove("drag");
  if (two) {
    const r = [...ptrs.values()][0];
    grab = r ? unproj(r[0], r[1]) : null;
    trail = [];
    return;
  }
  if (e.type !== "pointerup") return;
  if (!moved) {
    const now = performance.now();
    if (now - lastTap[0] < 320 && Math.hypot(p[0] - lastTap[1], p[1] - lastTap[2]) < 30 * dpr) {
      const g = unproj(p[0], p[1]);
      zoomTo(view.k * 2, g ? [g[0], g[1], p[0], p[1]] : null);
      lastTap = [0, 0, 0];
    } else {
      lastTap = [now, p[0], p[1]];
      pick(p[0], p[1]);
    }
    return;
  }
  if (trail.length > 1 && !calm) {
    const a = trail[0],
      b = trail[trail.length - 1],
      dt = b[0] - a[0];
    if (dt > 15 && performance.now() - b[0] < 60) {
      const vlon = (((b[1] - a[1] + 540) % 360) - 180) / dt,
        vlat = (b[2] - a[2]) / dt;
      if (Math.hypot(vlon, vlat) > 0.012) throwIt(vlon, vlat);
    }
  }
}
canvas.addEventListener("pointerup", up);
canvas.addEventListener("pointercancel", up);
canvas.addEventListener(
  "wheel",
  (e) => {
    e.preventDefault();
    stopSpin();
    coasting = 0;
    motion++;
    const p = pos(e),
      g = unproj(p[0], p[1]);
    zoomTo(
      (zoomFrame ? zoomGoal : view.k) * Math.exp(-e.deltaY * 0.0022),
      g ? [g[0], g[1], p[0], p[1]] : null,
    );
  },
  { passive: false },
);
$("zin").onclick = () => zoomTo((zoomFrame ? zoomGoal : view.k) * 1.7);
$("zout").onclick = () => zoomTo((zoomFrame ? zoomGoal : view.k) / 1.7);
addEventListener("keydown", (e) => {
  const tag = (e.target && e.target.tagName) || "";
  if (tag === "INPUT" || tag === "TEXTAREA" || e.metaKey || e.ctrlKey || e.altKey) return;
  const step = 18 / view.k,
    k = e.key;
  if (k === "ArrowLeft" || k === "ArrowRight" || k === "ArrowUp" || k === "ArrowDown") {
    e.preventDefault();
    stopSpin();
    halt();
    if (k === "ArrowLeft") view.lon = ((view.lon - step + 540) % 360) - 180;
    if (k === "ArrowRight") view.lon = ((view.lon + step + 540) % 360) - 180;
    if (k === "ArrowUp") view.lat = Math.min(89.5, view.lat + step);
    if (k === "ArrowDown") view.lat = Math.max(-89.5, view.lat - step);
    kick();
  } else if (k === "+" || k === "=") zoomTo((zoomFrame ? zoomGoal : view.k) * 1.7);
  else if (k === "-" || k === "_") zoomTo((zoomFrame ? zoomGoal : view.k) / 1.7);
  else if (k === "r" || k === "R") lucky();
  else if (k === " " && tag !== "BUTTON") {
    e.preventDefault();
    stopSpin();
    halt();
    draw(1);
  }
});

const WAYS_IN = ["Road, railway or track", "Town, airstrip, mine or other site", "Coast", "River"];
const number = (n) => Math.round(n).toLocaleString("en-US");
const coords = (lat, lon) =>
  Math.abs(lat).toFixed(2) +
  "° " +
  (lat < 0 ? "S" : "N") +
  ", " +
  Math.abs(lon).toFixed(2) +
  "° " +
  (lon < 0 ? "W" : "E");
function vec(lat, lon) {
  const a = lat * RAD,
    b = lon * RAD,
    c = Math.cos(a);
  return [c * Math.cos(b), c * Math.sin(b), Math.sin(a)];
}
function nearest(lat, lon) {
  // closest cell scoring 70 or more: [lat, lon, km]
  const v = vec(lat, lon);
  let best = -2,
    bi = -1;
  for (const list of [polarSpots, otherSpots])
    for (let j = 0; j < list.length; j++) {
      const i = list[j],
        y = (i / WORLD_W) | 0,
        x = i - y * WORLD_W,
        w = vec(90 - ((y + 0.5) * 180) / WORLD_H, -180 + ((x + 0.5) * 360) / WORLD_W),
        d = v[0] * w[0] + v[1] * w[1] + v[2] * w[2];
      if (d > best) {
        best = d;
        bi = i;
      }
    }
  if (bi < 0) return null;
  const y = (bi / WORLD_W) | 0,
    x = bi - y * WORLD_W;
  return [
    90 - ((y + 0.5) * 180) / WORLD_H,
    -180 + ((x + 0.5) * 360) / WORLD_W,
    6371 * Math.acos(Math.min(1, best)),
  ];
}
function compass(la1, lo1, la2, lo2) {
  const a = la1 * RAD,
    b = la2 * RAD,
    d = (lo2 - lo1) * RAD,
    th =
      Math.atan2(
        Math.sin(d) * Math.cos(b),
        Math.cos(a) * Math.sin(b) - Math.sin(a) * Math.cos(b) * Math.cos(d),
      ) / RAD;
  return ["north", "north-east", "east", "south-east", "south", "south-west", "west", "north-west"][
    Math.round(((th + 360) % 360) / 45) % 8
  ];
}
function nameAt(lat, lon) {
  const x = Math.min(NAMES_W - 1, (((lon + 180) / 360) * NAMES_W) | 0),
    y = Math.min(NAMES_H - 1, (((90 - lat) / 180) * NAMES_H) | 0),
    o = (y * NAMES_W + x) * 4;
  const c = nameTex[o] | ((nameTex[o + 2] >> 4) << 8),
    r = nameTex[o + 1] | ((nameTex[o + 2] & 15) << 8);
  return [NAMES.r[r] || "", NAMES.c[c] || ""];
}
let promptText = "";
// Every card, anywhere on Earth, gets its three buttons from this one template.
let spot = null;
const QUESTIONS = {
  land: [
    "Has anyone actually been at or near this spot? Cover expeditions, surveys, and people who lived or travelled nearby.",
    "What makes it hard to reach, and how would someone get there today?",
    "What is the land like here?",
  ],
  water: [
    "What is known about this stretch of water, and who passes through it?",
    "What is the nearest land, and how far away is it?",
    "Has anything notable happened here?",
  ],
};
function brief(s) {
  spot = s;
  spot.records = "";
  const at = s.lat === undefined ? "" : coords(s.lat, s.lon);
  $("agoogle").href = "https://www.google.com/search?q=" + encodeURIComponent(s.query || s.place || at);
  $("awiki").href = s.wiki
    ? "https://en.wikipedia.org/wiki/" + encodeURIComponent(s.wiki.replace(/ /g, "_"))
    : "https://en.wikipedia.org/wiki/Special:Search?search=" + encodeURIComponent(s.search || s.place || at);
  const pinned = s.lat !== undefined;
  $("plink").hidden = !pinned;
  $("asat").hidden = !pinned;
  if (pinned)
    $("asat").href =
      "https://www.google.com/maps/@" + s.lat.toFixed(4) + "," + s.lon.toFixed(4) + ",40000m/data=!3m1!1e3";
  $("ptext").hidden = true;
  $("aprompt").textContent = "Copy AI prompt";
  writePrompt();
  markSaved();
}
function writePrompt() {
  const s = spot,
    here = s.lat === undefined ? "" : "#" + s.lat.toFixed(3) + "," + s.lon.toFixed(3);
  promptText = [
    "I am looking at a spot on Unwalked Earth, a map that guesses where nobody has ever stood.",
    "",
    "Place: " + s.place,
    ...(s.lat === undefined ? [] : ["Coordinates: " + coords(s.lat, s.lon)]),
    ...s.lines,
    ...(s.records ? [s.records] : []),
    "On the map: https://unwalked.earth/" + here,
    "",
    "What I would like to know:",
    ...s.ask.map((q, i) => i + 1 + ". " + q),
    "",
    "Say what you are unsure about, and name sources I can check.",
  ].join("\n");
}
// the researched block shown for dotted places and regions
function known(p, beenTitle, been, whyTitle, why) {
  const k = $("kblock");
  if (!p) {
    k.hidden = true;
    $("ksrcwrap").hidden = true;
    return;
  }
  $("kfacts").replaceChildren(
    ...p.facts.map((f) => {
      const row = document.createElement("div"),
        dt = document.createElement("dt"),
        dd = document.createElement("dd");
      dt.textContent = f.label;
      dd.textContent = f.value;
      row.append(dt, dd);
      return row;
    }),
  );
  $("kbeenh").textContent = beenTitle;
  $("kbeen").textContent = been;
  $("kwhyh").textContent = whyTitle;
  $("kwhy").textContent = why;
  $("kcaveat").textContent = p.caveat || "";
  $("kcaveat").hidden = !p.caveat;
  $("ksrc").replaceChildren(
    ...p.sources.map((src) => {
      const li = document.createElement("li"),
        a = document.createElement("a");
      a.textContent = src.title;
      a.href = src.url;
      a.target = "_blank";
      a.rel = "noopener";
      li.append(a);
      return li;
    }),
  );
  k.hidden = false;
  $("ksrcwrap").hidden = false;
}
$("aprompt").onclick = async () => {
  const b = $("aprompt");
  try {
    await navigator.clipboard.writeText(promptText);
    b.textContent = "Copied. Paste it into your AI";
    setTimeout(() => {
      b.textContent = "Copy AI prompt";
    }, 2500);
  } catch (e) {
    const a = $("ptext");
    a.value = promptText;
    a.hidden = false;
    a.focus();
    a.select();
    b.textContent = "Select all and copy";
  }
};
function show(which) {
  for (const id of ["intro", "place", "about", "where"]) $(id).hidden = id !== which;
  card.classList.toggle("tall", which === "place");
  card.scrollTop = 0;
  if (which !== "place") {
    view.sel = null;
    view.arc = null;
    request++;
    try {
      history.replaceState(null, "", location.pathname);
    } catch (e) {}
  }
  if (world) size();
}
let request = 0,
  current = null;
const getJSON = (u) => fetch(u).then((r) => (r.ok ? r.json() : Promise.reject(r.status)));
const big = (n) => (n >= 1e6 ? (n / 1e6).toFixed(1) + " million" : number(n));
function live(lat, lon, titles, score) {
  const id = ++request;
  current = { lat, lon };
  try {
    history.replaceState(null, "", "#" + lat.toFixed(3) + "," + lon.toFixed(3));
  } catch (e) {}
  // satellite picture: sharp one first, NASA's as the fallback
  const cosl = Math.max(Math.cos(lat * RAD), 0.03),
    im = $("psat"),
    cap = $("pcap");
  const box = (hh) => {
    const hw = Math.min(40, (2 * hh) / cosl);
    return [
      (lon - hw).toFixed(4),
      Math.max(-90, lat - hh).toFixed(4),
      (lon + hw).toFixed(4),
      Math.min(90, lat + hh).toFixed(4),
    ].join(",");
  };
  const Q =
    "SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap&STYLES=&SRS=EPSG:4326&FORMAT=image/jpeg&WIDTH=680&HEIGHT=340&BBOX=";
  im.classList.remove("on");
  cap.textContent = "";
  let tried = 0;
  im.onload = () => {
    if (id !== request) return;
    im.classList.add("on");
    cap.textContent =
      (tried
        ? "NASA Blue Marble, about 220 km across."
        : "Sentinel-2 cloudless by EOX, about 45 km across.") + " Tap it for a closer look.";
  };
  im.onerror = () => {
    if (id !== request) return;
    if (!tried) {
      tried = 1;
      im.src =
        "https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi?" +
        Q +
        box(0.5) +
        "&LAYERS=BlueMarble_ShadedRelief_Bathymetry";
    } else im.classList.remove("on");
  };
  im.src = "https://tiles.maps.eox.at/wms?" + Q + box(0.1) + "&LAYERS=s2cloudless";
  // weather right now
  $("pnowwrap").hidden = true;
  getJSON(
    "https://api.open-meteo.com/v1/forecast?latitude=" +
      lat.toFixed(3) +
      "&longitude=" +
      lon.toFixed(3) +
      "&current=temperature_2m,wind_speed_10m",
  )
    .then((d) => {
      if (id !== request || !d.current) return;
      const c = d.current.temperature_2m,
        w = d.current.wind_speed_10m;
      $("pnow").textContent =
        (isDay(lat, lon) ? "Day, " : "Night, ") +
        Math.round(c) +
        " °C (" +
        Math.round((c * 9) / 5 + 32) +
        " °F), wind " +
        Math.round(w) +
        " km/h";
      $("pnowwrap").hidden = false;
      if (score !== null && score >= 50 && (c <= -20 || c >= 40)) {
        const li = document.createElement("li");
        li.textContent =
          "Right now it is " + Math.round(c) + " °C (" + Math.round((c * 9) / 5 + 32) + " °F) there.";
        $("pkeep").appendChild(li);
      }
    })
    .catch(() => {});
  // what Wikipedia says about the area
  $("pwiki").hidden = true;
  (async () => {
    for (const t of titles) {
      if (!t) continue;
      try {
        const d = await getJSON(
          "https://en.wikipedia.org/api/rest_v1/page/summary/" + encodeURIComponent(t) + "?redirect=true",
        );
        if (id !== request) return;
        if (d.type !== "standard" || !d.extract) continue;
        $("pwtitle").textContent = d.title;
        $("pwtext").textContent = d.extract;
        const wi = $("pwimg");
        if (d.thumbnail && d.thumbnail.source) {
          wi.src = d.thumbnail.source;
          wi.hidden = false;
        } else wi.hidden = true;
        if (d.content_urls && d.content_urls.desktop) $("awiki").href = d.content_urls.desktop.page;
        $("pwiki").hidden = false;
        return;
      } catch (e) {}
    }
  })();
  // has anyone been here? four independent records, all within 10 km
  const dl = 0.09,
    dn = 0.09 / cosl,
    thumbs = $("pthumbs");
  thumbs.textContent = "";
  for (const k of ["evphoto", "evgbif", "evinat", "evwiki"]) $(k).textContent = "…";
  $("pevline").textContent = "Checking four sources.";
  $("pev").hidden = false;
  const photos = getJSON(
    "https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*&generator=geosearch&ggscoord=" +
      lat.toFixed(4) +
      "%7C" +
      lon.toFixed(4) +
      "&ggsradius=10000&ggslimit=6&ggsnamespace=6&prop=imageinfo&iiprop=url&iiurlwidth=240",
  ).then((d) => {
    const ps =
      d.query && d.query.pages
        ? Object.values(d.query.pages).filter((p) => p.imageinfo && p.imageinfo[0] && p.imageinfo[0].thumburl)
        : [];
    if (id === request) {
      for (const p of ps) {
        const a = document.createElement("a");
        a.href = p.imageinfo[0].descriptionurl;
        a.target = "_blank";
        a.rel = "noopener";
        const i = document.createElement("img");
        i.src = p.imageinfo[0].thumburl;
        i.alt = "";
        i.loading = "lazy";
        a.appendChild(i);
        thumbs.appendChild(a);
      }
      $("evphoto").textContent = ps.length >= 6 ? "6 or more" : String(ps.length);
    }
    return ps.length;
  });
  const gbif = getJSON(
    "https://api.gbif.org/v1/occurrence/search?limit=0&decimalLatitude=" +
      (lat - dl).toFixed(4) +
      "," +
      (lat + dl).toFixed(4) +
      "&decimalLongitude=" +
      (lon - dn).toFixed(4) +
      "," +
      (lon + dn).toFixed(4),
  ).then((d) => {
    if (id === request) $("evgbif").textContent = big(d.count);
    return d.count;
  });
  const inat = getJSON(
    "https://api.inaturalist.org/v1/observations?lat=" +
      lat.toFixed(4) +
      "&lng=" +
      lon.toFixed(4) +
      "&radius=10&per_page=0",
  ).then((d) => {
    if (id === request) {
      const e = $("evinat");
      e.textContent = "";
      if (d.total_results) {
        const a = document.createElement("a");
        a.href =
          "https://www.inaturalist.org/observations?lat=" +
          lat.toFixed(4) +
          "&lng=" +
          lon.toFixed(4) +
          "&radius=10";
        a.target = "_blank";
        a.rel = "noopener";
        a.textContent = big(d.total_results);
        a.style.color = "var(--blue)";
        a.style.textDecoration = "none";
        e.appendChild(a);
      } else e.textContent = "0";
    }
    return d.total_results;
  });
  const wiki = getJSON(
    "https://en.wikipedia.org/w/api.php?action=query&format=json&origin=*&list=geosearch&gscoord=" +
      lat.toFixed(4) +
      "%7C" +
      lon.toFixed(4) +
      "&gsradius=10000&gslimit=20",
  ).then((d) => {
    const g = (d.query && d.query.geosearch) || [];
    if (id === request) {
      const e = $("evwiki");
      e.textContent = "";
      if (g.length) {
        const a = document.createElement("a");
        a.href = "https://en.wikipedia.org/?curid=" + g[0].pageid;
        a.target = "_blank";
        a.rel = "noopener";
        a.textContent = (g.length >= 20 ? "20 or more" : g.length) + ", nearest " + g[0].title;
        a.style.color = "var(--blue)";
        a.style.textDecoration = "none";
        e.appendChild(a);
      } else e.textContent = "0";
    }
    return g.length;
  });
  Promise.allSettled([photos, gbif, inat, wiki]).then((rs) => {
    if (id !== request) return;
    const keys = ["evphoto", "evgbif", "evinat", "evwiki"];
    rs.forEach((r, i) => {
      if (r.status !== "fulfilled") $(keys[i]).textContent = "No answer";
    });
    const got = rs.filter((r) => r.status === "fulfilled"),
      any = got.some((r) => r.value > 0),
      all = got.length === 4,
      hi = score !== null && score >= 50;
    $("pevline").textContent = any
      ? hi
        ? "The map says probably not. The records say somebody was."
        : "Yes. The records agree."
      : !all
        ? "Nothing found, but not every source answered."
        : score === null
          ? "Nothing on record within 10 km."
          : hi
            ? "No photos, sightings or articles within 10 km. This one might be real."
            : "Nothing on record within 10 km, even this close to a way in.";
    if (spot) {
      const names = [
          "photos on Wikimedia Commons",
          "GBIF wildlife records",
          "iNaturalist sightings",
          "Wikipedia articles",
        ],
        found = names
          .map((n, i) => (rs[i].status === "fulfilled" ? rs[i].value + " " + n : ""))
          .filter(Boolean);
      spot.records = found.length ? "On record within 10 km: " + found.join(", ") + "." : "";
      writePrompt();
    }
  });
}
function openMark(hit) {
  view.arc = null;
  view.sel = [hit.lat, hit.lon];
  $("pname").textContent = hit.name;
  $("pcoords").textContent = hit.where + "  ·  " + coords(hit.lat, hit.lon);
  $("pscored").hidden = true;
  $("pnote").hidden = false;
  $("pnote").textContent = hit.summary;
  known(hit, "Who has been here", hit.been, "What keeps people out", hit.why);
  brief({
    place: hit.name + ", " + hit.where,
    lat: hit.lat,
    lon: hit.lon,
    query: hit.search,
    wiki: hit.wikipedia,
    lines: [
      "What the map says: " + hit.summary,
      "Known visits: " + hit.been,
      "What keeps people out: " + hit.why,
      ...(hit.caveat ? ["Uncertain: " + hit.caveat] : []),
    ],
    ask: hit.ask.concat("Is anything in the notes above wrong or out of date?"),
  });
  show("place");
  live(hit.lat, hit.lon, [hit.wikipedia, hit.name], null);
}
// open whatever is at a position: a dotted place if one is there, otherwise the ground itself
function openAt(lat, lon, label) {
  const hit = LANDMARKS.find((m) => Math.abs(m.lat - lat) < 0.02 && Math.abs(m.lon - lon) < 0.02);
  if (hit) openMark(hit);
  else selectLL(lat, lon, label);
}
function pick(mx, my) {
  if (!world || !nameTex) return;
  let hit = null,
    bd = 16 * dpr;
  for (const s of LANDMARKS) {
    const p = proj(s.lat, s.lon);
    if (p[2] < 0.05) continue;
    const d = Math.hypot(p[0] - mx, p[1] - my);
    if (d < bd) {
      bd = d;
      hit = s;
    }
  }
  if (hit) {
    openMark(hit);
    return;
  }
  const g = unproj(mx, my);
  if (!g) return;
  selectLL(g[0], g[1]);
}
function selectLL(la, lo, label) {
  if (!world || !nameTex) return;
  const g = [la, lo];
  view.sel = g;
  const tx = Math.min(WORLD_W - 1, (((g[1] + 180) / 360) * WORLD_W) | 0),
    ty = Math.min(WORLD_H - 1, (((90 - g[0]) / 180) * WORLD_H) | 0),
    o = (ty * WORLD_W + tx) * 4,
    r = world[o];
  const nm = nameAt(g[0], g[1]);
  if (!r) {
    view.arc = null;
    $("pname").textContent = label || "Open water";
    $("pcoords").textContent = coords(g[0], g[1]);
    $("pscored").hidden = true;
    $("pnote").hidden = false;
    $("pnote").textContent = "The oceans are not scored.";
    known(null);
    brief({
      place: label || "Open water",
      lat: g[0],
      lon: g[1],
      query: label || coords(g[0], g[1]),
      search: label || "Ocean",
      lines: ["The map does not score the oceans."],
      ask: QUESTIONS.water,
    });
    show("place");
    live(g[0], g[1], [], null);
    return;
  }
  const s = Math.round((r - 1) / 2.54),
    acc = Math.pow(world[o + 1] / 8, 2),
    b = world[o + 2],
    step = acc > 100 ? 10 : 5,
    elev = (b >> 3) * 300;
  const title = label || (nm[0] && nm[0] !== nm[1] ? nm[0] : nm[1] || "Unnamed land");
  $("pname").textContent = title;
  $("pcoords").textContent = (nm[1] && nm[1] !== title ? nm[1] + "  ·  " : "") + coords(g[0], g[1]);
  $("pscored").hidden = false;
  $("pnote").hidden = true;
  $("pscore").textContent = s;
  $("pbar").style.width = s + "%";
  $("pverdict").textContent =
    s >= 75
      ? "Probably never walked."
      : s >= 50
        ? "Possibly never walked."
        : s >= 25
          ? "Probably walked at some point."
          : "Walked.";
  $("pway").textContent = WAYS_IN[b & 3];
  $("pfar").textContent = acc < 8 ? "Under 10 km" : "About " + number(Math.round(acc / step) * step) + " km";
  $("pground").textContent =
    (b & 4 ? "Permanent ice" : "Ice-free") + (elev >= 300 ? ", about " + number(elev) + " m up" : "");
  {
    const icy = !!(b & 4) || g[0] < -60,
      L = icy ? 80 : 120,
      reach = 1 - Math.exp(-Math.pow(acc / L, 1.2)),
      ds = Math.round(100 * reach),
      ratio = reach > 0.15 ? s / (100 * reach) : 0;
    const way = [
      "The nearest road, railway or track",
      "The nearest town, airstrip, mine or other known site",
      "The coast",
      "The nearest river",
    ][b & 3];
    $("pwhy1").textContent =
      way +
      " is " +
      $("pfar").textContent.toLowerCase() +
      " away." +
      (reach < 0.15
        ? " That close, the map assumes people have been here."
        : " On distance alone that would score about " + ds + ".");
    $("pwhy2").textContent =
      reach < 0.15
        ? ""
        : icy
          ? "It is permanent ice. Nobody has ever lived on ice like this, so nothing is taken off."
          : ratio >= 0.88
            ? "The ground is high and steep enough that people rarely cross it, so very little is taken off."
            : ratio >= 0.68
              ? "The ground is open desert or very high country. People have crossed places like this for thousands of years, so the map keeps about three quarters of that."
              : ratio >= 0.45
                ? "The ground is forest, grassland or tundra. People have lived on or crossed ground like this for thousands of years, so the map keeps about half of that."
                : "Lights show here at night, or a known site is close, so the map keeps less than half of that.";
    $("pwhy2").hidden = reach < 0.15;
    const keep = [],
      days = Math.max(1, Math.round(acc / 25));
    if (s >= 50) {
      keep.push(
        "It is about " +
          number(Math.round(acc / step) * step) +
          " km from the nearest way in. On foot that is roughly " +
          days +
          (days === 1 ? " day" : " days") +
          " each way, carrying everything.",
      );
      if (b & 4)
        keep.push("Permanent ice. Nothing grows, and there is nothing to burn or drink without melting it.");
      else if (ratio >= 0.68 && elev < 3000) keep.push("Bare desert, with no reliable water on the surface.");
      if (elev >= 3000)
        keep.push(
          "About " +
            number(elev) +
            " m up, where the air holds roughly " +
            Math.round(100 * Math.exp(-elev / 8400)) +
            "% of the oxygen at sea level.",
        );
      if (Math.abs(g[0]) >= 66.5)
        keep.push("Inside the polar circle, so the sun does not rise for part of every winter.");
      if (g[0] < -60)
        keep.push("Antarctica never had people living on it. The first landings were in the 1800s.");
    }
    const ul = $("pkeep");
    ul.textContent = "";
    for (const k of keep) {
      const li = document.createElement("li");
      li.textContent = k;
      ul.appendChild(li);
    }
    $("pkeepwrap").hidden = !keep.length;
    view.arc = null;
    $("far").hidden = true;
    if (s < 50) {
      const n = nearest(g[0], g[1]);
      if (n) {
        const nn = nameAt(n[0], n[1]),
          where = [nn[0], nn[1]].filter((v, i, a) => v && a.indexOf(v) === i).join(", ");
        $("fartext").textContent =
          "About " +
          number(n[2] > 100 ? Math.round(n[2] / 10) * 10 : Math.round(n[2])) +
          " km " +
          compass(g[0], g[1], n[0], n[1]) +
          " of here" +
          (where ? ", in " + where : "") +
          ".";
        $("far").hidden = false;
        view.arc = [g[0], g[1], n[0], n[1]];
        $("fargo").onclick = () => {
          selectLL(n[0], n[1]);
          fly(n[0], n[1], 3);
        };
      }
    }
  }
  const q = [label || nm[0], nm[1]].filter((v, i, a) => v && a.indexOf(v) === i).join(" ");
  known(null);
  brief({
    place: [label, nm[0], nm[1]].filter((v, i, a) => v && a.indexOf(v) === i).join(", ") || "Unnamed land",
    lat: g[0],
    lon: g[1],
    query: q || coords(g[0], g[1]),
    search: nm[0] || nm[1] || "",
    lines: [
      "Unwalked score: " + s + " out of 100 (higher means less likely anyone has stood there)",
      "Nearest way in, from the map's data: " +
        $("pway").textContent +
        ", " +
        $("pfar").textContent.toLowerCase(),
      "Ground: " + $("pground").textContent,
      ...(s >= 50 ? [...$("pkeep").children].map((li) => "Kept people out: " + li.textContent) : []),
    ],
    ask: QUESTIONS.land,
  });
  show("place");
  live(g[0], g[1], (label ? [label] : []).concat([nm[0], nm[1]]), s);
}
function fly(lat, lon, k) {
  stopSpin();
  halt();
  const tok = motion,
    a = { lon: view.lon, lat: view.lat, k: view.k },
    dl = ((lon - a.lon + 540) % 360) - 180,
    t0 = performance.now(),
    dur = calm ? 1 : 700;
  (function step(t) {
    if (tok !== motion) return;
    let u = Math.min(1, (t - t0) / dur);
    u = u * u * (3 - 2 * u);
    view.lon = ((a.lon + dl * u + 540) % 360) - 180;
    view.lat = a.lat + (lat - a.lat) * u;
    view.k = a.k + (k - a.k) * u;
    if (u < 1) {
      draw(0.5);
      requestAnimationFrame(step);
    } else {
      zoomGoal = view.k;
      draw(1);
    }
  })(t0);
}

function fillStat() {
  $("stat").textContent =
    `That is about ${Math.round(META.cum[50])}% of all land, or ${META.cumx[50].toFixed(1)}% without Antarctica.`;
}
function fillRegions() {
  $("go").innerHTML = REGIONS.map(
    (r, i) => `<button class="chip" type="button" data-v="${i}">${r.name}</button>`,
  ).join("");
  $("rlist").innerHTML = REGIONS.map(
    (r, i) => `<li>${r.line} <button class="textlink" type="button" data-v="${i}">More</button></li>`,
  ).join("");
}
function openRegion(e) {
  const b = e.target.closest("button[data-v]");
  if (!b) return;
  const r = REGIONS[+b.dataset.v];
  fly(r.lat, r.lon, r.zoom);
  view.sel = null;
  view.arc = null;
  request++;
  $("pname").textContent = r.name;
  $("pcoords").textContent = "Region";
  $("plink").hidden = true;
  $("pscored").hidden = true;
  $("pnote").hidden = false;
  $("pnote").textContent = r.line;
  for (const id of ["pnowwrap", "pwiki", "pev"]) $(id).hidden = true;
  $("asat").hidden = true;
  $("pcap").textContent = "";
  known(r, "Who has lived here or crossed it", r.people, "The emptiest parts", r.empty);
  brief({
    place: r.name,
    query: r.search,
    wiki: r.wikipedia,
    lines: ["What the map says: " + r.line, "People: " + r.people, "Emptiest parts: " + r.empty],
    ask: [
      "Which parts of this region have most likely never had a person stand on them, and why?",
      "Who has lived in or crossed the emptiest parts, and what is the evidence?",
      "Is anything in the notes above wrong or out of date?",
    ],
  });
  show("place");
}
$("go").addEventListener("click", openRegion);
$("rlist").addEventListener("click", openRegion);
$("aboutlink").onclick = () => show("about");
$("wherelink").onclick = () => show("where");
function fillWhere() {
  $("wlist").innerHTML = (META.top || [])
    .map(
      (c, i) =>
        `<li><button type="button" data-w="${i}"><div class="r"><b>${c.n}</b><span>${c.km2 >= 1e6 ? (c.km2 / 1e6).toFixed(1) + " million" : number(c.km2)} km², ${c.pct}%</span></div><i><u style="width:${Math.max(1, c.pct)}%"></u></i></button></li>`,
    )
    .join("");
}
$("wlist").addEventListener("click", (e) => {
  const b = e.target.closest("button");
  if (!b) return;
  const c = META.top[+b.dataset.w];
  fly(c.lat, c.lon, c.km2 > 1e6 ? 1.6 : 3);
});
$("plink").onclick = async () => {
  const b = $("plink");
  try {
    await navigator.clipboard.writeText(location.href);
    b.textContent = "Link copied";
  } catch (e) {
    b.textContent = "Copy it from the address bar";
  }
  setTimeout(() => {
    b.textContent = "Copy link";
  }, 2500);
};
let polarSpots = [],
  otherSpots = [];
function candidates() {
  for (let y = 0; y < WORLD_H; y += 3) {
    const lat = 90 - ((y + 0.5) * 180) / WORLD_H,
      o = y * WORLD_W;
    for (let x = 0; x < WORLD_W; x += 3) {
      if (shown[o + x] >= 179) (lat < -60 ? polarSpots : otherSpots).push(o + x);
    }
  }
}
function lucky() {
  if (spinning) return;
  const list =
    Math.random() < 0.6 && otherSpots.length ? otherSpots : polarSpots.length ? polarSpots : otherSpots;
  if (!list.length) return;
  const i = list[(Math.random() * list.length) | 0],
    y = (i / WORLD_W) | 0,
    x = i - y * WORLD_W;
  const lat = 90 - ((y + 0.5) * 180) / WORLD_H,
    lon = -180 + ((x + 0.5) * 360) / WORLD_W;
  stopSpin();
  if (calm) {
    selectLL(lat, lon);
    view.lat = lat;
    view.lon = lon;
    view.k = 3.2;
    draw(1);
    return;
  }
  show("intro");
  halt();
  spinning = true;
  const tok = motion;
  const a = { lon: view.lon, lat: view.lat, k: view.k },
    dl = ((lon - a.lon + 540) % 360) - 180 + 360,
    t0 = performance.now(),
    dur = 2400,
    tl = Math.max(-89.5, Math.min(89.5, lat));
  (function step(t) {
    if (tok !== motion) return;
    const u = Math.min(1, (t - t0) / dur),
      e = 1 - Math.pow(1 - u, 3);
    view.lon = ((a.lon + dl * e + 540) % 360) - 180;
    view.lat = a.lat + (tl - a.lat) * e;
    view.k = u < 0.45 ? a.k + (1 - a.k) * (u / 0.45) : 1 + 2.2 * Math.pow((u - 0.45) / 0.55, 2);
    if (u < 1) {
      draw(0.5);
      requestAnimationFrame(step);
    } else {
      spinning = false;
      zoomGoal = view.k;
      selectLL(lat, lon);
    }
  })(t0);
}
$("lucky").onclick = lucky;
$("again").onclick = lucky;
// Search: saved places, dots and regions match as you type; Enter looks the rest up.
function offer(rows) {
  const list = $("findlist");
  list.replaceChildren(
    ...rows.map((r) => {
      const li = document.createElement("li"),
        b = document.createElement("button"),
        small = document.createElement("span");
      b.type = "button";
      b.textContent = r.name;
      small.textContent = r.kind;
      b.append(small);
      b.onclick = () => {
        list.hidden = true;
        $("find").value = "";
        r.go();
      };
      li.append(b);
      return li;
    }),
  );
  list.hidden = !rows.length;
}
function goTo(lat, lon, name) {
  $("find").value = "";
  openAt(lat, lon, name);
  fly(lat, lon, 3.5);
}
$("find").addEventListener("input", (e) => {
  const q = e.target.value.trim().toLowerCase();
  $("findnote").hidden = true;
  if (q.length < 2) return offer([]);
  offer(
    [
      ...saved.map((p) => ({ name: p.n, kind: "Saved", go: () => goTo(p.lat, p.lon, p.n) })),
      ...LANDMARKS.map((m) => ({ name: m.name, kind: m.where, go: () => goTo(m.lat, m.lon) })),
      ...REGIONS.map((r, i) => ({
        name: r.name,
        kind: "Region",
        go: () => $("go").children[i].click(),
      })),
    ]
      .filter((r) => r.name.toLowerCase().includes(q))
      .slice(0, 6),
  );
});
$("find").addEventListener("keydown", async (e) => {
  if (e.key !== "Enter") return;
  const q = e.target.value.trim(),
    n = $("findnote");
  if (!q) return;
  const pair = /^\s*(-?\d+(?:\.\d+)?)\s*[, ]\s*(-?\d+(?:\.\d+)?)\s*$/.exec(q);
  if (pair && Math.abs(+pair[1]) <= 90 && Math.abs(+pair[2]) <= 180) {
    offer([]);
    return goTo(+pair[1], +pair[2]);
  }
  n.hidden = false;
  n.textContent = "Looking.";
  try {
    const d = await getJSON(
      "https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&q=" + encodeURIComponent(q),
    );
    if (!d.length) {
      n.textContent = "Could not find that. Try a town, mountain, region or coordinates.";
      return;
    }
    n.hidden = true;
    const rows = d.map((x) => {
      const parts = String(x.display_name || q).split(","),
        name = (x.name || parts[0]).trim();
      return {
        name,
        kind: parts.slice(1).join(",").trim().slice(0, 60),
        go: () => goTo(+x.lat, +x.lon, name),
      };
    });
    rows[0].go();
    offer(rows.length > 1 ? rows.slice(1) : []);
  } catch (err) {
    n.textContent = "Search is not answering. Tap the globe instead.";
  }
});

// Saved places stay in this browser only. Nothing is sent anywhere.
let saved = [],
  canSave = true;
try {
  saved = JSON.parse(localStorage.getItem("unwalked.saved") || "[]").filter(
    (p) => p && typeof p.n === "string" && Math.abs(p.lat) <= 90 && Math.abs(p.lon) <= 180,
  );
} catch (e) {
  canSave = false;
}
const sameSpot = (p, lat, lon) => Math.abs(p.lat - lat) < 0.005 && Math.abs(p.lon - lon) < 0.005;
function keep() {
  try {
    localStorage.setItem("unwalked.saved", JSON.stringify(saved));
  } catch (e) {
    canSave = false;
  }
  fillSaved();
}
function fillSaved() {
  $("savedwrap").hidden = !saved.length;
  $("savedlist").replaceChildren(
    ...saved.map((p) => {
      const li = document.createElement("li"),
        open = document.createElement("button"),
        drop = document.createElement("button");
      open.type = drop.type = "button";
      open.className = "textlink";
      open.textContent = p.n;
      open.onclick = () => goTo(p.lat, p.lon, p.n);
      drop.className = "drop";
      drop.textContent = "Remove";
      drop.setAttribute("aria-label", "Remove " + p.n);
      drop.onclick = () => {
        saved = saved.filter((x) => x !== p);
        keep();
      };
      li.append(open, drop);
      return li;
    }),
  );
}
function markSaved() {
  const b = $("psave"),
    on = spot && spot.lat !== undefined && saved.some((p) => sameSpot(p, spot.lat, spot.lon));
  b.hidden = !canSave || !spot || spot.lat === undefined;
  b.textContent = on ? "Saved" : "Save";
  b.setAttribute("aria-pressed", on ? "true" : "false");
}
$("psave").onclick = () => {
  if (!spot || spot.lat === undefined) return;
  const had = saved.find((p) => sameSpot(p, spot.lat, spot.lon));
  if (had) saved = saved.filter((p) => p !== had);
  else
    saved = [
      { n: $("pname").textContent, lat: +spot.lat.toFixed(4), lon: +spot.lon.toFixed(4) },
      ...saved,
    ].slice(0, 50);
  keep();
  markSaved();
};
fillSaved();
function fromHash() {
  const m = /^#(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)$/.exec(location.hash);
  if (!m) return false;
  const lat = +m[1],
    lon = +m[2];
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return false;
  view.spin = false;
  view.lat = Math.max(-89.5, Math.min(89.5, lat));
  view.lon = lon;
  view.k = 3;
  zoomGoal = 3;
  openAt(lat, lon);
  return true;
}
card.addEventListener("click", (e) => {
  if (e.target.closest("[data-back]")) show("intro");
});
addEventListener("keydown", (e) => {
  if (e.key === "Escape") show("intro");
});

function pixels(img, w, h) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const x = c.getContext("2d", { willReadFrequently: true });
  x.drawImage(img, 0, 0);
  return x.getImageData(0, 0, w, h).data;
}
let ready = 0;
function boot() {
  if (++ready < 3) return;
  fillStat();
  fillWhere();
  world = pixels($("tex"), WORLD_W, WORLD_H);
  nameTex = pixels($("ntex"), NAMES_W, NAMES_H);
  smooth();
  candidates();
  size();
  fromHash();
  if (view.spin) requestAnimationFrame(spin);
}
for (const id of ["tex", "ntex"]) {
  const im = $(id);
  if (im.complete && im.naturalWidth) boot();
  else im.addEventListener("load", boot);
}
addEventListener("resize", () => {
  if (world) size();
});
Promise.all(
  ["data/meta.json", "data/names.json", "data/places.json"].map((u) => fetch(u).then((r) => r.json())),
).then((d) => {
  META = d[0];
  NAMES = d[1];
  LANDMARKS = d[2].landmarks;
  REGIONS = d[2].regions;
  fillRegions();
  boot();
});
