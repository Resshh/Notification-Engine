
import { useCallback, useEffect, useState } from 'react'
import { api } from '../api.js'
import './RecipientList.css'

const emptyForm = {
  name: '',
  emails: [],
  cc: [],
  bcc: [],
}

const emptyEmailInputs = {
  emails: '',
  cc: '',
  bcc: '',
}

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// Split multiple emails entered with commas, semicolons or new lines.
function parseEmails(value) {
  return value
    .split(/[,\n;]+/)
    .map((email) => email.trim())
    .filter(Boolean)
}

export default function RecipientList() {
  const [lists, setLists] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [search, setSearch] = useState('')

  const [formOpen, setFormOpen] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [emailInputs, setEmailInputs] = useState(emptyEmailInputs)

  const [deleteTarget, setDeleteTarget] = useState(null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // Load recipient lists from the backend.
  const loadLists = useCallback(async (isActive = () => true) => {
    try {
      const data = await api('/recipient-lists')

      if (!Array.isArray(data.lists)) {
        throw new Error('Invalid recipient-list response.')
      }

      if (isActive()) {
        setLists(data.lists)
        setError('')
      }
    } catch (err) {
      if (isActive()) {
        setError(err.message || 'Unable to load recipient lists.')
      }
    } finally {
      if (isActive()) {
        setLoading(false)
      }
    }
  }, [])

useEffect(() => {
  let active = true

  api('/recipient-lists')
    .then((data) => {
      if (!Array.isArray(data.lists)) {
        throw new Error('Invalid recipient-list response.')
      }

      if (active) {
        setLists(data.lists)
        setError('')
      }
    })
    .catch((err) => {
      if (active) {
        setError(err.message || 'Unable to load recipient lists.')
      }
    })
    .finally(() => {
      if (active) {
        setLoading(false)
      }
    })

  return () => {
    active = false
  }
}, [])

  // Open the form for creating a new list.
  function openCreateForm() {
    setEditingId(null)
    setForm({ ...emptyForm })
    setEmailInputs({ ...emptyEmailInputs })
    setError('')
    setMessage('')
    setFormOpen(true)
  }

  // Open the form with the selected list's existing data.
  function openEditForm(list) {
    setEditingId(list._id)

    setForm({
      name: list.name || '',
      emails: [...(list.emails || [])],
      cc: [...(list.cc || [])],
      bcc: [...(list.bcc || [])],
    })

    setEmailInputs({ ...emptyEmailInputs })
    setError('')
    setMessage('')
    setFormOpen(true)
  }

  // Close and reset the form.
  function closeForm() {
    setFormOpen(false)
    setEditingId(null)
    setForm({ ...emptyForm })
    setEmailInputs({ ...emptyEmailInputs })
    setError('')
  }

  function updateName(value) {
    setForm((current) => ({
      ...current,
      name: value,
    }))
  }

  function updateEmailInput(field, value) {
    setEmailInputs((current) => ({
      ...current,
      [field]: value,
    }))
  }

  // Add email addresses to To, CC or BCC.
  function addEmail(field) {
    const value = emailInputs[field].trim()

    if (!value) return

    const addresses = parseEmails(value)

    const invalid = addresses.find(
      (email) => !emailPattern[0].test(email)
    )

    if (invalid) {
      setError(`"${invalid}" is not a valid email address.`)
      return
    }

    // Check existing addresses across all three fields.
    const existing = new Set([
      ...form.emails,
      ...form.cc,
      ...form.bcc,
    ].map((email) => email.trim().toLowerCase()))

    // Also check duplicates within the newly entered addresses.
    const seen = new Set()

    for (const email of addresses) {
      const normalized = email.toLowerCase()

      if (existing.has(normalized) || seen.has(normalized)) {
        setError(`"${email}" has already been added.`)
        return
      }

      seen.add(normalized)
    }

    setError('')

    setForm((current) => ({
      ...current,
      [field]: [...current[field], ...addresses],
    }))

    setEmailInputs((current) => ({
      ...current,
      [field]: '',
    }))
  }

  function removeEmail(field, index) {
    setForm((current) => ({
      ...current,
      [field]: current[field].filter((_, i) => i !== index),
    }))
  }

  function handleEmailKeyDown(event, field) {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault()
      addEmail(field)
    }
  }

  // Validate the complete form before sending it to the backend.
  function validateForm(data, currentEditingId) {
    if (!data.name.trim()) {
      setError('Recipient list name is required.')
      return false
    }

    if (data.emails.length === 0) {
      setError('Please add at least one To email address.')
      return false
    }

    const allEmails = [
      ...data.emails,
      ...data.cc,
      ...data.bcc,
    ]

    for (const email of allEmails) {
      if (!emailPattern.test(email.trim())) {
        setError(`Invalid email address: ${email}`)
        return false
      }
    }

    // Email addresses must be unique across To, CC and BCC.
    const normalized = allEmails.map(
      (email) => email.trim().toLowerCase()
    )

    if (new Set(normalized).size !== normalized.length) {
      setError('An email address cannot appear more than once in the list.')
      return false
    }

    // Check for an existing list with the same name.
    const duplicateName = lists.find(
      (list) =>
        list.name.trim().toLowerCase() ===
          data.name.trim().toLowerCase() &&
        list._id !== currentEditingId
    )

    if (duplicateName) {
      setError('A recipient list with this name already exists.')
      return false
    }

    return true
  }

  // Create a new recipient list or update an existing one.
  async function saveList(event) {
    event.preventDefault()

    if (saving) return

    setError('')
    setMessage('')

    // Copy the form so we can include emails still in the input boxes.
    const updatedForm = {
      ...form,
      emails: [...form.emails],
      cc: [...form.cc],
      bcc: [...form.bcc],
    }

    for (const field of ['emails', 'cc', 'bcc']) {
      const value = emailInputs[field].trim()

      if (!value) continue

      const addresses = parseEmails(value)

      const invalid = addresses.find(
        (email) => !emailPattern.test(email)
      )

      if (invalid) {
        setError(`"${invalid}" is not a valid email address.`)
        return
      }

      updatedForm[field] = [
        ...updatedForm[field],
        ...addresses,
      ]
    }

    // Validate all entered data, including pending email inputs.
    if (!validateForm(updatedForm, editingId)) {
      return
    }

    const payload = {
      name: updatedForm.name.trim(),
      emails: updatedForm.emails,
      cc: updatedForm.cc,
      bcc: updatedForm.bcc,
    }

    setSaving(true)

    try {
      if (editingId) {
        await api(`/recipient-lists/${editingId}`, {
          method: 'PUT',
          body: payload,
        })

        setMessage('Recipient list updated successfully.')
      } else {
        await api('/recipient-lists', {
          method: 'POST',
          body: payload,
        })

        setMessage('Recipient list created successfully.')
      }

      closeForm()
      await loadLists()
    } catch (err) {
      setError(err.message || 'Unable to save recipient list.')
    } finally {
      setSaving(false)
    }
  }

  // Delete the selected recipient list.
  async function confirmDelete() {
    if (!deleteTarget || deleting) return

    setError('')
    setMessage('')
    setDeleting(true)

    try {
      await api(`/recipient-lists/${deleteTarget._id}`, {
        method: 'DELETE',
      })

      setDeleteTarget(null)
      await loadLists()
      setMessage('Recipient list deleted successfully.')
    } catch (err) {
      setError(err.message || 'Unable to delete recipient list.')
      setDeleteTarget(null)
    } finally {
      setDeleting(false)
    }
  }

  // Search recipient lists by name.
  const filteredLists = lists.filter((list) =>
    (list.name || '').toLowerCase().includes(search.trim().toLowerCase())
  )

  return (
    <section className="recipients-page">

      {/* Page heading */}
      <div className="recipients-heading">
        <div>
          <p className="recipients-eyebrow">EMAIL AUTOMATION</p>
          <h2>Recipient Lists</h2>
          <p className="recipients-subtitle">
            Manage email recipients and distribution lists.
          </p>
        </div>

        <button
          type="button"
          className="recipients-primary-btn"
          onClick={openCreateForm}
        >
          <span>+</span> New List
        </button>
      </div>

      {/* Success message */}
      {message && (
        <div className="recipients-message recipients-success" role="status">
          <span>✓</span> {message}
          <button type="button" onClick={() => setMessage('')}>
            ×
          </button>
        </div>
      )}

      {/* Error message outside the form */}
      {error && !formOpen && (
        <div className="recipients-message recipients-error" role="alert">
          {error}
          <button type="button" onClick={() => setError('')}>
            ×
          </button>
        </div>
      )}

      {/* Search toolbar */}
      <div className="recipients-toolbar">
        <div>
          <h3>All Recipient Lists</h3>
          <p>
            {lists.length} {lists.length === 1 ? 'list' : 'lists'} available
          </p>
        </div>

        <div className="recipients-search">
          <span>⌕</span>
          <input
            type="search"
            placeholder="Search recipient lists..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            aria-label="Search recipient lists"
          />
        </div>
      </div>

      {/* Recipient lists table or empty state */}
      {loading ? (
        <div className="recipients-empty">
          Loading recipient lists...
        </div>
      ) : filteredLists.length === 0 ? (
        <div className="recipients-empty">
          <div className="recipients-empty-icon">✉</div>

          <h3>
            {search ? 'No matching lists found' : 'No recipient lists yet'}
          </h3>

          <p>
            {search
              ? 'Try searching with a different list name.'
              : 'Create your first recipient list to get started.'}
          </p>

          {!search && (
            <button
              type="button"
              className="recipients-primary-btn"
              onClick={openCreateForm}
            >
              + Create Recipient List
            </button>
          )}
        </div>
      ) : (
        <div className="recipients-table-card">
          <div className="recipients-table-wrap">
            <table className="recipients-table">
              <thead>
                <tr>
                  <th>LIST NAME</th>
                  <th>TO EMAILS</th>
                  <th>CC EMAILS</th>
                  <th>BCC EMAILS</th>
                  <th>ACTIONS</th>
                </tr>
              </thead>

              <tbody>
                {filteredLists.map((list) => (
                  <tr key={list._id}>
                    <td>
                      <div className="recipients-list-name">
                        <span className="recipients-list-icon">✉</span>
                        <strong>{list.name}</strong>
                      </div>
                    </td>

                    <td>
                      <EmailSummary emails={list.emails || []} />
                    </td>

                    <td>
                      <EmailSummary emails={list.cc || []} />
                    </td>

                    <td>
                      <EmailSummary emails={list.bcc || []} />
                    </td>

                    <td>
                      <div className="recipients-actions">
                        <button
                          type="button"
                          className="recipients-edit-btn"
                          onClick={() => openEditForm(list)}
                        >
                          Edit
                        </button>

                        <button
                          type="button"
                          className="recipients-delete-btn"
                          onClick={() => setDeleteTarget(list)}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create / Edit modal */}
      {formOpen && (
        <div
          className="recipients-modal-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !saving) {
              closeForm()
            }
          }}
        >
          <div
            className="recipients-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="recipient-form-title"
          >
            <div className="recipients-modal-header">
              <div>
                <p className="recipients-eyebrow">
                  RECIPIENT MANAGEMENT
                </p>

                <h3 id="recipient-form-title">
                  {editingId ? 'Edit Recipient List' : 'Create Recipient List'}
                </h3>

                <p>
                  Add the email addresses that should receive notifications.
                </p>
              </div>

              <button
                type="button"
                className="recipients-close-btn"
                onClick={closeForm}
                aria-label="Close form"
                disabled={saving}
              >
                ×
              </button>
            </div>

            {error && (
              <div className="recipients-message recipients-error" role="alert">
                {error}
              </div>
            )}

            <form onSubmit={saveList}>
              <div className="recipients-form-body">

                <label className="recipients-field">
                  <span>
                    List Name <b>*</b>
                  </span>

                  <input
                    type="text"
                    placeholder="e.g. Finance Team"
                    value={form.name}
                    onChange={(event) => updateName(event.target.value)}
                    required
                    maxLength={100}
                  />
                </label>

                <EmailField
                  label="To Email Addresses"
                  required
                  field="emails"
                  values={form.emails}
                  inputValue={emailInputs.emails}
                  onInputChange={updateEmailInput}
                  onAdd={addEmail}
                  onRemove={removeEmail}
                  onKeyDown={handleEmailKeyDown}
                />

                <EmailField
                  label="CC Email Addresses"
                  field="cc"
                  values={form.cc}
                  inputValue={emailInputs.cc}
                  onInputChange={updateEmailInput}
                  onAdd={addEmail}
                  onRemove={removeEmail}
                  onKeyDown={handleEmailKeyDown}
                />

                <EmailField
                  label="BCC Email Addresses"
                  field="bcc"
                  values={form.bcc}
                  inputValue={emailInputs.bcc}
                  onInputChange={updateEmailInput}
                  onAdd={addEmail}
                  onRemove={removeEmail}
                  onKeyDown={handleEmailKeyDown}
                />

              </div>

              <div className="recipients-modal-footer">
                <button
                  type="button"
                  className="recipients-cancel-btn"
                  onClick={closeForm}
                  disabled={saving}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="recipients-primary-btn"
                  disabled={saving}
                >
                  {saving
                    ? 'Saving...'
                    : editingId
                      ? 'Save Changes'
                      : 'Create List'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete confirmation modal */}
      {deleteTarget && (
        <div
          className="recipients-modal-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !deleting) {
              setDeleteTarget(null)
            }
          }}
        >
          <div
            className="recipients-confirm-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-title"
          >
            <div className="recipients-confirm-icon">!</div>

            <h3 id="delete-title">Delete Recipient List?</h3>

            <p>
              Are you sure you want to delete{' '}
              <strong>{deleteTarget.name}</strong>?
              This action cannot be undone.
            </p>

            <div className="recipients-modal-footer">
              <button
                type="button"
                className="recipients-cancel-btn"
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
              >
                Cancel
              </button>

              <button
                type="button"
                className="recipients-confirm-delete"
                onClick={confirmDelete}
                disabled={deleting}
              >
                {deleting ? 'Deleting...' : 'Delete List'}
              </button>
            </div>
          </div>
        </div>
      )}

    </section>
  )
}

// Displays email addresses in the table.
function EmailSummary({ emails }) {
  if (!emails.length) {
    return <span className="recipients-no-email">—</span>
  }

  return (
    <div className="recipients-email-summary">
      {emails.length <= 2 ? (
        emails.map((email) => (
          <span className="recipients-email-chip" key={email}>
            {email}
          </span>
        ))
      ) : (
        <>
          <span className="recipients-email-chip">
            {emails[0]}
          </span>

          <span className="recipients-more-chip">
            +{emails.length - 1} more
          </span>
        </>
      )}
    </div>
  )
}

// Reusable input component for To, CC and BCC.
function EmailField({
  label,
  required = false,
  field,
  values,
  inputValue,
  onInputChange,
  onAdd,
  onRemove,
  onKeyDown,
}) {
  return (
    <div className="recipients-field">
      <span>
        {label} {required && <b>*</b>}
        {!required && <small> (Optional)</small>}
      </span>

      <div className="recipients-email-input-row">
        <input
          type="text"
          placeholder="Enter email address..."
          value={inputValue}
          onChange={(event) => onInputChange(field, event.target.value)}
          onKeyDown={(event) => onKeyDown(event, field)}
          aria-label={label}
        />

        <button
          type="button"
          className="recipients-add-email-btn"
          onClick={() => onAdd(field)}
        >
          + Add
        </button>
      </div>

      <div className="recipients-email-chips">
        {values.map((email, index) => (
          <span
            className="recipients-form-chip"
            key={`${email}-${index}`}
          >
            {email}

            <button
              type="button"
              onClick={() => onRemove(field, index)}
              aria-label={`Remove ${email}`}
            >
              ×
            </button>
          </span>
        ))}
      </div>
    </div>
  )
}
