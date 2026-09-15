import express from 'express';
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


// Test: custom 401 error
// 401 = authentication is required.
app.get('/unauthorized', () => {
    throw new AppError('Authentication required', 401)
})

// Test: custom 403 error
// No status code is provided, so AppError defaults to 500.
app.get('/forbidden', () => {
  throw new AppError('You do not have permission', 403);
});

// Test: default 500 error
app.get('/server-error', () => {
  throw new AppError('Something went wrong');
});

const loggerMiddleware = (req, res, next) => {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;

    console.log(
      req.method,
      req.url,
      res.statusCode,
      `${duration}ms`
    );
  });

  next();
};

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
app.get('/users',loggerMiddleware, apiKeyMiddleware, (req, res) => {
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
  res.status(201).send({
    message: 'User Created Successfully',
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
