import { ApiStatus } from "../features/health/ApiStatus";

export function HomePage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 px-6">
      <div className="max-w-xl text-center">
        <h1 className="text-4xl font-bold tracking-tight text-gray-900">AI eBook Creator</h1>
        <p className="mt-4 text-lg text-gray-600">
          A writing studio that remembers your story. Version 2 is under construction.
        </p>
        <div className="mt-8">
          <ApiStatus />
        </div>
      </div>
    </main>
  );
}
