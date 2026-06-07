const { Quest, PlayerQuest, Character } = require('../models');

let ioInstance = null;

function setIo(io) {
  ioInstance = io;
}

function computeOverallProgressPercent(progressJson, objectivesJson) {
  if (!objectivesJson || objectivesJson.length === 0) {
    return 0;
  }

  let totalWeight = 0;
  let totalProgress = 0;

  for (const obj of objectivesJson) {
    const required = obj.required_amount || 1;
    const current = Math.min(progressJson[obj.objective_id] || 0, required);
    totalWeight += required;
    totalProgress += current;
  }

  if (totalWeight === 0) {
    return 0;
  }

  return Math.round((totalProgress / totalWeight) * 100);
}

function emitQuestUpdate(characterId, playerQuest, quest, progressJson, overallProgressPercent) {
  if (!ioInstance) return;

  const payload = {
    player_quest_id: playerQuest.player_quest_id,
    quest_id: quest.quest_id,
    status: playerQuest.status,
    progress: progressJson,
    overall_progress_percent: overallProgressPercent,
    message: 'Quest progress updated'
  };

  ioInstance.to(`character:${characterId}`).emit('questUpdate', payload);
}

function emitQuestReadyForReward(characterId, playerQuest, quest) {
  if (!ioInstance) return;

  const payload = {
    player_quest_id: playerQuest.player_quest_id,
    quest_id: quest.quest_id,
    name: quest.name,
    message: 'All objectives completed. Quest ready for reward.'
  };

  ioInstance.to(`character:${characterId}`).emit('questReadyForReward', payload);
}

class QuestProgressService {
  setIo(io) {
    setIo(io);
  }

  async updateProgress(characterId, eventType, eventData) {
    const character = await Character.findByPk(characterId);
    if (!character) {
      throw Object.assign(new Error('Character not found'), { statusCode: 404 });
    }

    const playerQuests = await PlayerQuest.findAll({
      where: {
        character_id: characterId,
        status: ['accepted', 'in_progress']
      },
      include: [{ model: Quest }]
    });

    const results = [];

    for (const playerQuest of playerQuests) {
      const quest = playerQuest.Quest;
      const objectives = quest.objectives_json || [];
      let updated = false;
      let allComplete = true;

      const progressJson = { ...playerQuest.progress_json };

      for (const obj of objectives) {
        if (obj.type === eventType && String(obj.target_id) === String(eventData.target_id)) {
          const increment = eventData.amount || 1;
          const current = progressJson[obj.objective_id] || 0;
          const required = obj.required_amount || 1;
          const newValue = Math.min(current + increment, required);

          if (newValue !== current) {
            progressJson[obj.objective_id] = newValue;
            updated = true;
          }
        }

        const currentProgress = progressJson[obj.objective_id] || 0;
        const requiredAmount = obj.required_amount || 1;
        if (currentProgress < requiredAmount) {
          allComplete = false;
        }
      }

      if (!updated) {
        continue;
      }

      const overallProgressPercent = computeOverallProgressPercent(progressJson, objectives);

      let newStatus = playerQuest.status;
      let completedAt = playerQuest.completed_at;

      if (allComplete) {
        newStatus = 'ready_for_reward';
        completedAt = new Date();
      } else if (playerQuest.status === 'accepted') {
        newStatus = 'in_progress';
      }

      await playerQuest.update({
        progress_json: progressJson,
        status: newStatus,
        completed_at: completedAt
      });

      emitQuestUpdate(characterId, playerQuest, quest, progressJson, overallProgressPercent);

      if (allComplete) {
        emitQuestReadyForReward(characterId, playerQuest, quest);
      }

      results.push({
        player_quest_id: playerQuest.player_quest_id,
        quest_id: quest.quest_id,
        status: newStatus,
        progress: progressJson,
        overall_progress_percent: overallProgressPercent
      });
    }

    return results;
  }

  async submitQuest(characterId, playerQuestId) {
    const playerQuest = await PlayerQuest.findOne({
      where: { player_quest_id: playerQuestId },
      include: [{ model: Quest }]
    });

    if (!playerQuest || playerQuest.character_id !== characterId) {
      throw Object.assign(new Error('Player quest not found'), { statusCode: 404 });
    }

    if (playerQuest.status !== 'accepted' && playerQuest.status !== 'in_progress') {
      throw Object.assign(
        new Error('Quest is not in a submittable state'),
        { statusCode: 409 }
      );
    }

    const objectives = playerQuest.Quest.objectives_json || [];
    const overallProgressPercent = computeOverallProgressPercent(
      playerQuest.progress_json,
      objectives
    );

    if (overallProgressPercent !== 100) {
      throw Object.assign(
        new Error('Quest progress is not 100%'),
        { statusCode: 400 }
      );
    }

    const completedAt = new Date();
    await playerQuest.update({
      status: 'ready_for_reward',
      completed_at: completedAt
    });

    return {
      success: true,
      player_quest_id: playerQuest.player_quest_id,
      status: 'ready_for_reward',
      completed_at: completedAt,
      message: 'Quest submitted successfully'
    };
  }
}

module.exports = new QuestProgressService();
