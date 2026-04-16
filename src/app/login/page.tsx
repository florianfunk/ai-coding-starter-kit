import { LoginForm } from "./login-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = { title: "Anmelden – Lichtstudio" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const params = await searchParams;
  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Lichtstudio</CardTitle>
          <CardDescription>Interner Login zur Produktverwaltung</CardDescription>
        </CardHeader>
        <CardContent>
          <LoginForm next={params.next} />
        </CardContent>
      </Card>
    </div>
  );
}
