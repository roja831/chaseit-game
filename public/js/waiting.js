const socket = io();
const teamList = document.getElementById('teamList');
const countdownEl = document.getElementById('countdown');
const teamNameTitle = document.getElementById('teamNameTitle');

const teamName = localStorage.getItem('logicshift_teamName') || 'Team';
teamNameTitle.innerText = `Team: ${teamName}`;

// Register team on server
socket.emit('joinTeam', teamName);

socket.on('updateTeams', teams => {
  teamList.innerHTML = teams.map(t => `<li>${escapeHtml(t.name)} — Level ${t.level}</li>`).join('');
});

// countdown updates
socket.on('countdown', (n) => {
  countdownEl.innerText = n > 0 ? n : 'GO!';
});

// when game started — redirect to game page with team name as query param
socket.on('gameStarted', (meta) => {
  setTimeout(() => {
    window.location.href = `/game.html?team=${encodeURIComponent(teamName)}`;
  }, 1200);
});

socket.on('gameStopped', () => {
  countdownEl.innerText = 'Game stopped by admin.';
});

function escapeHtml(str) {
  return str.replace(/[&<>"']/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[s]));
}
