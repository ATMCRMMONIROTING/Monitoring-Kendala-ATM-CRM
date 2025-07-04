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
  const [namaPenulis, setNamaPenulis] = useState("")
  const [nomorHp, setNomorHp] = useState("")
  const [file, setFile] = useState(null)
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
    UKO: "UKO",
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
      ref.kc_supervisi.toLowerCase().includes(tidSearch.toLowerCase()),
  )

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0]
    setFile(selectedFile)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!title || !userId || !tid) return alert("Judul, Pengelola, dan TID perlu diisi")

    setLoading(true)
    try {
      const formData = new FormData()
      formData.append("title", title)
      formData.append("description", description)
      formData.append("user_id", userId)
      formData.append("tid", tid)

      // Add the new fields to the form data
      if (namaPenulis) {
        formData.append("nama_penulis", namaPenulis)
      }
      if (nomorHp) {
        formData.append("nomor_hp", nomorHp)
      }

      if (file) {
        formData.append("file", file)
      }

      await axios.post("/admin/orders", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      })

      alert("Kendala berhasil dibuat")
      navigate("/admin")
    } catch (err) {
      if (err.response?.status === 401) logout()
      else if (err.response?.status === 404) alert("TID tidak ditemukan dalam reference data")
      else alert("Kendala gagal dibuat: " + (err.response?.data?.detail || err.message))
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

          <div className="form-group">
            <label>Nama Penulis</label>
            <input
              type="text"
              placeholder="Masukan nama penulis kendala (opsional)"
              value={namaPenulis}
              onChange={(e) => setNamaPenulis(e.target.value)}
            />
            <small style={{ color: "#666" }}>Nama orang yang melaporkan atau menulis kendala ini</small>
          </div>

          <div className="form-group">
            <label>Nomor HP</label>
            <input
              type="tel"
              placeholder="Masukan nomor HP (opsional)"
              value={nomorHp}
              onChange={(e) => setNomorHp(e.target.value)}
            />
            <small style={{ color: "#666" }}>Nomor HP yang dapat dihubungi terkait kendala ini</small>
          </div>

          <div className="form-group">
            <label>Upload Gambar/File (Opsional)</label>
            <div className={`file-upload ${file ? "has-file" : ""}`}>
              <input type="file" accept="image/*" onChange={handleFileChange} />
              <div className="file-upload-label">
                {file ? (
                  <div>
                    <div style={{ fontWeight: "500", marginBottom: "0.25rem" }}>File dipilih: {file.name}</div>
                    <div style={{ fontSize: "0.75rem", opacity: 0.8 }}>
                      Ukuran: {(file.size / 1024 / 1024).toFixed(2)} MB
                    </div>
                    <div style={{ fontSize: "0.75rem", marginTop: "0.5rem" }}>Klik untuk mengganti file</div>
                  </div>
                ) : (
                  <div>
                    <div style={{ marginBottom: "0.5rem" }}>📁</div>
                    <div>Klik untuk memilih file</div>
                    <div style={{ fontSize: "0.75rem", marginTop: "0.25rem", opacity: 0.7 }}>
                      Gambar baik berupa png atau jpg
                    </div>
                  </div>
                )}
              </div>
            </div>
            <small style={{ color: "#666", marginTop: "0.5rem", display: "block" }}>
              File akan diupload ke Google Drive dan dapat diakses oleh pengelola
            </small>
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