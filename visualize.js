/* ═══════════════════════════════════════════════════════════════
   HEM Visual Lab — visualize.js
   4 Interactive Canvas Demonstrations
   1. LatticeViz   — 3D HEA lattice, strain heatmap, Pm β-emission, Ne cage, stress slider
   2. BetavoltaicViz — cross-section, animated β⁻ particles, EH pairs, current flow
   3. SPSViz        — sintering chamber, pistons, lightning arcs, heat map
   4. DeviceViz     — DOM exploded assembly
═══════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  /* ─── Element data ─────────────────────────────────────────── */
  const EL = {
    V:  { name: 'Vanadium',    color: '#3b82f6', rgb: [59,130,246],   r: 8,  aR: 1.34, cat: 'transition' },
    Zr: { name: 'Zirconium',   color: '#8b5cf6', rgb: [139,92,246],   r: 10, aR: 1.60, cat: 'transition' },
    Ta: { name: 'Tantalum',    color: '#f59e0b', rgb: [245,158,11],   r: 9,  aR: 1.46, cat: 'transition' },
    Ca: { name: 'Calcium',     color: '#fbbf24', rgb: [251,191,36],   r: 9,  aR: 1.97, cat: 'alkaline'  },
    Zn: { name: 'Zinc',        color: '#10b981', rgb: [16,185,129],   r: 7,  aR: 1.22, cat: 'transition' },
    Ba: { name: 'Barium',      color: '#f97316', rgb: [249,115,22],   r: 12, aR: 2.15, cat: 'alkaline'  },
    K:  { name: 'Potassium',   color: '#ef4444', rgb: [239,68,68],    r: 11, aR: 2.03, cat: 'alkali'    },
    Al: { name: 'Aluminum',    color: '#a78bfa', rgb: [167,139,250],  r: 7,  aR: 1.43, cat: 'post'      },
    S:  { name: 'Sulfur',      color: '#fde68a', rgb: [253,230,138],  r: 5,  aR: 1.04, cat: 'nonmetal'  },
    P:  { name: 'Phosphorus',  color: '#fb923c', rgb: [251,146,60],   r: 5,  aR: 1.07, cat: 'nonmetal', isCollector: true },
    As: { name: 'Arsenic',     color: '#4ade80', rgb: [74,222,128],   r: 6,  aR: 1.19, cat: 'nonmetal', isCollector: true },
    Ne: { name: 'Neon',        color: '#06b6d4', rgb: [6,182,212],    r: 15, aR: 0.38, cat: 'noble',    isNe: true   },
    Pm: { name: 'Promethium',  color: '#d946ef', rgb: [217,70,239],   r: 7,  aR: 1.85, cat: 'rare',     isPm: true   },
  };

  /* ─── Maths helpers ────────────────────────────────────────── */
  function rotY(x, y, z, a) {
    const c = Math.cos(a), s = Math.sin(a);
    return { x: x * c + z * s, y, z: -x * s + z * c };
  }
  function rotX(x, y, z, a) {
    const c = Math.cos(a), s = Math.sin(a);
    return { x, y: y * c - z * s, z: y * s + z * c };
  }
  function rot3(x, y, z, rx, ry) {
    const r1 = rotY(x, y, z, ry);
    return rotX(r1.x, r1.y, r1.z, rx);
  }
  function project(x, y, z, cx, cy, fov) {
    const d = fov / (fov + z);
    return { px: cx + x * d, py: cy + y * d, d };
  }
  function lerpC(a, b, t) {
    return [
      Math.round(a[0] + (b[0] - a[0]) * t),
      Math.round(a[1] + (b[1] - a[1]) * t),
      Math.round(a[2] + (b[2] - a[2]) * t),
    ];
  }
  function strainRGB(s, extra) {
    const stops = [
      [6, 182, 212],   // cyan  0.00
      [74, 222, 128],  // green 0.25
      [245, 158, 11],  // amber 0.60
      [239, 68, 68],   // red   0.85
      [255, 255, 255], // white 1.00
    ];
    const v = Math.max(0, Math.min(1, s + (extra || 0)));
    const t = v * (stops.length - 1);
    const i = Math.min(Math.floor(t), stops.length - 2);
    const f = t - i;
    const c = lerpC(stops[i], stops[i + 1], f);
    return `rgb(${c[0]},${c[1]},${c[2]})`;
  }

  /* ══════════════════════════════════════════════════════════════
     VIZ 1: 3D HEA Lattice
  ══════════════════════════════════════════════════════════════ */
  class LatticeViz {
    constructor(canvas, sliderEl, valEl, radBtn, resetBtn) {
      this.canvas  = canvas;
      this.ctx     = canvas.getContext('2d');
      this.slider  = sliderEl;
      this.valEl   = valEl;
      this.stress  = 0;

      this.rotX    = 0.3;
      this.rotY    = 0.6;
      this.autoRot = true;
      this.drag    = false;
      this.lastX   = 0; this.lastY = 0;

      this.time    = 0;
      this.seed    = 42;

      this.atoms   = [];
      this.bonds   = [];
      this.betas   = [];    // beta particles in flight
      this.rads    = [];    // radiation streaks
      this.flashes = new Map(); // atomIdx → intensity

      this._gen();
      this._events(radBtn, resetBtn);
      this._resize();

      this._loop = this._loop.bind(this);
      requestAnimationFrame(this._loop);
    }

    _rng() {
      this.seed = (this.seed * 1664525 + 1013904223) >>> 0;
      return this.seed / 0xffffffff;
    }

    _gen() {
      const S = 62; // lattice spacing
      const pos = [];
      // 3×3×3 corner positions (27 atoms)
      for (let i = 0; i < 3; i++)
        for (let j = 0; j < 3; j++)
          for (let k = 0; k < 3; k++)
            pos.push({ x: (i-1)*S, y: (j-1)*S, z: (k-1)*S });
      // 2×2×2 body centres (8 atoms)
      for (let i = 0; i < 2; i++)
        for (let j = 0; j < 2; j++)
          for (let k = 0; k < 2; k++)
            pos.push({ x:(i-0.5)*S, y:(j-0.5)*S, z:(k-0.5)*S });

      // Deterministic element assignment (35 lattice sites)
      const syms = [
        'V','Zr','Ta','Ca','Zn','Ba','K','Al','S','V',   // 0-9
        'Zr','Ta','Ca','Zn','Al','V','Zr','Ta','Ba','K', // 10-19
        'V','Zn','Ca','Zr','Ta','K','S','P','As','P',    // 20-29
        'Al','Zn','Pm','Pm','V',                         // 30-34
      ];

      pos.forEach((p, i) => {
        const sym = syms[i] || 'V';
        const el  = EL[sym];
        const distort = (el.aR - 1.45) * 14;
        const dx = (this._rng()-0.5)*9 + (this._rng()-0.5)*distort;
        const dy = (this._rng()-0.5)*9 + (this._rng()-0.5)*distort;
        const dz = (this._rng()-0.5)*9 + (this._rng()-0.5)*distort;
        this.atoms.push({
          bx:p.x, by:p.y, bz:p.z,
          dx, dy, dz,
          sym, el,
          phase: this._rng() * Math.PI * 2,
          pmCD:  sym==='Pm' ? Math.floor(this._rng()*120)+100 : 0,
          neVib: 0,
        });
      });

      // 2 Ne interstitial atoms
      [[S*0.5, 4, S*0.5],[-S*0.55, S*0.45, 0]].forEach(([x,y,z]) => {
        this.atoms.push({
          bx:x, by:y, bz:z, dx:0, dy:0, dz:0,
          sym:'Ne', el:EL['Ne'],
          phase: this._rng()*Math.PI*2,
          pmCD:0, neVib:0,
        });
      });

      // Bonds (excluding Ne)
      const maxD = S * 1.2;
      for (let i = 0; i < this.atoms.length; i++) {
        if (this.atoms[i].sym === 'Ne') continue;
        for (let j = i+1; j < this.atoms.length; j++) {
          if (this.atoms[j].sym === 'Ne') continue;
          const a = this.atoms[i], b = this.atoms[j];
          const d = Math.hypot(a.bx-b.bx, a.by-b.by, a.bz-b.bz);
          if (d < maxD) {
            this.bonds.push({
              i, j,
              strain: Math.min(1, Math.abs(a.el.aR - b.el.aR) / 1.8),
            });
          }
        }
      }
    }

    _events(radBtn, resetBtn) {
      const c = this.canvas;
      const dn = e => { this.drag=true; this.autoRot=false; const p=e.touches?e.touches[0]:e; this.lastX=p.clientX; this.lastY=p.clientY; };
      const mv = e => {
        if (!this.drag) return;
        const p=e.touches?e.touches[0]:e;
        this.rotY += (p.clientX - this.lastX) * 0.008;
        this.rotX += (p.clientY - this.lastY) * 0.008;
        this.rotX = Math.max(-1.4, Math.min(1.4, this.rotX));
        this.lastX=p.clientX; this.lastY=p.clientY;
      };
      const up = () => { this.drag=false; };
      c.addEventListener('mousedown', dn);
      c.addEventListener('mousemove', mv);
      window.addEventListener('mouseup', up);
      c.addEventListener('touchstart', dn, {passive:true});
      c.addEventListener('touchmove',  mv, {passive:true});
      window.addEventListener('touchend', up);

      if (this.slider) {
        this.slider.addEventListener('input', e => {
          this.stress = e.target.value / 100;
          if (this.valEl) this.valEl.textContent = Math.round(e.target.value*2) + ' MPa';
        });
      }
      if (radBtn)   radBtn.addEventListener('click',   () => this._fireRad());
      if (resetBtn) resetBtn.addEventListener('click', () => { this.rotX=0.3; this.rotY=0.6; this.autoRot=true; });
      window.addEventListener('resize', () => this._resize());
    }

    _resize() {
      const w = this.canvas.parentElement.clientWidth;
      const h = Math.min(Math.round(w * 0.62), 520);
      this.canvas.width  = w;
      this.canvas.height = h;
      this.cx  = w / 2;
      this.cy  = h / 2;
      this.fov = Math.min(w, h) * 0.75;
    }

    _apos(a) {
      const cy = 1 - this.stress * 0.34;
      const cx = 1 + this.stress * 0.11;
      return { x: a.bx*cx + a.dx, y: a.by*cy + a.dy*cy, z: a.bz*cx + a.dz };
    }

    _fireRad() {
      this.rads.push({
        x: -220, y: (this._rng()-0.5)*130, z: 0,
        vx: 4.5, vy: (this._rng()-0.3)*0.6,
        life: 1.0, trail: [],
      });
    }

    _fireBeta(pmIdx) {
      const pm = this.atoms[pmIdx];
      let nearest=null, nd=Infinity;
      this.atoms.forEach((a,i) => {
        if (!a.el.isCollector) return;
        const d=Math.hypot(a.bx-pm.bx, a.by-pm.by, a.bz-pm.bz);
        if (d<nd) { nd=d; nearest=i; }
      });
      if (nearest===null) return;
      const t = this.atoms[nearest];
      this.betas.push({
        x:pm.bx, y:pm.by, z:pm.bz,
        tx:t.bx, ty:t.by, tz:t.bz,
        ti:nearest, progress:0, trail:[],
      });
    }

    _update() {
      this.time++;
      if (this.autoRot && !this.drag) this.rotY += 0.004;

      // Pm emission
      this.atoms.forEach((a, i) => {
        if (a.sym !== 'Pm') return;
        if (--a.pmCD <= 0) { this._fireBeta(i); a.pmCD = 150 + Math.floor(this._rng()*120); }
      });

      // Ne stress vibration
      this.atoms.forEach(a => {
        if (a.sym !== 'Ne') return;
        const target = this.stress * 0.85;
        a.neVib += (target - a.neVib) * 0.04;
      });

      // Beta particles
      this.betas = this.betas.filter(p => {
        p.trail.push({x:p.x+(p.tx-p.x)*p.progress, y:p.y+(p.ty-p.y)*p.progress, z:p.z+(p.tz-p.z)*p.progress});
        if (p.trail.length > 14) p.trail.shift();
        p.progress += 0.022;
        if (p.progress >= 1) { this.flashes.set(p.ti, 1.0); return false; }
        return true;
      });

      // Radiation streaks
      this.rads = this.rads.filter(r => {
        r.trail.push({x:r.x, y:r.y, z:r.z});
        if (r.trail.length > 22) r.trail.shift();
        r.x += r.vx; r.y += r.vy; r.life -= 0.013;
        // Ne absorption
        this.atoms.forEach(a => {
          if (a.sym !== 'Ne') return;
          const pos = this._apos(a);
          if (Math.hypot(pos.x-r.x, pos.y-r.y, pos.z-r.z) < 22) {
            a.neVib = Math.min(1, a.neVib + 0.65);
            r.life = 0;
          }
        });
        return r.life > 0 && r.x < 280;
      });

      // Flash decay
      this.flashes.forEach((v, k) => {
        const nv = v - 0.05;
        if (nv <= 0) this.flashes.delete(k); else this.flashes.set(k, nv);
      });
    }

    _render() {
      const ctx = this.ctx;
      const W = this.canvas.width, H = this.canvas.height;
      ctx.clearRect(0, 0, W, H);

      // Project all atoms
      const proj = this.atoms.map(a => {
        const p = this._apos(a);
        const r = rot3(p.x, p.y, p.z, this.rotX, this.rotY);
        return { ...project(r.x, r.y, r.z, this.cx, this.cy, this.fov), rz: r.z, a };
      });

      // Depth-sort indices
      const idx = proj.map((_,i)=>i).sort((a,b) => proj[a].rz - proj[b].rz);

      // Bonds
      const sx = this.stress * 0.3;
      this.bonds.forEach(b => {
        const pa = proj[b.i], pb = proj[b.j];
        const eff = Math.min(1, b.strain + sx);
        const col = strainRGB(eff);
        const alpha = 0.12 + eff * 0.55;
        const shim  = eff > 0.65 ? Math.sin(this.time * 0.09 + b.i) * 0.22 + 0.78 : 1;
        ctx.save();
        ctx.globalAlpha = alpha * shim;
        ctx.strokeStyle = col;
        ctx.lineWidth   = 0.5 + eff * 1.4;
        if (eff > 0.68) { ctx.shadowColor = col; ctx.shadowBlur = 4 + eff * 9; }
        ctx.beginPath(); ctx.moveTo(pa.px, pa.py); ctx.lineTo(pb.px, pb.py); ctx.stroke();
        ctx.restore();
      });

      // Atoms (back-to-front)
      idx.forEach(i => {
        const p = proj[i];
        const a = p.a;
        const r = a.el.r * p.d * 2.3;
        const fl = this.flashes.get(i) || 0;
        if (a.el.isNe)  this._drawNe(ctx, p, a, r);
        else if (a.el.isPm) this._drawPm(ctx, p, a, r, fl);
        else            this._drawAtom(ctx, p, a, r, fl);
      });

      // Beta particles
      this.betas.forEach(bp => {
        const t = bp.progress;
        const x = bp.x + (bp.tx-bp.x)*t, y = bp.y + (bp.ty-bp.y)*t, z = bp.z + (bp.tz-bp.z)*t;
        const r2 = rot3(x,y,z, this.rotX, this.rotY);
        const pr = project(r2.x, r2.y, r2.z, this.cx, this.cy, this.fov);
        ctx.save();
        ctx.shadowColor = '#d946ef'; ctx.shadowBlur = 10;
        ctx.fillStyle   = '#f0abfc';
        ctx.beginPath(); ctx.arc(pr.px, pr.py, 3*pr.d, 0, Math.PI*2); ctx.fill();
        ctx.restore();
      });

      // Radiation streaks
      this.rads.forEach(r => {
        const rr = rot3(r.x, r.y, r.z, this.rotX, this.rotY);
        const pr = project(rr.x, rr.y, rr.z, this.cx, this.cy, this.fov);
        ctx.save();
        ctx.globalAlpha  = r.life * 0.85;
        ctx.strokeStyle  = '#ffffff';
        ctx.lineWidth    = 2;
        ctx.shadowColor  = '#ffffff'; ctx.shadowBlur = 18;
        ctx.beginPath();
        r.trail.forEach((tp,i) => {
          const tr = rot3(tp.x,tp.y,tp.z, this.rotX, this.rotY);
          const pp = project(tr.x,tr.y,tr.z, this.cx, this.cy, this.fov);
          i===0 ? ctx.moveTo(pp.px,pp.py) : ctx.lineTo(pp.px,pp.py);
        });
        ctx.lineTo(pr.px, pr.py); ctx.stroke();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath(); ctx.arc(pr.px, pr.py, 4, 0, Math.PI*2); ctx.fill();
        ctx.restore();
      });

      // HUD
      if (this.stress > 0) {
        const mpa = Math.round(this.stress * 200);
        const t   = Math.round(20 + this.stress * 1380);
        ctx.save();
        ctx.globalAlpha = 0.75;
        ctx.font = 'bold 12px monospace';
        ctx.fillStyle = strainRGB(this.stress);
        ctx.textAlign = 'right';
        ctx.fillText(`P: ${mpa} MPa`, W-12, H-12);
        ctx.fillText(`T: ${t} °C`,    W-12, H-28);
        ctx.restore();
      }
    }

    _drawAtom(ctx, proj, a, r, fl) {
      const {px,py} = proj;
      const [cr,cg,cb] = a.el.rgb;
      ctx.save();
      if (fl > 0) { ctx.shadowColor = a.el.color; ctx.shadowBlur = 18 + fl*22; }
      const g = ctx.createRadialGradient(px-r*.3, py-r*.3, r*.05, px, py, r);
      g.addColorStop(0, `rgba(${cr},${cg},${cb},0.95)`);
      g.addColorStop(.65,`rgba(${cr},${cg},${cb},0.7)`);
      g.addColorStop(1,  `rgba(${cr},${cg},${cb},0.25)`);
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(px, py, Math.max(2,r), 0, Math.PI*2); ctx.fill();
      if (r > 7) {
        ctx.fillStyle = 'rgba(255,255,255,0.92)';
        ctx.font = `bold ${Math.max(7, r*.85)}px monospace`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(a.sym, px, py);
      }
      ctx.restore();
    }

    _drawNe(ctx, proj, a, r) {
      const {px,py} = proj;
      const vib  = a.neVib;
      const str  = this.stress;
      const pr   = r * (1 + vib*.32 + Math.sin(this.time*.12 + a.phase)*.09);
      const glow = 0.35 + vib*.65 + str*.25;
      ctx.save();
      ctx.shadowColor = '#06b6d4'; ctx.shadowBlur = 12 + vib*28 + str*15;
      // outer halo
      const og = ctx.createRadialGradient(px,py, pr*.5, px,py, pr*1.9);
      og.addColorStop(0, `rgba(6,182,212,${glow*.18})`);
      og.addColorStop(1, 'rgba(6,182,212,0)');
      ctx.fillStyle = og;
      ctx.beginPath(); ctx.arc(px, py, pr*1.9, 0, Math.PI*2); ctx.fill();
      // shell
      ctx.globalAlpha = .5 + vib*.3 + str*.2;
      ctx.strokeStyle = '#06b6d4'; ctx.lineWidth = 1.5 + str*1.5;
      ctx.beginPath(); ctx.arc(px, py, pr, 0, Math.PI*2); ctx.stroke();
      // fill
      const ig = ctx.createRadialGradient(px-pr*.3, py-pr*.3, 0, px, py, pr);
      ig.addColorStop(0, `rgba(6,182,212,${glow*.55})`);
      ig.addColorStop(1, `rgba(6,182,212,${glow*.08})`);
      ctx.globalAlpha = 1;
      ctx.fillStyle = ig;
      ctx.beginPath(); ctx.arc(px, py, pr, 0, Math.PI*2); ctx.fill();
      // label
      ctx.fillStyle = '#67e8f9'; ctx.font = `bold ${Math.max(8,r*.85)}px monospace`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('Ne', px, py);
      ctx.restore();
    }

    _drawPm(ctx, proj, a, r, fl) {
      const {px,py} = proj;
      const pulse = Math.sin(this.time*.09 + a.phase)*.28 + .72;
      ctx.save();
      ctx.shadowColor = '#d946ef'; ctx.shadowBlur = 10 + pulse*16 + fl*22;
      // outer corona
      const og = ctx.createRadialGradient(px,py, r, px,py, r*2.8);
      og.addColorStop(0, `rgba(217,70,239,${.3*pulse})`);
      og.addColorStop(1, 'rgba(217,70,239,0)');
      ctx.fillStyle = og;
      ctx.beginPath(); ctx.arc(px, py, r*2.8, 0, Math.PI*2); ctx.fill();
      // core
      const g = ctx.createRadialGradient(px-r*.3, py-r*.3, r*.05, px, py, r);
      g.addColorStop(0, `rgba(240,171,252,${.95*pulse})`);
      g.addColorStop(.6,`rgba(217,70,239,${.8*pulse})`);
      g.addColorStop(1, 'rgba(139,92,246,.4)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(px, py, Math.max(2,r), 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.font = `bold ${Math.max(7,r*.85)}px monospace`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('Pm', px, py);
      ctx.restore();
    }

    _loop() {
      this._update();
      this._render();
      requestAnimationFrame(this._loop);
    }
  }

  /* ══════════════════════════════════════════════════════════════
     VIZ 2: Betavoltaic Cell
  ══════════════════════════════════════════════════════════════ */
  class BetavoltaicViz {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx    = canvas.getContext('2d');
      this.time   = 0;
      this.parts  = [];
      this.ehPairs= [];
      this.spawnT = 0;
      this._resize();
      window.addEventListener('resize', () => this._resize());
      this._loop = this._loop.bind(this);
      requestAnimationFrame(this._loop);
    }
    _resize() {
      const w = this.canvas.parentElement.clientWidth;
      this.canvas.width  = w;
      this.canvas.height = Math.min(Math.round(w*.56), 420);
    }
    _spawn(dir) {
      const W = this.canvas.width, H = this.canvas.height;
      const cx = W/2;
      const pmY = H * .5;
      this.parts.push({
        x: cx + (Math.random()-.5)*W*.38,
        y: pmY,
        vx: (Math.random()-.5)*1.8,
        vy: dir * (2.6 + Math.random()*1.4),
        life: 1, trail: [], dir,
      });
    }
    _loop() {
      this.time++;
      if (++this.spawnT > 7) {
        this.spawnT = 0;
        this._spawn(-1); this._spawn(1);
      }
      const W = this.canvas.width, H = this.canvas.height;
      const alTopY = H*.15, alBotY = H*.78;
      this.parts = this.parts.filter(p => {
        p.trail.push({x:p.x, y:p.y});
        if (p.trail.length > 13) p.trail.shift();
        p.x += p.vx; p.y += p.vy; p.life -= 0.024;
        if ((p.dir===-1 && p.y < alTopY) || (p.dir===1 && p.y > alBotY)) {
          this.ehPairs.push({x:p.x, y:p.y, life:1, dir:p.dir});
          return false;
        }
        return p.life > 0;
      });
      this.ehPairs = this.ehPairs.filter(e => { e.life -= 0.032; return e.life > 0; });

      const ctx = this.ctx;
      ctx.clearRect(0,0,W,H);
      this._draw(ctx, W, H, alTopY, alBotY);
      requestAnimationFrame(this._loop);
    }
    _drawLayer(ctx, x, y, w, h, stroke, fill, label, sub, isPm) {
      const cx = x + w/2;
      ctx.save();
      if (isPm) { ctx.shadowColor=stroke; ctx.shadowBlur=14+Math.sin(this.time*.08)*7; }
      ctx.fillStyle = fill; ctx.strokeStyle = stroke; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.roundRect(x,y,w,h,6); ctx.fill(); ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.fillStyle = stroke;
      ctx.font = `bold ${isPm?13:12}px sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(label, cx, y + h*.38);
      ctx.fillStyle = 'rgba(255,255,255,.45)'; ctx.font = '10px monospace';
      ctx.fillText(sub, cx, y + h*.72);
      ctx.restore();
    }
    _draw(ctx, W, H, alTopY, alBotY) {
      const cx = W/2, lw = W*.68, x0 = cx - lw/2;
      const pmH = H*.11, alH = H*.19;
      const pmY = (alTopY + alBotY - pmH) / 2;
      const t1Y = pmY - alH - 4;
      const b1Y = pmY + pmH + 4;

      this._drawLayer(ctx, x0, t1Y,  lw, alH, 'rgba(139,92,246,.85)', 'rgba(139,92,246,.18)', 'Al — Electron Converter', '↑ Current flows up', false);
      this._drawLayer(ctx, x0, pmY,  lw, pmH, 'rgba(217,70,239,.85)', 'rgba(217,70,239,.22)', 'Pm-147 — Electron Emitter', '☢️  β⁻  224 keV per decay', true);
      this._drawLayer(ctx, x0, b1Y,  lw, alH, 'rgba(74,222,128,.85)', 'rgba(74,222,128,.18)',  'AlAs / AlP — Converter Matrix', '↓ Current flows down', false);

      // particles
      this.parts.forEach(p => {
        ctx.save();
        ctx.globalAlpha = p.life;
        ctx.strokeStyle = '#d946ef'; ctx.lineWidth = 1.5;
        ctx.shadowColor = '#d946ef'; ctx.shadowBlur = 8;
        ctx.beginPath();
        p.trail.forEach((tp,i) => i===0 ? ctx.moveTo(tp.x,tp.y) : ctx.lineTo(tp.x,tp.y));
        ctx.lineTo(p.x,p.y); ctx.stroke();
        ctx.fillStyle = '#f0abfc';
        ctx.beginPath(); ctx.arc(p.x,p.y,3,0,Math.PI*2); ctx.fill();
        ctx.restore();
      });

      // EH pairs
      this.ehPairs.forEach(e => {
        ctx.save();
        ctx.globalAlpha = e.life*.85;
        const rr = (1-e.life)*18;
        ctx.strokeStyle = `rgba(74,222,128,${e.life*.5})`;
        ctx.lineWidth = 1.5; ctx.shadowColor = '#4ade80'; ctx.shadowBlur = 10;
        ctx.beginPath(); ctx.arc(e.x,e.y,rr,0,Math.PI*2); ctx.stroke();
        ctx.fillStyle = '#4ade80'; ctx.font = 'bold 13px monospace';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('+', e.x-6, e.y);
        ctx.fillStyle = '#f87171';
        ctx.fillText('−', e.x+7, e.y);
        ctx.restore();
      });

      // footer label
      ctx.save();
      ctx.fillStyle = 'rgba(74,222,128,.55)';
      ctx.font = 'bold 10px monospace'; ctx.textAlign = 'center';
      ctx.fillText('▶  CONTINUOUS CURRENT — NO EXTERNAL CHARGE — 50-YEAR LIFE  ◀', cx, H-10);
      ctx.restore();
    }
  }

  /* ══════════════════════════════════════════════════════════════
     VIZ 3: Spark Plasma Sintering
  ══════════════════════════════════════════════════════════════ */
  class SPSViz {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx    = canvas.getContext('2d');
      this.time   = 0;
      this.piston = 0;   // 0→1 compression
      this.pDir   = 1;
      this.arcs   = [];
      this.arcT   = 0;
      this.parts  = [];
      this._resize();
      window.addEventListener('resize', () => this._resize());
      this._genParts();
      this._loop = this._loop.bind(this);
      requestAnimationFrame(this._loop);
    }
    _resize() {
      const w = this.canvas.parentElement.clientWidth;
      this.canvas.width  = w;
      this.canvas.height = Math.min(Math.round(w*.52), 460);
    }
    _genParts() {
      const syms = ['V','Zr','Ta','Ca','Zn','Al','S','P','As','Pm','K','Ba'];
      for (let i=0; i<48; i++) {
        this.parts.push({
          nx: Math.random(), ny: Math.random(),
          sym: syms[i%syms.length], el: EL[syms[i%syms.length]],
        });
      }
    }
    _screenPos(p, W, H, piston, dieX, dieW, dieTopY, dieH) {
      const comp = piston;
      const innerTop = dieTopY + dieH*.09 + comp*dieH*.3;
      const innerBot = dieTopY + dieH*.91 - comp*dieH*.1;
      return {
        x: dieX + p.nx * dieW,
        y: innerTop + p.ny * (innerBot - innerTop),
      };
    }
    _loop() {
      this.time++;
      this.piston += this.pDir * 0.003;
      if (this.piston > .4)  this.pDir = -1;
      if (this.piston < .01) this.pDir =  1;

      if (++this.arcT > 5) {
        this.arcT = 0;
        const W = this.canvas.width, H = this.canvas.height;
        const dieX = W*.22, dieW = W*.56;
        const dieTopY = H*.1, dieH = H*.8;
        const i = Math.floor(Math.random()*this.parts.length);
        const j = Math.floor(Math.random()*this.parts.length);
        if (i!==j) {
          const a = this._screenPos(this.parts[i], W, H, this.piston, dieX, dieW, dieTopY, dieH);
          const b = this._screenPos(this.parts[j], W, H, this.piston, dieX, dieW, dieTopY, dieH);
          if (Math.hypot(a.x-b.x,a.y-b.y) < 75) {
            this.arcs.push({x1:a.x,y1:a.y,x2:b.x,y2:b.y, life:1, off:(Math.random()-.5)*35});
          }
        }
      }
      this.arcs = this.arcs.filter(a => { a.life -= 0.11; return a.life > 0; });

      const ctx = this.ctx;
      const W   = this.canvas.width, H = this.canvas.height;
      ctx.clearRect(0,0,W,H);
      this._draw(ctx, W, H);
      requestAnimationFrame(this._loop);
    }
    _draw(ctx, W, H) {
      const cx   = W/2;
      const dieX = W*.22, dieW = W*.56, wallT = W*.022;
      const dieTopY = H*.1, dieH = H*.8, dieBotY = dieTopY+dieH;
      const comp = this.piston;
      const pisH  = dieH * .09;
      const topPY = dieTopY + dieH*.04 + comp*dieH*.3;
      const botPY = dieBotY - dieH*.04 - comp*dieH*.1 - pisH;
      const pwdT  = topPY + pisH, pwdB = botPY, pwdH = pwdB - pwdT;

      // BG
      ctx.fillStyle = '#06080f'; ctx.fillRect(0,0,W,H);

      // Heat glow
      const hi = .25 + comp*.75;
      const hg = ctx.createRadialGradient(cx,(pwdT+pwdB)/2,10,cx,(pwdT+pwdB)/2,dieW*.65);
      hg.addColorStop(0, `rgba(255,110,0,${hi*.28})`);
      hg.addColorStop(.5,`rgba(255,55,0,${hi*.11})`);
      hg.addColorStop(1, 'rgba(255,0,0,0)');
      ctx.fillStyle = hg; ctx.fillRect(0,0,W,H);

      // Die walls
      [[dieX, dieTopY, wallT, dieH],[dieX+dieW-wallT, dieTopY, wallT, dieH]].forEach(([x,y,w,h]) => {
        ctx.fillStyle = '#374151'; ctx.strokeStyle = '#6b7280'; ctx.lineWidth = 1;
        ctx.fillRect(x,y,w,h); ctx.strokeRect(x,y,w,h);
      });
      ctx.fillStyle = '#4b5563'; ctx.font = '9px monospace'; ctx.textAlign = 'center';
      ctx.save(); ctx.translate(dieX+wallT/2, H/2); ctx.rotate(-Math.PI/2); ctx.fillText('GRAPHITE DIE',0,0); ctx.restore();
      ctx.save(); ctx.translate(dieX+dieW-wallT/2, H/2); ctx.rotate(Math.PI/2); ctx.fillText('GRAPHITE DIE',0,0); ctx.restore();

      // Pistons
      const pGrad = (y,h,d) => { const g=ctx.createLinearGradient(0,y,0,y+h*d); g.addColorStop(0,'#9ca3af'); g.addColorStop(1,'#4b5563'); return g; };
      [
        [topPY, pisH, 1, '▼', topPY-5],
        [botPY, pisH,-1, '▲', botPY+pisH+20],
      ].forEach(([y,h,d,arrow,ay]) => {
        ctx.fillStyle = pGrad(y,h,d); ctx.strokeStyle = '#d1d5db'; ctx.lineWidth = 1.5;
        ctx.fillRect(dieX+wallT, y, dieW-wallT*2, h); ctx.strokeRect(dieX+wallT, y, dieW-wallT*2, h);
        ctx.fillStyle = '#f59e0b'; ctx.font = 'bold 17px sans-serif'; ctx.textAlign = 'center';
        ctx.fillText(arrow, cx, ay);
      });
      // rods
      const rw = dieW*.24;
      ctx.fillStyle = '#6b7280';
      ctx.fillRect(cx-rw/2, 0, rw, topPY);
      ctx.fillRect(cx-rw/2, botPY+pisH, rw, H-botPY-pisH);

      // Pressure label
      ctx.fillStyle = '#9ca3af'; ctx.font = '11px monospace'; ctx.textAlign = 'center';
      ctx.fillText(`${Math.round(comp*200)} MPa`, cx, topPY-20);

      // Powder region
      const pg = ctx.createLinearGradient(0,pwdT,0,pwdB);
      pg.addColorStop(0, `rgba(100,60,0,${.1+comp*.45})`);
      pg.addColorStop(.5,`rgba(180,80,0,${.15+comp*.3})`);
      pg.addColorStop(1, `rgba(100,60,0,${.1+comp*.45})`);
      ctx.fillStyle = pg;
      ctx.fillRect(dieX+wallT, pwdT, dieW-wallT*2, pwdH);

      // Particles
      this.parts.forEach(p => {
        const pos = this._screenPos(p, W, H, comp, dieX+wallT, dieW-wallT*2, dieTopY, dieH);
        const r   = p.el.r * (1-comp*.22);
        const [cr,cg,cb] = p.el.rgb;
        ctx.save();
        ctx.shadowColor = p.el.color; ctx.shadowBlur = 4+comp*8;
        const g = ctx.createRadialGradient(pos.x-r*.3,pos.y-r*.3,0,pos.x,pos.y,r);
        g.addColorStop(0,`rgba(${cr},${cg},${cb},.95)`);
        g.addColorStop(1,`rgba(${cr},${cg},${cb},.35)`);
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(pos.x,pos.y,Math.max(2,r),0,Math.PI*2); ctx.fill();
        ctx.restore();
      });

      // Lightning arcs
      this.arcs.forEach(a => {
        ctx.save();
        ctx.globalAlpha = a.life;
        ctx.strokeStyle = `rgba(180,210,255,${a.life})`;
        ctx.lineWidth = 1.5+a.life*.8;
        ctx.shadowColor = '#60a5fa'; ctx.shadowBlur = 18;
        ctx.beginPath(); ctx.moveTo(a.x1,a.y1);
        for (let s=1; s<6; s++) {
          const t=s/6;
          ctx.lineTo(
            a.x1+(a.x2-a.x1)*t+(Math.random()-.5)*18,
            a.y1+(a.y2-a.y1)*t+(Math.random()-.5)*18
          );
        }
        ctx.lineTo(a.x2,a.y2); ctx.stroke(); ctx.restore();
      });

      // Readouts
      const T = Math.round(20+comp*1380);
      ctx.save();
      ctx.font = 'bold 13px monospace'; ctx.textAlign = 'right';
      ctx.fillStyle = `rgba(${Math.min(255,Math.round(comp*600))},${Math.max(0,Math.round(100-comp*200))},30,.9)`;
      ctx.fillText(`T: ${T} °C`,    W-14, H-12);
      ctx.fillText(`P: ${Math.round(comp*200)} MPa`, W-14, H-28);
      ctx.fillStyle = '#6b7280'; ctx.textAlign = 'left'; ctx.font = '10px monospace';
      ctx.fillText('SPARK PLASMA SINTERING — 50 kA pulsed DC', 14, H-12);
      ctx.restore();
    }
  }

  /* ══════════════════════════════════════════════════════════════
     VIZ 4: Device Assembly (DOM)
  ══════════════════════════════════════════════════════════════ */
  function initDevice() {
    const ex  = document.getElementById('deviceExploded');
    const btn = document.getElementById('toggleDevice');
    if (!ex || !btn) return;
    let open = true;
    btn.addEventListener('click', () => {
      open = !open;
      ex.classList.toggle('collapsed', !open);
      btn.textContent = open ? '📦 Collapse Assembly' : '🔧 Explode Assembly';
    });
    const screenBody = document.querySelector('.dev-layer--screen .dev-layer__body--screen');
    if (screenBody) {
      screenBody.addEventListener('pointerdown', () => {
        document.querySelector('.dev-layer--screen')?.classList.add('pressed');
        setTimeout(() => document.querySelector('.dev-layer--screen')?.classList.remove('pressed'), 700);
      });
    }
  }

  /* ══════════════════════════════════════════════════════════════
     LEGEND BUILDER
  ══════════════════════════════════════════════════════════════ */
  function buildLegend(id) {
    const el = document.getElementById(id);
    if (!el) return;
    Object.entries(EL).forEach(([sym, data]) => {
      const d = document.createElement('div');
      d.className = 'legend-item';
      d.innerHTML = `<span class="legend-dot" style="background:${data.color};box-shadow:0 0 7px ${data.color}"></span><span class="legend-sym">${sym}</span><span class="legend-name">${data.name}</span>`;
      el.appendChild(d);
    });
  }

  /* ─── Canvas roundRect polyfill ─────────────────────────────── */
  if (typeof CanvasRenderingContext2D !== 'undefined' && !CanvasRenderingContext2D.prototype.roundRect) {
    CanvasRenderingContext2D.prototype.roundRect = function(x,y,w,h,r) { this.rect(x,y,w,h); };
  }

  /* ─── Boot ───────────────────────────────────────────────────── */
  document.addEventListener('DOMContentLoaded', () => {
    buildLegend('legendGrid');

    const lc = document.getElementById('latticeCanvas');
    if (lc) new LatticeViz(lc,
      document.getElementById('stressSlider'),
      document.getElementById('stressVal'),
      document.getElementById('fireRadiation'),
      document.getElementById('resetLattice')
    );

    const bc = document.getElementById('betavoltCanvas');
    if (bc) new BetavoltaicViz(bc);

    const sc = document.getElementById('spsCanvas');
    if (sc) new SPSViz(sc);

    initDevice();
  });

}());
