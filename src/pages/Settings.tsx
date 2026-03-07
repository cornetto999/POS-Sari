import { useEffect, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

export default function Settings() {
  const PENDING_PIN_CHANGE_KEY = 'pending_pin_change';
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [saving, setSaving] = useState(false);
  const [hasPin, setHasPin] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();
  const isMissingRpcFunction = (message: string, code?: string | null, status?: number) =>
    status === 404 || code === 'PGRST202' || /could not find the function/i.test(message);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('pin_change') !== 'confirmed') return;

    const pendingPin = sessionStorage.getItem(PENDING_PIN_CHANGE_KEY);
    params.delete('pin_change');
    const next = params.toString();
    window.history.replaceState({}, '', `${window.location.pathname}${next ? `?${next}` : ''}`);

    if (!pendingPin) {
      toast({ title: 'Email confirmed, but no pending PIN change was found.', variant: 'destructive' });
      return;
    }

    const completePendingPinChange = async () => {
      setSaving(true);
      const { error } = await supabase.rpc('set_my_product_pin', { _pin: pendingPin });
      setSaving(false);
      sessionStorage.removeItem(PENDING_PIN_CHANGE_KEY);

      if (error) {
        if (isMissingRpcFunction(error.message || '', error.code, error.status)) {
          toast({
            title: 'PIN setup is not ready yet. Run Supabase migrations, then try again.',
            description: 'Missing function: set_my_product_pin',
            variant: 'destructive',
          });
          return;
        }
        toast({ title: error.message || 'Failed to save PIN.', variant: 'destructive' });
        return;
      }

      setHasPin(true);
      setPin('');
      setConfirmPin('');
      toast({ title: 'Success: PIN changed after email confirmation.' });
    };

    completePendingPinChange();
  }, [toast]);

  useEffect(() => {
    const fetchPinStatus = async () => {
      if (!user?.id) return;
      const { data, error } = await supabase
        .from('profiles')
        .select('product_pin_hash')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) return;
      setHasPin(Boolean(data?.product_pin_hash));
    };

    fetchPinStatus();
  }, [user?.id]);

  const handleSavePin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!/^\d{4}$/.test(pin)) {
      toast({ title: 'PIN must be exactly 4 digits.', variant: 'destructive' });
      return;
    }
    if (pin !== confirmPin) {
      toast({ title: 'PIN confirmation does not match.', variant: 'destructive' });
      return;
    }

    if (hasPin) {
      if (!user?.email) {
        toast({ title: 'No email found for this account.', variant: 'destructive' });
        return;
      }

      setSaving(true);
      sessionStorage.setItem(PENDING_PIN_CHANGE_KEY, pin);
      const redirectTo =
        typeof window !== 'undefined'
          ? `${window.location.origin}/settings?pin_change=confirmed`
          : undefined;
      const { error } = await supabase.auth.signInWithOtp({
        email: user.email,
        options: {
          shouldCreateUser: false,
          emailRedirectTo: redirectTo,
        },
      });
      setSaving(false);

      if (error) {
        sessionStorage.removeItem(PENDING_PIN_CHANGE_KEY);
        toast({ title: error.message || 'Failed to send confirmation email.', variant: 'destructive' });
        return;
      }

      setPin('');
      setConfirmPin('');
      toast({ title: 'Check your email and click the confirmation link to finish changing your PIN.' });
      return;
    }

    setSaving(true);
    const { error } = await supabase.rpc('set_my_product_pin', { _pin: pin });
    setSaving(false);

    if (error) {
      if (isMissingRpcFunction(error.message || '', error.code, error.status)) {
        toast({
          title: 'PIN setup is not ready yet. Run Supabase migrations, then try again.',
          description: 'Missing function: set_my_product_pin',
          variant: 'destructive',
        });
        return;
      }
      toast({ title: error.message || 'Failed to save PIN.', variant: 'destructive' });
      return;
    }

    setPin('');
    setConfirmPin('');
    setHasPin(true);
    toast({ title: 'Success: PIN saved.' });
  };

  return (
    <div className="space-y-6 animate-slide-in max-w-2xl">
      <div>
        <h1 className="text-2xl font-display font-bold text-foreground">Settings</h1>
        <p className="text-sm text-muted-foreground">Manage your account security settings.</p>
      </div>

      <div className="bg-card rounded-xl border p-5">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
            <ShieldCheck className="w-5 h-5 text-primary" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-display font-semibold text-card-foreground">Product Access PIN</h2>
              <Badge variant={hasPin ? 'default' : 'secondary'}>
                {hasPin ? 'Verified PIN' : 'Not Verified PIN'}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              This 4-digit PIN is required when adding or editing products.
            </p>
            {hasPin && (
              <p className="text-xs text-muted-foreground mt-1">
                Saving changes for an existing PIN will send email confirmation automatically.
              </p>
            )}
          </div>
        </div>

        <form className="space-y-3" onSubmit={handleSavePin}>
          <div>
            <label className="text-sm font-medium text-foreground">New PIN</label>
            <Input
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
              placeholder="Enter 4-digit PIN"
              required
            />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground">Confirm PIN</label>
            <Input
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={confirmPin}
              onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
              placeholder="Re-enter PIN"
              required
            />
          </div>
          <Button type="submit" disabled={saving}>
            {saving ? 'Saving...' : 'Save PIN'}
          </Button>
        </form>
      </div>
    </div>
  );
}
