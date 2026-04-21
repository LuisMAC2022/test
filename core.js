const EXAMPLE_CODE = `function setup(api) {
  api.state.orbs = Array.from({ length: 120 }, (_, i) => ({
    angle: (i / 120) * Math.PI * 2,
    speed: 0.2 + api.random() * 1.2,
    radius: 2 + api.random() * 10,
    orbit: 30 + api.random() * Math.min(api.width, api.height) * 0.35,
    hue: (i * 7) % 360
  }));
}

function draw(api) {
  const { ctx, width, height, mouse, time } = api;

  ctx.fillStyle = "rgba(2, 6, 23, 0.18)";
  ctx.fillRect(0, 0, width, height);

  api.grid(40, "rgba(148, 163, 184, 0.08)");

  const cx = mouse.inside ? mouse.x : width * 0.5;
  const cy = mouse.inside ? mouse.y : height * 0.5;

  for (const orb of api.state.orbs) {
    const a = orb.angle + time * orb.speed;
    const x = cx + Math.cos(a) * orb.orbit;
    const y = cy + Math.sin(a * 1.18) * orb.orbit * 0.65;

    ctx.beginPath();
    ctx.fillStyle = \`hsla(${orb.hue + time * 40}, 90%, 65%, 0.85)\`;
    ctx.arc(x, y, orb.radius, 0, Math.PI * 2);
    ctx.fill();
  }

  api.circle(cx, cy, 12, "rgba(255,255,255,0.9)", null, 0);
  api.text("Mueve el mouse", 24, 34, "#e5e7eb", "16px monospace");
  api.text("Edita setup(api) y draw(api)", 24, 58, "#94a3b8", "14px monospace");
}`;

const editor = document.getElementById('codeEditor');
const canvas = document.getElementById('stage');
const ctx = canvas.getContext('2d');
const runBtn = document.getElementById('runBtn');
const pauseBtn = document.getElementById('pauseBtn');
const resetBtn = document.getElementById('resetBtn');
const clearLogBtn = document.getElementById('clearLogBtn');
const consoleOutput = document.getElementById('consoleOutput');
const statusPill = document.getElementById('statusPill');
const resolutionLabel = document.getElementById('resolutionLabel');
const fpsLabel = document.getElementById('fpsLabel');

const STORAGE_KEY = 'canvas-playground-code-v1';

const state = {
  frame: 0,
  time: 0,
  dt: 0,
  paused: false,
  lastTs: 0,
  fps: 0,
  fpsAccumulator: 0,
  fpsFrames: 0,
  sketch: { setup: null, draw: null },
  userState: {},
  mouse: { x: 0, y: 0, down: false, inside: false },
  keys: {},
};

function log(...parts) {
  const message = parts.map((item) => {
    if (typeof item === 'string') return item;
    try { return JSON.stringify(item, null, 2); } catch { return String(item); }
  }).join(' ');
  consoleOutput.textContent += message + '\n';
  consoleOutput.scrollTop = consoleOutput.scrollHeight;
}

function setStatus(text, kind = 'ready') {
  statusPill.textContent = text;
  statusPill.style.background = kind === 'error'
    ? 'rgba(248, 113, 113, 0.14)'
    : 'rgba(14, 165, 233, 0.18)';
  statusPill.style.color = kind === 'error' ? '#fecaca' : '#bae6fd';
  statusPill.style.borderColor = kind === 'error'
    ? 'rgba(248, 113, 113, 0.3)'
    : 'rgba(56, 189, 248, 0.3)';
}

function fitCanvas() {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  const width = Math.max(320, Math.floor(rect.width));
  const height = Math.max(320, Math.floor(rect.height));
  canvas.width = Math.floor(width * dpr);
  canvas.height = Math.floor(height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  resolutionLabel.textContent = `${width} × ${height}`;
}

function random(min = 0, max = 1) {
  return min + Math.random() * (max - min);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function map(value, inMin, inMax, outMin, outMax) {
  if (inMax === inMin) return outMin;
  const t = (value - inMin) / (inMax - inMin);
  return outMin + (outMax - outMin) * t;
}

function buildApi() {
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;

  return {
    canvas,
    ctx,
    width,
    height,
    frame: state.frame,
    time: state.time,
    dt: state.dt,
    mouse: state.mouse,
    keys: state.keys,
    state: state.userState,
    random,
    clamp,
    map,
    log,
    clear(color = '#020617') {
      ctx.save();
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, width, height);
      ctx.restore();
    },
    circle(x, y, radius, fill = null, stroke = '#e5e7eb', lineWidth = 1) {
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      if (fill) {
        ctx.fillStyle = fill;
        ctx.fill();
      }
      if (stroke && lineWidth > 0) {
        ctx.lineWidth = lineWidth;
        ctx.strokeStyle = stroke;
        ctx.stroke();
      }
    },
    rect(x, y, w, h, fill = null, stroke = '#e5e7eb', lineWidth = 1) {
      if (fill) {
        ctx.fillStyle = fill;
        ctx.fillRect(x, y, w, h);
      }
      if (stroke && lineWidth > 0) {
        ctx.lineWidth = lineWidth;
        ctx.strokeStyle = stroke;
        ctx.strokeRect(x, y, w, h);
      }
    },
    line(x1, y1, x2, y2, stroke = '#e5e7eb', lineWidth = 1) {
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.lineWidth = lineWidth;
      ctx.strokeStyle = stroke;
      ctx.stroke();
    },
    grid(size = 40, color = 'rgba(148, 163, 184, 0.15)') {
      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      for (let x = 0; x <= width; x += size) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 0; y <= height; y += size) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }
      ctx.restore();
    },
    text(content, x, y, color = '#e5e7eb', font = '16px sans-serif') {
      ctx.save();
      ctx.fillStyle = color;
      ctx.font = font;
      ctx.fillText(content, x, y);
      ctx.restore();
    }
  };
}

function compileSketch(code) {
  const scopedConsole = {
    log: (...args) => log(...args),
    warn: (...args) => log('[warn]', ...args),
    error: (...args) => log('[error]', ...args)
  };

  const factory = new Function(
    'api',
    'console',
    `"use strict";\n${code}\nreturn {\n  setup: typeof setup === 'function' ? setup : null,\n  draw: typeof draw === 'function' ? draw : null\n};`
  );

  return factory(buildApi(), scopedConsole);
}

function applySketch() {
  const code = editor.value;
  localStorage.setItem(STORAGE_KEY, code);
  consoleOutput.textContent = '';
  state.userState = {};
  state.frame = 0;
  state.time = 0;
  state.dt = 0;
  try {
    state.sketch = compileSketch(code);
    if (typeof state.sketch.setup === 'function') {
      state.sketch.setup(buildApi());
    }
    setStatus('ejecutando');
    log('Sketch compilado correctamente.');
  } catch (error) {
    state.sketch = { setup: null, draw: null };
    setStatus('error', 'error');
    log(error?.stack || String(error));
  }
}

function tick(ts) {
  if (!state.lastTs) state.lastTs = ts;
  const rawDt = (ts - state.lastTs) / 1000;
  state.lastTs = ts;

  if (!state.paused) {
    state.dt = Math.min(rawDt, 0.05);
    state.time += state.dt;
    state.frame += 1;

    try {
      ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);
      if (typeof state.sketch.draw === 'function') {
        state.sketch.draw(buildApi());
      }
    } catch (error) {
      state.paused = true;
      pauseBtn.textContent = 'Reanudar';
      setStatus('error en draw', 'error');
      log(error?.stack || String(error));
    }
  }

  state.fpsAccumulator += rawDt;
  state.fpsFrames += 1;
  if (state.fpsAccumulator >= 0.25) {
    state.fps = Math.round(state.fpsFrames / state.fpsAccumulator);
    fpsLabel.textContent = String(state.fps);
    state.fpsAccumulator = 0;
    state.fpsFrames = 0;
  }

  requestAnimationFrame(tick);
}

function loadInitialCode() {
  editor.value = localStorage.getItem(STORAGE_KEY) || EXAMPLE_CODE;
}

runBtn.addEventListener('click', applySketch);

pauseBtn.addEventListener('click', () => {
  state.paused = !state.paused;
  pauseBtn.textContent = state.paused ? 'Reanudar' : 'Pausar';
  setStatus(state.paused ? 'pausado' : 'ejecutando');
});

resetBtn.addEventListener('click', () => {
  editor.value = EXAMPLE_CODE;
  applySketch();
});

clearLogBtn.addEventListener('click', () => {
  consoleOutput.textContent = '';
});

editor.addEventListener('keydown', (event) => {
  if (event.key === 'Tab') {
    event.preventDefault();
    const start = editor.selectionStart;
    const end = editor.selectionEnd;
    editor.value = `${editor.value.slice(0, start)}  ${editor.value.slice(end)}`;
    editor.selectionStart = editor.selectionEnd = start + 2;
    return;
  }

  if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
    event.preventDefault();
    applySketch();
  }
});

window.addEventListener('resize', () => {
  fitCanvas();
  if (typeof state.sketch.setup === 'function') {
    const oldState = state.userState;
    state.userState = oldState;
  }
});

canvas.addEventListener('mousemove', (event) => {
  const rect = canvas.getBoundingClientRect();
  state.mouse.x = event.clientX - rect.left;
  state.mouse.y = event.clientY - rect.top;
});

canvas.addEventListener('mouseenter', () => {
  state.mouse.inside = true;
});

canvas.addEventListener('mouseleave', () => {
  state.mouse.inside = false;
});

canvas.addEventListener('mousedown', () => {
  state.mouse.down = true;
});

window.addEventListener('mouseup', () => {
  state.mouse.down = false;
});

window.addEventListener('keydown', (event) => {
  state.keys[event.key] = true;
});

window.addEventListener('keyup', (event) => {
  state.keys[event.key] = false;
});

loadInitialCode();
fitCanvas();
applySketch();
requestAnimationFrame(tick);