import React from "react";
import { SITE_NAME } from "./brand";

/**
 * SKYDEX - the diagonal wordmark, ported from the design bench.
 *
 * The split is DIAGONAL, corner to corner across the cap box, one hard cut,
 * no blend. The cut rises LEFT-TO-RIGHT: from the bottom-left corner to the
 * top-right corner, white above it and blue below - the original drawing,
 * and the reasoning: the accent belongs on DEX rather than on SKY. On
 * the middle letters that puts the blue on the BOTTOM. Getting this mirrored
 * was a bug that survived several passes because at 30px the two are
 * nearly identical; the bench's `?compare=wordmark` page at 110px is how to
 * check it.
 *
 * Implementation is an explicit angle, NOT `to bottom right`: the corner
 * keyword anchors the seam to the ELEMENT box, which is taller than the caps
 * (line-height 1 gives a 1em box, the caps occupy the middle ~0.70em), so the
 * seam met the box corner in empty space below the S and entered the visible
 * letters a third of the way along the word. A fixed angle anchors to the cap
 * box instead, and is correct at every size because the wordmark's
 * proportions do not change with font-size. Measured off a 110px render:
 * caps 502 x 77 px, seam rises atan(77/502) = 8.72deg, gradient axis
 * perpendicular at 171.3deg. Measured for the six caps of SKYDEX at this
 * tracking; a future rename re-measures it.
 *
 * The stop sits at 47.4%, not 50%: at a clean 50% the seam terminates exactly
 * on the X's top-right corner and clips a white speck onto the end of the
 * word. The nudge lifts it clear.
 *
 * Both colours are the palette's own: BLUE reads the emerald-400 token so a
 * retint of the accent reaches it; #E8EDF3 is slate-100.
 */

const BLUE = "var(--color-emerald-400)";
const WHITE = "#e8edf3";
const SEAM_DEG = 171.3;
const SEAM_STOP = 47.4;

interface Props {
  /** px. Cap height is roughly 0.72 of this. The masthead uses 30. */
  size?: number;
  className?: string;
}

export const Wordmark: React.FC<Props> = ({ size = 30, className = "" }) => (
  <span
    className={className}
    style={{
      fontFamily: "var(--font-chrome)",
      fontWeight: 800,
      fontSize: `${size}px`,
      lineHeight: 1,
      letterSpacing: "0.055em",
      /* The tracking adds air after the final X, which shifts the word left
         of where it is boxed. Pulling the box in by the same amount makes the
         optical left edge and the layout left edge agree. */
      marginRight: "-0.055em",
      backgroundImage: `linear-gradient(${SEAM_DEG}deg, ${WHITE} 0 ${SEAM_STOP}%, ${BLUE} ${SEAM_STOP}% 100%)`,
      WebkitBackgroundClip: "text",
      backgroundClip: "text",
      color: "transparent",
      /* The clip is to the text box, so the gradient must not bleed past it
         and the box must not collapse on a display:inline span. */
      display: "inline-block",
    }}
  >
    {SITE_NAME.toUpperCase()}
  </span>
);
