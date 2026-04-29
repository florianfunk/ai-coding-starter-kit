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
                top=18mm, bottom=18mm,
                headheight=0pt, headsep=0pt,
                footskip=16mm,
                marginparwidth=0pt]{geometry}

\RequirePackage{fontspec}
\RequirePackage[table,RGB]{xcolor}
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
\definecolor{paper}{HTML}{FAF8F4}
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
  {\color{ink}\rule{\textwidth}{0.4pt}}\\[2mm]
  \noindent\begin{minipage}[c]{0.36\linewidth}%
    {\monofont\bfseries\fontsize{8pt}{10pt}\selectfont\addfontfeature{LetterSpace=10}\color{ink}\MakeUppercase{\lgFooterCompany}}%
    \,{\monofont\fontsize{8pt}{10pt}\selectfont\addfontfeature{LetterSpace=10}\color{muted}\MakeUppercase{\(\cdot\) Stand \lgFooterDate}}%
  \end{minipage}\hfill%
  \begin{minipage}[c]{0.28\linewidth}\centering\energyscale{\lgFooterEnergy}\end{minipage}\hfill%
  \begin{minipage}[c]{0.34\linewidth}\raggedleft%
    {\monofont\fontsize{8pt}{10pt}\selectfont\addfontfeature{LetterSpace=10}\color{muted}\MakeUppercase{Technische Aenderungen vorbehalten \(\cdot\) v1.0}}%
  \end{minipage}%
}
\fancyfoot[C]{\parbox{\textwidth}{\rendermyfoot}}
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
\newcommand{\setfootercompany}[1]{\renewcommand{\lgFooterCompany}{#1}}
\newcommand{\setfooterdate}[1]{\renewcommand{\lgFooterDate}{#1}}
\newcommand{\setfooterrev}[1]{\renewcommand{\lgFooterRev}{#1}}
\newcommand{\setfooterenergy}[1]{\renewcommand{\lgFooterEnergy}{#1}}

% ─── Energie-Skala (Briefing 6.6) ──────────────────────────────────────────
% Renderhandwerk: 7 farbige Buchstaben in einer Reihe, aktiver Buchstabe
% bekommt einen 1pt-Outline. Briefing-Farben unverändert übernommen.
\newcommand{\energyscale}[1]{%
  \begin{tikzpicture}[baseline=(current bounding box.center), inner sep=0pt]
    \def\xa{0pt}\def\xb{14pt}\def\xc{28pt}\def\xd{42pt}\def\xe{56pt}\def\xf{70pt}\def\xg{84pt}
    \definecolor{ecA}{HTML}{00A651}\definecolor{ecB}{HTML}{50B748}
    \definecolor{ecC}{HTML}{BFD630}\definecolor{ecD}{HTML}{FFF200}
    \definecolor{ecE}{HTML}{FBB040}\definecolor{ecF}{HTML}{F37021}
    \definecolor{ecG}{HTML}{ED1C24}
    \node[fill=ecA, text=white, font=\displayfont\bfseries\fontsize{7}{7}\selectfont, inner sep=2pt, minimum width=14pt, minimum height=11pt, anchor=south west] (a) at (\xa,0) {A};
    \node[fill=ecB, text=white, font=\displayfont\bfseries\fontsize{7}{7}\selectfont, inner sep=2pt, minimum width=14pt, minimum height=11pt, anchor=south west] (b) at (\xb,0) {B};
    \node[fill=ecC, text=white, font=\displayfont\bfseries\fontsize{7}{7}\selectfont, inner sep=2pt, minimum width=14pt, minimum height=11pt, anchor=south west] (c) at (\xc,0) {C};
    \node[fill=ecD, text=ink, font=\displayfont\bfseries\fontsize{7}{7}\selectfont, inner sep=2pt, minimum width=14pt, minimum height=11pt, anchor=south west] (d) at (\xd,0) {D};
    \node[fill=ecE, text=white, font=\displayfont\bfseries\fontsize{7}{7}\selectfont, inner sep=2pt, minimum width=14pt, minimum height=11pt, anchor=south west] (e) at (\xe,0) {E};
    \node[fill=ecF, text=white, font=\displayfont\bfseries\fontsize{7}{7}\selectfont, inner sep=2pt, minimum width=14pt, minimum height=11pt, anchor=south west] (f) at (\xf,0) {F};
    \node[fill=ecG, text=white, font=\displayfont\bfseries\fontsize{7}{7}\selectfont, inner sep=2pt, minimum width=14pt, minimum height=11pt, anchor=south west] (g) at (\xg,0) {G};
    % Aktiver Buchstabe: Outline
    \ifthenelse{\equal{#1}{A}}{\draw[ink, line width=1pt] (a.south west) rectangle (a.north east);}{}
    \ifthenelse{\equal{#1}{B}}{\draw[ink, line width=1pt] (b.south west) rectangle (b.north east);}{}
    \ifthenelse{\equal{#1}{C}}{\draw[ink, line width=1pt] (c.south west) rectangle (c.north east);}{}
    \ifthenelse{\equal{#1}{D}}{\draw[ink, line width=1pt] (d.south west) rectangle (d.north east);}{}
    \ifthenelse{\equal{#1}{E}}{\draw[ink, line width=1pt] (e.south west) rectangle (e.north east);}{}
    \ifthenelse{\equal{#1}{F}}{\draw[ink, line width=1pt] (f.south west) rectangle (f.north east);}{}
    \ifthenelse{\equal{#1}{G}}{\draw[ink, line width=1pt] (g.south west) rectangle (g.north east);}{}
    % Außenrahmen
    \draw[ink, line width=0.4pt] (a.south west) rectangle (g.north east);
  \end{tikzpicture}%
}

% ─── Section-Head: Heading links + Section-Nr rechts + dünne Linie ────────
\newcommand{\sectionhead}[2]{%
  \par\noindent
  \begin{minipage}[b]{0.6\linewidth}\raggedright
    {\displayfont\bfseries\fontsize{11}{13}\selectfont\addfontfeature{LetterSpace=4}\color{ink}\MakeUppercase{#1}}%
  \end{minipage}\hfill
  \begin{minipage}[b]{0.38\linewidth}\raggedleft
    {\monofont\fontsize{8}{10}\selectfont\addfontfeature{LetterSpace=10}\color{muted}\MakeUppercase{#2}}%
  \end{minipage}\par
  \vspace{1.4mm}{\color{hairstrong}\hrule height 0.4pt}\vspace{2.6mm}%
}

% ─── Spec-Group-Heading (klein, accentdeep, monospace) ─────────────────────
\newcommand{\specgroup}[1]{%
  \par\vspace{1.4mm}%
  {\monofont\bfseries\fontsize{7.4pt}{8pt}\selectfont\addfontfeature{LetterSpace=14}\color{accentdeep}\MakeUppercase{#1}}%
  \par\vspace{0.6mm}%
}

% ─── Spec-Row: Key links (Sans), Value rechts (Mono), gepunktete Trennlinie
\newcommand{\specrow}[2]{%
  \noindent\begin{tabular*}{\linewidth}{@{\extracolsep{\fill}}lr}
    {\fontsize{8.4pt}{10pt}\selectfont\color{ink2}#1} &
    {\monofont\bfseries\fontsize{8.4pt}{10pt}\selectfont\color{ink}#2} \\
  \end{tabular*}\par
  \vspace{-0.5mm}%
  {\color{hairstrong}\dotfill}%
  \vspace{0.6mm}\par
}

% ─── Quickfact-Cell ─────────────────────────────────────────────────────────
% Eine 6er-Grid-Zelle: kleines Mono-Label oben + großer Display-Wert + kleine Unit
\newcommand{\quickfact}[3]{%
  % #1 = Label, #2 = Wert, #3 = Unit
  \parbox[t][14mm][t]{\linewidth}{%
    \raggedright
    {\monofont\fontsize{7pt}{8pt}\selectfont\addfontfeature{LetterSpace=14}\color{muted}\MakeUppercase{#1}}\par
    \vspace{1.6mm}%
    {\displayfont\bfseries\fontsize{15pt}{16pt}\selectfont\color{ink}#2}%
    \ifthenelse{\equal{#3}{}}{}{%
      \,{\fontsize{8pt}{10pt}\selectfont\color{muted}#3}%
    }%
  }%
}
