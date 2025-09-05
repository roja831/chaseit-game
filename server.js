// server.js
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const cors = require("cors");
const mysql = require("mysql2/promise");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const PUBLIC = path.join(__dirname, 'public');
app.use(express.static(PUBLIC));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// MySQL connection
const db = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'roja',
  database: process.env.DB_NAME || 'cyber_chase',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Create tables if not exist
async function initDB() {
  try {
    await db.execute(`
      CREATE TABLE IF NOT EXISTS teams (
        id INT AUTO_INCREMENT PRIMARY KEY,
        socketId VARCHAR(255) NULL,
        name VARCHAR(255) UNIQUE NOT NULL,
        level INT DEFAULT 1,
        completed JSON,
        joinedAt BIGINT
      )
    `);
    await db.execute(`
      CREATE TABLE IF NOT EXISTS questions (
        level VARCHAR(10) PRIMARY KEY,
        data JSON
      )
    `);
    await db.execute(`
      CREATE TABLE IF NOT EXISTS leaderboard (
        id INT AUTO_INCREMENT PRIMARY KEY,
        teamName VARCHAR(255) UNIQUE NOT NULL,
        completionTime VARCHAR(255),
        totalTime INT
      )
    `);
    console.log('Database initialized');
  } catch (err) {
    console.error('Error initializing database:', err);
  }
}

initDB();

const ADMIN_PASSWORD = "admin123"; // 🔑 Set your admin password


// Ensure folders
if (!fs.existsSync(path.join(__dirname, 'data'))) fs.mkdirSync(path.join(__dirname, 'data'));
if (!fs.existsSync(path.join(__dirname, 'uploads'))) fs.mkdirSync(path.join(__dirname, 'uploads'));

// multer for image upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const upload = multer({ storage });

// Load questions from database
let questions = {};
async function loadQuestions() {
  try {
    const [rows] = await db.execute('SELECT * FROM questions');
    rows.forEach(row => {
      questions[row.level] = JSON.parse(row.data);
    });
    console.log('Questions loaded from database');
  } catch (err) {
    console.error('Error loading questions:', err);
  }
}

// Save questions to database
async function saveQuestions() {
  try {
    for (const [level, data] of Object.entries(questions)) {
      await db.execute(
        'INSERT INTO questions (level, data) VALUES (?, ?) ON DUPLICATE KEY UPDATE data=?',
        [level, JSON.stringify(data), JSON.stringify(data)]
      );
    }
  } catch (err) {
    console.error('Error saving questions:', err);
  }
}

// Initialize questions if empty
async function initQuestions() {
  const defaultQuestions = {
    "level1":[
      {"image":"/uploads/python.png","options":["Python","Java","C++","JavaScript","Go"],"answer":"Python"},
      {"image":"/uploads/java.png","options":["Python","Java","C++","JavaScript","Go"],"answer":"Java"}
    ],
    "level2":[{"snippet":"console.log('Hello World');","expectedOutput":"Hello World"}],
    "level3":[{"categories":["Frontend","Backend"],"items":["React","Node.js","HTML","Express"],"answer":{"Frontend":["React","HTML"],"Backend":["Node.js","Express"]}}],
    "level4":[{"layers":["Application","Presentation","Session","Transport","Network","Data Link","Physical"],"answer":["Physical","Data Link","Network","Transport","Session","Presentation","Application"]}],
    "level5":[{"puzzle":"/uploads/puzzle1.png","grid":3}]
  };
  if (Object.keys(questions).length === 0) {
    questions = defaultQuestions;
    await saveQuestions();
  }
}

// --- Routes ---
// upload image (admin)
app.post('/upload', upload.single('file'), (req,res)=>{
  if(!req.file) return res.status(400).json({success:false,error:'No file'});
  res.json({success:true,url:'/uploads/'+req.file.filename});
});

app.get('/questions', async (req, res) => {
  try {
    if (Object.keys(questions).length === 0) {
      await loadQuestions();
      await initQuestions();
    }
    res.json(questions);
  } catch (err) {
    res.status(500).json({ error: 'Could not read questions' });
  }
});

app.post('/questions', async (req, res) => {
  try {
    questions = req.body;
    await saveQuestions();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Could not save questions' });
  }
});

app.get('/leaderboard', async (req, res) => {
  try {
    if (leaderboard.length === 0) {
      await loadLeaderboard();
    }
    res.json(leaderboard);
  } catch (err) {
    res.status(500).json({ error: 'Could not load leaderboard' });
  }
});


// ================== ADMIN LOGIN ==================
app.post("/admin-login", (req, res) => {
  const { password } = req.body;
  console.log("🔑 Password received:", password); // Debug

  if (password === ADMIN_PASSWORD) {
    // Generate a simple token (in production, use JWT)
    const token =
      "admin-" +
      Date.now() +
      "-" +
      Math.random().toString(36).substr(2, 9);

    console.log("✅ Admin login success");
    res.json({ success: true, token });
  } else {
    console.log("❌ Admin login failed");
    res
      .status(401)
      .json({ success: false, message: "Invalid password" });
  }
});

// ================== ADMIN AUTH MIDDLEWARE ==================
function requireAdminAuth(req, res, next) {
  const authToken = req.headers.authorization || req.query.token;

  if (!authToken || !authToken.startsWith("admin-")) {
    return res.redirect("/admin-login.html");
  }

  // In production, validate token properly (e.g., JWT)
  next();
}



// protect admin routes

const TEAMS_PATH = path.join(__dirname, 'data', 'teams.json');

// ---- Game state ----
let teams = []; // { id, socketId, name, level, completed: [{level, finishedAt}], joinedAt }
let adminSocketId = null;
let gameRunning = false;
let startTimestamp = null;

// Load teams from database on server start
async function loadTeams() {
  try {
    const [rows] = await db.execute('SELECT * FROM teams');
    teams = rows.map(row => ({
      id: row.id,
      socketId: row.socketId,
      name: row.name,
      level: row.level,
      completed: typeof row.completed === "string" ? JSON.parse(row.completed) : row.completed || [],
      joinedAt: row.joinedAt
    }));
    console.log('Teams loaded from database');
  } catch (err) {
    console.error('Error loading teams:', err);
  }
}

// Save team to database
async function saveTeam(team) {
  try {
    const completedJson = JSON.stringify(team.completed);
    await db.execute(
      'INSERT INTO teams (id, socketId, name, level, completed, joinedAt) VALUES (?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE socketId=?, level=?, completed=?',
      [team.id, team.socketId, team.name, team.level, completedJson, team.joinedAt, team.socketId, team.level, completedJson]
    );
  } catch (err) {
    console.error('Error saving team:', err);
  }
}

// Delete team from database
async function deleteTeamFromDB(id) {
  try {
    await db.execute('DELETE FROM teams WHERE id = ?', [id]);
  } catch (err) {
    console.error('Error deleting team:', err);
  }
}

loadTeams();

// Load leaderboard from database
let leaderboard = [];
async function loadLeaderboard() {
  try {
    const [rows] = await db.execute('SELECT * FROM leaderboard ORDER BY totalTime ASC');
    leaderboard = rows.map(row => ({
      teamName: row.teamName,
      completionTime: row.completionTime,
      totalTime: row.totalTime
    }));
    console.log('Leaderboard loaded from database');
  } catch (err) {
    console.error('Error loading leaderboard:', err);
  }
}

// Save leaderboard entry to database
async function saveLeaderboardEntry(entry) {
  try {
    await db.execute(
      'INSERT INTO leaderboard (teamName, completionTime, totalTime) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE completionTime=?, totalTime=?',
      [entry.teamName, entry.completionTime, entry.totalTime, entry.completionTime, entry.totalTime]
    );
  } catch (err) {
    console.error('Error saving leaderboard entry:', err);
  }
}

loadLeaderboard();



// ---- Socket.io ----
io.on('connection', socket=>{
  console.log('Connected:', socket.id);

  socket.on('registerAdmin', ()=>{
    adminSocketId = socket.id;
    console.log('Admin registered:', adminSocketId);
    sendTeamsToAdmin();
  });

socket.on('joinTeam', async (teamData)=>{
    // Check for gameCode password
    if (teamData.gameCode !== 'chase123') {
      socket.emit('joinError', { message: 'Invalid game code' });
      return;
    }
    let existing = teams.find(t=>t.name === teamData.name);
    if(!existing){
      existing={id:teams.length+1,socketId:socket.id,name:teamData.name||'Team',level:teamData.level || 1,completed:[], joinedAt: Date.now()};
      teams.push(existing);
      await saveTeam(existing);
    } else {
      existing.socketId = socket.id;
      existing.level = Math.max(existing.level, teamData.level || 1);
      await saveTeam(existing);
    }
    sendTeamsToAdmin();
    socket.emit('teamInfo',{name:existing.name,level:existing.level,completed:existing.completed});
  });

  socket.on('getTeamInfo', ()=>{
    const team = teams.find(t=>t.socketId===socket.id);
    if(team) socket.emit('teamInfo',{name:team.name,level:team.level,completed:team.completed});
  });

  socket.on('startGame', ()=>{
    if(socket.id!==adminSocketId) return;
    io.emit('countdown',3);
    setTimeout(()=>io.emit('countdown',2),1000);
    setTimeout(()=>io.emit('countdown',1),2000);
    setTimeout(()=>{
      gameRunning=true;
      startTimestamp=Date.now();
      io.emit('gameStarted',{at:startTimestamp});
    },3000);
  });

  socket.on('stopGame', ()=>{
    if(socket.id!==adminSocketId) return;
    gameRunning=false;
    io.emit('gameStopped');
  });

  socket.on('levelCompleted', async data => {
    const team = teams.find(t => t.socketId === socket.id);
    if (team) {
      const existing = team.completed.find(c => c.level === data.level);
      if (!existing) {
        team.completed.push({
          level: data.level,
          finishedAt: data.finishedAt || Date.now()
        });
      } else if (data.finishedAt) {
        existing.finishedAt = data.finishedAt;
      }
      if (data.level > team.level) {
        team.level = data.level;
      }
      await saveTeam(team);
      sendTeamsToAdmin();
    }
  });

  socket.on('deleteTeam', async id => {
    if (socket.id !== adminSocketId) return;
    teams = teams.filter(t => t.id !== id);
    await deleteTeamFromDB(id);
    sendTeamsToAdmin();
  });

  socket.on('clearLeaderboard', async () => {
    if (socket.id !== adminSocketId) return;
    try {
      // Clear leaderboard
      await db.execute('DELETE FROM leaderboard');
      leaderboard = [];

      // Clear teams
      await db.execute('DELETE FROM teams');
      teams = [];

      io.emit('updateLeaderboard', leaderboard);
      sendTeamsToAdmin();

      // Emit explicit events to request clients to refresh data
      io.emit('requestLeaderboardUpdate');
      io.emit('requestTeamsUpdate');

      console.log('Leaderboard and teams cleared by admin');
    } catch (err) {
      console.error('Error clearing leaderboard and teams:', err);
    }
  });




  socket.on('disconnect', ()=>{
    const team = teams.find(t=>t.socketId===socket.id);
    if(team) team.socketId = null; // Keep team but mark as disconnected
    if(socket.id===adminSocketId) adminSocketId=null;
    sendTeamsToAdmin();
  });
});

// ---- Helpers ----
function sendTeamsToAdmin(){
  if(adminSocketId){
    io.to(adminSocketId).emit('updateTeams',teams.map(t=>({
      id:t.id,
      name:t.name,
      level:t.level,
      completed:t.completed
    })));
  }
}




io.on("connection", socket => {
  socket.on("level5Completed", async data => {
    // Prevent duplicate entries for the same team
    const existing = leaderboard.find(t => t.teamName === data.teamName);
    if (!existing) {
      const entry = {
        teamName: data.teamName,
        completionTime: new Date().toLocaleTimeString(),
        totalTime: data.totalTime
      };
      leaderboard.push(entry);
      await saveLeaderboardEntry(entry);
    }

    // Sort leaderboard by totalTime (ascending)
    leaderboard.sort((a, b) => a.totalTime - b.totalTime);

    // Send update to all clients
    io.emit("updateLeaderboard", leaderboard);
  });
});

// ---- Start server ----
const PORT = process.env.PORT || 3000;
server.listen(PORT, ()=>console.log(`Server running on http://localhost:${PORT}`));
