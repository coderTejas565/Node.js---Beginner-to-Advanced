# HTTP — Backend Engineering Notes

## 1. Core Mental Model

> **HTTP is an application-layer request/response protocol.**
> It defines application-level communication semantics; lower layers handle transport and delivery.

```text
Application     HTTP
                  ↓
Transport       TCP / QUIC
                  ↓
Network           IP
                  ↓
Link          Wi-Fi / Ethernet
```

```text
Client ─────── HTTP Request ───────→ Server
Client ←────── HTTP Response ─────── Server
```

---

## 2. HTTP Message Structure

### Request

```text
┌─────────────────────────────┐
│ Request Line                │
│ GET /users HTTP/1.1         │
├─────────────────────────────┤
│ Headers                     │
│ Host: api.example.com       │
│ Authorization: Bearer ...   │
│ Content-Type: application/json
├─────────────────────────────┤
│ Body (optional)             │
│ {"name":"Tejas"}            │
└─────────────────────────────┘
```

### Response

```text
┌─────────────────────────────┐
│ Status Line                 │
│ HTTP/1.1 200 OK             │
├─────────────────────────────┤
│ Headers                     │
│ Content-Type: application/json
│ Cache-Control: ...           │
├─────────────────────────────┤
│ Body (optional)             │
│ {"id":123}                  │
└─────────────────────────────┘
```

### Remember

```text
Request  → Method + URL + Headers + Body
Response → Status + Headers + Body
```

---

## 3. HTTP Methods — Semantics

| Method  | Safe | Idempotent | Typical use           |
| ------- | ---- | ---------- | --------------------- |
| GET     | ✔    | ✔          | Retrieve              |
| HEAD    | ✔    | ✔          | Metadata only         |
| OPTIONS | ✔    | ✔          | Communication/options |
| PUT     | ✘    | ✔          | Replace resource      |
| DELETE  | ✘    | ✔          | Delete resource       |
| POST    | ✘    | ✘          | Create/submit         |
| PATCH   | ✘    | ✘*         | Partial update        |

> *PATCH is not inherently idempotent; an individual PATCH operation can be designed to be idempotent.*

**Safe:** Intended to be read-only from the client's perspective.

**Idempotent:** Repeating the same request has the same intended effect as making it once.

```text
PUT /users/1
{"name":"Tejas"}

→ repeat 10 times
→ final state is still name = Tejas
```

Whereas:

```text
POST /orders
{"productId":123}

→ repeat
→ potentially creates multiple orders
```

### Important

POST can be made safe from duplicate processing using an **idempotency key**.

---

## 4. Headers = Metadata

Headers communicate metadata and protocol control.

Important backend headers:

```text
Authorization
Content-Type
Accept
Cookie
Set-Cookie
Cache-Control
ETag
If-None-Match
Content-Length
Location
Host
User-Agent
```

```text
Headers → metadata + protocol control
Body    → application payload
```

---

## 5. Status Codes

```text
1xx → informational
2xx → success
3xx → redirection
4xx → client/request-side problem
5xx → server-side failure
```

High-value codes:

```text
200 → success
201 → resource created
202 → accepted for asynchronous processing
204 → success, no body

301/302 → redirect
304 → not modified

400 → malformed/invalid request
401 → authentication required/failed
403 → authenticated but forbidden
404 → resource not found
405 → method not allowed
409 → conflict with current resource state
422 → semantically invalid input

429 → rate limited

500 → unexpected server failure
502 → bad upstream response
503 → service unavailable
504 → upstream timeout
```

---

## 6. HTTP Is Stateless

HTTP itself doesn't maintain application session state between requests.

```text
Request A ──→ Server
Request B ──→ Server
Request C ──→ Server
```

State is implemented using mechanisms such as:

```text
Cookies
Sessions
JWT
Authorization headers
Server-side state
```

> **Stateless protocol ≠ stateless application.**

---

## 7. HTTP vs TCP / Transport

HTTP defines **application semantics**.

TCP/QUIC handles **transport**.

```text
HTTP/1.1 ──┐
           ├──→ TCP
HTTP/2  ───┘

HTTP/3 ───────→ QUIC ──→ UDP
```

TCP does not understand:

```text
GET /users
```

It transports bytes.

HTTP gives those bytes application-level meaning.

---

## 8. Connection Evolution

```text
HTTP/1.1
   ↓
Persistent TCP connection
(keep-alive)
   ↓
HTTP/2
   ↓
Multiplexed streams
over one TCP connection
   ↓
HTTP/3
   ↓
QUIC over UDP
```

### HTTP/2

```text
             One TCP Connection
            /       |       \
       Stream A  Stream B  Stream C
          ↓         ↓         ↓
       Request   Request   Request
```

### HTTP/3

QUIC provides independent streams, avoiding TCP's connection-level **head-of-line (HOL) blocking** between streams.

---

## 9. HTTPS

HTTPS = HTTP protected by TLS.

Conceptually:

```text
HTTP
 ↓
TLS
 ↓
TCP
 ↓
IP
```

TLS provides:

```text
Encryption
Authentication
Integrity
```

---

## 10. Transfer-Encoding & Message Framing

When the body size is known:

```http
Content-Length: N
```

The receiver knows how many bytes belong to the body.

When the body is produced incrementally and its length isn't known beforehand:

```http
Transfer-Encoding: chunked
```

Conceptually:

```text
<size>\r\n
<data>\r\n

<size>\r\n
<data>\r\n

0\r\n
\r\n
```

```text
Content-Length
→ fixed-size body

chunked
→ body delivered as size-prefixed chunks
→ 0-length chunk marks the end
```

> Chunked transfer encoding is an HTTP/1.1 message-framing mechanism. HTTP/2 and HTTP/3 use their own framing mechanisms rather than `Transfer-Encoding: chunked`.

---

## 11. HTTP Caching — ETag / 304

Initial request:

```text
Client → GET /resource
Server → 200 OK
         ETag: "abc123"
         Body
```

Later:

```text
Client → GET /resource
         If-None-Match: "abc123"
```

If unchanged:

```text
Server → 304 Not Modified
         No response body
```

If changed:

```text
Server → 200 OK
         ETag: "xyz789"
         New body
```

```text
ETag
 ↓
Client remembers representation version
 ↓
If-None-Match
 ↓
Server validates
 ↓
304 → reuse cached representation
```

---

# 12. Node.js HTTP Mental Model

Node.js gives us low-level access to the HTTP request and response.

```text
Network
   ↓
Node.js HTTP parser
   ↓
IncomingMessage (req)
+
ServerResponse (res)
   ↓
Application logic
```

```js
http.createServer((req, res) => {
  // req → incoming HTTP request
  // res → outgoing HTTP response
});
```

Think:

```text
req
├── method
├── url
├── headers
└── body → Readable Stream

res
├── statusCode
├── headers
└── body → Writable Stream
```

---

# 13. Node.js HTTP Bodies Are Streams

Request body:

```text
Network
   ↓
chunks
   ↓
IncomingMessage
   ↓
application
```

Response:

```text
application
   ↓
ServerResponse
   ↓
chunks
   ↓
Network
```

This enables:

* large uploads/downloads
* streaming responses
* lower memory usage
* backpressure

### Backpressure

```text
res.write(chunk)
       ↓
returns false
       ↓
internal buffer is full
       ↓
stop writing temporarily
       ↓
wait for 'drain'
       ↓
continue
```

> Backpressure prevents a fast producer from overwhelming a slower consumer.

---

# 14. Backend Request Pipeline

```text
Client
  ↓
DNS
  ↓
TCP/TLS
  ↓
HTTP
  ↓
Reverse Proxy / Load Balancer
  ↓
Node.js HTTP Server
  ↓
Routing
  ↓
Middleware
  ↓
Controller
  ↓
Service
  ↓
Database / Cache / External APIs
  ↓
HTTP Response
```

HTTP is the **application-level boundary between network communication and your backend application**.

---

# 15. HTTP in Node.js — Practical

This is where we manually implement the HTTP concepts using Node's built-in `http` module.

## 15.1 Create an HTTP Server

```js
// Import Node's built-in HTTP module
import http from 'node:http';

// Port where our server will run
const port = 8000;

// Create the HTTP server
const server = http.createServer((req, res) => {
  // Server logic goes here
});

// Start listening for requests
server.listen(port, () => {
  console.log(`server is listening on ${port}`);
});
```

Mental model:

```text
Client
  ↓
HTTP Request
  ↓
http.createServer()
  ↓
(req, res)
```

---

## 15.2 Parse the URL

```js
const url = new URL(req.url, 'http://localhost:8000');
```

This gives us useful parts of the URL:

```js
url.pathname
url.searchParams
```

Example:

```text
/users?page=2&limit=5
```

```text
pathname     → /users

searchParams
page         → 2
limit        → 5
```

---

## 15.3 Manual Routing

```js
switch (url.pathname) {
  case '/':
    // Home route
    break;

  case '/health':
    // Health route
    break;

  case '/users':
    // Users route
    break;

  default:
    // Unknown route
}
```

The router checks the URL path and decides which code should handle the request.

---

## 15.4 Query Parameters

Example:

```text
GET /users?page=2&limit=5
```

```js
const params = url.searchParams;

const page = Number(params.get('page')) || 1;
const limit = Number(params.get('limit')) || 10;
```

Mental model:

```text
/users?page=2&limit=5
        ↓
searchParams
        ↓
get('page')  → "2"
get('limit') → "5"
        ↓
Number()
        ↓
2 and 5
```

> Query parameter values initially come in as strings.

---

## 15.5 HTTP Methods

We can inspect the method using:

```js
req.method
```

Example:

```js
if (req.method === 'POST') {
  // Handle POST
}

if (req.method === 'DELETE') {
  // Handle DELETE
}
```

---

## 15.6 Path Parameters

Example:

```text
GET /users/2
```

We can split the pathname:

```js
const parts = url.pathname.split('/');
```

Result:

```text
/users/2

["", "users", "2"]
```

Then:

```js
const id = Number(parts[2]);
```

Now:

```text
"2"
 ↓
Number()
 ↓
2
```

Then we can search for the user:

```js
const user = users.find((user) => user.id === id);
```

---

## 15.7 Request Body

Example request:

```http
POST /users
Content-Type: application/json

{
  "name": "Amit"
}
```

In Node.js, the request body is a **stream**.

We receive it in chunks:

```js
let body = '';

req.on('data', (chunk) => {
  body += chunk;
});
```

When the complete body arrives:

```js
req.on('end', () => {
  // Complete body is available
});
```

Mental model:

```text
Request body
    ↓
Readable stream
    ↓
data chunks
    ↓
collect chunks
    ↓
end
    ↓
complete body
```

### ⚠️ Unbounded body — production gotcha

The pattern above has no size limit. A client can send a huge (or infinite)
body and `body += chunk` will keep growing until the process runs out of
memory — before `'end'` ever fires.

```text
body += chunk, no limit
    ↓
huge/malicious payload
    ↓
memory exhaustion (DoS)
```

Fix: track accumulated byte size and abort past a threshold.

```js
let body = '';
let size = 0;
const MAX_SIZE = 1e6; // 1MB

req.on('data', (chunk) => {
  size += chunk.length;
  if (size > MAX_SIZE) {
    req.destroy(); // stop reading, drop connection
    return;
  }
  body += chunk;
});
```

This is exactly what Express's `body-parser` / `express.json({ limit })`
does for you under the hood — one reason to prefer it over hand-rolled
parsing in real services.

---

## 15.8 Parse JSON

The body initially arrives as a string.

```js
const data = JSON.parse(body);
```

Example:

```text
'{"name":"Amit"}'
        ↓
    JSON.parse()
        ↓
{ name: "Amit" }
```

Because `JSON.parse()` can fail, use `try/catch`:

```js
try {
  const data = JSON.parse(body);
} catch (error) {
  // Invalid JSON
}
```

---

## 15.9 Sending a Response

Set the status and headers:

```js
res.writeHead(200, {
  'Content-Type': 'application/json',
});
```

Then send the response:

```js
res.end(
  JSON.stringify({
    message: 'Success',
  }),
);
```

Mental model:

```text
JavaScript object
       ↓
JSON.stringify()
       ↓
JSON string
       ↓
res.end()
       ↓
HTTP response
```

---

## 15.10 Creating a User

For a successful creation:

```js
res.writeHead(201, {
  'Content-Type': 'application/json',
});
```

`201` means:

```text
Created
```

The response could be:

```js
res.end(
  JSON.stringify({
    message: 'User created',
    user: data,
  }),
);
```

---

## 15.11 Handling Invalid JSON

If the client sends:

```text
{invalid json}
```

Then:

```js
JSON.parse(body);
```

throws an error.

We can respond:

```js
res.writeHead(400, {
  'Content-Type': 'application/json',
});

res.end(
  JSON.stringify({
    error: 'Invalid JSON',
  }),
);
```

```text
400 → Bad Request
```

---

## 15.12 Why `return` Matters

Consider:

```js
if (req.method === 'POST') {
  req.on('data', ...);

  req.on('end', () => {
    res.end(...);
  });

  return;
}
```

The outer `return` stops the current request handler.

Without it:

```text
POST request
    ↓
register body listeners
    ↓
continue executing ❌
    ↓
GET logic may also run
    ↓
multiple responses ❌
```

With it:

```text
POST request
    ↓
register body listeners
    ↓
return
    ↓
outer handler stops
    ↓
body arrives
    ↓
'end' callback runs
    ↓
response sent
```

### Important distinction

```js
return res.end(...)
```

returns from the **callback**.

```js
return;
```

outside the callback stops the **outer request handler**.

---

# 16. What Express Will Abstract

After manually implementing HTTP with Node, Express becomes much easier to understand.

### Raw Node

```js
const url = new URL(req.url, 'http://localhost:8000');

if (url.pathname === '/users' && req.method === 'GET') {
  // ...
}
```

### Express

```js
app.get('/users', (req, res) => {
  // ...
});
```

---

### Raw Node body parsing (unbounded — see 15.7)

```js
let body = '';

req.on('data', (chunk) => {
  body += chunk;
});

req.on('end', () => {
  const data = JSON.parse(body);
});
```

### Express (size-limited by default via `limit` option)

```js
app.use(express.json());

app.post('/users', (req, res) => {
  const data = req.body;
});
```

Express isn't changing HTTP.

It is giving us **higher-level abstractions over Node's HTTP primitives** —
including the size-limiting and buffering safety you'd otherwise have to
hand-roll (see 15.7).

---

# 17. Final Mental Model

```text
                 HTTP
                  │
        ┌─────────┴─────────┐
        ↓                   ↓
     THEORY              NODE.JS
        │                   │
 Request/Response       req / res
 Methods                req.method
 Headers                req.headers
 Body                   req stream
 Status                 res.writeHead()
 URL                    new URL()
 Routing                switch()
        │                   │
        └─────────┬─────────┘
                  ↓
          Backend Engineering
```

## Remember

```text
HTTP
├── Application-layer protocol
├── Request → Response
├── Headers = metadata/control
├── Body = payload
├── Stateless by itself
├── HTTP/1.1 → persistent TCP
├── HTTP/2 → multiplexed streams
├── HTTP/3 → QUIC/UDP
├── ETag → conditional caching
├── Chunked → HTTP/1.1 message framing
└── Node.js → request/response are streams

Node.js HTTP
├── req.method → HTTP method
├── req.url → requested URL
├── req.headers → request metadata
├── new URL() → parse URL
├── searchParams → query parameters
├── pathname → route/path
├── req.on('data') → receive body chunks (cap the size!)
├── req.on('end') → body completely received
├── JSON.parse() → JSON → JS object
├── res.writeHead() → status + headers
└── res.end() → send response
```

## The one-line mental model

> **HTTP defines how clients and servers communicate; Node's `http` module gives us the low-level primitives to implement that communication.**