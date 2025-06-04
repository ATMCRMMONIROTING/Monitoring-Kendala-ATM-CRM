"use client"

import { useState, useEffect, useContext } from "react"
import axios from "../api/axios"
import { AuthContext } from "../context/AuthContext"
import { useNavigate } from "react-router-dom"

export default function CreateOrder() {
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [userId, setUserId] = useState("")
  const [tid, setTid] = useState("")
  const [tidSearch, setTidSearch] = useState("")
  const [users, setUsers] = useState([])
  const [referenceData, setReferenceData] = useState([])
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const { logout } = useContext(AuthContext)

  const pengelolaToUsername = {
    "SENTRALISASI CRO BG BANDUNG": "BGBANDUNG",
    "SENTRALISASI CRO BG CIREBON": "BGCIREBON",
    "SENTRALISASI CRO BG TASIKMALAYA": "BGTASIKMALAYA",
    "SENTRALISASI CRO BG SUKABUMI": "BGSUKABUMI",
    "SENTRALISASI CRO KEJAR BANDUNG": "KEJARBANDUNG",
    "UKO": "UKO",
  }

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const res = await axios.get("/admin/users")
        setUsers(res.data)
      } catch (err) {
        console.error("Tidak bisa mengambil users")
      }
    }

    const fetchReferenceData = async () => {
      try {
        const res = await axios.get("/admin/reference")
        setReferenceData(res.data)
      } catch (err) {
        console.error("Tidak bisa mengambil reference data")
      }
    }

    fetchUsers()
    fetchReferenceData()
  }, [])

  // Auto-select userId when TID is selected
  useEffect(() => {
    if (!tid) return

    const selectedRef = referenceData.find((ref) => ref.tid === tid)
    if (selectedRef) {
      const username = pengelolaToUsername[selectedRef.pengelola]
      const user = users.find((u) => u.username === username)
      if (user) setUserId(user.id)
    }
  }, [tid, referenceData, users])

  const filteredTids = referenceData.filter(
    (ref) =>
      ref.tid.toLowerCase().includes(tidSearch.toLowerCase()) ||
      ref.lokasi.toLowerCase().includes(tidSearch.toLowerCase()) ||
      ref.kc_supervisi.toLowerCase().includes(tidSearch.toLowerCase())
  )

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!title || !userId || !tid) return alert("Judul, Pengelola, dan TID perlu diisi")

    setLoading(true)
    try {
      await axios.post("/admin/orders", {
        title,
        description,
        user_id: Number.parseInt(userId),
        tid,
      })
      alert("Kendala berhasil dibuat")
      navigate("/admin")
    } catch (err) {
      if (err.response?.status === 401) logout()
      else if (err.response?.status === 404) alert("TID tidak ditemukan dalam reference data")
      else alert("Kendala gagal dibuat")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="page-container">
      <div className="action-bar">
        <div>
          <h1>Buat Kendala Baru</h1>
          <p className="subtitle">Berikan kendala yang harus dibereskan</p>
        </div>
      </div>

      <div className="card">
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Judul Kendala *</label>
            <input
              type="text"
              placeholder="Masukan judul yang singkat dan jelas"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label>Deskripsi</label>
            <textarea
              placeholder="Berikan instruksi secara detail dan jelas"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
            />
          </div>

          <div className="form-group">
            <label>TID (Terminal ID) *</label>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              <input
                type="text"
                placeholder="Cari TID, Lokasi, atau KC"
                value={tidSearch}
                onChange={(e) => setTidSearch(e.target.value)}
              />
              <select value={tid} onChange={(e) => setTid(e.target.value)} required>
                <option value="">Pilih TID</option>
                {filteredTids.map((ref) => (
                  <option key={ref.tid} value={ref.tid}>
                    {ref.tid} - {ref.lokasi} ({ref.kc_supervisi})
                  </option>
                ))}
              </select>
            </div>
            {referenceData.length === 0 && (
              <small style={{ color: "#666" }}>
                Tidak ada reference data tersedia. Pastikan TID sudah diinput di sistem.
              </small>
            )}
          </div>

          <div className="form-group">
            <label>Pilih Pengelola yang akan diberikan kendala *</label>
            <select value={userId} onChange={(e) => setUserId(e.target.value)} required>
              <option value="">List Pengelola</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.username} (ID: {user.id})
                </option>
              ))}
            </select>
            <small>Pengelola akan otomatis dipilih berdasarkan TID → Pengelola</small>
          </div>

          <div style={{ display: "flex", gap: "1rem" }}>
            <button type="submit" disabled={loading}>
              {loading ? "Membuat..." : "Buat Kendala"}
            </button>
            <button type="button" className="secondary" onClick={() => navigate("/admin")}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
