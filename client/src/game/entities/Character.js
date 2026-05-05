import * as THREE from 'three';

export class Character {
  constructor(name, movingSprites, idleSprites, options = {}) {
    this.name = name;
    this.movingSprites = movingSprites;
    this.idleSprites = idleSprites || [];
    this.currentFrame = 0;
    this.movingFrameCount = movingSprites.length;
    this.idleFrameCount = idleSprites.length;
    this.frameDuration = options.frameDuration || 150;
    this.lastFrameTime = 0;
    this.isAnimating = true;
    this.isMoving = false;

    this.position = new THREE.Vector3(
      options.x || 0,
      options.y || 0,
      options.z || 0
    );

    this.moveSpeed = options.moveSpeed || 200;

    this.direction = new THREE.Vector3(0, 1, 0);
    this.facingRight = true;

    this.movingTextures = [];
    this.idleTextures = [];
    this.currentTextures = [];
    this.texture = null;
    this.mesh = null;
    this.ready = false;

    this.hp = options.hp || 100;
    this.maxHp = options.maxHp || 100;
    this.attack = options.attack || 10;
    this.defense = options.defense || 5;
    this.criticalRate = options.criticalRate || 0.1;
    this.criticalMultiplier = options.criticalMultiplier || 2.0;

    this.isAlive = true;
    this.isInCombat = false;
    this.lastAttackTime = 0;
    this.attackCooldown = options.attackCooldown || 1000;
  }

  static async loadAllTextures(spriteUrls) {
    const promises = spriteUrls.map(url =>
      new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0);
          const texture = new THREE.CanvasTexture(canvas);
          texture.minFilter = THREE.LinearFilter;
          texture.magFilter = THREE.LinearFilter;
          texture.colorSpace = THREE.SRGBColorSpace;
          resolve(texture);
        };
        img.onerror = reject;
        img.src = url;
      })
    );
    return await Promise.all(promises);
  }

  async init() {
    this.movingTextures = await Character.loadAllTextures(this.movingSprites);
    if (this.idleSprites.length > 0) {
      this.idleTextures = await Character.loadAllTextures(this.idleSprites);
    } else {
      this.idleTextures = [...this.movingTextures];
    }
    
    this.currentTextures = this.idleTextures;
    this.texture = this.currentTextures[0];

    const geometry = new THREE.PlaneGeometry(64, 64);
    const material = new THREE.MeshBasicMaterial({
      map: this.texture,
      transparent: true,
      alphaTest: 0,
      side: THREE.DoubleSide,
      depthWrite: false
    });

    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.position.copy(this.position);
    this.mesh.renderOrder = 1;
    this.ready = true;
  }

  setMovingSprites(sprites) {
    this.movingSprites = sprites;
    this.movingFrameCount = sprites.length;
  }

  setIdleSprites(sprites) {
    this.idleSprites = sprites;
    this.idleFrameCount = sprites.length;
  }

  updateAnimation(currentTime) {
    if (!this.isAnimating || this.currentTextures.length <= 1 || !this.ready) return;

    if (currentTime - this.lastFrameTime >= this.frameDuration) {
      this.currentFrame = (this.currentFrame + 1) % this.currentTextures.length;
      this.mesh.material.map = this.currentTextures[this.currentFrame];
      this.mesh.material.needsUpdate = true;
      this.lastFrameTime = currentTime;
    }
  }

  startAnimation() {
    this.isAnimating = true;
    this.currentFrame = 0;
  }

  stopAnimation() {
    this.isAnimating = false;
    this.currentFrame = 0;
  }

  setDirectionRight() {
    if (!this.facingRight) {
      this.facingRight = true;
      this.mesh.scale.x = 1;
    }
  }

  setDirectionLeft() {
    if (this.facingRight) {
      this.facingRight = false;
      this.mesh.scale.x = -1;
    }
  }

  moveForward(deltaTime) {
    const moveAmount = this.moveSpeed * deltaTime;
    this.position.y += moveAmount;
    this.mesh.position.copy(this.position);
  }

  moveBackward(deltaTime) {
    const moveAmount = this.moveSpeed * deltaTime;
    this.position.y -= moveAmount;
    this.mesh.position.copy(this.position);
  }

  moveLeft(deltaTime) {
    const moveAmount = this.moveSpeed * deltaTime;
    this.position.x -= moveAmount;
    this.setDirectionLeft();
    this.mesh.position.copy(this.position);
  }

  moveRight(deltaTime) {
    const moveAmount = this.moveSpeed * deltaTime;
    this.position.x += moveAmount;
    this.setDirectionRight();
    this.mesh.position.copy(this.position);
  }

  moveUpLeft(deltaTime) {
    const moveAmount = this.moveSpeed * deltaTime * 0.707;
    this.position.x -= moveAmount;
    this.position.y += moveAmount;
    this.setDirectionLeft();
    this.mesh.position.copy(this.position);
  }

  moveUpRight(deltaTime) {
    const moveAmount = this.moveSpeed * deltaTime * 0.707;
    this.position.x += moveAmount;
    this.position.y += moveAmount;
    this.setDirectionRight();
    this.mesh.position.copy(this.position);
  }

  moveDownLeft(deltaTime) {
    const moveAmount = this.moveSpeed * deltaTime * 0.707;
    this.position.x -= moveAmount;
    this.position.y -= moveAmount;
    this.setDirectionLeft();
    this.mesh.position.copy(this.position);
  }

  moveDownRight(deltaTime) {
    const moveAmount = this.moveSpeed * deltaTime * 0.707;
    this.position.x += moveAmount;
    this.position.y -= moveAmount;
    this.setDirectionRight();
    this.mesh.position.copy(this.position);
  }

  setMoving(moving) {
    if (moving && !this.isMoving) {
      this.isMoving = true;
      this.currentTextures = this.movingTextures;
      this.currentFrame = 0;
    } else if (!moving && this.isMoving) {
      this.isMoving = false;
      this.currentTextures = this.idleTextures;
      this.currentFrame = 0;
    }
  }

  update(deltaTime) {
  }

  getMesh() {
    return this.mesh;
  }

  getPosition() {
    return {
      x: this.position.x,
      y: this.position.y
    };
  }

  getFacingRight() {
    return this.facingRight;
  }

  setPosition(x, y, z = 0) {
    this.position.set(x, y, z);
    this.mesh.position.copy(this.position);
  }

  takeDamage(damage) {
    this.hp = Math.max(0, this.hp - damage);
    if (this.hp <= 0) {
      this.isAlive = false;
    }
    return damage;
  }

  canAttack(currentTime) {
    return currentTime - this.lastAttackTime >= this.attackCooldown;
  }

  attackTarget(target, currentTime) {
    if (!this.canAttack(currentTime)) return { hit: false, damage: 0, isCritical: false };
    
    const isCritical = Math.random() < this.criticalRate;
    let damage = this.attack - target.defense;
    damage = Math.max(1, isCritical ? damage * this.criticalMultiplier : damage);
    
    this.lastAttackTime = currentTime;
    target.takeDamage(damage);
    
    return { hit: true, damage: Math.floor(damage), isCritical };
  }

  getHealthPercent() {
    return (this.hp / this.maxHp) * 100;
  }

  setInCombat(inCombat) {
    this.isInCombat = inCombat;
  }
}
