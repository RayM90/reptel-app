import { useEffect, useRef, useState } from 'react'
import { useConfirmDialogStore } from '../store/confirmDialog.store'

export default function ConfirmDialog() {
  const { isOpen, options, close } = useConfirmDialogStore()
  const [text, setText] = useState('')
  const boxRef = useRef<HTMLDivElement>(null)
  const firstFieldRef = useRef<HTMLTextAreaElement>(null)

  const handleCancel = () => {
    close(null)
    setText('')
  }

  useEffect(() => {
    if (!isOpen) return

    // Foco inicial: el campo de texto si existe, si no el propio contenedor
    firstFieldRef.current?.focus()

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleCancel()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen])

  if (!isOpen || !options) return null

  const handleConfirm = () => {
    if (options.requireText && !text.trim()) return
    close(options.requireText ? text.trim() : true)
    setText('')
  }

  return (
    <div className="modal-overlay">
      <div
        className="modal-box"
        ref={boxRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
      >
        <h3 id="confirm-dialog-title">{options.title}</h3>

        {options.requireText && (
          <div className="form-group">
            <label htmlFor="confirm-dialog-text">{options.textLabel || 'Motivo'}</label>
            <textarea
              id="confirm-dialog-text"
              ref={firstFieldRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={3}
            />
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}>
          <button className="btn btn-outline" onClick={handleCancel}>
            Cancelar
          </button>
          <button className="btn btn-primary" onClick={handleConfirm}>
            {options.confirmLabel || 'Confirmar'}
          </button>
        </div>
      </div>
    </div>
  )
}