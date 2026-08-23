import {
  axisPoint,
  labelAnchor,
  polygonPoints,
  ringPoints,
} from "@/lib/report/radar";
import { PILLARS } from "@/lib/report/rubric";
import type { Band, PillarScores } from "@/lib/report/score";
import { BAND_TEXT, formatScore } from "./score-tokens";

const CX = 120;
const CY = 100;
const RADIUS = 70;
const LABEL_GAP = 18;
const RINGS = [1, 2, 3, 4];

interface PillarRadarProps {
  readonly averages: PillarScores;
  readonly verdict: Band;
}

/**
 * The five pillars as one shape. Hand-rolled SVG rather than a charting
 * dependency: it is five points on a pentagon, and the geometry lives in
 * `lib/report/radar.ts` where it can be unit tested.
 */
export function PillarRadar({ averages, verdict }: PillarRadarProps) {
  const values = PILLARS.map((pillar) => averages[pillar.id]);
  const count = PILLARS.length;

  return (
    <div>
      {/*
        The viewBox is wider than the chart on both sides: the Situation and
        Learning labels hang outward from the left and right vertices and would
        otherwise be clipped at the edge.
      */}
      <svg
        viewBox="-24 -6 288 216"
        className="h-auto w-full max-w-[260px]"
        role="img"
        aria-labelledby="radar-title"
      >
        <title id="radar-title">
          STAR-L scores across the five pillars, each out of 4
        </title>

        {RINGS.map((level) => (
          <polygon
            key={level}
            points={ringPoints(level, RADIUS, CX, CY, count)}
            className="fill-none stroke-rule"
            strokeWidth={1}
          />
        ))}

        {PILLARS.map((pillar, index) => {
          const outer = axisPoint(index, count, RADIUS, CX, CY);
          return (
            <line
              key={pillar.id}
              x1={CX}
              y1={CY}
              x2={outer.x}
              y2={outer.y}
              className="stroke-rule"
              strokeWidth={1}
            />
          );
        })}

        {/*
          One colour class on the group drives both fill and stroke through
          currentColor, so no dynamic `fill-*` class name is ever constructed —
          Tailwind would not generate it.
        */}
        <g className={BAND_TEXT[verdict]}>
          <polygon
            points={polygonPoints(values, RADIUS, CX, CY)}
            fill="currentColor"
            fillOpacity={0.16}
            stroke="currentColor"
            strokeWidth={2}
            strokeLinejoin="round"
          />
          {values.map((value, index) => {
            const point = axisPoint(index, count, (value / 4) * RADIUS, CX, CY);
            return (
              <circle
                key={PILLARS[index]?.id}
                cx={point.x}
                cy={point.y}
                r={3}
                fill="currentColor"
              />
            );
          })}
        </g>

        {PILLARS.map((pillar, index) => {
          const point = axisPoint(index, count, RADIUS + LABEL_GAP, CX, CY);
          return (
            <text
              key={pillar.id}
              x={point.x}
              y={point.y}
              textAnchor={labelAnchor(point, CX)}
              dominantBaseline="middle"
              className="fill-ink-faint font-mono text-[9px] uppercase tracking-wide"
            >
              {pillar.label}
            </text>
          );
        })}
      </svg>

      {/*
        The shape carries no numbers. This repeats them as text so a screen
        reader gets the actual scores rather than a described polygon.
      */}
      <ul className="sr-only">
        {PILLARS.map((pillar) => (
          <li key={pillar.id}>
            {pillar.label} {formatScore(averages[pillar.id])} out of 4
          </li>
        ))}
      </ul>
    </div>
  );
}
