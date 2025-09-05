const { Sequelize } = require('sequelize');
require('dotenv').config();

// PostgreSQL connection using Sequelize
const sequelize = new Sequelize(process.env.DATABASE_URL, {
  dialect: 'postgres',
  logging: false,
  dialectOptions: {
    ssl: {
      require: true,
      rejectUnauthorized: false // allow self-signed certs
    }
  },
  pool: {
    max: 5,
    min: 0,
    acquire: 30000,
    idle: 10000
  }
});


// Define Sequelize models
const Team = sequelize.define('Team', {
  id: {
    type: Sequelize.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  socketId: {
    type: Sequelize.STRING,
    allowNull: true
  },
  name: {
    type: Sequelize.STRING,
    allowNull: false,
    unique: true
  },
  level: {
    type: Sequelize.INTEGER,
    defaultValue: 1
  },
  completed: {
    type: Sequelize.JSON,
    defaultValue: []
  },
  joinedAt: {
    type: Sequelize.BIGINT,
    allowNull: false
  }
});

const Question = sequelize.define('Question', {
  level: {
    type: Sequelize.STRING(10),
    primaryKey: true
  },
  data: {
    type: Sequelize.JSON,
    allowNull: false
  }
});

const Leaderboard = sequelize.define('Leaderboard', {
  id: {
    type: Sequelize.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  teamName: {
    type: Sequelize.STRING,
    allowNull: false,
    unique: true
  },
  completionTime: {
    type: Sequelize.STRING,
    allowNull: false
  },
  totalTime: {
    type: Sequelize.INTEGER,
    allowNull: false
  }
});

// Initialize database
async function setupDatabase() {
  try {
    await sequelize.authenticate();
    console.log('✅ Database connection established successfully');

    await sequelize.sync({ force: true }); // Force recreate tables
    console.log('✅ Database tables created successfully');

    // Insert default questions
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

    for (const [level, data] of Object.entries(defaultQuestions)) {
      await Question.create({
        level: level,
        data: data
      });
    }
    console.log('✅ Default questions inserted successfully');

    process.exit(0);
  } catch (err) {
    console.error('❌ Error setting up database:', err);
    process.exit(1);
  }
}

setupDatabase();
