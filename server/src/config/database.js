const path = require('path');
const dbPath = path.join(__dirname, '..', '..', 'data', 'game.db');

module.exports = {
  development: {
    dialect: 'sqlite',
    storage: dbPath,
    logging: false
  },
  test: {
    dialect: 'sqlite',
    storage: ':memory:',
    logging: false
  },
  production: {
    dialect: 'sqlite',
    storage: dbPath,
    logging: false
  }
};
