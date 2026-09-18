# Express.js — Backend Engineering Practice

Goal: understand what Express is abstracting over raw Node's `http` module, not just learn Express syntax.

## 1. Express Server
Basic server using `express()`, `app.listen()`, and the `req`/`res` objects.

## 2. Routes
```
GET  /
GET  /health
GET  /users
POST /users
```
Express lets you define routes declaratively instead of manually branching on `req.url` and `req.method`.

## 3. Route Parameters
`GET /users/2` → accessed via `req.params.id`.
- Route params always arrive as strings — cast them before using them as numbers.
- A resource ID (e.g. a DB primary key) isn't the same thing as an array index — don't assume they're interchangeable.

## 4. Query Parameters
`GET /users?page=2&limit=5` → accessed via `req.query`. Also strings — same casting rule applies.

## 5. Validation with Zod
```ts
const paginationSchema = z.object({
  page: z.coerce.number().int().min(1),
  limit: z.coerce.number().int().min(1).max(100),
});
```
- `z.coerce.number()` — converts a string input to a number before validating
- `.int()`, `.min()`, `.max()` — standard constraints
- `.safeParse()` — validates without throwing; returns `{ success: true, data }` or `{ success: false, error }`
- On success, use `result.data`. On failure, use `result.error.issues`.

Don't leak the raw Zod error to the client — map it to a clean API shape:
```json
{
  "message": "Invalid request",
  "errors": [{ "field": "limit", "message": "..." }]
}
```
`400` = bad client input. `404` = resource/route doesn't exist. Different failure modes, don't conflate them.

## 6. Middleware
```js
const middleware = (req, res, next) => {
  // do something
  next();
};
```
Flow: `Request → Middleware → Middleware → Route Handler → Response`. `next()` hands off control; not calling it (and sending a response instead) stops the chain — this is how auth/validation middleware blocks a request.

Common uses: logging, auth, validation, rate limiting.

## 7. Request Body Parsing
```js
app.use(express.json());
```
Parses JSON bodies into `req.body`. At the raw Node level, bodies are streams — this middleware is doing the buffering/parsing for you. Invalid JSON → `400`.

## 8. Body Size Limit
```js
app.use(express.json({ limit: '10kb' }));
```
An unbounded body accepts arbitrarily large payloads, which is a cheap DoS vector (memory pressure) — capping it is a basic, low-cost protection.

## 9. Logging Middleware
```js
const loggerMiddleware = (req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(req.method, req.url, res.statusCode, `${duration}ms`);
  });
  next();
};
```
`res.on('finish')` fires after the response is actually sent, which is what lets you log the final status code and total duration in one place.

## 10. API-Key Middleware (primitive access control)
```js
const apiKeyMiddleware = (req, res, next) => {
  const apikey = req.headers['x-api-key'];
  if (!apikey) return res.status(401).send({ message: 'API key required' });
  if (apikey !== API_KEY) return res.status(403).send({ message: 'Invalid API key' });
  next();
};
```
`401` = no/missing credentials. `403` = credentials present but not authorized. This is a primitive stand-in for real auth — fine for understanding the middleware pattern, not for production.

## 11. Centralized Error Handling
```js
class AppError extends Error {
  constructor(message, statusCode = 500) {
    super(message);
    this.statusCode = statusCode;
  }
}

app.use((err, req, res, next) => {
  console.log('ERROR:', err);
  res.status(err.statusCode || 500).send({
    message: err.message || 'Internal Server Error',
  });
});
```
Express recognizes an error handler by its 4-argument signature. Routes just `throw`; this one place turns any error into a consistent HTTP response, instead of duplicating try/catch response logic in every route.

## 12. Rate Limiting (primitive, in-memory)
```js
const MAX_REQUESTS = 5;
const WINDOW_MS = 10 * 1000;
```
Client identified by `req.ip`; over the limit → `429`.

Limitation: an in-memory `Map` is process-local — state is lost on restart and isn't shared across multiple server instances. Production systems use shared state (Redis) for this reason.

Practical gotcha worth knowing: `req.ip` is only reliable when your app trusts the right proxy layer (`app.set('trust proxy', ...)`) — behind a load balancer/reverse proxy without this set, every request can appear to come from the same IP.

## 13. Graceful Shutdown
```js
const shutdown = (signal) => {
  console.log(`${signal} received. Shutting down...`);
  server.close(() => {
    console.log('Server closed.');
    process.exit(0);
  });
};
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
```
`server.close()` stops accepting new connections but lets in-flight requests finish before exiting. Verified this by hitting a slow route and confirming it completed before shutdown.

## 14. Idempotency
An idempotent operation produces the same end state no matter how many times it's repeated (`f(f(x)) = f(x)` as a loose analogy, not a literal one). `PUT`/`DELETE` are generally idempotent by convention; `POST` is not.

## 15. Idempotency Keys
Client sends `Idempotency-Key: abc123`. Server stores the result against that key:
- First request with the key → execute, store result.
- Same key again → return the stored result, don't re-execute.

This matters because a client may retry after losing the original response (timeout, dropped connection), and you don't want that retry to double-execute a side effect (e.g. double-charging).

## 16. Primitive Version (in-memory Map)
```js
const idempotencyStore = new Map();
```
Same process-local limitation as the rate limiter. Also exposed a real bug class: a naive `GET → check, then SET → create` sequence has a race condition — two near-simultaneous requests with the same key can both pass the check before either writes.

## 17. Explicit States: PROCESSING / COMPLETED
```
New key → PROCESSING → operation runs → COMPLETED
```
- Another request with the same key while still `PROCESSING` → `409 Request is already being processed`
- Same key when already `COMPLETED` → return the stored result

## 18. Redis-Based Idempotency
```js
import { createClient } from 'redis';
const redisClient = createClient({ url: 'redis://localhost:6379' });
```
Moves the store out of process memory into shared state reachable by every app instance.

## 19. Atomic Reservation with `SET NX`
```js
await redisClient.set(
  `idempotency:${key}`,
  JSON.stringify({ status: 'PROCESSING', result: null }),
  { NX: true, EX: 10 }
);
```
`NX` = only set the key if it doesn't already exist — this is what makes the check-and-claim atomic and closes the race condition from #16:
```
Without NX: A→GET(missing) B→GET(missing) A→SET B→SET   → both execute
With NX:    A→SET NX(OK)    B→SET NX(null)                → only A gets ownership
```

## 20. TTL
```js
{ NX: true, EX: 10 }       // PROCESSING record
{ EX: 60 * 60 }            // COMPLETED record
```
If the server crashes mid-processing, there's no explicit cleanup — the TTL is what prevents an abandoned `PROCESSING` key (or a stale `COMPLETED` one) from sitting in Redis forever.

## 21. Failure Handling
```js
await redisClient.del(`idempotency:${key}`);
```
On a normal failure, delete the key so the client can retry cleanly.

Harder case: the process dies *after* the real side effect succeeds but *before* `COMPLETED` is written. Key lesson: an idempotency key prevents duplicate *attempts* at your API layer — it does not automatically make an external side effect exactly-once. For this learning build, the TTL is the safety net for the abandoned-`PROCESSING` case, not a full solution to that harder case.

## 22. API Versioning

**Why it exists:** once real clients depend on your API, you can't just change response shapes or remove fields — that breaks them. Versioning lets you make breaking changes without breaking existing consumers.

**What counts as a breaking change** (needs a new version):
- Removing or renaming a field
- Changing a field's type or meaning
- Changing status codes or error shapes
- Changing required request parameters

**What doesn't** (safe to ship on the current version):
- Adding a new optional field
- Adding a new endpoint
- Adding a new optional query param

Most bugs in "versioning" come from bumping too often (fear-driven) or not bumping when you actually broke something (laziness) — the rule above is the actual test, not a gut feeling.

**Three common strategies:**

```
URI versioning:     GET /v1/users
Header versioning:  GET /users   Accept: application/vnd.myapi.v1+json
Query versioning:   GET /users?version=1
```

URI versioning is the one you'll see most in the wild (Stripe, GitHub, Twitter) — it's explicit, cacheable, visible in logs, and doesn't require clients to set custom headers. Header versioning is "more correct" REST-purity-wise but adds friction for basically no practical gain at your stage. Use URI versioning.

**Practical implementation — separate routers per version:**
```js
import { Router } from 'express';
import v1Users from './v1/users.route.js';
import v2Users from './v2/users.route.js';

const app = express();
app.use('/v1/users', v1Users);
app.use('/v2/users', v2Users);
```

If v2 only changes one endpoint, don't duplicate the whole route file — have v2 import and reuse whatever didn't change from v1, and only override the endpoint that actually differs.

**Deprecation, not deletion:** when v1 is being phased out, don't just delete it — signal it first.
```js
app.use('/v1', (req, res, next) => {
  res.set('Deprecation', 'true');
  res.set('Sunset', 'Wed, 31 Dec 2026 23:59:59 GMT');
  next();
});
```
`Deprecation` and `Sunset` are real HTTP response headers clients (and API monitoring tools) can read programmatically — better than an email nobody reads.

**Build this to actually learn it:** take your existing `/users` route, freeze it as `/v1/users`, then make one breaking change (e.g. change `name` to split `firstName`/`lastName`) in `/v2/users`, and prove both versions work simultaneously against the same underlying data.

---

## 23. Production Hardening

This isn't one technique — it's a checklist of gaps between "works on my machine" and "safe to expose to the internet." Go through each and actually add it to your Week 1 project; don't just read this.

**Security headers**
```js
import helmet from 'helmet';
app.use(helmet());
```
Sets a batch of headers (`X-Content-Type-Options`, `X-Frame-Options`, etc.) that block a handful of common attack classes for free. No reason not to have this on every Express app.

**CORS — explicit, not wide open**
```js
import cors from 'cors';
app.use(cors({ origin: ['https://yourfrontend.com'], credentials: true }));
```
`cors()` with no config allows any origin — fine for a quick demo, wrong for anything with real users or cookies involved.

**Never leak stack traces to the client**
Your error handler from section 11 currently does `res.status(...).send({ message: err.message })`. In production, a raw `err.stack` or internal error message can leak file paths, library versions, or query structure. Split behavior by environment:
```js
app.use((err, req, res, next) => {
  console.error(err); // full detail stays in your logs
  const message = process.env.NODE_ENV === 'production'
    ? 'Internal Server Error'
    : err.message;
  res.status(err.statusCode || 500).send({ message });
});
```

**Uncaught exceptions / unhandled rejections**
Without this, one unhandled promise rejection can crash the whole process silently, or worse, leave it in a broken half-alive state.
```js
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  process.exit(1); // fail fast, let your process manager restart it
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason);
  process.exit(1);
});
```
The mental model: don't try to keep running after an unknown-state crash — exit cleanly and let something outside the process (Docker restart policy, PM2, k8s) bring it back up.

**Trust proxy** (you already flagged this from rate limiting)
```js
app.set('trust proxy', 1);
```
Required for `req.ip` and `req.secure` to be correct behind a load balancer/reverse proxy — otherwise your rate limiter and any IP-based logic silently breaks in production while working fine locally.

**Compression**
```js
import compression from 'compression';
app.use(compression());
```
Gzips responses — cheap win for JSON payload size, basically free to add.

**Request timeouts**
Node doesn't time out slow requests by default — a hung downstream call (DB, external API) can hold a connection open indefinitely.
```js
import timeout from 'connect-timeout';
app.use(timeout('10s'));
```
Combine this with the retry/timeout logic you'd already put around external calls — this is the backstop at the HTTP layer, not a replacement for handling timeouts at the call site.

**Health check endpoint**
```js
app.get('/health', (req, res) => res.status(200).send({ status: 'ok' }));
```
Not just a nice-to-have — this is what load balancers, container orchestrators, and uptime monitors poll to decide whether to send traffic to this instance or restart it. Extend it later to check DB/Redis connectivity, not just "process is alive."

**Process management / restart policy**
Your `app.js` running with plain `node index.js` dies on any crash and stays dead. In production this is handled by something outside your code — Docker's restart policy, PM2, or an orchestrator — not by writing your own retry loop. Concept-level for now: know that "keep the process alive across crashes" is infrastructure's job, not application code's job.

**Environment-based config, never hardcoded secrets**
```js
const PORT = process.env.PORT || 3000;
const API_KEY = process.env.API_KEY;
```
If `API_KEY` or your Redis URL is hardcoded anywhere in your source right now (likely, from your earlier examples), pull it into `.env` and `.gitignore` it — this is the single most common real-world security mistake in early-career code.

**Build this to actually learn it:** take your Week 1 project as it stands and add helmet, compression, trust proxy, the environment-based error handler, the uncaught-exception handlers, and a real health check — then kill the process mid-request (Ctrl+C) and confirm graceful shutdown (section 13) still finishes the in-flight request even with everything else added on top.
