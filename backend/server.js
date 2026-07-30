const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { Server } = require('socket.io');
const config = require('./config');
const { connectDatabase, mongoose, seedSettings } = require('./database/models');
const { errorHandler, notFoundHandler } = require('./src/middleware');

const taskRoutes = require('./modules/tasks/routes/task.routes');
const ruleRoutes = require('./modules/rules/routes/rule.routes');
const dashboardRoutes = require('./modules/dashboard/routes/dashboard.routes');
const recoveryRoutes = require('./modules/recovery/routes/recovery.routes');
const taskGeneratorRoutes = require('./modules/tasks/generator/task-generator.routes');
const authRoutes = require('./modules/auth/routes/auth.routes');
const callLogRoutes = require('./modules/call-logs/routes/call-logs.routes');
const commerceRoutes = require('./modules/commerce/routes/commerce.routes');
const adminRoutes = require('./modules/admin/routes/admin.routes');
const settingsRoutes = require('./modules/settings/routes/settings.routes');
const { apiLimiter, authLimiter, internalLimiter } = require('./src/middleware/rateLimiter');

const app = express();

app.use(helmet());
const corsOrigin = process.env.CORS_ORIGIN || false;

app.use(cors({
  origin: corsOrigin,
  credentials: true,
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

if (config.nodeEnv !== 'test') {
  app.use(morgan('dev'));
}

app.use('/api/v1/auth', authLimiter, authRoutes);
app.use('/api/v1/tasks', apiLimiter, taskRoutes);
app.use('/api/v1/rules', apiLimiter, ruleRoutes);
app.use('/api/v1/dashboard', apiLimiter, dashboardRoutes);
app.use('/api/v1/recovery', apiLimiter, recoveryRoutes);
app.use('/api/v1/call-logs', apiLimiter, callLogRoutes);
app.use('/api/v1/commerce', commerceRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/settings', apiLimiter, settingsRoutes);
app.use('/api/v1/internal/task-generator', internalLimiter, taskGeneratorRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

const frontendDist = path.join(__dirname, '..', 'frontend', 'dist');
app.use(express.static(frontendDist));
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api') && !req.path.startsWith('/health')) {
    res.sendFile(path.join(frontendDist, 'index.html'));
  }
});

app.use(notFoundHandler);
app.use(errorHandler);

const startServer = async () => {
  try {
    await connectDatabase(config.mongoUri);
    await seedSettings();
    console.log('Follow-up engine ready');

    const PORT = config.port;
    const httpServer = app.listen(PORT, () => {
      console.log(`Follow-up Task Engine running on port ${PORT}`);
      console.log(`Environment: ${config.nodeEnv}`);
      console.log(`Health check: http://localhost:${PORT}/health`);
    });

    const io = new Server(httpServer, {
      cors: {
        origin: corsOrigin || false,
      },
    });

    io.on('connection', (socket) => {
      console.log(`Socket connected: ${socket.id}`);

      socket.on('join-task-room', (taskId) => {
        socket.join(`task-${taskId}`);
      });

      socket.on('disconnect', () => {
        console.log(`Socket disconnected: ${socket.id}`);
      });
    });

    global.io = io;

    const { scheduler } = require('./modules/schedule/scheduler');
    scheduler.start();

    return { app, server: httpServer, io };
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

module.exports = { app, startServer };

if (require.main === module) {
  startServer().then(({ server }) => {
    const shutdown = async (signal) => {
      console.log(`${signal} received, shutting down gracefully`);
      server.close(async () => {
        await mongoose.disconnect().catch(() => {});
        process.exit(0);
      });
      setTimeout(() => process.exit(1), 30000);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  }).catch((error) => {
    console.error('Failed to start server:', error);
    process.exit(1);
  });
}