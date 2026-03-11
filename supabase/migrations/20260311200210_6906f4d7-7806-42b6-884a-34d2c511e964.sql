-- Set compare_price_cents for Minecraft Full Acesso (R$ 100,00 = 10000 cents)
-- and set stock to a proper value
UPDATE products 
SET compare_price_cents = 10000, stock = 0 
WHERE id = 'f00cbe98-1fd1-4292-8d81-a8fe0d43af83';

-- Also set default stock = 0 for products with NULL stock
UPDATE products SET stock = 0 WHERE stock IS NULL;