const redis = require('../database/redis');
const mysql = require('../database/mysql');

const CACHE_TTL = 15 * 60; // 15 minutes in seconds
const CACHE_PREFIX = 'user:';

/**
 * Get user data from cache
 * @param {number} userId - User ID
 * @returns {Promise<Object|null>} - User data or null if not found
 */
const getUserFromCache = async (userId) => {
  try {
    const redisClient = await redis.connect();
    const cacheKey = `${CACHE_PREFIX}${userId}`;
    const cachedData = await redisClient.get(cacheKey);
    
    if (cachedData) {
      return JSON.parse(cachedData);
    }
    
    return null;
  } catch (error) {
    console.error('Error getting user from cache:', error);
    return null;
  }
};

/**
 * Cache user data in Redis
 * @param {number} userId - User ID
 * @param {Object} userData - User data to cache
 * @returns {Promise<void>}
 */
const setUserCache = async (userId, userData) => {
  try {
    const redisClient = await redis.connect();
    const cacheKey = `${CACHE_PREFIX}${userId}`;
    await redisClient.setEx(cacheKey, CACHE_TTL, JSON.stringify(userData));
  } catch (error) {
    console.error('Error setting user cache:', error);
  }
};

/**
 * Delete user data from cache
 * @param {number} userId - User ID
 * @returns {Promise<void>}
 */
const deleteUserCache = async (userId) => {
  try {
    const redisClient = await redis.connect();
    const cacheKey = `${CACHE_PREFIX}${userId}`;
    await redisClient.del(cacheKey);
  } catch (error) {
    console.error('Error deleting user cache:', error);
  }
};

/**
 * Get user data from database and cache it
 * @param {number} userId - User ID
 * @returns {Promise<Object|null>} - User data or null if not found
 */
const getUserFromDatabase = async (userId) => {
  try {
    const query = `
      SELECT id, phoneNumber, userName, userEmail, isPremium, loginInfo, telegramID, role, walletBalance 
      FROM users 
      WHERE id = ?
    `;
    const users = await mysql.query(query, [userId]);
    
    if (users.length === 0) {
      return null;
    }
    
    const userData = users[0];
    
    // Cache the user data
    await setUserCache(userId, userData);
    
    return userData;
  } catch (error) {
    console.error('Error getting user from database:', error);
    throw error;
  }
};

/**
 * Get user data - first tries cache, then database
 * Also checks database in background to update cache if data changed
 * @param {number} userId - User ID
 * @param {boolean} forceRefresh - Force refresh from database
 * @returns {Promise<Object|null>} - User data or null if not found
 */
const getUserData = async (userId, forceRefresh = false) => {
  // If force refresh, get from database and update cache
  if (forceRefresh) {
    return await getUserFromDatabase(userId);
  }
  
  // Try cache first
  const cachedUser = await getUserFromCache(userId);
  
  // Always check database in background to update cache if data changed
  // This ensures cache is always up-to-date while still being fast
  // We don't await this - it runs in parallel
  getUserFromDatabase(userId)
    .then(dbUser => {
      if (dbUser) {
        // Compare cached data with database data
        const cachedStr = JSON.stringify(cachedUser);
        const dbStr = JSON.stringify(dbUser);
        if (cachedStr !== dbStr) {
          console.log(`[Cache] User ${userId} data changed, cache updated`);
        }
      }
    })
    .catch(err => {
      console.error('Error refreshing cache in background:', err);
    });
  
  // Return cached data immediately (fast response)
  if (cachedUser) {
    return cachedUser;
  }
  
  // If not in cache, get from database and cache it
  return await getUserFromDatabase(userId);
};

/**
 * Update user cache after data modification
 * @param {number} userId - User ID
 * @returns {Promise<Object|null>} - Updated user data or null if not found
 */
const refreshUserCache = async (userId) => {
  return await getUserFromDatabase(userId);
};

module.exports = {
  getUserFromCache,
  setUserCache,
  deleteUserCache,
  getUserFromDatabase,
  getUserData,
  refreshUserCache
};

