// game.js
const socket = io();
const gameRoot = document.getElementById('gameRoot');
const teamLabel = document.getElementById('teamLabel');
const levelLabel = document.getElementById('levelLabel');
const timerLabel = document.getElementById('timerLabel');
const nextBtn = document.getElementById('nextBtn');
const retryBtn = document.getElementById('retryBtn');

// get team name and level from URL query param
const urlParams = new URLSearchParams(window.location.search);
const teamName = urlParams.get('team') || 'Team';
const levelFromUrl = parseInt(urlParams.get('level')) || 1;
teamLabel.innerText = `Team: ${teamName}`;

let questions = null;
let currentLevel = levelFromUrl;
let levelStart = null;
let timerInterval = null;
let gameStarted = false;

// Function to update level in URL
function updateUrlLevel(lvl) {
  const url = new URL(window.location);
  url.searchParams.set('level', lvl);
  window.history.replaceState(null, null, url.toString());
}

// ---- Socket events ----
socket.emit('joinTeam', {name: teamName, level: currentLevel});

// Receive team info from server
socket.on('teamInfo', data => {
  currentLevel = Math.max(currentLevel, data.level || 1);
  teamLabel.innerText = `Team: ${data.name}`;
  updateUrlLevel(currentLevel);
});

// Receive updated game state
socket.on('gameStarted', () => {
  gameStarted = true;
  startTimer();
});

socket.on('countdown', n => {
  timerLabel.innerText = `Game starts in: ${n}`;
});

// fetch questions then load first unlocked level
fetch('/questions').then(r => r.json()).then(q => {
  questions = q;
  loadLevel(currentLevel);
  if (gameStarted) startTimer();
});

// -- loadLevel dispatcher
function loadLevel(n) {
  currentLevel = n;
  levelLabel.innerText = `Level ${n}`;
  gameRoot.innerHTML = '';
  retryBtn.classList.add('hidden');
  nextBtn.classList.add('hidden');

  if (!questions || !questions['level' + n]) {
    gameRoot.innerHTML = `<div class="level-card"><h3>No data for level ${n}</h3></div>`;
    return;
  }

  const data = questions['level' + n];
  if (n === 1) renderLevel1(data);
  else if (n === 2) renderLevel2(data);
  else if (n === 3) renderLevel3(data);
  else if (n === 4) renderLevel4(data);
  else if (n === 5) renderLevel5(data);
}

// ===== Level 1: Match the following =====
function renderLevel1(items) {
  const card = document.createElement('div');
  card.className = 'level-card';
  card.innerHTML = `<h2>Level 1 — Match the symbols with language</h2><div id="lvl1container"></div>`;
  const container = card.querySelector('#lvl1container');

items.forEach((q, i) => {
    // Create a row container
    const row = document.createElement('div');
    row.style.display = 'flex';
    row.style.alignItems = 'center';
    row.style.justifyContent = 'flex-start';
    row.style.gap = '20px';
    row.style.marginBottom = '16px';

// Image element
const img = document.createElement('img');
img.src = q.image;
img.alt = 'img';
img.style.width = '64px';
img.style.height = '64px';
img.style.objectFit = 'cover'; // better for circular crop
img.style.borderRadius = '50%'; // makes it circular


    // Dropdown (options)
    const sel = document.createElement('select');
    sel.id = `lvl1sel${i}`;
    sel.style.padding = '6px 12px';
    sel.style.borderRadius = '6px';
    sel.style.border = '1px solid #00d4ff';
    sel.style.background = '#1e1e32';
    sel.style.color = '#fff';
    sel.style.fontSize = '14px';

    q.options.forEach(o => {
        const opt = document.createElement('option');
        opt.value = o;
        opt.textContent = o;
        sel.appendChild(opt);
    });

    // Append image and select to the row
    row.appendChild(img);
    row.appendChild(sel);

    // Append row to the container
    container.appendChild(row);
});

  const submit = document.createElement('button');
  submit.innerText = 'Submit';
  submit.onclick = () => {
    let ok = true;
    items.forEach((q, i) => {
      const v = document.getElementById(`lvl1sel${i}`).value;
      if (v !== q.answer) ok = false;
    });
    if (ok) levelSuccess();
    else levelFail();
  };
  card.appendChild(submit);
  gameRoot.appendChild(card);
}

// ===== Level 2: JS snippet =====
function renderLevel2(items) {
  const q = items[0];
  const card = document.createElement('div');
  card.className = 'level-card';
  card.innerHTML = `<h2>Level 2 — Complete/Run JS snippet</h2>
    <p>Goal: produce output: <strong>${escapeHtml(q.expectedOutput)}</strong></p>
    <textarea id="codeArea" rows="6">${escapeHtml(q.snippet)}</textarea>
    <div style="margin-top:10px;"><button id="runBtn">Run</button>  <span id="runOutput" style="margin-left:12px;"></span></div>`;
  gameRoot.appendChild(card);

  document.getElementById('runBtn').onclick = () => {
    const code = document.getElementById('codeArea').value;
    try {
      const logs = [];
      const wrapped = new Function('console', `
        (function(){
          try { ${code} } catch(e) { console.log('__ERR__'+e.message); }
        })();
      `);
      wrapped({ log: (...args) => logs.push(args.join(' ')) });
      const out = logs.join(' ').trim();
      document.getElementById('runOutput').innerText = out || '(no output)';
      if (out === q.expectedOutput) levelSuccess();
      else levelFail();
    } catch {
      document.getElementById('runOutput').innerText = 'Error';
      levelFail();
    }
  };
}

// ===== Level 3: Categorize items =====
function renderLevel3(items) {
  const q = items[0];
  const card = document.createElement('div');
  card.className = 'level-card';
  card.innerHTML = `<h2>Level 3 — Categorize items</h2>
    <p>Drag items into correct category boxes, then submit.</p>
    <div id="itemsRow" style="margin-bottom:12px;"></div>
    <div id="catsRow" style="display:flex; gap:12px;"></div>
    <div style="margin-top:12px;"><button id="submit3">Submit</button></div>`;
  gameRoot.appendChild(card);

  const itemsRow = card.querySelector('#itemsRow');
  const catsRow = card.querySelector('#catsRow');

 q.items.forEach(it => {
  const d = document.createElement('div');
  d.className = 'drag-item';
  d.draggable = true;
  d.id = 'item-' + it;
  d.innerText = it;

  // Styling
  d.style.padding = '12px 20px';
  d.style.margin = '6px';
  d.style.borderRadius = '12px';
  d.style.background = 'linear-gradient(135deg, #00d4ff, #0088ff)';
  d.style.color = '#fff';
  d.style.cursor = 'grab';
  d.style.userSelect = 'none';
  d.style.boxShadow = '0 4px 8px rgba(0,0,0,0.2)';
  d.style.transition = 'transform 0.2s ease, box-shadow 0.2s ease';

  d.addEventListener('dragstart', ev => {
    ev.dataTransfer.setData('text/plain', it);
    d.style.transform = 'scale(1.05)';
  });
  d.addEventListener('dragend', ev => d.style.transform = 'scale(1)');

  itemsRow.appendChild(d);
});

q.categories.forEach(cat => {
  const box = document.createElement('div');
  box.style.flex = '1';
  box.style.minHeight = '140px';
  box.style.padding = '12px';
  box.style.border = '2px dashed rgba(0,212,255,0.3)';
  box.style.borderRadius = '15px';
  box.style.background = 'rgba(20,20,35,0.6)';
  box.style.display = 'flex';
  box.style.flexDirection = 'column';
  box.style.alignItems = 'center';
  box.style.justifyContent = 'flex-start';
  box.style.transition = 'background 0.3s ease';

  box.dataset.cat = cat;
  box.innerHTML = `<strong style="margin-bottom:8px; color:#00d4ff;">${cat}</strong><div class="dropzone" style="width:100%; display:flex; flex-wrap:wrap; gap:8px;"></div>`;

  box.addEventListener('dragover', ev => {
    ev.preventDefault();
    box.style.background = 'rgba(0,212,255,0.15)';
  });
  box.addEventListener('dragleave', ev => box.style.background = 'rgba(20,20,35,0.6)');
  box.addEventListener('drop', ev => {
    ev.preventDefault();
    const it = ev.dataTransfer.getData('text/plain');
    const el = document.getElementById('item-' + it);
    if (el) box.querySelector('.dropzone').appendChild(el);
    box.style.background = 'rgba(20,20,35,0.6)';
  });

  catsRow.appendChild(box);
});






  card.querySelector('#submit3').onclick = () => {
    const got = {};
    q.categories.forEach(c => got[c] = []);
    q.categories.forEach(c => {
      const box = Array.from(catsRow.children).find(node => node.dataset.cat === c);
      const list = Array.from(box.querySelectorAll('.dropzone .drag-item')).map(n => n.innerText);
      got[c] = list;
    });

    let ok = true;
    for (const c of q.categories) {
      const expected = q.answer[c] || [];
      const actual = got[c] || [];
      if (expected.length !== actual.length || expected.some(x => !actual.includes(x))) { ok = false; break; }
    }

    if (ok) levelSuccess();
    else levelFail();
  };
}

// ===== Level 4: Reorder layers by drag (simple) =====


function renderLevel4(items) {
  const q = items[0];
  const card = document.createElement('div');
  card.className = 'level-card';
  card.innerHTML = `
    <h2>Level 4 — Reorder OSI layers</h2>
    <p>Arrange from bottom (Physical) → top (Application)</p>
    <div id="layerList" style="display:flex; flex-direction:column; gap:6px;"></div>
    <div style="margin-top:12px;"><button id="submit4">Submit</button></div>
  `;
  gameRoot.appendChild(card);

  const list = card.querySelector('#layerList');
  const arr = shuffleArray(q.layers.slice());

  arr.forEach((item, idx) => {
    const el = document.createElement('div');
    el.className = 'drag-item';
    el.draggable = true;

    // Compact and attractive style
    el.style.display = 'flex';
    el.style.justifyContent = 'space-between';
    el.style.alignItems = 'center';
    el.style.padding = '8px 14px';
    el.style.borderRadius = '10px';
    el.style.background = 'linear-gradient(135deg,#00d4ff,#0088ff)';
    el.style.color = '#fff';
    el.style.fontWeight = '600';
    el.style.fontSize = '14px';
    el.style.cursor = 'grab';
    el.style.transition = 'all 0.2s ease';
    el.id = 'layer-' + idx;

    el.innerHTML = `<span>${item}</span><span style="opacity:0.6;font-size:1rem">⇅</span>`;

    // Drag events
    el.addEventListener('dragstart', ev => {
      ev.dataTransfer.setData('text/plain', item);
      el.style.opacity = '0.5';
    });
    el.addEventListener('dragend', ev => {
      el.style.opacity = '1';
    });
    el.addEventListener('dragover', ev => ev.preventDefault());

    el.addEventListener('drop', ev => {
      ev.preventDefault();
      const dragItem = ev.dataTransfer.getData('text/plain');
      const draggedNode = Array.from(list.children).find(n => n.innerText.includes(dragItem));
      const targetNode = ev.currentTarget;
      if (draggedNode && targetNode && draggedNode !== targetNode) {
        // swap positions
        const draggedNext = draggedNode.nextSibling;
        const targetNext = targetNode.nextSibling;
        list.insertBefore(draggedNode, targetNext);
        list.insertBefore(targetNode, draggedNext);
      }
    });

    list.appendChild(el);
  });

  // Submit button
  card.querySelector('#submit4').onclick = () => {
    const produced = Array.from(list.children).map(n => n.innerText.replace('⇅','').trim());
    const expected = q.answer;
    const ok = produced.length === expected.length && produced.every((v,i)=>v===expected[i]);
    if(ok) levelSuccess();
    else levelFail();
  };
}


// ===== Level 5: Tower of Hanoi =====
function renderLevel5(items) {
  const q = items[0];
  const numDisks = q.disks || 4; // configurable difficulty

  const card = document.createElement("div");
  card.className = "level-card";
  card.innerHTML = `
    <h2>Level 5 — Tower of Hanoi</h2>
    <div id="hanoiGame" style="display:flex; justify-content:space-around; margin:20px 0; gap:20px;"></div>
    <div style="margin-top:12px; display:flex; justify-content:center; gap:12px;">
      <button id="undoBtn">Undo</button>
      <button id="submit5">Check Puzzle</button>
    </div>
  `;
  gameRoot.appendChild(card);

  const hanoiGame = card.querySelector("#hanoiGame");

  // rods state (arrays of disk sizes, smaller number = smaller disk)
  let rods = [[], [], []];
  for (let i = numDisks; i >= 1; i--) {
    rods[0].push(i);
  }

  let moveHistory = []; // stack for undo

  function render() {
    hanoiGame.innerHTML = "";
    rods.forEach((rod, rodIndex) => {
      const rodDiv = document.createElement("div");
      rodDiv.className = "rod";
      rodDiv.dataset.rod = rodIndex;
      rodDiv.style.flex = "1";
      rodDiv.style.minHeight = "200px";
      rodDiv.style.border = "2px solid #555";
      rodDiv.style.borderRadius = "8px";
      rodDiv.style.display = "flex";
      rodDiv.style.flexDirection = "column-reverse";
      rodDiv.style.alignItems = "center";
      rodDiv.style.justifyContent = "flex-start";
      rodDiv.style.padding = "10px";
      rodDiv.style.background = "#f9f9f9";

      rod.forEach((disk) => {
        const diskDiv = document.createElement("div");
        diskDiv.className = "disk";
        diskDiv.draggable = true;
        diskDiv.dataset.size = disk;
        diskDiv.style.height = "24px";
        diskDiv.style.margin = "3px 0";
        diskDiv.style.borderRadius = "12px";
        diskDiv.style.background = `hsl(${disk * 40},70%,60%)`;
        diskDiv.style.width = `${disk * (60 / numDisks) + 40}%`;
        diskDiv.style.maxWidth = "120px";
        diskDiv.style.textAlign = "center";
        diskDiv.style.color = "#fff";
        diskDiv.style.fontWeight = "bold";
        diskDiv.innerText = disk;
        rodDiv.appendChild(diskDiv);
      });

      hanoiGame.appendChild(rodDiv);
    });

    addDragDropHandlers();
  }

  let draggedDisk = null;
  let fromRod = null;

  function addDragDropHandlers() {
    const disks = hanoiGame.querySelectorAll(".disk");
    const rodsDiv = hanoiGame.querySelectorAll(".rod");

    disks.forEach((disk) => {
      disk.addEventListener("dragstart", (e) => {
        draggedDisk = parseInt(disk.dataset.size);
        fromRod = parseInt(disk.parentElement.dataset.rod);
        // allow only if it's the top disk of that rod
        if (rods[fromRod][rods[fromRod].length - 1] !== draggedDisk) {
          e.preventDefault();
          draggedDisk = null;
          fromRod = null;
        }
      });
    });

    rodsDiv.forEach((rodDiv) => {
      rodDiv.addEventListener("dragover", (e) => {
        e.preventDefault();
      });

      rodDiv.addEventListener("drop", (e) => {
        if (draggedDisk !== null) {
          const toRod = parseInt(rodDiv.dataset.rod);
          const topDisk = rods[toRod][rods[toRod].length - 1];
          if (!topDisk || topDisk > draggedDisk) {
            // valid move
            rods[fromRod].pop();
            rods[toRod].push(draggedDisk);
            moveHistory.push({ from: fromRod, to: toRod, disk: draggedDisk });
            render();
          }
        }
      });
    });
  }

  // Undo last move
  card.querySelector("#undoBtn").onclick = () => {
    const lastMove = moveHistory.pop();
    if (lastMove) {
      rods[lastMove.to].pop();
      rods[lastMove.from].push(lastMove.disk);
      render();
    }
  };

  // Submit check
  card.querySelector("#submit5").onclick = () => {
    if (rods[2].length === numDisks) {
      levelSuccess();
    } else {
      levelFail();
    }
  };

  render();
}




// ===== Helpers =====
// ===== Helpers =====
function levelSuccess() {
  stopTimer();

  // Record the exact finish time for all levels
  const completionData = { level: currentLevel, finishedAt: new Date().toISOString() };

  // Emit levelCompleted for all levels
  socket.emit('levelCompleted', completionData);

  showPopup('✅ Correct! Level completed.', false, () => {
    if (currentLevel < 5) {
      currentLevel++;
      updateUrlLevel(currentLevel);
      loadLevel(currentLevel);
      startTimer();
    } else {
      showPopup('🎉 All rounds completed! Wait for admin to stop or check admin leaderboard.');
    }
  });
}


function levelFail() {
  showPopup('Not correct — try again.');
  retryBtn.classList.remove('hidden');
  retryBtn.onclick = () => {
    loadLevel(currentLevel);
    startTimer();
    retryBtn.classList.add('hidden');
  };
}

function startTimer() {
  if (!gameStarted) return;
  if (timerInterval) clearInterval(timerInterval);
  levelStart = Date.now();
  timerInterval = setInterval(() => {
    const s = Math.floor((Date.now() - levelStart)/1000);
    timerLabel.innerText = msToTime(s);
  }, 300);
}

function stopTimer() {
  if (timerInterval) clearInterval(timerInterval);
  timerInterval = null;
}

function msToTime(s) {
  const mm = String(Math.floor(s/60)).padStart(2,'0');
  const ss = String(s%60).padStart(2,'0');
  return `${mm}:${ss}`;
}

function shuffleArray(a){
  for(let i=a.length-1;i>0;i--){
    const j=Math.floor(Math.random()*(i+1));
    [a[i],a[j]]=[a[j],a[i]];
  }
  return a;
}

function escapeHtml(s){
  return (s||'').toString().replace(/[&<>"']/g,c=>({'&':'&amp;','<':'<','>':'>','"':'"',"'":'&#39;'}[c]));
}

// Logout functionality
document.getElementById('logoutBtn').addEventListener('click', () => {
  showPopup('Are you sure you want to logout?', true, () => {
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
