import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Eye, EyeOff, Store } from 'lucide-react';

const DEFAULT_SIGNUP_COOLDOWN = 60;

export default function Auth() {
  const { signIn, signUp, verifySignUpOtp, resendSignUpOtp } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [secretPin, setSecretPin] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [retryAfterSeconds, setRetryAfterSeconds] = useState(0);
  const [showPassword, setShowPassword] = useState(false);
  const [awaitingOtp, setAwaitingOtp] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [pendingSignupEmail, setPendingSignupEmail] = useState('');
  const [resendLoading, setResendLoading] = useState(false);

  const getRetryAfterSeconds = (message: string) => {
    const retryMatch = message.match(/after\s+(\d+)\s+seconds/i);
    if (!retryMatch) return DEFAULT_SIGNUP_COOLDOWN;
    const parsed = Number.parseInt(retryMatch[1], 10);
    return Number.isFinite(parsed) ? parsed : DEFAULT_SIGNUP_COOLDOWN;
  };

  useEffect(() => {
    if (retryAfterSeconds <= 0) return;
    const timer = window.setInterval(() => {
      setRetryAfterSeconds((seconds) => (seconds > 1 ? seconds - 1 : 0));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [retryAfterSeconds]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!isLogin && retryAfterSeconds > 0) {
      setError(`Too many signup attempts. Please wait ${retryAfterSeconds}s and try again.`);
      return;
    }

    if (!isLogin && pendingSignupEmail === email.trim().toLowerCase() && !awaitingOtp) {
      setAwaitingOtp(true);
      setError('An OTP may already be sent to this email. Enter it below instead of creating again.');
      return;
    }

    setLoading(true);

    if (isLogin) {
      const { error } = await signIn(email, password);
      if (error) setError(error.message);
    } else {
      if (!displayName.trim()) { setError('Please enter your name'); setLoading(false); return; }
      if (!/^\d{4}$/.test(secretPin)) { setError('Please set a 4-digit secret PIN for product access.'); setLoading(false); return; }
      const { error, needsEmailVerification } = await signUp(email, password, displayName, secretPin);
      if (error) {
        const message = error.message || 'Signup failed.';
        const isRateLimited = error.status === 429 || error.code?.includes('rate_limit');
        if (isRateLimited) {
          const waitSeconds = getRetryAfterSeconds(message);
          setRetryAfterSeconds(waitSeconds);
          setPendingSignupEmail(email.trim().toLowerCase());
          setAwaitingOtp(true);
          setError(`Too many signup attempts. OTP may already be sent. Wait ${waitSeconds}s if needed, then verify the OTP.`);
        } else {
          setError(message);
        }
      } else if (needsEmailVerification) {
        setPendingSignupEmail(email.trim().toLowerCase());
        setRetryAfterSeconds(DEFAULT_SIGNUP_COOLDOWN);
        setAwaitingOtp(true);
        setError('We sent an OTP to your email. Enter it below to finish creating your account.');
      }
    }
    setLoading(false);
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!otpCode.trim()) {
      setError('Please enter the OTP code sent to your email.');
      return;
    }
    setLoading(true);
    const { error } = await verifySignUpOtp(email, otpCode.trim());
    if (error) {
      setError(error.message);
    } else {
      setPendingSignupEmail('');
      setRetryAfterSeconds(0);
      setAwaitingOtp(false);
      setOtpCode('');
    }
    setLoading(false);
  };

  const handleResendOtp = async () => {
    setError('');
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      setError('Please enter your email first.');
      return;
    }
    if (retryAfterSeconds > 0) {
      setError(`Please wait ${retryAfterSeconds}s before requesting another OTP.`);
      return;
    }

    setResendLoading(true);
    const { error } = await resendSignUpOtp(normalizedEmail);
    if (error) {
      const message = error.message || 'Failed to resend OTP.';
      const isRateLimited = error.status === 429 || error.code?.includes('rate_limit');
      if (isRateLimited) {
        const waitSeconds = getRetryAfterSeconds(message);
        setRetryAfterSeconds(waitSeconds);
        setError(`Too many requests. Please wait ${waitSeconds}s before resending OTP.`);
      } else {
        setError(message);
      }
    } else {
      setRetryAfterSeconds(DEFAULT_SIGNUP_COOLDOWN);
      setError('OTP sent. Please check your email inbox/spam and enter the code.');
    }
    setResendLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-primary mx-auto flex items-center justify-center mb-4">
            <Store className="w-8 h-8 text-primary-foreground" />
          </div>
          <h1 className="font-display text-2xl font-bold text-foreground">Sari-Sari Store</h1>
          <p className="text-sm text-muted-foreground mt-1">Point of Sale System</p>
        </div>

        <div className="bg-card rounded-xl border p-6 shadow-sm">
          <h2 className="font-display text-lg font-semibold text-card-foreground mb-4">
            {isLogin ? 'Sign In' : awaitingOtp ? 'Verify Email OTP' : 'Create Account'}
          </h2>

          <form onSubmit={awaitingOtp ? handleVerifyOtp : handleSubmit} className="space-y-3">
            {!isLogin && !awaitingOtp && (
              <div>
                <label className="text-sm font-medium text-foreground">Name</label>
                <Input value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="Your name" />
              </div>
            )}
            {!awaitingOtp && (
              <>
                <div>
                  <label className="text-sm font-medium text-foreground">Email</label>
                  <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="email@example.com" required />
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground">Password</label>
                  <div className="relative">
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      minLength={6}
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                {!isLogin && (
                  <div>
                    <label className="text-sm font-medium text-foreground">Secret PIN for Add Product *</label>
                    <Input
                      type="password"
                      inputMode="numeric"
                      maxLength={4}
                      value={secretPin}
                      onChange={e => setSecretPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                      placeholder="4-digit PIN"
                      required
                    />
                  </div>
                )}
              </>
            )}
            {awaitingOtp && (
              <div>
                <label className="text-sm font-medium text-foreground">OTP Code</label>
                <Input
                  value={otpCode}
                  onChange={e => setOtpCode(e.target.value)}
                  placeholder="Enter 6-digit code"
                  required
                />
              </div>
            )}

            {error && <p className="text-sm text-destructive">{error}</p>}

            <Button type="submit" className="w-full" disabled={loading || (!isLogin && retryAfterSeconds > 0 && !awaitingOtp)}>
              {loading ? 'Please wait...' : isLogin ? 'Sign In' : awaitingOtp ? 'Verify OTP' : 'Create Account'}
            </Button>
            {awaitingOtp && (
              <Button
                type="button"
                variant="outline"
                className="w-full"
                disabled={resendLoading || retryAfterSeconds > 0}
                onClick={handleResendOtp}
              >
                {resendLoading ? 'Sending OTP...' : retryAfterSeconds > 0 ? `Resend OTP in ${retryAfterSeconds}s` : 'Resend OTP'}
              </Button>
            )}
          </form>

          {!awaitingOtp && (
            <p className="text-sm text-center mt-4 text-muted-foreground">
              {isLogin ? "Don't have an account?" : 'Already have an account?'}{' '}
              <button onClick={() => { setIsLogin(!isLogin); setError(''); }} className="text-primary font-medium hover:underline">
                {isLogin ? 'Sign Up' : 'Sign In'}
              </button>
            </p>
          )}
          {awaitingOtp && (
            <p className="text-sm text-center mt-4 text-muted-foreground">
              Wrong email?{' '}
              <button
                onClick={() => { setAwaitingOtp(false); setOtpCode(''); setError(''); }}
                className="text-primary font-medium hover:underline"
              >
                Back to signup
              </button>
            </p>
          )}
        </div>

        <p className="text-xs text-center mt-4 text-muted-foreground">
          First signup becomes Admin automatically
        </p>
      </div>
    </div>
  );
}
