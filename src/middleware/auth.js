import { verifyToken } from '../services/authService.js';
import { User, Camera } from '../models/index.js';
import logger from '../utils/logger.js';

/**
 * Middleware to authenticate requests
 * Verifies JWT token and attaches user to request
 */
export async function authenticate(req, res, next) {
  try {
    // Get token from header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'No token provided',
      });
    }

    const token = authHeader.substring(7);

    // Verify token
    const decoded = verifyToken(token);

    // Check if this is the environment-based admin
    if (decoded.id === 'env-admin') {
      req.user = {
        _id: 'env-admin',
        username: decoded.username,
        role: decoded.role,
        enabled: true,
        isEnvAdmin: true,
        toObject: function() { return this; },
      };
      return next();
    }

    // Get user from database
    const user = await User.findById(decoded.id).select('-password');
    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'User not found',
      });
    }

    if (!user.enabled) {
      return res.status(403).json({
        success: false,
        error: 'Account is disabled',
      });
    }

    req.user = user;
    next();
  } catch (error) {
    logger.error('Authentication failed', { error: error.message });
    return res.status(401).json({
      success: false,
      error: 'Invalid or expired token',
    });
  }
}

/**
 * Middleware to require admin role
 */
export function requireAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required',
    });
  }

  if (req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      error: 'Admin access required',
    });
  }

  next();
}

/**
 * Middleware to check camera authorization
 */
export async function checkCameraAccess(req, res, next) {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }

    if (req.user.role === 'admin') {
      return next();
    }

    const cameraId = req.params.id || req.query.cameraId || req.body.cameraId;

    if (!cameraId) {
      return next();
    }

    const camera = await Camera.findOne({
      $or: [{ _id: cameraId }, { cameraId: cameraId }],
    });

    if (!camera) {
      return res.status(404).json({
        success: false,
        error: 'Camera not found',
      });
    }

    const hasAccess = req.user.authorizedCameras.some(
      (cam) => cam.toString() === camera._id.toString()
    );

    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to access this camera',
      });
    }

    next();
  } catch (error) {
    logger.error('Camera access check failed', { error: error.message });
    return res.status(500).json({
      success: false,
      error: 'Failed to check camera access',
    });
  }
}

/**
 * Optional authentication middleware
 */
export async function optionalAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const decoded = verifyToken(token);

      if (decoded.id === 'env-admin') {
        req.user = {
          _id: 'env-admin',
          username: decoded.username,
          role: decoded.role,
          enabled: true,
          isEnvAdmin: true,
          toObject: function() { return this; },
        };
      } else {
        const user = await User.findById(decoded.id).select('-password');
        if (user && user.enabled) {
          req.user = user;
        }
      }
    }
  } catch (error) {
    // Silently fail for optional auth
  }
  next();
}

export default {
  authenticate,
  requireAdmin,
  checkCameraAccess,
  optionalAuth,
};
