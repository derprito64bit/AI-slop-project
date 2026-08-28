import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import type { CarouselItem } from '../data/universities'

// ============================================================
// Carousel — an infinite, auto-scrolling image marquee.
// Built to be highly customizable so it's easy to tweak later:
//   - items:        the tiles to show (image or labeled placeholder)
//   - speed:        seconds for one full loop (lower = faster)
//   - direction:    'left' | 'right'
//   - tileWidth:    px width of each tile
//   - aspect:       CSS aspect-ratio for tiles, e.g. '4 / 3', '1 / 1', '16 / 9'
//   - gap:          px gap between tiles
//   - rounded:      Tailwind radius class
//   - pauseOnHover: stop scrolling on hover
//   - fade:         soft fade-out mask on the left/right edges
// Swap placeholders for real photos by setting `img` on each item — no other
// change needed.
// ============================================================
type CarouselProps = {
  items: CarouselItem[]
  speed?: number
  direction?: 'left' | 'right'
  tileWidth?: number
  aspect?: string
  gap?: number
  rounded?: string
  pauseOnHover?: boolean
  fade?: boolean
  showCaptions?: boolean
  /** where in the loop to begin, 0–1 (0.5 = start halfway through, already flowing) */
  startOffset?: number
  /**
   * 'photo' = boxed image tiles with captions (campus shots, program art).
   * 'logo'  = bare wordmarks on the page background, no box or caption.
   *           Sized by height so each logo keeps its natural proportions.
   */
  variant?: 'photo' | 'logo'
  /** logo variant only: rendered height in px */
  logoHeight?: number
  /**
   * photo variant only. 'cover' fills the tile and crops (right for photos);
   * 'contain' fits the whole image on a white tile (right for logos, where
   * cropping would cut letters off a wordmark).
   */
  imgFit?: 'cover' | 'contain'
  className?: string
}

/**
 * How many copies of the item list the track needs to loop without a gap.
 *
 * The track slides by exactly one copy and then snaps back, so the copies
 * BEHIND the one that just left have to cover the whole container on their
 * own — hence `+ 1`. Two copies is the floor: one copy sliding away with
 * nothing following it is the original bug.
 *
 * Measured example: one copy of the logo band is 1,357px. At 1280px wide that
 * gives 2 copies (the old hard-coded number, which is why it looked fine on a
 * laptop); at 1920px it needs 3, and at 2560px, 3 — and with only 2 a gap
 * trailed the last logo on every loop.
 *
 * Exported for the unit test; `copyWidth` includes the trailing gap, because
 * each copy is padded so the whole track divides evenly.
 */
export function copiesNeeded(containerWidth: number, copyWidth: number): number {
  if (!Number.isFinite(containerWidth) || !Number.isFinite(copyWidth) || copyWidth <= 0) return 2
  return Math.max(2, Math.ceil(containerWidth / copyWidth) + 1)
}

export default function Carousel({
  items,
  speed = 40,
  direction = 'left',
  tileWidth = 300,
  aspect = '4 / 3',
  gap = 20,
  rounded = 'rounded-2xl',
  pauseOnHover = true,
  fade = true,
  showCaptions = true,
  startOffset = 0,
  variant = 'photo',
  logoHeight = 44,
  imgFit = 'cover',
  className = '',
}: CarouselProps) {
  // How many copies of the list are on the track. Starts at 2 — the old
  // hard-coded number — and is corrected as soon as the first copy has been
  // measured, so the band is never empty on the first frame.
  const [copies, setCopies] = useState(2)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const copyRef = useRef<HTMLUListElement | null>(null)

  // Re-measure whenever the container OR a copy changes size. The copy is the
  // one that actually moves: logo tiles resize themselves once their image
  // loads (see fitLogo below), so measuring only on mount would size the track
  // against placeholder text and come up short.
  useEffect(() => {
    const container = containerRef.current
    const copy = copyRef.current
    if (!container || !copy) return

    const measure = () => {
      const copyWidth = copy.offsetWidth
      if (!copyWidth) return
      setCopies(copiesNeeded(container.offsetWidth, copyWidth))
    }

    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(container)
    observer.observe(copy)
    return () => observer.disconnect()
  }, [items])

  if (!items.length) return null

  // A negative animation-delay begins the loop partway through, so tiles are
  // already spread across the band at load instead of entering from an edge.
  const delay = -(((startOffset % 1) + 1) % 1) * speed

  return (
    <div
      ref={containerRef}
      className={`relative w-full overflow-hidden ${pauseOnHover ? 'marquee-paused' : ''} ${className}`}
      style={
        fade
          ? {
              maskImage:
                'linear-gradient(to right, transparent, black 6%, black 94%, transparent)',
              WebkitMaskImage:
                'linear-gradient(to right, transparent, black 6%, black 94%, transparent)',
            }
          : undefined
      }
    >
      {/* The track holds `copies` identical blocks and slides by exactly one of
          them. Each block carries the gap as its own right padding rather than
          the track using `gap`, so every block is the same width and the shift
          is a clean -100/copies% — with a flex gap the last block would be
          narrower and the loop would drift by one gap per cycle. */}
      <div
        className="marquee-track flex w-max"
        data-direction={direction}
        style={{
          ['--marquee-duration' as string]: `${speed}s`,
          ['--marquee-shift' as string]: `-${100 / copies}%`,
          animationDelay: `${delay}s`,
        }}
      >
        {Array.from({ length: copies }, (_, copy) => (
          <ul
            key={copy}
            // Only the first copy is real content; the rest are visual filler
            // and must not be read out or tabbed into.
            ref={copy === 0 ? copyRef : undefined}
            aria-hidden={copy > 0}
            className="flex list-none"
            style={{ gap: `${gap}px`, paddingRight: `${gap}px` }}
          >
            {items.map((item, i) => (
              <Tile
                key={`${item.id}-${i}`}
                item={item}
                width={tileWidth}
                aspect={aspect}
                rounded={rounded}
                showCaption={showCaptions}
                ariaHidden={copy > 0}
                variant={variant}
                logoHeight={logoHeight}
                imgFit={imgFit}
              />
            ))}
          </ul>
        ))}
      </div>
    </div>
  )
}

function Tile({
  item,
  width,
  aspect,
  rounded,
  showCaption,
  ariaHidden,
  variant,
  logoHeight,
  imgFit,
}: {
  item: CarouselItem
  width: number
  aspect: string
  rounded: string
  showCaption: boolean
  ariaHidden: boolean
  variant: 'photo' | 'logo'
  logoHeight: number
  imgFit: 'cover' | 'contain'
}) {
  // If an image 404s (e.g. the file hasn't been added yet), fall back to the
  // placeholder instead of showing a broken-image icon.
  const [failed, setFailed] = useState(false)
  const hasImg = !!item.img && !failed

  // Logo variant: wordmarks vary from near-square (crest + stacked text) to
  // very wide. Sizing them all to one height makes the square ones look tiny,
  // so equalise optical AREA instead — wide marks get shorter, square marks
  // taller — clamped so the row still reads as a line.
  const [fittedHeight, setFittedHeight] = useState(logoHeight)
  const fitLogo = (img: HTMLImageElement) => {
    if (!img.naturalWidth || !img.naturalHeight) return
    const ratio = img.naturalWidth / img.naturalHeight
    const ideal = Math.sqrt((logoHeight * logoHeight * 3) / ratio)
    setFittedHeight(
      Math.round(Math.min(logoHeight * 1.35, Math.max(logoHeight * 0.85, ideal))),
    )
  }

  const inner =
    variant === 'logo' ? (
      // Bare wordmark — no box, no caption. object-contain keeps each logo's
      // own proportions; height is fixed so the row reads evenly.
      <div className="flex shrink-0 items-center px-7" style={{ height: logoHeight * 1.9 }}>
        {hasImg ? (
          <img
            src={item.img}
            alt={item.name}
            loading="lazy"
            onError={() => setFailed(true)}
            onLoad={(e) => fitLogo(e.currentTarget)}
            className="logo-mark w-auto max-w-[180px] object-contain opacity-80 transition-opacity duration-700 hover:opacity-100"
            style={{ height: fittedHeight }}
          />
        ) : (
          // Readable text stand-in until the logo file is added.
          <span className="whitespace-nowrap text-sm font-600 text-slate">{item.name}</span>
        )}
      </div>
    ) : (
      <div
        className={`group relative shrink-0 overflow-hidden border border-line ${rounded} ${imgFit === 'contain' ? 'bg-white' : 'bg-cloud'} card-lift`}
        style={{ width, aspectRatio: aspect }}
      >
        {hasImg ? (
          <img
            src={item.img}
            alt={item.name}
            loading="lazy"
            onError={() => setFailed(true)}
            // Contain tiles reserve room at the bottom so the caption bar sits
            // beside the logo rather than clipping it.
            className={`h-full w-full transition-transform duration-1000 group-hover:scale-105 ${
              imgFit === 'contain'
                ? `object-contain px-4 pt-4 ${showCaption ? 'pb-16' : 'pb-4'}`
                : 'object-cover'
            }`}
          />
        ) : (
          // Placeholder tile. The "image" chip is a build-time hint for photo
          // tiles; on a logo tile it just reads as a broken asset, and the
          // caption below already names the school, so leave it clean.
          <div className={`flex h-full w-full items-center justify-center bg-gradient-to-br ${item.gradient ?? 'from-brand-100 to-brand-50'}`}>
            {imgFit !== 'contain' && (
              <span className="rounded-md bg-white/70 px-2 py-1 text-[10px] font-600 uppercase tracking-wider text-slate">
                image
              </span>
            )}
          </div>
        )}

        {/* The dark scrim is for photos. Over a contain-fitted logo the tile is
            white, so white-on-scrim turns into white-on-light-grey — unreadable.
            Those tiles get a solid bar in theme ink instead. */}
        {showCaption &&
          (imgFit === 'contain' ? (
            <div className="absolute inset-x-0 bottom-0 border-t border-line bg-paper p-3">
              <p className="text-sm font-600 leading-tight text-ink">{item.name}</p>
              {item.caption && <p className="text-xs text-slate">{item.caption}</p>}
            </div>
          ) : (
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-3 pt-8">
              <p className="text-sm font-600 leading-tight text-white">{item.name}</p>
              {item.caption && <p className="text-xs text-white/80">{item.caption}</p>}
            </div>
          ))}
      </div>
    )

  return (
    <li aria-hidden={ariaHidden}>
      {item.href ? (
        <Link to={item.href} tabIndex={ariaHidden ? -1 : 0}>
          {inner}
        </Link>
      ) : (
        inner
      )}
    </li>
  )
}
