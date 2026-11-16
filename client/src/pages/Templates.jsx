import { useEffect, useRef, useState } from 'react'
import { api } from '../api.js'
import { useAuth } from '../context/AuthContext.jsx'
import './Templates.css'

const placeholders = [
  '{{Date}}',
  '{{Branch}}',
  '{{TotalSales}}',
  '{{Orders}}',
  '{{JobName}}',
  '{{RowCount}}',
]

const emptyTemplate = { name: '', subject: '', body: '' }

export default function Templates() {
  const { user } = useAuth()
  const [templates, setTemplates] = useState([])
  const [templateId, setTemplateId] = useState('')
  const [form, setForm] = useState(emptyTemplate)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const bodyRef = useRef(null)
  const isAdmin = user?.role === 'admin'

  useEffect(() => {
    let active = true

    async function loadTemplates() {
      try {
        const data = await api('/templates')
        if (active) {
          setTemplates(Array.isArray(data.templates) ? data.templates : [])
        }
      } catch (loadError) {
        if (active) {
          setError(loadError.message || 'Unable to load templates.')
        }
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    loadTemplates()
    return () => {
      active = false
    }
  }, [])

  function startNewTemplate() {
    setTemplateId('')
    setForm({ ...emptyTemplate })
    setError('')
    setNotice('')
  }

  function selectTemplate(event) {
    const selectedId = event.target.value
    const selected = templates.find(
      (template) => String(template._id || template.id) === selectedId
    )

    setTemplateId(selectedId)
    setForm(selected
      ? {
          name: selected.name || '',
          subject: selected.subject || '',
          body: selected.body || '',
        }
      : { ...emptyTemplate })
    setError('')
    setNotice('')
  }

  function insertPlaceholder(value) {
    const textarea = bodyRef.current
    const start = textarea?.selectionStart ?? form.body.length
    const end = textarea?.selectionEnd ?? form.body.length

    setForm((current) => ({
      ...current,
      body: `${current.body.slice(0, start)}${value}${current.body.slice(end)}`,
    }))

    requestAnimationFrame(() => {
      textarea?.focus()
      textarea?.setSelectionRange(start + value.length, start + value.length)
    })
  }

  function handleDrop(event) {
    event.preventDefault()
    const value = event.dataTransfer.getData('text/plain')
    if (placeholders.includes(value)) {
      insertPlaceholder(value)
    }
  }

  async function saveTemplate(event) {
    event.preventDefault()
    setError('')
    setNotice('')

    const payload = {
      name: form.name.trim(),
      subject: form.subject.trim(),
      body: form.body.trim(),
    }

    if (!payload.name || !payload.subject || !payload.body) {
      setError('Template name, subject, and body are required.')
      return
    }

    setSaving(true)
    try {
      const response = await api(
        templateId ? `/templates/${encodeURIComponent(templateId)}` : '/templates',
        { method: templateId ? 'PUT' : 'POST', body: payload }
      )
      const saved = response.template
      if (!saved) {
        throw new Error('The server did not return the saved template.')
      }

      const savedId = String(saved._id || saved.id)
      setTemplates((current) => {
        const next = current.filter(
          (template) => String(template._id || template.id) !== savedId
        )
        return [...next, saved].sort((a, b) => a.name.localeCompare(b.name))
      })
      setTemplateId(savedId)
      setForm({
        name: saved.name,
        subject: saved.subject,
        body: saved.body,
      })
      setNotice('Template saved successfully.')
    } catch (saveError) {
      setError(saveError.message || 'Unable to save template.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="template-page">
      <header className="template-header">
        <h1>{templateId ? 'Edit template' : 'Create template'}</h1>
        <div className="template-header-actions">
          <label className="visually-hidden" htmlFor="template-select">Select template</label>
          <select
            id="template-select"
            value={templateId}
            onChange={selectTemplate}
            disabled={loading}
          >
            <option value="">Select Template</option>
            {templates.map((template) => (
              <option
                key={String(template._id || template.id)}
                value={String(template._id || template.id)}
              >
                {template.name}
              </option>
            ))}
          </select>
          <button
            className="template-secondary-button"
            type="button"
            onClick={startNewTemplate}
            disabled={!isAdmin}
          >
            + New
          </button>
          <button
            className="template-save-button"
            type="submit"
            form="template-form"
            disabled={!isAdmin || saving || loading}
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </header>

      {loading && <p className="template-message" role="status">Loading templates…</p>}
      {error && <p className="template-message template-error" role="alert">{error}</p>}
      {notice && <p className="template-message template-success" role="status">{notice}</p>}
      {!isAdmin && (
        <p className="template-message">Only administrators can create or edit templates.</p>
      )}

      <form id="template-form" className="template-editor-layout" onSubmit={saveTemplate}>
        <div className="template-form-fields">
          <label>
            Template name
            <input
              type="text"
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              placeholder="Enter template name"
              required
              disabled={!isAdmin}
            />
          </label>
          <label>
            Subject
            <input
              type="text"
              value={form.subject}
              onChange={(event) => setForm({ ...form, subject: event.target.value })}
              placeholder="Enter email subject"
              required
              disabled={!isAdmin}
            />
          </label>
          <label>
            Body
            <textarea
              ref={bodyRef}
              value={form.body}
              onChange={(event) => setForm({ ...form, body: event.target.value })}
              onDragOver={(event) => event.preventDefault()}
              onDrop={handleDrop}
              placeholder="Write your email body here. Drag placeholders into this field."
              required
              disabled={!isAdmin}
            />
          </label>
        </div>

        <aside className="template-placeholder-panel">
          <h2>Placeholders</h2>
          <p>Drag into the body or select to insert at the cursor.</p>
          <div className="template-placeholder-list">
            {placeholders.map((placeholder) => (
              <button
                key={placeholder}
                className="template-placeholder"
                type="button"
                draggable={isAdmin}
                disabled={!isAdmin}
                onClick={() => insertPlaceholder(placeholder)}
                onDragStart={(event) => {
                  event.dataTransfer.setData('text/plain', placeholder)
                  event.dataTransfer.effectAllowed = 'copy'
                }}
              >
                {placeholder}
              </button>
            ))}
          </div>
        </aside>
      </form>
    </section>
  )
}
