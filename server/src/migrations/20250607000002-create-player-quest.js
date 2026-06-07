module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('player_quests', {
      player_quest_id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      character_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'characters',
          key: 'character_id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      quest_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'quests',
          key: 'quest_id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      status: {
        type: Sequelize.ENUM('accepted', 'in_progress', 'ready_for_reward', 'completed'),
        allowNull: false
      },
      progress_json: {
        type: Sequelize.JSON,
        allowNull: false,
        defaultValue: {}
      },
      accepted_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      completed_at: {
        type: Sequelize.DATE,
        allowNull: true
      },
      claimed_at: {
        type: Sequelize.DATE,
        allowNull: true
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

    await queryInterface.addIndex('player_quests', ['character_id', 'status']);
    await queryInterface.addIndex('player_quests', ['character_id', 'quest_id'], { unique: true });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('player_quests');
  }
};
