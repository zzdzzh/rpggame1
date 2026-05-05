module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('characters', {
      character_id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      name: {
        type: Sequelize.STRING(100),
        allowNull: false
      },
      character_type: {
        type: Sequelize.ENUM('player', 'monster', 'npc'),
        defaultValue: 'player'
      },
      map_id: {
        type: Sequelize.INTEGER,
        defaultValue: 1
      },
      x: {
        type: Sequelize.FLOAT,
        defaultValue: 0
      },
      y: {
        type: Sequelize.FLOAT,
        defaultValue: 0
      },
      level: {
        type: Sequelize.INTEGER,
        defaultValue: 1
      },
      hp: {
        type: Sequelize.INTEGER,
        defaultValue: 100
      },
      max_hp: {
        type: Sequelize.INTEGER,
        defaultValue: 100
      },
      mp: {
        type: Sequelize.INTEGER,
        defaultValue: 50
      },
      max_mp: {
        type: Sequelize.INTEGER,
        defaultValue: 50
      },
      attack: {
        type: Sequelize.INTEGER,
        defaultValue: 10
      },
      defense: {
        type: Sequelize.INTEGER,
        defaultValue: 5
      },
      move_speed: {
        type: Sequelize.FLOAT,
        defaultValue: 200
      },
      exp: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      gold: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP')
      }
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('characters');
  }
};
