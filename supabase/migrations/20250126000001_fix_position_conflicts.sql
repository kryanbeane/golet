-- Fix position conflicts in applications table
-- This addresses the applications_listing_id_position_key constraint violation

-- First, let's clean up any duplicate positions that might exist
WITH ranked_applications AS (
  SELECT 
    id,
    listing_id,
    ROW_NUMBER() OVER (PARTITION BY listing_id ORDER BY applied_at, created_at) as new_position
  FROM applications
  WHERE status = 'pending'
)
UPDATE applications 
SET position = ranked_applications.new_position
FROM ranked_applications
WHERE applications.id = ranked_applications.id;

-- Update the get_next_application_position function to be more robust
CREATE OR REPLACE FUNCTION get_next_application_position(listing_uuid UUID)
RETURNS INTEGER
LANGUAGE plpgsql
AS $
DECLARE
  next_position INTEGER;
BEGIN
  -- Use a more robust approach to get the next position
  -- This handles gaps in positions and concurrent access better
  SELECT COALESCE(MAX(position), 0) + 1
  INTO next_position
  FROM applications
  WHERE listing_id = listing_uuid;
  
  -- Double-check that this position doesn't exist (race condition protection)
  WHILE EXISTS (SELECT 1 FROM applications WHERE listing_id = listing_uuid AND position = next_position) LOOP
    next_position := next_position + 1;
  END LOOP;
  
  RETURN next_position;
END;
$;

-- Create a more robust add_application_to_queue function
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
  max_attempts INTEGER := 20;
  attempt_count INTEGER := 0;
BEGIN
  -- Try to insert with retry logic for position conflicts
  LOOP
    attempt_count := attempt_count + 1;
    
    -- Get next available position
    next_position := get_next_application_position(listing_uuid);
    
    -- Try to insert with this position
    BEGIN
      INSERT INTO applications (listing_id, user_id, position, notes, status, applied_at)
      VALUES (listing_uuid, user_uuid, next_position, application_notes, 'pending', NOW())
      RETURNING id INTO application_id;
      
      -- If we get here, the INSERT was successful
      RETURN application_id;
      
    EXCEPTION WHEN unique_violation THEN
      -- Check which constraint was violated
      IF SQLERRM LIKE '%applications_listing_id_position_key%' THEN
        -- Position conflict, try again with next position
        IF attempt_count >= max_attempts THEN
          RAISE EXCEPTION 'Could not find available position after % attempts. Error: %', max_attempts, SQLERRM;
        END IF;
        
        -- Add a small delay to reduce race conditions
        PERFORM pg_sleep(0.01 * attempt_count);
        CONTINUE;
        
      ELSE
        -- Some other constraint violation, re-raise the error
        RAISE;
      END IF;
    END;
  END LOOP;
END;
$;

-- Create a function to check and fix any position conflicts
CREATE OR REPLACE FUNCTION fix_application_positions(listing_uuid UUID DEFAULT NULL)
RETURNS INTEGER
LANGUAGE plpgsql
AS $
DECLARE
  fixed_count INTEGER := 0;
  listing_record RECORD;
BEGIN
  -- If no specific listing provided, fix all listings
  FOR listing_record IN 
    SELECT DISTINCT listing_id 
    FROM applications 
    WHERE (listing_uuid IS NULL OR listing_id = listing_uuid)
  LOOP
    -- Reorder positions for this listing
    WITH ranked_applications AS (
      SELECT 
        id,
        ROW_NUMBER() OVER (ORDER BY applied_at, created_at) as new_position
      FROM applications
      WHERE listing_id = listing_record.listing_id 
      AND status = 'pending'
    )
    UPDATE applications 
    SET position = ranked_applications.new_position
    FROM ranked_applications
    WHERE applications.id = ranked_applications.id
    AND applications.position != ranked_applications.new_position;
    
    GET DIAGNOSTICS fixed_count = fixed_count + ROW_COUNT;
  END LOOP;
  
  RETURN fixed_count;
END;
$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_next_application_position(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION add_application_to_queue(UUID, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION fix_application_positions(UUID) TO authenticated;

-- Run the fix function to clean up any existing position conflicts
SELECT fix_application_positions();