import SUMMARY from './generated/summary.json'

// University/program data for the carousels.
// Swap `img` in later (drop files in /public/universities or use a URL) and
// the carousels pick them up automatically — no layout changes needed.
export type CarouselItem = {
  id: string
  name: string
  /** short subtitle, e.g. city or program */
  caption?: string
  /** image URL or /public path. When absent, a labeled gradient tile shows. */
  img?: string
  /** optional accent gradient for the placeholder tile (from/to Tailwind classes) */
  gradient?: string
  /** where the tile links to */
  href?: string
}

// Resolve a file in /public. BASE_URL is '/' locally and '/AI-slop-project/'
// on GitHub Pages, so paths stay correct in both.
const asset = (path: string) => `${import.meta.env.BASE_URL}${path}`

// University wordmarks — rendered as a bare logo band (Carousel variant="logo").
// Drop the files in public/images/universities/ using these exact names; until
// then each tile degrades to the university's name as text.
export const CAMPUS_ITEMS: CarouselItem[] = [
  { id: 'waterloo', name: 'University of Waterloo', caption: 'Waterloo, ON', img: asset('images/universities/waterloo.png'), gradient: 'from-brand-100 to-brand-50' },
  { id: 'toronto', name: 'University of Toronto', caption: 'Toronto, ON', img: asset('images/universities/toronto.png'), gradient: 'from-brand-100 to-cloud' },
  { id: 'mcmaster', name: 'McMaster University', caption: 'Hamilton, ON', img: asset('images/universities/mcmaster.svg'), gradient: 'from-brand-50 to-brand-100' },
  { id: 'queens', name: "Queen's University", caption: 'Kingston, ON', img: asset('images/universities/queens.svg'), gradient: 'from-cloud to-brand-100' },
  { id: 'western', name: 'Western University', caption: 'London, ON', img: asset('images/universities/western.png'), gradient: 'from-brand-100 to-brand-50' },
  { id: 'ottawa', name: 'University of Ottawa', caption: 'Ottawa, ON', img: asset('images/universities/ottawa.svg'), gradient: 'from-brand-50 to-cloud' },
  { id: 'guelph', name: 'University of Guelph', caption: 'Guelph, ON', img: asset('images/universities/guelph.png'), gradient: 'from-cloud to-brand-50' },
  { id: 'york', name: 'York University', caption: 'Toronto, ON', img: asset('images/universities/york.svg'), gradient: 'from-brand-100 to-brand-50' },
]

// Most-reported programs band (the carousel under "Where the data runs deepest").
//
// Built from the generated summary rather than hand-written, so the names,
// averages and links are real. The previous version listed invented averages
// and pointed every tile at a bare /program, which just redirects to Explore —
// a tile advertising "Computer Science · Waterloo" landed you on the search page.
//
// `img` is the same square logo the cards and program pages use, rendered with
// imgFit="contain" on a white tile — object-cover would crop the wordmarks.
const mark = (id: string) => asset(`images/universities/square/${id}.png`)

const GRADIENTS = [
  'from-brand-100 to-brand-50',
  'from-brand-50 to-cloud',
  'from-cloud to-brand-100',
  'from-brand-100 to-cloud',
  'from-brand-50 to-brand-100',
  'from-cloud to-brand-50',
]

export const POPULAR_ITEMS: CarouselItem[] = SUMMARY.featured.map((f, i) => ({
  id: `${f.universityId}-${f.slug}`,
  name: f.name,
  caption: `${f.school} · median ${f.median}%`,
  img: mark(f.universityId),
  gradient: GRADIENTS[i % GRADIENTS.length],
  href: `/program/${f.universityId}/${f.slug}`,
}))
