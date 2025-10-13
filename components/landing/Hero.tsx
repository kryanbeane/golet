'use client';
import { Button } from '@/components/ui/button';
import { Input } from "@/components/ui/input"
import { User } from '@supabase/supabase-js';
import { useState } from 'react';
import { useToast } from '@/components/ui/use-toast';

export const Hero = ({ user }: { user: User | null }) => {
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Handle email signup submission
  const handleEmailSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Basic validation
    if (!email.trim()) {
      toast({
        title: 'Email required',
        description: 'Please enter your email address',
        variant: 'destructive'
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // Call the Loops API endpoint
      const response = await fetch('/api/loops-signup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        // Success - show positive message
        toast({
          title: 'Success!',
          description: data.message || 'You\'ve been added to our waitlist',
        });
        // Clear the email input
        setEmail('');
      } else {
        // Error from API
        toast({
          title: 'Oops!',
          description: data.error || 'Something went wrong. Please try again.',
          variant: 'destructive'
        });
      }
    } catch (error) {
      console.error('Error submitting email:', error);
      toast({
        title: 'Error',
        description: 'Failed to submit. Please check your connection and try again.',
        variant: 'destructive'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section
      className="
        container grid lg:grid-cols-2 place-items-center py-20 md:py-32 gap-10
        lg:bg-[url('/hero-bg.png')] lg:bg-contain lg:bg-no-repeat lg:bg-center
      "
    >
      <div className="flex flex-col items-center text-center space-y-6 lg:items-start lg:text-start">
        <main className="text-5xl md:text-6xl font-bold">
          <h1 className="inline">
            The Only {' '}
          <span className="bg-gradient-to-b from-primary/60 to-primary text-transparent bg-clip-text">
              Safe
            </span>{' '}
          </h1>
          <h2 className="inline">
          way to rent in Ireland!
            </h2>
        </main>

        <p className="text-xl text-muted-foreground md:w-10/12 mx-auto lg:mx-0">
        We can't fix the housing crisis, but we can make renting safer. Ireland's first rental platform with Scam and Deposit protection, in-app messaging, tenant profiles, and a fair queueing system.
        </p>

        {/* Email signup form */}
        <form 
          onSubmit={handleEmailSignup} 
          className="flex flex-col w-full max-w-lg gap-2 md:flex-row md:items-center md:justify-start"
        >
          <Input 
            type="email" 
            placeholder="Enter your email address" 
            className="w-full"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={isSubmitting}
          />
          <Button
            type="submit"
            variant="default"
            className="w-full md:w-auto whitespace-nowrap"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Joining...
              </>
            ) : (
              'Join Waitlist'
            )}
          </Button>
        </form>
      </div>

      {/* Hero cards sections */}
      {/* <div className="z-10">
        <HeroCards />
      </div> */}

      {/* Shadow effect */}
      <div className="shadow"></div>
    </section>
  );
};
