INSERT INTO users (name, email) VALUES
    ('Tejas', 'tejas@example.com'),
    ('Rahul', 'rahul@example.com'),
    ('Priya', 'priya@example.com');



    INSERT INTO products (name, price_paise, stock_quantity) VALUES
    ('Keyboard', 250000, 20),
    ('Mouse', 120000, 50),
    ('Monitor', 1500000, 10),
    ('USB Cable', 50000, 100);



    INSERT INTO orders (user_id, status)
VALUES
    (1, 'pending'),
    (1, 'completed'),
    (2, 'pending');

    INSERT INTO order_items
    (order_id, product_id, quantity, price_paise)
VALUES
    (1, 1, 2, 250000),
    (1, 2, 1, 120000),
    (2, 3, 1, 1500000),
    (3, 4, 3, 50000);

    SELECT
    users.name,
    orders.id AS order_id,
    orders.status
FROM users
JOIN orders
    ON users.id = orders.user_id;


    SELECT
    users.name AS customer_name,
    orders.id AS order_id,
    orders.status,
    products.name AS product_name,
    order_items.quantity,
    order_items.price_paise
FROM users
JOIN orders
    ON users.id = orders.user_id
JOIN order_items
    ON orders.id = order_items.order_id
JOIN products
    ON order_items.product_id = products.id;


    SELECT * from order_items;


   SELECT
    users.name AS customer_name,
    orders.id AS order_id,
    orders.status,
    SUM(order_items.quantity * order_items.price_paise) AS total_amount 
    FROM users
    JOIN orders
    ON users.id = orders.user_id 
    JOIN order_items
    ON orders.id = order_items.order_id
    GROUP BY users.name, orders.id, orders.status 
    HAVING SUM(order_items.quantity * order_items.price_paise) > 200000
    ORDER BY total_amount DESC;