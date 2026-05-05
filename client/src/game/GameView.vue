<template>
  <div class="game-container" ref="gameContainer">
    <div class="controls-info">
      <h3>Controls (WASD + Q/E MOBA-style)</h3>
      <p>W: Forward | S: Backward | A: Rotate Left | D: Rotate Right</p>
      <p>Q: Strafe Left | E: Strafe Right</p>
      <p>Position will be sent to server every 3 seconds</p>
    </div>
    <div class="status-bar">
      <span>Character: {{ characterName }}</span>
      <span>Position: ({{ Math.round(position.x) }}, {{ Math.round(position.y) }})</span>
      <span>Direction: {{ Math.round(direction * 180 / Math.PI) }}°</span>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import * as THREE from 'three';
import { Character } from './entities/Character.js';
import axios from 'axios';

const gameContainer = ref(null);
const characterName = ref('Hero1');
const position = ref({ x: 0, y: 0 });
const direction = ref(0);
const lastSyncTime = ref('Never');

let scene, camera, renderer;
let player;
let animationFrameId;
let lastTime = 0;
let syncTimer = null;
let lastRotateTime = 0;
const rotateCooldown = 150;

const keys = {
  w: false,
  a: false,
  s: false,
  d: false,
  q: false,
  e: false
};

const spriteUrls = [
  'src/assets/sprites/1.png',
  'src/assets/sprites/2.png',
  'src/assets/sprites/3.png',
  'src/assets/sprites/4.png',
  'src/assets/sprites/5.png',
  'src/assets/sprites/6.png'
];

async function init() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x87ceeb);

  const width = window.innerWidth;
  const height = window.innerHeight;

  camera = new THREE.OrthographicCamera(
    -width / 2,
    width / 2,
    height / 2,
    -height / 2,
    0.1,
    1000
  );
  camera.position.z = 100;

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(width, height);
  gameContainer.value.appendChild(renderer.domElement);

  const gridHelper = new THREE.GridHelper(800, 20, 0x888888, 0x444444);
  gridHelper.rotation.x = Math.PI / 2;
  scene.add(gridHelper);

  const ambientLight = new THREE.AmbientLight(0xffffff, 1);
  scene.add(ambientLight);

  player = new Character(
    characterName.value,
    spriteUrls,
    {
      x: 0,
      y: 0,
      z: 0,
      moveSpeed: 200
    }
  );

  await player.init();
  scene.add(player.getMesh());

  window.addEventListener('keydown', handleKeyDown);
  window.addEventListener('keyup', handleKeyUp);
  window.addEventListener('resize', handleResize);

  animate(0);
}

function handleKeyDown(event) {
  const key = event.key.toLowerCase();
  if (key in keys) {
    keys[key] = true;
  }
}

function handleKeyUp(event) {
  const key = event.key.toLowerCase();
  if (key in keys) {
    keys[key] = false;
  }
}

function handleResize() {
  const width = window.innerWidth;
  const height = window.innerHeight;

  camera.left = -width / 2;
  camera.right = width / 2;
  camera.top = height / 2;
  camera.bottom = -height / 2;
  camera.updateProjectionMatrix();

  renderer.setSize(width, height);
}

function updateMovement(deltaTime, currentTime) {
  let isMoving = false;

  if (keys.w) {
    player.moveForward(deltaTime);
    isMoving = true;
  }
  if (keys.s) {
    player.moveBackward(deltaTime);
    isMoving = true;
  }
  if (keys.q) {
    player.strafeLeft(deltaTime);
    isMoving = true;
  }
  if (keys.e) {
    player.strafeRight(deltaTime);
    isMoving = true;
  }

  if (keys.a && currentTime - lastRotateTime > rotateCooldown) {
    player.rotateLeft();
    lastRotateTime = currentTime;
  }
  if (keys.d && currentTime - lastRotateTime > rotateCooldown) {
    player.rotateRight();
    lastRotateTime = currentTime;
  }

  player.setMoving(isMoving);
}

function animate(currentTime) {
  animationFrameId = requestAnimationFrame(animate);

  const deltaTime = (currentTime - lastTime) / 1000;
  lastTime = currentTime;

  if (deltaTime > 0 && deltaTime < 1) {
    updateMovement(deltaTime, currentTime);
    player.updateAnimation(currentTime);
  }

  const pos = player.getPosition();
  position.value = { x: pos.x, y: pos.y };
  direction.value = player.facingAngle;

  renderer.render(scene, camera);
}

async function syncPositionToServer() {
  try {
    const pos = player.getPosition();
    await axios.put(`http://localhost:3000/api/characters/1/position`, {
      x: pos.x,
      y: pos.y
    });
    lastSyncTime.value = new Date().toLocaleTimeString();
    console.log('Position synced:', pos);
  } catch (error) {
    console.error('Failed to sync position:', error);
  }
}

function startPositionSync() {
  syncTimer = setInterval(syncPositionToServer, 3000);
}

onMounted(() => {
  init();
  startPositionSync();
});

onUnmounted(() => {
  cancelAnimationFrame(animationFrameId);
  if (syncTimer) {
    clearInterval(syncTimer);
  }
  window.removeEventListener('keydown', handleKeyDown);
  window.removeEventListener('keyup', handleKeyUp);
  window.removeEventListener('resize', handleResize);
});
</script>

<style scoped>
.game-container {
  width: 100vw;
  height: 100vh;
  position: relative;
}

.controls-info {
  position: absolute;
  top: 10px;
  left: 10px;
  background: rgba(0, 0, 0, 0.7);
  color: white;
  padding: 15px;
  border-radius: 8px;
  font-family: Arial, sans-serif;
  z-index: 100;
}

.controls-info h3 {
  margin-bottom: 8px;
  font-size: 14px;
}

.controls-info p {
  margin: 4px 0;
  font-size: 12px;
}

.status-bar {
  position: absolute;
  bottom: 10px;
  left: 10px;
  right: 10px;
  background: rgba(0, 0, 0, 0.7);
  color: white;
  padding: 10px 15px;
  border-radius: 8px;
  font-family: Arial, sans-serif;
  display: flex;
  justify-content: space-between;
  z-index: 100;
}
</style>
