"use client"

import { useEffect, useState } from "react"
import axios from "../api/axios"
import { Link } from "react-router-dom"

export default function UserDashboard() {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)

  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [sortBy, setSortBy] = useState("newest")
  const [dateFilter, setDateFilter] = useState("all")

  const currentYear = new Date().getFullYear()
  const monthNames = [
    "Januari",
    "Februari",
    "Maret",
    "April",
    "Mei",
    "Juni",
    "Juli",
    "Agustus",
    "September",
    "Oktober",
    "November",
    "Desember",
  ]

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10

  const filteredOrders = orders
    .filter((order) => {
      // Search filter
      const matchSearch =
        order.title.toLowerCase().includes(search.toLowerCase()) ||
        order.description.toLowerCase().includes(search.toLowerCase()) ||
        (order.reference_data?.tid || "").toLowerCase().includes(search.toLowerCase()) ||
        (order.reference_data?.lokasi || "").toLowerCase().includes(search.toLowerCase())

      // Status filter
      const matchStatus = statusFilter === "all" || order.state === statusFilter

      // Date filter
      let matchDate = true
      if (dateFilter !== "all") {
        const orderDate = new Date(order.created_at)
        const orderYear = orderDate.getFullYear()
        const orderMonth = orderDate.getMonth() // 0-11
        const currentYear = new Date().getFullYear()

        // Only show orders from this year
        if (orderYear === currentYear) {
          const selectedMonth = Number.parseInt(dateFilter) // 0-11
          matchDate = orderMonth === selectedMonth
        } else {
          matchDate = false
        }
      }

      return matchSearch && matchStatus && matchDate
    })
    .sort((a, b) => {
      switch (sortBy) {
        case "newest":
          return new Date(b.created_at) - new Date(a.created_at)
        case "oldest":
          return new Date(a.created_at) - new Date(b.created_at)
        case "title":
          return a.title.localeCompare(b.title)
        case "status":
          return a.state.localeCompare(b.state)
        case "deadline":
          // Sort by time remaining (pending/overdue first, then by urgency)
          const getDeadlinePriority = (order) => {
            if (order.state === "completed" || order.state === "completed but overdue") return 3
            const created = new Date(order.created_at)
            const deadline = new Date(created.getTime() + 2 * 60 * 60 * 1000)
            const now = new Date()
            const timeLeft = deadline - now
            if (timeLeft <= 0) return 1 // Overdue - highest priority
            return 2 // Pending - medium priority
          }
          const priorityA = getDeadlinePriority(a)
          const priorityB = getDeadlinePriority(b)
          if (priorityA !== priorityB) return priorityA - priorityB
          // If same priority, sort by time remaining
          const createdA = new Date(a.created_at)
          const createdB = new Date(b.created_at)
          const deadlineA = new Date(createdA.getTime() + 2 * 60 * 60 * 1000)
          const deadlineB = new Date(createdB.getTime() + 2 * 60 * 60 * 1000)
          return deadlineA - deadlineB
        default:
          return 0
      }
    })

  // Calculate pagination
  const totalPages = Math.ceil(filteredOrders.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const currentOrders = filteredOrders.slice(startIndex, endIndex)

  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [search, statusFilter, sortBy, dateFilter])

  const translateStatus = (state) => {
    switch (state.toLowerCase().replace(/\s+/g, "_")) {
      case "pending":
        return "Proses"
      case "completed":
        return "Selesai"
      case "overdue":
        return "Melewati Deadline"
      case "completed_but_overdue":
        return "Selesai Terlambat"
      default:
        return state
    }
  }

  useEffect(() => {
    const fetchMyOrders = async () => {
      try {
        const res = await axios.get("/users/orders")
        // Keep the original state format from backend
        setOrders(res.data)
      } catch (err) {
        console.error("Failed to fetch user orders", err)
      } finally {
        setLoading(false)
      }
    }

    fetchMyOrders()
  }, [])

  const getTimeLeft = (createdAt) => {
    const created = new Date(createdAt)
    const deadline = new Date(created.getTime() + 2 * 60 * 60 * 1000) // +2 hours
    const now = new Date()
    const diff = deadline - now

    if (diff <= 0) return "Melewati Batas"

    const mins = Math.floor((diff / 1000 / 60) % 60)
    const hrs = Math.floor(diff / 1000 / 60 / 60)
    return `Sisa ${hrs} jam ${mins} menit`
  }

  const getStats = () => {
    const total = orders.length
    const pending = orders.filter((o) => o.state === "pending").length
    const completed = orders.filter((o) => o.state === "completed").length
    const overdue = orders.filter((o) => o.state === "overdue").length
    const completed_but_overdue = orders.filter((o) => o.state === "completed but overdue").length
    return { total, pending, completed, overdue, completed_but_overdue }
  }

  // Pagination component
  const Pagination = () => {
    if (totalPages <= 1) return null

    const getPageNumbers = () => {
      const pages = []
      const maxVisiblePages = 5

      if (totalPages <= maxVisiblePages) {
        for (let i = 1; i <= totalPages; i++) {
          pages.push(i)
        }
      } else {
        if (currentPage <= 3) {
          for (let i = 1; i <= 4; i++) {
            pages.push(i)
          }
          pages.push("...")
          pages.push(totalPages)
        } else if (currentPage >= totalPages - 2) {
          pages.push(1)
          pages.push("...")
          for (let i = totalPages - 3; i <= totalPages; i++) {
            pages.push(i)
          }
        } else {
          pages.push(1)
          pages.push("...")
          for (let i = currentPage - 1; i <= currentPage + 1; i++) {
            pages.push(i)
          }
          pages.push("...")
          pages.push(totalPages)
        }
      }

      return pages
    }

    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          gap: "0.5rem",
          marginTop: "2rem",
          flexWrap: "wrap",
        }}
      >
        <button
          onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
          disabled={currentPage === 1}
          style={{
            padding: "0.5rem 1rem",
            fontSize: "0.875rem",
            border: "1px solid var(--border-primary)",
            backgroundColor: currentPage === 1 ? "var(--bg-secondary)" : "var(--bg-primary)",
            color: currentPage === 1 ? "var(--text-muted)" : "var(--text-primary)",
            cursor: currentPage === 1 ? "not-allowed" : "pointer",
            borderRadius: "4px",
          }}
        >
          Sebelumnya
        </button>

        {getPageNumbers().map((page, index) =>
          page === "..." ? (
            <span key={index} style={{ padding: "0.5rem", color: "var(--text-muted)" }}>
              ...
            </span>
          ) : (
            <button
              key={index}
              onClick={() => setCurrentPage(page)}
              style={{
                padding: "0.5rem 0.75rem",
                fontSize: "0.875rem",
                border: "1px solid var(--border-primary)",
                backgroundColor: currentPage === page ? "var(--info)" : "var(--bg-primary)",
                color: currentPage === page ? "white" : "var(--text-primary)",
                cursor: "pointer",
                borderRadius: "4px",
                fontWeight: currentPage === page ? "bold" : "normal",
              }}
            >
              {page}
            </button>
          ),
        )}

        <button
          onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
          disabled={currentPage === totalPages}
          style={{
            padding: "0.5rem 1rem",
            fontSize: "0.875rem",
            border: "1px solid var(--border-primary)",
            backgroundColor: currentPage === totalPages ? "var(--bg-secondary)" : "var(--bg-primary)",
            color: currentPage === totalPages ? "var(--text-muted)" : "var(--text-primary)",
            cursor: currentPage === totalPages ? "not-allowed" : "pointer",
            borderRadius: "4px",
          }}
        >
          Berikutnya
        </button>

        <div
          style={{
            marginLeft: "1rem",
            fontSize: "0.875rem",
            color: "var(--text-secondary)",
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
          }}
        >
          <span>
            Menampilkan {startIndex + 1}-{Math.min(endIndex, filteredOrders.length)} dari {filteredOrders.length}
          </span>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="page-container">
        <div className="loading">Loading your orders...</div>
      </div>
    )
  }

  const stats = getStats()

  return (
    <div className="page-container">
      <div className="action-bar">
        <div>
          <h1>Kendala Saya</h1>
          <p className="subtitle">Pantau kendala dan pengajuan bukti</p>
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-value">{stats.total}</div>
          <div className="stat-label">Total Kendala</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.pending}</div>
          <div className="stat-label">Kendala Dalam Proses</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.completed}</div>
          <div className="stat-label">Kendala Sudah Selesai</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.overdue}</div>
          <div className="stat-label">Kendala Dalam Proses Tapi Melewati Deadline</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.completed_but_overdue}</div>
          <div className="stat-label">Kendala Sudah Selesai Tapi Melewati Deadline</div>
        </div>
      </div>

      {/* Filter Controls - 4 Rows */}
      <div style={{ marginBottom: "1.5rem" }}>
        {/* Row 1: Status Filter */}
        <div style={{ marginBottom: "1rem" }}>
          <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "500" }}>Filter Status:</label>
          <select className="filter-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="all">Semua Status</option>
            <option value="pending">Proses</option>
            <option value="completed">Selesai</option>
            <option value="overdue">Melewati Deadline</option>
            <option value="completed but overdue">Selesai Terlambat</option>
          </select>
        </div>

        {/* Row 2: Date Filter */}
        <div style={{ marginBottom: "1rem" }}>
          <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "500" }}>
            Filter Bulan ({currentYear}):
          </label>
          <select className="filter-select" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)}>
            <option value="all">Semua Bulan</option>
            {monthNames.map((month, index) => (
              <option key={index} value={index}>
                {month} {currentYear}
              </option>
            ))}
          </select>
        </div>

        {/* Row 3: Sort Options */}
        <div style={{ marginBottom: "1rem" }}>
          <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "500" }}>Urutkan:</label>
          <select className="filter-select" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
            <option value="newest">Terbaru</option>
            <option value="oldest">Terlama</option>
            <option value="title">Judul A-Z</option>
            <option value="status">Status</option>
            <option value="deadline">Deadline</option>
          </select>
        </div>

        {/* Row 4: Search */}
        <div>
          <input
            type="text"
            className="search-input"
            placeholder="Cari judul, deskripsi, TID, atau lokasi..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: "100%" }}
          />
        </div>
      </div>

      {orders.length === 0 ? (
        <div className="card text-center">
          <h3>Tidak ada kendala</h3>
          <p className="text-muted">Anda belum diberikan kendala pada saat ini.</p>
        </div>
      ) : (
        <div>
          <div className="order-list">
            {currentOrders.map((order) => {
              const state = order.state

              return (
                <div key={order.id} className={`order-card ${state}`}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      marginBottom: "1rem",
                    }}
                  >
                    <div>
                      <h3>{order.title}</h3>
                      {order.reference_data && (
                        <div style={{ fontSize: "0.875rem", color: "#64748b", marginTop: "0.25rem" }}>
                          <strong>TID:</strong> {order.reference_data.tid} |<strong> Lokasi:</strong>{" "}
                          {order.reference_data.lokasi} |<strong> KC:</strong> {order.reference_data.kc_supervisi}
                        </div>
                      )}
                    </div>
                    <span className={`order-status status-${state}`}>{translateStatus(state)}</span>
                  </div>

                  <p style={{ marginBottom: "1.5rem", color: "#64748b" }}>{order.description}</p>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                      gap: "1rem",
                      marginBottom: "1.5rem",
                      fontSize: "0.875rem",
                    }}
                  >
                    <div>
                      <strong>Dibuat:</strong>
                      <br />
                      <span className="text-muted">{new Date(order.created_at).toLocaleString()}</span>
                    </div>

                    {(state === "pending" || state === "overdue") && (
                      <div>
                        <strong>Deadline:</strong>
                        <br />
                        <span
                          style={{
                            color: getTimeLeft(order.created_at).includes("Melewati Batas") ? "#dc2626" : "#059669",
                          }}
                        >
                          {getTimeLeft(order.created_at)}
                        </span>
                      </div>
                    )}

                    {(state === "completed" || state === "completed but overdue") && (
                      <div>
                        <strong>{translateStatus(state)}:</strong>
                        <br />
                        {order.completed_at ? (
                          <span className="text-muted">{new Date(order.completed_at).toLocaleString()}</span>
                        ) : (
                          <span className="text-muted">N/A</span>
                        )}
                        {order.overdue_duration && (
                          <div style={{ color: "#dc2626", fontSize: "0.75rem", marginTop: "0.25rem" }}>
                            {order.overdue_duration}
                          </div>
                        )}
                      </div>
                    )}

                    <div>
                      <strong>File Pengajuan:</strong>
                      <br />
                      {order.image_url ? (
                        <a href={order.image_url} target="_blank" rel="noreferrer">
                          Lihat File
                        </a>
                      ) : (
                        <span className="text-muted">Kosong</span>
                      )}
                    </div>
                    <div>
                      <strong>Info Foto:</strong>
                      <br />
                      {order.image_url_new ? (
                        <a href={order.image_url_new} target="_blank" rel="noreferrer">
                          Lihat Foto
                        </a>
                      ) : (
                        <span className="text-muted">Kosong</span>
                      )}
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
                    {(state === "pending" || state === "overdue") && (
                      <Link to={`/user/orders/${order.id}/submit`}>
                        <button>Submit File</button>
                      </Link>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          <Pagination />
        </div>
      )}
    </div>
  )
}
