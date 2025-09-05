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

// Function to update level and team in URL
function updateUrlLevel(lvl) {
  const url = new URL(window.location);
  url.searchParams.set('level', lvl);
  url.searchParams.set('team', teamName);
  window.history.replaceState(null, null, url.toString());
}

// ---- Socket events ----
socket.emit('joinTeam', {name: teamName, level: currentLevel, gameCode: 'chase123'});

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

socket.on('joinError', (data) => {
  alert(data.message);
  window.location.href = "/";
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
  card.style.maxWidth = '50%';
  card.style.padding = '15px';
  card.innerHTML = `
    <h2 style="font-size: 1.2rem; margin-bottom: 8px;">Level 4 — Reorder OSI layers</h2>
    <p style="font-size: 0.9rem; margin-bottom: 12px;">Arrange from bottom (Physical) → top (Application)</p>
    <div id="layerList" style="display:flex; flex-direction:column; gap:4px; max-width: 100%;"></div>
    <div style="margin-top:12px;"><button id="submit4" style="padding: 8px 16px; font-size: 0.9rem;">Submit</button></div>
  `;
  gameRoot.appendChild(card);

  const list = card.querySelector('#layerList');
  const arr = shuffleArray(q.layers.slice());

  arr.forEach((item, idx) => {
    const el = document.createElement('div');
    el.className = 'drag-item';
    el.draggable = true;

    // Mobile-friendly compact style
    el.style.display = 'flex';
    el.style.justifyContent = 'space-between';
    el.style.alignItems = 'center';
    el.style.padding = '6px 10px';
    el.style.borderRadius = '8px';
    el.style.background = 'linear-gradient(135deg,#00d4ff,#0088ff)';
    el.style.color = '#fff';
    el.style.fontWeight = '600';
    el.style.fontSize = '0.85rem';
    el.style.cursor = 'grab';
    el.style.transition = 'all 0.2s ease';
    el.style.userSelect = 'none';
    el.style.touchAction = 'none';
    el.id = 'layer-' + idx;

    el.innerHTML = `<span>${item}</span><span style="opacity:0.6;font-size:0.8rem">⇅</span>`;

    // Enhanced drag events with touch support
    el.addEventListener('dragstart', ev => {
      ev.dataTransfer.setData('text/plain', item);
      el.style.opacity = '0.5';
      el.style.transform = 'scale(0.95)';
    });
    el.addEventListener('dragend', ev => {
      el.style.opacity = '1';
      el.style.transform = 'scale(1)';
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

    // Touch support for mobile
    let touchStartY = 0;
    el.addEventListener('touchstart', ev => {
      touchStartY = ev.touches[0].clientY;
      el.style.opacity = '0.5';
      el.style.transform = 'scale(0.95)';
    });

    el.addEventListener('touchend', ev => {
      el.style.opacity = '1';
      el.style.transform = 'scale(1)';
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

// ===== Level 5: Technical Tower of Hanoi (drag + touch + tap) =====
function renderLevel5(items) {
  const stages = [
    { name: "Testing", color: "#e74c3c" },          // smallest
    { name: "Development", color: "#f39c12" },
    { name: "Design", color: "#2980b9" },
    { name: "Requirements Analysis", color: "#27ae60" } // largest
  ];
  const numDisks = stages.length;

  const card = document.createElement("div");
  card.className = "level-card";
  card.innerHTML = `
    <h2>Level 5 — Software Dev Tower of Hanoi</h2>
    <p style="text-align:center; font-size:0.9rem; color:#555; margin:6px 0;">
      Tip: On phone, tap a rod to pick the top stage, then tap another rod to drop. Drag the top stage on desktop.
    </p>
    <div id="hanoiGame" style="display:flex; justify-content:space-around; margin:20px 0; gap:10px; touch-action:none;"></div>
    <div style="margin-top:12px; display:flex; justify-content:center; gap:12px;">
      <button id="undoBtn" style="padding: 8px 16px; font-size: 0.9rem;">Undo</button>
      <button id="submit5" style="padding: 8px 16px; font-size: 0.9rem;">Check Puzzle</button>
    </div>
  `;
  gameRoot.appendChild(card);

  const hanoiGame = card.querySelector("#hanoiGame");

  // --- state ---
  let rods = [[], [], []];
  for (let i = numDisks; i >= 1; i--) rods[0].push(i); // numbers represent stages (1..numDisks)
  let moveHistory = [];

  // drag/touch state
  let draggedDisk = null; // numeric size
  let fromRod = null;
  let isDragging = false;
  let draggingEl = null;   // DOM element being moved (for touch visuals)
  let touchStartX = 0, touchStartY = 0;

  // tap-to-move state (mobile)
  let selectedRod = null;

  // --- render ---
  function render() {
    hanoiGame.innerHTML = "";
    rods.forEach((rod, rodIndex) => {
      const rodDiv = document.createElement("div");
      rodDiv.className = "rod";
      rodDiv.dataset.rod = rodIndex;
      Object.assign(rodDiv.style, {
        flex: "1",
        minHeight: "220px",
        border: "2px solid #555",
        borderRadius: "8px",
        display: "flex",
        flexDirection: "column-reverse",
        alignItems: "center",
        justifyContent: "flex-start",
        padding: "8px",
        background: "#f9f9f9",
        transition: "background 0.12s ease, border-color 0.12s ease",
      });

      // make rod clickable for tap-to-move
      rodDiv.addEventListener("click", () => handleTapMove(rodIndex));

      // desktop drop targets
      rodDiv.addEventListener("dragover", (e) => {
        e.preventDefault();
        highlightRod(rodDiv);
      });
      rodDiv.addEventListener("dragleave", () => unhighlightRod(rodDiv));
      rodDiv.addEventListener("drop", (e) => {
        e.preventDefault();
        unhighlightRod(rodDiv);
        // use global fromRod set in dragstart
        if (fromRod !== null && draggedDisk !== null) {
          moveDisk(fromRod, rodIndex);
          resetDragState();
        }
      });

      // render disks for this rod
      rod.forEach((disk, diskIndex) => {
        const stage = stages[disk - 1];
        const diskDiv = document.createElement("div");
        diskDiv.className = "disk";
        diskDiv.dataset.size = disk;
        diskDiv.style.height = "40px";
        diskDiv.style.margin = "4px 0";
        diskDiv.style.borderRadius = "14px";
        diskDiv.style.background = stage.color;
        diskDiv.style.width = `${disk * (70 / numDisks) + 30}%`;
        diskDiv.style.maxWidth = "160px";
        diskDiv.style.minWidth = "80px";
        diskDiv.style.textAlign = "center";
        diskDiv.style.color = "#fff";
        diskDiv.style.fontWeight = "700";
        diskDiv.style.fontSize = "0.85rem";
        diskDiv.style.cursor = "pointer";
        diskDiv.style.userSelect = "none";
        diskDiv.style.boxShadow = "0 2px 4px rgba(0,0,0,0.2)";
        diskDiv.style.display = "flex";
        diskDiv.style.alignItems = "center";
        diskDiv.style.justifyContent = "center";
        diskDiv.style.touchAction = "none";
        diskDiv.textContent = stage.name;

        const isTopDisk = diskIndex === rod.length - 1;
        diskDiv.draggable = !!isTopDisk;
        if (!isTopDisk) {
          diskDiv.style.opacity = "0.75";
          diskDiv.style.cursor = "not-allowed";
        }

        // avoid bubbling clicks from disk to rod (tap flow)
        diskDiv.addEventListener("click", (e) => e.stopPropagation());

        // --- Desktop drag ---
        diskDiv.addEventListener("dragstart", (e) => {
          if (!isTopOfParent(diskDiv)) { e.preventDefault(); return; }
          draggedDisk = parseInt(diskDiv.dataset.size, 10);
          fromRod = parseInt(diskDiv.parentElement.dataset.rod, 10);
          isDragging = true;
          try { e.dataTransfer.setData("text/plain", String(draggedDisk)); } catch (_) {}
          diskDiv.style.transform = "scale(1.05)";
          diskDiv.style.zIndex = "1000";
        });
        diskDiv.addEventListener("dragend", () => {
          diskDiv.style.transform = "scale(1)";
          diskDiv.style.zIndex = "auto";
          resetDragState();
          clearHighlights();
        });

        // --- Touch handlers (robust) ---
        diskDiv.addEventListener("touchstart", (e) => {
          if (!isTopOfParent(diskDiv)) return;
          e.preventDefault();
          draggedDisk = parseInt(diskDiv.dataset.size, 10);
          fromRod = parseInt(diskDiv.parentElement.dataset.rod, 10);
          isDragging = true;
          draggingEl = diskDiv;
          touchStartX = e.touches[0].clientX;
          touchStartY = e.touches[0].clientY;
          draggingEl.style.transition = "transform 0s";
          draggingEl.style.zIndex = "1000";
        }, { passive: false });

        diskDiv.addEventListener("touchmove", (e) => {
          if (!isDragging || !draggingEl) return;
          e.preventDefault();
          const t = e.touches[0];
          const dx = t.clientX - touchStartX;
          const dy = t.clientY - touchStartY;
          draggingEl.style.transform = `translate(${dx}px, ${dy}px) scale(1.05)`;

          // hit test under finger: hide element temporarily
          draggingEl.style.visibility = "hidden";
          const elUnder = document.elementFromPoint(t.clientX, t.clientY);
          draggingEl.style.visibility = "visible";

          clearHighlights();
          const rodCandidate = elUnder && elUnder.closest && elUnder.closest(".rod");
          if (rodCandidate) highlightRod(rodCandidate);
        }, { passive: false });

        diskDiv.addEventListener("touchend", (e) => {
          if (!isDragging || !draggingEl) return;
          e.preventDefault();
          const t = e.changedTouches[0];

          // detect drop target
          draggingEl.style.visibility = "hidden";
          const elUnder = document.elementFromPoint(t.clientX, t.clientY);
          draggingEl.style.visibility = "visible";
          const rodCandidate = elUnder && elUnder.closest && elUnder.closest(".rod");

          // reset visual
          draggingEl.style.transform = "";
          draggingEl.style.zIndex = "auto";
          clearHighlights();

          if (rodCandidate) {
            const to = parseInt(rodCandidate.dataset.rod, 10);
            if (fromRod !== null && draggedDisk !== null) moveDisk(fromRod, to);
          }
          resetDragState();
        }, { passive: false });

        rodDiv.appendChild(diskDiv);
      });

      hanoiGame.appendChild(rodDiv);
    });
  } // end render

  // --- helpers ---
  function isTopOfParent(diskEl) {
    const parent = diskEl.parentElement;
    if (!parent) return false;
    const idx = parseInt(parent.dataset.rod, 10);
    const top = rods[idx].slice(-1)[0];
    return parseInt(diskEl.dataset.size, 10) === top;
  }

  function moveDisk(from, to) {
    if (from === to) return;
    const moving = rods[from][rods[from].length - 1];
    const topTo = rods[to][rods[to].length - 1];
    if (!moving) return;
    if (!topTo || topTo > moving) {
      rods[from].pop();
      rods[to].push(moving);
      moveHistory.push({ from, to, disk: moving });
      render();
    }
  }

  function handleTapMove(rodIndex) {
    if (selectedRod === null) {
      if (rods[rodIndex].length > 0) {
        selectedRod = rodIndex;
        highlightRod(hanoiGame.querySelector(`[data-rod="${rodIndex}"]`));
      }
    } else {
      const from = selectedRod;
      selectedRod = null;
      unhighlightRod(hanoiGame.querySelector(`[data-rod="${from}"]`));
      moveDisk(from, rodIndex);
    }
  }

  function highlightRod(rodDiv) {
    if (!rodDiv) return;
    rodDiv.style.background = "#e8f4f8";
    rodDiv.style.borderColor = "#00d4ff";
  }
  function unhighlightRod(rodDiv) {
    if (!rodDiv) return;
    rodDiv.style.background = "#f9f9f9";
    rodDiv.style.borderColor = "#555";
  }
  function clearHighlights() {
    hanoiGame.querySelectorAll(".rod").forEach(unhighlightRod);
  }
  function resetDragState() {
    isDragging = false;
    draggedDisk = null;
    fromRod = null;
    draggingEl = null;
  }

  // --- controls ---
  card.querySelector("#undoBtn").onclick = () => {
    const last = moveHistory.pop();
    if (last) {
      rods[last.to].pop();
      rods[last.from].push(last.disk);
      render();
    }
  };
  card.querySelector("#submit5").onclick = () => {
    if (rods[2].length === numDisks) levelSuccess();
    else levelFail();
  };

  // initial draw
  render();
}

// ===== Helpers =====
function levelSuccess() {
  stopTimer();

  // Record the exact finish time for all levels
  const completionData = { level: currentLevel, finishedAt: new Date().toISOString() };

  // Emit levelCompleted for all levels
  socket.emit('levelCompleted', completionData);

  // If level 5 completed, emit level5Completed for leaderboard
  if (currentLevel === 5) {
    const totalTime = Date.now() - levelStart; // Calculate total time from level start
    socket.emit('level5Completed', {
      teamName: teamName,
      totalTime: totalTime
    });
  }

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
