import express from 'express';
import { authConfig } from '../config/index.js';
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

  if (!authConfig.adminPassword) {
    return res.status(500).json({
      success: false,
      error: 'ADMIN_PASSWORD not configured',
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

    // Use centralized login (handles env-admin + database users)
    const result = await authService.login(username, password);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    logger.error('Client login failed', { error: error.message });

    if (error.message === 'Invalid credentials' || error.message === 'Account is disabled') {
      return res.status(401).json({ success: false, error: error.message });
    }

    res.status(500).json({ success: false, error: 'Login failed' });
  }
});

/**
 * GET /api/auth/users
 */
router.get('/users', async (req, res) => {
  try {
    const users = await authService.getAllUsers();
    res.json({ success: true, data: users });
  } catch (error) {
    logger.error('Failed to get users', { error: error.message });
    res.status(500).json({ success: false, error: 'Failed to get users' });
  }
});

/**
 * POST /api/auth/users
 */
router.post('/users', async (req, res) => {
  try {
    const result = await authService.register(req.body);
    res.status(201).json({ success: true, data: result.user });
  } catch (error) {
    logger.error('Failed to create user', { error: error.message });
    res.status(error.message.includes('already exists') ? 400 : 500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * PUT /api/auth/users/:id
 */
router.put('/users/:id', async (req, res) => {
  try {
    const user = await authService.updateUser(req.params.id, req.body);
    res.json({ success: true, data: user });
  } catch (error) {
    logger.error('Failed to update user', { error: error.message });
    res.status(500).json({ success: false, error: 'Failed to update user' });
  }
});

/**
 * DELETE /api/auth/users/:id
 */
router.delete('/users/:id', async (req, res) => {
  try {
    const deleted = await authService.deleteUser(req.params.id);
    if (!deleted) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    res.json({ success: true, message: 'User deleted' });
  } catch (error) {
    logger.error('Failed to delete user', { error: error.message });
    res.status(500).json({ success: false, error: 'Failed to delete user' });
  }
});

export default router;
