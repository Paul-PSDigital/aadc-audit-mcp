import { config } from './remote-config.js';

function makePlayer() {
  const audio = new Audio();
  audio.volume = 0.6;
  audio.src = config.themeUrl;
  return audio;
}

export { makePlayer };
