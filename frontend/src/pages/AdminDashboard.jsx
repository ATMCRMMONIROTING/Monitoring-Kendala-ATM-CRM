"use client"

import { useEffect, useState, useContext } from "react"
import axios from "../api/axios"
import { AuthContext } from "../context/AuthContext"
import * as XLSX from "xlsx"
import { saveAs } from "file-saver"

export default function AdminDashboard() {
  const { logout } = useContext(AuthContext)
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [bulkFile, setBulkFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [selectedTidData, setSelectedTidData] = useState(null)

  // Add state for batch delete
  const [selectedOrders, setSelectedOrders] = useState(new Set())
  const [isDeleting, setIsDeleting] = useState(false)

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

  // Pagination state for frequent TIDs
  const [tidCurrentPage, setTidCurrentPage] = useState(1)
  const tidItemsPerPage = 8

  // Add pagination state for filteredOrders table
  // Add these lines after the existing pagination state for TIDs
  const [ordersCurrentPage, setOrdersCurrentPage] = useState(1)
  const ordersPerPage = 10

  // Helper function to normalize state values - more aggressive version
  const normalizeState = (state) => {
    if (!state) return ""
    if (typeof state !== "string") return ""

    // Convert to lowercase and trim whitespace
    const normalized = state.toLowerCase().trim()

    // Special handling for completed_but_overdue with various formats
    if (
      normalized === "completed_but_overdue" ||
      normalized === "completed but overdue" ||
      normalized === "completedbutoverdue" ||
      normalized === "completed-but-overdue" ||
      normalized === "completed_butoverdue" ||
      normalized === "completed_but_overdue " || // trailing space
      normalized === " completed_but_overdue" || // leading space
      (normalized.includes("completed") && normalized.includes("overdue"))
    ) {
      console.log(`Normalized state "${state}" to "completed_but_overdue"`)
      return "completed_but_overdue"
    }

    return normalized
  }

  // Helper function to check if an order is completed but overdue - more aggressive version
  const isCompletedButOverdue = (order) => {
    if (!order) return false

    // Check the normalized state
    const state = normalizeState(order.state)
    if (state === "completed_but_overdue") return true

    // Additional checks for completed_but_overdue
    if (order.state && typeof order.state === "object") {
      console.log("Found state as object:", order.state)
      // Try to extract state from object if possible
      if (order.state.status && typeof order.state.status === "string") {
        return normalizeState(order.state.status) === "completed_but_overdue"
      }
    }

    // Check if there are other properties that might indicate completed_but_overdue
    if (order.completed_at && order.overdue) {
      console.log("Detected completed_but_overdue from properties: completed_at exists and overdue=true")
      return true
    }

    return false
  }

  // Helper function to check if an order is overdue
  const isOverdue = (order) => {
    const state = normalizeState(order.state)
    return state === "overdue"
  }

  // Helper function to check if an order is either overdue or completed_but_overdue
  const isAnyOverdue = (order) => {
    return isOverdue(order) || isCompletedButOverdue(order)
  }

  // Function to extract all completed_but_overdue orders
  const getCompletedButOverdueOrders = () => {
    const completedButOverdueOrders = orders.filter((order) => {
      const isOverdue = isCompletedButOverdue(order)
      if (isOverdue && order.reference_data?.tid) {
        console.log(`Found completed_but_overdue order with TID ${order.reference_data.tid}:`, order)
        return true
      }
      return false
    })

    console.log(`Found ${completedButOverdueOrders.length} completed_but_overdue orders with TIDs`)
    return completedButOverdueOrders
  }

  const exportToExcel = () => {
    // Map the filteredOrders to a flat array of objects for Excel export
    const exportData = orders.map((order) => ({
      TID: order.reference_data?.tid || "—",
      Lokasi: order.reference_data?.lokasi || "—",
      KC_Supervisi: order.reference_data?.kc_supervisi || "—",
      Pengelola: order.username,
      Judul: order.title,
      Deskripsi: order.description,
      Status: translateStatus(order.state),
      Dibuat: new Date(order.created_at).toLocaleString(),
      Foto_Informasi: order.image_url_new ? order.image_url_new : "Kosong",
      Hasil_Submit: order.image_url ? order.image_url : "Kosong",
      Diselesaikan: order.completed_at ? new Date(order.completed_at).toLocaleString() : "—",
      Deadline: (() => {
        if (order.overdue_duration) return order.overdue_duration
        if (order.state === "completed") {
          const createdAt = new Date(order.created_at)
          const deadline = new Date(createdAt.getTime() + 2 * 60 * 60 * 1000)
          const completedAt = new Date(order.completed_at)
          return completedAt <= deadline ? "Sesuai SLA" : "Melewati SLA"
        } else if (order.state === "pending" || order.state === "overdue") {
          const createdAt = new Date(order.created_at)
          const deadline = new Date(createdAt.getTime() + 2 * 60 * 60 * 1000)
          const now = new Date()
          const diff = deadline - now
          if (diff > 0) {
            const hours = Math.floor(diff / (1000 * 60 * 60))
            const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
            return `sisa ${hours} jam ${minutes} menit`
          } else {
            const overdueMillis = Math.abs(diff)
            const hours = Math.floor(overdueMillis / (1000 * 60 * 60))
            const minutes = Math.floor((overdueMillis % (1000 * 60 * 60)) / (1000 * 60))
            return `lewat ${hours} jam ${minutes} menit`
          }
        }
        return "—"
      })(),
    }))

    // Create a new workbook and worksheet
    const worksheet = XLSX.utils.json_to_sheet(exportData)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, "Kendala")

    // Write workbook to binary string
    const wbout = XLSX.write(workbook, { bookType: "xlsx", type: "array" })

    // Save file
    saveAs(new Blob([wbout], { type: "application/octet-stream" }), "kendala_export.xlsx")
  }

  // Completely rewritten getFrequentTids function
  const getFrequentTids = () => {
    // First, filter out orders without TIDs and those that aren't overdue or completed_but_overdue
    const relevantOrders = orders.filter((order) => {
      return order.reference_data?.tid && isAnyOverdue(order)
    })

    console.log(`Found ${relevantOrders.length} relevant orders for TID analysis`)

    // Group orders by month and TID
    const groupedOrders = {}

    relevantOrders.forEach((order) => {
      const orderDate = new Date(order.created_at)
      const monthKey = `${orderDate.getFullYear()}-${orderDate.getMonth()}`
      const tid = order.reference_data.tid

      // Initialize month if needed
      if (!groupedOrders[monthKey]) {
        groupedOrders[monthKey] = {}
      }

      // Initialize TID if needed
      if (!groupedOrders[monthKey][tid]) {
        groupedOrders[monthKey][tid] = {
          orders: [],
          overdue: 0,
          completed_but_overdue: 0,
        }
      }

      // Add order to the appropriate group
      groupedOrders[monthKey][tid].orders.push(order)

      // Increment the appropriate counter
      if (isOverdue(order)) {
        groupedOrders[monthKey][tid].overdue++
      } else if (isCompletedButOverdue(order)) {
        groupedOrders[monthKey][tid].completed_but_overdue++
      }
    })

    // Convert grouped data to array format
    const frequentTids = []

    Object.entries(groupedOrders).forEach(([monthKey, tidGroups]) => {
      Object.entries(tidGroups).forEach(([tid, data]) => {
        const totalCount = data.overdue + data.completed_but_overdue

        // Only include TIDs with more than 2 occurrences
        if (totalCount > 2) {
          const [year, month] = monthKey.split("-")
          const monthName = new Date(Number.parseInt(year), Number.parseInt(month)).toLocaleDateString("id-ID", {
            month: "long",
            year: "numeric",
          })

          frequentTids.push({
            tid,
            count: totalCount,
            monthKey,
            monthName,
            orders: data.orders,
            stateBreakdown: {
              overdue: data.overdue,
              completed_but_overdue: data.completed_but_overdue,
            },
          })

          console.log(
            `TID ${tid} in ${monthName}: overdue=${data.overdue}, completed_but_overdue=${data.completed_but_overdue}, total=${totalCount}`,
          )
        }
      })
    })

    return frequentTids.sort((a, b) => b.count - a.count)
  }

  // Completely rewritten generateDailyData function
  const generateDailyData = (orders, monthKey) => {
    console.log(`Generating daily data for ${monthKey} with ${orders.length} orders`)

    // Split the month key to get year and month
    const [year, month] = monthKey.split("-")
    const yearNum = Number.parseInt(year)
    const monthNum = Number.parseInt(month)

    // Calculate days in month
    const daysInMonth = new Date(yearNum, monthNum + 1, 0).getDate()

    // Initialize daily counts for both types of orders
    const dailyOverdue = Array(daysInMonth).fill(0)
    const dailyCompletedButOverdue = Array(daysInMonth).fill(0)

    // Count orders by day
    orders.forEach((order, index) => {
      try {
        const orderDate = new Date(order.created_at)
        const orderDay = orderDate.getDate() - 1 // 0-indexed

        // Make sure the day is valid
        if (orderDay >= 0 && orderDay < daysInMonth) {
          if (isOverdue(order)) {
            dailyOverdue[orderDay]++
            console.log(`Order ${index} (${order.state}) counted as overdue on day ${orderDay + 1}`)
          } else if (isCompletedButOverdue(order)) {
            dailyCompletedButOverdue[orderDay]++
            console.log(`Order ${index} (${order.state}) counted as completed_but_overdue on day ${orderDay + 1}`)
          } else {
            console.log(`Order ${index} (${order.state}) not counted - not overdue or completed_but_overdue`)
          }
        } else {
          console.error(`Invalid day calculated: ${orderDay} for date ${orderDate}`)
        }
      } catch (error) {
        console.error(`Error processing order ${index}:`, error)
      }
    })

    // Combine the counts
    const dailyData = Array(daysInMonth)
      .fill(0)
      .map((_, index) => ({
        day: index + 1,
        count: dailyOverdue[index] + dailyCompletedButOverdue[index],
        overdue: dailyOverdue[index],
        completed_but_overdue: dailyCompletedButOverdue[index],
      }))

    console.log("Generated daily data:", dailyData)
    return dailyData
  }

  // Function to get TID information from orders
  const getTidInfo = (orders) => {
    if (orders.length === 0) return null

    // Get info from the first order (they should all have the same TID info)
    const firstOrder = orders[0]
    const pengelola = [...new Set(orders.map((order) => order.username))].join(", ")

    return {
      lokasi: firstOrder.reference_data?.lokasi || "—",
      pengelola: pengelola || "—",
      kc_supervisi: firstOrder.reference_data?.kc_supervisi || "—",
    }
  }

  // Completely rewritten LineChart component
  const LineChart = ({ data, tid, monthName, orders }) => {
    console.log("LineChart rendering with data:", data)
    console.log("LineChart orders:", orders)

    // Count orders by state
    const overdueCount = orders.filter((o) => isOverdue(o)).length
    const completedButOverdueCount = orders.filter((o) => isCompletedButOverdue(o)).length

    console.log(`Chart orders breakdown: overdue=${overdueCount}, completed_but_overdue=${completedButOverdueCount}`)

    const maxCount = Math.max(...data.map((d) => d.count), 1)
    const chartWidth = 600
    const chartHeight = 250
    const padding = 50

    const xScale = (day) => ((day - 1) / (data.length - 1)) * (chartWidth - 2 * padding) + padding
    const yScale = (count) => chartHeight - padding - (count / maxCount) * (chartHeight - 2 * padding)

    // Create path data only for points with occurrences (count > 0)
    const pointsWithOccurrences = data.filter((d) => d.count > 0)
    const pathData = pointsWithOccurrences
      .map((d, i) => `${i === 0 ? "M" : "L"} ${xScale(d.day)} ${yScale(d.count)}`)
      .join(" ")

    // Find days with occurrences to label on x-axis
    const daysWithOccurrences = data.filter((d) => d.count > 0).map((d) => d.day)

    // Get TID information
    const tidInfo = getTidInfo(orders)

    return (
      <div
        style={{
          marginTop: "1rem",
          padding: "1.5rem",
          border: "1px solid var(--border-primary)",
          borderRadius: "8px",
          backgroundColor: "var(--bg-secondary)",
        }}
      >
        <div style={{ marginBottom: "1rem" }}>
          <h4 style={{ marginBottom: "0.5rem", fontSize: "1.1rem" }}>
            TID: {tid} - {monthName}
          </h4>
          {tidInfo && (
            <div
              style={{
                fontSize: "0.875rem",
                color: "var(--text-secondary)",
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                gap: "1rem",
                padding: "0.75rem",
                backgroundColor: "var(--bg-tertiary)",
                borderRadius: "6px",
                border: "1px solid var(--border-secondary)",
              }}
            >
              <div>
                <strong>Lokasi:</strong> {tidInfo.lokasi}
              </div>
              <div>
                <strong>Pengelola:</strong> {tidInfo.pengelola}
              </div>
              <div>
                <strong>KC Supervisi:</strong> {tidInfo.kc_supervisi}
              </div>
            </div>
          )}
        </div>

        {/* Add a breakdown of the orders by state */}
        <div
          style={{
            marginBottom: "1rem",
            padding: "0.75rem",
            backgroundColor: "var(--bg-tertiary)",
            borderRadius: "6px",
          }}
        >
          <h5 style={{ marginBottom: "0.5rem", fontSize: "0.9rem" }}>Rincian Status Kendala:</h5>
          <div style={{ display: "flex", gap: "1rem" }}>
            <div>
              <span
                style={{
                  display: "inline-block",
                  width: "12px",
                  height: "12px",
                  backgroundColor: "var(--danger)",
                  borderRadius: "50%",
                  marginRight: "6px",
                }}
              ></span>
              <span>Melewati SLA: {overdueCount}</span>
            </div>
            <div>
              <span
                style={{
                  display: "inline-block",
                  width: "12px",
                  height: "12px",
                  backgroundColor: "var(--warning)",
                  borderRadius: "50%",
                  marginRight: "6px",
                }}
              ></span>
              <span>Selesai Terlambat: {completedButOverdueCount}</span>
            </div>
          </div>
        </div>

        <div style={{ overflowX: "auto" }}>
          <svg width={chartWidth} height={chartHeight}>
            {/* Background grid */}
            {Array.from({ length: 6 }).map((_, i) => (
              <line
                key={`grid-y-${i}`}
                x1={padding}
                y1={padding + (i * (chartHeight - 2 * padding)) / 5}
                x2={chartWidth - padding}
                y2={padding + (i * (chartHeight - 2 * padding)) / 5}
                stroke="var(--border-secondary)"
                strokeWidth="1"
                strokeDasharray="4,4"
              />
            ))}

            {/* Vertical grid lines only for days with occurrences */}
            {daysWithOccurrences.map((day) => (
              <line
                key={`grid-x-${day}`}
                x1={xScale(day)}
                y1={padding}
                x2={xScale(day)}
                y2={chartHeight - padding}
                stroke="var(--border-secondary)"
                strokeWidth="1"
                strokeDasharray="4,4"
              />
            ))}

            {/* X-axis */}
            <line
              x1={padding}
              y1={chartHeight - padding}
              x2={chartWidth - padding}
              y2={chartHeight - padding}
              stroke="var(--text-secondary)"
              strokeWidth="2"
            />

            {/* Y-axis */}
            <line
              x1={padding}
              y1={padding}
              x2={padding}
              y2={chartHeight - padding}
              stroke="var(--text-secondary)"
              strokeWidth="2"
            />

            {/* X-axis labels - only show dates with occurrences */}
            {daysWithOccurrences.map((day) => (
              <g key={`x-label-${day}`}>
                <line
                  x1={xScale(day)}
                  y1={chartHeight - padding}
                  x2={xScale(day)}
                  y2={chartHeight - padding + 5}
                  stroke="var(--text-secondary)"
                  strokeWidth="2"
                />
                <text
                  x={xScale(day)}
                  y={chartHeight - padding + 20}
                  textAnchor="middle"
                  fill="var(--text-secondary)"
                  fontSize="12"
                  fontWeight="bold"
                >
                  {day}
                </text>
              </g>
            ))}

            {/* X-axis title */}
            <text
              x={chartWidth / 2}
              y={chartHeight - 10}
              textAnchor="middle"
              fill="var(--text-secondary)"
              fontSize="14"
            >
              Tanggal
            </text>

            {/* Line connecting only points with occurrences */}
            {pointsWithOccurrences.length > 1 && (
              <path
                d={pathData}
                fill="none"
                stroke="var(--info)"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}

            {/* Data points - only show points with occurrences */}
            {pointsWithOccurrences.map((d) => (
              <g key={`point-${d.day}`}>
                <circle
                  cx={xScale(d.day)}
                  cy={yScale(d.count)}
                  r="6"
                  fill="var(--info)"
                  stroke="white"
                  strokeWidth="2"
                />
                <text
                  x={xScale(d.day)}
                  y={yScale(d.count) - 10}
                  textAnchor="middle"
                  fill="var(--text-primary)"
                  fontSize="12"
                  fontWeight="bold"
                >
                  {d.count}
                </text>
              </g>
            ))}
          </svg>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "1rem" }}>
          <p style={{ fontSize: "0.875rem", color: "var(--text-muted)" }}>
            Total kejadian: {data.reduce((sum, d) => sum + d.count, 0)} kali dalam bulan {monthName}
          </p>
          <button onClick={() => setSelectedTidData(null)} style={{ fontSize: "0.875rem", padding: "0.5rem 1rem" }}>
            Tutup Grafik
          </button>
        </div>
      </div>
    )
  }

  const filteredOrders = orders
    .filter((order) => {
      // Search filter
      const matchSearch =
        order.title.toLowerCase().includes(search.toLowerCase()) ||
        order.description.toLowerCase().includes(search.toLowerCase()) ||
        (order.reference_data?.tid || "").toLowerCase().includes(search.toLowerCase()) ||
        (order.reference_data?.lokasi || "").toLowerCase().includes(search.toLowerCase()) ||
        (order.reference_data?.pengelola || "")
          .toLowerCase()
          .replace(/\s+/g, "")
          .includes(search.toLowerCase().replace(/\s+/g, ""))

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
            if (order.state === "completed" || order.state === "completed_but_overdue") return 3
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

  // Add this after the filteredOrders definition but before the translateStatus function
  // Calculate pagination for orders table
  const ordersTotalPages = Math.ceil(filteredOrders.length / ordersPerPage)
  const ordersStartIndex = (ordersCurrentPage - 1) * ordersPerPage
  const ordersEndIndex = ordersStartIndex + ordersPerPage
  const currentPageOrders = filteredOrders.slice(ordersStartIndex, ordersEndIndex)

  const translateStatus = (state) => {
    switch (normalizeState(state)) {
      case "pending":
        return "Proses"
      case "completed":
        return "Selesai"
      case "overdue":
        return "Melewati SLA"
      case "completed_but_overdue":
        return "Selesai Terlambat"
      default:
        return state
    }
  }

  const fetchOrders = async () => {
    try {
      const res = await axios.get("/admin/orders")

      // Log the raw response to see what we're getting
      console.log("Raw orders response:", res.data)

      // Check for completed_but_overdue orders in the raw data
      const completedButOverdueCount = res.data.filter(
        (order) => normalizeState(order.state) === "completed_but_overdue",
      ).length

      console.log(`Found ${completedButOverdueCount} completed_but_overdue orders in raw API response`)

      setOrders(res.data)
    } catch (err) {
      if (err.response?.status === 401) logout()
      else alert("Failed to fetch orders")
    } finally {
      setLoading(false)
    }
  }

  // Debug function to check raw state values
  const debugRawStateValues = () => {
    console.log("=== DEBUGGING RAW STATE VALUES ===")
    const stateValues = new Set()
    orders.forEach((order) => {
      if (order.state) {
        stateValues.add(String(order.state))
      }
    })

    console.log("Unique state values found:", Array.from(stateValues))
    console.log("=== END DEBUGGING RAW STATE VALUES ===")
  }

  // Add a debug log to help identify any issues with state values
  const debugOrderStates = () => {
    console.log("Debugging order states:")
    const stateCount = {}
    orders.forEach((order) => {
      const state = normalizeState(order.state)
      stateCount[state] = (stateCount[state] || 0) + 1
    })
    console.log("State counts:", stateCount)

    // Log orders with completed_but_overdue state
    const completedButOverdueOrders = orders.filter((o) => normalizeState(o.state) === "completed_but_overdue")
    console.log(`Found ${completedButOverdueOrders.length} completed_but_overdue orders`)

    if (completedButOverdueOrders.length > 0) {
      console.log("Sample completed_but_overdue order:", completedButOverdueOrders[0])
    }
  }

  // Batch delete function
  const handleBatchDelete = async () => {
    if (selectedOrders.size === 0) {
      alert("Pilih minimal satu kendala untuk dihapus")
      return
    }

    const orderIds = Array.from(selectedOrders)
    const confirmMessage = `Apa anda yakin untuk menghapus ${orderIds.length} kendala yang dipilih? Tindakan ini tidak dapat dibatalkan.`

    if (!confirm(confirmMessage)) return

    setIsDeleting(true)
    try {
      // Send the request with the correct format for FastAPI
      const response = await axios.delete("/admin/orders/batch-delete", {
        data: orderIds, // Send the array directly, not wrapped in an object
        headers: {
          "Content-Type": "application/json",
        },
      })

      // Remove deleted orders from state
      setOrders((prev) => prev.filter((order) => !selectedOrders.has(order.id)))
      setSelectedOrders(new Set())

      alert(`${orderIds.length} kendala berhasil dihapus`)
    } catch (err) {
      console.error("Batch delete error:", err)
      console.error("Error response:", err.response?.data)

      // More detailed error handling
      if (err.response?.status === 422) {
        alert("Format data tidak valid. Silakan coba lagi.")
      } else if (err.response?.status === 403) {
        alert("Anda tidak memiliki izin untuk menghapus kendala.")
      } else if (err.response?.status === 500) {
        alert("Terjadi kesalahan server. Beberapa file mungkin tidak dapat dihapus dari Google Drive.")
      } else {
        alert("Gagal menghapus kendala: " + (err.response?.data?.detail || err.message))
      }
    } finally {
      setIsDeleting(false)
    }
  }

  // Handle individual checkbox change
  const handleOrderSelect = (orderId) => {
    const newSelected = new Set(selectedOrders)
    if (newSelected.has(orderId)) {
      newSelected.delete(orderId)
    } else {
      newSelected.add(orderId)
    }
    setSelectedOrders(newSelected)
  }

  // Handle select all checkbox
  const handleSelectAll = () => {
    if (selectedOrders.size === currentPageOrders.length) {
      // If all current page orders are selected, deselect all
      setSelectedOrders(new Set())
    } else {
      // Select all current page orders
      const newSelected = new Set(currentPageOrders.map((order) => order.id))
      setSelectedOrders(newSelected)
    }
  }

  const deleteOrder = async (id) => {
    if (!confirm("Apa anda yakin untuk menghapus kendala ini?")) return
    try {
      await axios.delete(`/admin/orders/${id}`)
      setOrders((prev) => prev.filter((order) => order.id !== id))
    } catch (err) {
      alert("kendala gagal untuk dihapus.")
    }
  }

  const handleBulkUpload = async (e) => {
    e.preventDefault()
    if (!bulkFile) return alert("Pilih file Excel terlebih dahulu")

    setUploading(true)
    const formData = new FormData()
    formData.append("file", bulkFile)

    try {
      const res = await axios.post("/admin/orders/bulk-upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      })
      alert(res.data.detail)
      setBulkFile(null)
      fetchOrders() // Refresh orders
    } catch (err) {
      alert("Bulk upload gagal: " + (err.response?.data?.detail || err.message))
    } finally {
      setUploading(false)
    }
  }

  // Call this function after orders are fetched
  useEffect(() => {
    fetchOrders()
  }, [])

  // Add another useEffect to debug when orders are updated
  useEffect(() => {
    if (orders.length > 0) {
      console.log("Orders updated, current count:", orders.length)
      debugOrderStates()
      debugRawStateValues() // Add this line

      // Check if we have any completed_but_overdue orders
      const completedButOverdueOrders = orders.filter((o) => isCompletedButOverdue(o))
      if (completedButOverdueOrders.length > 0) {
        console.log(`Found ${completedButOverdueOrders.length} completed_but_overdue orders in state`)
        console.log("Sample completed_but_overdue order:", completedButOverdueOrders[0])
      } else {
        console.warn("No completed_but_overdue orders found in state!")
      }
    }
  }, [orders])

  const getStats = () => {
    const total = orders.length
    const pending = orders.filter((o) => normalizeState(o.state) === "pending").length
    const completed = orders.filter((o) => normalizeState(o.state) === "completed").length
    const overdue = orders.filter((o) => normalizeState(o.state) === "overdue").length
    const completed_but_overdue = orders.filter((o) => normalizeState(o.state) === "completed_but_overdue").length
    return { total, pending, completed, overdue, completed_but_overdue }
  }

  // Pagination for frequent TIDs
  const frequentTids = getFrequentTids()
  const tidTotalPages = Math.ceil(frequentTids.length / tidItemsPerPage)
  const tidStartIndex = (tidCurrentPage - 1) * tidItemsPerPage
  const tidEndIndex = tidStartIndex + tidItemsPerPage
  const currentTids = frequentTids.slice(tidStartIndex, tidEndIndex)

  // TID Pagination component
  const TidPagination = () => {
    if (tidTotalPages <= 1) return null

    const getPageNumbers = () => {
      const pages = []
      const maxVisiblePages = 5

      if (tidTotalPages <= maxVisiblePages) {
        for (let i = 1; i <= tidTotalPages; i++) {
          pages.push(i)
        }
      } else {
        if (tidCurrentPage <= 3) {
          for (let i = 1; i <= 4; i++) {
            pages.push(i)
          }
          pages.push("...")
          pages.push(tidTotalPages)
        } else if (tidCurrentPage >= tidTotalPages - 2) {
          pages.push(1)
          pages.push("...")
          for (let i = tidTotalPages - 3; i <= tidTotalPages; i++) {
            pages.push(i)
          }
        } else {
          pages.push(1)
          pages.push("...")
          for (let i = tidCurrentPage - 1; i <= tidCurrentPage + 1; i++) {
            pages.push(i)
          }
          pages.push("...")
          pages.push(tidTotalPages)
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
          marginTop: "1.5rem",
          flexWrap: "wrap",
        }}
      >
        <button
          onClick={() => setTidCurrentPage((prev) => Math.max(prev - 1, 1))}
          disabled={tidCurrentPage === 1}
          style={{
            padding: "0.5rem 1rem",
            fontSize: "0.875rem",
            border: "1px solid var(--border-primary)",
            backgroundColor: tidCurrentPage === 1 ? "var(--bg-secondary)" : "var(--bg-primary)",
            color: tidCurrentPage === 1 ? "var(--text-muted)" : "var(--text-primary)",
            cursor: tidCurrentPage === 1 ? "not-allowed" : "pointer",
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
              onClick={() => setTidCurrentPage(page)}
              style={{
                padding: "0.5rem 0.75rem",
                fontSize: "0.875rem",
                border: "1px solid var(--border-primary)",
                backgroundColor: tidCurrentPage === page ? "var(--info)" : "var(--bg-primary)",
                color: tidCurrentPage === page ? "white" : "var(--text-primary)",
                cursor: "pointer",
                borderRadius: "4px",
                fontWeight: tidCurrentPage === page ? "bold" : "normal",
              }}
            >
              {page}
            </button>
          ),
        )}

        <button
          onClick={() => setTidCurrentPage((prev) => Math.min(prev + 1, tidTotalPages))}
          disabled={tidCurrentPage === tidTotalPages}
          style={{
            padding: "0.5rem 1rem",
            fontSize: "0.875rem",
            border: "1px solid var(--border-primary)",
            backgroundColor: tidCurrentPage === tidTotalPages ? "var(--bg-secondary)" : "var(--bg-primary)",
            color: tidCurrentPage === tidTotalPages ? "var(--text-muted)" : "var(--text-primary)",
            cursor: tidCurrentPage === tidTotalPages ? "not-allowed" : "pointer",
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
            Tampil {tidStartIndex + 1}-{Math.min(tidEndIndex, frequentTids.length)} dari {frequentTids.length}
          </span>
        </div>
      </div>
    )
  }

  // Add this OrdersPagination component after the TidPagination component
  const OrdersPagination = () => {
    if (ordersTotalPages <= 1) return null

    const getPageNumbers = () => {
      const pages = []
      const maxVisiblePages = 5

      if (ordersTotalPages <= maxVisiblePages) {
        for (let i = 1; i <= ordersTotalPages; i++) {
          pages.push(i)
        }
      } else {
        if (ordersCurrentPage <= 3) {
          for (let i = 1; i <= 4; i++) {
            pages.push(i)
          }
          pages.push("...")
          pages.push(ordersTotalPages)
        } else if (ordersCurrentPage >= ordersTotalPages - 2) {
          pages.push(1)
          pages.push("...")
          for (let i = ordersTotalPages - 3; i <= ordersTotalPages; i++) {
            pages.push(i)
          }
        } else {
          pages.push(1)
          pages.push("...")
          for (let i = ordersCurrentPage - 1; i <= ordersCurrentPage + 1; i++) {
            pages.push(i)
          }
          pages.push("...")
          pages.push(ordersTotalPages)
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
          marginTop: "1.5rem",
          marginBottom: "1rem",
          flexWrap: "wrap",
        }}
      >
        <button
          onClick={() => setOrdersCurrentPage((prev) => Math.max(prev - 1, 1))}
          disabled={ordersCurrentPage === 1}
          style={{
            padding: "0.5rem 1rem",
            fontSize: "0.875rem",
            border: "1px solid var(--border-primary)",
            backgroundColor: ordersCurrentPage === 1 ? "var(--bg-secondary)" : "var(--bg-primary)",
            color: ordersCurrentPage === 1 ? "var(--text-muted)" : "var(--text-primary)",
            cursor: ordersCurrentPage === 1 ? "not-allowed" : "pointer",
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
              onClick={() => setOrdersCurrentPage(page)}
              style={{
                padding: "0.5rem 0.75rem",
                fontSize: "0.875rem",
                border: "1px solid var(--border-primary)",
                backgroundColor: ordersCurrentPage === page ? "var(--info)" : "var(--bg-primary)",
                color: ordersCurrentPage === page ? "white" : "var(--text-primary)",
                cursor: "pointer",
                borderRadius: "4px",
                fontWeight: ordersCurrentPage === page ? "bold" : "normal",
              }}
            >
              {page}
            </button>
          ),
        )}

        <button
          onClick={() => setOrdersCurrentPage((prev) => Math.min(prev + 1, ordersTotalPages))}
          disabled={ordersCurrentPage === ordersTotalPages}
          style={{
            padding: "0.5rem 1rem",
            fontSize: "0.875rem",
            border: "1px solid var(--border-primary)",
            backgroundColor: ordersCurrentPage === ordersTotalPages ? "var(--bg-secondary)" : "var(--bg-primary)",
            color: ordersCurrentPage === ordersTotalPages ? "var(--text-muted)" : "var(--text-primary)",
            cursor: ordersCurrentPage === ordersTotalPages ? "not-allowed" : "pointer",
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
            Tampil {ordersStartIndex + 1}-{Math.min(ordersEndIndex, filteredOrders.length)} dari {filteredOrders.length}
          </span>
        </div>
      </div>
    )
  }

  // Add this useEffect to reset pagination when filters change
  useEffect(() => {
    setOrdersCurrentPage(1)
  }, [search, statusFilter, sortBy, dateFilter])

  if (loading)
    return (
      <div className="page-container">
        <div className="loading">Loading dashboard...</div>
      </div>
    )

  const stats = getStats()

  return (
    <div className="page-container">
      <div className="action-bar">
        <div>
          <h1>Managemen Kendala</h1>
          <p className="subtitle">Pantau dan kelola seluruh kendala ATM dan CRM dalam sistem</p>
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
          <div className="stat-label">Kendala Dalam Proses Tapi Melewati SLA Penanganan Kendala.</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.completed_but_overdue}</div>
          <div className="stat-label">Kendala Sudah Selesai Tapi Melewati SLA Penanganan Kendala.</div>
        </div>
      </div>

      {/* Frequent TIDs Analysis */}
      <div className="card" style={{ marginBottom: "1rem" }}>
        <h3>TID dengan Kendala Berulang yang melewati SLA (&gt;2 kali dalam 1 bulan)</h3>
        {frequentTids.length === 0 ? (
          <p className="text-muted">Tidak ada TID yang mengalami kendala lebih dari 2 kali dalam satu bulan.</p>
        ) : (
          <div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))",
                gap: "1rem",
                marginBottom: "1rem",
              }}
            >
              {currentTids.map((tidData) => {
                const isSelected =
                  selectedTidData &&
                  selectedTidData.tid === tidData.tid &&
                  selectedTidData.monthName === tidData.monthName

                return (
                  <div
                    key={`${tidData.tid}-${tidData.monthKey}`}
                    style={{
                      padding: "1rem",
                      border: `1px solid ${isSelected ? "var(--info)" : "var(--border-primary)"}`,
                      borderRadius: "6px",
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                      backgroundColor: isSelected ? "var(--bg-accent)" : "var(--bg-tertiary)",
                    }}
                    onClick={() => {
                      // Toggle behavior: if this TID is already selected, close it; otherwise, open it
                      if (isSelected) {
                        setSelectedTidData(null)
                      } else {
                        // Debug the orders being passed to generateDailyData
                        console.log(`TID ${tidData.tid} orders:`, tidData.orders)
                        console.log(`TID ${tidData.tid} breakdown:`, tidData.stateBreakdown)

                        const dailyData = generateDailyData(tidData.orders, tidData.monthKey)
                        setSelectedTidData({
                          tid: tidData.tid,
                          monthName: tidData.monthName,
                          dailyData,
                          orders: tidData.orders,
                        })
                      }
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.backgroundColor = "var(--bg-accent)"
                        e.currentTarget.style.borderColor = "var(--info)"
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.backgroundColor = "var(--bg-tertiary)"
                        e.currentTarget.style.borderColor = "var(--border-primary)"
                      }
                    }}
                  >
                    <div style={{ fontWeight: "600", marginBottom: "0.5rem" }}>TID: {tidData.tid}</div>
                    <div style={{ fontSize: "0.875rem", color: "var(--text-secondary)" }}>{tidData.monthName}</div>
                    <div
                      style={{ fontSize: "1.25rem", fontWeight: "700", color: "var(--danger)", marginTop: "0.5rem" }}
                    >
                      {tidData.count} kejadian
                    </div>
                    <div style={{ fontSize: "0.875rem", color: "var(--text-secondary)", marginTop: "0.25rem" }}>
                      <span style={{ display: "inline-block", marginRight: "0.5rem" }}>
                        Melewati SLA: {tidData.stateBreakdown.overdue}
                      </span>
                      <span>Selesai Terlambat: {tidData.stateBreakdown.completed_but_overdue}</span>
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.25rem" }}>
                      {isSelected ? "Klik untuk tutup grafik" : "Klik untuk lihat grafik"}
                    </div>
                  </div>
                )
              })}
            </div>

            <TidPagination />

            {selectedTidData && (
              <LineChart
                data={selectedTidData.dailyData}
                tid={selectedTidData.tid}
                monthName={selectedTidData.monthName}
                orders={selectedTidData.orders}
              />
            )}
          </div>
        )}
      </div>

      {/* Bulk Upload Section */}
      <div className="card" style={{ marginBottom: "1rem" }}>
        <h3>Bulk Upload Kendala</h3>
        <form onSubmit={handleBulkUpload} style={{ display: "flex", gap: "1rem", alignItems: "end" }}>
          <div className="form-group" style={{ flex: 1 }}>
            <label>Upload File Excel</label>
            <input type="file" accept=".xlsx,.xls" onChange={(e) => setBulkFile(e.target.files[0])} />
            <small style={{ color: "#666" }}>Format: TID, Pengelola, Status, Est. Tgl. Problem</small>
          </div>
          <button type="submit" disabled={uploading || !bulkFile}>
            {uploading ? "Uploading..." : "Upload"}
          </button>
        </form>
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
            <option value="completed_but_overdue">Selesai Terlambat</option>
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

        {/* Row 4: Export Button and Search */}
        <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
          <button
            onClick={exportToExcel}
            style={{
              fontSize: "0.875rem",
              padding: "0.5rem 1rem",
              minWidth: "auto",
              width: "auto",
            }}
          >
            Export Excel
          </button>
          <input
            type="text"
            className="search-input"
            placeholder="Cari judul, deskripsi, TID, lokasi, atau pengelola..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ flex: 1 }}
          />
        </div>
      </div>

      {/* Batch Delete Controls */}
      {selectedOrders.size > 0 && (
        <div className="card" style={{ marginBottom: "1rem", backgroundColor: "var(--bg-accent)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <h4 style={{ margin: 0, color: "var(--text-primary)" }}>{selectedOrders.size} kendala dipilih</h4>
              <p style={{ margin: "0.25rem 0 0 0", fontSize: "0.875rem", color: "var(--text-secondary)" }}>
                Klik tombol hapus untuk menghapus semua kendala yang dipilih
              </p>
            </div>
            <div style={{ display: "flex", gap: "1rem" }}>
              <button
                onClick={() => setSelectedOrders(new Set())}
                className="secondary"
                style={{ fontSize: "0.875rem", padding: "0.5rem 1rem" }}
              >
                Batal Pilih
              </button>
              <button
                onClick={handleBatchDelete}
                className="danger"
                disabled={isDeleting}
                style={{ fontSize: "0.875rem", padding: "0.5rem 1rem" }}
              >
                {isDeleting ? "Menghapus..." : `Hapus ${selectedOrders.size} Kendala`}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="card">
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th style={{ width: "40px" }}>
                  <input
                    type="checkbox"
                    checked={currentPageOrders.length > 0 && selectedOrders.size === currentPageOrders.length}
                    onChange={handleSelectAll}
                    style={{ cursor: "pointer" }}
                  />
                </th>
                <th>TID</th>
                <th>Lokasi</th>
                <th>KC Supervisi</th>
                <th>Pengelola</th>
                <th>Judul</th>
                <th>Deskripsi</th>
                <th>Status</th>
                <th>Dibuat</th>
                <th>Hasil Submit</th>
                <th>Info Foto</th>
                <th>Diselesaikan</th>
                <th>Waktu SLA</th>
                <th>Tindakan</th>
              </tr>
            </thead>
            <tbody>
              {currentPageOrders.map((order) => {
                const isOverdue = isAnyOverdue(order)
                const isSelected = selectedOrders.has(order.id)
                return (
                  <tr key={order.id} className={isOverdue ? "overdue" : ""}>
                    <td>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleOrderSelect(order.id)}
                        style={{ cursor: "pointer" }}
                      />
                    </td>
                    <td>{order.reference_data?.tid || "—"}</td>
                    <td style={{ maxWidth: "150px", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {order.reference_data?.lokasi || "—"}
                    </td>
                    <td>{order.reference_data?.kc_supervisi || "—"}</td>
                    <td>{order.username}</td>
                    <td>{order.title}</td>
                    <td style={{ maxWidth: "200px", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {order.description}
                    </td>
                    <td>
                      <span className={`order-status status-${normalizeState(order.state)}`}>
                        {translateStatus(order.state)}
                      </span>
                    </td>
                    <td className="date-cell">
                      {new Date(order.created_at).toLocaleDateString(undefined, {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                      ,<br />
                      {new Date(order.created_at).toLocaleTimeString(undefined, {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td>
                      {order.image_url ? (
                        <a href={order.image_url} target="_blank" rel="noreferrer">
                          Lihat File
                        </a>
                      ) : (
                        <span className="text-muted">Kosong</span>
                      )}
                    </td>
                    <td>
                      {order.image_url_new ? (
                        <a href={order.image_url_new} target="_blank" rel="noreferrer">
                          Lihat Foto
                        </a>
                      ) : (
                        <span className="text-muted">Kosong</span>
                      )}
                    </td>
                    <td>
                      {order.completed_at ? (
                        new Date(order.completed_at).toLocaleString(undefined, {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                    <td className="sla-cell">
                      {order.overdue_duration ||
                        (() => {
                          const createdAt = new Date(order.created_at)
                          const deadline = new Date(createdAt.getTime() + 2 * 60 * 60 * 1000)

                          if (normalizeState(order.state) === "completed") {
                            const completedAt = new Date(order.completed_at)
                            return completedAt <= deadline ? "Sesuai SLA" : "Melewati SLA"
                          }

                          const now = new Date()
                          const diff = deadline - now

                          const formatTime = (prefix, hours, minutes) => (
                            <>
                              <span>{`${prefix} ${hours} jam`}</span>
                              <br />
                              <span>{`${minutes} menit`}</span>
                            </>
                          )

                          if (normalizeState(order.state) === "pending") {
                            if (diff > 0) {
                              const hours = Math.floor(diff / (1000 * 60 * 60))
                              const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
                              return formatTime("sisa", hours, minutes)
                            } else {
                              const overdueMillis = Math.abs(diff)
                              const hours = Math.floor(overdueMillis / (1000 * 60 * 60))
                              const minutes = Math.floor((overdueMillis % (1000 * 60 * 60)) / (1000 * 60))
                              return formatTime("lewat", hours, minutes)
                            }
                          }

                          if (normalizeState(order.state) === "overdue") {
                            const overdueMillis = Math.abs(diff)
                            const hours = Math.floor(overdueMillis / (1000 * 60 * 60))
                            const minutes = Math.floor((overdueMillis % (1000 * 60 * 60)) / (1000 * 60))
                            return formatTime("lewat", hours, minutes)
                          }

                          return "—"
                        })()}
                    </td>
                    <td>
                      <button
                        className="danger"
                        onClick={() => deleteOrder(order.id)}
                        style={{ fontSize: "0.75rem", padding: "0.25rem 0.5rem" }}
                      >
                        HAPUS
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <OrdersPagination />
      </div>
    </div>
  )
}
