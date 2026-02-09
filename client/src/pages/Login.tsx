import { useState } from 'react';
import { Link, useLocation } from 'wouter';
import { Ghost, Loader2, Mail } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { trpc } from '../lib/trpc';
import { toast } from 'sonner';

export function Login() {
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [isNewUser, setIsNewUser] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const register = trpc.auth.register.useMutation();
  const login = trpc.auth.login.useMutation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setIsLoading(true);

    // Generate a deterministic openId from email for email-based auth
    const openId = `email:${email.trim().toLowerCase()}`;

    try {
      if (isNewUser) {
        // Register new user
        const result = await register.mutateAsync({
          email: email.trim(),
          name: name.trim() || undefined,
          openId,
          loginMethod: 'email',
        });
        localStorage.setItem('token', result.token);
        toast.success('Account created! Welcome to Casper.');
        setLocation('/dashboard');
      } else {
        // Login existing user
        try {
          const result = await login.mutateAsync({ openId });
          localStorage.setItem('token', result.token);
          toast.success('Welcome back!');
          setLocation('/dashboard');
        } catch {
          // User doesn't exist, switch to register mode
          setIsNewUser(true);
          setIsLoading(false);
          toast.info('No account found. Create one below.');
          return;
        }
      }
    } catch (error: any) {
      if (error.message?.includes('already exists')) {
        // User exists, switch to login mode
        setIsNewUser(false);
        toast.info('Account exists. Signing you in...');
        try {
          const result = await login.mutateAsync({ openId });
          localStorage.setItem('token', result.token);
          toast.success('Welcome back!');
          setLocation('/dashboard');
        } catch {
          toast.error('Login failed. Please try again.');
        }
      } else {
        toast.error(error.message || 'Authentication failed');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/">
            <div className="inline-flex items-center gap-2 cursor-pointer">
              <Ghost className="w-10 h-10 text-primary" />
              <span className="text-2xl font-bold">Casper</span>
            </div>
          </Link>
        </div>

        <Card>
          <CardHeader className="text-center">
            <CardTitle>{isNewUser ? 'Create account' : 'Welcome back'}</CardTitle>
            <CardDescription>
              {isNewUser
                ? 'Enter your details to get started with Casper'
                : 'Enter your email to sign in to your account'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10"
                    required
                    autoFocus
                  />
                </div>
              </div>

              {isNewUser && (
                <div className="space-y-2">
                  <Label htmlFor="name">Name (optional)</Label>
                  <Input
                    id="name"
                    type="text"
                    placeholder="Your name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
              )}

              <Button type="submit" className="w-full" disabled={isLoading || !email.trim()}>
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    {isNewUser ? 'Creating account...' : 'Signing in...'}
                  </>
                ) : isNewUser ? (
                  'Create Account'
                ) : (
                  'Sign In'
                )}
              </Button>
            </form>

            <div className="mt-4 text-center text-sm text-muted-foreground">
              {isNewUser ? (
                <p>
                  Already have an account?{' '}
                  <button
                    onClick={() => setIsNewUser(false)}
                    className="text-primary hover:underline"
                  >
                    Sign in
                  </button>
                </p>
              ) : (
                <p>
                  Don't have an account?{' '}
                  <button
                    onClick={() => setIsNewUser(true)}
                    className="text-primary hover:underline"
                  >
                    Create one
                  </button>
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
