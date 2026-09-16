const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
let dragging = null;

function resizeCanvas() {
  const containerWidth = Math.min(920, window.innerWidth - 30);
  canvas.width = containerWidth;
  canvas.height = Math.max(520, containerWidth * 0.68);
}

// Data
let nouns = [
  {text: "མི་", expected: "གི་", baseX: 0.12, baseY: 0.22, placed: null, status: null, hintId: "hint1"},
  {text: "སློབ་དཔོན་", expected: "གྱི་", baseX: 0.42, baseY: 0.22, placed: null, status: null, hintId: "hint2"},
  {text: "དུས་ཚོད་", expected: "ཀྱི་", baseX: 0.72, baseY: 0.22, placed: null, status: null, hintId: "hint3"},
  {text: "བླམ་", expected: "གི་", baseX: 0.12, baseY: 0.52, placed: null, status: null, hintId: "hint4"},
  {text: "རྒྱལ་པོ", expected: "འི་", baseX: 0.42, baseY: 0.52, placed: null, status: null, hintId: "hint5"},
  {text: "མེ་ཏོག་", expected: "གི་", baseX: 0.72, baseY: 0.52, placed: null, status: null, hintId: "hint6"}
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

// ---------- Background music toggle ----------
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

// ---------- Sound effects (Web Audio API, no external files needed) ----------
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

function endDrag(e) {
  if (!dragging) return;
  const pos = getMousePos(e);
  const s = getScaledValues();
  let dropped = false;

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
      n.status = null;
      document.getElementById(n.hintId).style.display = "none";
      dropped = true;
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
}

// Event Listeners
canvas.addEventListener('mousedown', startDrag);
canvas.addEventListener('mousemove', moveDrag);
canvas.addEventListener('mouseup', endDrag);
canvas.addEventListener('mouseleave', endDrag);

canvas.addEventListener('touchstart', startDrag, {passive: false});
canvas.addEventListener('touchmove', moveDrag, {passive: false});
canvas.addEventListener('touchend', endDrag, {passive: false});

// Check Answers
function checkAnswers() {
  let correctCount = 0;

  nouns.forEach(n => {
    const isCorrect = n.placed && n.placed.text === n.expected;
    n.status = isCorrect ? 'correct' : 'wrong';
    if (isCorrect) correctCount++;
    document.getElementById(n.hintId).style.display = isCorrect ? "none" : "block";
  });

  const feedback = document.getElementById('feedback');
  const nextBtn = document.getElementById('nextLevelBtn');

  if (correctCount === nouns.length) {
    feedback.innerHTML = "🎉 བཀྲ་ཤིས་བདེ་ལེགས། All correct! Excellent!";
    feedback.className = "correct";
    if (nextBtn) nextBtn.style.display = "inline-block";
    playCorrectSound();
  } else {
    feedback.textContent = `${correctCount}/${nouns.length} correct. Try again!`;
    feedback.className = "";
    if (nextBtn) nextBtn.style.display = "none";
    playWrongSound();
  }

  draw();
}

function resetGame() {
  nouns.forEach(n => {
    n.placed = null;
    n.status = null;
  });

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
  resetParticles();
  draw();
};

window.onresize = () => {
  resizeCanvas();
  resetParticles();
  draw();
};
