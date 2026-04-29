%% ============================================================================
%%  lichtengross-datenblatt.cls — Lichtengross / Eisenkeil Produktdatenblatt
%%
%%  Eigene Klasse, völlig unabhängig von sustec-datasheet.cls. Spaltenraster,
%%  Schriftgrößen, Farben und Abstände sind aus daten/Datenblatt.pdf
%%  (FileMaker-Original) abgemessen und 1:1 übernommen.
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

% ─── Farben (aus FileMaker-Vorlage) ────────────────────────────────────────
\definecolor{lgText}{HTML}{1A1A1A}
\definecolor{lgInk}{HTML}{1A1A1A}
\definecolor{lgMuted}{HTML}{555555}
\definecolor{lgLine}{HTML}{CFCFCF}
\definecolor{lgPlate}{HTML}{F7F7F7}
\definecolor{lgIconBg}{HTML}{FAFAFA}
\definecolor{lgLightfarbe}{HTML}{F2B71C}

% ─── Schrift: Inter Variable ───────────────────────────────────────────────
\setmainfont{Inter-Regular.ttf}[
  Path           = /srv/assets/fonts/,
  BoldFont       = Inter-Bold.ttf,
  ItalicFont     = Inter-Italic.ttf,
  BoldItalicFont = Inter-BoldItalic.ttf,
]

\setlength{\parindent}{0pt}
\setlength{\parskip}{0pt}
\raggedbottom
\color{lgText}

% ─── Letterspacing-Helper ──────────────────────────────────────────────────
\newcommand{\letterspaced}[1]{%
  {\addfontfeature{LetterSpace=8.0}\bfseries\MakeUppercase{#1}}%
}

% ─── Footer ────────────────────────────────────────────────────────────────
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
\renewcommand{\footrule}{%
  \vspace{-2mm}{\color{lgLine}\hrule height 0.4pt}\vspace{1.5mm}%
}

% ─── \iconcell: eine quadratische Box mit dünnem Rahmen ──────────────────
% Layout entspricht FileMaker-Vorlage:
%   - Wert vorhanden: Label klein oben, Wert gross unten (z.B. "Watt"/"4,8")
%   - Kein Wert: Bild oder grosses Label (z.B. RoHS, CE, IP20)
%   - Highlight (#4=1): gelbe Fuellung mit grossem Wert
%
% Args:
%   #1 filename (ohne Endung)
%   #2 label
%   #3 wert (leer = Bild/Label-Modus)
%   #4 highlight ("1" = gelb)
%
% Boxgroesse fix 11mm × 11mm, dünner Rahmen.
\newcommand{\iconcell}[4]{%
  \ifthenelse{\equal{#4}{1}}{%
    \fcolorbox{lgInk}{lgLightfarbe}{\parbox[c][9.4mm][c]{9.4mm}{%
      \centering
      \ifthenelse{\equal{#3}{}}{%
        \fontsize{7pt}{8pt}\selectfont\bfseries\color{lgText}#2%
      }{%
        \fontsize{9pt}{10pt}\selectfont\bfseries\color{lgText}#3%
      }%
    }}%
  }{%
    \fcolorbox{lgInk}{white}{\parbox[c][9.4mm][c]{9.4mm}{%
      \centering
      \ifthenelse{\equal{#3}{}}{%
        % Kein Wert: Bild bevorzugen, sonst Label gross
        \IfFileExists{#1.png}{\includegraphics[height=7mm,width=8mm,keepaspectratio]{#1}}{%
        \IfFileExists{#1.jpg}{\includegraphics[height=7mm,width=8mm,keepaspectratio]{#1}}{%
        \IfFileExists{#1.pdf}{\includegraphics[height=7mm,width=8mm,keepaspectratio]{#1}}{%
        \fontsize{7pt}{8pt}\selectfont\bfseries\color{lgText}#2}}}%
      }{%
        % Wert vorhanden: Label klein oben, Wert gross unten
        {\fontsize{5.5pt}{6.5pt}\selectfont\bfseries\color{lgText}#2}\\[0.4mm]%
        {\fontsize{7.5pt}{8.5pt}\selectfont\color{lgText}#3}%
      }%
    }}%
  }%
}
