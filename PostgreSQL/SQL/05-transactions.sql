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

