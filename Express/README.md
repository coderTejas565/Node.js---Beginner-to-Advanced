# Express.js — Backend Engineering Practice

The goal is not just to learn Express syntax, but to understand what Express is abstracting compared to the raw Node.js HTTP module.

## What I Have Learned

### 1. Express Server

Created a basic Express server using:

* `express()`
* `app.listen()`
* Request and response objects

### 2. Routes

Practiced:

```text
GET /
GET /health
GET /users
POST /users
```

Express allows us to define routes directly instead of manually checking `req.url` and `req.method`.

### 3. Route Parameters

Example:

```text
GET /users/2
```

Using:

```ts
req.params.id
```

Important:

* Route parameters arrive as strings.
* Convert them when the application expects another type.
* A resource ID is not the same thing as an array index.

### 4. Query Parameters

Example:

```text
GET /users?page=2&limit=5
```

Using:

```ts
req.query
```

Query parameters also arrive as strings.

### 5. Zod Validation

Used Zod to validate query parameters.

Example schema:

```ts
const paginationSchema = z.object({
  page: z.coerce.number().int().min(1),
  limit: z.coerce.number().int().min(1).max(100),
});
```

Important Zod concepts learned:

* `z.coerce.number()` → converts strings to numbers
* `.int()` → requires an integer
* `.min(1)` → minimum allowed value is 1
* `.max(100)` → maximum allowed value is 100
* `.safeParse()` → validates without throwing on validation failure

### 6. Validation Result

`safeParse()` returns either:

```ts
{
  success: true,
  data: ...
}
```

or:

```ts
{
  success: false,
  error: ...
}
```

For successful validation, use:

```ts
result.data
```

For failed validation, use:

```ts
result.error.issues
```

### 7. API Error Response

Instead of exposing the complete Zod error, validation issues are transformed into a simpler API response:

```json
{
  "message": "Invalid request",
  "errors": [
    {
      "field": "limit",
      "message": "..."
    }
  ]
}
```

Invalid client input uses:

```text
400 Bad Request
```

while:

```text
404 Not Found
```

means the requested resource or route could not be found.

## Current Learning Progress

```text
[x] Basic Express server
[x] Basic routes
[x] HTTP methods
[x] Route parameters
[x] Query parameters
[x] Zod validation
[x] Zod validation errors
[ ] Middleware
[ ] Request body parsing
[ ] Centralized error handling
[ ] Rate limiting
[ ] API versioning
[ ] Production hardening
```

## Learning Approach

For backend concepts, I am practicing the primitive approach first and then comparing it with the production abstraction.

Example:

```text
Raw Node HTTP
      ↓
Understand the primitive
      ↓
Express
      ↓
Understand the abstraction
      ↓
Production concerns
```

This helps me understand what frameworks are actually doing instead of only memorizing their APIs.
