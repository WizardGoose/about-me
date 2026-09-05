/**
 * The mark's geometry, in one pure module.
 *
 * WHAT THIS IS
 * ------------
 * The mark is the wordmark `W.W`. Two W letterforms and a full stop, set the
 * way that string is actually set: the W's stand on a baseline and the dot sits
 * ON that baseline between them. At rest it is not a face doing an impression
 * of a wordmark, it IS the wordmark, and every expression has to leave it
 * still reading as one.
 *
 * `frames.ts` drew this as 26 rasterised pixel frames and `FramePlayer.tsx`
 * flipped between them. Both are retired. What survives from that file is its
 * model, stated in its own doc comment: every expression is a bold zigzag spine
 * through five control points, and the letterform is that spine. That model was
 * already continuous; rasterising it was the only thing that made it discrete.
 * So the five points stay, the rasteriser goes, and the spine is stroked as an
 * SVG path that can be reshaped every frame.
 *
 * THE MOTION LANGUAGE: SCALE, NOT SPACE
 * --------------------------------------
 * Nothing in this file translates. Not the eyes, not the mouth, not the mark.
 * There is no gaze, no lean, no drift across the canvas and no rotation, and
 * their absence is the design rather than an omission. An earlier version had
 * all of them and it was rejected on sight for exactly that reason: sliding a
 * letterform around is animating a SPRITE, and this is a wordmark, so the
 * moment a W leaves its slot the thing stops being type and starts being a
 * mascot wearing type.
 *
 * What is left is the interesting half. The letterform deforms IN PLACE, like
 * something with volume rather than something on rails. A pose is three
 * numbers, `squash`, `spread` and `weight`, and the spine itself is a constant,
 * so the mark is only ever the canonical W at some proportion. That makes "the
 * letterform never changes, only its proportions" an invariant a test can hold
 * rather than a promise in a comment.
 *
 * Two consequences, both load bearing:
 *
 *   1. SQUASH PIVOTS AT THE FEET, not at the middle. Vertical scale happens
 *      about the valleys, so the W's feet never leave the baseline whatever it
 *      does. Pivoting at the middle lifts the feet off the line the dot sits
 *      on, which breaks the typographic reading, and it is what the first
 *      version did.
 *   2. MASS IS ROUGHLY CONSERVED. Squashing down spreads sideways, stretching
 *      up pulls in. That is what makes it read as a volume being deformed
 *      rather than a box being rescaled.
 *
 * THE ANATOMY RULE, WHICH IS NOT NEGOTIABLE
 * ------------------------------------------
 * The two W's are the EYES. The full stop is the MOUTH. The mouth never flips,
 * never rotates, never changes shape and NEVER TRANSLATES: it lives at the
 * baseline, full stop, literally. Its only channel is a scale that pivots on
 * the baseline itself, so even growing it leaves its foot exactly where a
 * period's foot belongs. Everything expressive happens in the eyes, which is
 * what `face.ts` has said all along.
 *
 * WHY THE MATH IS HERE AND NOT IN THE COMPONENT
 * ---------------------------------------------
 * Same reason `face.ts` is separate from its renderer: what a pose resolves to,
 * whether the feet stay planted, and whether the ink still fits the canvas are
 * plain functions of plain data, and all three are worth testing without a DOM.
 * The component owns timers and one `requestAnimationFrame` loop, nothing else.
 *
 * `MARK_SPEC` at the bottom is the whole of this file's data in one
 * serialisable object. `bench/ww-frames-preview.html` embeds a copy so the
 * animation can be judged on a served page with no build step. Nothing
 * currently asserts the two are equal, so the preview can drift from what the
 * site renders; treat this file as the authority and the preview as a copy
 * that may be stale.
 */

import { TIMING, YAWN_CLOSE_MS, YAWN_HOLD_MS, YAWN_OPEN_MS } from "./face";
import type { EyeGlyph } from "./face";

/* ------------------------------------------------------------------------ *
 * Colour
 * ------------------------------------------------------------------------ */

/**
 * The mark's two colours, unchanged from the frame era.
 *
 * Declared here rather than imported from `frames.ts` on purpose: that file is
 * off the live path now, and importing a single constant out of it would put
 * 27KB of retired pixel data back into the front door's module graph. The
 * component paints with the theme's own Tailwind tokens; these exist so the
 * standalone preview, which has no Tailwind, can match it.
 */
export const MARK_WHITE = "#e8edf3";
export const MARK_ACCENT = "#00b3f0";

/* ------------------------------------------------------------------------ *
 * Canvas geometry
 * ------------------------------------------------------------------------ */

/**
 * The drawing surface, kept at the frame era's 35x12 so the mark occupies the
 * same footprint and the landing page's width and aspect classes do not move.
 */
export const CANVAS_W = 35;
export const CANVAS_H = 12;

/**
 * Where the three parts sit.
 *
 * The eye centres are placed SYMMETRICALLY about the mouth. The rasterised
 * frames were half a pixel out of true here (left eye on 5.5, right on 28.5,
 * mouth on 17.5) because a pixel grid cannot hold a half unit; a vector canvas
 * can, and a wordmark whose letters are not evenly spaced about its full stop
 * looks very slightly wrong in a way nobody can name.
 */
export const MOUTH_CX = 17.5;
/*
 * 11.4, down from 12 (owner, "move the eyes a little bit closer together, not
 * by much, just a little"). That is 5% off the gap, which is about a pixel and
 * a half at the largest rendered size: enough to tighten the mark into one word
 * rather than three marks sharing a line, and small enough that nobody who has
 * not seen the two side by side would be able to say what changed.
 *
 * The floor on this number is the dot: the letters must never crowd it. At 11.4
 * the widest pose's ink stops at x 11.6 and the dot's guard line is 15.35, so
 * there are almost four canvas units of clearance left. It is the only constant
 * here with room to keep moving, and a test holds that clearance.
 */
export const EYE_OFFSET = 11.4;
export const EYE_CX_L = MOUTH_CX - EYE_OFFSET;
export const EYE_CX_R = MOUTH_CX + EYE_OFFSET;

/** The width of one eye's control box, corner to corner. */
export const EYE_W = 8;
/** Canvas y of the resting corners, and of the resting valleys. */
export const EYE_TOP = 1.5;
export const EYE_BOT = 10.95;
export const EYE_H = EYE_BOT - EYE_TOP;

/** The spine's stroke width at `weight` 1. Heavy, as the drawn W was. */
export const STROKE = 2.06;

/**
 * THE BASELINE. The line the whole mark stands on.
 *
 * The valleys are the W's control points, but the drawn foot is half a stroke
 * lower, because the spine is stroked with round caps, so the OPTICAL bottom of
 * the letter is `EYE_BOT + STROKE / 2`. That is the line a typesetter would
 * call the baseline, and it is where the full stop has to sit: aligned to the
 * ink, not to the control point. Derived rather than typed so it cannot fall
 * out of step if the stroke weight is ever retuned.
 */
export const BASELINE = EYE_BOT + STROKE / 2;

/**
 * The mouth: a ROUND DOT.
 *
 * It was 3.0 wide against 2.15 tall with a 0.95 corner, inherited from the
 * rasterised mark's 3x2 mouth. At vector scale that is not a full stop, it is a
 * rounded dash - the owner's words were "lets also make the mouth just . not a
 * - rounded please" - and a dash reads as a closed mouth or a minus sign rather
 * than as the period in `W.W`.
 *
 * So width equals height and the corner radius is half of it, which is a
 * circle. Written as three lines that derive from one number rather than as
 * three literals, so the dot cannot be made oval again by editing one of them.
 *
 * This also simplifies the petted mouth to exactly what the spec asked for. The
 * `hollow` channel used to have to narrow the rect from 3.0 to 2.15 before it
 * could round it into an o; now the shape is ALREADY the o's shape and opening
 * the mouth is purely the fill giving way to a ring. "An o sized down to a dot"
 * became true of the geometry rather than something the animation had to
 * arrange.
 */
export const MOUTH_H = 2.15;
export const MOUTH_W = MOUTH_H;
export const MOUTH_R = MOUTH_H / 2;

/**
 * The dot's centre, derived so its BOTTOM lands exactly on the baseline.
 *
 * This is the correction that mattered most. The first version centred the dot
 * vertically between the W's, which put it at their optical middle and made the
 * mark read as a face with a floating nose rather than as the string `W.W`. A
 * period sits on the baseline, so its centre is half its own height above it,
 * and that is written as a subtraction rather than as a constant so it stays
 * true if the dot is ever resized.
 */
export const MOUTH_CY = BASELINE - MOUTH_H / 2;

/* ------------------------------------------------------------------------ *
 * The closed eye: ADLaM Display's o, measured
 * ------------------------------------------------------------------------ */

/**
 * The counter ratio of ADLaM Display's lowercase `o`: the width of its hole
 * over the width of the whole glyph.
 *
 * MEASURED, not guessed. The font is self-hosted at
 * `public/fonts/adlam-display-latin-v1.woff2`, so it was rendered at 600px in
 * the browser that already loads it and the pixels were read back:
 *
 *   glyph  outer W x H (em)   aspect W/H   ring/diameter   counter/outer
 *   O      0.677 x 0.723      0.936        0.246 sides     0.507
 *   o      0.538 x 0.523      1.029        0.294           0.412
 *
 * The measurement decided which glyph this is built from. The CAPITAL O is not
 * a circle: it is six percent taller than it is wide, and its stroke is
 * modulated (100px at the sides against 79px top and bottom), the way a real
 * typeface draws an O. The LOWERCASE o is the one that is essentially a perfect
 * circle, at an aspect of 1.029, which is also the shape the brief asked for
 * and matches "a capital W to a lowercase w". So the closed eye takes the
 * lowercase o's proportions.
 *
 * As a cross check that the right font was measured: the O's advance came back
 * at 0.7642em, which is exactly the number `face.ts` already records for it in
 * `GLYPH_METRICS`.
 */
export const ADLAM_O_COUNTER_RATIO = 0.4118;

/**
 * The radius of the closed eye's stroke CENTRELINE.
 *
 * Derived rather than typed, because the thing that has to be true is the
 * RATIO. Our stroke weight is already fixed by the letterform, so requiring
 * `(2R - S) / (2R + S)` to equal the measured counter ratio pins the radius:
 *
 *   R = S (1 + r) / (2 (1 - r))
 *
 * which lands on 2.472, an outer diameter of 7.0 against a stroke of 2.06.
 * That reproduces the font's ring character at our own weight: a ring whose
 * hole is 41% of its outer width, exactly as the drawn glyph is.
 */
export const CIRCLE_R =
  (STROKE * (1 + ADLAM_O_COUNTER_RATIO)) / (2 * (1 - ADLAM_O_COUNTER_RATIO));

/**
 * Where the closed eye's circle is centred: its own slot, ON the baseline.
 *
 * Not sitting on the baseline the way a lowercase o would, but centred on it,
 * so it hangs half below the line. That is the brief, verbatim: "it can dip
 * into the baseline a bit, actually just set the center point on it". It is
 * the one thing in the mark that deliberately crosses the baseline, and it is
 * why the SVG is `overflow-visible`.
 */
export const CIRCLE_CY = BASELINE;

/**
 * How many segments the morph path is sampled into.
 *
 * A multiple of four, so the W's two valleys and its peak land exactly on
 * sample points and the resting letterform is reproduced without error. At
 * this radius the chord error of a 48 sided polygon is about five thousandths
 * of a canvas unit, which is far below one screen pixel at any size the mark
 * is drawn.
 */
export const MORPH_SAMPLES = 48;

/**
 * The five control points of a resting W, and the only letterform this file
 * has. `x` runs 0 (left corner) to 1 (right corner); `y` runs 0 (the corners,
 * at the top) to 1 (the valleys, at the foot), the same direction SVG's y axis
 * runs, so nothing here has to negate anything.
 *
 * Every expression is this shape at some proportion. Nothing moves a point.
 */
export const SPINE: readonly (readonly [number, number])[] = [
  [0, 0],
  [0.25, 1],
  [0.5, 0.4],
  [0.75, 1],
  [1, 0],
];

/**
 * The local y that vertical scale pivots around: 1, the valleys, the feet.
 *
 * Named rather than inlined because it is the entire anchoring rule in one
 * number, and because a test asserts the feet do not move for ANY pose, which
 * is only true while this is exactly 1.
 */
export const FOOT = 1;

/* ------------------------------------------------------------------------ *
 * Poses
 * ------------------------------------------------------------------------ */

/**
 * One eye's proportions. Three numbers, no positions.
 *
 * There is deliberately no `lift`, no `x`, no `y` and no rotation. A pose
 * cannot express "somewhere else", only "some other shape", and that is
 * enforced by the type rather than by discipline.
 */
export interface Pose {
  /** Vertical scale about the feet. Above 1 grows taller, below 1 squashes. */
  squash: number;
  /** Horizontal scale about the letter's own centre. */
  spread: number;
  /** Stroke width multiplier. Thicker reads as heavier, not as larger. */
  weight: number;
  /**
   * How far the letterform has become the O. 0 is the W, 1 is the circle.
   *
   * This is a SHAPE channel, not a position one: it says which of two shapes
   * the letter is, not where it is. It is the only pose channel that is not a
   * proportion, and it exists because a blink is no longer a squash. It may go
   * slightly negative when the opening tween overshoots, which flexes the W a
   * few percent past rest and reads as a snap.
   */
  round: number;
}

/**
 * Every proportion a single eye can hold.
 *
 * Read the `squash` and `spread` columns against each other and the physics is
 * visible: everything that squashes also spreads, everything that stretches
 * also narrows. That is conserved mass, and it is why these read as a volume
 * deforming rather than a logo being rescaled.
 *
 *   W           rest. The canonical wordmark.
 *   u           blink. Collapses onto the baseline and bulges wide. This is
 *               `frames.ts`'s "symmetric crop toward the centre, closed = a
 *               bar", re-aimed at the feet so the letter melts down onto its
 *               own baseline instead of hovering above it.
 *   O           alert. Grows taller and pulls in narrower. `frames.ts` drew
 *               this as the brow lifting; as a proportion it is a taller,
 *               tenser letter.
 *   ^           satisfied. Compresses down and spreads wide: the squint.
 *   scanBig     one half of thinking, see `eyePosesFor`.
 *   scanSmall   the other half.
 *   pet         being petted: the shoulders drop a little and widen.
 *
 * There is no wink. It was `W.w` briefly and was removed on the owner's call,
 * along with the double blink; the mark's ambient life is the breath, the
 * slosh, the blink and the zzz.
 *
 * There is no `>` or `<` entry, because thinking is not a pose either eye can
 * hold on its own. See `eyePosesFor`.
 */
export type PoseName = "W" | "w" | "u" | "O" | "^" | "scanBig" | "scanSmall" | "pet" | "yawn";

export const POSES: Record<PoseName, Pose> = {
  W: { squash: 1, spread: 1, weight: 1, round: 0 },
  /* SLEEP. The lowercase w, built as a proportion rather than as a second
     letterform, which is the point: `squash` already pivots about the FEET, so
     letting the air out of the W lowers its shoulders without moving the line
     it stands on. That is precisely the difference between an upper and a lower
     case w, and it means the transition between them is one number moving
     rather than a glyph swap.

     0.62 is where it stops reading as "a squashed W" and starts reading as "a
     small w". Above about 0.7 it looks like the mark is being sat on; below
     about 0.55 the two strokes collapse into each other at the smallest
     rendered size.

     Spread only goes to 1.04 rather than the ~1.15 conservation would ask for.
     A sleeping letter is not being COMPRESSED by anything, it is relaxing, and
     mass conservation is a rule about impacts.

     Weight is 0.955, and it was 0.9 until a test refused it. A lighter stroke
     is the cheapest way to say "less awake" without moving anything, so the
     instinct was right; 0.9 was simply too much of it. The drawn round cap
     hangs half a stroke below the control points, so a lighter letter's foot
     lifts OFF the baseline by exactly that difference, and the foot-on-the-line
     invariant is held to 0.05 canvas units. 0.9 spends 0.103 of that budget and
     0.955 spends 0.046. The letters stay welded to the line and the stroke is
     still visibly softer. */
  w: { squash: 0.62, spread: 1.04, weight: 0.955, round: 0 },
  /* THE BLINK IS THE SLEEPING SHAPE, HELD BRIEFLY.
     ------------------------------------------------------------------
     It was a MORPH: the W closed into a circle, in the accent, so a blink was a
     colour beat as well as a shape one. The owner rejected it outright - "seeing
     it change to an o and blue is too off putting" - and asked for `w.w`, which
     is the pose the sleeping face already holds.

     So the numbers here are byte-identical to `w` above, and that is the whole
     change. What still separates a blink from a nap is TIME and CONTEXT: a
     blink closes in 72ms and opens in 158ms, a nap takes 900ms to arrive and
     brings a zzz with it. The same drawing at two speeds means two things,
     which is how eyelids actually work.

     `round` going to 0 has one consequence worth stating: nothing in the pose
     table reaches the circle any more, so `accentMix` is always 0 and the
     letters never take the accent. The morph machinery below (CIRCLE_R,
     `circleAt`, MORPH_SAMPLES, the `round` channel itself) is therefore
     currently unused. It is retired in place rather than deleted, the way this
     project retires things it may want back: `round` is still a real channel,
     still interpolated, and still the only way to express "some other shape". */
  u: { squash: 0.62, spread: 1.04, weight: 0.955, round: 0 },
  O: { squash: 1.09, spread: 0.93, weight: 1.02, round: 0 },
  "^": { squash: 0.6, spread: 1.12, weight: 1.03, round: 0 },
  scanBig: { squash: 1.06, spread: 0.97, weight: 1.02, round: 0 },
  scanSmall: { squash: 0.97, spread: 1.02, weight: 0.99, round: 0 },
  /* PETTED. Barely anything, and that is deliberate.

     Everything loud about this state happens elsewhere: the mouth opens into a
     hollow o, the cheeks colour, and the underscores arrive. If the letters
     ALSO deformed hard, the three would compete and the face would read as
     startled rather than as pleased. So the W's do what a person's shoulders do
     when they are enjoying something, which is drop very slightly and widen.

     It is a smaller move than `^` (0.6 squash) on purpose: `^` is a squint, an
     eyes-closed reaction to a result landing. Petting is eyes-open. */
  pet: { squash: 0.93, spread: 1.05, weight: 1.02, round: 0 },
  /* YAWN. The eyes screw shut harder than any other state.

     0.46 is below the squint (`^` at 0.6) and below sleep (0.62), and it has to
     be both: a yawn is the one moment the mark's eyes are FORCED shut rather
     than resting shut, and if it did not out-squash the squint the two would
     read as the same face with a different mouth. The spread goes to 1.2, the
     widest in the table, because that is what conservation asks for at this
     squash and because a yawn genuinely does widen a face. */
  yawn: { squash: 0.46, spread: 1.2, weight: 1.04, round: 0 },
};

/** The pose the mark rests in, and the one every expression returns to. */
export const REST_POSE: PoseName = "W";

/**
 * Which pose each eye holds, given the glyph the brain resolved and whether a
 * petting or a yawn is running. Returns `[left, right]`.
 *
 * This is where thinking lives now. `face.ts` models a query in flight as a
 * sign that flips every `scanFlip`, and the frame era spent that sign on a
 * sideways translate of the whole spine. Translation is gone, so the sign is
 * spent on WHICH LETTER SWELLS instead: the mark considers the question by
 * passing a slow pulse back and forth between its two W's. That keeps the
 * brain's semantics exactly (`>` and `<` still mean opposite things, still
 * alternate on the same timer) while costing nothing in space.
 *
 * It also makes thinking asymmetric, which is something the glyph
 * model could never express: `resolveEye` returns ONE glyph for both eyes by
 * construction. Both asymmetric states live here rather than in the component
 * so they can be tested as a plain function.
 */
export const eyePosesFor = (glyph: EyeGlyph, petted = false, yawning = false): [PoseName, PoseName] => {
  /* A yawn is a whole-face event, so it takes both letters. Half a yawn would
     look like a fault rather than like an expression. */
  if (yawning) return ["yawn", "yawn"];
  if (petted) return ["pet", "pet"];
  if (glyph === ">") return ["scanSmall", "scanBig"];
  if (glyph === "<") return ["scanBig", "scanSmall"];
  return [glyph, glyph];
};

/**
 * The single pose name standing for what the FACE is doing, used for the
 * mouth's scale and for damping the idle slosh. Asymmetric states are
 * represented by their louder half.
 */
export const facePoseFor = (glyph: EyeGlyph, petted = false, yawning = false): PoseName => {
  if (yawning) return "yawn";
  if (petted) return "pet";
  if (glyph === ">" || glyph === "<") return "scanBig";
  return glyph;
};

/**
 * What the mouth is allowed to do, which is one thing.
 *
 * `scale` pivots on the BASELINE, not on the dot's own centre, so a growing dot
 * grows upward and its foot stays welded to the line. That distinction is the
 * whole of "the mouth never translates": scaling about the centre would push
 * the foot below the baseline every time the mark reacted to anything.
 *
 * There is no second channel, and there was one for a while. The drawn
 * satisfied frames put two accent pips either side of the mouth where the
 * upturned corners of a smile would be, and those were built here first as a
 * `smile` channel that faded in. They were cut after looking at them: in the
 * raster those pips were one pixel each, sitting one row above a mouth bar that
 * had ITSELF shrunk, so the three marks read as one upturned mouth. Rebuilt at
 * vector scale against a dot that keeps its height, the same two pips detach
 * and read as ears.
 *
 * Note that `u` is identical to `W`. A blink must not move the mouth at all:
 * the eyes closing while the mouth twitches is the single fastest way to stop a
 * face reading as a face.
 */
export interface MouthPose {
  scale: number;
  /**
   * How far the mouth has opened, 0 is the solid full stop and 1 is the hollow
   * o. ADDED for the petted face.
   *
   * It is a SHAPE channel exactly like the eye's `round`, and it is one number
   * rather than a second element for the same reason `round` is: two elements
   * cross-fading would mean two mouths existing at once at half opacity, and a
   * half-transparent dot over a half-transparent ring reads as a rendering
   * fault rather than as a mouth opening.
   *
   * What it drives, all at once and all from this one value:
   *   the rect narrows from the dot's 3.0 wide to its own 2.15 height, so it
   *   becomes a square and therefore, at full corner radius, a circle;
   *   the corner radius runs to half that height, which IS a circle;
   *   the fill fades out and a stroke of the same colour fades in.
   *
   * The size never grows. The owner's spec is "o sized down to . size so its
   * like a hollow ." - the mouth opens, it does not inflate.
   */
  hollow: number;
}

export const MOUTH_POSES: Record<PoseName, MouthPose> = {
  W: { scale: 1, hollow: 0 },
  /* The sleeping mouth is a little smaller and still solid. A hollow mouth
     while asleep would read as snoring with the mouth open, which is a
     different and much less flattering joke.

     0.92 rather than the 0.88 this started at: the dot is held between 0.9 and
     1.15 across every state so that it never stops reading as the same full
     stop, and 0.88 broke the floor. The rule is right - a mouth that shrinks by
     an eighth while the eyes are also shrinking reads as the whole mark being
     scaled down, which is precisely the thing the pose model exists to avoid. */
  w: { scale: 0.92, hollow: 0 },
  u: { scale: 1, hollow: 0 },
  O: { scale: 0.955, hollow: 0 },
  "^": { scale: 1.07, hollow: 0 },
  scanBig: { scale: 0.98, hollow: 0 },
  scanSmall: { scale: 0.98, hollow: 0 },
  /* The whole of `WoW`. Scale stays at 1 so the o occupies the dot's exact
     footprint. */
  pet: { scale: 1, hollow: 1 },
  /* IDENTICAL to `pet` (owner: "make yawn just be the wow again o the size of
     .").  It grew to 1.15 for a while and that was wrong: a yawn does not make
     a mouth BIGGER in the sense a scale does, it changes its shape, and a
     uniformly scaled-up dot just reads as a zoomed logo. The shape change lives
     in `yawnStretch` below, which is motion rather than a pose. */
  yawn: { scale: 1, hollow: 1 },
};

/* ------------------------------------------------------------------------ *
 * Easing
 * ------------------------------------------------------------------------ */

export type EaseName = "linear" | "inQuad" | "outCubic" | "inOutCubic" | "inOutSine" | "outBack";

/**
 * The eased fraction of a transition at raw progress `t`, clamped to [0, 1].
 *
 * `outBack` overshoots its target and settles back. It is used for every
 * ARRIVAL and never for a release, and that split is the main reason the result
 * reads as alive rather than mechanical: something that arrives eagerly and
 * lets go calmly is doing what a linear tween in either direction cannot fake.
 * Mechanical motion is symmetric; living motion is not. On a squash and stretch
 * vocabulary it earns its keep twice over, because an overshooting SCALE is
 * exactly the wobble a soft body has when it stops.
 */
export const ease = (name: EaseName, t: number, back = 1.7): number => {
  const p = t <= 0 ? 0 : t >= 1 ? 1 : t;
  switch (name) {
    case "linear":
      return p;
    case "inQuad":
      return p * p;
    case "outCubic":
      return 1 - Math.pow(1 - p, 3);
    case "inOutCubic":
      return p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
    case "inOutSine":
      return -(Math.cos(Math.PI * p) - 1) / 2;
    case "outBack":
      return 1 + (back + 1) * Math.pow(p - 1, 3) + back * Math.pow(p - 1, 2);
  }
};

/* ------------------------------------------------------------------------ *
 * Transitions
 * ------------------------------------------------------------------------ */

export interface Transition {
  ms: number;
  ease: EaseName;
  back?: number;
}

/**
 * How long a blink takes, in three parts.
 *
 * The closing and opening halves are deliberately UNEQUAL, and that asymmetry
 * is doing more work than any other number in this file. A real lid falls under
 * its own weight and is pulled back up, so a blink that shuts in 72ms and opens
 * over 158ms with a small overshoot reads as a blink, while the same blink
 * played symmetrically reads as a flicker. The frame era could not have this at
 * all: it had one 90ms frame at the bottom and hard cuts either side of it.
 *
 * The shut hold is DERIVED from `face.ts`'s `blinkHold` rather than invented.
 * That constant is documented there as the glyph era's hold, reasoning that "a
 * hard cut needs less time than a squash"; now that there IS a squash, the same
 * reasoning runs the other way and the hold shrinks, because the 72ms close is
 * already reading as part of the blink.
 */
export const BLINK_CLOSE_MS = 72;
export const BLINK_SHUT_MS = Math.round(TIMING.blinkHold * 0.38);
export const BLINK_OPEN_MS = 158;

/**
 * The three blink phases added up, which is what a blink costs at scale 1.
 *
 * The owner asked for the whole blink to vary between 250ms and 350ms, so the
 * renderer scales all three phases by `blinkDuration(rand) / BLINK_TOTAL_BASE`.
 * Scaling from a stated base rather than randomising each phase is what keeps
 * the SHAPE of a blink constant: the open stays roughly twice the close at
 * every duration, so a long blink is a slow blink rather than a different
 * gesture.
 *
 * 276 sits near the middle of the requested range, so the average blink is
 * almost exactly what it was and only its regularity has changed.
 */
export const BLINK_TOTAL_BASE = BLINK_CLOSE_MS + BLINK_SHUT_MS + BLINK_OPEN_MS;

/**
 * How long one letter lags the other, in milliseconds.
 *
 * Small enough that nobody will consciously see it, large enough that its
 * absence is felt: two letters that deform on precisely the same frame are one
 * animation played twice, not two eyes.
 */
export const EYE_LAG_MS = 38;

/** Fraction of `TIMING.scanFlip` spent moving; the rest is held at the extreme. */
export const SCAN_MOVE_FRACTION = 0.62;

export type TransitionName =
  | "blinkClose"
  | "blinkOpen"
  | "alertIn"
  | "happyIn"
  | "scan"
  | "sleepIn"
  | "sleepOut"
  | "petIn"
  | "petOut"
  | "yawnIn"
  | "yawnOut"
  | "release"
  | "fallback";

/**
 * Every tween in the mark, as data.
 *
 * Reading down the `ease` column: every ARRIVAL is `outBack` and every RELEASE
 * is `outCubic`. These live in `MARK_SPEC` so the standalone preview reads the
 * same numbers instead of keeping a second copy of them.
 */
export const TRANSITIONS: Record<TransitionName, Transition> = {
  blinkClose: { ms: BLINK_CLOSE_MS, ease: "inQuad" },
  blinkOpen: { ms: BLINK_OPEN_MS, ease: "outBack", back: 1.9 },
  alertIn: { ms: 245, ease: "outBack", back: 1.35 },
  happyIn: { ms: 215, ease: "outBack", back: 2.1 },
  scan: { ms: Math.round(TIMING.scanFlip * SCAN_MOVE_FRACTION), ease: "inOutCubic" },
  /* Sleep breaks the "every arrival is outBack" pattern, and it is the only
     entry that does. `outBack` overshoots then settles, which is a snap, and a
     snap is the one thing nodding off must not be. `inOutSine` starts slow,
     runs, and arrives slow, which is what a head dropping looks like. */
  sleepIn: { ms: TIMING.sleepIn, ease: "inOutSine" },
  /* Waking DOES get the overshoot, and the asymmetry is the joke: falling
     asleep is gradual, being woken is a start. */
  sleepOut: { ms: TIMING.sleepOut, ease: "outBack", back: 1.8 },
  petIn: { ms: TIMING.petIn, ease: "outBack", back: 2.2 },
  petOut: { ms: TIMING.petOut, ease: "outCubic" },
  /* Both slow, and neither overshoots. A yawn that sprang open or snapped shut
     would be a flinch; the whole read of the state is that it is involuntary
     and unhurried. `inOutSine` on the way in for the same reason sleep uses it. */
  yawnIn: { ms: YAWN_OPEN_MS, ease: "inOutSine" },
  yawnOut: { ms: YAWN_CLOSE_MS, ease: "inOutSine" },
  release: { ms: 315, ease: "outCubic" },
  fallback: { ms: 260, ease: "outCubic" },
};

/**
 * Which tween a given change of pose uses.
 *
 * Keyed on the PAIR rather than on the destination alone, because the two
 * halves of a blink are the same two poses in opposite directions and must not
 * share a duration. Everything else is keyed on where it is going.
 */
export const transitionNameFor = (from: PoseName, to: PoseName): TransitionName => {
  if (to === "u") return "blinkClose";
  if (from === "u") return "blinkOpen";
  if (to === "pet") return "petIn";
  if (from === "pet") return "petOut";
  if (to === "yawn") return "yawnIn";
  if (from === "yawn") return "yawnOut";
  /*
   * Both sleep rules sit ABOVE the `to === "W"` release, and the FROM rule is
   * the one that needs it. Waking is `w -> W`, so a release check placed first
   * would swallow every wake and run it at 315ms on `outCubic` - the mark would
   * come round gently instead of starting awake, and the asymmetry that makes
   * the state funny would be gone. Ordering is the whole fix; there is no extra
   * condition anywhere else.
   */
  if (to === "w") return "sleepIn";
  if (from === "w") return "sleepOut";
  if (to === "O") return "alertIn";
  if (to === "^") return "happyIn";
  if (to === "scanBig" || to === "scanSmall") return "scan";
  if (to === "W") return "release";
  return "fallback";
};

export const transitionFor = (from: PoseName, to: PoseName): Transition =>
  TRANSITIONS[transitionNameFor(from, to)];

/* ------------------------------------------------------------------------ *
 * The continuous layers: breath and slosh
 * ------------------------------------------------------------------------ */

/** Half the breath's cycle is a rest-to-peak; the full period is both halves. */
export const BREATH_PERIOD_MS = 2 * TIMING.breathHalf;
/** Peak breathing scale is `1 + BREATH_AMPLITUDE`. */
export const BREATH_AMPLITUDE = 0.015;
/** Peak satisfied bounce, added on top of the breath while satisfied holds. */
export const SATISFIED_BUMP_AMPLITUDE = 0.012;
export const SATISFIED_BUMP_DURATION_MS = TIMING.satisfiedHold;

export const breathScale = (elapsedMs: number): number =>
  1 + BREATH_AMPLITUDE * Math.sin((2 * Math.PI * elapsedMs) / BREATH_PERIOD_MS);

export const satisfiedBumpScale = (elapsedSinceStartMs: number): number => {
  const t = Math.min(1, Math.max(0, elapsedSinceStartMs / SATISFIED_BUMP_DURATION_MS));
  return SATISFIED_BUMP_AMPLITUDE * Math.sin(t * Math.PI);
};

/**
 * The idle slosh: the mark failing to be perfectly still, without going
 * anywhere.
 *
 * This replaces the wandering drift the first version had, and it is the same
 * idea rebuilt in the right vocabulary. Rather than nudging the letters around
 * the canvas, it breathes a fraction of a percent of VOLUME through each one
 * independently, and the horizontal term is the negative of the vertical one,
 * so a letter that rises also narrows. The result is a slow settle, like
 * something with weight redistributing itself.
 *
 * TWO sines with INCOMMENSURATE periods, which is the entire trick. 5900ms and
 * 7310ms have no small common multiple, so the pair does not visibly repeat in
 * any session anyone will sit through; a single sine, or two whose periods
 * divide each other, produces a loop the eye learns in about three cycles and
 * then reads as a machine idling.
 *
 * `phase` separates the two letters so they are never at the same point in the
 * cycle, for the same reason `EYE_LAG_MS` exists.
 */
export const SLOSH_AMP_A = 0.009;
export const SLOSH_AMP_B = 0.005;
export const SLOSH_PERIOD_A_MS = 5900;
export const SLOSH_PERIOD_B_MS = 7310;
export const SLOSH_EYE_PHASE = 0.7;
/** How much of the vertical slosh comes back as the opposite horizontal one. */
export const SLOSH_COUPLING = 0.6;

/**
 * How much of the slosh survives in each pose. Full at rest; damped hard
 * whenever the mark is actually doing something, because something that keeps
 * wobbling while it concentrates looks unstable rather than alive.
 */
export const SLOSH_SCALE: Record<PoseName, number> = {
  W: 1,
  /* MORE than at rest, and it is the one entry above 1 in the table. Every
     other damping value here answers "this face is concentrating, stop
     wobbling". A sleeping face is the opposite case: the slosh stops being idle
     life and becomes breathing, which is the thing you most want to see in
     something asleep. */
  w: 1.35,
  u: 1,
  O: 0.45,
  "^": 0.3,
  scanBig: 0.25,
  scanSmall: 0.25,
  /* Kept alive rather than damped. Being petted is not concentration, and a
     mark that went rigid the moment you touched it would read as flinching. */
  pet: 0.8,
  /* Damped hard. A yawn is a big slow shape and the wobble fights it. */
  yawn: 0.2,
};

/** The multiplicative squash and spread of the slosh at a moment, per letter. */
export const sloshAt = (elapsedMs: number, phase: number): { squash: number; spread: number } => {
  const v =
    SLOSH_AMP_A * Math.sin((2 * Math.PI * elapsedMs) / SLOSH_PERIOD_A_MS + phase) +
    SLOSH_AMP_B * Math.sin((2 * Math.PI * elapsedMs) / SLOSH_PERIOD_B_MS + phase * 1.6 + 1.1);
  return { squash: 1 + v, spread: 1 - v * SLOSH_COUPLING };
};

/* ------------------------------------------------------------------------ *
 * The playful state
 * ------------------------------------------------------------------------ */

/* ------------------------------------------------------------------------ *
 * Interpolation and drawing
 * ------------------------------------------------------------------------ */

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/** Blends two poses channel by channel. `t` may overshoot past 1 (see `outBack`). */
export const lerpPose = (a: Pose, b: Pose, t: number): Pose => ({
  squash: lerp(a.squash, b.squash, t),
  spread: lerp(a.spread, b.spread, t),
  weight: lerp(a.weight, b.weight, t),
  round: lerp(a.round, b.round, t),
});

export const lerpMouth = (a: MouthPose, b: MouthPose, t: number): MouthPose => ({
  scale: lerp(a.scale, b.scale, t),
  /* Clamped, unlike every other channel in the mark.
     `outBack` overshoots past 1 on arrival, which is exactly what gives the
     poses their snap, and for a proportion an overshoot is harmless: a letter
     briefly 3% too wide reads as spring. `hollow` is not a proportion, it is a
     ratio driving a RADIUS and an OPACITY. Past 1 the corner radius exceeds
     half the height, which some renderers clamp and others draw as a bowtie,
     and the fill opacity goes negative. Below 0 the mouth grows a stroke it
     should not have. So this one is held to its ends. */
  hollow: Math.min(1, Math.max(0, lerp(a.hollow, b.hollow, t))),
});

/* ------------------------------------------------------------------------ *
 * The mouth's geometry, derived from `hollow`
 * ------------------------------------------------------------------------ */

/**
 * What the mouth's rect looks like at a given `hollow`, as plain numbers.
 *
 * Pulled out of the renderer and made pure so the shape can be tested at both
 * ends without a DOM, and so the standalone preview can draw the identical
 * mouth from the identical arithmetic. Returns everything the `<rect>` needs.
 *
 * The width is the only dimension that moves. Height is constant, because the
 * owner's spec sizes the o to the dot rather than to a letter, and the dot's
 * height is what makes it read as a full stop at a glance. Once width has come
 * down to height the shape is a square, and a square at half-height corner
 * radius is a circle. So "the dot becomes a hollow o" is one interpolation with
 * no special cases in it.
 */
export interface MouthGeometry {
  x: number;
  y: number;
  width: number;
  height: number;
  rx: number;
  /**
   * The vertical corner radius, which is only ever different from `rx` while a
   * yawn is running. A `<rect>` with `rx` alone infers `ry` from it, so an
   * elongated box would keep circular corners and read as a stadium; naming
   * both makes the shape a true ellipse at every point of the yawn.
   */
  ry: number;
  /** Opacity of the solid fill. Runs 1 to 0. */
  fillOpacity: number;
  /** Opacity of the outline. Runs 0 to 1. */
  strokeOpacity: number;
  /** Stroke width for the outline. Sized so the ring reads at the dot's weight. */
  strokeWidth: number;
}

/** The outline's weight, as a fraction of the mouth's height. */
export const MOUTH_RING_STROKE_RATIO = 0.3;

/* ------------------------------------------------------------------------ *
 * The yawn's motion
 * ------------------------------------------------------------------------ */

/**
 * How tall the yawning mouth gets, at its widest, as a multiple of the dot.
 *
 * A yawn is not a bigger mouth, it is a DIFFERENT SHAPE of mouth: the jaw drops
 * and the opening goes oval. That is why the yawn's pose scale went back to 1
 * on the owner's instruction and the movement lives here instead. A uniformly
 * scaled dot reads as the logo being zoomed; an opening that elongates and
 * comes back reads as a mouth.
 *
 * 1.26 is restrained on purpose. The mouth is drawn taller than it is wide
 * while this is above 1, and a tall ring is exactly what read as a ZERO when it
 * was a resting state. The difference is that this one is never still: it
 * passes through the tall shape rather than sitting in it, which is what makes
 * it a yawn instead of a typo.
 */
/* Big enough to be an event. 1.26 read as the mouth clearing its throat; a
   yawn is a commitment, and at 1.55 the ring visibly reaches up between the
   eyes before falling back. The width coupling below keeps it a deformation
   rather than a scale, whatever the peak. */
export const YAWN_STRETCH_PEAK = 1.55;

/**
 * How far the peak sags back during the hold, as a fraction of the peak.
 *
 * Real yawns do not hold their widest point; they reach it, ease off slightly,
 * and then close. This is that ease-off, and it is the whole of the "moving
 * around a little" the owner asked for. It is ONE slow sag, not an oscillation:
 * anything that went back up would be a wobble, and a wobbling mouth is the
 * "just shaking" he explicitly ruled out.
 */
export const YAWN_STRETCH_SAG = 0.955;

/*
 * The exhale. On the way down the mouth does not stop at rest: it passes
 * through it, sinks a few percent, and recovers. That undershoot is what
 * makes the close read as breath leaving rather than as an animation
 * reversing. It is small on purpose; the slump is felt, not watched.
 */
export const YAWN_SLUMP = 0.965;
/** Where in the close the slump bottoms out: the last stretch is recovery. */
const YAWN_CLOSE_SPLIT = 0.62;

/** Where the three beats meet, as fractions of the whole yawn. */
const YAWN_T_OPEN = YAWN_OPEN_MS / (YAWN_OPEN_MS + YAWN_HOLD_MS + YAWN_CLOSE_MS);
const YAWN_T_HOLD = (YAWN_OPEN_MS + YAWN_HOLD_MS) / (YAWN_OPEN_MS + YAWN_HOLD_MS + YAWN_CLOSE_MS);

/** Smooth on both ends. No overshoot anywhere in a yawn; it is involuntary. */
const smooth = (t: number): number => {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
};

/**
 * The mouth's vertical stretch at a point in the yawn. `t` runs 0 to 1.
 *
 * Three beats, and each one is a smoothstep so there is no corner anywhere in
 * the curve:
 *
 *   open   1 grows to the peak. The slowest-starting of the three, because a
 *          yawn creeps up on you.
 *   hold   the peak eases back slightly. One direction only.
 *   close  back to 1, over the longest beat, because a mouth closes more
 *          slowly than it opens.
 *
 * Returns exactly 1 outside the yawn so the caller can hand it any `t` without
 * guarding, and so the resting mouth is provably a circle.
 */
export const yawnStretch = (t: number): number => {
  if (!(t > 0) || t >= 1) return 1;
  const peak = YAWN_STRETCH_PEAK;
  const sag = peak * YAWN_STRETCH_SAG;
  if (t < YAWN_T_OPEN) return 1 + (peak - 1) * smooth(t / YAWN_T_OPEN);
  if (t < YAWN_T_HOLD) return peak + (sag - peak) * smooth((t - YAWN_T_OPEN) / (YAWN_T_HOLD - YAWN_T_OPEN));
  /* The close carries the exhale: down past rest into the slump, then a
     shorter recovery back up to exactly 1. Every segment is a smoothstep, so
     the slope is zero at each seam and the whole curve stays cornerless -
     the same property the jerk test enforces. */
  const closeT = (t - YAWN_T_HOLD) / (1 - YAWN_T_HOLD);
  if (closeT < YAWN_CLOSE_SPLIT) return sag + (YAWN_SLUMP - sag) * smooth(closeT / YAWN_CLOSE_SPLIT);
  return YAWN_SLUMP + (1 - YAWN_SLUMP) * smooth((closeT - YAWN_CLOSE_SPLIT) / (1 - YAWN_CLOSE_SPLIT));
};

/**
 * How much the opening narrows as it lengthens.
 *
 * The same conserved-mass idea the letters use: something that stretches on one
 * axis pulls in on the other. Without it the yawn reads as the mouth being
 * scaled up vertically, which is a stretch rather than a deformation. 0.38 is
 * a partial coupling rather than a full one, because a real mouth opening does
 * narrow, but nothing like as much as an incompressible volume would.
 */
export const YAWN_WIDTH_COUPLING = 0.38;

export const mouthGeometry = (hollow: number, stretch = 1): MouthGeometry => {
  const h = Math.min(1, Math.max(0, hollow));
  const strokeWidth = MOUTH_H * MOUTH_RING_STROKE_RATIO;

  /*
   * THE RING IS INSET BY HALF ITS OWN STROKE, and that is the whole reason this
   * is not simply "swap fill for stroke".
   *
   * An SVG stroke straddles the path it is drawn on, half inside and half out.
   * So a ring drawn on the dot's own circle would have an OUTER diameter of the
   * dot plus one stroke width - 2.795 against 2.15, thirty percent larger - and
   * the mouth would visibly inflate the moment it opened. The spec is "an o
   * sized down to a dot", not "a dot that grows into an o".
   *
   * Shrinking the path by one stroke width puts the ring's outer edge exactly
   * on the dot's silhouette, so the two shapes occupy the identical footprint
   * and the only thing that changes is that the middle is now empty.
   *
   * The base is a CIRCLE at both ends of the morph, because the dot is a circle
   * now. Only the yawn ever makes it anything else.
   */
  const base = lerp(MOUTH_W, MOUTH_H - strokeWidth, h);

  /*
   * THE YAWN'S SHAPE. `stretch` is 1 in every state but one, so this is an
   * identity for the whole mark except while a yawn is running.
   *
   * It lengthens the opening and narrows it in the same breath, which is what a
   * mouth opening actually does and is the same conserved-mass idea the letters
   * use. The narrowing is partial rather than full: a real opening does pull in
   * as it lengthens, but nowhere near as much as an incompressible volume.
   */
  const height = base * stretch;
  const width = base * (1 - YAWN_WIDTH_COUPLING * (stretch - 1));

  /*
   * THE FOOT STAYS ON THE BASELINE, at every stretch.
   *
   * This is the mark's oldest rule and the yawn does not get to break it: a
   * period sits ON the line, so a mouth that opened downward would drop through
   * it. The opening therefore grows UPWARD, which is also what the `scale`
   * channel has always done.
   *
   * The stroke offset fades in with `hollow` so the OUTER edge of the ring is
   * what lands on the baseline, not the path it is drawn on. At `hollow` 0 the
   * stroke is invisible and contributes nothing, which keeps the solid dot
   * exactly where it has always been.
   */
  const foot = BASELINE - (strokeWidth / 2) * h;

  return {
    x: MOUTH_CX - width / 2,
    y: foot - height,
    width,
    height,
    /* Half of each axis, so the shape is a circle at rest and a true ellipse
       mid-yawn rather than a rounded rectangle. */
    rx: width / 2,
    ry: height / 2,
    fillOpacity: 1 - h,
    strokeOpacity: h,
    strokeWidth,
  };
};

/**
 * The five control points of a pose, in canvas coordinates.
 *
 * `squash` pivots on `FOOT`, so the valleys map to `EYE_BOT` for every pose
 * that exists and the letter's feet stay welded to the baseline. `spread`
 * pivots on the letter's own horizontal centre, so it widens symmetrically
 * inside its own slot rather than sliding within it. There is no third step,
 * because there is nothing else a pose can do.
 */
export const spinePoints = (pose: Pose, eyeCx: number): [number, number][] =>
  SPINE.map(([sx, sy]) => {
    const x = 0.5 + (sx - 0.5) * pose.spread;
    const y = FOOT + (sy - FOOT) * pose.squash;
    return [eyeCx + (x - 0.5) * EYE_W, EYE_TOP + y * EYE_H];
  });

/** A number trimmed for an SVG attribute: three decimals is well past visible. */
const trim = (n: number): string => {
  const r = Math.round(n * 1000) / 1000;
  return Object.is(r, -0) ? "0" : String(r);
};

/** The `d` of a spine. Straight segments, because a W is a zigzag; the softness
 * comes from the round joins the renderer sets, not from curving the letter. */
export const spinePath = (points: [number, number][]): string =>
  points.map(([x, y], i) => `${i === 0 ? "M" : "L"}${trim(x)} ${trim(y)}`).join("");

export const pathFor = (pose: Pose, eyeCx: number): string => spinePath(spinePoints(pose, eyeCx));

/* ------------------------------------------------------------------------ *
 * The blink: morphing the W into the O
 * ------------------------------------------------------------------------ */

/**
 * A point along the W's spine, at `t` from 0 (top left corner) to 1 (top
 * right corner), parameterised one quarter per segment.
 */
export const spineAt = (pts: [number, number][], t: number): [number, number] => {
  const clamped = t <= 0 ? 0 : t >= 1 ? 1 : t;
  const scaled = clamped * 4;
  const seg = Math.min(3, Math.floor(scaled));
  const u = scaled - seg;
  const a = pts[seg];
  const b = pts[seg + 1];
  return [lerp(a[0], b[0], u), lerp(a[1], b[1], u)];
};

/**
 * The point on the closed eye's circle that the spine's `t` maps to.
 *
 * The mapping is `90deg + 360deg * t`, counter clockwise from the top, and it
 * is the one choice in this file that took working out rather than measuring.
 *
 * The W is an open path and the O is a closed one, so the morph has to send
 * the letter's two free ends to the same place and wrap everything between
 * them once around. Which point they meet at decides whether the morph reads
 * as a shape closing or as a shape SPINNING, and most mappings spin: send the
 * spine clockwise from the top and the left valley has to travel across to
 * three o'clock, dragging the whole letter round with it.
 *
 * This one does not, because it is the mapping that preserves the letter's own
 * mirror symmetry. The W is symmetric about its vertical axis, meaning `t` and
 * `1 - t` are mirror points, and a circle is symmetric about the same axis, so
 * the morph looks right exactly when `angle(1 - t)` is the mirror of
 * `angle(t)`. Going counter clockwise from the top satisfies that identity,
 * and the result is that the pieces travel in mirrored pairs:
 *
 *   both top corners  ->  the top of the circle   (they meet and close it)
 *   left valley       ->  the left of the circle
 *   right valley      ->  the right of the circle
 *   the middle peak   ->  the bottom of the circle
 *
 * Nothing crosses anything else, nothing rotates, and the two halves of the
 * letter fold inward together.
 */
export const circleAt = (t: number, eyeCx: number): [number, number] => {
  const theta = Math.PI / 2 + 2 * Math.PI * t;
  return [eyeCx + CIRCLE_R * Math.cos(theta), CIRCLE_CY - CIRCLE_R * Math.sin(theta)];
};

/**
 * The drawn points of an eye: the letterform, the circle, or anywhere between.
 *
 * At `round` 0 this is the plain five point spine, so the resting mark is
 * drawn from exactly the same four line segments it always was and nothing
 * about the approved states changes. Only once a blink is actually running
 * does the path become a sampled blend.
 */
export const eyePoints = (pose: Pose, eyeCx: number): [number, number][] => {
  if (Math.abs(pose.round) < 1e-6) return spinePoints(pose, eyeCx);
  const pts = spinePoints(pose, eyeCx);
  const out: [number, number][] = [];
  for (let i = 0; i <= MORPH_SAMPLES; i++) {
    const t = i / MORPH_SAMPLES;
    const w = spineAt(pts, t);
    const c = circleAt(t, eyeCx);
    out.push([lerp(w[0], c[0], pose.round), lerp(w[1], c[1], pose.round)]);
  }
  return out;
};

export const eyePath = (pose: Pose, eyeCx: number): string => spinePath(eyePoints(pose, eyeCx));

/** How much of the accent the closed eye is wearing, from its morph amount. */
export const accentMix = (round: number): number => (round <= 0 ? 0 : round >= 1 ? 1 : round);

/**
 * The bounding box of a pose's INK, stroke included.
 *
 * Exists so a test can assert that no expression sends the mark off the canvas
 * by more than the small, deliberate overhang a growing letter uses. This is
 * the check the pixel grid used to give for free by clipping.
 */
export const inkBounds = (
  pose: Pose,
  eyeCx: number
): { minX: number; maxX: number; minY: number; maxY: number } => {
  const pts = eyePoints(pose, eyeCx);
  const half = (STROKE * pose.weight) / 2;
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  return {
    minX: Math.min(...xs) - half,
    maxX: Math.max(...xs) + half,
    minY: Math.min(...ys) - half,
    maxY: Math.max(...ys) + half,
  };
};

/* ------------------------------------------------------------------------ *
 * The serialisable spec
 * ------------------------------------------------------------------------ */

/**
 * Everything above that is DATA rather than behaviour, in one object.
 *
 * `bench/ww-frames-preview.html` is a standalone page with no build step, so
 * it carries its own small copy of the loop. It does NOT carry its own copy of
 * these numbers by design: it embeds this object verbatim as JSON and reads
 * from it, which is what keeps the page the animation is judged on from
 * quietly becoming a different animation from the one the site ships. The
 * embed is a hand copy and no test compares them, so re-paste it after editing
 * this object.
 */
export const MARK_SPEC = {
  canvas: { w: CANVAS_W, h: CANVAS_H },
  colour: { white: MARK_WHITE, accent: MARK_ACCENT },
  layout: {
    mouthCx: MOUTH_CX,
    mouthCy: MOUTH_CY,
    baseline: BASELINE,
    eyeCxL: EYE_CX_L,
    eyeCxR: EYE_CX_R,
    eyeW: EYE_W,
    eyeTop: EYE_TOP,
    eyeH: EYE_H,
    stroke: STROKE,
    mouthW: MOUTH_W,
    mouthH: MOUTH_H,
    mouthR: MOUTH_R,
    spine: SPINE.map(([x, y]) => [x, y]),
    foot: FOOT,
  },
  circle: {
    r: CIRCLE_R,
    cy: CIRCLE_CY,
    counterRatio: ADLAM_O_COUNTER_RATIO,
    samples: MORPH_SAMPLES,
  },
  poses: POSES,
  mouthPoses: MOUTH_POSES,
  transitions: TRANSITIONS,
  sloshScale: SLOSH_SCALE,
  slosh: {
    ampA: SLOSH_AMP_A,
    ampB: SLOSH_AMP_B,
    periodA: SLOSH_PERIOD_A_MS,
    periodB: SLOSH_PERIOD_B_MS,
    eyePhase: SLOSH_EYE_PHASE,
    coupling: SLOSH_COUPLING,
  },
  breath: {
    period: BREATH_PERIOD_MS,
    amplitude: BREATH_AMPLITUDE,
    bumpAmplitude: SATISFIED_BUMP_AMPLITUDE,
    bumpDuration: SATISFIED_BUMP_DURATION_MS,
  },
  blink: {
    close: BLINK_CLOSE_MS,
    shut: BLINK_SHUT_MS,
    open: BLINK_OPEN_MS,
    gapMin: TIMING.blinkGapMin,
    gapMax: TIMING.blinkGapMax,
  },
  eyeLag: EYE_LAG_MS,
  scanFlip: TIMING.scanFlip,
  scanMoveFraction: SCAN_MOVE_FRACTION,
  satisfiedHold: TIMING.satisfiedHold,
} as const;
