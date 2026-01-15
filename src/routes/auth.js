import express from 'express';
import bcrypt from 'bcrypt';
import { authConfig } from '../config/index.js';
import { User } from '../models/index.js';
import * as authService from '../services/authService.js';
import logger from '../utils/logger.js';

const router = express.Router();

/**
 * POST /api/auth/login
 * Simple password verification for admin UI
 */
router.post('/login', (req, res) => {
  const { password } = req.body;

  if (!password) {
    return res.status(400).json({
      success: false,
      error: 'Password is required',
    });
  }

  // Check against ADMIN_PASSWORD in .env
  if (!authConfig.adminPassword) {
    return res.status(500).json({
      success: false,
      error: 'ADMIN_PASSWORD not configured in .env',
    });
  }

  if (password === authConfig.adminPassword) {
    return res.json({
      success: true,
      data: { authenticated: true },
    });
  }

  return res.status(401).json({
    success: false,
    error: 'Invalid password',
  });
});

/**
 * POST /api/auth/client-login
 * JWT login for client applications
 */
router.post('/client-login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        error: 'Username and password are required',
      });
    }

    // Find user
    const user = await User.findOne({
      $or: [{ username }, { email: username }],
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials',
      });
    }

    if (!user.enabled) {
      return res.status(403).json({
        success: false,
        error: 'Account is disabled',
      });
    }

    // Verify password
    const isValid = await user.comparePassword(password);
    if (!isValid) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials',
      });
    }

    // Generate JWT token
    const token = authService.generateToken(user);

    res.json({
      success: true,
      data: {
        user: user.toSafeObject(),
        token,
      },
    });
  } catch (error) {
    logger.error('Client login failed', { error: error.message });
    res.status(500).json({ success: false, error: 'Login failed' });
  }
});

/**
 * GET /api/auth/users
 * Get all users
 */
router.get('/users', async (req, res) => {
  try {
    const users = await User.find().select('-password').sort({ createdAt: -1 }).lean();
    res.json({ success: true, data: users });
  } catch (error) {
    logger.error('Failed to get users', { error: error.message });
    res.status(500).json({ success: false, error: 'Failed to get users' });
  }
});

/**
 * POST /api/auth/users
 * Create a new user
 */
router.post('/users', async (req, res) => {
  try {
    const { username, email, password, role, authorizedCameras } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Username, email, and password are required',
      });
    }

    // Check if user exists
    const existing = await User.findOne({
      $or: [{ username }, { email }],
    });

    if (existing) {
      return res.status(400).json({
        success: false,
        error: existing.username === username ? 'Username already exists' : 'Email already exists',
      });
    }

    const user = new User({
      username,
      email,
      password,
      role: role || 'user',
      authorizedCameras: authorizedCameras || [],
    });

    await user.save();

    logger.info('User created', { username, role: user.role });

    res.status(201).json({
      success: true,
      data: user.toSafeObject(),
    });
  } catch (error) {
    logger.error('Failed to create user', { error: error.message });
    res.status(500).json({ success: false, error: 'Failed to create user' });
  }
});

/**
 * PUT /api/auth/users/:id
 * Update a user
 */
router.put('/users/:id', async (req, res) => {
  try {
    const { email, role, enabled, authorizedCameras, password } = req.body;

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    if (email) user.email = email;
    if (role) user.role = role;
    if (enabled !== undefined) user.enabled = enabled;
    if (authorizedCameras) user.authorizedCameras = authorizedCameras;
    if (password) user.password = password;

    await user.save();

    logger.info('User updated', { userId: req.params.id });

    res.json({
      success: true,
      data: user.toSafeObject(),
    });
  } catch (error) {
    logger.error('Failed to update user', { error: error.message });
    res.status(500).json({ success: false, error: 'Failed to update user' });
  }
});

/**
 * DELETE /api/auth/users/:id
 * Delete a user
 */
router.delete('/users/:id', async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    logger.info('User deleted', { userId: req.params.id, username: user.username });

    res.json({ success: true, message: 'User deleted' });
  } catch (error) {
    logger.error('Failed to delete user', { error: error.message });
    res.status(500).json({ success: false, error: 'Failed to delete user' });
  }
});

export default router;
