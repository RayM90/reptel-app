import { useState } from 'react'
import { useConfirmDialogStore } from '../store/confirmDialog.store'

export default function ConfirmDialog() {
  const { isOpen, options, close } = useConfirmDialogStore()
  const [text, setText] = useState('')

  if (!isOpen || !options) return null

  const handleConfirm = () => {
    if (options.requireText && !text.trim()) return
    close(options.requireText ? text.trim() : true)
    setText('')
  }

  const handleCancel = () => {
    close(null)
    setText('')
  }

  return (
    <div className="modal-overlay">
      <div className="modal-box">
        <h3>{options.title}</h3>

        {options.requireText && (
          <div className="form-group">
            <label>{options.textLabel || 'Motivo'}</label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={3}
              autoFocus
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