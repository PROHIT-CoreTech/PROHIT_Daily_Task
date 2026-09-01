export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-white font-bold text-lg">
            P
          </div>
          <h1 className="text-xl font-semibold text-primary">PROHIT Daily Task</h1>
        </div>
        {children}
      </div>
    </div>
  );
}
