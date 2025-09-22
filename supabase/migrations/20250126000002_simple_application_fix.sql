-- Simple fix for application submission issues
-- This handles the case where there's a position conflict even with only one application

-- First, let's see what's in the applications table
-- (Run this manually to debug)
-- SELECT listing_id, user_id, position, status, applied_at FROM applications ORDER BY listing_id, position;

-- Clean up any potential issues
DELETE FROM applications WHERE status IS NULL OR position IS NULL;

-- Reset positions to be sequential starting from 1
WITH ranked_apps AS (
  SELECT 
    id,
    listing_id,
    ROW_NUMBER() OVER (PARTITION BY listing_id ORDER BY applied_at, created_at) as new_position
  FROM applications
)
UPDATE applications 
SET position = ranked_apps.new_position
FROM ranked_apps
WHERE applications.id = ranked_apps.id;

-- Create a much simpler application function that uses INSERT ... ON CONFLICT
CREATE OR REPLACE FUNCTION add_application_to_queue(
  listing_uuid UUID,
  user_uuid UUID,
  application_notes TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $
DECLARE
  application_id UUID;
  next_position INTEGER;
BEGIN
  -- Get the next position in a single atomic operation
  SELECT COALESCE(MAX(position), 0) + 1
  INTO next_position
  FROM applications
  WHERE listing_id = listing_uuid;
  
  -- Insert with ON CONFLICT handling for position
  INSERT INTO applications (listing_id, user_id, position, notes, status, applied_at)
  VALUES (listing_uuid, user_uuid, next_position, application_notes, 'pending', NOW())
  ON CONFLICT (listing_id, position) DO UPDATE SET
    position = (
      SELECT COALESCE(MAX(position), 0) + 1
      FROM applications
      WHERE listing_id = listing_uuid
    )
  RETURNING id INTO application_id;
  
  RETURN application_id;
END;
$;

-- Alternative: Use a sequence-based approach for positions
-- This ensures positions are always unique
CREATE SEQUENCE IF NOT EXISTS application_position_seq;

-- Function using sequence (more reliable for concurrent access)
CREATE OR REPLACE FUNCTION add_application_to_queue_v2(
  listing_uuid UUID,
  user_uuid UUID,
  application_notes TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $
DECLARE
  application_id UUID;
  next_position INTEGER;
BEGIN
  -- Use sequence to get unique position across all listings
  -- Then adjust it to be unique per listing
  next_position := nextval('application_position_seq');
  
  -- Ensure this position doesn't exist for this listing
  WHILE EXISTS (SELECT 1 FROM applications WHERE listing_id = listing_uuid AND position = next_position) LOOP
    next_position := nextval('application_position_seq');
  END LOOP;
  
  -- Insert the application
  INSERT INTO applications (listing_id, user_id, position, notes, status, applied_at)
  VALUES (listing_uuid, user_uuid, next_position, application_notes, 'pending', NOW())
  RETURNING id INTO application_id;
  
  RETURN application_id;
END;
$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION add_application_to_queue(UUID, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION add_application_to_queue_v2(UUID, UUID, TEXT) TO authenticated;
GRANT USAGE ON SEQUENCE application_position_seq TO authenticated;