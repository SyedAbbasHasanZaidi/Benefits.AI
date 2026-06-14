'use client'

import { useState, useEffect } from 'react'

interface ModalWrapperProps {
  onClose: () => void
  label: string
  children: (handleClose: () => void) => React.ReactNode
}

export function ModalWrapper({ onClose, label, children }: ModalWrapperProps) {
  const [closing, setClosing] = useState(false)

  function handleClose() {
    setClosing(true)
    setTimeout(onClose, 210)
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') handleClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div
      className={`modal-scrim${closing ? ' closing' : ''}`}
      onMouseDown={(e) => { if (e.target === e.currentTarget) handleClose() }}
    >
      <div
        className={`modal-card${closing ? ' closing' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={label}
      >
        {children(handleClose)}
      </div>
    </div>
  )
}
