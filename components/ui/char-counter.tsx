import { cn } from '@/lib/utils';
import { charCountText } from '@/lib/content-limits';

/**
 * "12,345 / 30,000" under a long form field (D9). Turns orange at the cap, and
 * stays orange above it (a legacy entry longer than a cap added later), where
 * the route will refuse the save with the field's sentence.
 */
export function CharCounter({
  length,
  max,
  className,
}: {
  length: number;
  max: number;
  className?: string;
}) {
  return (
    <p
      className={cn(
        'mt-1 text-right font-mono text-[10px] tabular-nums',
        length >= max ? 'text-orange-400' : 'text-white/30',
        className
      )}
    >
      {charCountText(length, max)}
    </p>
  );
}
