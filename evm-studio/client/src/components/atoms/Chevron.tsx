import React from 'react'

export interface ChevronProps {
  open?: boolean
}

export const Chevron = React.memo(function Chevron({ open = false }: ChevronProps) {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 10 10"
      style={{
        transform: open ? 'rotate(180deg)' : 'none',
        transition: 'transform 0.15s',
        flex: '0 0 auto',
      }}
    >
      <path
        d="M2 3 L5 7 L8 3"
        stroke="currentColor"
        strokeWidth="1.4"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
})
