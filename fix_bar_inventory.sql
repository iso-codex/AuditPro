-- 1. Remove corrupted/unknown items (where item_id is missing or invalid)
DELETE FROM department_inventory 
WHERE item_id IS NULL OR item_id NOT IN (SELECT id FROM items);

-- 2. Halve the inventory for all Bar department items (Optional - remove if you don't want to halve them again)
-- If your quantities are already correct for known items, DO NOT run this second part.
-- UPDATE department_inventory
-- SET quantity = quantity / 2
-- WHERE department ILIKE '%Bar%';
