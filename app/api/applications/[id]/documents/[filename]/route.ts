import { createClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; filename: string }> }
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

    const { id: applicationId, filename } = await params

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

    // Get the shared documents from the application to find the correct filename
    const { data: appData, error: appDataError } = await supabase
      .from('applications')
      .select('shared_documents')
      .eq('id', applicationId)
      .single()

    if (appDataError || !appData) {
      return NextResponse.json(
        { error: 'Application data not found' },
        { status: 404 }
      )
    }

    const sharedDocuments = appData.shared_documents as Array<{
      filename: string
      documentType: string
      customName: string
      originalFilename?: string
      mimeType?: string
      size?: number
    }> || []

    // Find the document in the shared documents list
    const sharedDoc = sharedDocuments.find(doc => doc.filename === filename)
    if (!sharedDoc) {
      return NextResponse.json(
        { error: 'Document not found in shared documents' },
        { status: 404 }
      )
    }

    // Download the document from the applicant's folder
    // The filename in shared_documents includes the full path (user_id/filename)
    // We need to extract just the filename part for the storage path
    let downloadPath: string
    
    if (filename.includes('/')) {
      // Filename includes path separator, extract the actual filename
      const pathParts = filename.split('/')
      if (pathParts.length >= 2 && pathParts[0] === application.user_id) {
        // Path is correct format: user_id/actual_filename
        downloadPath = filename
      } else {
        // Path format is unexpected, use as-is but log warning
        console.warn('Unexpected filename format:', filename)
        downloadPath = filename
      }
    } else {
      // Filename is just the document name, need to add user ID prefix
      downloadPath = `${application.user_id}/${filename}`
    }
    

    
    // Create a service role client to bypass RLS for file access
    const serviceSupabase = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
    
    // Use the service role client to download the file
    const { data, error } = await serviceSupabase.storage
      .from('user-documents')
      .download(downloadPath)

    if (error || !data) {
      console.error('Download error:', error)
      console.error('Attempted path:', downloadPath)
      
      // Try to list files in the user's directory to debug using service role
      const { data: files, error: listError } = await serviceSupabase.storage
        .from('user-documents')
        .list(application.user_id, { limit: 100 })
      
      console.error('Available files in user directory:', files?.map(f => f.name))
      
      return NextResponse.json(
        { error: `Download failed: ${error?.message || 'File not found'}. Attempted path: ${downloadPath}. Available files: ${files?.map(f => f.name).join(', ') || 'none'}` },
        { status: 404 }
      )
    }

    let finalData: Blob | ArrayBuffer = data
    let finalFilename = sharedDoc.originalFilename || sharedDoc.customName
    let finalMimeType = sharedDoc.mimeType || data.type || 'application/octet-stream'

    // Check if client requested server-side decryption (for mobile devices without crypto support)
    const forceServerDecryption = request.headers.get('X-Force-Server-Decryption') === 'true'

    // Create response headers
    const headers = new Headers()
    headers.set('Content-Type', finalMimeType)
    headers.set('Content-Disposition', `attachment; filename="${finalFilename}"`)

    // Extract the actual filename from the path for encryption check
    const actualFilename = filename.includes('/') ? filename.split('/').pop() || filename : filename
    

    
    // For encrypted files, we'll return the encrypted data with metadata
    // The client will handle decryption to avoid server-side crypto issues
    // Check if filename contains .enc and __META__ (the .enc might not be at the end due to metadata)
    if (actualFilename.includes('.enc') && actualFilename.includes('__META__')) {
      try {
        // Extract metadata from actual filename
        const parts = actualFilename.split('__META__')
        if (parts.length >= 2) {
          const encodedMetadata = parts[1]
          const metadataString = atob(encodedMetadata)
          const metadata = JSON.parse(metadataString)



          // Set the original filename and mime type from metadata
          finalFilename = metadata.original_filename || sharedDoc.customName
          finalMimeType = metadata.original_mimetype || 'application/octet-stream'

          if (forceServerDecryption && metadata.encrypted === 'true' && metadata.encryption_key && metadata.encryption_iv) {
            // Decrypt on server side for mobile devices
            try {
              const { DocumentEncryption } = await import('@/utils/encryption')
              
              const encryptedBuffer = await data.arrayBuffer()
              const iv = new Uint8Array(metadata.encryption_iv.split(',').map(Number))

              const decryptedBuffer = await DocumentEncryption.decryptFile(
                encryptedBuffer,
                metadata.encryption_key,
                iv
              )

              // Return decrypted file
              finalData = decryptedBuffer
              headers.set('Content-Type', finalMimeType)
              headers.set('Content-Disposition', `attachment; filename="${finalFilename}"`)
            } catch (serverDecryptError) {
              console.error('Server-side decryption failed:', serverDecryptError)
              // Fall back to sending encrypted data with headers
              headers.set('Content-Type', 'application/octet-stream')
              headers.set('Content-Disposition', `attachment; filename="${finalFilename}"`)
              headers.set('X-Encryption-Key', metadata.encryption_key)
              headers.set('X-Encryption-IV', metadata.encryption_iv)
              headers.set('X-Original-Filename', metadata.original_filename || '')
              headers.set('X-Original-Mimetype', metadata.original_mimetype || '')
              headers.set('X-Original-Size', metadata.original_size || '')
              headers.set('X-Encrypted', 'true')
            }
          } else {
            // Send encrypted data with headers for client-side decryption
            headers.set('Content-Type', 'application/octet-stream')
            headers.set('Content-Disposition', `attachment; filename="${finalFilename}"`)
            headers.set('X-Encryption-Key', metadata.encryption_key)
            headers.set('X-Encryption-IV', metadata.encryption_iv)
            headers.set('X-Original-Filename', metadata.original_filename || '')
            headers.set('X-Original-Mimetype', metadata.original_mimetype || '')
            headers.set('X-Original-Size', metadata.original_size || '')
            headers.set('X-Encrypted', 'true')
          }
        }
      } catch (metadataError) {
        console.error('Error parsing metadata:', metadataError)
        // Continue with serving the file as-is
      }
    }

    return new NextResponse(finalData, {
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