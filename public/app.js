//Initialize and connect socket
let socket = io();

//Listen for confirmation of connection
socket.on('connect', () => {
  console.log("Connected");
});

// p5.js
const FRAME_RATE = 30;
const PIXEL_SIZE_SMALL = 2;
const PIXEL_SIZE_LARGE_MIN = 8;
const PIXEL_SIZE_LARGE_MAX = 16;
const NOISE_REDUCTION_FACTOR_SMALL = 180;
const NOISE_REDUCTION_FACTOR_LARGE = 190;
const PIXEL_CHANGE_CHANCE_SMALL = 0.02;
const PIXEL_CHANGE_CHANCE_LARGE = 0.01;
// rgb for small pixels
const MAX_PIXEL_R = 255;
const MAX_PIXEL_G = 255;
const MAX_PIXEL_B = 255;
const MAX_PIXEL_OPACITY_SMALL = 255;
const MAX_PIXEL_OPACITY_LARGE = 255;
// sets min opacity for pixels
const MIN_PIXEL_OPACITY_SMALL = 16;
const MIN_PIXEL_OPACITY_LARGE = 64;
const MIN_PIXEL_GREY_LARGE = 255;
const BLUEBERRY = "🫐";
const CURSOR_EMOJIS = ["❤️", "🧡", "💛", "💚", "💙", "🩵", "💜", "🤎", "🖤", "🩶", "🤍", "🩷"];
const myCursorEmoji = CURSOR_EMOJIS[Math.floor(Math.random() * CURSOR_EMOJIS.length)];

// large on bottom
// size is the grid cell (and biggest pixel); each pixel picks a random size from minSize to size
const staticLayers = [
  { size: PIXEL_SIZE_LARGE_MAX, minSize: PIXEL_SIZE_LARGE_MIN, noiseReduction: NOISE_REDUCTION_FACTOR_LARGE, minOpacity: MIN_PIXEL_OPACITY_LARGE, maxOpacity: MAX_PIXEL_OPACITY_LARGE, changeChance: PIXEL_CHANGE_CHANCE_LARGE, greyscale: true, minGrey: MIN_PIXEL_GREY_LARGE },
  { size: PIXEL_SIZE_SMALL, minSize: PIXEL_SIZE_SMALL, noiseReduction: NOISE_REDUCTION_FACTOR_SMALL, minOpacity: MIN_PIXEL_OPACITY_SMALL, maxOpacity: MAX_PIXEL_OPACITY_SMALL, changeChance: PIXEL_CHANGE_CHANCE_SMALL, greyscale: false }
];

// Separate layer so dots persist while the static redraws every frame
let dotsLayer;

function setup(){
  const cnv = createCanvas(windowWidth, windowHeight);
  cnv.style('display', 'block');
  frameRate(FRAME_RATE);
  noSmooth();
  dotsLayer = createGraphics(windowWidth, windowHeight);
  initStaticLayers();
}

function draw() {
  clear();
  for (const layer of staticLayers) {
    updateStaticLayer(layer);
    image(layer.buffer, 0, 0, width, height);
  }
  image(dotsLayer, 0, 0);
}

// Only redraw pixels that change in the given frame step
function updateStaticLayer(layer) {
  const expectedChanges = layer.changeChance * layer.cols * layer.rows;
  let numChanges = floor(expectedChanges);
  if (random(0, 1) < expectedChanges - numChanges) numChanges++;
  for (let n = 0; n < numChanges; n++) {
    drawStaticPixel(layer, floor(random(layer.cols)), floor(random(layer.rows)));
  }
}

function drawStaticPixel(layer, col, row) {
  const buffer = layer.buffer;
  const i = col * layer.size;
  const j = row * layer.size;
  buffer.erase();
  buffer.rect(i, j, layer.size, layer.size);
  buffer.noErase();
  const currPixel = randomShade(i, j, layer);
  if (currPixel.a > 0) {
    const pixelSize = floor(random(layer.minSize, layer.size + 1));
    const offsetX = floor(random(0, layer.size - pixelSize + 1));
    const offsetY = floor(random(0, layer.size - pixelSize + 1));
    buffer.fill(currPixel.r, currPixel.g, currPixel.b, currPixel.a);
    buffer.rect(i + offsetX, j + offsetY, pixelSize, pixelSize);
  }
}

function randomShade(i, j, layer) {
  const currFactor = random(0, 1);
  const currShade = 255 * noise(currFactor * i, currFactor * j) + layer.noiseReduction;
  const a = currShade > 255 ? 0 : map(currShade, layer.noiseReduction, 255, layer.maxOpacity, layer.minOpacity);
  if (layer.greyscale) {
    const grey = random(layer.minGrey, 255);
    return { r: grey, g: grey, b: grey, a: a };
  }
  return {
    r: random(0, MAX_PIXEL_R),
    g: random(0, MAX_PIXEL_G),
    b: random(0, MAX_PIXEL_B),
    a: a
  };
}

function initStaticLayers() {
  for (const layer of staticLayers) {
    if (layer.buffer) layer.buffer.remove();
    layer.buffer = createGraphics(width, height);
    layer.buffer.pixelDensity(1);
    layer.buffer.noStroke();
    layer.cols = ceil(width / layer.size);
    layer.rows = ceil(height / layer.size);
    for (let col = 0; col < layer.cols; col++) {
      for (let row = 0; row < layer.rows; row++) {
        drawStaticPixel(layer, col, row);
      }
    }
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  initStaticLayers();
  const oldLayer = dotsLayer;
  dotsLayer = createGraphics(windowWidth, windowHeight);
  dotsLayer.image(oldLayer, 0, 0);
  oldLayer.remove();
}

// Blueberries animation and weight updating
const DRAG_THRESHOLD = 5;
const PICK_DROP_DISTANCE = 24;

const bucketWrap = document.getElementById('bucket-wrap');
const weightDisplay = document.getElementById('pounds-picked-number');

// Spawns a berry above the bucket
function addBlueberry(data) {
  const berry = document.createElement('span');
  berry.className = 'blueberry';
  berry.textContent = BLUEBERRY;
  berry.setAttribute('aria-hidden', 'true');
  berry.dataset.id = data.id;
  berry.style.left = (data.x * 100) + '%';
  berry.style.top = (data.y * 100) + '%';
  makeDraggable(berry);
  bucketWrap.appendChild(berry);
}

function showWeight(weight) {
  weightDisplay.textContent = weight.toFixed(3); // 3 decimal places
}

function makeDraggable(berry) {
  let startX, startY;
  let dx = 0, dy = 0;
  let dragged = false;

  berry.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    berry.setPointerCapture(e.pointerId);
    startX = e.clientX;
    startY = e.clientY;
    dragged = false;
    berry.classList.add('dragging');
  });

  berry.addEventListener('pointermove', (e) => {
    if (!berry.hasPointerCapture(e.pointerId)) return;
    dx = e.clientX - startX;
    dy = e.clientY - startY;
    if (Math.hypot(dx, dy) > DRAG_THRESHOLD) dragged = true;
    berry.style.transform = `translate(calc(-50% + ${dx}px), calc(-100% + ${dy}px))`;
  });

  berry.addEventListener('pointerup', () => {
    if (dragged) {
      // Drop a little further down from where it was let go, fade out, then remove
      berry.classList.remove('dragging');
      berry.classList.add('picked');
      berry.style.transform = `translate(calc(-50% + ${dx}px), calc(-100% + ${dy + PICK_DROP_DISTANCE}px))`;
      berry.style.opacity = '0';
      berry.addEventListener('transitionend', () => berry.remove(), { once: true });
      socket.emit('pick', berry.dataset.id); // tell the server!
      playSnap();
    } else {
      resetBerry(berry);
    }
  });

  berry.addEventListener('pointercancel', () => resetBerry(berry));
}

// Snap a berry back to where it was if drag was not long enough
function resetBerry(berry) {
  berry.classList.remove('dragging');
  berry.style.transform = '';
}

// listen for berry messages

socket.on('init', (data) => {
  // start berries fresh
  bucketWrap.querySelectorAll('.blueberry').forEach((b) => b.remove());
  // After a reconnect, also reset hearts
  Object.values(otherCursors).forEach((heart) => heart.remove());
  Object.keys(otherCursors).forEach((id) => delete otherCursors[id]);
  data.berries.forEach(addBlueberry);
  showWeight(data.weight);
});

socket.on('picked', (data) => {
  const old = bucketWrap.querySelector(`[data-id="${data.pickedId}"]`);
  // Your own pick is already fading out; someone else's pick gets removed here
  if (old && !old.classList.contains('picked')) old.remove();
  addBlueberry(data.newBerry);
  showWeight(data.weight);
});

// Cursors
// Send at most every 50ms; pointermove can fire 100+ times a second
const CURSOR_SEND_INTERVAL = 50;
let lastCursorSend = 0;
const bucketImg = document.getElementById('bucket');

// Fires while hovering, holding the button down, and dragging (even while a berry has captured the pointer)
window.addEventListener('pointermove', (e) => {
  const now = Date.now();
  if (now - lastCursorSend < CURSOR_SEND_INTERVAL) return;
  lastCursorSend = now;

  // Position as a fraction of the bucket image, like the berries, so it lines up on every screen size
  const rect = bucketImg.getBoundingClientRect();
  socket.emit('cursor', {
    x: (e.clientX - rect.left) / rect.width,
    y: (e.clientY - rect.top) / rect.height,
    emoji: myCursorEmoji
  });
});

const otherCursors = {};

socket.on('cursor', (data) => {
  let heart = otherCursors[data.id];
  if (!heart) {
    heart = document.createElement('div');
    heart.className = 'cursor';
    heart.textContent = data.emoji;
    heart.setAttribute('aria-hidden', 'true');
    document.body.appendChild(heart);
    otherCursors[data.id] = heart;
  }
  const rect = bucketImg.getBoundingClientRect();
  heart.style.left = (rect.left + data.x * rect.width) + 'px';
  heart.style.top = (rect.top + data.y * rect.height) + 'px';
});

socket.on('cursor-leave', (id) => {
  if (otherCursors[id]) {
    otherCursors[id].remove();
    delete otherCursors[id];
  }
});

// Sound
const SNAP_VOLUME = 2;
const MUSIC_VOLUME = 0.2;

// for iOS/Safari
if (navigator.audioSession) navigator.audioSession.type = 'playback';
// Web Audio
const audioContext = new (window.AudioContext || window.webkitAudioContext)();
const snapGain = audioContext.createGain();
snapGain.gain.value = SNAP_VOLUME;
snapGain.connect(audioContext.destination);

let snapBuffer;
fetch('snap.mp3')
  .then((res) => res.arrayBuffer())
  .then((data) => audioContext.decodeAudioData(data))
  .then((buffer) => { snapBuffer = buffer; })
  .catch((err) => console.log("Couldn't load snap:", err));

function playSnap() {
  if (!snapBuffer) return;
  audioContext.resume();
  const source = audioContext.createBufferSource();
  source.buffer = snapBuffer;
  source.connect(snapGain);
  source.start();
}

let music = new Audio('music.mp3');
music.loop = true;
const musicGain = audioContext.createGain();
musicGain.gain.value = MUSIC_VOLUME;
audioContext.createMediaElementSource(music).connect(musicGain);
musicGain.connect(audioContext.destination);
let soundOn = false;

document.getElementById('sound').addEventListener('click', (e) => {
  soundOn = !soundOn;
  if (soundOn) {
    audioContext.resume();
    music.play().catch((err) => console.log("Couldn't play music:", err));
  } else {
    music.pause();
  }
  e.target.innerText = soundOn ? "turn sound off" : "turn sound on";
});
