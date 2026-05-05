import * as THREE from 'three';

export class Character {
  constructor(name, sprites, options = {}) {
    this.name = name;
    this.sprites = sprites;
    this.currentFrame = 0;
    this.frameCount = sprites.length;
    this.frameDuration = options.frameDuration || 150;
    this.lastFrameTime = 0;
    this.isAnimating = false;
    this.isMoving = false;

    this.position = new THREE.Vector3(
      options.x || 0,
      options.y || 0,
      options.z || 0
    );

    this.moveSpeed = options.moveSpeed || 200;
    this.rotationSpeed = options.rotationSpeed || 4;

    this.direction = new THREE.Vector3(0, 1, 0);
    this.facingAngle = 0;

    this.textures = [];
    this.texture = null;
    this.mesh = null;
    this.ready = false;
  }

  static async loadAllTextures(spriteUrls) {
    const loader = new THREE.TextureLoader();
    const promises = spriteUrls.map(url =>
      new Promise((resolve, reject) => {
        loader.load(
          url,
          (texture) => {
            texture.minFilter = THREE.LinearFilter;
            texture.magFilter = THREE.LinearFilter;
            resolve(texture);
          },
          undefined,
          (error) => reject(error)
        );
      })
    );
    return await Promise.all(promises);
  }

  async init() {
    this.textures = await Character.loadAllTextures(this.sprites);
    this.texture = this.textures[0];

    const geometry = new THREE.PlaneGeometry(64, 64);
    const material = new THREE.MeshBasicMaterial({
      map: this.texture,
      transparent: true,
      alphaTest: 0.1,
      side: THREE.DoubleSide,
      depthWrite: false
    });

    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.position.copy(this.position);
    this.mesh.renderOrder = 1;
    this.ready = true;
  }

  setSprites(sprites) {
    this.sprites = sprites;
    this.frameCount = sprites.length;
  }

  updateAnimation(currentTime) {
    if (!this.isAnimating || this.frameCount <= 1 || !this.ready) return;

    if (currentTime - this.lastFrameTime >= this.frameDuration) {
      this.currentFrame = (this.currentFrame + 1) % this.frameCount;
      this.mesh.material.map = this.textures[this.currentFrame];
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

  rotateLeft() {
    this.facingAngle += Math.PI / 4;
    this.updateRotation();
  }

  rotateRight() {
    this.facingAngle -= Math.PI / 4;
    this.updateRotation();
  }

  updateRotation() {
    this.direction.x = -Math.sin(this.facingAngle);
    this.direction.y = Math.cos(this.facingAngle);
    this.direction.normalize();
    this.mesh.rotation.z = this.facingAngle;
  }

  moveForward(deltaTime) {
    const moveAmount = this.moveSpeed * deltaTime;
    this.position.x += this.direction.x * moveAmount;
    this.position.y += this.direction.y * moveAmount;
    this.mesh.position.copy(this.position);
  }

  moveBackward(deltaTime) {
    const moveAmount = this.moveSpeed * deltaTime;
    this.position.x -= this.direction.x * moveAmount;
    this.position.y -= this.direction.y * moveAmount;
    this.mesh.position.copy(this.position);
  }

  strafeLeft(deltaTime) {
    const moveAmount = this.moveSpeed * deltaTime;
    const leftDir = new THREE.Vector3(-this.direction.y, this.direction.x, 0);
    this.position.x += leftDir.x * moveAmount;
    this.position.y += leftDir.y * moveAmount;
    this.mesh.position.copy(this.position);
  }

  strafeRight(deltaTime) {
    const moveAmount = this.moveSpeed * deltaTime;
    const rightDir = new THREE.Vector3(this.direction.y, -this.direction.x, 0);
    this.position.x += rightDir.x * moveAmount;
    this.position.y += rightDir.y * moveAmount;
    this.mesh.position.copy(this.position);
  }

  setMoving(moving) {
    if (moving && !this.isMoving) {
      this.isMoving = true;
      this.startAnimation();
    } else if (!moving && this.isMoving) {
      this.isMoving = false;
      this.stopAnimation();
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

  setPosition(x, y, z = 0) {
    this.position.set(x, y, z);
    this.mesh.position.copy(this.position);
  }
}
