import express from 'express';
import User from '../models/User.js';
import logger from '../utils/logger.js';

const router = express.Router();

/**
 * GET /api/users/me/preferences
 * Get current user's preferences
 */
router.get('/me/preferences', async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('preferences');

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      });
    }

    res.json({
      success: true,
      data: user.preferences || {},
    });
  } catch (error) {
    logger.error('Error getting user preferences', {
      userId: req.user._id,
      error: error.message,
    });
    res.status(500).json({
      success: false,
      error: 'Failed to get preferences',
    });
  }
});

/**
 * PUT /api/users/me/preferences
 * Update current user's preferences
 */
router.put('/me/preferences', async (req, res) => {
  try {
    const { dateFormat, timeFormat, timezone, theme, videoPlayback } = req.body;

    // Validate dateFormat
    if (dateFormat && !['US', 'ISO', 'EU'].includes(dateFormat)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid dateFormat. Must be one of: US, ISO, EU',
      });
    }

    // Validate timeFormat
    if (timeFormat && !['12h', '24h'].includes(timeFormat)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid timeFormat. Must be one of: 12h, 24h',
      });
    }

    // Validate theme
    if (theme && !['light', 'dark'].includes(theme)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid theme. Must be one of: light, dark',
      });
    }

    // Validate videoPlayback
    if (videoPlayback) {
      if (videoPlayback.preTime !== undefined && (typeof videoPlayback.preTime !== 'number' || videoPlayback.preTime < 0 || videoPlayback.preTime > 60)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid videoPlayback.preTime. Must be a number between 0 and 60',
        });
      }
      if (videoPlayback.postTime !== undefined && (typeof videoPlayback.postTime !== 'number' || videoPlayback.postTime < 0 || videoPlayback.postTime > 60)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid videoPlayback.postTime. Must be a number between 0 and 60',
        });
      }
    }

    // Build update object using dot notation to preserve existing preferences
    // Use $set for values and $unset for null/empty (to reset to system default)
    const updateFields = {};
    const unsetFields = {};

    // Helper to add field to set or unset
    const addField = (field, value) => {
      if (value === null || value === '') {
        unsetFields[field] = '';
      } else {
        updateFields[field] = value;
      }
    };

    if (dateFormat !== undefined) addField('preferences.dateFormat', dateFormat);
    if (timeFormat !== undefined) addField('preferences.timeFormat', timeFormat);
    if (timezone !== undefined) addField('preferences.timezone', timezone);
    if (theme !== undefined) addField('preferences.theme', theme);

    // Handle nested videoPlayback fields
    if (videoPlayback !== undefined) {
      if (videoPlayback.preTime !== undefined) {
        addField('preferences.videoPlayback.preTime', videoPlayback.preTime);
      }
      if (videoPlayback.postTime !== undefined) {
        addField('preferences.videoPlayback.postTime', videoPlayback.postTime);
      }
    }

    // Build update operation
    const updateOperation = {};
    if (Object.keys(updateFields).length > 0) {
      updateOperation.$set = updateFields;
    }
    if (Object.keys(unsetFields).length > 0) {
      updateOperation.$unset = unsetFields;
    }

    // Update user preferences (merges with existing preferences)
    const user = await User.findByIdAndUpdate(
      req.user._id,
      updateOperation,
      { new: true, select: 'preferences' }
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      });
    }

    logger.info('User preferences updated', {
      userId: req.user._id,
      set: updateFields,
      unset: Object.keys(unsetFields),
    });

    res.json({
      success: true,
      data: user.preferences || {},
    });
  } catch (error) {
    logger.error('Error updating user preferences', {
      userId: req.user._id,
      error: error.message,
    });
    res.status(500).json({
      success: false,
      error: 'Failed to update preferences',
    });
  }
});

export default router;
