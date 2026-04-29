%% ============================================================================
%%  lichtengross-datenblatt.cls — Lichtengross / Eisenkeil Produktdatenblatt
%%
%%  Eigene Klasse, völlig unabhängig von sustec-datasheet.cls. Spaltenraster,
%%  Schriftgrößen, Farben und Abstände sind aus daten/Datenblatt.pdf
%%  (FileMaker-Original) abgemessen und 1:1 übernommen.
%%
%%  Druck-Specs:
%%    A4 Portrait, 15 mm Seitenränder oben/unten 17 mm,
%%    Inter Variable als Hauptschrift (eingebettet),
%%    Footer mit Firmenname (mittig) + Stand-Datum (rechts).
%% ============================================================================
\NeedsTeXFormat{LaTeX2e}
\ProvidesClass{lichtengross-datenblatt}[2026/04/29 lichtengross product datasheet]

\LoadClass[a4paper,9pt]{extarticle}

% ─── Pakete ─────────────────────────────────────────────────────────────────
\RequirePackage{fontspec}
\RequirePackage[a4paper,
                left=15mm, right=15mm,
                top=12mm, bottom=14mm,
                headheight=0pt, headsep=0pt,
                footskip=8mm,
                marginparwidth=0pt]{geometry}
\RequirePackage[table]{xcolor}
\RequirePackage{graphicx}
\graphicspath{{/srv/assets/lichtengross/}{/srv/assets/}{./}}
\DeclareGraphicsExtensions{.pdf,.jpg,.jpeg,.png}
\RequirePackage{array}
\RequirePackage{tabularx}
\RequirePackage{ragged2e}
\RequirePackage{calc}
\RequirePackage{etoolbox}
\RequirePackage{ifthen}
\RequirePackage{enumitem}
\RequirePackage{colortbl}
\RequirePackage{fancyhdr}
\RequirePackage[hidelinks]{hyperref}

% ─── Farben (aus FileMaker-Vorlage abgeleitet) ──────────────────────────────
\definecolor{lgText}{HTML}{1A1A1A}     % primärer Schrifton
\definecolor{lgInk}{HTML}{1A1A1A}      % schwarze Trennlinien
\definecolor{lgMuted}{HTML}{555555}    % "Artikelnummer:", Footer
\definecolor{lgLine}{HTML}{CFCFCF}     % helle Boxränder
\definecolor{lgPlate}{HTML}{F7F7F7}    % Bildplatten-Hintergrund
\definecolor{lgIconBg}{HTML}{FAFAFA}   % Wertfeld unter Icon
\definecolor{lgLightfarbe}{HTML}{F2B71C} % gelbe Hervorhebung für Lichtfarbe-Icons

% ─── Schrift: Inter Variable (im Worker-Container vorhanden) ────────────────
\setmainfont{Inter-Regular.ttf}[
  Path           = /srv/assets/fonts/,
  BoldFont       = Inter-Bold.ttf,
  ItalicFont     = Inter-Italic.ttf,
  BoldItalicFont = Inter-BoldItalic.ttf,
]

% ─── Globale Typografie ────────────────────────────────────────────────────
\setlength{\parindent}{0pt}
\setlength{\parskip}{0pt}
\raggedbottom
\color{lgText}

% ─── Letterspacing (für Headings wie "PRODUKTDATENBLATT") ──────────────────
% Simple Variante ohne microtype: Buchstaben mit \,-Spacing trennen geht
% nicht mit Variablen. Wir setzen stattdessen \addfontfeature{LetterSpace=8.0}
% nur für die markierten Stellen.
\newcommand{\letterspaced}[1]{%
  {\addfontfeature{LetterSpace=8.0}\bfseries\MakeUppercase{#1}}%
}

% ─── Footer: Firmenname linksmittig, Stand-Datum rechts, dünne Trennlinie ──
% ((meta.filiale)) und ((meta.stand)) werden vom Template via
% \setfooterleft / \setfooterright gesetzt — kein direktes Jinja in der Klasse,
% damit die Klasse rein .tex bleibt und in jedem Tectonic-Lauf funktioniert.
\newcommand{\lgFooterLeft}{}
\newcommand{\lgFooterRight}{}
\newcommand{\setfooterleft}[1]{\renewcommand{\lgFooterLeft}{#1}}
\newcommand{\setfooterright}[1]{\renewcommand{\lgFooterRight}{#1}}

\pagestyle{fancy}
\fancyhf{}
\fancyfoot[C]{\fontsize{7pt}{9pt}\selectfont\color{lgMuted}\bfseries\addfontfeature{LetterSpace=4.0}\lgFooterLeft}
\fancyfoot[R]{\fontsize{7pt}{9pt}\selectfont\color{lgMuted}Stand: \lgFooterRight}
\renewcommand{\headrulewidth}{0pt}
\renewcommand{\footrulewidth}{0pt}
% Eigene Trennlinie über dem Footer (FM-Vorlage: ~0.4pt, hell)
\renewcommand{\footrule}{%
  \vspace{-2mm}{\color{lgLine}\hrule height 0.4pt}\vspace{1.5mm}%
}

% ─── \iconcell: eine quadratische Box pro Icon (FM-Vorlage) ────────────────
% In der FileMaker-Vorlage ist jedes Icon EINE Box ohne separate Werte-Box
% darunter. Layout je nach Daten:
%   - Wert vorhanden: Label klein oben + Wert gross unten (z.B. "Watt"/"4,8").
%     Der Wert traegt den Inhalt; das Icon-Symbol wird ausgeblendet.
%   - Kein Wert: nur das Symbol (z.B. RoHS, CE) — falls kein Bild da ist,
%     dient das Label als grosser Text-Inhalt (z.B. "IP20").
%   - Highlight (Lichtfarbe-2700K etc.): gelbe Fuellung, Label/Wert in
%     schwarz-fett.
%
% Args:
%   #1 filename (ohne Endung)  Bildquelle, Suche im Job-Workdir
%   #2 label                    z.B. "Watt", "Volt", "RoHS"
%   #3 wert                     z.B. "4,8", "2700K". Leer = nur Bild-Modus.
%   #4 highlight                "1" = gelbe Fuellung
%
% Zellbreite: 0.115\linewidth × 8 Zellen + 7×0.6mm Spacing ≈ volle Breite.
% Boxhoehe: 12mm (quadratisch).
\newcommand{\iconcell}[4]{%
  \begin{minipage}[t]{0.115\linewidth}%
    \centering
    \ifthenelse{\equal{#4}{1}}{%
      % Highlight (Lichtfarbe): gelbe Box. Wenn Wert vorhanden, dominiert er
      % visuell — das Label kommt klein darueber.
      \fcolorbox{lgInk}{lgLightfarbe}{\parbox[c][12mm][c]{12mm}{%
        \centering
        \ifthenelse{\equal{#3}{}}{%
          \fontsize{8pt}{9pt}\selectfont\bfseries\color{lgText}#2%
        }{%
          \fontsize{9.5pt}{11pt}\selectfont\bfseries\color{lgText}#3%
        }%
      }}%
    }{%
      \fcolorbox{lgInk}{white}{\parbox[c][12mm][c]{12mm}{%
        \centering
        \ifthenelse{\equal{#3}{}}{%
          % Kein Wert: Bild bevorzugen, sonst Label gross
          \IfFileExists{#1.png}{\includegraphics[height=8.5mm,width=10mm,keepaspectratio]{#1}}{%
          \IfFileExists{#1.jpg}{\includegraphics[height=8.5mm,width=10mm,keepaspectratio]{#1}}{%
          \IfFileExists{#1.pdf}{\includegraphics[height=8.5mm,width=10mm,keepaspectratio]{#1}}{%
          \fontsize{8pt}{9.5pt}\selectfont\bfseries\color{lgText}#2}}}%
        }{%
          % Wert vorhanden: Label klein oben, Wert gross unten
          {\fontsize{6pt}{7pt}\selectfont\bfseries\color{lgText}#2}\\[0.5mm]%
          {\fontsize{8.5pt}{9.5pt}\selectfont\color{lgText}#3}%
        }%
      }}%
    }%
  \end{minipage}%
}
