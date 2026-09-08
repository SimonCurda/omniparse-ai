'use client';

import { useRouter } from 'next/navigation';

export default function NotFound() {
  const router = useRouter();

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-6 px-6 text-center">
        {/* OmniParse Logo */}
        <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-primary">
          <span className="text-2xl font-bold text-primary-foreground">OP</span>
        </div>

        <div className="flex flex-col gap-2">
          <p className="text-8xl font-extrabold tracking-tighter text-primary">404</p>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Page not found
          </h1>
          <p className="text-muted-foreground max-w-md">
            The page you're looking for doesn't exist or has been moved.
          </p>
        </div>

        <button
          onClick={() => router.push('/')}
          className="inline-flex items-center justify-center rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          Go to Homepage
        </button>
      </div>
    </div>
  );
}
