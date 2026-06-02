import React, { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'

const Modal = ({
  isOpen,
  onClose,
  title,
  children,
  showCloseButton = true,
  fullScreen = false,
}) => {
  const dialogRef = useRef(null)

  useEffect(() => {
    if (!isOpen) return undefined
    const previousOverflow = document.body.style.overflow
    const appRoot = document.getElementById('root')
    const previousRootInert = appRoot?.inert
    const previousRootAriaHidden = appRoot?.getAttribute('aria-hidden')
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        onClose?.()
        return
      }
      if (event.key !== 'Tab') return

      const focusable = dialogRef.current?.querySelectorAll(
        'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )
      const items = Array.from(focusable || []).filter(item => item.offsetParent !== null)
      if (!items.length) return

      const first = items[0]
      const last = items[items.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    document.body.style.overflow = 'hidden'
    if (appRoot) {
      appRoot.inert = true
      appRoot.setAttribute('aria-hidden', 'true')
    }
    window.addEventListener('keydown', handleKeyDown)
    window.requestAnimationFrame(() => {
      const firstFocusable = dialogRef.current?.querySelector(
        'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'
      )
      firstFocusable?.focus()
    })
    return () => {
      document.body.style.overflow = previousOverflow
      if (appRoot) {
        appRoot.inert = Boolean(previousRootInert)
        if (previousRootAriaHidden === null) {
          appRoot.removeAttribute('aria-hidden')
        } else {
          appRoot.setAttribute('aria-hidden', previousRootAriaHidden)
        }
      }
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, onClose])

  const modal = (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-[100]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {/* Overlay */}
          <motion.div
            className="modal-overlay absolute inset-0"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />
          
          {/* Modal Content */}
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title || '弹窗'}
            ref={dialogRef}
            onClick={(event) => event.stopPropagation()}
            className={`modal-content absolute ${
              fullScreen 
                ? 'inset-4 rounded-[14px]' 
                : 'bottom-4 left-4 right-4 top-4 overflow-auto sm:bottom-auto sm:top-[20%] sm:max-h-[70vh]'
            } mx-auto max-w-[92vw] sm:max-w-[720px] lg:max-w-[860px]`}
            initial={fullScreen ? { scale: 0.95, opacity: 0 } : { y: 20, opacity: 0 }}
            animate={fullScreen ? { scale: 1, opacity: 1 } : { y: 0, opacity: 1 }}
            exit={fullScreen ? { scale: 0.95, opacity: 0 } : { y: 20, opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          >
            {/* Header */}
            {title && (
              <div className="flex items-center justify-between border-b border-neutral-100 p-4 sm:p-5">
                <h2 className="text-title-1 text-neutral-800">{title}</h2>
                {showCloseButton && (
                  <button
                    onClick={onClose}
                    className="w-8 h-8 flex items-center justify-center rounded-full bg-neutral-100 hover:bg-neutral-200 transition-colors"
                    aria-label="关闭"
                  >
                    <X size={16} className="text-neutral-500" />
                  </button>
                )}
              </div>
            )}
            
            {/* Body */}
            <div className={fullScreen ? 'h-full overflow-auto' : 'p-4 sm:p-5'}>
              {children}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )

  if (typeof document === 'undefined') return null
  return createPortal(modal, document.body)
}

export default Modal
