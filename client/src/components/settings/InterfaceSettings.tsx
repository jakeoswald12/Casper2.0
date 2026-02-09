import { trpc } from '../../lib/trpc';
import { Card } from '../ui/card';
import { Label } from '../ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { Slider } from '../ui/slider';
import { Loader2, Monitor, Type, FileEdit, Clock } from 'lucide-react';
import { toast } from 'sonner';

export function InterfaceSettings() {
  const { data: profile, isLoading } = trpc.auth.getProfile.useQuery();
  const utils = trpc.useUtils();

  const updateProfile = trpc.auth.updateProfile.useMutation({
    onSuccess: () => {
      utils.auth.getProfile.invalidate();
      toast.success('Settings updated');
    },
    onError: (error) => {
      toast.error('Failed to update settings', { description: error.message });
    },
  });

  const handleUpdate = (updates: Record<string, any>) => {
    updateProfile.mutate(updates);
  };

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
        <h2 className="text-lg font-semibold mb-4">Appearance</h2>

        <div className="space-y-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Monitor className="w-4 h-4 text-muted-foreground" />
              <Label>Theme</Label>
            </div>
            <Select
              value={profile?.theme || 'system'}
              onValueChange={(theme) => handleUpdate({ theme })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="light">Light</SelectItem>
                <SelectItem value="dark">Dark</SelectItem>
                <SelectItem value="system">System</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Choose how Casper looks to you
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Type className="w-4 h-4 text-muted-foreground" />
              <Label>Font Size</Label>
            </div>
            <Select
              value={profile?.fontSize || 'medium'}
              onValueChange={(fontSize) => handleUpdate({ fontSize })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="small">Small</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="large">Large</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Adjust the text size in the editor
            </p>
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="text-lg font-semibold mb-4">Editor Preferences</h2>

        <div className="space-y-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <FileEdit className="w-4 h-4 text-muted-foreground" />
              <Label>Editor Mode</Label>
            </div>
            <Select
              value={profile?.editorMode || 'rich'}
              onValueChange={(editorMode) => handleUpdate({ editorMode })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="rich">Rich Text</SelectItem>
                <SelectItem value="markdown">Markdown</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Choose your preferred editing experience
            </p>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <Label>Auto-save Interval</Label>
            </div>
            <Slider
              value={[profile?.autoSaveInterval || 2000]}
              onValueChange={([autoSaveInterval]) =>
                handleUpdate({ autoSaveInterval })
              }
              min={1000}
              max={10000}
              step={1000}
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>1 second</span>
              <span className="font-medium">
                {((profile?.autoSaveInterval || 2000) / 1000).toFixed(0)} seconds
              </span>
              <span>10 seconds</span>
            </div>
            <p className="text-xs text-muted-foreground">
              How often your work is automatically saved
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
