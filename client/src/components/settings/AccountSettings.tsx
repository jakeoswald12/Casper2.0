import { trpc } from '../../lib/trpc';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { Loader2, User, Mail, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

export function AccountSettings() {
  const { data: user, isLoading } = trpc.auth.me.useQuery();
  const { data: profile } = trpc.auth.getProfile.useQuery();

  const updateProfile = trpc.auth.updateProfile.useMutation({
    onSuccess: () => {
      toast.success('Profile updated');
    },
    onError: (error) => {
      toast.error('Failed to update profile', { description: error.message });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <h2 className="text-lg font-semibold mb-4">Profile Information</h2>

        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              <User className="w-8 h-8 text-primary" />
            </div>
            <div>
              <p className="font-medium">{user?.name || 'Anonymous User'}</p>
              <p className="text-sm text-muted-foreground">{user?.email || 'No email'}</p>
            </div>
          </div>

          <div className="grid gap-4 pt-4 border-t">
            <div>
              <Label className="text-muted-foreground">Pen Name</Label>
              <input
                type="text"
                defaultValue={profile?.penName || ''}
                onBlur={(e) => {
                  if (e.target.value !== profile?.penName) {
                    updateProfile.mutate({ penName: e.target.value });
                  }
                }}
                placeholder="Your author pen name"
                className="mt-1 w-full px-3 py-2 border rounded-md bg-background"
              />
            </div>

            <div>
              <Label className="text-muted-foreground">Bio</Label>
              <textarea
                defaultValue={profile?.bio || ''}
                onBlur={(e) => {
                  if (e.target.value !== profile?.bio) {
                    updateProfile.mutate({ bio: e.target.value });
                  }
                }}
                placeholder="Tell us about yourself..."
                rows={3}
                className="mt-1 w-full px-3 py-2 border rounded-md bg-background resize-none"
              />
            </div>
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="text-lg font-semibold mb-4">Account Details</h2>

        <div className="space-y-3">
          <div className="flex items-center gap-3 text-sm">
            <Mail className="w-4 h-4 text-muted-foreground" />
            <span className="text-muted-foreground">Email:</span>
            <span>{user?.email || 'Not set'}</span>
          </div>

          <div className="flex items-center gap-3 text-sm">
            <Calendar className="w-4 h-4 text-muted-foreground" />
            <span className="text-muted-foreground">Member since:</span>
            <span>
              {user?.createdAt
                ? format(new Date(user.createdAt), 'MMMM d, yyyy')
                : 'Unknown'}
            </span>
          </div>

          <div className="flex items-center gap-3 text-sm">
            <Calendar className="w-4 h-4 text-muted-foreground" />
            <span className="text-muted-foreground">Last sign in:</span>
            <span>
              {user?.lastSignedIn
                ? format(new Date(user.lastSignedIn), 'MMMM d, yyyy h:mm a')
                : 'Unknown'}
            </span>
          </div>
        </div>
      </Card>

      <Card className="p-6 border-destructive/50">
        <h2 className="text-lg font-semibold mb-4 text-destructive">Danger Zone</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Once you delete your account, there is no going back. Please be certain.
        </p>
        <Button variant="destructive" disabled>
          Delete Account
        </Button>
      </Card>
    </div>
  );
}
