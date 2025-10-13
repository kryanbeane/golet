import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';
import { Navbar } from '@/components/landing/Navbar';
import { EnhancedAuthForm } from '@/components/misc/enhancedAuthForm';
import { AuthState } from '@/utils/types';
import { getCachedUser } from '@/utils/supabase/serverAuth';

// Force dynamic rendering since this page uses cookies
export const dynamic = 'force-dynamic';

export default async function UpdatePasswordPage() {
  // Check if the user is already logged in and redirect to the account page if so
  const user = await getCachedUser();

  if (!user) {
    return redirect('/auth/signin');
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <EnhancedAuthForm state={AuthState.UpdatePassword} />
    </div>
  );
}
