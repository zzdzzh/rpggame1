module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('quests', {
      quest_id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      name: {
        type: Sequelize.STRING(100),
        allowNull: false,
        unique: true
      },
      description: {
        type: Sequelize.TEXT
      },
      quest_type: {
        type: Sequelize.ENUM('main', 'side', 'daily'),
        allowNull: false
      },
      level_min: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 1
      },
      level_max: {
        type: Sequelize.INTEGER,
        allowNull: true
      },
      trigger_conditions_json: {
        type: Sequelize.JSON,
        allowNull: false
      },
      prerequisites_json: {
        type: Sequelize.JSON,
        allowNull: false,
        defaultValue: []
      },
      objectives_json: {
        type: Sequelize.JSON,
        allowNull: false
      },
      rewards_json: {
        type: Sequelize.JSON,
        allowNull: false
      },
      max_concurrent_limit: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 1
      },
      is_active: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    await queryInterface.addIndex('quests', ['is_active']);
    await queryInterface.addIndex('quests', ['quest_type']);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('quests');
  }
};
