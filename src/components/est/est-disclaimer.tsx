// PROJ-10: Prominenter, durchgängiger Unverbindlichkeits-Disclaimer.
// Wird in BEIDEN Tabs sichtbar gehalten (Haftungsschutz, AC-Anforderung).

import { AlertTriangle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export function EstDisclaimer({ text }: { text?: string }) {
  return (
    <Alert
      variant="destructive"
      className="border-destructive/60 bg-destructive/5"
    >
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>Unverbindliche Schätzung — kein Steuerbescheid</AlertTitle>
      <AlertDescription>
        {text ??
          "Diese Berechnung ist eine grobe, unverbindliche Orientierung. " +
            "Sie ist KEIN Steuerbescheid und ersetzt weder eine Steuer" +
            "beratung noch die amtliche Veranlagung durch das Finanzamt. " +
            "Es werden vereinfachende Annahmen getroffen (keine Sonder" +
            "ausgaben, außergewöhnlichen Belastungen oder Freibeträge)."}
      </AlertDescription>
    </Alert>
  );
}
