import { LoginForm } from "./login-form";
import { Lightbulb } from "lucide-react";

export const metadata = { title: "Anmelden – Lichtstudio" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const params = await searchParams;
  return (
    <div className="relative flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center justify-center gap-3">
          <div className="brand-logo grid h-12 w-12 place-items-center rounded-2xl text-white">
            <Lightbulb className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xl font-bold leading-none tracking-[-0.01em]">Lichtengros</p>
            <p className="eyebrow mt-1 !text-[10px]">Produktverwaltung</p>
          </div>
        </div>
        <div className="glass-card p-6">
          <h2 className="mb-1 text-xl font-bold tracking-tight">Willkommen zurück</h2>
          <p className="mb-5 text-sm text-muted-foreground">Bitte melde dich an, um fortzufahren.</p>
          <LoginForm next={params.next} />
        </div>
      </div>
    </div>
  );
}
