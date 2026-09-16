import express from 'express';
import { count } from 'node:console';
import * as z from 'zod';

const app = express();
const PORT = 8080;
const API_KEY = 'secret123';

const users = [
  { id: 1, name: 'Alice' },
  { id: 2, name: 'Bob' },
  { id: 3, name: 'Charlie' },
];

// Custom application error
//
// AppError extends the built-in Error class so we can attach
// an HTTP status code to an error.
//
// This lets routes throw errors like:
// new AppError('User not found', 404)
//
// If no status code is provided, it defaults to 500.
class AppError extends Error {
  constructor(message, statusCode = 500) {
    super(message);
    this.statusCode = statusCode;
  }
}

app.use(express.json({ limit: '10kb' }));


app.post('/users', (req, res) => {
  console.log(req.body);

  return res.status(201).send({
    message: 'User Created Successfully',
    body: req.body,
  });
});

// Test: custom 401 error
// 401 = authentication is required.
app.get('/unauthorized', () => {
  throw new AppError('Authentication required', 401);
});

// Test: custom 403 error
// 403 = the request is understood, but the client
// does not have permission to perform the action.
app.get('/forbidden', () => {
  throw new AppError('You do not have permission', 403);
});

// Test: default 500 error
// No status code is provided, so AppError defaults to 500.
app.get('/server-error', () => {
  throw new AppError('Something went wrong');
});

// Request logging middleware
//
// Records the time when the request enters the middleware.
//
// The "finish" event fires when the response has been
// completely sent, allowing us to calculate the duration
// and access the final HTTP status code.
const loggerMiddleware = (req, res, next) => {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;

    console.log(req.method, req.url, res.statusCode, `${duration}ms`);
  });

  next();
};

// API key authentication middleware
//
// Reads the API key from the "x-api-key" request header.
//
// Missing API key → 401
// Invalid API key → 403
// Valid API key → continue to the next middleware/route.
const apiKeyMiddleware = (req, res, next) => {
  const apikey = req.headers['x-api-key'];

  if (!apikey) {
    return res.status(401).send({
      message: 'API key required',
    });
  }

  if (apikey !== API_KEY) {
    return res.status(403).send({
      message: 'Invalid API key',
    });
  }

  next();
};

// Basic GET route
app.get('/', (req, res) => {
  res.status(200).send('Welcome to the express');
});

// Health-check endpoint
// Commonly used to check whether the server is running.
app.get('/health', (req, res) => {
  res.status(200).send({
    status: 'OK',
  });
});

// Route parameters example
// GET /users/2
//
// req.params contains values captured from the URL.
// Route parameters arrive as strings, so we convert the id to a number.
//
// app.get('/users/:id', (req, res) => {
//   const id = Number(req.params.id);
//   const user = users.find((user) => user.id === id);
//
//   if (!user) {
//     return res.status(404).send({
//       message: 'User not found',
//     });
//   }
//
//   return res.status(200).send({
//     user,
//   });
// });

// Query parameters + Zod validation
//
// Example:
// GET /users?page=2&limit=5
//
// req.query gives us the query parameters.
// Query parameter values arrive as strings.
//
// Zod is used to validate and transform the incoming data.
app.get('/users', loggerMiddleware, apiKeyMiddleware, (req, res) => {
  const paginationSchema = z.object({
    // coerce.number() converts values like "2" into 2.
    // int() requires an integer.
    // min(1) means page cannot be less than 1.
    page: z.coerce.number().int().min(1),

    // limit must be an integer between 1 and 100.
    limit: z.coerce.number().int().min(1).max(100),
  });

  // safeParse() never throws for validation failure.
  // It returns either:
  // { success: true, data: ... }
  // or
  // { success: false, error: ... }
  const result = paginationSchema.safeParse(req.query);

  console.log(result);

  // Handle validation failure.
  if (!result.success) {
    // Zod gives us an array of validation issues.
    // We transform it into a cleaner API error format.
    const errors = result.error.issues.map((issue) => ({
      field: issue.path[0],
      message: issue.message,
    }));

    console.log(result.error.issues);

    // 400 = Bad Request
    // The client sent invalid input.
    return res.status(400).send({
      message: 'Invalid request',
      errors,
    });
  }

  // result.data contains validated and transformed values.
  // Example: "2" becomes 2.
  return res.status(200).send({
    data: result.data,
  });
});

// Basic POST route
// We are only practicing the HTTP method here.
// Actual user creation will be implemented later.
app.post('/users', (req, res) => {
  console.log(req.body);

  return res.status(201).send({
    message: 'User Created Successfully',
    body: req.body,
  });
});

app.get('/error', (req, res) => {
  throw new Error('Something went wrong');
});

// Centralized error-handling middleware
//
// Express identifies error middleware by its four parameters:
// (err, req, res, next)
//
// Routes don't need to build the error response themselves.
// They throw/pass an error here, and this middleware decides
// the final HTTP response.
//
// err.statusCode → custom HTTP status code
// err.message    → error message
// fallback       → 500 Internal Server Error
app.use((err, req, res, next) => {
  console.log('ERROR:', err);

  res.status(err.statusCode || 500).send({
    message: err.message || 'Internal Server Error',
  });
});

// Start the Express server.
app.listen(PORT, () => {
  console.log(`Server is listening on ${PORT}`);
});

// In-memory rate-limit storage.
//
// Map stores data using:
// clientId → rate-limit record
//
// Example:
// "192.168.1.10" → {
//   count: 3,
//   windowStart: 1789452508063
// }
const rateLimitStore = new Map();

// Maximum number of requests allowed
// during one rate-limit window.
const MAX_REQUESTS = 5;

// Length of the rate-limit window.
// Currently set to 10 seconds for easier testing.
const WINDOW_MS = 10 * 1000;

// Rate-limiting middleware
//
// Each client is identified by its IP address.
//
// The middleware:
// 1. Gets the client's IP.
// 2. Finds the client's rate-limit record.
// 3. Creates a record for a new client.
// 4. Resets the record when the time window expires.
// 5. Rejects requests when the maximum is reached.
// 6. Increments the request count for allowed requests.
const rateLimiter = (req, res, next) => {
  // Identify the client using its IP address.
  const clientId = req.ip;

  // Find this client's existing rate-limit record.
  const record = rateLimitStore.get(clientId);

  // If no record exists, this is the client's first request.
  // Create a new record with count = 1.
  if (!record) {
    rateLimitStore.set(clientId, {
      count: 1,
      windowStart: Date.now(),
    });

    return next();
  }

  // Calculate how much time has passed since
  // this client's current rate-limit window started.
  const elapsed = Date.now() - record.windowStart;

  // If the window has expired, start a new window.
  // The current request becomes request number 1
  // of the new window.
  if (elapsed >= WINDOW_MS) {
    rateLimitStore.set(clientId, {
      count: 1,
      windowStart: Date.now(),
    });

    return next();
  }

  // If the client has already reached the maximum
  // number of requests, reject the request.
  // 429 = Too Many Requests.
  if (record.count >= MAX_REQUESTS) {
    return res.status(429).send({
      message: 'Too Many Requests',
    });
  }

  // The request is still within the window
  // and the client has not reached the limit.
  // Increment the request count.
  record.count++;

  // Continue to the route.
  return next();
};

// Test route for the rate limiter.
//
// The rateLimiter middleware runs before the route.
// If the limit is exceeded, the route is never reached.
app.get('/rate-test', rateLimiter, (req, res) => {
  res.send({
    message: 'Request allowed',
  });
});

// Standalone rate-limiter primitive.
//
// This code is kept separately as a learning exercise
// to understand the algorithm before connecting it
// to Express.
//
// It simulates a client with the ID "client-1".
const clientId = 'client-1';

// Get the client's existing rate-limit record.
const record = rateLimitStore.get(clientId);

// console.log(record);

// Check whether this client has a record yet.
//
// If there is no record, create the client's first
// rate-limit window with count = 1.
if (!rateLimitStore.has(clientId)) {
  rateLimitStore.set(clientId, {
    count: 1,
    windowStart: Date.now(),
  });
} else {
  // Calculate the elapsed time since this client's
  // current rate-limit window started.
  const elapsed = Date.now() - record.windowStart;

  console.log(elapsed);

  // If the rate-limit window has expired,
  // create a new window and reset the count to 1.
  if (elapsed >= WINDOW_MS) {
    rateLimitStore.set(clientId, {
      count: 1,
      windowStart: Date.now(),
    });
  } else {
    // If the client has reached the maximum number
    // of allowed requests, reject the request.
    if (record.count >= MAX_REQUESTS) {
      console.log('Too Many Requests');
    } else {
      // Otherwise increment the request count.
      record.count++;
    }
  }
}