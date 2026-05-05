import { defineStore } from 'pinia';
import { ref } from 'vue';

export const useBackgroundStore = defineStore('background', () => {
  const currentBackground = ref('bg1');
  const backgroundOptions = ref([
    { id: 'bg1', name: '默认场景', path: 'src/assets/background/bg1.png' },
    { id: 'bg2', name: '场景2', path: 'src/assets/background/bg2.png' },
    { id: 'bg3', name: '场景3', path: 'src/assets/background/bg3.png' }
  ]);

  function setBackground(backgroundId) {
    const bg = backgroundOptions.value.find(b => b.id === backgroundId);
    if (bg) {
      currentBackground.value = backgroundId;
      return bg.path;
    }
    return null;
  }

  function getCurrentBackgroundPath() {
    const bg = backgroundOptions.value.find(b => b.id === currentBackground.value);
    return bg ? bg.path : null;
  }

  function getBackgroundById(id) {
    return backgroundOptions.value.find(b => b.id === id);
  }

  return {
    currentBackground,
    backgroundOptions,
    setBackground,
    getCurrentBackgroundPath,
    getBackgroundById
  };
});