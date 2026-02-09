import { useState } from 'react';
import { trpc } from '../../lib/trpc';
import { Card } from '../ui/card';
import { Label } from '../ui/label';
import { Button } from '../ui/button';
import { Switch } from '../ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { Slider } from '../ui/slider';
import { Loader2, Bot, Thermometer, Hash, Brain, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';

export function AISettings() {
  const [showApiKey, setShowApiKey] = useState(false);
  const { data: profile, isLoading } = trpc.auth.getProfile.useQuery();
  const utils = trpc.useUtils();

  const updateProfile = trpc.auth.updateProfile.useMutation({
    onSuccess: () => {
      utils.auth.getProfile.invalidate();
      toast.success('AI settings updated');
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
        <h2 className="text-lg font-semibold mb-4">AI Model Configuration</h2>

        <div className="space-y-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Bot className="w-4 h-4 text-muted-foreground" />
              <Label>Model Preference</Label>
            </div>
            <Select
              value={profile?.modelPreference || 'claude-opus-4-6'}
              onValueChange={(modelPreference) => handleUpdate({ modelPreference })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="claude-opus-4-6">
                  Claude Opus 4.6 (Recommended)
                </SelectItem>
                <SelectItem value="claude-sonnet-4-5-20250929">
                  Claude 4.5 Sonnet (Fast)
                </SelectItem>
                <SelectItem value="claude-haiku-4-5-20251001">
                  Claude 4.5 Haiku (Fastest)
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Choose which Claude model powers Casper
            </p>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Thermometer className="w-4 h-4 text-muted-foreground" />
              <Label>Temperature</Label>
            </div>
            <Slider
              value={[profile?.temperature || 7]}
              onValueChange={([temperature]) => handleUpdate({ temperature })}
              min={0}
              max={10}
              step={1}
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Precise (0)</span>
              <span className="font-medium">{profile?.temperature || 7}</span>
              <span>Creative (10)</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Higher values make output more creative but less predictable
            </p>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Hash className="w-4 h-4 text-muted-foreground" />
              <Label>Max Response Length</Label>
            </div>
            <Slider
              value={[profile?.maxTokens || 4096]}
              onValueChange={([maxTokens]) => handleUpdate({ maxTokens })}
              min={1024}
              max={32000}
              step={1024}
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>1K tokens</span>
              <span className="font-medium">
                {((profile?.maxTokens || 4096) / 1000).toFixed(0)}K tokens
              </span>
              <span>32K tokens</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Maximum length of AI responses (1 token ≈ 4 characters)
            </p>
          </div>

          <div className="flex items-center justify-between py-2">
            <div className="flex items-center gap-2">
              <Brain className="w-4 h-4 text-muted-foreground" />
              <div>
                <Label>Extended Thinking</Label>
                <p className="text-xs text-muted-foreground">
                  Allow Claude to think longer for complex requests
                </p>
              </div>
            </div>
            <Switch
              checked={profile?.extendedThinking || false}
              onCheckedChange={(extendedThinking) =>
                handleUpdate({ extendedThinking })
              }
            />
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="text-lg font-semibold mb-4">API Configuration</h2>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Your Anthropic API Key (Optional)</Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type={showApiKey ? 'text' : 'password'}
                  defaultValue={profile?.anthropicApiKey || ''}
                  placeholder="sk-ant-..."
                  className="w-full px-3 py-2 pr-10 border rounded-md bg-background font-mono text-sm"
                  onBlur={(e) => {
                    if (e.target.value !== profile?.anthropicApiKey) {
                      handleUpdate({ anthropicApiKey: e.target.value || null });
                    }
                  }}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                  onClick={() => setShowApiKey(!showApiKey)}
                >
                  {showApiKey ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </Button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Use your own API key for unlimited usage. Leave empty to use Casper's
              shared quota.
            </p>
          </div>

          <div className="p-4 bg-muted/30 rounded-lg">
            <h4 className="font-medium text-sm mb-2">Getting an API Key</h4>
            <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
              <li>
                Visit{' '}
                <a
                  href="https://console.anthropic.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  console.anthropic.com
                </a>
              </li>
              <li>Create an account or sign in</li>
              <li>Navigate to API Keys</li>
              <li>Create a new key and paste it above</li>
            </ol>
          </div>
        </div>
      </Card>
    </div>
  );
}
