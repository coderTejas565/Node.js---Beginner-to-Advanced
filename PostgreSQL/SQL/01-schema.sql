
DROP TABLE IF EXISTS order_items;
DROP TABLE IF EXISTS orders;
DROP TABLE IF EXISTS products;
DROP TABLE IF EXISTS users;


CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


CREATE TABLE products (
    id SERIAL PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    price_paise INTEGER NOT NULL
        CHECK (price_paise >= 0),
    stock_quantity INTEGER NOT NULL
        CHECK (stock_quantity >= 0),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


CREATE TABLE orders (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL
        REFERENCES users(id),
    status VARCHAR(50) NOT NULL
        CHECK (status IN ('pending', 'completed', 'cancelled')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


CREATE TABLE order_items (
    id SERIAL PRIMARY KEY,

    order_id INTEGER NOT NULL
        REFERENCES orders(id),

    product_id INTEGER NOT NULL
        REFERENCES products(id),

    quantity INTEGER NOT NULL
        CHECK (quantity > 0),

    price_paise INTEGER NOT NULL
        CHECK (price_paise >= 0),

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE (order_id, product_id)
);


CREATE INDEX idx_orders_user_id
ON orders(user_id);

CREATE INDEX idx_order_items_order_id
ON order_items(order_id);

CREATE INDEX idx_order_items_product_id
ON order_items(product_id);