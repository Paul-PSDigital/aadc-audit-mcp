const API = 'https://api.example-not-cms.org/x';

function loadScore() {
  return fetch(API + '/score').then((r) => r.json());
}

function playWin() {
  const a = new Audio('/sounds/win.mp3');
  a.play();
  return a;
}

function openPartner() {
  window.open('https://external.example.org', '_blank');
}

export { loadScore, playWin, openPartner };
