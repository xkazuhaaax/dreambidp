import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import fs from 'fs';
import pool from '../../config/database.js';

// Import routes
import authRoutes from '../../routes/auth.js';
import userRoutes from '../../routes/user.js';
import activityRoutes from '../../routes/activity.js';
import propertyRoutes from '../../routes/properties.js';
import enquiryRoutes from '../../routes/enquiries.js';
import interestRoutes from '../../routes/interests.js';
import blogRoutes from '../../routes/blogs.js';
import userRegistrationRoutes from '../../routes/user-registrations.js';

// Load environment
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../../.env') });

// Create Express app
const app = express();

// CORS Configuration
const allowedOrigins = [
  process.env.FRONTEND_URL || 'https://dreambidapp.netlify.app',
  'https://dreambidapp.netlify.app',
  'https://dreambid-p.netlify.app',
  'https://dreambid.netlify.app',
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
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Error handling for JSON
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    console.error('JSON parse error:', err);
    return res.status(400).json({ message: 'Invalid JSON in request body' });
  }
  next();
});

// Database initialization flag
let dbInitialized = false;

async function initializeDatabase() {
  if (dbInitialized) return;
  
  try {
    console.log('Testing database connection...');
    await pool.query('SELECT NOW()');
    dbInitialized = true;
    console.log('✅ Database connected');
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    throw error;
  }
}

// Initialize on first request
app.use(async (req, res, next) => {
  try {
    await initializeDatabase();
    next();
  } catch (error) {
    return res.status(500).json({ message: 'Database initialization failed', error: error.message });
  }
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
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    message: 'DreamBid API running on Netlify Functions',
    database: dbInitialized ? 'connected' : 'pending'
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('API Error:', err);
  res.status(500).json({ 
    message: 'Something went wrong!', 
    error: process.env.NODE_ENV === 'development' ? err.message : undefined 
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

// Netlify Functions handler - convert Express to Lambda format
export async function handler(event, context) {
  // Build request
  const method = event.httpMethod || event.requestContext?.http?.method || 'GET';
  const path = event.path || event.rawPath || '/';
  const headers = event.headers || {};
  const body = event.body;
  const isBase64 = event.isBase64Encoded;

  console.log(`${method} ${path}`);

  // Create a mock request object
  const req = {
    method,
    path,
    url: path + (event.queryStringParameters ? '?' + new URLSearchParams(event.queryStringParameters).toString() : ''),
    headers: {
      ...headers,
      'host': headers.host || 'dreambidapp.netlify.app',
    },
    query: event.queryStringParameters || {},
    body: body ? (isBase64 ? Buffer.from(body, 'base64').toString() : body) : undefined,
    rawBody: body,
  };

  // Create a mock response object
  let statusCode = 200;
  let responseHeaders = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS, PATCH',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
  let responseBody = '';

  const res = {
    statusCode,
    headers: responseHeaders,
    body: responseBody,
    status(code) {
      statusCode = code;
      return this;
    },
    json(data) {
      responseBody = JSON.stringify(data);
      responseHeaders['Content-Type'] = 'application/json';
      return this;
    },
    send(data) {
      responseBody = typeof data === 'string' ? data : JSON.stringify(data);
      return this;
    },
    set(key, value) {
      responseHeaders[key] = value;
      return this;
    },
    end() {
      return this;
    },
  };

  try {
    // Handle preflight
    if (method === 'OPTIONS') {
      return {
        statusCode: 200,
        headers: responseHeaders,
        body: '',
      };
    }

    // Route the request through Express
    // This is a simplified router - for complex cases, use serverless-http
    if (path.startsWith('/api/')) {
      // Call Express app as middleware
      await new Promise((resolve, reject) => {
        app(req, res, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      return {
        statusCode,
        headers: responseHeaders,
        body: responseBody || JSON.stringify({ message: 'Route not found' }),
      };
    }

    return {
      statusCode: 404,
      headers: responseHeaders,
      body: JSON.stringify({ message: 'Not found' }),
    };
  } catch (error) {
    console.error('Handler error:', error);
    return {
      statusCode: 500,
      headers: responseHeaders,
      body: JSON.stringify({ 
        message: 'Internal server error',
        error: error.message 
      }),
    };
  }
}
