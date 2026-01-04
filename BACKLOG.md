# Security & Production Readiness Backlog

**Status:** Pre-Production - Must complete before publishing to Docker Hub

---

## 🔴 CRITICAL Priority (Block Release)

### SEC-1: Add Test Coverage
**Priority:** P0
**Effort:** Large (2-3 weeks)
**Status:** Not Started

**Description:**
Zero test coverage exists for backend or frontend. Untested refactored code poses significant risk.

**Tasks:**
- [ ] Set up Jest testing framework
- [ ] Add integration tests for authentication flows
- [ ] Add unit tests for services (authService, cameraService, pathEventService)
- [ ] Add E2E tests for critical user journeys (login, camera management)
- [ ] Test MQTT message handling with various payloads
- [ ] Test error scenarios and edge cases
- [ ] Achieve minimum 70% coverage for critical paths

**Files Affected:**
- All files in `src/services/`
- All files in `src/routes/`
- All files in `src/middleware/`

**Dependencies:**
```bash
npm install --save-dev jest supertest mongodb-memory-server
```

---

### SEC-2: Fix Dependency Vulnerability (qs package)
**Priority:** P0
**Effort:** Small (30 minutes)
**Status:** Not Started
**CVE:** GHSA-6rw7-vpxm-498p
**CVSS Score:** 7.5 (HIGH)

**Description:**
The `qs` package has a DoS vulnerability via memory exhaustion through arrayLimit bypass.

**Tasks:**
- [ ] Run `npm audit fix --force`
- [ ] Test application after update
- [ ] Verify no breaking changes
- [ ] Update package-lock.json in git

**Command:**
```bash
npm audit fix --force
npm test  # After tests are added
```

---

### SEC-3: Add Input Validation & Sanitization
**Priority:** P0
**Effort:** Medium (3-5 days)
**Status:** Not Started

**Description:**
Missing input validation exposes application to injection attacks and malformed data.

**Tasks:**
- [ ] Install express-validator or joi
- [ ] Add validation to all query parameters in routes/paths.js
- [ ] Add validation to all request bodies in routes/config.js
- [ ] Add validation to camera creation/update in routes/cameras.js
- [ ] Sanitize user inputs to prevent XSS
- [ ] Add schema validation for all POST/PUT endpoints
- [ ] Add error handling for validation failures

**Files to Update:**
- `src/routes/paths.js:25-49` - Query parameter validation
- `src/routes/config.js` - All endpoints
- `src/routes/cameras.js:50-138` - Camera CRUD validation
- `src/routes/auth.js` - Authentication endpoints

**Dependencies:**
```bash
npm install express-validator
```

**Example Implementation:**
```javascript
import { body, query, validationResult } from 'express-validator';

router.get('/', [
  query('serialNumber').optional().isString().trim().escape(),
  query('from').optional().isISO8601(),
  query('to').optional().isISO8601(),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 1000 }),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }
  // ... handler logic
});
```

---

### SEC-4: Add Security Headers (Helmet)
**Priority:** P0
**Effort:** Small (1 hour)
**Status:** Not Started

**Description:**
Missing security headers leave application vulnerable to common web attacks.

**Tasks:**
- [ ] Install helmet package
- [ ] Configure helmet middleware in app.js
- [ ] Configure Content Security Policy
- [ ] Enable HSTS
- [ ] Test headers with security scanner

**Files to Update:**
- `src/app.js:20` - Add helmet middleware

**Dependencies:**
```bash
npm install helmet
```

**Implementation:**
```javascript
import helmet from 'helmet';

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));
```

---

### SEC-5: Add Rate Limiting
**Priority:** P0
**Effort:** Small (2 hours)
**Status:** Not Started

**Description:**
No rate limiting allows brute force attacks on login and API abuse.

**Tasks:**
- [ ] Install express-rate-limit
- [ ] Add rate limiting to login endpoint (5 attempts per 15 min)
- [ ] Add rate limiting to registration endpoint
- [ ] Add general API rate limiting (100 req/15 min)
- [ ] Add rate limiting to password reset (if implemented)
- [ ] Configure rate limit headers
- [ ] Test rate limiting behavior

**Files to Update:**
- `src/routes/auth.js` - Login and registration endpoints
- `src/app.js` - Global rate limiting

**Dependencies:**
```bash
npm install express-rate-limit
```

**Implementation:**
```javascript
import rateLimit from 'express-rate-limit';

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts
  message: 'Too many login attempts, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
});

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many requests, please try again later'
});

router.post('/login', loginLimiter, async (req, res) => { /* ... */ });
app.use('/api', apiLimiter);
```

---

### SEC-6: Encrypt Camera Passwords
**Priority:** P0
**Effort:** Medium (1 day)
**Status:** Not Started

**Description:**
Camera VAPIX passwords stored in plain text in MongoDB. Compromise of database exposes all camera credentials.

**Tasks:**
- [ ] Implement encryption for camera passwords
- [ ] Create encryption/decryption utility functions
- [ ] Update Camera model to encrypt before save
- [ ] Update Camera model to decrypt on read
- [ ] Migrate existing camera passwords
- [ ] Update cameraService to handle encrypted passwords
- [ ] Test VAPIX connections with encrypted passwords

**Files to Update:**
- `src/models/Camera.js:44-46` - Add encryption hooks
- `src/services/cameraService.js` - Handle encryption/decryption
- `src/utils/encryption.js` - New file for crypto utilities

**Implementation Options:**
1. **Node crypto module** (recommended for simplicity)
2. **Environment-based encryption key**
3. **Secrets manager integration** (AWS Secrets Manager, HashiCorp Vault)

**Example (crypto module):**
```javascript
import crypto from 'crypto';

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY; // Must be 32 bytes
const ALGORITHM = 'aes-256-gcm';

export function encrypt(text) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY, 'hex'), iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag();
  return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
}

export function decrypt(text) {
  const parts = text.split(':');
  const iv = Buffer.from(parts[0], 'hex');
  const authTag = Buffer.from(parts[1], 'hex');
  const encrypted = parts[2];
  const decipher = crypto.createDecipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY, 'hex'), iv);
  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}
```

---

## 🟠 HIGH Priority (Before Production)

### SEC-7: Add Request Size Limits
**Priority:** P1
**Effort:** Small (15 minutes)
**Status:** Not Started

**Description:**
No request size limits allow DoS attacks via large JSON payloads.

**Tasks:**
- [ ] Add size limit to express.json() middleware
- [ ] Add size limit to express.urlencoded() middleware
- [ ] Test with oversized payloads
- [ ] Document limits in API docs

**Files to Update:**
- `src/app.js:30`

**Implementation:**
```javascript
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
```

---

### SEC-8: Enforce Password Complexity
**Priority:** P1
**Effort:** Small (2 hours)
**Status:** Not Started

**Description:**
Weak password policy (only 6 characters minimum) allows easily guessable passwords.

**Tasks:**
- [ ] Update User model minimum password length to 8
- [ ] Add password strength validation function
- [ ] Require uppercase, lowercase, and numbers
- [ ] Add password strength indicator to frontend
- [ ] Update password validation in authService
- [ ] Update error messages to guide users
- [ ] Add tests for password validation

**Files to Update:**
- `src/models/User.js:22-26`
- `src/services/authService.js:42` - Add validation before user creation
- `admin-ui/src/components/Setup.jsx` - Add frontend validation
- `admin-ui/src/components/UserManagement.jsx` - Add frontend validation

**Implementation:**
```javascript
function validatePasswordStrength(password) {
  if (password.length < 8) {
    throw new Error('Password must be at least 8 characters long');
  }
  if (!/[A-Z]/.test(password)) {
    throw new Error('Password must contain at least one uppercase letter');
  }
  if (!/[a-z]/.test(password)) {
    throw new Error('Password must contain at least one lowercase letter');
  }
  if (!/\d/.test(password)) {
    throw new Error('Password must contain at least one number');
  }
}
```

---

### SEC-9: Fix CORS Configuration
**Priority:** P1
**Effort:** Small (30 minutes)
**Status:** Not Started

**Description:**
Default CORS configuration uses wildcard (*) which is too permissive for production.

**Tasks:**
- [ ] Update .env.example with strict CORS example
- [ ] Add validation to reject wildcard in production
- [ ] Document CORS configuration in README
- [ ] Add warning if wildcard detected in production

**Files to Update:**
- `.env.example:45` - Update default value
- `src/app.js:22-27` - Add production validation
- `README.md` - Document CORS setup

**Implementation:**
```javascript
// In app.js
if (serverConfig.nodeEnv === 'production' && process.env.CORS_ORIGIN === '*') {
  logger.warn('WARNING: CORS_ORIGIN is set to wildcard (*) in production. This is insecure!');
}
```

---

### SEC-10: Add Missing MongoDB Indexes
**Priority:** P1
**Effort:** Small (1 hour)
**Status:** Not Started

**Description:**
Missing compound indexes for common query patterns will cause slow queries at scale.

**Tasks:**
- [ ] Add time-range query index to PathEvent
- [ ] Add class-based filtering index to PathEvent
- [ ] Test query performance with indexes
- [ ] Document index strategy

**Files to Update:**
- `src/models/PathEvent.js:120-123` - Add compound indexes

**Implementation:**
```javascript
// For time-range queries with serialNumber
pathEventSchema.index({ timestamp: -1, serialNumber: 1 });

// For class-based filtering with time sorting
pathEventSchema.index({ class: 1, serialNumber: 1, timestamp: -1 });

// For birth-time range queries
pathEventSchema.index({ birth: -1, serialNumber: 1 });
```

---

### SEC-11: Comprehensive Environment Validation
**Priority:** P1
**Effort:** Small (2 hours)
**Status:** Not Started

**Description:**
Only PORT and JWT_SECRET are validated. Missing validation for other critical config.

**Tasks:**
- [ ] Add production environment validation function
- [ ] Validate all required env vars in production
- [ ] Reject default JWT_SECRET in production
- [ ] Validate MongoDB connection string format
- [ ] Validate MQTT broker URL format
- [ ] Add startup check that fails fast if config invalid

**Files to Update:**
- `src/config/index.js:19` - Add comprehensive validation
- `src/server.js` - Call validation before startup

**Implementation:**
```javascript
function validateProductionEnv() {
  if (process.env.NODE_ENV === 'production') {
    const required = ['PORT', 'JWT_SECRET', 'MONGODB_URI', 'MQTT_BROKER_URL'];
    const missing = required.filter(key => !process.env[key]);

    if (missing.length > 0) {
      throw new Error(`Missing required production env vars: ${missing.join(', ')}`);
    }

    if (process.env.JWT_SECRET === 'your-super-secret-jwt-key-change-in-production') {
      throw new Error('JWT_SECRET must be changed from default value in production!');
    }

    if (process.env.CORS_ORIGIN === '*') {
      logger.warn('CORS_ORIGIN set to wildcard in production - this is insecure!');
    }
  }
}

// Call in config/index.js
validateProductionEnv();
```

---

### SEC-12: Prevent Stack Trace Leakage
**Priority:** P1
**Effort:** Small (15 minutes)
**Status:** Not Started

**Description:**
Ensure NODE_ENV=production is always set in production deployments.

**Tasks:**
- [ ] Add validation in Dockerfile
- [ ] Add validation in docker-compose.yml
- [ ] Document NODE_ENV requirement in README
- [ ] Add startup check

**Files to Update:**
- `docker/Dockerfile` - Ensure NODE_ENV is set
- `docker/docker-compose.yml` - Verify production mode
- `README.md` - Document requirement

---

## 🟡 MEDIUM Priority (Post-Launch Improvements)

### SEC-13: Enhanced Health Checks
**Priority:** P2
**Effort:** Small (2 hours)
**Status:** Not Started

**Description:**
Current health check doesn't verify MongoDB/MQTT connectivity.

**Tasks:**
- [ ] Create comprehensive health check endpoint
- [ ] Include MongoDB connection status
- [ ] Include MQTT connection status
- [ ] Include disk space check
- [ ] Include memory usage check
- [ ] Return 503 if critical services down
- [ ] Add health check to monitoring

**Files to Create:**
- `src/routes/health.js` - New comprehensive health endpoint

**Implementation:**
```javascript
router.get('/health', async (req, res) => {
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    services: {
      mongodb: isDBConnected() ? 'connected' : 'disconnected',
      mqtt: isConnectedToMQTT() ? 'connected' : 'disconnected'
    },
    memory: {
      used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024)
    }
  };

  const isHealthy = health.services.mongodb === 'connected';
  const statusCode = isHealthy ? 200 : 503;

  res.status(statusCode).json(health);
});
```

---

### SEC-14: MQTT Reconnection Improvements
**Priority:** P2
**Effort:** Medium (3 hours)
**Status:** Not Started

**Description:**
MQTT has infinite reconnection attempts. Should have exponential backoff and max retries.

**Tasks:**
- [ ] Add exponential backoff to reconnection
- [ ] Add maximum retry limit
- [ ] Add reconnection state tracking
- [ ] Log reconnection attempts
- [ ] Alert on persistent failures
- [ ] Add manual reconnect API endpoint

**Files to Update:**
- `src/mqtt/client.js:93-94` - Add backoff logic

**Implementation:**
```javascript
let reconnectAttempts = 0;
const maxReconnectAttempts = 10;

const options = {
  reconnectPeriod: Math.min(1000 * Math.pow(2, reconnectAttempts), 30000),
  // ... other options
};

client.on('reconnect', () => {
  reconnectAttempts++;
  logger.info(`MQTT reconnection attempt ${reconnectAttempts}/${maxReconnectAttempts}`);

  if (reconnectAttempts > maxReconnectAttempts) {
    client.end();
    logger.error('Max MQTT reconnect attempts reached. Manual intervention required.');
  }
});

client.on('connect', () => {
  reconnectAttempts = 0; // Reset on successful connection
  // ...
});
```

---

### SEC-15: Graceful Shutdown for MQTT
**Priority:** P2
**Effort:** Small (1 hour)
**Status:** Not Started

**Description:**
Shutdown handler doesn't disconnect MQTT client cleanly.

**Tasks:**
- [ ] Add MQTT disconnect to shutdown handler
- [ ] Add MongoDB disconnect to shutdown handler
- [ ] Wait for connections to close before exit
- [ ] Add timeout for shutdown
- [ ] Test graceful shutdown

**Files to Update:**
- `src/server.js:90-98` - Enhanced shutdown handler

**Implementation:**
```javascript
const shutdown = async (signal) => {
  logger.info(`Received ${signal}, shutting down gracefully`);

  // Set timeout for forced shutdown
  const forceShutdownTimeout = setTimeout(() => {
    logger.error('Forced shutdown due to timeout');
    process.exit(1);
  }, 30000); // 30 seconds

  try {
    // Disconnect MQTT
    await disconnectMQTT();
    logger.info('MQTT disconnected');

    // Close HTTP server
    await new Promise((resolve) => {
      server.close(() => {
        logger.info('HTTP server closed');
        resolve();
      });
    });

    // Close MongoDB
    await disconnectDB();
    logger.info('MongoDB disconnected');

    clearTimeout(forceShutdownTimeout);
    process.exit(0);
  } catch (error) {
    logger.error('Error during shutdown', { error: error.message });
    process.exit(1);
  }
};
```

---

### SEC-16: Production Logging Enhancement
**Priority:** P2
**Effort:** Medium (1 day)
**Status:** Not Started

**Description:**
Current logging likely uses console.log. Need structured logging for production.

**Tasks:**
- [ ] Install winston or pino
- [ ] Configure log levels (error, warn, info, debug)
- [ ] Add file logging with rotation
- [ ] Add JSON structured logging
- [ ] Add correlation IDs to requests
- [ ] Configure log aggregation integration
- [ ] Remove console.log statements

**Files to Update:**
- `src/utils/logger.js` - Enhance logging implementation
- All files using logger

**Dependencies:**
```bash
npm install winston winston-daily-rotate-file
```

**Implementation:**
```javascript
import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new DailyRotateFile({
      filename: 'logs/error-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      level: 'error',
      maxSize: '20m',
      maxFiles: '14d'
    }),
    new DailyRotateFile({
      filename: 'logs/combined-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '14d'
    })
  ]
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    )
  }));
}
```

---

### SEC-17: API Documentation
**Priority:** P2
**Effort:** Medium (2 days)
**Status:** Not Started

**Description:**
No OpenAPI/Swagger documentation for API endpoints.

**Tasks:**
- [ ] Install swagger-jsdoc and swagger-ui-express
- [ ] Add Swagger annotations to routes
- [ ] Configure Swagger UI endpoint
- [ ] Document all endpoints
- [ ] Document request/response schemas
- [ ] Add authentication documentation
- [ ] Generate Postman collection

**Dependencies:**
```bash
npm install swagger-jsdoc swagger-ui-express
```

---

### SEC-18: MongoDB Connection Pooling
**Priority:** P2
**Effort:** Small (1 hour)
**Status:** Not Started

**Description:**
MongoDB connection options not optimized for production.

**Tasks:**
- [ ] Configure connection pool size
- [ ] Configure timeouts
- [ ] Configure retry logic
- [ ] Test connection pool behavior
- [ ] Monitor connection pool metrics

**Files to Update:**
- `src/config/index.js:58` - Add connection options

**Implementation:**
```javascript
options: {
  maxPoolSize: 10,
  minPoolSize: 2,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
  family: 4, // Use IPv4
  retryWrites: true,
  retryReads: true
}
```

---

## 🟢 LOW Priority (Future Enhancements)

### SEC-19: Frontend Build Optimization
**Priority:** P3
**Effort:** Small (2 hours)
**Status:** Not Started

**Tasks:**
- [ ] Review Vite build configuration
- [ ] Enable code splitting
- [ ] Configure source maps for production
- [ ] Add bundle size analysis
- [ ] Optimize asset loading

---

### SEC-20: CSRF Protection
**Priority:** P3
**Effort:** Small (2 hours)
**Status:** Not Started

**Note:** May not be necessary with JWT (no cookies), but consider for additional security layer.

**Tasks:**
- [ ] Evaluate need for CSRF protection
- [ ] Implement if using session cookies
- [ ] Add CSRF token to forms
- [ ] Test CSRF protection

---

### SEC-21: Enhanced Request Logging
**Priority:** P3
**Effort:** Small (1 hour)
**Status:** Not Started

**Description:**
Morgan logging only in development. Should log in production with appropriate format.

**Tasks:**
- [ ] Enable morgan in production with 'combined' format
- [ ] Configure log file for access logs
- [ ] Add request correlation IDs
- [ ] Exclude health check from logs

**Files to Update:**
- `src/app.js:34-36`

**Implementation:**
```javascript
if (serverConfig.isDevelopment) {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined', {
    stream: fs.createWriteStream(path.join(__dirname, '../logs/access.log'), { flags: 'a' }),
    skip: (req) => req.url === '/api/health'
  }));
}
```

---

## 📊 Release Criteria

Before publishing to Docker Hub, all items must be completed:

### Required for v1.0.0 Release:
- [ ] All CRITICAL (P0) issues resolved
- [ ] All HIGH (P1) issues resolved
- [ ] Test coverage ≥70% for critical paths
- [ ] Security audit passed
- [ ] Documentation complete (README, API docs, deployment guide)
- [ ] Load testing completed
- [ ] Monitoring configured
- [ ] Backup strategy documented

### Nice to Have for v1.0.0:
- [ ] MEDIUM (P2) issues completed
- [ ] Test coverage ≥80%
- [ ] Performance benchmarks documented

---

## 📝 Notes

- Security issues identified during production readiness review on 2026-01-01
- Waiting for security fixes before publishing to Docker Hub
- Docker Hub publication planned for post-security-hardening
- Test coverage is the highest priority and blocks all other work

---

## 🔗 Related Documents

- [README.md](README.md) - Project overview and setup instructions
- [.env.example](.env.example) - Environment configuration template
- [docker/README.md](docker/README.md) - Docker deployment guide (to be created)
