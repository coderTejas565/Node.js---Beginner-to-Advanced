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

---

## 3. HTTP Methods — Semantics

| Method  | Safe | Idempotent | Typical use           |
| ------- | ---: | ---------: | --------------------- |
| GET     |    ✔ |          ✔ | Retrieve              |
| HEAD    |    ✔ |          ✔ | Metadata only         |
| OPTIONS |    ✔ |          ✔ | Communication/options |
| PUT     |    ✘ |          ✔ | Replace resource      |
| DELETE  |    ✘ |          ✔ | Delete resource       |
| POST    |    ✘ |          ✘ | Create/submit         |
| PATCH   |    ✘ |         ✘* | Partial update        |

> *PATCH is not inherently idempotent; an individual PATCH operation can be designed to be idempotent.

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

→ receiver knows exactly how many bytes belong to the body.

When the body is produced incrementally and length isn't known beforehand:

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

**Important:** Chunked transfer encoding is an HTTP/1.1 message-framing mechanism. HTTP/2 and HTTP/3 use their own framing mechanisms rather than `Transfer-Encoding: chunked`.

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

## 12. Node.js HTTP Mental Model

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

## 13. Node.js HTTP Bodies Are Streams

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

- large uploads/downloads
- streaming responses
- lower memory usage
- backpressure

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

## 14. Backend Request Pipeline

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

# Core Mental Model

```text
HTTP REQUEST
├── Method
├── Target
├── Headers
└── Body

        ↓

      SERVER

        ↓

HTTP RESPONSE
├── Status
├── Headers
└── Body
```

### Remember

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
├── Chunked → HTTP/1.1 streaming/framing
└── Node.js → request/response are streams
```
