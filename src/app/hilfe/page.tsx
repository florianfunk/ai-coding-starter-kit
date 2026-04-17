import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Rocket, ShoppingCart, BookOpen, Keyboard } from "lucide-react";

const FAQ_GROUPS = [
  {
    title: "Erste Schritte",
    icon: Rocket,
    items: [
      {
        q: "Wie ist die App aufgebaut?",
        a: "Die Datenstruktur folgt einer klaren Hierarchie: Bereiche (z.B. LED Strips, Leuchten) enthalten Kategorien, die wiederum Produkte gruppieren. Jedes Produkt hat technische Daten und Preise. Uber die Navigation oben erreichen Sie alle Ebenen direkt.",
      },
      {
        q: "Wie lege ich ein neues Produkt an?",
        a: "Gehen Sie zu Produkte und klicken Sie auf \"Neues Produkt\". Fullen Sie die Pflichtfelder Artikelnummer, Bereich und Kategorie aus. Alle weiteren technischen Felder sind optional und konnen spater erganzt werden. Speichern Sie mit dem Button unten rechts.",
      },
      {
        q: "Was bedeutet der Vollstandigkeits-Indikator?",
        a: "Der grune Punkt neben jeder Sektion zeigt an, dass mindestens ein Feld in dieser Gruppe ausgefullt ist. Graue Punkte bedeuten, dass die Sektion noch leer ist. Pflichtfelder sind mit * gekennzeichnet.",
      },
    ],
  },
  {
    title: "Produkte & Preise",
    icon: ShoppingCart,
    items: [
      {
        q: "Wie andere ich einen Preis?",
        a: "Offnen Sie das Produkt uber die Produktliste. Im Bereich \"Preise\" konnen Sie Listenpreis, Einkaufspreis und weitere Preisfelder direkt bearbeiten. Vergessen Sie nicht, die Anderungen zu speichern.",
      },
      {
        q: "Wie importiere ich Preise aus einer CSV-Datei?",
        a: "Gehen Sie zu Produkte und nutzen Sie den Import-Button in der Toolbar. Wahlen Sie Ihre CSV-Datei aus. Die Spalten werden automatisch erkannt. Prufen Sie die Vorschau und bestatigen Sie den Import.",
      },
      {
        q: "Wie exportiere ich Produkte als CSV?",
        a: "In der Produktliste finden Sie oben einen Export-Button. Dieser erstellt eine CSV-Datei mit allen sichtbaren Produkten und deren technischen Daten, die Sie in Excel weiterverarbeiten konnen.",
      },
      {
        q: "Wie dupliziere ich ein Produkt?",
        a: "Offnen Sie das gewunschte Produkt und klicken Sie auf den \"Duplizieren\"-Button. Es wird eine Kopie mit allen technischen Daten erstellt. Die Artikelnummer mussen Sie manuell anpassen.",
      },
      {
        q: "Wie vergleiche ich Produkte?",
        a: "In der Produkttabelle konnen Sie mehrere Produkte uber die Vergleichs-Icons auswahlen. Die ausgewahlten Produkte werden dann nebeneinander mit allen technischen Daten angezeigt.",
      },
    ],
  },
  {
    title: "Katalog & Datenblatt",
    icon: BookOpen,
    items: [
      {
        q: "Wie erstelle ich ein Einzel-Datenblatt?",
        a: "Offnen Sie das Produkt und klicken Sie auf den Vorschau- bzw. PDF-Button. Das Datenblatt wird anhand der hinterlegten Vorlage generiert und kann als PDF heruntergeladen werden.",
      },
      {
        q: "Wie erstelle ich den Gesamtkatalog?",
        a: "Gehen Sie zu Katalog in der Navigation. Wahlen Sie die Marke (Lichtengros oder Eisenkeil), die Wahrung und optional einen Preisaufschlag. Klicken Sie auf \"Katalog generieren\", um die PDF-Datei zu erstellen.",
      },
      {
        q: "Was ist der Unterschied zwischen Lichtengros und Eisenkeil?",
        a: "Es handelt sich um zwei Marken desselben Unternehmens mit unterschiedlichen Logos und Layouts. Beim Katalog-Export wahlen Sie die Marke aus, und das PDF wird mit dem jeweiligen Branding, Logo und Layout generiert.",
      },
    ],
  },
  {
    title: "Tastenkurzel",
    icon: Keyboard,
    items: [
      {
        q: "Welche Tastenkurzel gibt es?",
        a: "Die wichtigsten Kurzel: Cmd+K (oder Ctrl+K) offnet die Suchpalette. Cmd+S (oder Ctrl+S) speichert das aktuelle Formular. Mit \"?\" offnen Sie die Shortcuts-Ubersicht. Die Suchpalette bietet schnellen Zugriff auf alle Bereiche der App.",
      },
    ],
  },
];

export default function HilfePage() {
  return (
    <AppShell>
      <PageHeader
        title="Hilfe & FAQ"
        subtitle="Haufig gestellte Fragen und Anleitungen zur Produktverwaltung"
        breadcrumbs={[
          { label: "Dashboard", href: "/" },
          { label: "Hilfe" },
        ]}
      />

      <div className="space-y-6 max-w-3xl">
        {FAQ_GROUPS.map((group) => {
          const Icon = group.icon;
          return (
            <Card key={group.title}>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Icon className="h-5 w-5 text-primary" />
                  {group.title}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <Accordion type="multiple">
                  {group.items.map((item, i) => (
                    <AccordionItem key={i} value={`${group.title}-${i}`}>
                      <AccordionTrigger className="text-left text-sm font-medium hover:no-underline">
                        {item.q}
                      </AccordionTrigger>
                      <AccordionContent className="text-sm text-muted-foreground leading-relaxed">
                        {item.a}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </AppShell>
  );
}
