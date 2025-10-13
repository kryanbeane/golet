import { createBrowserClient } from '@supabase/ssr';
import { Database } from '@/types_db';

// Define a function to create a Supabase client for client-side operations
// Handles missing environment variables gracefully during build time
export const createClient = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  // During build time or if env vars are missing, return a client with placeholder values
  // This prevents build failures while still allowing runtime to fail gracefully
  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('Supabase environment variables not configured - using placeholder client');
    // Create a client with placeholder values that won't actually work
    // but will allow the build to succeed
    return createBrowserClient<Database>(
      'https://placeholder.supabase.co',
      'placeholder-anon-key'
    );
  }
  
  const client = createBrowserClient<Database>(
    // Pass Supabase URL and anonymous key from the environment to the client
    supabaseUrl,
    supabaseAnonKey
  );

  return client;
};

// Utility function to safely get user session with error handling
export const getSafeUser = async () => {
  const supabase = createClient();
  try {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error) {
      // Handle refresh token errors gracefully
      if (error.code === 'refresh_token_not_found' || 
          error.message?.includes('Invalid Refresh Token')) {
        console.log('No valid session found');
        return { user: null, error: null };
      } else {
        console.error('Authentication error:', error);
        return { user: null, error };
      }
    }
    return { user, error: null };
  } catch (error: any) {
    console.error('Unexpected error getting user:', error);
    return { user: null, error };
  }
};
