import { createClient } from 'redis';

const redisClient = createClient({
  url: 'redis://localhost:6379',
});

redisClient.on('error', (error) => {
  console.error('Redis Client Error:', error);
});

await redisClient.connect();

console.log('Redis connected');

await redisClient.set('test', 'hello');

const value = await redisClient.get('test');

console.log('Redis value:', value);

export default redisClient;