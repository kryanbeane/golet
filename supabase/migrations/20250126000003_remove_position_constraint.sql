-- Remove the position unique constraint that's causing conflicts
-- This allows multiple applications to have the same position temporarily during concurrent submissions

-- Drop the unique constraint on (listing_id, position)
ALTER TABLE applications DROP CONSTRAINT IF EXISTS applications_listing_id_position_key;

-- Also remove the unique constraint on (listing_id, user_id) if it still exists
-- This was supposed to be removed in earlier migrations but let's make sure
ALTER TABLE applications DROP CONSTRAINT IF EXISTS applications_listing_id_user_id_key;

-- Create a simple, robust function for adding applications
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
  -- Get the next position (this is now safe since we removed the unique constraint)
  SELECT COALESCE(MAX(position), 0) + 1
  INTO next_position
  FROM applications
  WHERE listing_id = listing_uuid;
  
  -- Insert the application - no more position conflicts possible
  INSERT INTO applications (listing_id, user_id, position, notes, status, applied_at)
  VALUES (listing_uuid, user_uuid, next_position, application_notes, 'pending', NOW())
  RETURNING id INTO application_id;
  
  RETURN application_id;
END;
$;

-- Create a function to clean up and reorder positions if needed
CREATE OR REPLACE FUNCTION reorder_application_positions(listing_uuid UUID DEFAULT NULL)
RETURNS INTEGER
LANGUAGE plpgsql
AS $
DECLARE
  reordered_count INTEGER := 0;
  current_count INTEGER;
  listing_record RECORD;
BEGIN
  -- If no specific listing provided, fix all listings
  FOR listing_record IN 
    SELECT DISTINCT listing_id 
    FROM applications 
    WHERE (listing_uuid IS NULL OR listing_id = listing_uuid)
  LOOP
    -- Reorder positions for this listing to be sequential
    WITH ranked_applications AS (
      SELECT 
        id,
        ROW_NUMBER() OVER (ORDER BY applied_at, created_at) as new_position
      FROM applications
      WHERE listing_id = listing_record.listing_id 
      ORDER BY applied_at, created_at
    )
    UPDATE applications 
    SET position = ranked_applications.new_position
    FROM ranked_applications
    WHERE applications.id = ranked_applications.id;
    
    GET DIAGNOSTICS current_count = ROW_COUNT;
    reordered_count := reordered_count + current_count;
  END LOOP;
  
  RETURN reordered_count;
END;
$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION add_application_to_queue(UUID, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION reorder_application_positions(UUID) TO authenticated;

-- Clean up any existing position conflicts by reordering
SELECT reorder_application_positions();