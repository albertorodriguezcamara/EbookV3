import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

interface UserRole {
  user_id: string
  role: string
}

const ROLE_OPTIONS = [
  { id: 'admin', label: 'Admin' },
  { id: 'editor', label: 'Editor' },
  { id: 'user', label: 'Usuario' },
]

export default function RoleManager() {
  const [roles, setRoles] = useState<UserRole[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [newUserId, setNewUserId] = useState('')
  const [newRole, setNewRole] = useState('user')
  const [saving, setSaving] = useState(false)

  const fetchRoles = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('user_roles')
      .select('*')
      .order('user_id')

    if (error) {
      setError(error.message)
    } else {
      setRoles(data || [])
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchRoles()
  }, [])

  const handleRoleChange = async (userId: string, role: string) => {
    const original = roles.find(r => r.user_id === userId)
    if (!original || original.role === role) return
    // actualizar
    const { error } = await supabase
      .from('user_roles')
      .update({ role })
      .eq('user_id', userId)

    if (error) {
      alert(`Error: ${error.message}`)
    }
    fetchRoles()
  }

  const handleAdd = async () => {
    if (!newUserId) return
    setSaving(true)
    const { error } = await supabase
      .from('user_roles')
      .insert({ user_id: newUserId, role: newRole })

    if (error) alert(`Error: ${error.message}`)
    setNewUserId('')
    setNewRole('user')
    setSaving(false)
    fetchRoles()
  }

  return (
    <div className="admin-section">
      <h2 className="admin-subtitle">Roles de Usuario</h2>

      {loading ? (
        <p>Cargando roles…</p>
      ) : (
        <table className="admin-table">
          <thead>
            <tr>
              <th>User ID</th>
              <th>Rol</th>
            </tr>
          </thead>
          <tbody>
            {roles.map((r) => (
              <tr key={r.user_id}>
                <td className="font-mono text-xs">{r.user_id}</td>
                <td>
                  <select
                    className="admin-input"
                    value={r.role}
                    onChange={(e) => handleRoleChange(r.user_id, e.target.value)}
                  >
                    {ROLE_OPTIONS.map((opt) => (
                      <option key={opt.id} value={opt.id}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {error && <p className="admin-error">Error: {error}</p>}

      <div className="admin-form-section">
        <h3 className="admin-subtitle">Añadir / Invitar usuario</h3>
        <div className="admin-form-inline">
          <input
            type="text"
            value={newUserId}
            onChange={(e) => setNewUserId(e.target.value)}
            placeholder="UUID de usuario"
            className="admin-input font-mono text-xs"
          />
          <select
            value={newRole}
            onChange={(e) => setNewRole(e.target.value)}
            className="admin-input"
          >
            {ROLE_OPTIONS.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.label}
              </option>
            ))}
          </select>
          <button
            className="admin-btn admin-btn-primary"
            onClick={handleAdd}
            disabled={saving}
          >
            {saving ? 'Guardando…' : 'Añadir'}
          </button>
        </div>
        <p className="admin-help-text">
          Ingresa el UUID del usuario registrado en Supabase y asigna un rol.
        </p>
      </div>
    </div>
  )
}
