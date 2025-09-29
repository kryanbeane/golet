"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/components/ui/use-toast"
import { 
  FileText,
  CreditCard,
  Briefcase,
  Receipt,
  Home,
  UserCheck,
  PoundSterling,
  Users,
  Zap,
  File,
  Download,
  Loader2,
  ShieldCheck
} from "lucide-react"
import { documentHelpers, DocumentType } from "@/schemas/documents"


interface SharedDocumentInfo {
  filename: string
  documentType: DocumentType
  customName: string
  originalFilename?: string
  mimeType?: string
  size?: number
}

interface ApplicationDocumentViewerProps {
  applicationId: string
  sharedDocuments: SharedDocumentInfo[]
  applicantUserId: string
  className?: string
}

const getDocumentIcon = (type: DocumentType) => {
  const iconMap = {
    proof_of_employment: Briefcase,
    recent_payslip: Receipt,
    bank_statement: CreditCard,
    landlord_reference: Home,
    id_passport: UserCheck,
    proof_of_income: PoundSterling,
    character_reference: Users,
    utility_bill: Zap,
    tenancy_agreement: FileText,
    other: File
  }
  return iconMap[type] || File
}

export function ApplicationDocumentViewer({
  applicationId,
  sharedDocuments,
  applicantUserId,
  className = ""
}: ApplicationDocumentViewerProps) {
  const { toast } = useToast()
  const [loadingDocuments, setLoadingDocuments] = useState<Set<string>>(new Set())

  const handleDocumentDownload = async (document: SharedDocumentInfo) => {
    const documentKey = document.filename
    setLoadingDocuments(prev => new Set(prev).add(documentKey))

    try {
      // Use the API endpoint for downloading applicant documents
      // The API will handle decryption and return the original file
      const response = await fetch(`/api/applications/${applicationId}/documents/${encodeURIComponent(document.filename)}`, {
        method: 'GET',
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Download failed' }))
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`)
      }

      // Get the blob from the response
      let blob = await response.blob()
      
      // Check if the file is encrypted and needs client-side decryption
      const isEncrypted = response.headers.get('X-Encrypted') === 'true'
      const encryptionKey = response.headers.get('X-Encryption-Key')
      const encryptionIV = response.headers.get('X-Encryption-IV')
      const originalFilename = response.headers.get('X-Original-Filename')
      const originalMimetype = response.headers.get('X-Original-Mimetype')
      

      
      if (isEncrypted && encryptionKey && encryptionIV) {
        // Check if Web Crypto API is available (requires HTTPS on mobile)
        if (!window.crypto || !window.crypto.subtle) {
          // Retry with server-side decryption for mobile devices
          toast({
            title: "Retrying Download",
            description: "Using server-side decryption for mobile compatibility...",
          })

          const retryResponse = await fetch(`/api/applications/${applicationId}/documents/${encodeURIComponent(document.filename)}`, {
            method: 'GET',
            headers: {
              'X-Force-Server-Decryption': 'true'
            }
          })

          if (!retryResponse.ok) {
            throw new Error('Server-side decryption failed')
          }

          blob = await retryResponse.blob()
          
          // Get filename from retry response
          const retryContentDisposition = retryResponse.headers.get('Content-Disposition')
          if (retryContentDisposition) {
            const filenameMatch = retryContentDisposition.match(/filename="([^"]+)"/)
            if (filenameMatch) {
              filename = filenameMatch[1]
            }
          }

          toast({
            title: "Document Ready",
            description: "Document has been prepared for download.",
          })
        } else {
          try {
            // Import the DocumentEncryption class
            const { DocumentEncryption } = await import('@/utils/encryption')
            
            // Decrypt the file on the client side
            const encryptedBuffer = await blob.arrayBuffer()
            const iv = new Uint8Array(encryptionIV.split(',').map(Number))
            
            const decryptedBuffer = await DocumentEncryption.decryptFile(
              encryptedBuffer,
              encryptionKey,
              iv
            )
            
            // Create a new blob with the decrypted data and original mime type
            blob = new Blob([decryptedBuffer], { type: originalMimetype || blob.type })
            
            toast({
              title: "Document Decrypted",
              description: "Document has been securely decrypted for download.",
            })
          } catch (decryptError) {
            console.error('Client-side decryption failed:', decryptError)
            
            // Provide more helpful error message for crypto issues
            if (decryptError.message.includes('crypto') || decryptError.message.includes('subtle')) {
              throw new Error('Document decryption failed - please use HTTPS or try on desktop')
            }
            
            throw new Error(`Failed to decrypt document: ${decryptError.message}`)
          }
        }
      }
      
      // Get the filename from headers or use fallback
      let filename = originalFilename || document.originalFilename || document.customName
      
      const contentDisposition = response.headers.get('Content-Disposition')
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="([^"]+)"/)
        if (filenameMatch) {
          filename = filenameMatch[1]
        }
      }

      // Create download link
      const url = URL.createObjectURL(blob)
      const link = window.document.createElement('a')
      link.href = url
      link.download = filename
      link.style.display = 'none'
      
      // Append to body, click, and remove
      window.document.body.appendChild(link)
      link.click()
      window.document.body.removeChild(link)
      
      // Clean up the URL
      setTimeout(() => URL.revokeObjectURL(url), 100)

      toast({
        title: "Download Complete",
        description: `Successfully downloaded ${document.customName}`,
      })

    } catch (error) {
      console.error('Error downloading document:', error)
      toast({
        title: "Download Failed",
        description: error instanceof Error ? error.message : "Failed to download document",
        variant: "destructive",
      })
    } finally {
      setLoadingDocuments(prev => {
        const newSet = new Set(prev)
        newSet.delete(documentKey)
        return newSet
      })
    }
  }

  if (!sharedDocuments.length) {
    return (
      <Card className={className}>
        <CardContent className="text-center py-8">
          <FileText className="h-12 w-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-600">No documents shared with this application</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <ShieldCheck className="h-5 w-5 text-green-600" />
              Shared Documents
            </CardTitle>
            <CardDescription>
              {sharedDocuments.length} document{sharedDocuments.length !== 1 ? 's' : ''} shared by the applicant
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        <div className="space-y-3">
          {sharedDocuments.map((document, index) => {
            const IconComponent = getDocumentIcon(document.documentType)
            const isLoading = loadingDocuments.has(document.filename)
            
            return (
              <div
                key={`${document.filename}-${index}`}
                className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 border rounded-lg bg-white hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="bg-gray-100 p-2 rounded-lg shrink-0">
                    <IconComponent className="h-5 w-5 text-gray-600" />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 mb-1">
                      <h4 className="font-medium text-gray-900 truncate">
                        {document.customName}
                      </h4>
                      <Badge variant="outline" className="text-xs shrink-0 w-fit">
                        {documentHelpers.getDocumentTypeLabel(document.documentType)}
                      </Badge>
                    </div>
                    
                    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 text-sm text-gray-500">
                      {document.size && (
                        <span>{documentHelpers.formatFileSize(document.size)}</span>
                      )}
                      {document.filename.endsWith('.enc') && (
                        <div className="flex items-center gap-1 text-green-600">
                          <ShieldCheck className="h-3 w-3" />
                          <span className="text-xs">Encrypted</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 sm:ml-4 shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDocumentDownload(document)}
                    disabled={isLoading}
                    className="flex items-center gap-1 w-full sm:w-auto"
                  >
                    {isLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4" />
                    )}
                    Download
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}