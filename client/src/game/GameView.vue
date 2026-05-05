<template>
  <div class="game-container" ref="gameContainer">
    <div class="controls-info">
      <h3>Controls (2D RPG Style)</h3>
      <p>W: Up | S: Down | A: Left | D: Right</p>
      <p>Q: Up-Left | E: Up-Right | Z: Down-Left | C: Down-Right</p>
      <p>Right-click: Move character to clicked position</p>
      <p>Position will be sent to server every 3 seconds</p>
    </div>
    <div class="status-bar">
      <span>Character: {{ characterName }}</span>
      <span>Position: ({{ Math.round(position.x) }}, {{ Math.round(position.y) }})</span>
      <span>Grid: ({{ gridPosition.x }}, {{ gridPosition.y }})</span>
      <span>Terrain: {{ currentTerrain }}</span>
      <span>Direction: {{ facingDirection }}</span>
      <label class="toggle-switch">
        <input type="checkbox" v-model="showGrid" @change="toggleGrid" />
        <span class="slider"></span>
      </label>
      <span>Show Grid</span>
    </div>
    <div class="background-selector">
      <label>背景场景:</label>
      <select v-model="selectedBackground" @change="changeBackground">
        <option v-for="bg in backgroundStore.backgroundOptions" :key="bg.id" :value="bg.id">
          {{ bg.name }}
        </option>
      </select>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, computed } from 'vue';
import * as THREE from 'three';
import { Character } from './entities/Character.js';
import { TerrainManager } from './maps/TerrainManager.js';
import axios from 'axios';
import { useBackgroundStore } from '../stores/background.js';

const backgroundStore = useBackgroundStore();
const gameContainer = ref(null);
const characterName = ref('Hero1');
const position = ref({ x: 0, y: 0 });
const gridPosition = ref({ x: 0, y: 0 });
const facingDirection = ref('Right');
const lastSyncTime = ref('Never');
const selectedBackground = ref('bg1');
const showGrid = ref(false);

let scene, camera, renderer;
let player;
let animationFrameId;
let lastTime = 0;
let syncTimer = null;
let backgroundTexture = null;
let gridGroup = null;
let terrainManager = null;

let isRightMouseDown = false;
let targetPosition = null;

const keys = {
  w: false,
  a: false,
  s: false,
  d: false,
  q: false,
  e: false,
  z: false,
  c: false
};

const movingSpriteUrls = [
  'src/assets/sprites/1.png',
  'src/assets/sprites/2.png',
  'src/assets/sprites/3.png',
  'src/assets/sprites/4.png',
  'src/assets/sprites/5.png',
  'src/assets/sprites/6.png'
];

const idleSpriteUrls = [
  'src/assets/sprites1/1.png',
  'src/assets/sprites1/2.png',
  'src/assets/sprites1/6.png'
];

const currentTerrain = computed(() => {
  if (!terrainManager) return 'N/A';
  const terrain = terrainManager.getTerrainAtWorld(position.value.x, position.value.y);
  const info = terrainManager.getTerrainInfo(terrain);
  return `${info.name} (${terrain})`;
});

async function loadBackgroundTexture(path) {
  return new Promise((resolve) => {
    const loader = new THREE.TextureLoader();
    loader.load(path, (texture) => {
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.RepeatWrapping;
      texture.repeat.set(1, 1);
      resolve(texture);
    }, undefined, () => {
      console.warn(`Failed to load background: ${path}`);
      resolve(null);
    });
  });
}

function createGridVisualization() {
  if (gridGroup) {
    scene.remove(gridGroup);
  }

  gridGroup = new THREE.Group();
  const gridSize = terrainManager.getGridSize();
  const { width, height } = terrainManager.getMapDimensions();
  const mapCenter = terrainManager.getMapCenter();

  for (let gridY = 0; gridY < height; gridY++) {
    for (let gridX = 0; gridX < width; gridX++) {
      const worldPos = terrainManager.gridToWorld(gridX, gridY);
      
      const terrainValue = terrainManager.getTerrainAtGrid(gridX, gridY);
      const terrainInfo = terrainManager.getTerrainInfo(terrainValue);

      const geometry = new THREE.BoxGeometry(gridSize - 1, gridSize - 1, 1);
      const material = new THREE.MeshBasicMaterial({
        color: terrainInfo.color,
        transparent: true,
        opacity: 0.3
      });
      const tile = new THREE.Mesh(geometry, material);
      tile.position.set(worldPos.x, worldPos.y, -1);
      gridGroup.add(tile);

      const canvas = document.createElement('canvas');
      canvas.width = 64;
      canvas.height = 32;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.fillRect(0, 0, 64, 32);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 14px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(terrainValue.toString(), 32, 16);

      const texture = new THREE.CanvasTexture(canvas);
      const textGeometry = new THREE.PlaneGeometry(gridSize * 0.8, gridSize * 0.4);
      const textMaterial = new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true
      });
      const textMesh = new THREE.Mesh(textGeometry, textMaterial);
      textMesh.position.set(worldPos.x, worldPos.y, 0);
      gridGroup.add(textMesh);
    }
  }

  const lineMaterial = new THREE.LineBasicMaterial({ color: 0x000000, opacity: 0.5, transparent: true });
  
  for (let x = 0; x <= width; x++) {
    const y1 = terrainManager.gridToWorld(0, 0).y - gridSize / 2;
    const y2 = terrainManager.gridToWorld(0, height - 1).y + gridSize / 2;
    const lineGeometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(x * gridSize - mapCenter.x, y1, 0),
      new THREE.Vector3(x * gridSize - mapCenter.x, y2, 0)
    ]);
    const line = new THREE.Line(lineGeometry, lineMaterial);
    gridGroup.add(line);
  }

  for (let gridY = 0; gridY <= height; gridY++) {
    const adjustedY = height - 1 - gridY;
    const worldY = adjustedY * gridSize + gridSize / 2 - mapCenter.y;
    const lineGeometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-mapCenter.x, worldY, 0),
      new THREE.Vector3(mapCenter.x, worldY, 0)
    ]);
    const line = new THREE.Line(lineGeometry, lineMaterial);
    gridGroup.add(line);
  }

  scene.add(gridGroup);
}

function removeGridVisualization() {
  if (gridGroup) {
    scene.remove(gridGroup);
    gridGroup = null;
  }
}

function toggleGrid() {
  if (showGrid.value) {
    createGridVisualization();
  } else {
    removeGridVisualization();
  }
}

async function init() {
  terrainManager = new TerrainManager();
  
  scene = new THREE.Scene();
  
  const bgPath = backgroundStore.getCurrentBackgroundPath();
  if (bgPath) {
    backgroundTexture = await loadBackgroundTexture(bgPath);
    if (backgroundTexture) {
      scene.background = backgroundTexture;
    } else {
      scene.background = new THREE.Color(0x87ceeb);
    }
  } else {
    scene.background = new THREE.Color(0x87ceeb);
  }

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

  if (!backgroundTexture) {
    const gridHelper = new THREE.GridHelper(800, 20, 0x888888, 0x444444);
    gridHelper.rotation.x = Math.PI / 2;
    scene.add(gridHelper);
  }

  const ambientLight = new THREE.AmbientLight(0xffffff, 1);
  scene.add(ambientLight);

  player = new Character(
    characterName.value,
    movingSpriteUrls,
    idleSpriteUrls,
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
  window.addEventListener('contextmenu', handleContextMenu);
  window.addEventListener('mousedown', handleMouseDown);
  window.addEventListener('mouseup', handleMouseUp);
  window.addEventListener('mousemove', handleMouseMove);

  animate(0);
}

function checkPositionValidity(newX, newY) {
  if (!terrainManager) return true;
  
  if (!terrainManager.checkMove(newX, newY, 20)) {
    return false;
  }
  
  const bounds = terrainManager.getMapBounds();
  
  if (newX < bounds.minX || newX > bounds.maxX || newY < bounds.minY || newY > bounds.maxY) {
    return false;
  }
  
  return true;
}

async function changeBackground() {
  const bgPath = backgroundStore.setBackground(selectedBackground.value);
  if (bgPath) {
    backgroundTexture = await loadBackgroundTexture(bgPath);
    if (backgroundTexture) {
      scene.background = backgroundTexture;
    }
  }
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

function handleContextMenu(event) {
  event.preventDefault();
}

function handleMouseDown(event) {
  if (event.button === 2) {
    isRightMouseDown = true;
    updateTargetPosition(event.clientX, event.clientY);
  }
}

function handleMouseUp(event) {
  if (event.button === 2) {
    isRightMouseDown = false;
    targetPosition = null;
  }
}

function handleMouseMove(event) {
  if (isRightMouseDown) {
    updateTargetPosition(event.clientX, event.clientY);
  }
}

function updateTargetPosition(clientX, clientY) {
  const width = window.innerWidth;
  const height = window.innerHeight;
  
  const x = clientX - width / 2;
  const y = -(clientY - height / 2);
  
  if (checkPositionValidity(x, y)) {
    targetPosition = { x, y };
  }
}

function moveToTarget(deltaTime) {
  if (!targetPosition) return false;
  
  const playerPos = player.getPosition();
  const dx = targetPosition.x - playerPos.x;
  const dy = targetPosition.y - playerPos.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  
  if (distance < 5) {
    return false;
  }
  
  const moveAmount = player.moveSpeed * deltaTime;
  const moveX = (dx / distance) * moveAmount;
  const moveY = (dy / distance) * moveAmount;
  
  const newX = player.position.x + moveX;
  const newY = player.position.y + moveY;
  
  if (!checkPositionValidity(newX, newY)) {
    if (!checkPositionValidity(newX, player.position.y)) {
      return false;
    }
    if (!checkPositionValidity(player.position.x, newY)) {
      return false;
    }
  }
  
  player.position.x = newX;
  player.position.y = newY;
  player.mesh.position.copy(player.position);
  
  if (moveX < 0) {
    player.setDirectionLeft();
  } else if (moveX > 0) {
    player.setDirectionRight();
  }
  
  return true;
}

function updateMovement(deltaTime, currentTime) {
  let isMoving = false;

  if (isRightMouseDown && targetPosition) {
    isMoving = moveToTarget(deltaTime);
  }

  if (!isMoving) {
    const oldX = player.position.x;
    const oldY = player.position.y;

    if (keys.w) {
      player.moveForward(deltaTime);
      isMoving = true;
    }
    if (keys.s) {
      player.moveBackward(deltaTime);
      isMoving = true;
    }
    if (keys.a) {
      player.moveLeft(deltaTime);
      isMoving = true;
    }
    if (keys.d) {
      player.moveRight(deltaTime);
      isMoving = true;
    }
    if (keys.q) {
      player.moveUpLeft(deltaTime);
      isMoving = true;
    }
    if (keys.e) {
      player.moveUpRight(deltaTime);
      isMoving = true;
    }
    if (keys.z) {
      player.moveDownLeft(deltaTime);
      isMoving = true;
    }
    if (keys.c) {
      player.moveDownRight(deltaTime);
      isMoving = true;
    }

    if (isMoving && !checkPositionValidity(player.position.x, player.position.y)) {
      player.position.x = oldX;
      player.position.y = oldY;
      player.mesh.position.copy(player.position);
      isMoving = false;
    }
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
  
  if (terrainManager) {
    const grid = terrainManager.worldToGrid(pos.x, pos.y);
    gridPosition.value = { x: grid.x, y: grid.y };
  }
  
  facingDirection.value = player.facingRight ? 'Right' : 'Left';

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
  window.removeEventListener('contextmenu', handleContextMenu);
  window.removeEventListener('mousedown', handleMouseDown);
  window.removeEventListener('mouseup', handleMouseUp);
  window.removeEventListener('mousemove', handleMouseMove);
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
  align-items: center;
  z-index: 100;
  gap: 15px;
  flex-wrap: wrap;
}

.status-bar span {
  font-size: 14px;
}

.toggle-switch {
  position: relative;
  display: inline-block;
  width: 48px;
  height: 24px;
}

.toggle-switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

.toggle-switch .slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: #ccc;
  transition: .3s;
  border-radius: 24px;
}

.toggle-switch .slider:before {
  position: absolute;
  content: "";
  height: 16px;
  width: 16px;
  left: 4px;
  bottom: 4px;
  background-color: white;
  transition: .3s;
  border-radius: 50%;
}

.toggle-switch input:checked + .slider {
  background-color: #2196F3;
}

.toggle-switch input:checked + .slider:before {
  transform: translateX(24px);
}

.background-selector {
  position: absolute;
  top: 10px;
  right: 10px;
  background: rgba(0, 0, 0, 0.7);
  color: white;
  padding: 10px 15px;
  border-radius: 8px;
  font-family: Arial, sans-serif;
  z-index: 100;
  display: flex;
  align-items: center;
  gap: 10px;
}

.background-selector label {
  font-size: 14px;
}

.background-selector select {
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: 4px;
  color: white;
  padding: 5px 10px;
  font-size: 14px;
  cursor: pointer;
}

.background-selector select option {
  background: #333;
  color: white;
}
</style>