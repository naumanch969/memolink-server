import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import morgan from 'morgan';
import dotenv from 'dotenv';

import authRoutes from './features/auth/auth.routes';
import personRoutes from './features/person/person.routes';
import entryRoutes from './features/entry/entry.routes';
import mediaRoutes from './features/media/media.routes';
import categoryRoutes from './features/category/category.routes';

import { ENV } from './config/environment';

dotenv.config();

const app = express();

app.use(helmet());

app.use(cors({ origin: ENV.CORS_ORIGIN || 'http://localhost:3000', credentials: true, }));

app.use(compression());

// const limiter = rateLimit({
//   windowMs: Number(ENV.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
//   max: Number(ENV.RATE_LIMIT_MAX_REQUESTS) || 100, // limit each IP to 100 requests per windowMs
//   message: {
//     success: false,
//     error: 'Too many requests from this IP, please try again later.',
//   },
// });
// app.use('/api/', limiter);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use(morgan('combined'));

app.get('/health', (req, res) => {
  res.json({ success: true, message: 'MemoLink Server is running', timestamp: new Date().toISOString(), environment: ENV.NODE_ENV || 'development', });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/entries', entryRoutes);
app.use('/api/people', personRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/media', mediaRoutes);

app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route not found',
  });
});

app.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Global error handler:', error);

  res.status(error.status || 500).json({
    success: false,
    error: error.message || 'Internal server error',
  });
});

export default app;
