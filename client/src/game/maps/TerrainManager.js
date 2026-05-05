import { terrainMap, TERRAIN_TYPES, mapConfig } from '../../assets/map_matrix/map1.js';

export class TerrainManager {
  constructor() {
    this.terrainData = terrainMap;
    this.terrainTypes = TERRAIN_TYPES;
    this.mapWidth = mapConfig.width;
    this.mapHeight = mapConfig.height;
    this.baseGridSize = mapConfig.gridSize;
    this.gridSizeX = mapConfig.gridSize;
    this.gridSizeY = mapConfig.gridSize;
    
    this.updateMapCenter();
  }
  
  setGridSize(newGridSize) {
    if (typeof newGridSize === 'number') {
      this.gridSizeX = newGridSize;
      this.gridSizeY = newGridSize;
    } else if (newGridSize && typeof newGridSize === 'object') {
      this.gridSizeX = newGridSize.width ?? this.gridSizeX;
      this.gridSizeY = newGridSize.height ?? this.gridSizeY;
    }
    this.updateMapCenter();
  }
  
  updateMapCenter() {
    this.mapCenterX = (this.mapWidth * this.gridSizeX) / 2;
    this.mapCenterY = (this.mapHeight * this.gridSizeY) / 2;
  }
  
  static get TERRAIN_TYPES() {
    return TERRAIN_TYPES;
  }

  worldToGrid(worldX, worldY) {
    const adjustedX = worldX + this.mapCenterX;
    const adjustedY = worldY + this.mapCenterY;
    
    const gridX = Math.floor(adjustedX / this.gridSizeX);
    const gridY = this.mapHeight - 1 - Math.floor(adjustedY / this.gridSizeY);
    
    return { x: gridX, y: gridY };
  }

  gridToWorld(gridX, gridY) {
    const adjustedY = this.mapHeight - 1 - gridY;
    const worldX = gridX * this.gridSizeX + this.gridSizeX / 2 - this.mapCenterX;
    const worldY = adjustedY * this.gridSizeY + this.gridSizeY / 2 - this.mapCenterY;
    return { x: worldX, y: worldY };
  }

  getTerrainAtWorld(worldX, worldY) {
    const { x, y } = this.worldToGrid(worldX, worldY);
    return this.getTerrainAtGrid(x, y);
  }

  getTerrainAtGrid(gridX, gridY) {
    if (gridY < 0 || gridY >= this.mapHeight || gridX < 0 || gridX >= this.mapWidth) {
      return this.terrainTypes.BLOCKED;
    }
    return this.terrainData[gridY][gridX];
  }

  isWalkable(worldX, worldY) {
    const terrain = this.getTerrainAtWorld(worldX, worldY);
    return terrain !== this.terrainTypes.BLOCKED;
  }

  isWalkableGrid(gridX, gridY) {
    const terrain = this.getTerrainAtGrid(gridX, gridY);
    return terrain !== this.terrainTypes.BLOCKED;
  }

  checkMove(newX, newY, collisionRadius = 10) {
    const corners = [
      { x: newX - collisionRadius, y: newY - collisionRadius },
      { x: newX + collisionRadius, y: newY - collisionRadius },
      { x: newX - collisionRadius, y: newY + collisionRadius },
      { x: newX + collisionRadius, y: newY + collisionRadius }
    ];

    for (const corner of corners) {
      if (!this.isWalkable(corner.x, corner.y)) {
        return false;
      }
    }
    return true;
  }

  getMapBounds() {
    return {
      minX: -this.mapCenterX,
      maxX: this.mapCenterX,
      minY: -this.mapCenterY,
      maxY: this.mapCenterY
    };
  }

  getTerrainInfo(terrainValue) {
    switch (terrainValue) {
      case this.terrainTypes.BLOCKED:
        return { name: '阻挡', color: 0xff0000 };
      case this.terrainTypes.GRASS:
        return { name: '草地', color: 0x00ff00 };
      case this.terrainTypes.WATER:
        return { name: '水域', color: 0x0000ff };
      case this.terrainTypes.MOUNTAIN:
        return { name: '山地', color: 0x808080 };
      case this.terrainTypes.SPECIAL:
        return { name: '特殊', color: 0xffff00 };
      default:
        return { name: '未知', color: 0xffffff };
    }
  }

  getGridSize() {
    return { width: this.gridSizeX, height: this.gridSizeY };
  }

  getMapDimensions() {
    return { width: this.mapWidth, height: this.mapHeight };
  }

  getMapCenter() {
    return { x: this.mapCenterX, y: this.mapCenterY };
  }
}