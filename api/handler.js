import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import fs from 'fs';
import pool from '../config/database.js';
import CleanupService from '../services/CleanupService.js';

// Import routes
import authRoutes from '../routes/auth.js';
import userRoutes from '../routes/user.js';
import activityRoutes from '../routes/activity.js';
import propertyRoutes from '../routes/properties.js';
import enquiryRoutes from '../routes/enquiries.js';
import interestRoutes from '../routes/interests.js';
import blogRoutes from '../routes/blogs.js';
import userRegistrationRoutes from '../routes/user-registrations.js';

// Configuration
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

const app = express();

// CORS Configuration
const allowedOrigins = [
  process.env.FRONTEND_URL || 'https://dreambid-p.vercel.app',
  'https://dreambid-p.vercel.app',
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
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Initialize database on startup
async function initializeDatabase() {
  let retries = 0;
  const maxRetries = 3;
  
  while (retries < maxRetries) {
    try {
      console.log('🔄 Checking/initializing database...');
      
      const tableCheck = await pool.query(
        "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users')"
      );
      
      if (!tableCheck.rows[0].exists) {
        console.log('📝 Creating database tables...');
        const schemaSql = fs.readFileSync(path.join(__dirname, '../database-complete.sql'), 'utf-8');
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
      } else {
        console.log('✅ Database tables already exist');
      }
      
      // Ensure admin user exists
      try {
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
      
      return;
    } catch (error) {
      retries++;
      console.error(`❌ Database initialization error (attempt ${retries}/${maxRetries}):`, error.message);
      
      if (retries < maxRetries) {
        console.log(`⏳ Retrying in 2 seconds...`);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
  }
}

// Initialize on first request
let initialized = false;
app.use(async (req, res, next) => {
  if (!initialized) {
    await initializeDatabase();
    CleanupService.initSchedules();
    initialized = true;
  }
  next();
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/activity', activityRoutes);
app.use('/api/properties', propertyRoutes);
app.use('/api/enquiries', enquiryRoutes);
app.use('/api/interests', interestRoutes);
app.use('/api/blogs', blogRoutes);
app.use('/api/user-registrations', userRegistrationRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

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

export default app;
