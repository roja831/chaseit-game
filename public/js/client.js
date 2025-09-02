// client.js - join logic
const socket = io();
const joinBtn = document.getElementById('joinBtn');

function showAlert(text){ alert(text); }

joinBtn.addEventListener('click', () => {
  const teamName = document.getElementById('teamName').value.trim();
  const gameCode = document.getElementById('gameCode').value.trim();
  if (!teamName) return showAlert('Enter a team name.');
  if (gameCode !== 'chase123') return showAlert('Invalid game code.');
  // Save team name locally
  localStorage.setItem('logicshift_teamName', teamName);
  // navigate to waiting room (join will happen from waiting.js - but we'll also emit here)
  socket.emit('joinTeam', teamName);
  window.location.href = '/waiting.html';
});
