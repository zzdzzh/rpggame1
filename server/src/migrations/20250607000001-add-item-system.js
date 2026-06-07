module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Add equipment slot columns to characters
    await queryInterface.addColumn('characters', 'equip_weapon_id', {
      type: Sequelize.INTEGER,
      allowNull: true
    });
    await queryInterface.addColumn('characters', 'equip_helmet_id', {
      type: Sequelize.INTEGER,
      allowNull: true
    });
    await queryInterface.addColumn('characters', 'equip_armor_id', {
      type: Sequelize.INTEGER,
      allowNull: true
    });
    await queryInterface.addColumn('characters', 'equip_accessory_id', {
      type: Sequelize.INTEGER,
      allowNull: true
    });

    // Create item_definitions table
    await queryInterface.createTable('item_definitions', {
      item_definition_id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      name: {
        type: Sequelize.STRING(100),
        allowNull: false
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      item_type: {
        type: Sequelize.STRING(50),
        allowNull: false
      },
      rarity: {
        type: Sequelize.STRING(50),
        defaultValue: 'common'
      },
      icon: {
        type: Sequelize.STRING(100),
        allowNull: true
      },
      max_stack: {
        type: Sequelize.INTEGER,
        defaultValue: 1
      },
      is_bind_on_pickup: {
        type: Sequelize.BOOLEAN,
        defaultValue: false
      },
      consumable_effect: {
        type: Sequelize.JSON,
        allowNull: true
      },
      equipment_stats: {
        type: Sequelize.JSON,
        allowNull: true
      },
      equip_slot: {
        type: Sequelize.STRING(50),
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
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    // Create player_items table
    await queryInterface.createTable('player_items', {
      player_item_id: {
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
      item_definition_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'item_definitions',
          key: 'item_definition_id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      quantity: {
        type: Sequelize.INTEGER,
        defaultValue: 1
      },
      is_bound: {
        type: Sequelize.BOOLEAN,
        defaultValue: false
      },
      acquired_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('player_items');
    await queryInterface.dropTable('item_definitions');
    await queryInterface.removeColumn('characters', 'equip_weapon_id');
    await queryInterface.removeColumn('characters', 'equip_helmet_id');
    await queryInterface.removeColumn('characters', 'equip_armor_id');
    await queryInterface.removeColumn('characters', 'equip_accessory_id');
  }
};
