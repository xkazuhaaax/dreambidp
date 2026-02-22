import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import fs from 'fs';
import pool from './config/database.js';
import CleanupService from './services/CleanupService.js';

// Import routes
import authRoutes from './routes/auth.js';
import userRoutes from './routes/user.js';
import activityRoutes from './routes/activity.js';
import propertyRoutes from './routes/properties.js';
import enquiryRoutes from './routes/enquiries.js';
import interestRoutes from './routes/interests.js';

// Configuration
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// CORS Configuration
const allowedOrigins = [
  process.env.FRONTEND_URL || 'https://dreambid-p.netlify.app',
  'https://dreambid-p.netlify.app',
  'https://dreambid.netlify.app',
  'https://dreambid-new.netlify.app',
  'http://localhost:3000',
  'http://localhost:5173',
  'http://localhost:5174',
];

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: ['Content-Range', 'X-Content-Range']
};

// Middleware
app.use(helmet());
app.use(cors(corsOptions));

// Additional CORS headers middleware
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.header('Access-Control-Expose-Headers', 'Content-Range, X-Content-Range');
  }
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Error handling middleware for JSON parsing
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    console.error('JSON parse error:', err);
    return res.status(400).json({ message: 'Invalid JSON in request body' });
  }
  next();
});

// Static files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Run migrations
async function runMigrations() {
  try {
    const migrationPath = path.join(__dirname, 'migrations_add_property_fields.sql');
    
    // Check if migration file exists
    if (!fs.existsSync(migrationPath)) {
      console.log('ℹ️  No pending migrations');
      return;
    }
    
    console.log('🔄 Running migrations...');
    const migrationSql = fs.readFileSync(migrationPath, 'utf-8');
    
    // Execute entire migration as one transaction for idempotency
    try {
      await pool.query(migrationSql);
      console.log('✅ Migrations completed successfully');
    } catch (err) {
      // Log but don't fail - migrations are idempotent
      console.log('ℹ️  Migration notice:', err.message.split('\n')[0]);
    }
  } catch (error) {
    console.error('⚠️  Migration error:', error.message);
    // Don't fail startup on migration errors
  }
}

// Initialize database on startup
async function initializeDatabase() {
  let retries = 0;
  const maxRetries = 3;
  
  while (retries < maxRetries) {
    try {
      console.log('🔄 Checking/initializing database...');
      
      // Check if users table exists
      const tableCheck = await pool.query(
        "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users')"
      );
      
      if (!tableCheck.rows[0].exists) {
        console.log('📝 Creating database tables...');
        
        // Read and execute schema - handle it as a single transaction
        const schemaSql = fs.readFileSync(path.join(__dirname, 'setup-database.sql'), 'utf-8');
        const schemaStatements = schemaSql
          .split(';')
          .map(stmt => stmt.trim())
          .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
        
        for (const statement of schemaStatements) {
          try {
            await pool.query(statement);
          } catch (err) {
            if (!err.message.includes('already exists') && !err.message.includes('duplicate key')) {
              throw err;
            }
          }
        }
        console.log('✅ Schema created');
        
        // Read and execute seed data
        console.log('📝 Seeding database with sample properties...');
        const seedSql = fs.readFileSync(path.join(__dirname, 'seed-properties.sql'), 'utf-8');
        const seedStatements = seedSql
          .split(';')
          .map(stmt => stmt.trim())
          .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
        
        let seedSuccess = 0;
        let seedSkipped = 0;
        
        for (const statement of seedStatements) {
          try {
            await pool.query(statement);
            seedSuccess++;
          } catch (err) {
            // Ignore duplicate key errors (already seeded)
            if (err.message.includes('duplicate key') || err.message.includes('already exists')) {
              seedSkipped++;
            } else {
              console.warn('⚠️  Seed warning:', err.message.split('\n')[0]);
            }
          }
        }
        console.log(`✅ Seed data completed: ${seedSuccess} inserted, ${seedSkipped} skipped`);
      } else {
        console.log('✅ Database tables already exist');
        
        // Check if properties exist and seed if empty
        const propertiesCheck = await pool.query('SELECT COUNT(*) FROM properties');
        const propertyCount = parseInt(propertiesCheck.rows[0].count);
        
        if (propertyCount === 0) {
          console.log('📝 No properties found. Seeding database...');
          const seedSql = fs.readFileSync(path.join(__dirname, 'seed-properties.sql'), 'utf-8');
          const seedStatements = seedSql
            .split(';')
            .map(stmt => stmt.trim())
            .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
          
          let seedSuccess = 0;
          let seedSkipped = 0;
          
          for (const statement of seedStatements) {
            try {
              await pool.query(statement);
              seedSuccess++;
            } catch (err) {
              if (err.message.includes('duplicate key') || err.message.includes('already exists')) {
                seedSkipped++;
              } else {
                console.warn('⚠️  Seed warning:', err.message.split('\n')[0]);
              }
            }
          }
          console.log(`✅ Seed data completed: ${seedSuccess} inserted, ${seedSkipped} skipped`);
        } else {
          console.log(`✅ Database has ${propertyCount} properties`);
        }
        
        // Check if user_activity table exists and create if missing
        const userActivityCheck = await pool.query(
          "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_activity')"
        );
        
        if (!userActivityCheck.rows[0].exists) {
          console.log('📝 Creating user_activity table (missing from existing database)...');
          
          await pool.query(`
            CREATE TABLE user_activity (
              id SERIAL PRIMARY KEY,
              user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
              action VARCHAR(100) NOT NULL,
              action_category VARCHAR(50),
              data JSONB DEFAULT NULL,
              ip_address VARCHAR(45),
              user_agent TEXT,
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            
            CREATE INDEX idx_user_activity_user_id ON user_activity(user_id);
            CREATE INDEX idx_user_activity_created_at ON user_activity(created_at);
            CREATE INDEX idx_user_activity_action ON user_activity(action);
            CREATE INDEX idx_user_activity_user_date ON user_activity(user_id, created_at DESC);
          `);
          console.log('✅ user_activity table created');
        }
      }
      
      // Ensure admin user exists with correct hashed password
      try {
        // Bcrypt hash for password 'admin123'
        const adminPasswordHash = '$2a$10$.BuPpcfY36q7Uypbus.9/eCszDXNNj0nPgAn9qHVrITIkN9qX3H5a';
        await pool.query(
          `INSERT INTO users (email, password_hash, full_name, role, is_active)
           VALUES ('admin@dreambid.com', $1, 'Admin User', 'admin', true)
           ON CONFLICT (email) DO UPDATE SET password_hash = $1`
        , [adminPasswordHash]);
        console.log('✅ Admin user verified');
      } catch (err) {
        console.log('ℹ️  Admin user setup:', err.message.split('\n')[0]);
      }
      
      return; // Success - exit function
    } catch (error) {
      retries++;
      console.error(`❌ Database initialization error (attempt ${retries}/${maxRetries}):`, error.message);
      
      if (retries < maxRetries) {
        console.log(`⏳ Retrying in 2 seconds...`);
        await new Promise(resolve => setTimeout(resolve, 2000));
      } else {
        console.error('⚠️  Max retries reached. Continuing with startup...');
      }
    }
  }
}

// Initialize database before starting server
await initializeDatabase();

// Run migrations after database initialization
await runMigrations();

// Initialize cleanup service (scheduled jobs)
CleanupService.initSchedules();

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/activity', activityRoutes);
app.use('/api/properties', propertyRoutes);
app.use('/api/enquiries', enquiryRoutes);
app.use('/api/interests', interestRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, 'dist')));
  
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
  });
}

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    message: 'Something went wrong!', 
    error: process.env.NODE_ENV === 'development' ? err.message : undefined 
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

app.listen(PORT, () => {
  console.log(`🚀 DreamBid Unified Server running on port ${PORT}`);
  console.log(`📱 Environment: ${process.env.NODE_ENV || 'development'}`);
});

export default app;