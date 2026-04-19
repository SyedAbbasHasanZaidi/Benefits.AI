export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-4xl font-bold tracking-tight">Benefits.AI</h1>
      <p className="max-w-md text-center text-gray-600">
        Discover Australian government entitlements you may qualify for — federal, state, and local.
      </p>
      <a
        href="/chat"
        className="rounded-lg bg-blue-600 px-6 py-3 text-white font-medium hover:bg-blue-700 transition-colors"
      >
        Check my entitlements
      </a>
      <p className="text-xs text-gray-400 max-w-sm text-center">
        This tool helps you explore what you might qualify for. It does not make formal benefit
        determinations — the relevant government agency does.
      </p>
    </main>
  );
}
