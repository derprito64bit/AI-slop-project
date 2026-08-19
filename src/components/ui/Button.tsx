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
  inverse: 'bg-white text-brand-700 hover:scale-[1.03]',
}

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
  const classes = `inline-block rounded-full font-600 transition-all ${VARIANTS[variant]} ${SIZES[size]} ${className}`

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
