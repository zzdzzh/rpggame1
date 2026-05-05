<template>
  <div class="game-container" ref="gameContainer">
    <div class="controls-info">
      <h3>Controls (2D RPG Style)</h3>
      <p>W: Up | S: Down | A: Left | D: Right</p>
      <p>Q: Up-Left | E: Up-Right | Z: Down-Left | C: Down-Right</p>
      <p>Right-click: Move character to clicked position</p>
      <p>Position will be sent to server every 3 seconds</p>
      <p class="combat-tip">靠近怪物自动进入战斗！</p>
    </div>
    <div class="status-bar">
      <span>Character: {{ characterName }}</span>
      <span>Position: ({{ Math.round(position.x) }}, {{ Math.round(position.y) }})</span>
      <span>Grid: ({{ gridPosition.x }}, {{ gridPosition.y }})</span>
      <span>Terrain: {{ currentTerrain }}</span>
      <span>Direction: {{ facingDirection }}</span>
      <span class="combat-status" :class="{ 'in-combat': isInCombat }">
        {{ isInCombat ? '⚔️ 战斗中' : '和平' }}
      </span>
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
    <div class="combat-log" v-if="combatLog.length > 0">
      <div class="combat-log-title">战斗日志</div>
      <div class="combat-log-content">
        <div v-for="(log, index) in combatLog.slice(-5)" :key="index" class="log-entry" :class="{ critical: log.isCritical }">
          {{ log.message }}
        </div>
      </div>
    </div>
    <div class="game-over" v-if="gameOver">
      <div class="game-over-content">
        <h2>{{ gameOverWin ? '🎉 胜利！' : '💀 失败！' }}</h2>
        <p>{{ gameOverWin ? '你击败了怪物！' : '你被怪物击败了！' }}</p>
        <button @click="restartGame">重新开始</button>
      </div>
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
const isInCombat = ref(false);
const combatLog = ref([]);
const gameOver = ref(false);
const gameOverWin = ref(false);

let scene, camera, renderer;
let player;
let monsters = [];
let animationFrameId;
let lastTime = 0;
let syncTimer = null;
let backgroundTexture = null;
let gridGroup = null;
let terrainManager = null;

let isRightMouseDown = false;
let targetPosition = null;

const COMBAT_RANGE = 100;
const HEALTH_BAR_WIDTH = 80;
const HEALTH_BAR_HEIGHT = 8;
const HEALTH_BAR_OFFSET = 45;

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

const monster1MovingUrls = [
  'src/assets/monsters/monster1/1.png',
  'src/assets/monsters/monster1/2.png',
  'src/assets/monsters/monster1/3.png',
  'src/assets/monsters/monster1/4.png',
  'src/assets/monsters/monster1/5.png',
  'src/assets/monsters/monster1/6.png'
];

const monster1IdleUrls = [
  'src/assets/monsters/monster1/1.png',
  'src/assets/monsters/monster1/2.png',
  'src/assets/monsters/monster1/3.png'
];

const currentTerrain = computed(() => {
  if (!terrainManager) return 'N/A';
  const terrain = terrainManager.getTerrainAtWorld(position.value.x, position.value.y);
  const info = terrainManager.getTerrainInfo(terrain);
  return `${info.name} (${terrain})`;
});

function createHealthBar(character) {
  const canvas = document.createElement('canvas');
  canvas.width = HEALTH_BAR_WIDTH;
  canvas.height = HEALTH_BAR_HEIGHT + 4;
  
  const texture = new THREE.CanvasTexture(canvas);
  const geometry = new THREE.PlaneGeometry(HEALTH_BAR_WIDTH, HEALTH_BAR_HEIGHT + 4);
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true
  });
  
  const healthBar = new THREE.Mesh(geometry, material);
  healthBar.position.set(0, HEALTH_BAR_OFFSET, 2);
  healthBar.renderOrder = 10;
  
  character.healthBar = healthBar;
  character.healthBarCanvas = canvas;
  character.healthBarTexture = texture;
  
  if (character.mesh) {
    character.mesh.add(healthBar);
  }
}

function updateHealthBar(character) {
  if (!character.healthBarCanvas) return;
  
  const ctx = character.healthBarCanvas.getContext('2d');
  const healthPercent = character.getHealthPercent();
  
  ctx.clearRect(0, 0, HEALTH_BAR_WIDTH, HEALTH_BAR_HEIGHT + 4);
  
  ctx.fillStyle = '#333';
  ctx.fillRect(0, 2, HEALTH_BAR_WIDTH, HEALTH_BAR_HEIGHT);
  
  const healthColor = healthPercent > 50 ? '#00ff00' : healthPercent > 25 ? '#ffff00' : '#ff0000';
  ctx.fillStyle = healthColor;
  ctx.fillRect(2, 4, (HEALTH_BAR_WIDTH - 4) * (healthPercent / 100), HEALTH_BAR_HEIGHT - 4);
  
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 1;
  ctx.strokeRect(0, 2, HEALTH_BAR_WIDTH, HEALTH_BAR_HEIGHT);
  
  character.healthBarTexture.needsUpdate = true;
}

async function spawnMonster(monsterType) {
  if (!terrainManager) return;
  
  const { width, height } = terrainManager.getMapDimensions();
  
  let validPositions = [];
  for (let gridY = 0; gridY < height; gridY++) {
    for (let gridX = 0; gridX < width; gridX++) {
      const terrainValue = terrainManager.getTerrainAtGrid(gridX, gridY);
      if (terrainValue !== TerrainManager.TERRAIN_TYPES?.BLOCKED) {
        const worldPos = terrainManager.gridToWorld(gridX, gridY);
        const playerPos = player.getPosition();
        const distance = Math.sqrt(
          Math.pow(worldPos.x - playerPos.x, 2) + 
          Math.pow(worldPos.y - playerPos.y, 2)
        );
        if (distance > 200) {
          validPositions.push({ gridX, gridY });
        }
      }
    }
  }
  
  if (validPositions.length === 0) return;
  
  const randomIndex = Math.floor(Math.random() * validPositions.length);
  const { gridX, gridY } = validPositions[randomIndex];
  
  let movingUrls, idleUrls;
  if (monsterType === 1) {
    movingUrls = monster1MovingUrls;
    idleUrls = monster1IdleUrls;
  } else {
    movingUrls = monster1MovingUrls;
    idleUrls = monster1IdleUrls;
  }
  
  const worldPos = terrainManager.gridToWorld(gridX, gridY);
  
  const monster = new Character(
    `Monster${monsterType}`,
    movingUrls,
    idleUrls,
    {
      x: worldPos.x,
      y: worldPos.y,
      z: 0,
      moveSpeed: 50,
      hp: 50,
      maxHp: 50,
      attack: 8,
      defense: 2,
      criticalRate: 0.15,
      criticalMultiplier: 2.0,
      attackCooldown: 1500
    }
  );
  
  await monster.init();
  createHealthBar(monster);
  monsters.push(monster);
  scene.add(monster.getMesh());
}

function addCombatLog(message, isCritical = false) {
  combatLog.value.push({ message, isCritical, time: Date.now() });
  if (combatLog.value.length > 20) {
    combatLog.value.shift();
  }
}

async function fetchBackgroundDimensions(filename) {
  try {
    const response = await axios.get(`http://localhost:3000/api/backgrounds/${filename}/dimensions`);
    return response.data;
  } catch (error) {
    console.error('Failed to fetch background dimensions:', error);
    return null;
  }
}

async function loadBackgroundTexture(path) {
  return new Promise(async (resolve) => {
    const filename = path.split('/').pop();
    const serverDimensions = await fetchBackgroundDimensions(filename);
    
    const img = new Image();
    img.onload = () => {
      const loader = new THREE.TextureLoader();
      loader.load(path, (texture) => {
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(1, 1);
        
        if (serverDimensions) {
          texture.imageWidth = serverDimensions.width;
          texture.imageHeight = serverDimensions.height;
          console.log(`Background ${filename} dimensions from server: ${serverDimensions.width}x${serverDimensions.height}`);
        } else {
          texture.imageWidth = img.width;
          texture.imageHeight = img.height;
          console.log(`Background ${filename} dimensions from image: ${img.width}x${img.height}`);
        }
        
        resolve(texture);
      }, undefined, () => {
        console.warn(`Failed to load background: ${path}`);
        resolve(null);
      });
    };
    img.onerror = () => {
      console.warn(`Failed to load background image: ${path}`);
      resolve(null);
    };
    img.src = path;
  });
}

function getVisibleAreaSize() {
  if (camera) {
    return {
      width: camera.right - camera.left,
      height: camera.top - camera.bottom
    };
  }

  return {
    width: window.innerWidth,
    height: window.innerHeight
  };
}

function getGridDisplayConfig() {
  const { width: mapGridWidth, height: mapGridHeight } = terrainManager.getMapDimensions();
  const visibleArea = getVisibleAreaSize();

  if (!backgroundTexture || !backgroundTexture.imageWidth || !backgroundTexture.imageHeight) {
    return {
      cellWidth: visibleArea.width / mapGridWidth,
      cellHeight: visibleArea.height / mapGridHeight
    };
  }

  // 先使用背景图分辨率计算单格像素，再根据可视区域缩放到实际显示大小
  const bgWidth = backgroundTexture.imageWidth;
  const bgHeight = backgroundTexture.imageHeight;
  const scaleX = visibleArea.width / bgWidth;
  const scaleY = visibleArea.height / bgHeight;

  return {
    cellWidth: (bgWidth / mapGridWidth) * scaleX,
    cellHeight: (bgHeight / mapGridHeight) * scaleY
  };
}

function createGridVisualization() {
  if (gridGroup) {
    scene.remove(gridGroup);
  }

  gridGroup = new THREE.Group();
  const { cellWidth, cellHeight } = getGridDisplayConfig();
  const textBaseSize = Math.min(cellWidth, cellHeight);
  const { width, height } = terrainManager.getMapDimensions();
  const mapCenterX = (width * cellWidth) / 2;
  const mapCenterY = (height * cellHeight) / 2;

  for (let gridY = 0; gridY < height; gridY++) {
    for (let gridX = 0; gridX < width; gridX++) {
      const adjustedY = height - 1 - gridY;
      const worldX = gridX * cellWidth + cellWidth / 2 - mapCenterX;
      const worldY = adjustedY * cellHeight + cellHeight / 2 - mapCenterY;
      
      const terrainValue = terrainManager.getTerrainAtGrid(gridX, gridY);
      const terrainInfo = terrainManager.getTerrainInfo(terrainValue);

      const geometry = new THREE.BoxGeometry(Math.max(1, cellWidth - 1), Math.max(1, cellHeight - 1), 1);
      const material = new THREE.MeshBasicMaterial({
        color: terrainInfo.color,
        transparent: true,
        opacity: 0.15
      });
      const tile = new THREE.Mesh(geometry, material);
      tile.position.set(worldX, worldY, -1);
      gridGroup.add(tile);

      const canvas = document.createElement('canvas');
      canvas.width = Math.max(32, textBaseSize * 0.8);
      canvas.height = Math.max(16, textBaseSize * 0.4);
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#ffffff';
      ctx.font = `bold ${Math.max(10, textBaseSize * 0.25)}px Arial`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(terrainValue.toString(), canvas.width / 2, canvas.height / 2);

      const texture = new THREE.CanvasTexture(canvas);
      const textGeometry = new THREE.PlaneGeometry(textBaseSize * 0.8, textBaseSize * 0.4);
      const textMaterial = new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true
      });
      const textMesh = new THREE.Mesh(textGeometry, textMaterial);
      textMesh.position.set(worldX, worldY, 0);
      gridGroup.add(textMesh);
    }
  }

  const lineMaterial = new THREE.LineBasicMaterial({ color: 0x000000, opacity: 0.5, transparent: true });
  
  for (let x = 0; x <= width; x++) {
    const lineWorldX = x * cellWidth - mapCenterX;
    const startWorldY = (height - 1) * cellHeight + cellHeight / 2 - mapCenterY;
    const endWorldY = cellHeight / 2 - mapCenterY;
    
    const lineGeometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(lineWorldX, startWorldY, 0),
      new THREE.Vector3(lineWorldX, endWorldY, 0)
    ]);
    const line = new THREE.Line(lineGeometry, lineMaterial);
    gridGroup.add(line);
  }

  for (let y = 0; y <= height; y++) {
    const adjustedY = height - 1 - y;
    const startWorldX = cellWidth / 2 - mapCenterX;
    const lineWorldY = adjustedY * cellHeight + cellHeight / 2 - mapCenterY;
    const endWorldX = width * cellWidth - cellWidth / 2 - mapCenterX;
    
    const lineGeometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(startWorldX, lineWorldY, 0),
      new THREE.Vector3(endWorldX, lineWorldY, 0)
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
      adjustTerrainToBackground();
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
      moveSpeed: 200,
      hp: 200,
      maxHp: 200,
      attack: 12,
      defense: 8,
      criticalRate: 0.15,
      criticalMultiplier: 2.0,
      attackCooldown: 1000
    }
  );

  await player.init();
  createHealthBar(player);
  scene.add(player.getMesh());

  await spawnMonster(1);

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
      adjustTerrainToBackground();
      if (showGrid.value) {
        removeGridVisualization();
        createGridVisualization();
      }
    }
  }
}

function adjustTerrainToBackground() {
  const { cellWidth, cellHeight } = getGridDisplayConfig();
  terrainManager.setGridSize({ width: cellWidth, height: cellHeight });
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

  if (terrainManager) {
    adjustTerrainToBackground();
  }
  if (showGrid.value) {
    removeGridVisualization();
    createGridVisualization();
  }
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
  
  targetPosition = { x, y };
}

function findSlidingPosition(fromX, fromY, toX, toY) {
  const dx = toX - fromX;
  const dy = toY - fromY;
  const distance = Math.sqrt(dx * dx + dy * dy);
  
  if (distance < 1) {
    return { x: fromX, y: fromY, reached: true };
  }
  
  const steps = Math.ceil(distance / 5);
  const stepX = dx / steps;
  const stepY = dy / steps;
  
  let lastValidX = fromX;
  let lastValidY = fromY;
  
  for (let i = 1; i <= steps; i++) {
    const checkX = fromX + stepX * i;
    const checkY = fromY + stepY * i;
    
    if (checkPositionValidity(checkX, checkY)) {
      lastValidX = checkX;
      lastValidY = checkY;
    } else {
      if (lastValidX === fromX && lastValidY === fromY) {
        const slideX = trySlide(fromX, fromY, dx, dy);
        if (slideX) {
          return slideX;
        }
      }
      return { x: lastValidX, y: lastValidY, reached: false };
    }
  }
  
  return { x: lastValidX, y: lastValidY, reached: true };
}

function trySlide(fromX, fromY, dx, dy) {
  const absDx = Math.abs(dx);
  const absDy = Math.abs(dy);
  
  const slideXOnly = absDx > 0 && checkPositionValidity(fromX + Math.sign(dx) * absDx, fromY);
  const slideYOnly = absDy > 0 && checkPositionValidity(fromX, fromY + Math.sign(dy) * absDy);
  
  if (slideXOnly && slideYOnly) {
    if (absDx >= absDy) {
      return { x: fromX + Math.sign(dx) * absDx, y: fromY, reached: false };
    } else {
      return { x: fromX, y: fromY + Math.sign(dy) * absDy, reached: false };
    }
  } else if (slideXOnly) {
    return { x: fromX + Math.sign(dx) * absDx, y: fromY, reached: false };
  } else if (slideYOnly) {
    return { x: fromX, y: fromY + Math.sign(dy) * absDy, reached: false };
  }
  
  return null;
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
  const ratio = Math.min(1, moveAmount / distance);
  const targetX = playerPos.x + dx * ratio;
  const targetY = playerPos.y + dy * ratio;
  
  const result = findSlidingPosition(playerPos.x, playerPos.y, targetX, targetY);
  
  const movedDist = Math.sqrt(Math.pow(result.x - playerPos.x, 2) + Math.pow(result.y - playerPos.y, 2));
  if (movedDist < 1) {
    return false;
  }
  
  player.position.x = result.x;
  player.position.y = result.y;
  player.mesh.position.copy(player.position);
  
  if (dx < 0) {
    player.setDirectionLeft();
  } else if (dx > 0) {
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
    let moveX = 0;
    let moveY = 0;
    
    if (keys.w) moveY += 1;
    if (keys.s) moveY -= 1;
    if (keys.a) moveX -= 1;
    if (keys.d) moveX += 1;
    if (keys.q) { moveX -= 0.707; moveY += 0.707; }
    if (keys.e) { moveX += 0.707; moveY += 0.707; }
    if (keys.z) { moveX -= 0.707; moveY -= 0.707; }
    if (keys.c) { moveX += 0.707; moveY -= 0.707; }

    if (moveX !== 0 || moveY !== 0) {
      const length = Math.sqrt(moveX * moveX + moveY * moveY);
      moveX /= length;
      moveY /= length;
      
      const moveAmount = player.moveSpeed * deltaTime;
      const targetX = player.position.x + moveX * moveAmount;
      const targetY = player.position.y + moveY * moveAmount;
      
      const result = findSlidingPosition(player.position.x, player.position.y, targetX, targetY);
      
      const movedDist = Math.sqrt(Math.pow(result.x - player.position.x, 2) + Math.pow(result.y - player.position.y, 2));
      if (movedDist >= 1) {
        player.position.x = result.x;
        player.position.y = result.y;
        player.mesh.position.copy(player.position);
        isMoving = true;
      }
      
      if (moveX < 0) {
        player.setDirectionLeft();
      } else if (moveX > 0) {
        player.setDirectionRight();
      }
    }
  }

  player.setMoving(isMoving);
}

function checkCombatRange() {
  const playerPos = player.getPosition();
  
  for (const monster of monsters) {
    if (!monster.isAlive) continue;
    
    const monsterPos = monster.getPosition();
    const distance = Math.sqrt(
      Math.pow(playerPos.x - monsterPos.x, 2) +
      Math.pow(playerPos.y - monsterPos.y, 2)
    );
    
    if (distance <= COMBAT_RANGE) {
      return monster;
    }
  }
  
  return null;
}

function handleCombat(currentTime) {
  const nearbyMonster = checkCombatRange();
  
  if (nearbyMonster && player.isAlive && nearbyMonster.isAlive) {
    isInCombat.value = true;
    player.setInCombat(true);
    nearbyMonster.setInCombat(true);
    
    if (player.position.x < nearbyMonster.position.x) {
      player.setDirectionRight();
    } else {
      player.setDirectionLeft();
    }
    
    const playerAttack = player.attackTarget(nearbyMonster, currentTime);
    if (playerAttack.hit) {
      const critText = playerAttack.isCritical ? '暴击！' : '';
      addCombatLog(`${characterName.value} 攻击 ${nearbyMonster.name}，造成 ${playerAttack.damage} 点伤害${critText}`, playerAttack.isCritical);
      
      if (!nearbyMonster.isAlive) {
        addCombatLog(`🎉 ${nearbyMonster.name} 被击败了！`, false);
        scene.remove(nearbyMonster.getMesh());
        monsters = monsters.filter(m => m !== nearbyMonster);
        
        if (monsters.length === 0) {
          gameOver.value = true;
          gameOverWin.value = true;
        }
        
        isInCombat.value = false;
        player.setInCombat(false);
      }
    }
    
    const monsterAttack = nearbyMonster.attackTarget(player, currentTime);
    if (monsterAttack.hit && nearbyMonster.isAlive) {
      const critText = monsterAttack.isCritical ? '暴击！' : '';
      addCombatLog(`${nearbyMonster.name} 攻击 ${characterName.value}，造成 ${monsterAttack.damage} 点伤害${critText}`, monsterAttack.isCritical);
      
      if (!player.isAlive) {
        addCombatLog(`💀 ${characterName.value} 被击败了！`, false);
        gameOver.value = true;
        gameOverWin.value = false;
      }
    }
  } else {
    isInCombat.value = false;
    player.setInCombat(false);
    monsters.forEach(m => m.setInCombat(false));
  }
}

function animate(currentTime) {
  animationFrameId = requestAnimationFrame(animate);

  const deltaTime = (currentTime - lastTime) / 1000;
  lastTime = currentTime;

  if (!gameOver.value) {
    if (deltaTime > 0 && deltaTime < 1) {
      updateMovement(deltaTime, currentTime);
      player.updateAnimation(currentTime);
      monsters.forEach(monster => {
        monster.updateAnimation(currentTime);
      });
    }
    
    handleCombat(currentTime);
    
    updateHealthBar(player);
    monsters.forEach(updateHealthBar);
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

function restartGame() {
  gameOver.value = false;
  gameOverWin.value = false;
  combatLog.value = [];
  
  player.hp = player.maxHp;
  player.isAlive = true;
  player.setPosition(0, 0, 0);
  
  monsters.forEach(monster => {
    scene.remove(monster.getMesh());
  });
  monsters = [];
  
  spawnMonster(1);
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

.controls-info .combat-tip {
  color: #ff6b6b;
  font-weight: bold;
  margin-top: 8px;
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

.combat-status {
  padding: 4px 10px;
  border-radius: 4px;
  background: rgba(50, 50, 50, 0.8);
}

.combat-status.in-combat {
  background: rgba(255, 107, 107, 0.8);
  animation: pulse 1s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
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

.combat-log {
  position: absolute;
  top: 120px;
  right: 10px;
  background: rgba(0, 0, 0, 0.8);
  border-radius: 8px;
  padding: 10px;
  width: 280px;
  max-height: 200px;
  overflow-y: auto;
  z-index: 100;
}

.combat-log-title {
  color: #ff6b6b;
  font-weight: bold;
  font-size: 14px;
  margin-bottom: 8px;
  padding-bottom: 5px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.2);
}

.combat-log-content {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.log-entry {
  color: #ddd;
  font-size: 12px;
  padding: 4px;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.05);
}

.log-entry.critical {
  color: #ffd700;
  background: rgba(255, 215, 0, 0.1);
}

.game-over {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.85);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.game-over-content {
  text-align: center;
  color: white;
  padding: 40px;
  background: rgba(30, 30, 30, 0.95);
  border-radius: 16px;
  border: 2px solid rgba(255, 107, 107, 0.5);
}

.game-over-content h2 {
  font-size: 36px;
  margin-bottom: 16px;
}

.game-over-content p {
  font-size: 18px;
  margin-bottom: 24px;
}

.game-over-content button {
  padding: 12px 32px;
  font-size: 18px;
  background: linear-gradient(135deg, #ff6b6b, #ff8e53);
  border: none;
  border-radius: 8px;
  color: white;
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s;
}

.game-over-content button:hover {
  transform: scale(1.05);
  box-shadow: 0 0 20px rgba(255, 107, 107, 0.5);
}
</style>