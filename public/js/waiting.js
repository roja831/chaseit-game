const socket = io();
const teamList = document.getElementById('teamList');
const countdownEl = document.getElementById('countdown');
const teamNameTitle = document.getElementById('teamNameTitle');

const urlParams = new URLSearchParams(window.location.search);
const teamName = urlParams.get('team') || localStorage.getItem('logicshift_teamName') || 'Team';
let currentLevel = parseInt(urlParams.get('level')) || 1;
teamNameTitle.innerText = `Team: ${teamName}`;

let gameCode = urlParams.get('gameCode') || localStorage.getItem('logicshift_gameCode') || 'chase123';
localStorage.setItem('logicshift_gameCode', gameCode);

// Register team on server
socket.emit('joinTeam', { name: teamName, level: currentLevel, gameCode });

socket.on('teamInfo', data => {
  currentLevel = data.level;
});

socket.on('updateTeams', teams => {
  teamList.innerHTML = teams.map(t => `<li>${escapeHtml(t.name)} — Level ${t.level}</li>`).join('');
});

// countdown updates
socket.on('countdown', (n) => {
  countdownEl.innerText = n > 0 ? n : 'GO!';
});

// when game started — redirect to game page with team name and level as query param
socket.on('gameStarted', (meta) => {
  setTimeout(() => {
    window.location.href = `/game.html?team=${encodeURIComponent(teamName)}&level=${currentLevel}`;
  }, 1200);
});

socket.on('gameStopped', () => {
  countdownEl.innerText = 'Game stopped by admin.';
});

socket.on('joinError', (data) => {
  alert(data.message);
  window.location.href = "/";
});

function escapeHtml(str) {
  return str.replace(/[&<>"']/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[s]));
}
