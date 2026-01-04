import express from 'express';
import * as authService from '../services/authService.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import logger from '../utils/logger.js';

const router = express.Router();

/**
 * POST /api/auth/setup-check
 * Check if initial setup is required
 */
router.get('/setup-check', async (req, res) => {
  try {
    const hasUsers = await authService.hasUsers();
    res.json({
      success: true,
      data: {
        setupRequired: !hasUsers,
        hasUsers,
      },
    });
  } catch (error) {
    logger.error('Setup check failed', { error: error.message });
    res.status(500).json({ success: false, error: 'Failed to check setup status' });
  }
});

/**
 * POST /api/auth/setup
 * Create initial admin user (only works if no users exist)
 */
router.post('/setup', async (req, res) => {
  try {
    const { username, email, password, fullName } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Username, email, and password are required',
      });
    }

    const result = await authService.createInitialAdmin({
      username,
      email,
      password,
      fullName,
    });

    res.status(201).json({
      success: true,
      data: result,
    });
  } catch (error) {
    logger.error('Initial admin creation failed', { error: error.message });
    res.status(400).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/auth/register
 * Register a new user (admin only)
 */
router.post('/register', authenticate, requireAdmin, async (req, res) => {
  try {
    const { username, email, password, fullName, role, authorizedCameras } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Username, email, and password are required',
      });
    }

    const result = await authService.register({
      username,
      email,
      password,
      fullName,
      role: role || 'user',
    });

    // If authorizedCameras provided, update the user
    if (authorizedCameras && Array.isArray(authorizedCameras)) {
      await authService.updateUser(result.user._id, { authorizedCameras });
      result.user.authorizedCameras = authorizedCameras;
    }

    res.status(201).json({
      success: true,
      data: result,
    });
  } catch (error) {
    logger.error('User registration failed', { error: error.message });
    res.status(400).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/auth/login
 * Login user
 */
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        error: 'Username and password are required',
      });
    }

    const result = await authService.login(username, password);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    logger.error('Login failed', { error: error.message });
    res.status(401).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/auth/me
 * Get current user profile
 */
router.get('/me', authenticate, async (req, res) => {
  try {
    res.json({
      success: true,
      data: req.user.toObject(),
    });
  } catch (error) {
    logger.error('Get profile failed', { error: error.message });
    res.status(500).json({ success: false, error: 'Failed to get user profile' });
  }
});

/**
 * GET /api/auth/users
 * Get all users (admin only)
 */
router.get('/users', authenticate, requireAdmin, async (req, res) => {
  try {
    const users = await authService.getAllUsers();
    res.json({
      success: true,
      data: users,
    });
  } catch (error) {
    logger.error('Get users failed', { error: error.message });
    res.status(500).json({ success: false, error: 'Failed to retrieve users' });
  }
});

/**
 * GET /api/auth/users/:id
 * Get user by ID (admin only)
 */
router.get('/users/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const user = await authService.getUserById(req.params.id);
    res.json({
      success: true,
      data: user,
    });
  } catch (error) {
    logger.error('Get user failed', { error: error.message });
    res.status(404).json({ success: false, error: 'User not found' });
  }
});

/**
 * PUT /api/auth/users/:id
 * Update user (admin only)
 */
router.put('/users/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const user = await authService.updateUser(req.params.id, req.body);
    res.json({
      success: true,
      data: user,
    });
  } catch (error) {
    logger.error('Update user failed', { error: error.message });
    res.status(400).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/auth/users/:id
 * Delete user (admin only)
 */
router.delete('/users/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    // Prevent deleting yourself
    if (req.params.id === req.user._id.toString()) {
      return res.status(400).json({
        success: false,
        error: 'Cannot delete your own account',
      });
    }

    const deleted = await authService.deleteUser(req.params.id);
    if (!deleted) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    res.json({
      success: true,
      message: 'User deleted successfully',
    });
  } catch (error) {
    logger.error('Delete user failed', { error: error.message });
    res.status(500).json({ success: false, error: 'Failed to delete user' });
  }
});

export default router;
