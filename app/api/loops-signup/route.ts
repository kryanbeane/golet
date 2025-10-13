import { NextRequest, NextResponse } from 'next/server';

/**
 * API route to handle email signups via Loops
 * This endpoint receives an email address and adds it to the Loops mailing list
 */
export async function POST(req: NextRequest) {
  try {
    // Parse the request body to get the email
    const { email } = await req.json();

    // Validate email format
    if (!email || typeof email !== 'string') {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    // Basic email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      );
    }

    // Get Loops API key from environment variables
    const loopsApiKey = process.env.LOOPS_API_KEY;
    
    if (!loopsApiKey) {
      console.error('LOOPS_API_KEY is not configured');
      return NextResponse.json(
        { error: 'Email signup service is not configured' },
        { status: 500 }
      );
    }

    // Call Loops API to add contact
    const loopsResponse = await fetch('https://app.loops.so/api/v1/contacts/create', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${loopsApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: email.toLowerCase().trim(),
        source: 'GoLet Landing Page',
      }),
    });

    const loopsData = await loopsResponse.json();

    // Handle Loops API response
    if (!loopsResponse.ok) {
      console.error('Loops API error:', loopsData);
      
      // Check if the email already exists (not an error from user perspective)
      if (loopsData.message && loopsData.message.includes('already exists')) {
        return NextResponse.json(
          { success: true, message: 'You\'re already on our list!' },
          { status: 200 }
        );
      }
      
      return NextResponse.json(
        { error: 'Failed to add email to mailing list' },
        { status: 500 }
      );
    }

    // Success response
    return NextResponse.json(
      { 
        success: true, 
        message: 'Successfully joined the waitlist!' 
      },
      { status: 200 }
    );

  } catch (error) {
    console.error('Error in loops-signup API:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}

