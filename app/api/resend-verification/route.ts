import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email || typeof email !== 'string') {
      return NextResponse.json(
        { error: 'Valid email is required' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Use the exact same method as the original signup
    const res = await supabase.auth.signUp({
      email: email,
      password: 'temp_password_for_resend', // This won't matter for existing users
      options: {
        emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/auth_callback`
      }
    });

    if (res.error) {
      console.log('SignUp error details:', res.error);
      
      // Handle the same way as original signup - these errors are expected for existing users
      if (res.error.message.includes('User already registered')) {
        // This is expected for existing users, email should still be sent
        console.log('User already registered, verification email should be sent');
      } else if (res.error.message.includes('Email not confirmed')) {
        // This is also expected, email should be sent
        console.log('Email not confirmed, verification email should be sent');
      } else if (res.error.message.includes('Signup disabled')) {
        return NextResponse.json(
          { error: 'Signup is currently disabled. Please contact support.' },
          { status: 500 }
        );
      } else if (res.error.message.includes('Invalid email')) {
        return NextResponse.json(
          { error: 'Please enter a valid email address.' },
          { status: 400 }
        );
      } else {
        // Unexpected error
        console.error('Unexpected resend verification error:', res.error);
        return NextResponse.json(
          { error: `Failed to send verification email: ${res.error.message}` },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Verification email sent successfully' 
    });

  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}