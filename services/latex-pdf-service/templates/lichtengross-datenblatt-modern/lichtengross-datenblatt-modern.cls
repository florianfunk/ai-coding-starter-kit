%% ============================================================================
%%  lichtengross-datenblatt-modern.cls
%%  Premium-Datenblatt nach Claude-Design-Handoff (daten/handoff/Datenblatt.html).
%%  Drei-Familien-System: Inter (Body) / Inter Display (Headlines, ersetzt
%%  Inter Tight) / JetBrains Mono (Specs, Eyebrows, Footer).
%%  Tectonic = xelatex; fontspec liefert die OTF/TTF-Dateien direkt.
%% ============================================================================
\NeedsTeXFormat{LaTeX2e}
\ProvidesClass{lichtengross-datenblatt-modern}[2026/04/29 lichtengross modern datasheet]

\LoadClass[a4paper,9.5pt]{extarticle}

% ─── Geometrie: 18 mm Innenränder rundum (Briefing 2.) ──────────────────────
\RequirePackage[a4paper,
                left=18mm, right=18mm,
                top=14mm, bottom=20mm,
                headheight=0pt, headsep=0pt,
                footskip=14mm,
                marginparwidth=0pt]{geometry}

\RequirePackage{fontspec}
\RequirePackage[table,RGB]{xcolor}
\RequirePackage{eso-pic}
\RequirePackage{graphicx}
\graphicspath{{/srv/assets/lichtengross/}{/srv/assets/}{./}}
\DeclareGraphicsExtensions{.pdf,.jpg,.jpeg,.png}
\RequirePackage{array,tabularx}
\RequirePackage{ragged2e}
\RequirePackage{calc}
\RequirePackage{etoolbox}
\RequirePackage{ifthen}
\RequirePackage{enumitem}
\RequirePackage{colortbl}
\RequirePackage{tikz}
\usetikzlibrary{calc}
\RequirePackage{tcolorbox}
\tcbuselibrary{skins,breakable}
\RequirePackage[hidelinks]{hyperref}

% ─── Farb-Tokens (1:1 aus Briefing 4.) ─────────────────────────────────────
\definecolor{paper}{HTML}{FFFFFF}
\definecolor{ink}{HTML}{111111}
\definecolor{ink2}{HTML}{2A2A28}
\definecolor{muted}{HTML}{6F6C66}
\definecolor{hair}{HTML}{E4E0D8}
\definecolor{hairstrong}{HTML}{C9C3B8}
\definecolor{accent}{HTML}{E5B776}
\definecolor{accentdeep}{HTML}{B27A2A}
\definecolor{warnbg}{HTML}{FBF1EC}
\definecolor{warnfg}{HTML}{B23A1F}

\pagecolor{paper}
\color{ink2}

% ─── Schriften ─────────────────────────────────────────────────────────────
% Inter Display ersetzt Inter Tight (Tight ist im neuen Inter-v4 zu Display
% konsolidiert worden — das ist die offizielle Display-Variante des Designers).
\setmainfont{Inter}[
  Path           = /srv/assets/fonts/,
  Extension      = .ttf,
  UprightFont    = *-Regular,
  ItalicFont     = *-Italic,
  BoldFont       = *-Bold,
  BoldItalicFont = *-BoldItalic,
  Numbers        = {Lining,Proportional},
]
\newfontfamily\displayfont{InterDisplay}[
  Path           = /srv/assets/fonts/,
  Extension      = .ttf,
  UprightFont    = *-Regular,
  ItalicFont     = *-Italic,
  BoldFont       = *-SemiBold,    % Briefing: Display SemiBold = bold-Slot
  BoldItalicFont = *-BoldItalic,
  Numbers        = {Lining,Proportional},
]
\newfontfamily\monofont{JetBrainsMono}[
  Path           = /srv/assets/fonts/,
  Extension      = .ttf,
  UprightFont    = *-Regular,
  ItalicFont     = *-Italic,
  BoldFont       = *-Bold,
  Scale          = 0.92,
]

% ─── Globale Typografie ────────────────────────────────────────────────────
\setlength{\parindent}{0pt}
\setlength{\parskip}{0pt}
\linespread{1.32}    % HTML body line-height
\raggedbottom

\RequirePackage{fancyhdr}
% Page-Footer (auf jeder Seite). Inhalt wird vom Template via Macros gesetzt.
\pagestyle{fancy}
\fancyhf{}
\renewcommand{\headrulewidth}{0pt}
\renewcommand{\footrulewidth}{0pt}

\newcommand{\rendermyfoot}{%
  {\color{ink}\rule{\textwidth}{0.4pt}}\\[1.6mm]
  \noindent\begin{minipage}[c]{0.34\textwidth}\raggedright%
    {\monofont\bfseries\fontsize{7.4pt}{9pt}\selectfont\addfontfeature{LetterSpace=10}\color{ink}\MakeUppercase{\lgFooterCompany}}%
  \end{minipage}\hfill%
  \begin{minipage}[c]{0.32\textwidth}\centering%
    {\monofont\fontsize{7.4pt}{9pt}\selectfont\addfontfeature{LetterSpace=10}\color{muted}\MakeUppercase{Stand \lgFooterDate \(\cdot\) v1.0}}%
  \end{minipage}\hfill%
  \begin{minipage}[c]{0.34\textwidth}\raggedleft%
    {\monofont\fontsize{7.4pt}{9pt}\selectfont\addfontfeature{LetterSpace=10}\color{muted}\MakeUppercase{Technische Aenderungen vorbehalten}}%
  \end{minipage}%
}
\fancyfoot[C]{}
% Absolut positionierter Footer 5mm vom Page-Bottom
\AddToShipoutPictureFG{%
  \AtPageLowerLeft{%
    \put(\LenToUnit{18mm},\LenToUnit{10mm}){%
      \begin{minipage}[b]{\dimexpr\paperwidth-36mm\relax}%
        \rendermyfoot%
      \end{minipage}%
    }%
  }%
}
\renewcommand{\headrulewidth}{0pt}

% ─── Helper: Letterspaced Mono Eyebrow / Caps ──────────────────────────────
\newcommand{\monocaps}[2][6.0]{%
  {\monofont\addfontfeature{LetterSpace=#1}\MakeUppercase{#2}}%
}
\newcommand{\displaycaps}[2][4.0]{%
  {\displayfont\bfseries\addfontfeature{LetterSpace=#1}\MakeUppercase{#2}}%
}

% ─── Footer-State (vom Template gesetzt) ───────────────────────────────────
\newcommand{\lgFooterCompany}{}
\newcommand{\lgFooterDate}{}
\newcommand{\lgFooterRev}{}
\newcommand{\lgFooterEnergy}{F}
\newcommand{\lgFooterArtnr}{}
\newcommand{\setfootercompany}[1]{\renewcommand{\lgFooterCompany}{#1}}
\newcommand{\setfooterdate}[1]{\renewcommand{\lgFooterDate}{#1}}
\newcommand{\setfooterrev}[1]{\renewcommand{\lgFooterRev}{#1}}
\newcommand{\setfooterenergy}[1]{\renewcommand{\lgFooterEnergy}{#1}}
\newcommand{\setfooterartnr}[1]{\renewcommand{\lgFooterArtnr}{#1}}

% ─── Energie-Skala (Briefing 6.6) ──────────────────────────────────────────
% Renderhandwerk: 7 Buchstaben in einer Reihe.
% Inaktive: Pastell-Hintergrund (Energie-Farbe stark aufgehellt) + Pfeil-Form
% Aktiver Buchstabe: ueberproportional gross, voll saettigender Hintergrund,
%   schwarzer Rahmen, weisser Text. Bricht aus der Reihe nach oben/unten aus
%   und wirkt damit wie ein Stempel auf der Skala.
\newcommand{\energyscale}[1]{%
  \begin{tikzpicture}[baseline=(current bounding box.center), inner sep=0pt]
    \def\xa{0pt}\def\xb{14pt}\def\xc{28pt}\def\xd{42pt}\def\xe{56pt}\def\xf{70pt}\def\xg{84pt}
    \definecolor{ecA}{HTML}{00A651}\definecolor{ecB}{HTML}{50B748}
    \definecolor{ecC}{HTML}{BFD630}\definecolor{ecD}{HTML}{FFF200}
    \definecolor{ecE}{HTML}{FBB040}\definecolor{ecF}{HTML}{F37021}
    \definecolor{ecG}{HTML}{ED1C24}
    % Aktive-Markierung: jede Position bekommt einen Boolean-Flag
    \def\activeA{0}\def\activeB{0}\def\activeC{0}\def\activeD{0}%
    \def\activeE{0}\def\activeF{0}\def\activeG{0}%
    \ifthenelse{\equal{#1}{A}}{\def\activeA{1}}{}
    \ifthenelse{\equal{#1}{B}}{\def\activeB{1}}{}
    \ifthenelse{\equal{#1}{C}}{\def\activeC{1}}{}
    \ifthenelse{\equal{#1}{D}}{\def\activeD{1}}{}
    \ifthenelse{\equal{#1}{E}}{\def\activeE{1}}{}
    \ifthenelse{\equal{#1}{F}}{\def\activeF{1}}{}
    \ifthenelse{\equal{#1}{G}}{\def\activeG{1}}{}
    % Inaktive Standard-Boxen (klein, voll gesaettigte Energie-Farbe)
    \ifthenelse{\equal{\activeA}{0}}{\node[fill=ecA, text=white, font=\displayfont\bfseries\fontsize{7}{7}\selectfont, inner sep=2pt, minimum width=14pt, minimum height=11pt, anchor=south west] at (\xa,0) {A};}{}
    \ifthenelse{\equal{\activeB}{0}}{\node[fill=ecB, text=white, font=\displayfont\bfseries\fontsize{7}{7}\selectfont, inner sep=2pt, minimum width=14pt, minimum height=11pt, anchor=south west] at (\xb,0) {B};}{}
    \ifthenelse{\equal{\activeC}{0}}{\node[fill=ecC, text=white, font=\displayfont\bfseries\fontsize{7}{7}\selectfont, inner sep=2pt, minimum width=14pt, minimum height=11pt, anchor=south west] at (\xc,0) {C};}{}
    \ifthenelse{\equal{\activeD}{0}}{\node[fill=ecD, text=ink, font=\displayfont\bfseries\fontsize{7}{7}\selectfont, inner sep=2pt, minimum width=14pt, minimum height=11pt, anchor=south west] at (\xd,0) {D};}{}
    \ifthenelse{\equal{\activeE}{0}}{\node[fill=ecE, text=white, font=\displayfont\bfseries\fontsize{7}{7}\selectfont, inner sep=2pt, minimum width=14pt, minimum height=11pt, anchor=south west] at (\xe,0) {E};}{}
    \ifthenelse{\equal{\activeF}{0}}{\node[fill=ecF, text=white, font=\displayfont\bfseries\fontsize{7}{7}\selectfont, inner sep=2pt, minimum width=14pt, minimum height=11pt, anchor=south west] at (\xf,0) {F};}{}
    \ifthenelse{\equal{\activeG}{0}}{\node[fill=ecG, text=white, font=\displayfont\bfseries\fontsize{7}{7}\selectfont, inner sep=2pt, minimum width=14pt, minimum height=11pt, anchor=south west] at (\xg,0) {G};}{}
    % Aktive Box: groesser (18pt × 16pt), voll saturiert, schwarzer Rahmen,
    % bricht oben/unten aus der Reihe aus. Position wird durch X-Koordinate
    % der jeweiligen Spalte bestimmt, vertikal zentriert auf y=5.5pt (Mitte
    % der inaktiven Reihe, die von 0pt bis 11pt geht).
    \ifthenelse{\equal{\activeA}{1}}{\node[fill=ecA, draw=ink, line width=0.6pt, text=white, font=\displayfont\bfseries\fontsize{10}{10}\selectfont, inner sep=2pt, minimum width=18pt, minimum height=16pt] at ($(\xa,5.5pt) + (7pt,0)$) {A};}{}
    \ifthenelse{\equal{\activeB}{1}}{\node[fill=ecB, draw=ink, line width=0.6pt, text=white, font=\displayfont\bfseries\fontsize{10}{10}\selectfont, inner sep=2pt, minimum width=18pt, minimum height=16pt] at ($(\xb,5.5pt) + (7pt,0)$) {B};}{}
    \ifthenelse{\equal{\activeC}{1}}{\node[fill=ecC, draw=ink, line width=0.6pt, text=white, font=\displayfont\bfseries\fontsize{10}{10}\selectfont, inner sep=2pt, minimum width=18pt, minimum height=16pt] at ($(\xc,5.5pt) + (7pt,0)$) {C};}{}
    \ifthenelse{\equal{\activeD}{1}}{\node[fill=ecD, draw=ink, line width=0.6pt, text=ink, font=\displayfont\bfseries\fontsize{10}{10}\selectfont, inner sep=2pt, minimum width=18pt, minimum height=16pt] at ($(\xd,5.5pt) + (7pt,0)$) {D};}{}
    \ifthenelse{\equal{\activeE}{1}}{\node[fill=ecE, draw=ink, line width=0.6pt, text=white, font=\displayfont\bfseries\fontsize{10}{10}\selectfont, inner sep=2pt, minimum width=18pt, minimum height=16pt] at ($(\xe,5.5pt) + (7pt,0)$) {E};}{}
    \ifthenelse{\equal{\activeF}{1}}{\node[fill=ecF, draw=ink, line width=0.6pt, text=white, font=\displayfont\bfseries\fontsize{10}{10}\selectfont, inner sep=2pt, minimum width=18pt, minimum height=16pt] at ($(\xf,5.5pt) + (7pt,0)$) {F};}{}
    \ifthenelse{\equal{\activeG}{1}}{\node[fill=ecG, draw=ink, line width=0.6pt, text=white, font=\displayfont\bfseries\fontsize{10}{10}\selectfont, inner sep=2pt, minimum width=18pt, minimum height=16pt] at ($(\xg,5.5pt) + (7pt,0)$) {G};}{}
    \draw[hairstrong, line width=0.4pt] (\xa,0) rectangle (\dimexpr\xg+14pt\relax,11pt);
  \end{tikzpicture}%
}

% ─── Section-Head: Heading links + Section-Nr rechts + dünne Linie ────────
\newcommand{\sectionhead}[2]{%
  \par\noindent
  \begin{minipage}[b]{\linewidth}\raggedright
    {\displayfont\bfseries\fontsize{11}{13}\selectfont\addfontfeature{LetterSpace=4}\color{ink}\MakeUppercase{#1}}%
    \ifx\\#2\\\else\hfill{\monofont\fontsize{8}{10}\selectfont\addfontfeature{LetterSpace=10}\color{muted}\MakeUppercase{#2}}\fi
  \end{minipage}\par
  \vspace{0.6mm}{\color{hairstrong}\hrule height 0.4pt}\vspace{1.2mm}%
}

% ─── Spec-Group-Heading (klein, accentdeep, monospace) ─────────────────────
\newcommand{\specgroup}[1]{%
  \par\vspace{0.2mm}%
  {\monofont\bfseries\fontsize{6.2pt}{6.8pt}\selectfont\addfontfeature{LetterSpace=14}\color{accentdeep}\MakeUppercase{#1}}%
  \par\vspace{0mm}%
}

% ─── Spec-Row: Key links (Sans), Value rechts (Mono), gepunktete Trennlinie
\newcommand{\specrow}[2]{%
  {\renewcommand{\arraystretch}{0.62}%
  \noindent\begin{tabular*}{\linewidth}{@{\extracolsep{\fill}}lr}
    {\fontsize{6.8pt}{7.0pt}\selectfont\color{ink2}#1} &
    {\monofont\bfseries\fontsize{6.8pt}{7.0pt}\selectfont\color{ink}#2} \\
  \end{tabular*}}\par
  \vspace{-2.2mm}%
  {\color{hairstrong}\dotfill}%
  \vspace{-1.8mm}\par
}

% ─── Quickfact-Cell ─────────────────────────────────────────────────────────
% Eine Grid-Zelle: entweder
%  (a) wenn #4 (Icon-Image-Dateiname) gesetzt ist → nur das Bild zentriert,
%      kein Label und kein Text — die volle Kachelflaeche zeigt das Symbol.
%  (b) sonst kleines Mono-Label oben + grosser Display-Wert + kleine Unit.
\newcommand{\quickfact}[4]{%
  % #1 = Label, #2 = Wert, #3 = Unit, #4 = Icon-Image-Filename (optional)
  \ifthenelse{\equal{#4}{}}{%
    % Text-Variante: oben verankert
    \parbox[t][14mm][t]{\linewidth}{%
      \raggedright
      {\monofont\fontsize{7pt}{8pt}\selectfont\addfontfeature{LetterSpace=14}\color{muted}\MakeUppercase{#1}}\par
      \vspace{1.6mm}%
      {\displayfont\bfseries\fontsize{15pt}{16pt}\selectfont\color{ink}#2}%
      \ifthenelse{\equal{#3}{}}{}{%
        \,{\fontsize{8pt}{10pt}\selectfont\color{muted}#3}%
      }%
    }%
  }{%
    % Icon-Variante: vertikal UND horizontal zentriert via TikZ-Node, der
    % die gesamte 14mm-Kachelhoehe und die volle Spaltenbreite ausfuellt.
    % parbox[t] mit innerem TikZ haelt Tabellenzellen-Geometrie sauber.
    \parbox[t][14mm][t]{\linewidth}{%
      \begin{tikzpicture}[inner sep=0pt, outer sep=0pt]
        \path (0,0) rectangle (\linewidth,14mm);
        \node[anchor=center] at (0.5\linewidth,7mm)
          {\includegraphics[height=11mm,width=\linewidth,keepaspectratio]{#4}};
      \end{tikzpicture}%
    }%
  }%
}
