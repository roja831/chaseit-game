// admin.js
const socket = io();
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const adminTeamList = document.getElementById('adminTeamList');
const questionsJSON = document.getElementById('questionsJSON');
const saveQuestionsBtn = document.getElementById('saveQuestions');
const uploadForm = document.getElementById('uploadForm');
const fileInput = document.getElementById('fileInput');
const uploadResult = document.getElementById('uploadResult');
const clearLeaderboardBtn = document.getElementById('clearLeaderboardBtn');

socket.emit('registerAdmin');

socket.on('updateLeaderboard', leaderboard => {
  const tbody = document.getElementById("leaderboardBody");
  tbody.innerHTML = ""; // clear old rows

  // Render leaderboard rows
  if (leaderboard.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="4" style="color:#a0a0a0;">No teams have completed Level 5 yet</td>
      </tr>
    `;
    return;
  }

  leaderboard.forEach((entry, index) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>#${index + 1}</td>
      <td>${entry.teamName}</td>
      <td>${entry.completionTime}</td>
      <td>${(entry.totalTime / 1000).toFixed(1)}s</td>
    `;
    tbody.appendChild(row);
  });
});

socket.on('updateTeams', teams => {
  // build teams table
  let html = `
    <table border="1" cellpadding="6" cellspacing="5" style="width:100%; border-collapse: collapse; text-align:center;color: #fff;">
      <thead>
        <tr>
          <th>Team Name</th>
          <th>Current Level</th>
          <th>Completed Levels (Time)</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        ${teams.map(t => {
          const completedText = t.completed.map(c => {
            const date = new Date(c.finishedAt);
            const timeStr = date.toLocaleTimeString(); // HH:MM:SS
            return `L${c.level} at ${timeStr}`;
          }).join('<br>');
          return `
            <tr>
              <td>${escapeHtml(t.name)}</td>
              <td>${t.level}</td>
              <td>${completedText || 'None'}</td>
              <td><button class="delete-btn" data-id="${t.id}">Delete</button></td>
            </tr>
          `;
        }).join('')}
      </tbody>
    </table>
  `;
  adminTeamList.innerHTML = html;

  // Add event listeners for delete buttons
  document.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = parseInt(btn.dataset.id);
      showPopup('Are you sure you want to delete this team?', true, () => {
        socket.emit('deleteTeam', id);
      });
    });
  });

  // Update leaderboard after team deletion
  updateLeaderboard();

});

startBtn.addEventListener('click', () => {
  showPopup('Are you sure you want to start the game? This will begin the 3-second countdown for all teams.', true, () => {
    socket.emit('startGame');
  });
});

stopBtn.addEventListener('click', () => {
  socket.emit('stopGame');
});

clearLeaderboardBtn.addEventListener('click', () => {
  showPopup('Are you sure you want to clear the entire leaderboard? This action cannot be undone.', true, () => {
    socket.emit('clearLeaderboard');
    // After clearing, request updated leaderboard and teams
    socket.emit('requestLeaderboardUpdate');
    socket.emit('requestTeamsUpdate');
  });
});

// load questions JSON
fetch('/questions').then(r => r.json()).then(data => {
  questionsJSON.value = JSON.stringify(data, null, 2);
}).catch(err => console.error(err));

// save edited questions
saveQuestionsBtn.addEventListener('click', () => {
  let data;
  try {
    data = JSON.parse(questionsJSON.value);
  } catch (err) {
    return alert('Invalid JSON');
  }
  fetch('/questions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
    .then(r => r.json()).then(j => {
      if (j.success) alert('Saved questions.');
    });
});

// file upload
uploadForm.addEventListener('submit', (e) => {
  e.preventDefault();
  if (!fileInput.files[0]) return alert('Choose a file');
  const fd = new FormData();
  fd.append('file', fileInput.files[0]);
  fetch('/upload', { method: 'POST', body: fd })
    .then(r => r.json())
    .then(j => {
      if (j.success) {
        uploadResult.innerHTML = `Uploaded: <code>${j.url}</code>`;
      } else {
        uploadResult.innerText = 'Upload failed';
      }
    }).catch(err => {
      console.error(err);
      uploadResult.innerText = 'Upload failed';
    });
});

function escapeHtml(str) {
  return (str||'').toString().replace(/[&<>"']/g, s => ({'&':'&amp;','<':'<','>':'>','"':'"',"'":'&#39;'}[s]));
}

// Logout functionality
document.getElementById('logoutBtn').addEventListener('click', () => {
  showPopup('Are you sure you want to logout?', true, () => {
    // Clear authentication token
    localStorage.removeItem('adminAuth');
    // Disconnect from socket
    socket.disconnect();
    // Redirect to home page
    window.location.href = '/';
  });
});

// Popup functions
function showPopup(message, showCancel = false, onConfirm = null) {
  const modal = document.getElementById('popupModal');
  const messageEl = document.getElementById('popupMessage');
  const okBtn = document.getElementById('popupOkBtn');
  const cancelBtn = document.getElementById('popupCancelBtn');

  messageEl.textContent = message;
  modal.classList.remove('hidden');

  if (showCancel) {
    cancelBtn.classList.remove('hidden');
  } else {
    cancelBtn.classList.add('hidden');
  }

  okBtn.onclick = () => {
    modal.classList.add('hidden');
    if (onConfirm) onConfirm();
  };

  cancelBtn.onclick = () => {
    modal.classList.add('hidden');
  };
}

// ===== Update Leaderboard =====
function updateLeaderboard() {
  fetch('/leaderboard')
    .then(r => r.json())
    .then(leaderboard => {
      const tbody = document.getElementById("leaderboardBody");
      tbody.innerHTML = ""; // clear old rows

      // Render leaderboard rows
      if (leaderboard.length === 0) {
        tbody.innerHTML = `
          <tr>
            <td colspan="4" style="color:#a0a0a0;">No teams have completed Level 5 yet</td>
          </tr>
        `;
        return;
      }

      leaderboard.forEach((entry, index) => {
        const row = document.createElement("tr");
        row.innerHTML = `
          <td>#${index + 1}</td>
          <td>${entry.teamName}</td>
          <td>${entry.completionTime}</td>
          <td>${(entry.totalTime / 1000).toFixed(1)}s</td>
        `;
        tbody.appendChild(row);
      });
    })
    .catch(err => console.error('Error loading leaderboard:', err));
}

