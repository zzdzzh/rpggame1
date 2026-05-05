require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const sequelize = require('./config/sequelize');
const characterRoutes = require('./routes/characterRoutes');
const characterService = require('./services/CharacterService');
const Character = require('./models/Character');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PUT']
  }
});

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api/characters', characterRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('positionUpdate', async (data) => {
    try {
      const { characterId, x, y } = data;
      await characterService.updateCharacterPosition(characterId, x, y);
    } catch (error) {
      console.error('Position update error:', error);
    }
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

characterService.startPositionBroadcast((positions) => {
  io.emit('positionsUpdate', positions);
});

const PORT = process.env.PORT || 3000;

async function initDefaultCharacters() {
  try {
    const count = await Character.count();
    if (count === 0) {
      console.log('No characters found, creating default characters...');
      
      await Character.bulkCreate([
        {
          name: 'Hero1',
          character_type: 'player',
          map_id: 1,
          x: 0,
          y: 0,
          level: 1,
          hp: 100,
          max_hp: 100,
          mp: 50,
          max_mp: 50,
          attack: 10,
          defense: 5,
          move_speed: 200,
          exp: 0,
          gold: 0
        },
        {
          name: 'Goblin',
          character_type: 'monster',
          map_id: 1,
          x: 100,
          y: 50,
          level: 1,
          hp: 50,
          max_hp: 50,
          mp: 0,
          max_mp: 0,
          attack: 5,
          defense: 2,
          move_speed: 150,
          exp: 20,
          gold: 10
        }
      ]);
      
      console.log('Default characters created successfully!');
    } else {
      console.log(`Found ${count} existing characters in database.`);
    }
  } catch (error) {
    console.error('Error initializing default characters:', error);
  }
}

async function startServer() {
  try {
    await sequelize.authenticate();
    console.log('Database connection established successfully.');

    await sequelize.sync({ alter: false });
    console.log('Database synchronized.');

    await initDefaultCharacters();

    server.listen(PORT, '0.0.0.0', () => {
      console.log(`Server is running on 0.0.0.0:${PORT}`);
      console.log(`WebSocket server is ready`);
    });
  } catch (error) {
    console.error('Unable to start server:', error);
    process.exit(1);
  }
}

startServer();

module.exports = { app, server, io };
