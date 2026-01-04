import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { User } from '../models/index.js';
import { authConfig } from '../config/index.js';
import logger from '../utils/logger.js';

/**
 * Generate JWT token for user
 * @param {Object} user - User object
 * @returns {string} JWT token
 */
export function generateToken(user) {
  const payload = {
    id: user._id,
    username: user.username,
    email: user.email,
    role: user.role,
  };

  return jwt.sign(payload, authConfig.jwtSecret, {
    expiresIn: authConfig.jwtExpiresIn,
  });
}

/**
 * Verify JWT token
 * @param {string} token - JWT token
 * @returns {Object} Decoded token payload
 */
export function verifyToken(token) {
  try {
    return jwt.verify(token, authConfig.jwtSecret);
  } catch (error) {
    throw new Error('Invalid or expired token');
  }
}

/**
 * Register a new user
 * @param {Object} userData - User registration data
 * @returns {Promise<Object>} Created user and token
 */
export async function register(userData) {
  try {
    const { username, email, password, fullName, role } = userData;

    // Check if user already exists
    const existingUser = await User.findOne({
      $or: [{ username }, { email }],
    });

    if (existingUser) {
      if (existingUser.username === username) {
        throw new Error('Username already exists');
      }
      if (existingUser.email === email) {
        throw new Error('Email already exists');
      }
    }

    // Create new user
    const user = new User({
      username,
      email,
      password,
      fullName,
      role: role || 'user',
    });

    await user.save();

    logger.info('User registered', { username, role: user.role });

    // Generate token
    const token = generateToken(user);

    return {
      user: user.toSafeObject(),
      token,
    };
  } catch (error) {
    logger.error('User registration failed', { error: error.message });
    throw error;
  }
}

/**
 * Login user
 * @param {string} username - Username or email
 * @param {string} password - Password
 * @returns {Promise<Object>} User and token
 */
export async function login(username, password) {
  try {
    // First check if this is the environment-based admin account
    if (authConfig.adminUsername &&
        (username === authConfig.adminUsername || username === authConfig.adminEmail)) {

      // Verify password against hash in environment
      const isValid = await bcrypt.compare(password, authConfig.adminPasswordHash);

      if (isValid) {
        logger.info('Admin logged in (env-based)', { username: authConfig.adminUsername });

        // Create a virtual admin user object
        const adminUser = {
          _id: 'env-admin',
          username: authConfig.adminUsername,
          email: authConfig.adminEmail,
          role: 'admin',
          enabled: true,
          isEnvAdmin: true,
        };

        // Generate token
        const token = generateToken(adminUser);

        return {
          user: adminUser,
          token,
        };
      }
    }

    // Fall back to database users
    const user = await User.findOne({
      $or: [{ username }, { email: username }],
    });

    if (!user) {
      throw new Error('Invalid credentials');
    }

    // Check if user is enabled
    if (!user.enabled) {
      throw new Error('Account is disabled');
    }

    // Verify password
    const isValid = await user.comparePassword(password);
    if (!isValid) {
      throw new Error('Invalid credentials');
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    logger.info('User logged in', { username: user.username });

    // Generate token
    const token = generateToken(user);

    return {
      user: user.toSafeObject(),
      token,
    };
  } catch (error) {
    logger.error('Login failed', { error: error.message, username });
    throw error;
  }
}

/**
 * Get user by ID
 * @param {string} userId - User ID
 * @returns {Promise<Object>} User object
 */
export async function getUserById(userId) {
  try {
    const user = await User.findById(userId).select('-password').lean();
    if (!user) {
      throw new Error('User not found');
    }
    return user;
  } catch (error) {
    logger.error('Failed to get user', { error: error.message, userId });
    throw error;
  }
}

/**
 * Check if any users exist in the system
 * @returns {Promise<boolean>}
 */
export async function hasUsers() {
  try {
    // If environment-based admin exists, setup is not required
    if (authConfig.adminUsername && authConfig.adminPasswordHash) {
      return true;
    }

    const count = await User.countDocuments();
    return count > 0;
  } catch (error) {
    logger.error('Failed to check users', { error: error.message });
    throw error;
  }
}

/**
 * Check if any admin users exist
 * @returns {Promise<boolean>}
 */
export async function hasAdmins() {
  try {
    const count = await User.countDocuments({ role: 'admin' });
    return count > 0;
  } catch (error) {
    logger.error('Failed to check admins', { error: error.message });
    throw error;
  }
}

/**
 * Create initial admin user (only if no users exist)
 * @param {Object} adminData - Admin user data
 * @returns {Promise<Object>}
 */
export async function createInitialAdmin(adminData) {
  try {
    const usersExist = await hasUsers();
    if (usersExist) {
      throw new Error('Users already exist. Cannot create initial admin.');
    }

    const admin = await register({
      ...adminData,
      role: 'admin',
    });

    logger.info('Initial admin created', { username: admin.user.username });
    return admin;
  } catch (error) {
    logger.error('Failed to create initial admin', { error: error.message });
    throw error;
  }
}

/**
 * Get all users (admin only)
 * @returns {Promise<Array>}
 */
export async function getAllUsers() {
  try {
    const users = await User.find().select('-password').sort({ createdAt: -1 }).lean();

    // If env-based admin exists, add it to the list
    if (authConfig.adminUsername && authConfig.adminPasswordHash) {
      const envAdmin = {
        _id: 'env-admin',
        username: authConfig.adminUsername,
        email: authConfig.adminEmail,
        role: 'admin',
        enabled: true,
        isEnvAdmin: true,
        createdAt: new Date(0), // Epoch time to sort it first
      };
      return [envAdmin, ...users];
    }

    return users;
  } catch (error) {
    logger.error('Failed to get users', { error: error.message });

    // If database query fails but env-based admin exists, return just the env admin
    if (authConfig.adminUsername && authConfig.adminPasswordHash) {
      logger.info('Database unavailable, returning env-based admin only');
      return [{
        _id: 'env-admin',
        username: authConfig.adminUsername,
        email: authConfig.adminEmail,
        role: 'admin',
        enabled: true,
        isEnvAdmin: true,
        createdAt: new Date(0),
      }];
    }

    throw error;
  }
}

/**
 * Update user
 * @param {string} userId - User ID
 * @param {Object} updateData - Data to update
 * @returns {Promise<Object>}
 */
export async function updateUser(userId, updateData) {
  try {
    const allowedFields = ['fullName', 'email', 'enabled', 'authorizedCameras', 'role'];
    const updates = {};

    allowedFields.forEach((field) => {
      if (updateData[field] !== undefined) {
        updates[field] = updateData[field];
      }
    });

    // If password is being updated, hash it
    if (updateData.password) {
      const user = await User.findById(userId);
      user.password = updateData.password;
      await user.save();
    }

    const user = await User.findByIdAndUpdate(userId, updates, {
      new: true,
      runValidators: true,
    }).select('-password');

    logger.info('User updated', { userId });
    return user.toObject();
  } catch (error) {
    logger.error('Failed to update user', { error: error.message, userId });
    throw error;
  }
}

/**
 * Delete user
 * @param {string} userId - User ID
 * @returns {Promise<boolean>}
 */
export async function deleteUser(userId) {
  try {
    const user = await User.findByIdAndDelete(userId);
    if (user) {
      logger.info('User deleted', { userId, username: user.username });
      return true;
    }
    return false;
  } catch (error) {
    logger.error('Failed to delete user', { error: error.message, userId });
    throw error;
  }
}

export default {
  generateToken,
  verifyToken,
  register,
  login,
  getUserById,
  hasUsers,
  hasAdmins,
  createInitialAdmin,
  getAllUsers,
  updateUser,
  deleteUser,
};
