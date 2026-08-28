import { Link } from 'react-router-dom'
import type { ReactNode, ButtonHTMLAttributes } from 'react'

// Shared button. Renders as a router <Link> when `to` is set, otherwise a
// <button>. Pills are reserved for real actions like this — see the design
// note about not over-rounding everything.
type Variant = 'primary' | 'secondary' | 'inverse'
type Size = 'sm' | 'md'

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-brand-500 text-white shadow-sm hover:bg-brand-600',
  secondary: 'border border-line bg-paper text-ink hover:border-brand-300 hover:text-brand-600',
  // `inverse` sits on the brand-700 block, which is the same colour in both
  // themes, so the white here is deliberate rather than a missed token.
  inverse: 'bg-white text-brand-700 hover:scale-[1.03]',
}

/**
 * Pressed and disabled.
 *
 * There was no pressed state anywhere on the site — `active:` appeared zero
 * times — so a button could be clicked and never acknowledge it. 0.97 is inside
 * the 0.95-1.05 band the guidance gives, and the scale is the whole feedback:
 * nothing moves in layout, so a press cannot shift the page.
 *
 * Disabled was hand-rolled by three callers passing `className={busy ?
 * 'opacity-60' : ''}`, which set the look and left the button fully clickable.
 * `disabled:` styling here pairs with the real attribute, so the two cannot
 * drift apart.
 */
const STATES =
  'active:scale-[0.97] disabled:pointer-events-none disabled:opacity-55 disabled:shadow-none'

const SIZES: Record<Size, string> = {
  sm: 'px-5 py-2 text-sm',
  md: 'px-6 py-3 text-sm',
}

type BaseProps = {
  children: ReactNode
  variant?: Variant
  size?: Size
  className?: string
}

type ButtonProps = BaseProps &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, keyof BaseProps> & { to?: string }

export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  className = '',
  to,
  ...rest
}: ButtonProps) {
  // Explicit property list rather than transition-all: `all` also transitions
  // layout properties, which is the thing every performance note in this repo
  // says not to do.
  //
  // `scale` is listed SEPARATELY from `transform`, and both are needed.
  // Tailwind v4's scale-* utilities set the CSS `scale` property rather than a
  // transform function, so a transition list carrying only `transform` leaves
  // every active:scale press snapping instantly — which is exactly what these
  // did until it was measured rather than assumed.
  const classes =
    'inline-block rounded-full font-600 transition-[scale,transform,background-color,border-color,color,box-shadow] ' +
    `${STATES} ${VARIANTS[variant]} ${SIZES[size]} ${className}`

  if (to) {
    return (
      <Link to={to} className={classes}>
        {children}
      </Link>
    )
  }

  return (
    <button className={classes} {...rest}>
      {children}
    </button>
  )
}
