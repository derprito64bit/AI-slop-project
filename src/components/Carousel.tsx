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
  className?: string
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
  className = '',
}: CarouselProps) {
  if (!items.length) return null

  // Duplicate the list so the -50% slide loops seamlessly.
  const loop = [...items, ...items]

  // A negative animation-delay begins the loop partway through, so tiles are
  // already spread across the band at load instead of entering from an edge.
  const delay = -(((startOffset % 1) + 1) % 1) * speed

  return (
    <div
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
      <ul
        className="marquee-track flex w-max list-none"
        data-direction={direction}
        style={{
          gap: `${gap}px`,
          ['--marquee-duration' as string]: `${speed}s`,
          animationDelay: `${delay}s`,
        }}
      >
        {loop.map((item, i) => (
          <Tile
            key={`${item.id}-${i}`}
            item={item}
            width={tileWidth}
            aspect={aspect}
            rounded={rounded}
            showCaption={showCaptions}
            ariaHidden={i >= items.length}
          />
        ))}
      </ul>
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
}: {
  item: CarouselItem
  width: number
  aspect: string
  rounded: string
  showCaption: boolean
  ariaHidden: boolean
}) {
  const inner = (
    <div
      className={`group relative shrink-0 overflow-hidden border border-line ${rounded} bg-cloud transition-transform duration-300 hover:-translate-y-1`}
      style={{ width, aspectRatio: aspect }}
    >
      {item.img ? (
        <img
          src={item.img}
          alt={item.name}
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
      ) : (
        // Labeled placeholder tile (until real images are added).
        <div className={`flex h-full w-full items-center justify-center bg-gradient-to-br ${item.gradient ?? 'from-brand-100 to-brand-50'}`}>
          <span className="rounded-md bg-white/70 px-2 py-1 text-[10px] font-600 uppercase tracking-wider text-slate">
            image
          </span>
        </div>
      )}

      {showCaption && (
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink/70 to-transparent p-3 pt-8">
          <p className="text-sm font-600 leading-tight text-white">{item.name}</p>
          {item.caption && <p className="text-xs text-white/80">{item.caption}</p>}
        </div>
      )}
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
