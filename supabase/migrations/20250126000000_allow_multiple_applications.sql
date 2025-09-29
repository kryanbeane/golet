-- Allow multiple applications from the same user to the same listing
-- Remove the unique constraint that prevents this

-- First, drop the existing unique constraint
ALTER TABLE applications DROP CONSTRAINT IF EXISTS applications_listing_id_user_id_key;
ALTER TABLE applications DROP CONSTRAINT IF EXISTS applications_listing_user_unique;

-- Update the add_application_to_queue function to always create new applications
-- instead of updating existing ones
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
  max_attempts INTEGER := 10;
  attempt_count INTEGER := 0;
BEGIN
  -- Always create a new application (allow multiple applications per user per listing)
  LOOP
    attempt_count := attempt_count + 1;
    
    -- Get next position
    SELECT get_next_application_position(listing_uuid) INTO next_position;
    
    -- Try to insert with this position
    BEGIN
      INSERT INTO applications (listing_id, user_id, position, notes, status)
      VALUES (listing_uuid, user_uuid, next_position, application_notes, 'pending')
      RETURNING id INTO application_id;
      
      -- If we get here, the INSERT was successful
      EXIT;
      
    EXCEPTION WHEN unique_violation THEN
      -- Position conflict, try again with a higher position
      IF attempt_count >= max_attempts THEN
        RAISE EXCEPTION 'Could not find available position after % attempts', max_attempts;
      END IF;
      
      -- Continue to try with next position
      CONTINUE;
    END;
  END LOOP;
  
  RETURN application_id;
END;
$;

-- Remove the conflict trigger that was preventing multiple applications
DROP TRIGGER IF EXISTS applications_conflict_trigger ON applications;
DROP FUNCTION IF EXISTS handle_application_conflict();

-- Grant permissions
GRANT EXECUTE ON FUNCTION add_application_to_queue(UUID, UUID, TEXT) TO authenticated;