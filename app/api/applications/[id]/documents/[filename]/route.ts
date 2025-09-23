import { createClient } from '@/utils/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string; filename: string } }
) {
  try {
    const supabase = await createClient()
    
    // Get the authenticated user (should be the landlord)
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const applicationId = params.id
    const filename = params.filename

    // First, verify that the current user is the landlord of the listing for this application
    const { data: application, error: appError } = await supabase
      .from('applications')
      .select(`
        id,
        user_id,
        listing_id,
        listings!inner(
          id,
          user_id
        )
      `)
      .eq('id', applicationId)
      .single()

    if (appError || !application) {
      return NextResponse.json(
        { error: 'Application not found' },
        { status: 404 }
      )
    }

    // Check if the current user is the landlord (owner of the listing)
    if (application.listings.user_id !== user.id) {
      return NextResponse.json(
        { error: 'Unauthorized - You can only download documents for your own listings' },
        { status: 403 }
      )
    }

    // Download the document from the applicant's folder
    const { data, error } = await supabase.storage
      .from('user-documents')
      .download(`${application.user_id}/${filename}`)

    if (error || !data) {
      console.error('Download error:', error)
      return NextResponse.json(
        { error: `Download failed: ${error?.message || 'File not found'}` },
        { status: 404 }
      )
    }

    // Return the file as a blob response
    const headers = new Headers()
    headers.set('Content-Type', data.type || 'application/octet-stream')
    headers.set('Content-Disposition', `attachment; filename="${filename}"`)

    return new NextResponse(data, {
      status: 200,
      headers
    })

  } catch (error) {
    console.error('Application document download API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}