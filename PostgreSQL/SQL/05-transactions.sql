-- 1. ROLLBACK
-- Changes inside the transaction are discarded.

BEGIN;

INSERT INTO users (name, email)
VALUES ('Transaction Test', 'transaction@example.com');

ROLLBACK;



-- 2. COMMIT
-- Changes inside the transaction are permanently saved.


BEGIN;

INSERT INTO users (name, email)
VALUES ('Transaction Test', 'transaction@example.com');

COMMIT;

SELECT *
FROM users
WHERE email = 'transaction@example.com';



-- 3. TRANSACTION WITH MULTIPLE OPERATIONS
-- All operations should succeed before COMMIT.
--
-- If any operation fails, the entire transaction
-- should be rolled back.


BEGIN;

INSERT INTO orders (user_id, status)
VALUES (2, 'pending')
RETURNING id;

-- Use the returned order ID for the order_items insert.



-- 4. COMPLETE ORDER TRANSACTION
-- Order + order item are committed together.


-- Current successful example uses order_id = 8.

INSERT INTO order_items
    (order_id, product_id, quantity, price_paise)
VALUES
    (8, 1, 2, 250000);

COMMIT;


-- Verify the transaction
SELECT *
FROM orders
WHERE id = 8;

SELECT *
FROM order_items
WHERE order_id = 8;



-- Key idea:
--
-- BEGIN
--   ↓
-- Multiple database operations
--   ↓
-- Everything succeeds → COMMIT
-- Anything fails       → ROLLBACK
--
-- This gives us ATOMICITY:
-- either all related changes happen,
-- or none of them happen.



-- Check current stock before the transaction.
SELECT id, name, stock_quantity
FROM products
WHERE id = 1;


-- Order creation + item creation + stock update must succeed together.
BEGIN;

-- Create the order and get its generated ID.
INSERT INTO orders (user_id, status)
VALUES (2, 'pending')
RETURNING id;

-- Add the purchased product to the order.
INSERT INTO order_items
    (order_id, product_id, quantity, price_paise)
VALUES
    (11, 1, 2, 250000);

-- Reduce stock only if enough inventory is available.
UPDATE products
SET stock_quantity = stock_quantity - 2
WHERE id = 1
  AND stock_quantity >= 2;

COMMIT;


-- Verify the updated stock.
SELECT stock_quantity
FROM products
WHERE id = 1;