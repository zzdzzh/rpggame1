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

module.exports = { computeOverallProgressPercent };
