"use strict";

/*
  PORTAL DE LA FERIA MATEMÁTICA — INSCO TALCA
  Para cambiar o agregar juegos, edita este arreglo.
  Si agregas juegos, la ruleta se ajustará automáticamente.
  Los enlaces se abren en sus sitios originales (GitHub Pages).
*/
const GAMES = [
  {
    id: "canon",
    name: "Suma rana",
    lines: ["Cañón", "matemático"],
    icon: "🐸",
    description: "Apunta, calcula y dispara al resultado correcto.",
    color: "#2786bc",
    accent: "#7ad2ff",
    url: "https://cyclo45.github.io/RANA-MATEMATICA-/"
  },
  {
    id: "rana",
    name: "Cañón o rana matemática",
    lines: ["Cañón o rana", "matemática"],
    icon: "🐸",
    description: "Desafíos matemáticos espaciales y minijuegos de habilidad.",
    color: "#188b80",
    accent: "#78efd6",
    url: "https://francisx5658.github.io/Matematicas-Juego/"
  },
  {
    id: "planetas",
    name: "Ranking Planetario",
    lines: ["Ranking", "planetario"],
    icon: "🪐",
    description: "Responde preguntas y avanza en tu viaje por los planetas.",
    color: "#6b5dbe",
    accent: "#b6a5ff",
    url: "https://francilira777-dotcom.github.io/mates-minijuego/"
  },
  {
    id: "blackjack",
    name: "Black Jack",
    lines: ["Black", "Jack"],
    icon: "♠️",
    description: "Acércate al 21 resolviendo operaciones matemáticas.",
    color: "#ad6071",
    accent: "#ffb8c8",
    url: "https://9klslay.github.io/Blackjack/"
  },
  {
    id: "tetris",
    name: "Tetris Matemático",
    lines: ["Tetris", "matemático"],
    icon: "🧩",
    description: "Encaja piezas y resuelve cálculos para sumar puntos.",
    color: "#b7823d",
    accent: "#ffd18d",
    url: "https://tomixcm.github.io/TetrisMatematico/"
  },
  {
    id: "buscaminas",
    name: "Buscaminas Matemático",
    lines: ["Buscaminas", "matemático"],
    icon: "💣",
    description: "Descubre casillas acertando operaciones y evita las minas.",
    color: "#386e9d",
    accent: "#9cc9ff",
    url: "https://zerrit0.github.io/juego-/"
  }
];

const STORAGE_KEY = "insco-semana-matematicas-2026-portal-v1";
const byId = (id) => document.getElementById(id);
const wheelCanvas = byId("wheelCanvas");
const wheelStage = byId("wheelStage");
const spinButton = byId("spinButton");
const balanceToggle = byId("balanceToggle");
const soundButton = byId("soundButton");
const selectionPanel = byId("selectionPanel");
const playLink = byId("playLink");
const ctx = wheelCanvas.getContext("2d");

const freshState = (keepBalance = true) => ({
  total: 0,
  counts: Object.fromEntries(GAMES.map((game) => [game.id, 0])),
  recent: [],
  bag: [],
  balanced: keepBalance
});

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return freshState();
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return freshState();
    const state = freshState(parsed.balanced !== false);
    state.total = Number.isSafeInteger(parsed.total) && parsed.total >= 0 ? parsed.total : 0;
    for (const game of GAMES) {
      const count = parsed.counts?.[game.id];
      state.counts[game.id] = Number.isSafeInteger(count) && count >= 0 ? count : 0;
    }
    if (Array.isArray(parsed.recent)) {
      state.recent = parsed.recent.filter((id) => GAMES.some((game) => game.id === id)).slice(0, 6);
    }
    if (Array.isArray(parsed.bag)) {
      const unique = [...new Set(parsed.bag)];
      if (unique.length === parsed.bag.length && unique.every((index) => Number.isInteger(index) && index >= 0 && index < GAMES.length)) {
        state.bag = unique;
      }
    }
    return state;
  } catch (error) {
    console.warn("No se pudieron cargar los contadores locales:", error);
    return freshState();
  }
}

let state = loadState();
let isSpinning = false;
let wheelRotation = 0;
let soundEnabled = false;
let audioContext = null;
let tickingInterval = null;

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    // La ruleta sigue funcionando en navegación privada o con almacenamiento bloqueado.
    console.warn("No se pudieron guardar los contadores locales:", error);
  }
}

// Rechazo de módulo: todas las opciones tienen la misma probabilidad.
function randomInt(maxExclusive) {
  if (!Number.isInteger(maxExclusive) || maxExclusive < 1) throw new Error("Rango aleatorio inválido");
  if (globalThis.crypto?.getRandomValues) {
    const data = new Uint32Array(1);
    const bound = Math.floor(4294967296 / maxExclusive) * maxExclusive;
    do { globalThis.crypto.getRandomValues(data); } while (data[0] >= bound);
    return data[0] % maxExclusive;
  }
  return Math.floor(Math.random() * maxExclusive);
}

function shuffledIndexes() {
  const indexes = Array.from({ length: GAMES.length }, (_, index) => index);
  for (let i = indexes.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [indexes[i], indexes[j]] = [indexes[j], indexes[i]];
  }
  return indexes;
}

function pickGame() {
  if (!state.balanced) return randomInt(GAMES.length);
  if (state.bag.length === 0) state.bag = shuffledIndexes();
  return state.bag.pop();
}

function drawWheel() {
  if (!ctx) return;
  const bounds = wheelCanvas.getBoundingClientRect();
  const size = Math.max(200, Math.round(bounds.width));
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  wheelCanvas.width = Math.round(size * dpr);
  wheelCanvas.height = Math.round(size * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, size, size);

  const center = size / 2;
  const radius = center - 2;
  const slice = (2 * Math.PI) / GAMES.length;
  const startAngle = -Math.PI / 2 - slice / 2;

  for (let i = 0; i < GAMES.length; i++) {
    const game = GAMES[i];
    const start = startAngle + i * slice;
    const end = start + slice;
    const middle = (start + end) / 2;

    ctx.beginPath();
    ctx.moveTo(center, center);
    ctx.arc(center, center, radius, start, end);
    ctx.closePath();
    ctx.fillStyle = game.color;
    ctx.fill();
    ctx.lineWidth = Math.max(1.6, size * .006);
    ctx.strokeStyle = "rgba(240, 252, 255, .52)";
    ctx.stroke();

    ctx.save();
    ctx.translate(center, center);
    ctx.rotate(middle);
    ctx.beginPath();
    ctx.arc(0, 0, radius * .91, -slice * .43, slice * .43);
    ctx.strokeStyle = "rgba(255,255,255,.16)";
    ctx.lineWidth = Math.max(2, size * .012);
    ctx.stroke();
    ctx.restore();

    const labelRadius = radius * .67;
    const x = center + Math.cos(middle) * labelRadius;
    const y = center + Math.sin(middle) * labelRadius;
    let textRotation = middle + Math.PI / 2;
    const rotationNormalized = ((textRotation % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
    if (rotationNormalized > Math.PI / 2 && rotationNormalized < 3 * Math.PI / 2) textRotation += Math.PI;

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(textRotation);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = "rgba(2,13,26,.32)";
    ctx.shadowBlur = 5;
    ctx.fillStyle = "#fff";
    ctx.font = `${Math.round(size * .067)}px "Segoe UI Emoji", "Apple Color Emoji", sans-serif`;
    ctx.fillText(game.icon, 0, -25 * size / 390, size * .22);
    ctx.font = `700 ${Math.max(10, Math.round(size * .031))}px "Space Grotesk", "DM Sans", sans-serif`;
    const lineHeight = size * .040;
    const labelStart = game.lines.length > 1 ? 4 * size / 390 : 10 * size / 390;
    game.lines.forEach((line, index) => {
      ctx.fillText(line, 0, labelStart + index * lineHeight, size * .25);
    });
    ctx.restore();
  }
  ctx.save();
  ctx.beginPath();
  ctx.arc(center, center, radius - 1, 0, 2 * Math.PI);
  ctx.lineWidth = Math.max(3, size * .012);
  ctx.strokeStyle = "rgba(245,255,255,.36)";
  ctx.stroke();
  ctx.restore();
}

function renderGameCards() {
  const grid = byId("gamesGrid");
  grid.replaceChildren();
  GAMES.forEach((game, index) => {
    const card = document.createElement("article");
    card.className = "game-card";
    card.dataset.gameId = game.id;
    card.style.setProperty("--accent-color", game.accent);

    const heading = document.createElement("div");
    heading.className = "game-card-heading";
    const icon = document.createElement("span");
    icon.className = "game-card-icon";
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = game.icon;
    const tag = document.createElement("span");
    tag.className = "game-card-tag";
    tag.textContent = `JUEGO ${String(index + 1).padStart(2, "0")}`;
    heading.append(icon, tag);

    const title = document.createElement("h3");
    title.textContent = game.name;
    const paragraph = document.createElement("p");
    paragraph.textContent = game.description;
    const footer = document.createElement("div");
    footer.className = "game-card-footer";
    const role = document.createElement("strong");
    role.textContent = "DESAFÍO MATEMÁTICO";
    const draws = document.createElement("span");
    draws.dataset.countFor = game.id;
    footer.append(role, draws);
    card.append(heading, title, paragraph, footer);
    grid.append(card);
  });
}

function renderStats() {
  byId("totalDraws").textContent = String(state.total);
  byId("gamesCovered").innerHTML = `${GAMES.filter((game) => state.counts[game.id] > 0).length}<span class="stat-divider">/6</span>`;
  document.querySelectorAll("[data-count-for]").forEach((element) => {
    const count = state.counts[element.dataset.countFor] || 0;
    element.textContent = `${count} ${count === 1 ? "sorteo" : "sorteos"}`;
  });
  const list = byId("recentList");
  list.replaceChildren();
  if (state.recent.length === 0) {
    const empty = document.createElement("span");
    empty.className = "recent-empty";
    empty.textContent = "Aún no hay sorteos. ¡Sé el primero!";
    list.append(empty);
  } else {
    state.recent.forEach((id) => {
      const game = GAMES.find((item) => item.id === id);
      if (!game) return;
      const tag = document.createElement("span");
      tag.className = "recent-pill";
      tag.textContent = `${game.icon} ${game.name}`;
      list.append(tag);
    });
  }
  if (state.balanced) {
    const remaining = state.bag.length;
    byId("roundNote").textContent = remaining === 0
      ? "Nueva ronda preparada: 6 juegos disponibles."
      : `Quedan ${remaining} ${remaining === 1 ? "juego" : "juegos"} sin repetir en esta ronda.`;
  } else {
    byId("roundNote").textContent = "Todos los juegos tienen la misma probabilidad en cada giro.";
  }
}

function getAudioContext() {
  const AudioConstructor = window.AudioContext || window.webkitAudioContext;
  if (!AudioConstructor) return null;
  try {
    if (!audioContext) audioContext = new AudioConstructor();
    return audioContext;
  } catch { return null; }
}

function tone(frequency, seconds, delay = 0, volume = .036, type = "sine") {
  if (!soundEnabled) return;
  const audio = getAudioContext();
  if (!audio) return;
  const start = audio.currentTime + delay;
  const oscillator = audio.createOscillator();
  const gain = audio.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, start);
  gain.gain.setValueAtTime(.0001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + .012);
  gain.gain.exponentialRampToValueAtTime(.0001, start + seconds);
  oscillator.connect(gain);
  gain.connect(audio.destination);
  oscillator.start(start);
  oscillator.stop(start + seconds + .02);
}

function startTicking() {
  if (!soundEnabled) return;
  getAudioContext()?.resume().catch(() => {});
  let tick = 0;
  tickingInterval = window.setInterval(() => {
    tone(280 + ((tick++ % 4) * 36), .065, 0, .022, "triangle");
  }, 220);
}
function stopTicking() {
  if (tickingInterval !== null) {
    window.clearInterval(tickingInterval);
    tickingInterval = null;
  }
}
function successSound() {
  [523, 659, 784, 1047].forEach((pitch, index) => tone(pitch, .22, index * .115, .035));
}

function celebrate() {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const layer = byId("confettiLayer");
  const colors = ["#70f4d2", "#a695fa", "#ffd18d", "#ffb8c8", "#7ad2ff", "#ffffff"];
  for (let i = 0; i < 43; i++) {
    const piece = document.createElement("span");
    piece.className = "confetti-piece";
    piece.style.left = `${Math.random() * 100}%`;
    piece.style.backgroundColor = colors[i % colors.length];
    piece.style.borderRadius = i % 3 === 0 ? "50%" : "2px";
    piece.style.animationDelay = `${Math.random() * .35}s`;
    piece.style.setProperty("--duration", `${(2 + Math.random() * 1.5).toFixed(2)}s`);
    piece.style.setProperty("--drift", `${Math.round((Math.random() - .5) * 190)}px`);
    piece.style.setProperty("--spin", `${Math.round(420 + Math.random() * 750)}deg`);
    layer.append(piece);
    window.setTimeout(() => piece.remove(), 4400);
  }
}

function showSelection(index) {
  const game = GAMES[index];
  state.total += 1;
  state.counts[game.id] += 1;
  state.recent.unshift(game.id);
  state.recent = state.recent.slice(0, 6);
  saveState();
  renderStats();

  byId("selectedIcon").textContent = game.icon;
  byId("selectedName").textContent = game.name;
  byId("selectedDescription").textContent = game.description;
  playLink.href = game.url;
  playLink.setAttribute("aria-label", `Entrar a ${game.name}. Se abre en una pestaña nueva.`);
  selectionPanel.hidden = false;
  byId("spinStatus").textContent = `¡Listo! Te tocó ${game.name}.`;
  byId("spinButtonText").textContent = "GIRAR OTRA VEZ";
  document.querySelectorAll(".game-card").forEach((card) => card.classList.toggle("is-selected", card.dataset.gameId === game.id));
  successSound();
  celebrate();
}

function spin() {
  if (isSpinning || !ctx) return;
  isSpinning = true;
  spinButton.disabled = true;
  balanceToggle.disabled = true;
  byId("resetButton").disabled = true;
  selectionPanel.hidden = true;
  byId("spinStatus").textContent = "La ruleta está girando… ¡mucha suerte!";
  byId("spinButtonText").textContent = "SORTEANDO TU DESAFÍO…";
  wheelStage.classList.add("is-spinning");
  document.querySelectorAll(".game-card").forEach((card) => card.classList.remove("is-selected"));

  const index = pickGame();
  const sectionDegrees = 360 / GAMES.length;
  // Centro del sector elegido bajo la flecha fija (parte superior).
  const desired = (360 - index * sectionDegrees) % 360;
  const normalizedCurrent = ((wheelRotation % 360) + 360) % 360;
  const adjustment = (desired - normalizedCurrent + 360) % 360;
  const turns = 6 + randomInt(3);
  wheelRotation += 360 * turns + adjustment;

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const duration = reducedMotion ? 30 : 4850;
  wheelCanvas.style.transition = `transform ${duration}ms cubic-bezier(.12,.74,.12,1)`;
  startTicking();

  let completed = false;
  let fallbackTimer = null;
  function finish() {
    if (completed) return;
    completed = true;
    window.clearTimeout(fallbackTimer);
    wheelCanvas.removeEventListener("transitionend", onTransitionEnd);
    stopTicking();
    wheelStage.classList.remove("is-spinning");
    isSpinning = false;
    spinButton.disabled = false;
    balanceToggle.disabled = false;
    byId("resetButton").disabled = false;
    showSelection(index);
  }
  function onTransitionEnd(event) {
    if (event.target === wheelCanvas && event.propertyName === "transform") finish();
  }
  wheelCanvas.addEventListener("transitionend", onTransitionEnd);
  fallbackTimer = window.setTimeout(finish, duration + 160);
  requestAnimationFrame(() => requestAnimationFrame(() => {
    wheelCanvas.style.transform = `rotate(${wheelRotation}deg)`;
  }));
}

spinButton.addEventListener("click", spin);

balanceToggle.checked = state.balanced;
balanceToggle.addEventListener("change", () => {
  state.balanced = balanceToggle.checked;
  state.bag = [];
  byId("balanceExplanation").textContent = state.balanced
    ? "Los 6 juegos aparecen una vez por ronda, en orden aleatorio."
    : "Azar puro: cada giro es independiente y pueden repetirse juegos.";
  saveState();
  renderStats();
});

soundButton.addEventListener("click", () => {
  soundEnabled = !soundEnabled;
  soundButton.setAttribute("aria-pressed", String(soundEnabled));
  soundButton.setAttribute("aria-label", soundEnabled ? "Desactivar sonido" : "Activar sonido");
  soundButton.title = soundEnabled ? "Desactivar sonido" : "Activar sonido";
  byId("soundIcon").textContent = soundEnabled ? "♫" : "♪";
  byId("soundLabel").textContent = soundEnabled ? "Sonido on" : "Sonido off";
  if (soundEnabled) {
    getAudioContext()?.resume().catch(() => {});
    tone(720, .12);
  } else {
    stopTicking();
  }
});

byId("resetButton").addEventListener("click", () => {
  if (!window.confirm("¿Reiniciar los sorteos, la distribución y el historial de este dispositivo?")) return;
  state = freshState(state.balanced);
  saveState();
  selectionPanel.hidden = true;
  playLink.removeAttribute("href");
  byId("spinStatus").textContent = "Contadores reiniciados. ¡Ya puedes volver a girar!";
  byId("spinButtonText").textContent = "¡GIRAR LA RULETA!";
  document.querySelectorAll(".game-card").forEach((card) => card.classList.remove("is-selected"));
  renderStats();
});

renderGameCards();
renderStats();
if (window.ResizeObserver) {
  const observer = new ResizeObserver(() => drawWheel());
  observer.observe(wheelCanvas);
} else {
  window.addEventListener("resize", drawWheel);
}
requestAnimationFrame(drawWheel);
