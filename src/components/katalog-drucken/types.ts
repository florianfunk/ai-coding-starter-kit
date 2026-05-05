export type Layout = "lichtengros" | "eisenkeil";
export type PreisSpur = "lichtengros" | "eisenkeil" | "listenpreis";
export type Vorzeichen = "plus" | "minus";
export type Waehrung = "EUR" | "CHF";
export type Sprache = "de";

export type WizardParameter = {
  layout: Layout;
  preisauswahl: PreisSpur;
  preisAenderung: Vorzeichen;
  preisProzent: number;
  waehrung: Waehrung;
  sprache: Sprache;
};

export type WizardResult = WizardParameter & {
  produktIds: string[] | null;
};

export type KundeContext = {
  id: string;
  kunden_nr: string;
  firma: string;
  defaults: WizardParameter;
  whitelistProduktIds: string[] | null;
};

export type ProduktKnoten = {
  id: string;
  artikelnummer: string;
  name: string;
};

export type KategorieKnoten = {
  id: string;
  name: string;
  produkte: ProduktKnoten[];
};

export type BereichKnoten = {
  id: string;
  name: string;
  kategorien: KategorieKnoten[];
};

export type TreeData = BereichKnoten[];

export const DEFAULT_PARAMETER: WizardParameter = {
  layout: "lichtengros",
  preisauswahl: "listenpreis",
  preisAenderung: "plus",
  preisProzent: 0,
  waehrung: "EUR",
  sprache: "de",
};

export const PREIS_SPUR_LABEL: Record<PreisSpur, string> = {
  lichtengros: "Lichtengros-Preis",
  eisenkeil: "Eisenkeil-Preis",
  listenpreis: "Listenpreis",
};
