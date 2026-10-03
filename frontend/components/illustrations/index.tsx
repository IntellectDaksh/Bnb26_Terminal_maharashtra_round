// Flat geometric illustration set. Colors come from CSS vars so the art themes with the site.
import type { ReactNode } from "react";

const FG = "var(--fg)";
const FG2 = "#5a6672";
const ACC = "var(--accent)";
const AMB = "var(--accent-2)";
const SOFT = "var(--accent-soft)";
const SAND = "var(--bg-2)";
const CREAM = "#fffdf9";
const SAGE = "var(--success)";
const LINE = "#ecdfd0";
const DUNE = "#efe2d0";

export type EventCategory =
  | "hackathon"
  | "concert"
  | "film"
  | "conference"
  | "comedy"
  | "workshop"
  | "sports";

export const ART_LABEL: Record<EventCategory, string> = {
  hackathon: "Hackathon",
  concert: "Concert",
  film: "Film",
  conference: "Conference",
  comedy: "Comedy",
  workshop: "Workshop",
  sports: "Sports",
};

type Props = { className?: string };

function Svg({
  w,
  h,
  label,
  className,
  slice,
  children,
}: {
  w: number;
  h: number;
  label: string;
  className?: string;
  slice?: boolean;
  children: ReactNode;
}) {
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      role="img"
      aria-label={label}
      className={className}
      width="100%"
      preserveAspectRatio={slice ? "xMidYMid slice" : "xMidYMid meet"}
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: "block" }}
    >
      {children}
    </svg>
  );
}

// Soft radial glow; ids are shared intentionally — identical defs across instances are harmless.
function Glow({ id, color = AMB, opacity = 0.55 }: { id: string; color?: string; opacity?: number }) {
  return (
    <defs>
      <radialGradient id={id}>
        <stop offset="0%" stopColor={color} stopOpacity={opacity} />
        <stop offset="100%" stopColor={color} stopOpacity={0} />
      </radialGradient>
    </defs>
  );
}

/** Tiny faceless figure standing with feet at (x, y). */
function Person({ x, y, s = 1, fill = FG }: { x: number; y: number; s?: number; fill?: string }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`} fill={fill}>
      <rect x={-6} y={-22} width={12} height={22} rx={6} />
      <circle cx={0} cy={-29} r={5} />
    </g>
  );
}

/** Ticket outline with half-circle notches on both short sides. */
function ticketPath(w: number, h: number, r: number) {
  const a = h / 2 - r;
  const b = h / 2 + r;
  return `M0 0H${w}V${a}A${r} ${r} 0 0 0 ${w} ${b}V${h}H0V${b}A${r} ${r} 0 0 0 0 ${a}Z`;
}

function Stars({ pts, r = 2.5, fill = AMB }: { pts: [number, number][]; r?: number; fill?: string }) {
  return (
    <g fill={fill}>
      {pts.map(([x, y]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r={r} />
      ))}
    </g>
  );
}

/* ---------------------------------- Hero --------------------------------- */

export function HeroArt({ className }: Props) {
  return (
    <Svg w={640} h={640} label="A tall venue gate with a warm lamp on top, and a tidy line of people walking toward it" className={className}>
      <Glow id="fd-hero-glow" opacity={0.7} />
      <rect width={640} height={640} fill={CREAM} />
      {/* concentric halo */}
      <circle cx={320} cy={170} r={290} fill={SAND} />
      <circle cx={320} cy={170} r={220} fill={SOFT} opacity={0.45} />
      <circle cx={320} cy={170} r={150} fill={SOFT} opacity={0.7} />
      {/* beam */}
      <polygon points="320,170 0,96 0,250" fill={AMB} opacity={0.16} />
      <polygon points="320,170 640,96 640,250" fill={AMB} opacity={0.16} />
      <circle cx={320} cy={170} r={95} fill="url(#fd-hero-glow)" />
      <Stars pts={[[110, 70], [520, 60], [560, 330], [80, 360], [470, 150], [170, 210]]} />

      {/* gate */}
      <path d="M222 540V226H418V540H380V310A60 60 0 0 0 260 310V540Z" fill={FG} />
      <path d="M260 540V310A60 60 0 0 1 380 310V540Z" fill={SOFT} />
      <rect x={222} y={330} width={38} height={16} fill={ACC} />
      <rect x={380} y={330} width={38} height={16} fill={ACC} />
      <rect x={222} y={430} width={38} height={16} fill={ACC} />
      <rect x={380} y={430} width={38} height={16} fill={ACC} />
      <polygon points="206,226 434,226 418,206 222,206" fill={FG2} />
      {/* lamp */}
      <rect x={300} y={152} width={40} height={54} fill={FG2} />
      <rect x={306} y={158} width={28} height={42} fill={AMB} />
      <polygon points="292,152 348,152 320,126" fill={FG} />
      <rect x={318} y={116} width={4} height={12} fill={FG} />
      {/* turnstile inside arch */}
      <rect x={300} y={470} width={40} height={70} rx={4} fill={FG2} />
      <rect x={340} y={492} width={28} height={6} rx={3} fill={FG2} />

      {/* floating ticket */}
      <g transform="translate(430 96) rotate(-12)">
        <path d={ticketPath(70, 36, 6)} fill={ACC} />
        <line x1={50} y1={5} x2={50} y2={31} stroke={CREAM} strokeWidth={2} strokeDasharray="3 3" />
      </g>

      {/* orderly line */}
      {Array.from({ length: 8 }, (_, i) => (
        <Person key={i} x={36 + i * 25} y={534} s={1.45} fill={i === 7 ? ACC : i % 2 ? FG2 : FG} />
      ))}

      {/* dunes */}
      <path d="M0 528C120 520 220 536 320 534S520 518 640 528V640H0Z" fill={SAND} />
      <path d="M0 580C140 560 260 596 400 582S560 566 640 576V640H0Z" fill={DUNE} />
    </Svg>
  );
}

/* --------------------------------- Events -------------------------------- */

function Hackathon() {
  const bulbs: [number, number][] = [[40, 46], [110, 60], [180, 62], [250, 52], [320, 44], [390, 48], [450, 58]];
  return (
    <>
      <Glow id="fd-hack-glow" />
      <path d="M0 36Q120 76 240 52T480 56" fill="none" stroke={FG2} strokeWidth={1.5} />
      {bulbs.map(([x, y]) => (
        <circle key={x} cx={x} cy={y + 6} r={5} fill={AMB} />
      ))}
      <ellipse cx={240} cy={190} rx={150} ry={90} fill="url(#fd-hack-glow)" />
      {/* code marks */}
      <g fill="none" stroke={ACC} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round">
        <polyline points="86,104 70,120 86,136" />
        <line x1={106} y1={100} x2={96} y2={140} />
        <polyline points="116,104 132,120 116,136" />
      </g>
      <g fill="none" stroke={FG2} strokeWidth={4} strokeLinecap="round" strokeLinejoin="round">
        <polyline points="384,110 372,122 384,134" />
        <polyline points="402,110 414,122 402,134" />
      </g>
      {/* laptop */}
      <rect x={170} y={130} width={140} height={98} rx={6} fill={FG} />
      <rect x={178} y={138} width={124} height={82} rx={2} fill={AMB} />
      <g fill={CREAM} opacity={0.75}>
        <rect x={190} y={152} width={48} height={5} rx={2.5} />
        <rect x={200} y={166} width={70} height={5} rx={2.5} />
        <rect x={200} y={180} width={40} height={5} rx={2.5} />
        <rect x={190} y={194} width={56} height={5} rx={2.5} />
      </g>
      <polygon points="152,228 328,228 340,240 140,240" fill={FG2} />
      {/* mug */}
      <circle cx={386} cy={222} r={8} fill="none" stroke={ACC} strokeWidth={4} />
      <rect x={356} y={206} width={28} height={34} rx={4} fill={ACC} />
      <path d="M366 196q-5-8 0-16M376 196q-5-8 0-16" fill="none" stroke={FG2} strokeWidth={2} strokeLinecap="round" opacity={0.5} />
      {/* desk */}
      <rect x={40} y={240} width={400} height={12} rx={2} fill={FG} />
      <rect x={70} y={252} width={10} height={68} fill={FG2} />
      <rect x={400} y={252} width={10} height={68} fill={FG2} />
    </>
  );
}

function Concert() {
  return (
    <>
      <polygon points="40,0 80,0 250,250 150,250" fill={AMB} opacity={0.28} />
      <polygon points="440,0 400,0 230,250 330,250" fill={AMB} opacity={0.28} />
      <path d="M110 250V150A130 110 0 0 1 370 150V250Z" fill={FG} />
      <path d="M134 250V156A106 88 0 0 1 346 156V250Z" fill={FG2} />
      {/* mic */}
      <line x1={210} y1={248} x2={210} y2={176} stroke={CREAM} strokeWidth={3} />
      <rect x={204} y={164} width={12} height={18} rx={6} fill={AMB} />
      <ellipse cx={210} cy={249} rx={14} ry={3} fill={CREAM} />
      {/* guitar */}
      <g transform="rotate(-24 280 220)">
        <rect x={276} y={150} width={8} height={56} rx={2} fill={CREAM} />
        <circle cx={280} cy={212} r={13} fill={ACC} />
        <circle cx={280} cy={232} r={17} fill={ACC} />
        <circle cx={280} cy={226} r={4} fill={FG} />
      </g>
      <rect x={70} y={248} width={340} height={14} fill={FG} />
      <rect x={0} y={262} width={480} height={58} fill={SAND} />
      {Array.from({ length: 13 }, (_, i) => (
        <g key={i} fill={i % 3 === 1 ? FG : FG2}>
          <circle cx={12 + i * 38} cy={290 + (i % 2) * 6} r={12} />
          <rect x={-6 + i * 38} y={302 + (i % 2) * 6} width={36} height={30} rx={14} />
        </g>
      ))}
    </>
  );
}

function Film() {
  return (
    <>
      <Glow id="fd-film-glow" />
      <ellipse cx={240} cy={110} rx={230} ry={120} fill="url(#fd-film-glow)" />
      <rect x={84} y={36} width={312} height={134} rx={4} fill={FG} />
      <rect x={94} y={46} width={292} height={114} fill={SOFT} />
      <path d="M94 160L170 110L220 140L290 90L386 150V160Z" fill={AMB} opacity={0.55} />
      {/* reel */}
      <g transform="translate(436 46)">
        <circle r={28} fill={FG2} />
        {[0, 72, 144, 216, 288].map((a) => (
          <circle key={a} cx={15 * Math.cos((a * Math.PI) / 180)} cy={15 * Math.sin((a * Math.PI) / 180)} r={5.5} fill={CREAM} />
        ))}
        <circle r={3} fill={CREAM} />
      </g>
      {/* seat rows */}
      {[
        { y: 212, n: 9, w: 34, c: FG2 },
        { y: 248, n: 8, w: 44, c: FG },
        { y: 288, n: 7, w: 56, c: FG },
      ].map((row) => {
        const gap = 8;
        const total = row.n * row.w + (row.n - 1) * gap;
        const x0 = 240 - total / 2;
        return (
          <g key={row.y} fill={row.c}>
            {Array.from({ length: row.n }, (_, i) => (
              <rect key={i} x={x0 + i * (row.w + gap)} y={row.y} width={row.w} height={row.w * 0.9} rx={row.w * 0.3} />
            ))}
          </g>
        );
      })}
      <rect x={140} y={248} width={44} height={40} rx={13} fill={ACC} />
    </>
  );
}

function Conference() {
  const bars = [
    { h: 40, c: FG2 },
    { h: 62, c: AMB },
    { h: 52, c: SAGE },
    { h: 88, c: ACC },
  ];
  return (
    <>
      <rect x={210} y={34} width={220} height={150} rx={6} fill={CREAM} stroke={LINE} strokeWidth={2} />
      <rect x={230} y={52} width={70} height={7} rx={3.5} fill={FG} />
      {bars.map((b, i) => (
        <rect key={i} x={240 + i * 44} y={164 - b.h} width={28} height={b.h} rx={2} fill={b.c} />
      ))}
      <line x1={230} y1={165} x2={410} y2={165} stroke={LINE} strokeWidth={2} />
      <rect x={316} y={184} width={8} height={40} fill={FG2} />
      {/* speaker + podium */}
      <Person x={120} y={214} s={1.6} fill={FG2} />
      <polygon points="88,192 152,192 146,262 94,262" fill={FG} />
      <rect x={84} y={186} width={72} height={10} rx={2} fill={ACC} />
      <rect x={0} y={262} width={480} height={58} fill={SAND} />
      {Array.from({ length: 12 }, (_, i) => (
        <g key={i} fill={i % 2 ? FG : FG2}>
          <circle cx={20 + i * 40} cy={292} r={11} />
          <rect x={4 + i * 40} y={304} width={32} height={26} rx={12} />
        </g>
      ))}
    </>
  );
}

function Comedy() {
  const bricks: [number, number][] = [[40, 40], [104, 40], [72, 62], [360, 70], [392, 92], [424, 70], [330, 30], [20, 150], [52, 172], [410, 170]];
  return (
    <>
      <Glow id="fd-comedy-glow" opacity={0.6} />
      <rect width={480} height={320} fill={SAND} />
      <g fill={LINE}>
        {bricks.map(([x, y]) => (
          <rect key={`${x}-${y}`} x={x} y={y} width={56} height={18} rx={2} />
        ))}
      </g>
      <circle cx={240} cy={150} r={130} fill={SOFT} />
      <circle cx={240} cy={150} r={130} fill="url(#fd-comedy-glow)" />
      <rect x={0} y={262} width={480} height={58} fill={DUNE} />
      <ellipse cx={240} cy={268} rx={150} ry={16} fill={AMB} opacity={0.35} />
      {/* stool */}
      <ellipse cx={318} cy={196} rx={26} ry={7} fill={ACC} />
      <g stroke={FG2} strokeWidth={4} strokeLinecap="round">
        <line x1={300} y1={200} x2={294} y2={266} />
        <line x1={336} y1={200} x2={342} y2={266} />
        <line x1={298} y1={236} x2={338} y2={236} />
      </g>
      {/* mic */}
      <line x1={220} y1={264} x2={220} y2={128} stroke={FG} strokeWidth={5} strokeLinecap="round" />
      <ellipse cx={220} cy={266} rx={22} ry={5} fill={FG} />
      <rect x={208} y={96} width={24} height={36} rx={12} fill={FG} />
      <rect x={210} y={100} width={20} height={16} rx={8} fill={FG2} />
    </>
  );
}

function Workshop() {
  const notes = [
    { x: 80, y: 70, r: -6, c: SOFT },
    { x: 140, y: 84, r: 5, c: AMB },
    { x: 96, y: 138, r: 3, c: SOFT },
  ];
  return (
    <>
      <rect x={30} y={30} width={420} height={260} rx={14} fill={SAND} />
      {notes.map((n) => (
        <rect key={`${n.x}${n.y}`} x={n.x} y={n.y} width={56} height={56} rx={3} fill={n.c} transform={`rotate(${n.r} ${n.x + 28} ${n.y + 28})`} />
      ))}
      {/* ruler */}
      <g transform="rotate(-8 300 230)">
        <rect x={200} y={218} width={210} height={28} rx={3} fill={AMB} />
        {Array.from({ length: 13 }, (_, i) => (
          <rect key={i} x={212 + i * 15} y={218} width={2} height={i % 2 ? 7 : 12} fill={FG} opacity={0.6} />
        ))}
      </g>
      {/* pencils */}
      {[
        { y: 200, c: ACC, r: 18 },
        { y: 214, c: FG2, r: 24 },
      ].map((p) => (
        <g key={p.y} transform={`rotate(${p.r} 120 ${p.y})`}>
          <rect x={60} y={p.y} width={110} height={10} rx={2} fill={p.c} />
          <polygon points={`170,${p.y} 186,${p.y + 5} 170,${p.y + 10}`} fill={SOFT} />
          <polygon points={`181,${p.y + 3.4} 186,${p.y + 5} 181,${p.y + 6.6}`} fill={FG} />
        </g>
      ))}
      {/* swatches */}
      {[ACC, AMB, SAGE, FG].map((c, i) => (
        <circle key={i} cx={290 + i * 38} cy={92} r={15} fill={c} />
      ))}
      <rect x={272} y={130} width={140} height={46} rx={6} fill={CREAM} />
      <rect x={284} y={142} width={80} height={6} rx={3} fill={LINE} />
      <rect x={284} y={156} width={56} height={6} rx={3} fill={LINE} />
    </>
  );
}

function Sports() {
  return (
    <>
      <circle cx={350} cy={92} r={36} fill={AMB} />
      <polygon points="0,220 120,90 210,170 300,70 410,180 480,140 480,320 0,320" fill={FG2} />
      <polygon points="0,250 90,170 180,230 280,150 380,240 480,190 480,320 0,320" fill={FG} />
      <path d="M0 270C120 240 300 280 480 250V320H0Z" fill={SAND} />
      <path d="M140 320C170 290 300 296 270 268S230 240 282 222" fill="none" stroke={CREAM} strokeWidth={10} strokeLinecap="round" opacity={0.9} />
      {/* flag */}
      <line x1={300} y1={70} x2={300} y2={34} stroke={CREAM} strokeWidth={2} />
      <polygon points="301,34 322,40 301,47" fill={ACC} />
      <Person x={268} y={240} s={0.6} fill={ACC} />
      <Person x={250} y={286} s={0.8} fill={FG} />
      <Person x={194} y={310} s={1} fill={FG2} />
    </>
  );
}

const SCENES: Record<EventCategory, { el: () => ReactNode; label: string }> = {
  hackathon: { el: Hackathon, label: "A laptop with a glowing screen under string lights" },
  concert: { el: Concert, label: "A small concert stage with spotlights and a crowd" },
  film: { el: Film, label: "A cinema screen above rows of seats" },
  conference: { el: Conference, label: "A speaker at a podium beside a chart slide" },
  comedy: { el: Comedy, label: "A single microphone in a spotlight by a stool" },
  workshop: { el: Workshop, label: "A worktable with sticky notes, pencils and swatches" },
  sports: { el: Sports, label: "Runners on a mountain trail toward a flag" },
};

export function EventArt({ category, className }: Props & { category: EventCategory }) {
  const scene = SCENES[category] ?? SCENES.conference;
  const Scene = scene.el;
  return (
    <Svg w={480} h={320} slice label={`${ART_LABEL[category] ?? "Event"}: ${scene.label}`} className={className}>
      <rect width={480} height={320} fill={CREAM} />
      <Scene />
    </Svg>
  );
}

/* ---------------------------------- Queue -------------------------------- */

export function QueueArt({ className }: Props) {
  const stones = Array.from({ length: 11 }, (_, i) => ({
    x: 28 + i * 44,
    y: Math.round(170 - 16 * Math.sin(i * 0.7) - i * 2),
  }));
  return (
    <Svg w={560} h={220} slice label="A line of people spaced out on stepping stones toward a gate, one highlighted as you" className={className}>
      <rect width={560} height={220} fill={CREAM} />
      <circle cx={518} cy={90} r={70} fill={SOFT} opacity={0.6} />
      <path d="M0 180C140 160 300 196 560 168V220H0Z" fill={SAND} />
      {stones.map((s, i) => (
        <ellipse key={i} cx={s.x} cy={s.y} rx={16} ry={5} fill={DUNE} />
      ))}
      {stones.slice(0, 10).map((s, i) => (
        <Person key={i} x={s.x} y={s.y - 1} s={0.9} fill={i === 6 ? ACC : i % 2 ? FG2 : FG} />
      ))}
      {/* gate */}
      <path d="M498 152V86H542V152H534V102A12 12 0 0 0 506 102V152Z" fill={FG} />
      <rect x={498} y={112} width={8} height={6} fill={ACC} />
      <rect x={534} y={112} width={8} height={6} fill={ACC} />
      <circle cx={520} cy={78} r={5} fill={AMB} />
      <Stars pts={[[470, 50], [440, 80], [60, 60]]} r={2} />
    </Svg>
  );
}

/* --------------------------------- Ticket -------------------------------- */

export function TicketArt({ className }: Props) {
  return (
    <Svg w={360} h={260} label="A confirmed ticket with a check mark" className={className}>
      <rect width={360} height={260} fill={CREAM} />
      <circle cx={180} cy={130} r={110} fill={SAND} />
      <g transform="translate(70 76) rotate(-8 110 54)">
        <path d={ticketPath(220, 108, 12)} fill={FG} />
        <line x1={160} y1={10} x2={160} y2={98} stroke={CREAM} strokeWidth={2} strokeDasharray="4 5" opacity={0.7} />
        <rect x={22} y={24} width={90} height={9} rx={4.5} fill={AMB} />
        <rect x={22} y={44} width={64} height={7} rx={3.5} fill={CREAM} opacity={0.5} />
        <rect x={22} y={60} width={78} height={7} rx={3.5} fill={CREAM} opacity={0.5} />
        <rect x={176} y={22} width={28} height={64} rx={3} fill={FG2} />
      </g>
      <circle cx={262} cy={170} r={28} fill={SAGE} />
      <polyline points="249,170 258,179 276,161" fill="none" stroke={CREAM} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" />
      <Stars pts={[[66, 54], [300, 48], [40, 180], [320, 110]]} r={4} />
      <Stars pts={[[110, 36], [254, 30], [90, 214]]} r={3.5} fill={ACC} />
      <rect x={196} y={210} width={10} height={4} rx={2} fill={AMB} transform="rotate(30 201 212)" />
      <rect x={134} y={44} width={10} height={4} rx={2} fill={ACC} transform="rotate(-40 139 46)" />
    </Svg>
  );
}

/* ---------------------------------- Empty -------------------------------- */

export function EmptyArt({ className }: Props) {
  return (
    <Svg w={320} h={220} label="An empty bench under a street lamp" className={className}>
      <Glow id="fd-empty-glow" opacity={0.6} />
      <rect width={320} height={220} fill={CREAM} />
      <circle cx={214} cy={60} r={70} fill="url(#fd-empty-glow)" />
      <polygon points="214,62 168,176 260,176" fill={AMB} opacity={0.14} />
      <path d="M0 176C90 168 200 182 320 172V220H0Z" fill={SAND} />
      {/* lamp */}
      <rect x={211} y={60} width={6} height={118} fill={FG} />
      <polygon points="200,50 228,50 222,64 206,64" fill={FG} />
      <rect x={206} y={60} width={16} height={6} rx={2} fill={AMB} />
      <rect x={206} y={176} width={16} height={4} rx={1} fill={FG} />
      {/* bench */}
      <rect x={70} y={132} width={110} height={8} rx={2} fill={FG2} />
      <rect x={70} y={148} width={110} height={8} rx={2} fill={FG} />
      <rect x={80} y={156} width={6} height={20} fill={FG} />
      <rect x={164} y={156} width={6} height={20} fill={FG} />
      <rect x={80} y={138} width={6} height={12} fill={FG2} />
      <rect x={164} y={138} width={6} height={12} fill={FG2} />
      <Stars pts={[[50, 40], [110, 70], [290, 30], [270, 100]]} r={2} />
    </Svg>
  );
}

/* ---------------------------------- Gate --------------------------------- */

export function GateArt({ className }: Props) {
  return (
    <Svg w={320} h={320} label="A small gate with a shield badge politely stopping a robot at the barrier" className={className}>
      <rect width={320} height={320} fill={CREAM} />
      <circle cx={160} cy={150} r={140} fill={SAND} />
      <circle cx={160} cy={150} r={96} fill={SOFT} opacity={0.6} />
      <path d="M0 250C100 240 220 258 320 246V320H0Z" fill={DUNE} />
      {/* gate */}
      <path d="M60 250V120H160V250H142V148A32 32 0 0 0 78 148V250Z" fill={FG} />
      <rect x={60} y={176} width={18} height={10} fill={ACC} />
      <rect x={142} y={176} width={18} height={10} fill={ACC} />
      {/* barrier arm */}
      <rect x={154} y={196} width={14} height={54} rx={3} fill={FG2} />
      <rect x={160} y={196} width={92} height={10} rx={5} fill={CREAM} />
      {[0, 1, 2, 3].map((i) => (
        <rect key={i} x={170 + i * 22} y={196} width={11} height={10} fill={ACC} />
      ))}
      {/* shield */}
      <path d="M110 50L140 60V84C140 102 128 114 110 120C92 114 80 102 80 84V60Z" fill={SAGE} />
      <rect x={100} y={80} width={20} height={16} rx={3} fill={CREAM} />
      <path d="M104 80V74A6 6 0 0 1 116 74V80" fill="none" stroke={CREAM} strokeWidth={3} />
      {/* robot */}
      <g transform="translate(250 196)">
        <line x1={0} y1={-34} x2={0} y2={-48} stroke={FG2} strokeWidth={3} />
        <circle cx={0} cy={-50} r={4} fill={AMB} />
        <rect x={-20} y={-34} width={40} height={34} rx={10} fill={FG2} />
        <circle cx={-8} cy={-18} r={3.5} fill={CREAM} />
        <circle cx={8} cy={-18} r={3.5} fill={CREAM} />
        <rect x={-14} y={6} width={28} height={40} rx={10} fill={FG2} />
      </g>
      <path d="M232 132Q250 112 270 126" fill="none" stroke={ACC} strokeWidth={3} strokeLinecap="round" />
      <polyline points="262,120 270,126 262,132" fill="none" stroke={ACC} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
