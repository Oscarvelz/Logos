import { PhononTTS } from './phonon/index.js';
import { VOICES } from './voices.js';

const MODEL_BASE = 'https://huggingface.co/empyrealworks/Phonon-40M-multilingual/resolve/1191d231388bc97330225a2cece698c074eaa3ca/';
const VOICE_BASE = 'https://huggingface.co/gradium/phonon-voices/resolve/0ee17205f254b5abc43b266c8a0f215565c352f7/';

const TEXTS = {
  es: 'Hay una grieta en todo; así es como entra la luz. A veces pensamos que la vida se mide en grandes momentos, pero se teje en los pequeños: un café al amanecer, una conversación que no queríamos terminar, el silencio cómodo entre dos amigos.',
  en: 'There is a crack in everything; that is how the light gets in. We like to think life is measured in big moments, but it is woven from small ones: coffee at dawn, a conversation we did not want to end, the easy silence between two friends.',
};

const THREADS = +(new URLSearchParams(location.search).get('threads') || 1);
const $ = (id) => document.getElementById(id);
const statusEl = $('status'), prog = $('prog'), playBtn = $('play'), voiceSel = $('voice'), textEl = $('text');
let tts = null;
let locale = 'es-mx';
let ctx = null, analyser = null, playing = null;

// Threads need a cross-origin isolated page: a tiny service worker adds the headers.
async function isolate() {
  if (self.crossOriginIsolated || !('serviceWorker' in navigator)) return;
  try {
    const reg = await navigator.serviceWorker.register('./sw.js', { scope: './' });
    await navigator.serviceWorker.ready;
    if (!sessionStorage.getItem('coi-reloaded2') && (reg.active || navigator.serviceWorker.controller)) {
      sessionStorage.setItem('coi-reloaded2', '1');
      location.reload();
      return new Promise(() => {});
    }
  } catch { /* single thread then */ }
}

function fillVoices() {
  const list = VOICES.filter((v) => v.l === locale);
  voiceSel.innerHTML = list.map((v) => `<option value="${v.id}">${v.n} · ${v.g === 'f' ? 'female' : 'male'}</option>`).join('');
  showDesc();
  textEl.value = TEXTS[locale.slice(0, 2)];
}
function showDesc() {
  const v = VOICES.find((x) => x.id === voiceSel.value);
  $('vdesc').textContent = v ? v.d : '';
}
voiceSel.addEventListener('change', showDesc);
document.querySelectorAll('#modes .chip').forEach((c) => {
  c.classList.toggle('on', +c.dataset.t === THREADS);
  c.addEventListener('click', () => { if (+c.dataset.t !== THREADS) location.search = c.dataset.t === '1' ? '' : '?threads=' + c.dataset.t; });
});
$('langs').addEventListener('click', (e) => {
  const b = e.target.closest('.chip'); if (!b) return;
  document.querySelectorAll('#langs .chip').forEach((c) => c.classList.toggle('on', c === b));
  locale = b.dataset.loc; fillVoices();
});

let engineLang = '';
async function boot() {
  await isolate();
  fillVoices();
  await loadEngine('es');
}
async function loadEngine(lang) {
  if (tts && engineLang === lang) return;
  if (tts) { tts.dispose(); tts = null; }
  engineLang = lang;
  playBtn.disabled = true;
  const t0 = performance.now();
  const sizes = {};
  try {
    tts = await PhononTTS.load({
      lang,
      quant: 'q8',
      threads: THREADS,
      model: {
        weights: { q8: MODEL_BASE + 'model.q8.gguf' },
        tokenizer: MODEL_BASE + 'tokenizer.json',
        config: MODEL_BASE + 'config.json',
        voices: { default: MODEL_BASE + 'default-voice.safetensors' },
        defaultVoice: 'default',
      },
      onProgress: ({ file, loaded, total, cached }) => {
        sizes[file] = [loaded, total || loaded];
        const l = Object.values(sizes).reduce((a, b) => a + b[0], 0), t = Object.values(sizes).reduce((a, b) => a + b[1], 0);
        prog.style.width = `${Math.round((l / Math.max(t, 1)) * 100)}%`;
        statusEl.textContent = cached ? 'Starting from this phone…' : `Downloading the voice engine · ${(l / 1e6).toFixed(0)} of ${(t / 1e6).toFixed(0)} MB`;
      },
    });
  } catch (err) {
    statusEl.textContent = 'Could not start: ' + err.message;
    return;
  }
  const ms = performance.now() - t0;
  $('sLoad').textContent = ms < 1000 ? `${Math.round(ms)} ms` : `${(ms / 1000).toFixed(1)} s`;
  $('sCpu').textContent = tts.device === 'webgpu' ? 'GPU' : `${tts.threads} ${tts.threads === 1 ? 'core' : 'cores'}`;
  prog.style.width = '100%';
  statusEl.textContent = 'Ready. Tap play.';
  playBtn.disabled = false;
}

async function speak() {
  if (playing) { stop(); return; }
  const v = VOICES.find((x) => x.id === voiceSel.value);
  const lang = locale.slice(0, 2);
  if (engineLang !== lang) { statusEl.textContent = 'Switching language…'; await loadEngine(lang); }
  ctx = ctx || new AudioContext({ sampleRate: tts.sampleRate });
  await ctx.resume();
  if (!analyser) { analyser = ctx.createAnalyser(); analyser.fftSize = 256; analyser.smoothingTimeConstant = 0.75; analyser.connect(ctx.destination); drawViz(); }
  playBtn.classList.add('busy');
  playBtn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M7 6h4v12H7zm6 0h4v12h-4z"/></svg>';
  statusEl.textContent = `Preparing ${v.n}…`;
  if (!tts.voices.includes(v.id)) await tts.addVoice(v.id, VOICE_BASE + v.f);
  const ctrl = new AbortController();
  const sources = [];
  playing = { ctrl, sources };
  const t0 = performance.now();
  let first = 0, samples = 0, t = 0;
  const stream = tts.stream(textEl.value, { voice: v.id, signal: ctrl.signal });
  try {
    for await (const pcm of stream) {
      if (!first) { first = performance.now() - t0; $('sFirst').textContent = `${Math.round(first)} ms`; statusEl.textContent = `Speaking · ${v.n}`; t = ctx.currentTime + 0.05; }
      samples += pcm.length;
      const buf = ctx.createBuffer(1, pcm.length, tts.sampleRate);
      buf.getChannelData(0).set(pcm);
      const src = ctx.createBufferSource();
      src.buffer = buf; src.connect(analyser);
      t = Math.max(t, ctx.currentTime);
      src.start(t); t += buf.duration;
      sources.push(src);
      const gen = (performance.now() - t0) / 1000;
      $('sSpeed').textContent = `${(samples / tts.sampleRate / gen).toFixed(1)}×`;
    }
  } catch (err) {
    if (err.name !== 'AbortError') statusEl.textContent = 'Error: ' + err.message;
  }
  if (playing && playing.ctrl === ctrl) {
    const audioSec = samples / tts.sampleRate;
    const gen = (performance.now() - t0) / 1000;
    $('sSpeed').textContent = `${(audioSec / gen).toFixed(1)}×`;
    statusEl.textContent = `Made ${audioSec.toFixed(1)} s of speech in ${gen.toFixed(1)} s.`;
    const left = Math.max(0, t - ctx.currentTime);
    setTimeout(() => { if (playing && playing.ctrl === ctrl) done(); }, left * 1000);
  }
}
function stop() {
  if (!playing) return;
  playing.ctrl.abort();
  playing.sources.forEach((s) => { try { s.stop(); } catch {} });
  done();
  statusEl.textContent = 'Stopped.';
}
function done() {
  playing = null;
  playBtn.classList.remove('busy');
  playBtn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>';
}
playBtn.addEventListener('click', () => { if (tts) speak(); });

function drawViz() {
  const c = $('viz'), g = c.getContext('2d');
  const data = new Uint8Array(analyser.frequencyBinCount);
  const frame = () => {
    const w = c.width = c.clientWidth * devicePixelRatio, h = c.height = c.clientHeight * devicePixelRatio;
    analyser.getByteFrequencyData(data);
    g.clearRect(0, 0, w, h);
    const n = 48, bw = w / n;
    const grad = g.createLinearGradient(0, h, 0, 0); grad.addColorStop(0, '#e8b65c'); grad.addColorStop(1, '#f3d08e');
    g.fillStyle = grad;
    for (let i = 0; i < n; i++) {
      const v = data[Math.floor(i * (data.length * 0.7) / n)] / 255;
      const bh = Math.max(3 * devicePixelRatio, v * h);
      const x = i * bw + bw * 0.2, y = (h - bh) / 2;
      g.beginPath(); g.roundRect(x, y, bw * 0.6, bh, bw * 0.3); g.fill();
    }
    requestAnimationFrame(frame);
  };
  frame();
}

boot();
