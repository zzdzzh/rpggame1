const CharacterService = require('../services/CharacterService');

jest.mock('../models/Character', () => ({
  create: jest.fn(),
  findByPk: jest.fn(),
  findAll: jest.fn()
}));

const Character = require('../models/Character');

describe('CharacterService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    if (CharacterService.positionUpdateInterval) {
      clearInterval(CharacterService.positionUpdateInterval);
      CharacterService.positionUpdateInterval = null;
    }
  });

  describe('createCharacter', () => {
    it('should create a new character', async () => {
      const characterData = {
        name: 'TestHero',
        character_type: 'player',
        x: 100,
        y: 200
      };

      const mockCharacter = {
        character_id: 1,
        ...characterData,
        save: jest.fn()
      };

      Character.create.mockResolvedValue(mockCharacter);

      const result = await CharacterService.createCharacter(characterData);

      expect(Character.create).toHaveBeenCalledWith(characterData);
      expect(result).toEqual(mockCharacter);
    });
  });

  describe('getCharacterById', () => {
    it('should return character when found', async () => {
      const mockCharacter = {
        character_id: 1,
        name: 'TestHero'
      };

      Character.findByPk.mockResolvedValue(mockCharacter);

      const result = await CharacterService.getCharacterById(1);

      expect(Character.findByPk).toHaveBeenCalledWith(1);
      expect(result).toEqual(mockCharacter);
    });

    it('should return null when character not found', async () => {
      Character.findByPk.mockResolvedValue(null);

      const result = await CharacterService.getCharacterById(999);

      expect(result).toBeNull();
    });
  });

  describe('getAllCharacters', () => {
    it('should return all characters', async () => {
      const mockCharacters = [
        { character_id: 1, name: 'Hero1' },
        { character_id: 2, name: 'Hero2' }
      ];

      Character.findAll.mockResolvedValue(mockCharacters);

      const result = await CharacterService.getAllCharacters();

      expect(Character.findAll).toHaveBeenCalled();
      expect(result).toEqual(mockCharacters);
    });
  });

  describe('updateCharacterPosition', () => {
    it('should update character position', async () => {
      const mockCharacter = {
        character_id: 1,
        name: 'TestHero',
        x: 100,
        y: 200,
        save: jest.fn()
      };

      Character.findByPk.mockResolvedValue(mockCharacter);

      const result = await CharacterService.updateCharacterPosition(1, 300, 400);

      expect(mockCharacter.x).toBe(300);
      expect(mockCharacter.y).toBe(400);
      expect(mockCharacter.save).toHaveBeenCalled();
      expect(result).toEqual(mockCharacter);
    });

    it('should throw error when character not found', async () => {
      Character.findByPk.mockResolvedValue(null);

      await expect(CharacterService.updateCharacterPosition(999, 100, 200))
        .rejects.toThrow('Character not found');
    });
  });

  describe('updateCharacterMap', () => {
    it('should update character map and position', async () => {
      const mockCharacter = {
        character_id: 1,
        name: 'TestHero',
        map_id: 1,
        x: 100,
        y: 200,
        save: jest.fn()
      };

      Character.findByPk.mockResolvedValue(mockCharacter);

      const result = await CharacterService.updateCharacterMap(1, 2, 300, 400);

      expect(mockCharacter.map_id).toBe(2);
      expect(mockCharacter.x).toBe(300);
      expect(mockCharacter.y).toBe(400);
      expect(mockCharacter.save).toHaveBeenCalled();
      expect(result).toEqual(mockCharacter);
    });
  });

  describe('getCharactersByMap', () => {
    it('should return characters on specific map', async () => {
      const mockCharacters = [
        { character_id: 1, map_id: 1, name: 'Hero1' },
        { character_id: 2, map_id: 1, name: 'Hero2' }
      ];

      Character.findAll.mockResolvedValue(mockCharacters);

      const result = await CharacterService.getCharactersByMap(1);

      expect(Character.findAll).toHaveBeenCalledWith({
        where: { map_id: 1 }
      });
      expect(result).toEqual(mockCharacters);
    });
  });

  describe('startPositionBroadcast', () => {
    it('should return an interval ID', () => {
      Character.findAll.mockResolvedValue([]);

      const callback = jest.fn();

      const intervalId = CharacterService.startPositionBroadcast(callback, 3000);

      expect(intervalId).toBeDefined();
      expect(intervalId).not.toBeNull();
    });

    it('should replace existing interval when called again', () => {
      Character.findAll.mockResolvedValue([]);
      const callback1 = jest.fn();
      const callback2 = jest.fn();

      const intervalId1 = CharacterService.startPositionBroadcast(callback1, 3000);
      const intervalId2 = CharacterService.startPositionBroadcast(callback2, 3000);

      expect(intervalId1).not.toEqual(intervalId2);
    });
  });

  describe('stopPositionBroadcast', () => {
    it('should stop the interval', () => {
      Character.findAll.mockResolvedValue([]);
      const callback = jest.fn();

      CharacterService.startPositionBroadcast(callback, 3000);
      CharacterService.stopPositionBroadcast();

      expect(CharacterService.positionUpdateInterval).toBeNull();
    });

    it('should do nothing if no interval is running', () => {
      expect(() => CharacterService.stopPositionBroadcast()).not.toThrow();
    });
  });
});
