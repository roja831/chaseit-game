// server.js
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const cors = require("cors");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const PUBLIC = path.join(__dirname, 'public');
app.use(express.static(PUBLIC));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));



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

// Questions file path
const QUESTIONS_PATH = path.join(__dirname, 'data', 'questions.json');
if (!fs.existsSync(QUESTIONS_PATH)) {
  fs.writeFileSync(QUESTIONS_PATH, JSON.stringify({
    "level1":[
      {"image":"/uploads/python.png","options":["Python","Java","C++","JavaScript","Go"],"answer":"Python"},
      {"image":"/uploads/java.png","options":["Python","Java","C++","JavaScript","Go"],"answer":"Java"}
    ],
    "level2":[{"snippet":"console.log('Hello World');","expectedOutput":"Hello World"}],
    "level3":[{"categories":["Frontend","Backend"],"items":["React","Node.js","HTML","Express"],"answer":{"Frontend":["React","HTML"],"Backend":["Node.js","Express"]}}],
    "level4":[{"layers":["Application","Presentation","Session","Transport","Network","Data Link","Physical"],"answer":["Physical","Data Link","Network","Transport","Session","Presentation","Application"]}],
    "level5":[{"puzzle":"/uploads/puzzle1.png","grid":3}]
  }, null, 2));
}

// --- Routes ---
// upload image (admin)
app.post('/upload', upload.single('file'), (req,res)=>{
  if(!req.file) return res.status(400).json({success:false,error:'No file'});
  res.json({success:true,url:'/uploads/'+req.file.filename});
});

// get questions
app.get('/questions', (req,res)=>{
  try {
    const q = JSON.parse(fs.readFileSync(QUESTIONS_PATH));
    res.json(q);
  } catch(err) {
    res.status(500).json({error:'Could not read questions'});
  }
});

// save questions (admin)
app.post('/questions', (req,res)=>{
  try {
    fs.writeFileSync(QUESTIONS_PATH, JSON.stringify(req.body,null,2));
    res.json({success:true});
  } catch(err) {
    res.status(500).json({error:'Could not save questions'});
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

// middleware to check admin authentication
function requireAdminAuth(req, res, next) {
  const authToken = req.headers.authorization || req.query.token;

  if (!authToken || !authToken.startsWith('admin-')) {
    return res.redirect('/admin-login.html');
  }

  // In production, validate the token properly
  next();
}



// protect admin routes

const TEAMS_PATH = path.join(__dirname, 'data', 'teams.json');

// ---- Game state ----
let teams = []; // { id, socketId, name, level, completed: [{level, finishedAt}], joinedAt }
let adminSocketId = null;
let gameRunning = false;
let startTimestamp = null;

// Load teams from JSON file on server start
function loadTeams() {
  try {
    if (fs.existsSync(TEAMS_PATH)) {
      const data = fs.readFileSync(TEAMS_PATH, 'utf-8');
      teams = JSON.parse(data);
    }
  } catch (err) {
    console.error('Error loading teams:', err);
  }
}

// Save teams to JSON file
function saveTeams() {
  try {
    fs.writeFileSync(TEAMS_PATH, JSON.stringify(teams, null, 2));
  } catch (err) {
    console.error('Error saving teams:', err);
  }
}

loadTeams();



// ---- Socket.io ----
io.on('connection', socket=>{
  console.log('Connected:', socket.id);

  socket.on('registerAdmin', ()=>{
    adminSocketId = socket.id;
    console.log('Admin registered:', adminSocketId);
    sendTeamsToAdmin();
  });

socket.on('joinTeam', (teamData)=>{
    let existing = teams.find(t=>t.name === teamData.name);
    if(!existing){
      existing={id:teams.length+1,socketId:socket.id,name:teamData.name||'Team',level:teamData.level || 1,completed:[], joinedAt: new Date().toISOString()};
      teams.push(existing);
      saveTeams();
    } else {
      existing.socketId = socket.id;
      existing.level = Math.max(existing.level, teamData.level || 1);
      saveTeams();
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

  socket.on('levelCompleted', data => {
    const team = teams.find(t => t.socketId === socket.id);
    if (team) {
      const existing = team.completed.find(c => c.level === data.level);
      if (!existing) {
        team.completed.push({
          level: data.level,
          finishedAt: data.finishedAt || new Date().toISOString()
        });
      } else if (data.finishedAt) {
        existing.finishedAt = data.finishedAt;
      }
      if (data.level > team.level) {
        team.level = data.level;
      }
      saveTeams();
      sendTeamsToAdmin();
    }
  });

  socket.on('deleteTeam', id => {
    if (socket.id !== adminSocketId) return;
    teams = teams.filter(t => t.id !== id);
    saveTeams();
    sendTeamsToAdmin();
  });




  socket.on('disconnect', ()=>{
    const team = teams.find(t=>t.socketId===socket.id);
    if(team) team.socketId = null; // Keep team but mark as disconnected
    if(socket.id===adminSocketId) adminSocketId=null;
    saveTeams();
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




let leaderboard = [];

io.on("connection", socket => {
  socket.on("level5Completed", data => {
    // Prevent duplicate entries for the same team
    const existing = leaderboard.find(t => t.teamName === data.teamName);
    if (!existing) {
      leaderboard.push({
        teamName: data.teamName,
        completionTime: new Date().toLocaleTimeString(),
        totalTime: data.totalTime
      });
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
