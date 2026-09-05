import http from 'node:http';

const port = 8000;

const server = http.createServer((req, res) => {
  const users = [
    { id: 1, name: 'Tejas' },
    { id: 2, name: 'Rahul' },
  ];

  const url = new URL(req.url, 'http://localhost:8000');
  console.log(url);

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
      const params = url.searchParams;

      if (req.method === 'POST') {
        res.writeHead(201, {
          'Content-Type': 'application/json',
        });

        return res.end(
          JSON.stringify({
            message: 'User created',
          }),
        );
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
