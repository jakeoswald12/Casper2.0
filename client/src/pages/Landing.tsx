import { Link } from 'wouter';
import { Ghost, BookOpen, Sparkles, Upload } from 'lucide-react';
import { Button } from '../components/ui/button';

export function Landing() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      {/* Header */}
      <header className="container mx-auto px-4 py-6">
        <nav className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Ghost className="w-8 h-8 text-primary" />
            <span className="text-xl font-bold">Casper</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/login">
              <Button variant="ghost">Sign In</Button>
            </Link>
            <Link href="/login">
              <Button>Get Started</Button>
            </Link>
          </div>
        </nav>
      </header>

      {/* Hero */}
      <main className="container mx-auto px-4 py-20">
        <div className="text-center max-w-3xl mx-auto">
          <h1 className="text-5xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-foreground to-primary bg-clip-text text-transparent">
            Your Friendly AI Ghostwriter
          </h1>
          <p className="text-xl text-muted-foreground mb-8">
            Powered by Claude Opus 4.6, Casper helps you write books faster and
            better. From outline to manuscript, we've got you covered.
          </p>
          <div className="flex items-center justify-center gap-4">
            <Link href="/dashboard">
              <Button size="lg" className="gap-2">
                <Sparkles className="w-5 h-5" />
                Start Writing
              </Button>
            </Link>
          </div>
        </div>

        {/* Features */}
        <div className="grid md:grid-cols-3 gap-8 mt-20">
          <FeatureCard
            icon={<BookOpen className="w-10 h-10" />}
            title="Smart Outlining"
            description="Build detailed outlines with AI assistance. Casper understands story structure and helps you plan your book."
          />
          <FeatureCard
            icon={<Sparkles className="w-10 h-10" />}
            title="AI-Powered Writing"
            description="Write faster with Claude Opus 4.6, the world's best creative writing AI. Get suggestions, expand scenes, and overcome writer's block."
          />
          <FeatureCard
            icon={<Upload className="w-10 h-10" />}
            title="Source Materials"
            description="Upload research documents, PDFs, and reference materials. Casper includes your full source text in AI context for rich, informed responses."
          />
        </div>
      </main>

      {/* Footer */}
      <footer className="container mx-auto px-4 py-8 border-t">
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <p>Built with Claude Opus 4.6</p>
          <p>Casper 2.0</p>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="p-6 rounded-xl border bg-card hover:shadow-lg transition-shadow">
      <div className="text-primary mb-4">{icon}</div>
      <h3 className="text-xl font-semibold mb-2">{title}</h3>
      <p className="text-muted-foreground">{description}</p>
    </div>
  );
}
