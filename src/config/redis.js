const Redis = require('ioredis');

const redisConfig = {
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: parseInt(process.env.REDIS_PORT) || 6379,
    password: process.env.REDIS_PASSWORD || undefined,
    maxRetriesPerRequest: null, // Required for bullmq
};

const redis = new Redis(redisConfig);

redis.on('connect', () => console.log('Redis Connected ✅'));
redis.on('error', (err) => console.error('Redis Connection Error ❌:', err.message));

module.exports = {
    redis,
    redisConfig
};