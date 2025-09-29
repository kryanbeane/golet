"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/components/ui/use-toast"
import { useRouter } from "next/navigation"
import { createApiClient } from "@/utils/supabase/api"
import { createClient } from "@/utils/supabase/client"
import { Mail, ArrowLeft, CheckCircle } from "lucide-react"
import Link from "next/link"

interface OtpVerificationProps {
  email: string
  onComplete: () => void
  onBack: () => void
}

export function OtpVerification({ email, onComplete, onBack }: OtpVerificationProps) {
  const { toast } = useToast()
  const router = useRouter()
  const api = createApiClient(createClient())
  
  const [otp, setOtp] = useState(["", "", "", "", "", ""])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [resendLoading, setResendLoading] = useState(false)
  const [countdown, setCountdown] = useState(0)
  
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])

  // Countdown timer for resend
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000)
      return () => clearTimeout(timer)
    }
  }, [countdown])

  const handleOtpChange = (index: number, value: string) => {
    if (value.length > 1) return // Only allow single digit
    
    const newOtp = [...otp]
    newOtp[index] = value
    setOtp(newOtp)
    setError("")

    // Auto-focus next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus()
    }
  }

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      // Move to previous input on backspace if current is empty
      inputRefs.current[index - 1]?.focus()
    }
  }

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault()
    const pastedData = e.clipboardData.getData("text/plain").replace(/\D/g, "")
    if (pastedData.length === 6) {
      const newOtp = pastedData.split("")
      setOtp(newOtp)
      setError("")
    }
  }

  const handleVerify = async () => {
    const otpString = otp.join("")
    if (otpString.length !== 6) {
      setError("Please enter the 6-digit verification code")
      return
    }

    setLoading(true)
    setError("")

    try {
      await api.verifyOtp(email, otpString)
      
      toast({
        title: "Email Verified!",
        description: "Your email has been successfully verified.",
      })

      // After OTP verification, call onComplete to handle next step
      // without redirecting - let the parent component decide
      onComplete()
    } catch (error) {
      console.error('OTP verification error:', error)
      setError(error instanceof Error ? error.message : 'Verification failed')
    } finally {
      setLoading(false)
    }
  }

  const handleResend = async () => {
    setResendLoading(true)
    try {
      const response = await fetch('/api/resend-verification', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send verification email')
      }
      
      toast({
        title: "Verification Email Sent!",
        description: "A verification email has been sent. Please check your inbox and spam folder.",
      })
      
      setCountdown(60) // 60 second cooldown
    } catch (error) {
      console.error('Resend error:', error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to send verification email. Please try again.",
        variant: "destructive",
      })
    } finally {
      setResendLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-md mx-auto">
        <CardHeader className="text-center">
          <div className="bg-primary/10 p-3 rounded-full w-fit mx-auto mb-4">
            <Mail className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-2xl">Verify Your Email</CardTitle>
          <CardDescription className="space-y-2">
            <p>We've sent a verification email to <strong>{email}</strong></p>
            <p className="text-sm text-muted-foreground">
              You can either click the link in the email or enter the 6-digit code below
            </p>
          </CardDescription>
        </CardHeader>

        <CardContent>
          <div className="space-y-6">
            {/* OTP Input */}
            <div className="space-y-4">
              <Label htmlFor="otp">Enter verification code</Label>
              <div className="flex gap-1 sm:gap-2 justify-center px-2 max-w-full overflow-hidden" onPaste={handlePaste}>
                {otp.map((digit, index) => (
                  <Input
                    key={index}
                    ref={(el) => {
                      inputRefs.current[index] = el
                    }}
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleOtpChange(index, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(index, e)}
                    className="w-10 h-10 sm:w-12 sm:h-12 text-center text-base sm:text-lg font-semibold flex-shrink-0 min-w-0"
                    disabled={loading}
                    autoComplete="one-time-code"
                  />
                ))}
              </div>
              {error && <p className="text-sm text-red-500 text-center">{error}</p>}
            </div>

            {/* Verify Button */}
            <Button 
              onClick={handleVerify} 
              disabled={loading || otp.join("").length !== 6}
              className="w-full"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Verifying...
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Verify Email
                </>
              )}
            </Button>

            {/* Alternative Options */}
            <div className="text-center space-y-3">
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">Or</span>
                </div>
              </div>
              
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  Check your email and click the verification link
                </p>
                <p className="text-xs text-muted-foreground">
                  Didn't receive the email?
                </p>
                <Button
                  variant="link"
                  onClick={handleResend}
                  disabled={resendLoading || countdown > 0}
                  className="text-sm"
                >
                  {resendLoading ? "Sending..." : 
                   countdown > 0 ? `Resend in ${countdown}s` : "Resend verification email"}
                </Button>
              </div>
            </div>

            {/* Back Button */}
            <div className="text-center">
              <Button
                variant="ghost"
                onClick={onBack}
                disabled={loading}
                className="text-sm"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to sign up
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
} 