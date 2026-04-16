import { LoginForm } from "./login-form";
import { Card, CardContent } from "@/components/ui/card";

export const metadata = { title: "Anmelden – Lichtstudio" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const params = await searchParams;
  return (
    <div className="min-h-screen flex items-center justify-center bg-primary p-4">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-xl bg-accent flex items-center justify-center font-bold text-primary text-2xl shadow-lg">
            L
          </div>
          <div>
            <p className="text-white font-bold text-xl tracking-wider leading-none">LICHTSTUDIO</p>
            <p className="text-accent/80 text-[10px] uppercase tracking-widest mt-1">Produktverwaltung</p>
          </div>
        </div>
        <Card className="shadow-2xl border-2">
          <CardContent className="pt-6">
            <h2 className="text-xl font-bold tracking-tight mb-1">Willkommen zurück</h2>
            <p className="text-sm text-muted-foreground mb-5">Bitte melde dich an, um fortzufahren.</p>
            <LoginForm next={params.next} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
