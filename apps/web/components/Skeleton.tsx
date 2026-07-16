'use client'

const shimmerStyle: React.CSSProperties = {
  background: 'linear-gradient(90deg, var(--border) 25%, var(--bg) 50%, var(--border) 75%)',
  backgroundSize: '1200px 100%',
  animation: 'sk-shimmer 1.6s infinite linear',
  borderRadius: 6,
}

if (typeof document !== 'undefined' && !document.getElementById('sk-shimmer-style')) {
  const el = document.createElement('style')
  el.id = 'sk-shimmer-style'
  el.textContent = `@keyframes sk-shimmer {
    0%   { background-position: -600px 0; }
    100% { background-position:  600px 0; }
  }`
  document.head.appendChild(el)
}

interface SkeletonTextProps {
  width?: string | number
  style?: React.CSSProperties
}

export function SkeletonText({ width = '70%', style }: SkeletonTextProps) {
  return (
    <div
      aria-hidden="true"
      style={{ ...shimmerStyle, height: 13, borderRadius: 99, width, ...style }}
    />
  )
}

interface SkeletonBlockProps {
  height?: string | number
  width?: string | number
  style?: React.CSSProperties
}

export function SkeletonBlock({ height = 40, width = '100%', style }: SkeletonBlockProps) {
  return (
    <div
      aria-hidden="true"
      style={{ ...shimmerStyle, height, width, borderRadius: 10, ...style }}
    />
  )
}

interface SkeletonAvatarProps {
  size?: number
  style?: React.CSSProperties
}

export function SkeletonAvatar({ size = 32, style }: SkeletonAvatarProps) {
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'center', ...style }}>
      <div
        aria-hidden="true"
        style={{ ...shimmerStyle, width: size, height: size, borderRadius: '50%', flexShrink: 0 }}
      />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 7 }}>
        <SkeletonText width="70%" />
        <SkeletonText width="45%" />
      </div>
    </div>
  )
}
