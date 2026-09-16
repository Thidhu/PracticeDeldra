const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
let dragging = null;

function resizeCanvas() {
  const containerWidth = Math.min(920, window.innerWidth - 30);
  canvas.width = containerWidth;
  canvas.height = Math.max(520, containerWidth * 0.68);
}

// ---------------------------------------------------------------------
// Data
// NOTE: "rule" is a short, teacher-editable explanation shown as a
// progressive hint after a couple of wrong tries. Edit these to match
// exactly how you teach the rule in class — I've kept them generic.
// ---------------------------------------------------------------------
let nouns = [
  {text: "མི་", expected: "གི་", baseX: 0.12, baseY: 0.22, placed: null, status: null, hintId: "hint1",
   rule: "མི་ ends in a letter that takes གི་.", attempts: 0},
  {text: "སློབ་དཔོན་", expected: "གྱི་", baseX: 0.42, baseY: 0.22, placed: null, status: null, hintId: "hint2",
   rule: "སློབ་དཔོན་ ends in a letter that takes གྱི་.", attempts: 0},
  {text: "དུས་ཚོད་", expected: "ཀྱི་", baseX: 0.72, baseY: 0.22, placed: null, status: null, hintId: "hint3",
   rule: "དུས་ཚོད་ ends in a letter that takes ཀྱི་.", attempts: 0},
  {text: "བླམ་", expected: "གི་", baseX: 0.12, baseY: 0.52, placed: null, status: null, hintId: "hint4",
   rule: "བླམ་ ends in a letter that takes གི་.", attempts: 0},
  {text: "རྒྱལ་པོ", expected: "འི་", baseX: 0.42, baseY: 0.52, placed: null, status: null, hintId: "hint5",
   rule: "རྒྱལ་པོ ends in a vowel, so it takes འི་.", attempts: 0},
  {text: "མེ་ཏོག་", expected: "གི་", baseX: 0.72, baseY: 0.52, placed: null, status: null, hintId: "hint6",
   rule: "མེ་ཏོག་ ends in a letter that takes གི་.", attempts: 0}
];

const particleData = [
  {text: "གི་", color: "#e74c3c"},
  {text: "གྱི་", color: "#3498db"},
  {text: "ཀྱི་", color: "#2ecc71"},
  {text: "གི་", color: "#f39c12"},
  {text: "འི་",  color: "#9b59b6"},
  {text: "གི་", color: "#e91e63"}
];

let particles = [];

// Progress tracking for the new features
let score = 0;
let streak = 0;
let maxStreak = 0;
let mistakes = 0;

// ---------------------------------------------------------------------
// Dynamically-created UI (no HTML edits needed): status bar with
// mascot + score + streak, and a star rating shown on completion.
// ---------------------------------------------------------------------
let mascotEl, scoreEl, streakEl, starsEl;

function ensureStatusBar() {
  if (document.getElementById('gameStatusBar')) {
    mascotEl = document.getElementById('gameMascot');
    scoreEl = document.getElementById('gameScore');
    streakEl = document.getElementById('gameStreak');
    starsEl = document.getElementById('gameStars');
    return;
  }

  const bar = document.createElement('div');
  bar.id = 'gameStatusBar';
  bar.style.cssText = 'display:flex;align-items:center;gap:20px;font-family:sans-serif;font-size:20px;margin-bottom:10px;flex-wrap:wrap;';
  bar.innerHTML = `
    <span id="gameMascot" style="font-size:36px;transition:transform 0.15s;">🙂</span>
    <span id="gameScore" style="font-weight:bold;">Score: 0</span>
    <span id="gameStreak">🔥 Streak: 0</span>
    <span id="gameStars" style="font-size:22px;"></span>
  `;
  canvas.parentNode.insertBefore(bar, canvas);

  mascotEl = document.getElementById('gameMascot');
  scoreEl = document.getElementById('gameScore');
  streakEl = document.getElementById('gameStreak');
  starsEl = document.getElementById('gameStars');
}

function setMascot(emoji) {
  if (!mascotEl) return;
  mascotEl.textContent = emoji;
  mascotEl.style.transform = 'scale(1.3)';
  setTimeout(() => { mascotEl.style.transform = 'scale(1)'; }, 150);
}

function updateStatusBar() {
  if (scoreEl) scoreEl.textContent = `Score: ${score}`;
  if (streakEl) streakEl.textContent = `🔥 Streak: ${streak}`;
}

// ---------------------------------------------------------------------
// Confetti (self-contained, injects its own CSS + DOM elements)
// ---------------------------------------------------------------------
function ensureConfettiStyle() {
  if (document.getElementById('confettiStyle')) return;
  const style = document.createElement('style');
  style.id = 'confettiStyle';
  style.textContent = `
    @keyframes confettiFall {
      0%   { transform: translateY(-10px) rotate(0deg); opacity: 1; }
      100% { transform: translateY(420px) rotate(360deg); opacity: 0; }
    }
    .confetti-piece {
      position: absolute;
      top: 0;
      width: 10px;
      height: 10px;
      pointer-events: none;
      animation: confettiFall 1.6s ease-in forwards;
      z-index: 9999;
    }
  `;
  document.head.appendChild(style);
}

function launchConfetti() {
  ensureConfettiStyle();
  const colors = ['#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6', '#e91e63'];
  const rect = canvas.getBoundingClientRect();
  const container = document.createElement('div');
  container.style.cssText = `position:absolute; left:${rect.left + window.scrollX}px; top:${rect.top + window.scrollY}px; width:${rect.width}px; height:${rect.height}px; overflow:visible; pointer-events:none;`;
  document.body.appendChild(container);

  for (let i = 0; i < 60; i++) {
    const piece = document.createElement('div');
    piece.className = 'confetti-piece';
    piece.style.left = Math.random() * rect.width + 'px';
    piece.style.background = colors[Math.floor(Math.random() * colors.length)];
    piece.style.animationDelay = (Math.random() * 0.3) + 's';
    piece.style.borderRadius = Math.random() < 0.5 ? '50%' : '2px';
    container.appendChild(piece);
  }

  setTimeout(() => container.remove(), 2200);
}

// ---------------------------------------------------------------------
// Background music toggle
// ---------------------------------------------------------------------
const bgMusic = document.getElementById('bgMusic');
let musicPlaying = false;

function toggleMusic() {
  const btn = document.getElementById('musicBtn');
  if (!bgMusic) return;

  if (musicPlaying) {
    bgMusic.pause();
    musicPlaying = false;
    if (btn) btn.textContent = '🔈 Music';
  } else {
    bgMusic.play().catch(e => console.warn('Music playback failed (file missing or blocked):', e));
    musicPlaying = true;
    if (btn) btn.textContent = '🔇 Mute';
  }
}

// ---------------------------------------------------------------------
// Sound effects (Web Audio API, no external files needed)
// ---------------------------------------------------------------------
let audioCtx = null;
function getAudioCtx() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

function playTone(freq, startTime, duration, type = 'sine', gainPeak = 0.25) {
  const ac = getAudioCtx();
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  osc.connect(gain);
  gain.connect(ac.destination);

  gain.gain.setValueAtTime(0, startTime);
  gain.gain.linearRampToValueAtTime(gainPeak, startTime + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

  osc.start(startTime);
  osc.stop(startTime + duration + 0.02);
}

function playCorrectSound() {
  try {
    const ac = getAudioCtx();
    const now = ac.currentTime;
    playTone(523.25, now, 0.15, 'triangle');        // C5
    playTone(783.99, now + 0.12, 0.25, 'triangle');  // G5
  } catch (e) {
    console.warn('Audio playback failed:', e);
  }
}

function playWrongSound() {
  try {
    const ac = getAudioCtx();
    const now = ac.currentTime;
    playTone(220, now, 0.18, 'sawtooth', 0.15);
    playTone(160, now + 0.12, 0.22, 'sawtooth', 0.15);
  } catch (e) {
    console.warn('Audio playback failed:', e);
  }
}

function playFanfare() {
  try {
    const ac = getAudioCtx();
    const now = ac.currentTime;
    playTone(523.25, now, 0.15, 'triangle');
    playTone(659.25, now + 0.15, 0.15, 'triangle');
    playTone(783.99, now + 0.30, 0.15, 'triangle');
    playTone(1046.50, now + 0.45, 0.4, 'triangle');
  } catch (e) {
    console.warn('Audio playback failed:', e);
  }
}

// Shuffle
function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

// Build the pool with a FIXED home position per particle, so a returned
// particle always goes back to the exact spot it started at instead of a
// recalculated slot that can overlap another particle.
function resetParticles() {
  const slotWidth = canvas.width / 7;
  const shuffled = shuffle([...particleData]);
  particles = shuffled.map((p, i) => {
    const homeX = slotWidth * (1.2 + i);
    const homeY = canvas.height * 0.82;
    return { ...p, x: homeX, y: homeY, homeX, homeY };
  });
}

// Puts a particle back into the pool at ITS OWN home position.
function returnToPool(item) {
  item.x = item.homeX;
  item.y = item.homeY;
  particles.push(item);
}

function getScaledValues() {
  const scale = Math.min(canvas.width / 920, 1);
  return {
    slotW: 180 * scale,
    slotH: 80 * scale,
    nounFontSize: Math.max(22, 26 * scale),
    particleFontSize: Math.max(26, 32 * scale)
  };
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const s = getScaledValues();

  nouns.forEach(n => {
    const x = n.baseX * canvas.width;
    const y = n.baseY * canvas.height;

    // Background
    if (n.status === 'correct') ctx.fillStyle = "#d4edda";
    else if (n.status === 'wrong') ctx.fillStyle = "#f8d7da";
    else ctx.fillStyle = n.placed ? "#e8f5e9" : "#f8f9fa";
    ctx.fillRect(x, y, s.slotW, s.slotH);

    // Border
    if (n.status === 'correct') ctx.strokeStyle = "#28a745";
    else if (n.status === 'wrong') ctx.strokeStyle = "#dc3545";
    else if (n.placed) ctx.strokeStyle = "#4caf50";
    else ctx.strokeStyle = "#666";

    ctx.lineWidth = 4;
    ctx.strokeRect(x, y, s.slotW, s.slotH);

    // Noun
    ctx.fillStyle = "#1a1a1a";
    ctx.font = `bold ${s.nounFontSize}px 'myfont', sans-serif`;
    ctx.textBaseline = "middle";
    ctx.fillText(n.text, x + 20, y + s.slotH/2);

    if (n.placed) {
      ctx.fillStyle = n.placed.color;
      ctx.font = `bold ${s.particleFontSize}px 'myfont', sans-serif`;
      ctx.fillText(n.placed.text, x + s.slotW - 65, y + s.slotH/2);
    }
  });

  // Particles
  particles.forEach(p => {
    if (dragging && p === dragging) return;
    ctx.fillStyle = p.color;
    ctx.font = `bold ${s.particleFontSize}px 'myfont', sans-serif`;
    ctx.textBaseline = "middle";
    ctx.fillText(p.text, p.x, p.y);
  });

  if (dragging) {
    ctx.fillStyle = dragging.color;
    ctx.font = `bold ${s.particleFontSize}px 'myfont', sans-serif`;
    ctx.textBaseline = "middle";
    ctx.fillText(dragging.text, dragging.x, dragging.y);
  }
}

// Drag & Drop Functions
function getMousePos(e) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (e.clientX || (e.touches && e.touches[0].clientX)) - rect.left,
    y: (e.clientY || (e.touches && e.touches[0].clientY)) - rect.top
  };
}

function startDrag(e) {
  e.preventDefault();
  const pos = getMousePos(e);
  const s = getScaledValues();
  const hitRadius = s.particleFontSize * 1.4;

  for (let p of particles) {
    if (Math.hypot(pos.x - p.x, pos.y - p.y) < hitRadius) {
      dragging = p;
      dragging.origX = p.x;
      dragging.origY = p.y;
      return;
    }
  }
}

function moveDrag(e) {
  if (!dragging) return;
  const pos = getMousePos(e);
  dragging.x = pos.x;
  dragging.y = pos.y;
  draw();
}

// ---------------------------------------------------------------------
// Instant per-drop feedback + progressive hints + streak/score/mascot
// ---------------------------------------------------------------------
function evaluateSlot(n) {
  const isCorrect = n.placed && n.placed.text === n.expected;
  n.status = isCorrect ? 'correct' : 'wrong';
  const hintEl = document.getElementById(n.hintId);

  if (isCorrect) {
    hintEl.style.display = "none";
    n.attempts = 0;
    score += 10 + Math.min(streak, 5) * 2; // small streak bonus
    streak += 1;
    maxStreak = Math.max(maxStreak, streak);
    setMascot(streak >= 3 ? '🤩' : '😊');
    playCorrectSound();
  } else {
    n.attempts += 1;
    mistakes += 1;
    streak = 0;
    setMascot('😕');
    playWrongSound();

    // Progressive hint ladder:
    // 1st miss: just the red highlight, no extra text.
    // 2nd miss: show the rule.
    // 3rd+ miss: show the rule AND the correct answer.
    if (n.attempts === 1) {
      hintEl.style.display = "none";
    } else if (n.attempts === 2) {
      hintEl.textContent = n.rule;
      hintEl.style.display = "block";
    } else {
      hintEl.textContent = `${n.rule} (Answer: ${n.expected})`;
      hintEl.style.display = "block";
    }
  }

  updateStatusBar();
  maybeFinishIfComplete();
}

function maybeFinishIfComplete() {
  const allPlaced = nouns.every(n => n.placed);
  if (!allPlaced) return;
  const allCorrect = nouns.every(n => n.status === 'correct');
  if (allCorrect) {
    finishGame();
  }
}

function computeStars() {
  // 3 stars: no mistakes at all. 2 stars: a few. 1 star: many.
  if (mistakes === 0) return 3;
  if (mistakes <= nouns.length) return 2;
  return 1;
}

function finishGame() {
  const feedback = document.getElementById('feedback');
  const nextBtn = document.getElementById('nextLevelBtn');
  const stars = computeStars();

  feedback.innerHTML = "🎉 བཀྲ་ཤིས་བདེ་ལེགས། All correct! Excellent!";
  feedback.className = "correct";
  if (starsEl) starsEl.textContent = '⭐'.repeat(stars) + '☆'.repeat(3 - stars);
  if (nextBtn) nextBtn.style.display = "inline-block";

  setMascot('🎉');
  playFanfare();
  launchConfetti();
}

function endDrag(e) {
  if (!dragging) return;
  const pos = getMousePos(e);
  const s = getScaledValues();
  let dropped = false;
  let droppedInto = null;

  nouns.forEach(n => {
    const x = n.baseX * canvas.width;
    const y = n.baseY * canvas.height;

    if (pos.x > x && pos.x < x + s.slotW && pos.y > y && pos.y < y + s.slotH) {
      // If this slot already has a particle, give it back to its own home spot
      // in the pool instead of losing it.
      if (n.placed) {
        returnToPool(n.placed);
      }
      n.placed = dragging; // keep the full object (with homeX/homeY) so it can be returned later
      dropped = true;
      droppedInto = n;
    }
  });

  if (dropped) {
    particles = particles.filter(p => p !== dragging);
  } else {
    // Snap back to where it was picked up from.
    dragging.x = dragging.origX;
    dragging.y = dragging.origY;
  }

  dragging = null;
  draw();

  // Instant feedback the moment a particle lands in a slot.
  if (droppedInto) {
    evaluateSlot(droppedInto);
    draw();
  }
}

// Event Listeners
canvas.addEventListener('mousedown', startDrag);
canvas.addEventListener('mousemove', moveDrag);
canvas.addEventListener('mouseup', endDrag);
canvas.addEventListener('mouseleave', endDrag);

canvas.addEventListener('touchstart', startDrag, {passive: false});
canvas.addEventListener('touchmove', moveDrag, {passive: false});
canvas.addEventListener('touchend', endDrag, {passive: false});

// Manual "Check Answers" button still works as a summary / for slots
// that were placed silently (kept for backward compatibility with your
// existing HTML button).
function checkAnswers() {
  nouns.forEach(n => {
    if (n.placed && n.status === null) {
      evaluateSlot(n);
    }
  });

  const correctCount = nouns.filter(n => n.status === 'correct').length;
  if (correctCount < nouns.length) {
    const feedback = document.getElementById('feedback');
    const nextBtn = document.getElementById('nextLevelBtn');
    feedback.textContent = `${correctCount}/${nouns.length} correct. Try again!`;
    feedback.className = "";
    if (nextBtn) nextBtn.style.display = "none";
  }

  draw();
}

function resetGame() {
  nouns.forEach(n => {
    n.placed = null;
    n.status = null;
    n.attempts = 0;
  });

  score = 0;
  streak = 0;
  maxStreak = 0;
  mistakes = 0;
  updateStatusBar();
  if (starsEl) starsEl.textContent = '';
  setMascot('🙂');

  resetParticles();
  document.getElementById('feedback').innerHTML = '';
  document.querySelectorAll('.hint').forEach(h => h.style.display = 'none');
  const nextBtn = document.getElementById('nextLevelBtn');
  if (nextBtn) nextBtn.style.display = "none";
  draw();
}

function goToNextLevel() {
  window.location.href = "https://wordwall.net/play/113469/967/829";   // ← Change this to your next level
}

// Initialize
window.onload = () => {
  resizeCanvas();
  ensureStatusBar();
  resetParticles();
  updateStatusBar();
  draw();
};

window.onresize = () => {
  resizeCanvas();
  resetParticles();
  draw();
};
