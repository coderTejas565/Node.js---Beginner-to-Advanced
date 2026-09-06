import http from 'node:http';

const port = 8000;

const server = http.createServer((req, res) => {
  const users = [
    { id: 1, name: 'Tejas' },
    { id: 2, name: 'Rahul' },
  ];

  // Convert the request URL into a URL object
  const url = new URL(req.url, 'http://localhost:8000');
  //   console.log(url);

  // Split the URL path into parts
  const parts = url.pathname.split('/');
  // See the different parts of the URL
  console.log(parts);

  // Example of manually handling path parameters
  //   if (parts[1] === 'users' && parts[2]) {

  // // Convert the user ID from string to number
  //     const id = Number(parts[2]);
  //     console.log(id);

  //     const user = users.find((user) => user.id === id);

  //     if (!user) {
  //       res.writeHead(
  //         404,

  //         {
  //           'Content-Type': 'application/json',
  //         },
  //       );
  //       return res.end(
  //         JSON.stringify({
  //           error: 'user not found',
  //         }),
  //       );
  //     }

  //     res.writeHead(200, {
  //       'Content-Type': 'application/json',
  //     });

  //     return res.end(JSON.stringify(user));
  //   }

  // Route requests based on the URL path
  switch (url.pathname) {
    case '/':
      res.writeHead(200, {
        'Content-Type': 'application/json',
      });
      res.end(
        JSON.stringify({
          message: 'Backend server is running',
        }),
      );
      break;

    case '/health':
      res.writeHead(
        200,

        {
          'Content-Type': 'application/json',
        },
      );
      res.end(
        JSON.stringify({
          status: 'ok',
        }),
      );
      break;

    case '/users':
        // Get query parameters from the URL
      const params = url.searchParams;

      if (req.method === 'POST') {
        // Store the incoming request body
        let body = '';

        req.on('data', (chunk) => {
            // Add each chunk to the complete body
          body += chunk;
        });

        // Run after the complete body is received
        req.on('end', () => {
          try {
            // Convert JSON string into a JavaScript object
            const data = JSON.parse(body);
            console.log(data);
            res.writeHead(201, {
              'Content-Type': 'application/json',
            });
            // Send the created user back
            return res.end(
              JSON.stringify({
                message: 'User created',
                user: data,
              }),
            );
          } catch (error) {
            res.writeHead(400, {
              'Content-Type': 'application/json',
            });

            res.end(
              JSON.stringify({
                error: 'Invalid JSON',
              }),
            );
          }
        });
        return;
      }

      if (req.method === 'DELETE') {
        res.writeHead(405, {
          'Content-Type': 'application/json',
        });

        return res.end(
          JSON.stringify({
            message: 'Method Not Allowed',
          }),
        );
      }

      res.writeHead(200, {
        'Content-Type': 'application/json',
      });

      //   console.log(params);
      console.log(req.method);
      console.log(req.url);

      const page = Number(params.get('page')) || 1;
      const limit = Number(params.get('limit')) || 10;

      res.end(
        JSON.stringify({
          page,
          limit,
          users,
        }),
      );
      break;

    default:
      res.writeHead(404, {
        'Content-Type': 'application/json',
      });
      res.end(
        JSON.stringify({
          error: 'page not found',
        }),
      );
  }
});

server.listen(port, () => {
  console.log(`server is listening on ${port}`);
});
