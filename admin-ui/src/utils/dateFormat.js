/**
 * Utility functions for formatting dates according to system settings
 */

/**
 * Format a date/time according to the specified format
 * @param {Date|string|number} date - The date to format
 * @param {string} format - 'US' or 'ISO'
 * @returns {string} Formatted date string
 */
export const formatDateTime = (date, format = 'US') => {
  if (!date) return '-';

  const d = new Date(date);
  if (isNaN(d.getTime())) return '-';

  if (format === 'ISO') {
    // ISO format: 2025-12-25 22:02:10
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const seconds = String(d.getSeconds()).padStart(2, '0');

    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  } else {
    // US format: 12/25/2025, 10:02:10 PM
    return d.toLocaleString('en-US', {
      month: '2-digit',
      day: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    });
  }
};

/**
 * Format just the date (no time)
 * @param {Date|string|number} date - The date to format
 * @param {string} format - 'US' or 'ISO'
 * @returns {string} Formatted date string
 */
export const formatDate = (date, format = 'US') => {
  if (!date) return '-';

  const d = new Date(date);
  if (isNaN(d.getTime())) return '-';

  if (format === 'ISO') {
    // ISO format: 2025-12-25
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
  } else {
    // US format: 12/25/2025
    return d.toLocaleDateString('en-US', {
      month: '2-digit',
      day: '2-digit',
      year: 'numeric',
    });
  }
};

/**
 * Format just the time
 * @param {Date|string|number} date - The date to format
 * @param {string} format - 'US' or 'ISO'
 * @returns {string} Formatted time string
 */
export const formatTime = (date, format = 'US') => {
  if (!date) return '-';

  const d = new Date(date);
  if (isNaN(d.getTime())) return '-';

  if (format === 'ISO') {
    // ISO format: 22:02:10
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const seconds = String(d.getSeconds()).padStart(2, '0');

    return `${hours}:${minutes}:${seconds}`;
  } else {
    // US format: 10:02:10 PM
    return d.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    });
  }
};
