import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  LayoutDashboard, Wallet, ReceiptText, FileBarChart2, Download,
  Settings as SettingsIcon, Plus, X, Pencil, Trash2, AlertTriangle,
  CheckCircle2, Search, TrendingUp, TrendingDown, Eye, Menu,
  ChevronRight, RotateCcw, Info, Leaf
} from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Legend, ResponsiveContainer, Tooltip as RTooltip } from "recharts";

/* ---------------------------------- THEME ---------------------------------- */
const C = {
  sidebar: "#0B2F23",
  sidebarActive: "#16473A",
  sidebarText: "#CFE3D8",
  sidebarMuted: "#7FA093",
  bg: "#F4F8F6",
  card: "#FFFFFF",
  border: "#E4EAE7",
  text: "#0F241C",
  muted: "#5C7268",
  green: "#1E8E5A",
  greenLight: "#E7F5EE",
  amber: "#C8791E",
  amberLight: "#FBF1E0",
  red: "#CB3B32",
  redLight: "#FBEAE8",
  blue: "#4C6EF5",
  purple: "#8B5CF6",
};
const CHART_COLORS = ["#1E8E5A", "#4C6EF5", "#8B5CF6", "#C8791E", "#14B8A6", "#CB3B32", "#EAB308", "#3E6259"];

/* ---------------------------------- HELPERS ---------------------------------- */
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const fmtDate = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso + "T00:00:00");
  if (isNaN(d)) return iso;
  return `${String(d.getDate()).padStart(2,"0")} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
};
const fmtPKR = (n) => `PKR ${Number(n || 0).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
const pct = (used, budget) => (budget > 0 ? (used / budget) * 100 : 0);
const uid = (p) => `${p}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
const todayISO = () => new Date().toISOString().slice(0, 10);

/* ---------------------------------- SAMPLE DATA ---------------------------------- */
// Real per-segment Budget + already-Exhausted amounts, taken directly from the company's
// "Budget" tab (Google Sheet). "priorExhausted" is spend already recorded in that sheet
// BEFORE this dashboard existed — new expenses added here are added on top of it, not
// instead of it, so totals stay accurate with the real sheet.
const SEGMENT_BUDGETS = {
  "REFRESHMENTS (TEA, COFFEE, ETC.)": {
    "Supplies - PK": { budget: 12123502, priorExhausted: 665636 },
    "Vending machines rent": { budget: 910800, priorExhausted: 468270 },
  },
  "OFFICE SUPPLIES": {
    "Janitorial expenses": { budget: 2630921, priorExhausted: 250 },
    "Kitchen expenses": { budget: 150940, priorExhausted: 0 },
    "Office supplies": { budget: 50365, priorExhausted: 845 },
    "Drinking water": { budget: 2718810, priorExhausted: 905270 },
  },
  "MISCELLANEOUS": {
    "Postage and Delivery": { budget: 12000, priorExhausted: 0 },
    "Stationery": { budget: 235950, priorExhausted: 11200 },
    "Printing and Reproduction": { budget: 200000, priorExhausted: 0 },
    "Fare allowance": { budget: 333840, priorExhausted: 0 },
    "Entertainment": { budget: 572840, priorExhausted: 4180 },
    "Other Expenses": { budget: 6000, priorExhausted: 8340 },
    "Daily meals": { budget: 400000, priorExhausted: 0 },
    "Engagement": { budget: 200000, priorExhausted: 62471 },
  },
};
const sumSegmentBudgets = (headerName) => Object.values(SEGMENT_BUDGETS[headerName] || {}).reduce((s, seg) => s + seg.budget, 0);
const sumSegmentPriorExhausted = (headerName) => Object.values(SEGMENT_BUDGETS[headerName] || {}).reduce((s, seg) => s + (seg.priorExhausted || 0), 0);

const SEED_HEADERS = [
  { id: "h1", name: "REFRESHMENTS (TEA, COFFEE, ETC.)", budget: sumSegmentBudgets("REFRESHMENTS (TEA, COFFEE, ETC.)"), startDate: "2026-07-20", endDate: "", status: "Active", isDemo: true },
  { id: "h2", name: "OFFICE SUPPLIES", budget: sumSegmentBudgets("OFFICE SUPPLIES"), startDate: "2026-07-20", endDate: "", status: "Active", isDemo: true },
  { id: "h3", name: "MISCELLANEOUS", budget: sumSegmentBudgets("MISCELLANEOUS"), startDate: "2026-07-20", endDate: "", status: "Active", isDemo: true },
];

// Segment (sub-category) options per Budget Header — matches the Google Sheet's row structure.
const SEGMENTS_BY_HEADER = {
  "REFRESHMENTS (TEA, COFFEE, ETC.)": ["Supplies - PK", "Vending machines rent"],
  "OFFICE SUPPLIES": ["Janitorial expenses", "Kitchen expenses", "Office supplies", "Drinking water"],
  "MISCELLANEOUS": ["Postage and Delivery", "Stationery", "Printing and Reproduction", "Fare allowance", "Entertainment", "Other Expenses", "Daily meals", "Engagement"],
};
const DEFAULT_SEGMENTS = ["General"];
const segmentsForHeader = (headerName) => SEGMENTS_BY_HEADER[headerName] || DEFAULT_SEGMENTS;

// Full segment breakdown for a header: every defined segment, each with its own real
// Budget / Used (prior-exhausted + app-tracked) / Remaining — matching the sheet's columns.
function getSegmentBreakdown(headerName, headerId, expenses) {
  const knownSegments = segmentsForHeader(headerName);
  const segBudgets = SEGMENT_BUDGETS[headerName] || {};
  const appUsedBySegment = expenses.filter((e) => e.headerId === headerId).reduce((acc, e) => {
    const key = e.segment || "Unspecified";
    acc[key] = (acc[key] || 0) + Number(e.amount);
    return acc;
  }, {});

  const rows = knownSegments.map((seg) => {
    const info = segBudgets[seg] || {};
    const budget = info.budget || 0;
    const used = (info.priorExhausted || 0) + (appUsedBySegment[seg] || 0);
    const remaining = budget - used;
    return { segment: seg, budget, used, remaining, utilization: pct(used, budget), over: budget > 0 && used > budget };
  });

  Object.keys(appUsedBySegment).forEach((key) => {
    if (!knownSegments.includes(key)) {
      rows.push({ segment: key, budget: 0, used: appUsedBySegment[key], remaining: -appUsedBySegment[key], utilization: 0, over: true });
    }
  });

  return rows;
}

// Mode of Payment options (matches the "Credit card useage" / "Petty Cash Usage" tabs on the sheet)
const PAYMENT_MODES = ["Credit Card", "Petty Cash"];
const PAYMENT_MODE_LIMIT = 150000; // shared limit for both Credit Card and Petty Cash

// Added By options
const ADDED_BY_OPTIONS = ["Muhammad Khaleeq Kamali", "Shahbaz Ahmed"];

// Business Unit options
const BU_OPTIONS = ["Pure", "SquatWolf", "Disrupt Lab", "Disrupt", "Wellows", "Secure", "Soft FM", "Hard FM", "HR-Ops"];

const SEED_EXPENSES = [
  { id: "e1", date: "2026-07-22", headerId: "h1", segment: "Supplies - PK", bu: "Soft FM", description: "Tea & coffee supplies", vendor: "Metro Cash & Carry", mode: "Petty Cash", amount: 12500, addedBy: "Shahbaz Ahmed", imageData: null, imageName: "", remarks: "", isDemo: true },
  { id: "e2", date: "2026-08-05", headerId: "h1", segment: "Supplies - PK", bu: "Soft FM", description: "Lunch for Auto OS Team", vendor: "Cafe Flo", mode: "Credit Card", amount: 5238, addedBy: "Shahbaz Ahmed", imageData: null, imageName: "", remarks: "", isDemo: true },
  { id: "e3", date: "2026-08-12", headerId: "h1", segment: "Vending machines rent", bu: "Soft FM", description: "Vending machine rent - Aug", vendor: "VendCo", mode: "Credit Card", amount: 15000, addedBy: "Muhammad Khaleeq Kamali", imageData: null, imageName: "", remarks: "", isDemo: true },
  { id: "e4", date: "2026-08-03", headerId: "h2", segment: "Office supplies", bu: "Soft FM", description: "Stationery & supplies restock", vendor: "Paper Plus", mode: "Petty Cash", amount: 3200, addedBy: "Shahbaz Ahmed", imageData: null, imageName: "", remarks: "", isDemo: true },
  { id: "e5", date: "2026-08-14", headerId: "h3", segment: "Postage and Delivery", bu: "Soft FM", description: "Courier charges", vendor: "TCS", mode: "Petty Cash", amount: 1200, addedBy: "Muhammad Khaleeq Kamali", imageData: null, imageName: "", remarks: "", isDemo: true },
];

const STORAGE_KEY = "wsbd-app-data-v1";

// Paste the Apps Script Web App URL here after deploying (ends in /exec).
// Leave empty and the app just keeps working off local storage, same as before.
const GOOGLE_SHEETS_WEBHOOK_URL = "https://script.google.com/macros/s/AKfycbyLYV1SB2pf9jG26NA2SWSLBHGBseklBB255JLSXe4OBI-S0IjOKhmJfOnqLHkJrv4B/exec";

/* ---------------------------------- SMALL UI PARTS ---------------------------------- */
function Badge({ children, tone = "muted" }) {
  const tones = {
    muted: { bg: "#EEF2F0", fg: C.muted },
    green: { bg: C.greenLight, fg: C.green },
    amber: { bg: C.amberLight, fg: C.amber },
    red: { bg: C.redLight, fg: C.red },
  };
  const t = tones[tone];
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
      style={{ background: t.bg, color: t.fg }}
    >
      {children}
    </span>
  );
}

function ProgressBar({ percent, over }) {
  const clamped = Math.min(percent, 100);
  const color = over ? C.red : percent >= 80 ? C.amber : C.green;
  return (
    <div className="w-full rounded-full overflow-hidden" style={{ background: "#EDF1EF", height: 8 }}>
      <div
        className="h-full rounded-full transition-all"
        style={{ width: `${clamped}%`, background: color }}
      />
    </div>
  );
}

function SegmentRow({ seg }) {
  return (
    <div className="py-1.5" style={{ opacity: seg.budget > 0 ? 1 : 0.7 }}>
      <div className="flex items-center justify-between text-xs mb-1 gap-3">
        <span className="flex items-center gap-1.5 min-w-0">
          <span className="truncate font-medium" style={{ color: C.text }}>{seg.segment}</span>
          {seg.over && <Badge tone="red">Over</Badge>}
        </span>
        <span className="font-semibold shrink-0" style={{ color: seg.remaining < 0 ? C.red : C.text }}>{fmtPKR(seg.remaining)} left</span>
      </div>
      <ProgressBar percent={seg.utilization} over={seg.over} />
      <div className="flex justify-between mt-1 text-[11px]" style={{ color: C.muted }}>
        <span>{fmtPKR(seg.used)} used</span>
        <span>{fmtPKR(seg.budget)} budget</span>
      </div>
    </div>
  );
}

function Gauge({ percent, size = 108, stroke = 11, over }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(percent, 100));
  const color = over ? C.red : percent >= 80 ? C.amber : C.green;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size / 2} cy={size / 2} r={r} stroke="#EDF1EF" strokeWidth={stroke} fill="none" />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        stroke={color}
        strokeWidth={stroke}
        fill="none"
        strokeDasharray={c}
        strokeDashoffset={c - (clamped / 100) * c}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: "stroke-dashoffset 0.6s ease" }}
      />
      <text x="50%" y="47%" textAnchor="middle" fontSize={size * 0.19} fontWeight="700" fill={C.text}>
        {percent.toFixed(1)}%
      </text>
      <text x="50%" y="65%" textAnchor="middle" fontSize={size * 0.1} fill={C.muted}>
        used
      </text>
    </svg>
  );
}

function Toast({ toast }) {
  if (!toast) return null;
  const isErr = toast.type === "error";
  return (
    <div
      className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-xl px-4 py-3 shadow-lg text-sm font-medium"
      style={{ background: isErr ? C.red : C.green, color: "#fff" }}
    >
      {isErr ? <AlertTriangle size={16} /> : <CheckCircle2 size={16} />}
      {toast.msg}
    </div>
  );
}

function Modal({ title, onClose, children, wide }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(15,36,28,0.45)" }}>
      <div
        className={`w-full ${wide ? "max-w-2xl" : "max-w-md"} rounded-2xl shadow-xl max-h-[90vh] overflow-y-auto`}
        style={{ background: C.card }}
      >
        <div className="flex items-center justify-between px-6 py-4 sticky top-0" style={{ background: C.card, borderBottom: `1px solid ${C.border}` }}>
          <h3 className="text-base font-semibold" style={{ color: C.text }}>{title}</h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100">
            <X size={18} color={C.muted} />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

function Field({ label, children, hint }) {
  return (
    <label className="block mb-4">
      <span className="block text-xs font-semibold mb-1.5" style={{ color: C.muted }}>{label}</span>
      {children}
      {hint && <span className="block text-xs mt-1" style={{ color: C.muted }}>{hint}</span>}
    </label>
  );
}

const inputStyle = {
  width: "100%",
  border: `1px solid ${C.border}`,
  borderRadius: 10,
  padding: "9px 12px",
  fontSize: 14,
  color: C.text,
  outline: "none",
  background: "#fff",
};

/* ---------------------------------- APP ---------------------------------- */
export default function Dashboard() {
  const [headers, setHeaders] = useState(SEED_HEADERS);
  const [expenses, setExpenses] = useState(SEED_EXPENSES);
  const [loaded, setLoaded] = useState(false);
  const [view, setView] = useState("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);

  const [expenseModal, setExpenseModal] = useState(null); // null | {} | expense obj
  const [headerModal, setHeaderModal] = useState(null);
  const [deleteExpenseId, setDeleteExpenseId] = useState(null);
  const [deleteHeaderId, setDeleteHeaderId] = useState(null);
  const [syncing, setSyncing] = useState(false);

  // Load from persistent storage (browser localStorage)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.headers?.length) setHeaders(parsed.headers);
        if (parsed.expenses) setExpenses(parsed.expenses);
      }
    } catch (e) {
      // no saved data yet — keep seed data
    } finally {
      setLoaded(true);
    }
  }, []);

  // Persist on change
  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ headers, expenses }));
    } catch (e) {
      console.error("Storage error", e);
    }
  }, [headers, expenses, loaded]);

  const notify = (msg, type = "success") => {
    setToast({ msg, type });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3000);
  };

  /* ---------------- Google Sheet sync (Apps Script webhook) ---------------- */
  async function pushExpenseToSheet(action, expense, headerName) {
    if (!GOOGLE_SHEETS_WEBHOOK_URL) return; // not configured yet — app keeps working locally
    try {
      await fetch(GOOGLE_SHEETS_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" }, // avoids a CORS preflight to Apps Script
        body: JSON.stringify({ action, headerName, ...expense }),
      });
    } catch (err) {
      notify("Saved locally, but couldn't sync to Google Sheet.", "error");
    }
  }

  async function pullFromSheet() {
    if (!GOOGLE_SHEETS_WEBHOOK_URL) {
      notify("Google Sheet link isn't set up yet.", "error");
      return;
    }
    setSyncing(true);
    try {
      const res = await fetch(GOOGLE_SHEETS_WEBHOOK_URL);
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "Unknown error");
      const pulled = (data.entries || []).map((r) => ({
        id: r.id,
        date: r.date,
        headerId: r.headerId,
        segment: r.segment || "",
        description: r.description,
        vendor: r.vendor || "",
        amount: Number(r.amount) || 0,
        mode: r.mode || "",
        bu: r.bu || "",
        addedBy: r.addedBy,
        imageData: null,
        imageName: "",
        remarks: r.remarks || "",
        receiptLink: r.receiptLink || "",
        isDemo: false,
      }));
      setExpenses(pulled);
      notify(`Pulled ${pulled.length} entries from the Google Sheet.`);
    } catch (err) {
      notify("Couldn't pull from Google Sheet — check the Apps Script deployment.", "error");
    } finally {
      setSyncing(false);
    }
  }

  /* ---------------- Derived data ---------------- */
  const headerStats = useMemo(() => {
    return headers.map((h) => {
      const priorExhausted = sumSegmentPriorExhausted(h.name);
      const appUsed = expenses.filter((e) => e.headerId === h.id).reduce((s, e) => s + Number(e.amount), 0);
      const used = priorExhausted + appUsed;
      const remaining = h.budget - used;
      const utilization = pct(used, h.budget);
      return { ...h, used, remaining, utilization, over: used > h.budget };
    });
  }, [headers, expenses]);

  const totals = useMemo(() => {
    const activeStats = headerStats.filter((h) => h.status === "Active");
    const totalBudget = activeStats.reduce((s, h) => s + Number(h.budget), 0);
    const totalUsed = activeStats.reduce((s, h) => s + h.used, 0);
    return { totalBudget, totalUsed, remaining: totalBudget - totalUsed, utilization: pct(totalUsed, totalBudget) };
  }, [headerStats]);

  const overBudgetHeaders = headerStats.filter((h) => h.over);
  const headerNameById = useMemo(() => Object.fromEntries(headers.map((h) => [h.id, h.name])), [headers]);

  const paymentModeStats = useMemo(() => {
    return PAYMENT_MODES.map((mode) => {
      const used = expenses.filter((e) => e.mode === mode).reduce((s, e) => s + Number(e.amount), 0);
      const remaining = PAYMENT_MODE_LIMIT - used;
      return { mode, limit: PAYMENT_MODE_LIMIT, used, remaining, utilization: pct(used, PAYMENT_MODE_LIMIT), over: used > PAYMENT_MODE_LIMIT };
    });
  }, [expenses]);

  const [paymentModeView, setPaymentModeView] = useState(null); // null | "Credit Card" | "Petty Cash"

  /* ---------------- Expense CRUD ---------------- */
  function saveExpense(form, editingId) {
    const amount = Number(form.amount);
    if (!form.date) return notify("Please select an expense date.", "error");
    if (!form.headerId) return notify("Please select a Budget Header.", "error");
    if (!form.description.trim()) return notify("Description is required.", "error");
    if (!form.addedBy.trim()) return notify("Please enter Added By.", "error");
    if (isNaN(amount) || amount <= 0) return notify("Amount must be a positive number.", "error");

    const headerName = headers.find((h) => h.id === form.headerId)?.name || "";
    if (editingId) {
      setExpenses((prev) => prev.map((e) => (e.id === editingId ? { ...e, ...form, amount, isDemo: false } : e)));
      notify("Expense updated successfully.");
      pushExpenseToSheet("update", { ...form, amount, id: editingId }, headerName);
    } else {
      const newExpense = { id: uid("e"), ...form, amount, isDemo: false, createdAt: new Date().toISOString() };
      setExpenses((prev) => [newExpense, ...prev]);
      notify("Expense added successfully.");
      pushExpenseToSheet("add", newExpense, headerName);
    }
    setExpenseModal(null);
  }

  function deleteExpense(id) {
    const target = expenses.find((e) => e.id === id);
    setExpenses((prev) => prev.filter((e) => e.id !== id));
    setDeleteExpenseId(null);
    notify("Expense deleted. Budget updated successfully.");
    pushExpenseToSheet("delete", { id }, target ? headerNameById[target.headerId] : "");
  }

  /* ---------------- Header CRUD ---------------- */
  function saveHeader(form, editingId) {
    const budget = Number(form.budget);
    if (!form.name.trim()) return notify("Header name is required.", "error");
    if (isNaN(budget) || budget <= 0) return notify("Allocated budget must be a positive number.", "error");
    const dup = headers.some((h) => h.name.trim().toLowerCase() === form.name.trim().toLowerCase() && h.id !== editingId);
    if (dup) return notify("A Budget Header with this name already exists.", "error");

    if (editingId) {
      setHeaders((prev) => prev.map((h) => (h.id === editingId ? { ...h, ...form, budget, isDemo: false } : h)));
      notify("Budget header updated successfully.");
    } else {
      setHeaders((prev) => [...prev, { id: uid("h"), ...form, budget, isDemo: false }]);
      notify("Budget header added successfully.");
    }
    setHeaderModal(null);
  }

  function deleteHeader(id) {
    const inUse = expenses.some((e) => e.headerId === id);
    if (inUse) {
      notify("Cannot delete — this header has linked expenses. Remove them first.", "error");
      setDeleteHeaderId(null);
      return;
    }
    setHeaders((prev) => prev.filter((h) => h.id !== id));
    setDeleteHeaderId(null);
    notify("Budget header deleted.");
  }

  function resetDemoData() {
    setHeaders(SEED_HEADERS);
    setExpenses(SEED_EXPENSES);
    notify("Sample data restored.");
  }

  function clearAllData() {
    setHeaders([]);
    setExpenses([]);
    notify("All data cleared.");
  }

  /* ---------------- Nav ---------------- */
  const NAV = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "headers", label: "Budget Headers", icon: Wallet },
    { id: "expenses", label: "Expense Entries", icon: ReceiptText },
    { id: "reports", label: "Reports", icon: FileBarChart2 },
    { id: "export", label: "Export Data", icon: Download },
    { id: "settings", label: "Settings", icon: SettingsIcon },
  ];

  return (
    <div className="flex min-h-screen w-full" style={{ background: C.bg, fontFamily: "'Segoe UI', ui-sans-serif, system-ui, -apple-system, sans-serif" }}>
      {/* Sidebar */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-30 md:hidden" style={{ background: "rgba(0,0,0,0.4)" }} onClick={() => setSidebarOpen(false)} />
      )}
      <aside
        className={`fixed md:sticky top-0 left-0 h-screen z-40 w-64 shrink-0 flex flex-col transition-transform duration-200 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"} md:translate-x-0`}
        style={{ background: `linear-gradient(180deg, ${C.sidebar} 0%, #081F17 100%)`, boxShadow: "2px 0 12px rgba(0,0,0,0.08)" }}
      >
        <div className="flex items-center gap-2.5 px-6 py-6">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${C.green}, #2BB673)`, boxShadow: `0 4px 12px ${C.green}55` }}>
            <Leaf size={18} color="#fff" />
          </div>
          <div>
            <div className="text-white font-bold text-[15px] leading-tight">Disrupt.com</div>
            <div className="text-[11px] leading-tight" style={{ color: C.sidebarMuted }}>Workplace Services</div>
          </div>
        </div>
        <nav className="flex-1 px-3 mt-2 space-y-1">
          {NAV.map((n) => {
            const Icon = n.icon;
            const active = view === n.id;
            return (
              <button
                key={n.id}
                onClick={() => { setView(n.id); setSidebarOpen(false); }}
                className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-150"
                style={{
                  background: active ? C.sidebarActive : "transparent",
                  color: active ? "#fff" : C.sidebarText,
                  boxShadow: active ? `inset 3px 0 0 ${C.green}` : "none",
                }}
                onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = "rgba(255,255,255,0.06)"; }}
                onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = "transparent"; }}
              >
                <Icon size={17} />
                {n.label}
                {active && <ChevronRight size={15} className="ml-auto opacity-70" />}
              </button>
            );
          })}
        </nav>
        <div className="px-6 py-5 text-[11px]" style={{ color: C.sidebarMuted, borderTop: `1px solid ${C.sidebarActive}` }}>
          Budget Cycle<br />
          <span className="text-white font-medium">20 Jul 2026 → Till Date</span>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Topbar */}
        <header className="sticky top-0 z-20 flex items-center justify-between gap-4 px-5 md:px-8 py-4" style={{ background: C.bg, boxShadow: "0 1px 3px rgba(15,36,28,0.05)" }}>
          <div className="flex items-center gap-3">
            <button className="md:hidden p-2 rounded-lg" style={{ background: C.card, border: `1px solid ${C.border}` }} onClick={() => setSidebarOpen(true)}>
              <Menu size={18} color={C.text} />
            </button>
            <div>
              <h1 className="text-lg md:text-xl font-bold" style={{ color: C.text }}>
                {NAV.find((n) => n.id === view)?.label || "Dashboard"}
              </h1>
              <p className="text-xs md:text-[13px]" style={{ color: C.muted }}>20 Jul 2026 → Till Date</p>
            </div>
          </div>
          <button
            onClick={() => setExpenseModal({})}
            className="flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-semibold text-white shadow-sm shrink-0"
            style={{ background: C.green }}
          >
            <Plus size={16} /> <span className="hidden sm:inline">New Expense</span>
          </button>
        </header>

        <main className="flex-1 px-5 md:px-8 py-6">
          {view === "dashboard" && (
            <DashboardView
              totals={totals}
              headerStats={headerStats}
              overBudgetHeaders={overBudgetHeaders}
              expenses={expenses}
              headerNameById={headerNameById}
              paymentModeStats={paymentModeStats}
              onViewPaymentMode={(mode) => setPaymentModeView(mode)}
              onAddExpense={() => setExpenseModal({})}
              onEditExpense={(e) => setExpenseModal(e)}
              onDeleteExpense={(id) => setDeleteExpenseId(id)}
              onViewAll={() => setView("expenses")}
            />
          )}
          {view === "headers" && (
            <HeadersView
              headerStats={headerStats}
              expenses={expenses}
              onAdd={() => setHeaderModal({})}
              onEdit={(h) => setHeaderModal(h)}
              onDelete={(id) => setDeleteHeaderId(id)}
            />
          )}
          {view === "expenses" && (
            <ExpensesView
              expenses={expenses}
              headers={headers}
              headerNameById={headerNameById}
              onAdd={() => setExpenseModal({})}
              onEdit={(e) => setExpenseModal(e)}
              onDelete={(id) => setDeleteExpenseId(id)}
            />
          )}
          {view === "reports" && (
            <ReportsView headers={headers} expenses={expenses} headerStats={headerStats} headerNameById={headerNameById} />
          )}
          {view === "export" && <ExportView headers={headers} expenses={expenses} headerNameById={headerNameById} notify={notify} />}
          {view === "settings" && (
            <SettingsView
              onReset={resetDemoData}
              onClear={clearAllData}
              headerCount={headers.length}
              expenseCount={expenses.length}
              onPull={pullFromSheet}
              syncing={syncing}
              sheetConfigured={!!GOOGLE_SHEETS_WEBHOOK_URL}
            />
          )}
        </main>
      </div>

      {expenseModal !== null && (
        <ExpenseModal
          headers={headers}
          initial={expenseModal}
          onClose={() => setExpenseModal(null)}
          onSave={saveExpense}
          headerStats={headerStats}
          expenses={expenses}
          notify={notify}
        />
      )}
      {headerModal !== null && (
        <HeaderModal initial={headerModal} onClose={() => setHeaderModal(null)} onSave={saveHeader} />
      )}
      {deleteExpenseId && (
        <ConfirmModal
          title="Delete expense entry?"
          body="This will permanently remove this entry and recalculate all budget totals."
          onCancel={() => setDeleteExpenseId(null)}
          onConfirm={() => deleteExpense(deleteExpenseId)}
        />
      )}
      {deleteHeaderId && (
        <ConfirmModal
          title="Delete budget header?"
          body="This cannot be undone. Headers with linked expenses cannot be deleted."
          onCancel={() => setDeleteHeaderId(null)}
          onConfirm={() => deleteHeader(deleteHeaderId)}
        />
      )}
      {paymentModeView && (
        <PaymentModeModal
          mode={paymentModeView}
          stats={paymentModeStats.find((p) => p.mode === paymentModeView)}
          expenses={expenses.filter((e) => e.mode === paymentModeView)}
          headerNameById={headerNameById}
          onClose={() => setPaymentModeView(null)}
        />
      )}
      <Toast toast={toast} />
    </div>
  );
}

/* ---------------------------------- KPI CARD ---------------------------------- */
function KPICard({ label, value, sub, icon: Icon, tone }) {
  const tones = {
    green: { bg: C.greenLight, fg: C.green },
    blue: { bg: "#EAEEFE", fg: C.blue },
    red: { bg: C.redLight, fg: C.red },
    purple: { bg: "#F1EBFE", fg: C.purple },
  };
  const t = tones[tone] || tones.green;
  return (
    <div className="rounded-2xl p-5 shadow-sm transition-all duration-200 hover:shadow-md hover:-translate-y-0.5" style={{ background: C.card, border: `1px solid ${C.border}` }}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: C.muted }}>{label}</span>
        <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: t.bg, boxShadow: `0 0 0 5px ${t.bg}80` }}>
          <Icon size={16} color={t.fg} />
        </div>
      </div>
      <div className="text-2xl font-bold tabular-nums tracking-tight" style={{ color: C.text }}>{value}</div>
      {sub && <div className="text-xs mt-1.5" style={{ color: C.muted }}>{sub}</div>}
    </div>
  );
}

/* ---------------------------------- DASHBOARD VIEW ---------------------------------- */
function DashboardView({ totals, headerStats, overBudgetHeaders, expenses, headerNameById, paymentModeStats, onViewPaymentMode, onAddExpense, onEditExpense, onDeleteExpense, onViewAll }) {
  const recent = [...expenses].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 6);
  const [expandedHeaderId, setExpandedHeaderId] = useState(null);

  return (
    <div className="space-y-6">
      {overBudgetHeaders.length > 0 && (
        <div className="flex items-start gap-3 rounded-2xl px-5 py-4" style={{ background: C.redLight, border: `1px solid #F3C7C3` }}>
          <AlertTriangle size={18} color={C.red} className="shrink-0 mt-0.5" />
          <div className="text-sm" style={{ color: "#7A241E" }}>
            <span className="font-semibold">{overBudgetHeaders.length} header{overBudgetHeaders.length > 1 ? "s" : ""} over budget: </span>
            {overBudgetHeaders.map((h) => h.name).join(", ")}. Review expense entries against these headers.
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard label="Total Budget" value={fmtPKR(totals.totalBudget)} sub="Across all active headers" icon={Wallet} tone="blue" />
        <KPICard label="Total Used" value={fmtPKR(totals.totalUsed)} sub={`${expenses.length} expense entries`} icon={ReceiptText} tone="purple" />
        <KPICard label="Total Remaining" value={fmtPKR(totals.remaining)} sub={totals.remaining < 0 ? "Over allocated budget" : "Available to spend"} icon={totals.remaining < 0 ? TrendingDown : TrendingUp} tone={totals.remaining < 0 ? "red" : "green"} />
        <KPICard label="Utilization" value={`${totals.utilization.toFixed(1)}%`} sub="Overall budget consumed" icon={FileBarChart2} tone={totals.utilization > 100 ? "red" : "blue"} />
      </div>

      {paymentModeStats && (
        <div>
          <h3 className="text-sm font-semibold mb-3" style={{ color: C.text }}>Payment Mode Limits</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {paymentModeStats.map((p) => (
              <button
                key={p.mode}
                onClick={() => onViewPaymentMode(p.mode)}
                className="text-left rounded-2xl p-5 shadow-sm flex items-center gap-5 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5"
                style={{ background: C.card, border: `1px solid ${p.over ? "#F3C7C3" : C.border}` }}
              >
                <Gauge percent={p.utilization} size={84} stroke={8} over={p.over} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-semibold" style={{ color: C.text }}>{p.mode}</span>
                    {p.over && <Badge tone="red">Over Limit</Badge>}
                  </div>
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between"><span style={{ color: C.muted }}>Limit</span><span className="font-semibold" style={{ color: C.text }}>{fmtPKR(p.limit)}</span></div>
                    <div className="flex justify-between"><span style={{ color: C.muted }}>Used</span><span className="font-semibold" style={{ color: C.text }}>{fmtPKR(p.used)}</span></div>
                    <div className="flex justify-between"><span style={{ color: C.muted }}>Remaining</span><span className="font-semibold" style={{ color: p.remaining < 0 ? C.red : C.green }}>{fmtPKR(p.remaining)}</span></div>
                  </div>
                  <div className="mt-2 text-xs font-semibold flex items-center gap-1" style={{ color: C.green }}>
                    View details <ChevronRight size={13} />
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <div className="xl:col-span-2 rounded-2xl shadow-sm overflow-hidden" style={{ background: C.card, border: `1px solid ${C.border}` }}>
          <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: `1px solid ${C.border}` }}>
            <h3 className="text-sm font-semibold" style={{ color: C.text }}>Budget Overview by Header</h3>
          </div>
          <div className="divide-y" style={{ borderColor: C.border }}>
            {headerStats.map((h) => {
              const isOpen = expandedHeaderId === h.id;
              const segmentBreakdown = isOpen ? getSegmentBreakdown(h.name, h.id, expenses) : [];
              return (
                <div key={h.id} style={{ borderBottom: `1px solid ${C.border}` }}>
                  <div
                    className="px-5 py-4 flex items-center gap-3 cursor-pointer transition-colors hover:bg-[#FAFCFB]"
                    onClick={() => setExpandedHeaderId(isOpen ? null : h.id)}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        <span className="text-sm font-semibold truncate" style={{ color: C.text }}>{h.name}</span>
                        {h.over && <Badge tone="red">Over Budget</Badge>}
                        {!h.over && h.utilization >= 80 && <Badge tone="amber">Near Limit</Badge>}
                      </div>
                      <ProgressBar percent={h.utilization} over={h.over} />
                      <div className="flex justify-between mt-1.5 text-xs" style={{ color: C.muted }}>
                        <span>{fmtPKR(h.used)} used</span>
                        <span>{fmtPKR(h.budget)} budget</span>
                      </div>
                    </div>
                    <div className="text-right shrink-0 hidden sm:block">
                      <div className="text-sm font-bold" style={{ color: h.over ? C.red : C.text }}>{h.utilization.toFixed(1)}%</div>
                      <div className="text-xs" style={{ color: h.remaining < 0 ? C.red : C.muted }}>{fmtPKR(Math.abs(h.remaining))} {h.remaining < 0 ? "over" : "left"}</div>
                    </div>
                    <ChevronRight
                      size={16}
                      color={C.muted}
                      className="shrink-0 transition-transform duration-200"
                      style={{ transform: isOpen ? "rotate(90deg)" : "rotate(0deg)" }}
                    />
                  </div>
                  {isOpen && (
                    <div className="px-5 pb-4 -mt-1" style={{ background: "#FAFCFB" }}>
                      <div className="text-[10px] font-semibold uppercase tracking-wide mb-2 pt-3" style={{ color: C.muted }}>Segment Breakdown</div>
                      {segmentBreakdown.length === 0 ? (
                        <div className="text-xs pb-1" style={{ color: C.muted }}>No entries yet for this header.</div>
                      ) : (
                        <div className="divide-y" style={{ borderColor: C.border }}>
                          {segmentBreakdown.map((seg) => <SegmentRow key={seg.segment} seg={seg} />)}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-2xl shadow-sm p-5 flex flex-col transition-shadow duration-200 hover:shadow-md" style={{ background: C.card, border: `1px solid ${C.border}` }}>
          <h3 className="text-sm font-semibold mb-1" style={{ color: C.text }}>Spending Trend by Header</h3>
          <p className="text-xs mb-2" style={{ color: C.muted }}>Cumulative amount used over time</p>
          <HeaderTrendChart headerStats={headerStats} expenses={expenses} />
          <div className="mt-4 pt-4" style={{ borderTop: `1px solid ${C.border}` }}>
            <div className="flex justify-between text-xs mb-1.5"><span style={{ color: C.muted }}>Used</span><span style={{ color: C.muted }}>Remaining</span></div>
            <div className="flex rounded-full overflow-hidden" style={{ height: 10, background: "#EDF1EF" }}>
              <div style={{ width: `${Math.min(pct(totals.totalUsed, totals.totalBudget), 100)}%`, background: `linear-gradient(90deg, ${C.green}, #2BB673)` }} />
            </div>
            <div className="flex justify-between text-xs mt-1.5 font-medium">
              <span style={{ color: C.text }}>{fmtPKR(totals.totalUsed)}</span>
              <span style={{ color: C.text }}>{fmtPKR(Math.max(totals.remaining, 0))}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl shadow-sm overflow-hidden" style={{ background: C.card, border: `1px solid ${C.border}` }}>
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: `1px solid ${C.border}` }}>
          <h3 className="text-sm font-semibold" style={{ color: C.text }}>Recent Expense Entries</h3>
          <button onClick={onViewAll} className="text-xs font-semibold" style={{ color: C.green }}>View all →</button>
        </div>
        <ExpenseTable rows={recent} headerNameById={headerNameById} onEdit={onEditExpense} onDelete={onDeleteExpense} />
      </div>
    </div>
  );
}

/* ---------------------------------- HEADER TREND CHART ---------------------------------- */
function HeaderTrendChart({ headerStats, expenses }) {
  const activeHeaders = headerStats.filter((h) => h.used > 0);

  const data = useMemo(() => {
    if (expenses.length === 0) return [];
    const sorted = [...expenses].sort((a, b) => new Date(a.date) - new Date(b.date));
    const dates = [...new Set(sorted.map((e) => e.date))].sort((a, b) => new Date(a) - new Date(b));
    const running = {};
    headerStats.forEach((h) => { running[h.id] = 0; });
    return dates.map((date) => {
      sorted.filter((e) => e.date === date).forEach((e) => {
        running[e.headerId] = (running[e.headerId] || 0) + Number(e.amount);
      });
      const point = { date: fmtDate(date) };
      headerStats.forEach((h) => { point[h.id] = running[h.id]; });
      return point;
    });
  }, [expenses, headerStats]);

  if (data.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-xs" style={{ color: C.muted, height: 240 }}>
        No spending data yet — add an expense to see the trend.
      </div>
    );
  }

  return (
    <div style={{ height: 240 }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
          <defs>
            {activeHeaders.map((h, i) => {
              const color = CHART_COLORS[i % CHART_COLORS.length];
              return (
                <linearGradient key={h.id} id={`grad-${h.id}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={color} stopOpacity={0.38} />
                  <stop offset="95%" stopColor={color} stopOpacity={0.02} />
                </linearGradient>
              );
            })}
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#EDF1EF" vertical={false} />
          <XAxis dataKey="date" tick={{ fontSize: 11, fill: C.muted }} axisLine={{ stroke: C.border }} tickLine={false} />
          <YAxis tick={{ fontSize: 11, fill: C.muted }} axisLine={false} tickLine={false} tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v)} width={40} />
          <RTooltip content={<TrendTooltip />} />
          <Legend wrapperStyle={{ fontSize: 11 }} iconType="circle" iconSize={8} />
          {activeHeaders.map((h, i) => {
            const color = CHART_COLORS[i % CHART_COLORS.length];
            return (
              <Area
                key={h.id}
                type="monotone"
                dataKey={h.id}
                name={h.name}
                stroke={color}
                fill={`url(#grad-${h.id})`}
                strokeWidth={2.5}
                dot={{ r: 3.5, strokeWidth: 0, fill: color }}
                activeDot={{ r: 6, strokeWidth: 2, stroke: "#fff" }}
              />
            );
          })}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function TrendTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl px-3.5 py-3" style={{ background: "#fff", border: `1px solid ${C.border}`, boxShadow: "0 8px 24px rgba(15,36,28,0.12)" }}>
      <div className="text-xs font-semibold mb-2" style={{ color: C.text }}>{label}</div>
      <div className="space-y-1">
        {payload.map((p) => (
          <div key={p.dataKey} className="flex items-center justify-between gap-5 text-xs">
            <span className="flex items-center gap-1.5 min-w-0">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: p.color }} />
              <span className="truncate" style={{ color: C.muted }}>{p.name}</span>
            </span>
            <span className="font-semibold shrink-0" style={{ color: C.text }}>{fmtPKR(p.value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------------------------------- EXPENSE TABLE ---------------------------------- */
function ExpenseTable({ rows, headerNameById, onEdit, onDelete }) {
  const showActions = !!(onEdit || onDelete);
  if (rows.length === 0) {
    return <div className="px-5 py-10 text-center text-sm" style={{ color: C.muted }}>No expense entries yet. Add your first expense to get started.</div>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr style={{ background: "#FAFCFB" }}>
            {["Date", "Budget Header", "Segment", "Description", "Amount", "Mode", "BU", "Added By", ...(showActions ? [""] : [])].map((h) => (
              <th key={h} className="text-left px-5 py-2.5 text-xs font-semibold uppercase tracking-wide" style={{ color: C.muted }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((e) => (
            <tr key={e.id} style={{ borderTop: `1px solid ${C.border}` }}>
              <td className="px-5 py-3 whitespace-nowrap" style={{ color: C.text }}>{fmtDate(e.date)}</td>
              <td className="px-5 py-3 whitespace-nowrap">
                <span className="inline-flex items-center gap-1.5">
                  {headerNameById[e.headerId] || "—"}
                  {e.isDemo && <Badge tone="muted">Demo</Badge>}
                </span>
              </td>
              <td className="px-5 py-3 whitespace-nowrap" style={{ color: C.muted }}>{e.segment || "—"}</td>
              <td className="px-5 py-3 max-w-[220px] truncate" title={e.description} style={{ color: C.text }}>{e.description}</td>
              <td className="px-5 py-3 font-semibold whitespace-nowrap" style={{ color: C.text }}>{fmtPKR(e.amount)}</td>
              <td className="px-5 py-3 whitespace-nowrap" style={{ color: C.muted }}>{e.mode || "—"}</td>
              <td className="px-5 py-3 whitespace-nowrap" style={{ color: C.muted }}>{e.bu || "—"}</td>
              <td className="px-5 py-3 whitespace-nowrap" style={{ color: C.muted }}>{e.addedBy}</td>
              {showActions && (
                <td className="px-5 py-3">
                  <div className="flex items-center gap-2 justify-end">
                    {onEdit && <button onClick={() => onEdit(e)} className="p-1.5 rounded-lg hover:bg-gray-100"><Pencil size={14} color={C.muted} /></button>}
                    {onDelete && <button onClick={() => onDelete(e.id)} className="p-1.5 rounded-lg hover:bg-gray-100"><Trash2 size={14} color={C.red} /></button>}
                  </div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ---------------------------------- PAYMENT MODE MODAL ---------------------------------- */
function PaymentModeModal({ mode, stats, expenses, headerNameById, onClose }) {
  if (!stats) return null;
  const sorted = [...expenses].sort((a, b) => new Date(b.date) - new Date(a.date));
  return (
    <Modal title={`${mode} — Limit Overview`} onClose={onClose} wide>
      <div className="flex items-center gap-6 mb-5 flex-wrap">
        <Gauge percent={stats.utilization} size={120} stroke={11} over={stats.over} />
        <div className="flex-1 min-w-[180px] space-y-2 text-sm">
          <div className="flex justify-between"><span style={{ color: C.muted }}>Limit</span><span className="font-semibold" style={{ color: C.text }}>{fmtPKR(stats.limit)}</span></div>
          <div className="flex justify-between"><span style={{ color: C.muted }}>Used</span><span className="font-semibold" style={{ color: C.text }}>{fmtPKR(stats.used)}</span></div>
          <div className="flex justify-between"><span style={{ color: C.muted }}>Remaining</span><span className="font-semibold" style={{ color: stats.remaining < 0 ? C.red : C.green }}>{fmtPKR(stats.remaining)}</span></div>
          <div className="flex justify-between"><span style={{ color: C.muted }}>Entries</span><span className="font-semibold" style={{ color: C.text }}>{expenses.length}</span></div>
        </div>
      </div>
      {stats.over && (
        <div className="flex items-start gap-2 rounded-xl px-4 py-3 mb-4" style={{ background: C.redLight }}>
          <AlertTriangle size={16} color={C.red} className="shrink-0 mt-0.5" />
          <div className="text-xs" style={{ color: "#7A241E" }}>
            <span className="font-semibold">{mode} is over its {fmtPKR(stats.limit)} limit</span> by {fmtPKR(Math.abs(stats.remaining))}.
          </div>
        </div>
      )}
      <div className="rounded-2xl overflow-hidden" style={{ border: `1px solid ${C.border}` }}>
        <ExpenseTable rows={sorted} headerNameById={headerNameById} />
      </div>
    </Modal>
  );
}


function HeadersView({ headerStats, expenses, onAdd, onEdit, onDelete }) {
  const [expandedId, setExpandedId] = useState(null);
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-sm" style={{ color: C.muted }}>Manage allocated budgets for each Workplace Services spending category. Click a card to see its segment breakdown.</p>
        <button onClick={onAdd} className="flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-semibold text-white shrink-0" style={{ background: C.green }}>
          <Plus size={16} /> Add Header
        </button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {headerStats.map((h) => {
          const isOpen = expandedId === h.id;
          const segmentBreakdown = isOpen ? getSegmentBreakdown(h.name, h.id, expenses) : [];
          return (
            <div
              key={h.id}
              className="rounded-2xl p-5 shadow-sm cursor-pointer transition-all duration-200 hover:shadow-md"
              style={{ background: C.card, border: `1px solid ${h.over ? "#F3C7C3" : C.border}` }}
              onClick={() => setExpandedId(isOpen ? null : h.id)}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="text-sm font-semibold truncate" style={{ color: C.text }}>{h.name}</h4>
                    {h.isDemo && <Badge tone="muted">Demo</Badge>}
                  </div>
                  <Badge tone={h.status === "Active" ? "green" : "muted"}>{h.status}</Badge>
                </div>
                <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                  <button onClick={() => onEdit(h)} className="p-1.5 rounded-lg hover:bg-gray-100"><Pencil size={14} color={C.muted} /></button>
                  <button onClick={() => onDelete(h.id)} className="p-1.5 rounded-lg hover:bg-gray-100"><Trash2 size={14} color={C.red} /></button>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <Gauge percent={h.utilization} size={92} stroke={9} over={h.over} />
                <div className="flex-1 space-y-1.5 text-xs">
                  <div className="flex justify-between"><span style={{ color: C.muted }}>Budget</span><span className="font-semibold" style={{ color: C.text }}>{fmtPKR(h.budget)}</span></div>
                  <div className="flex justify-between"><span style={{ color: C.muted }}>Used</span><span className="font-semibold" style={{ color: C.text }}>{fmtPKR(h.used)}</span></div>
                  <div className="flex justify-between"><span style={{ color: C.muted }}>Remaining</span><span className="font-semibold" style={{ color: h.remaining < 0 ? C.red : C.green }}>{fmtPKR(h.remaining)}</span></div>
                </div>
              </div>
              {h.over && (
                <div className="mt-3 flex items-center gap-1.5 text-xs font-medium rounded-lg px-3 py-2" style={{ background: C.redLight, color: C.red }}>
                  <AlertTriangle size={13} /> Over budget by {fmtPKR(Math.abs(h.remaining))}
                </div>
              )}
              <div className="mt-3 flex items-center justify-between text-xs" style={{ color: C.muted }}>
                <span>{fmtDate(h.startDate)} {h.endDate ? `→ ${fmtDate(h.endDate)}` : "→ Till Date"}</span>
                <span className="flex items-center gap-1 font-semibold" style={{ color: C.green }}>
                  Segments <ChevronRight size={13} className="transition-transform duration-200" style={{ transform: isOpen ? "rotate(90deg)" : "rotate(0deg)" }} />
                </span>
              </div>
              {isOpen && (
                <div className="mt-3 pt-3" style={{ borderTop: `1px solid ${C.border}` }}>
                  {segmentBreakdown.length === 0 ? (
                    <div className="text-xs" style={{ color: C.muted }}>No entries yet for this header.</div>
                  ) : (
                    <div className="divide-y" style={{ borderColor: C.border }}>
                      {segmentBreakdown.map((seg) => <SegmentRow key={seg.segment} seg={seg} />)}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
        {headerStats.length === 0 && (
          <div className="col-span-full text-center py-14 text-sm" style={{ color: C.muted }}>No budget headers yet. Add one to get started.</div>
        )}
      </div>
    </div>
  );
}

/* ---------------------------------- EXPENSES VIEW ---------------------------------- */
function ExpensesView({ expenses, headers, headerNameById, onAdd, onEdit, onDelete }) {
  const [search, setSearch] = useState("");
  const [headerFilter, setHeaderFilter] = useState("all");

  const filtered = useMemo(() => {
    return expenses
      .filter((e) => (headerFilter === "all" ? true : e.headerId === headerFilter))
      .filter((e) => {
        if (!search.trim()) return true;
        const s = search.toLowerCase();
        return e.description.toLowerCase().includes(s) || (e.vendor || "").toLowerCase().includes(s) || e.addedBy.toLowerCase().includes(s);
      })
      .sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [expenses, search, headerFilter]);

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 justify-between">
        <div className="flex items-center gap-2 flex-1">
          <div className="relative flex-1 max-w-xs">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" color={C.muted} />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search description, vendor, added by…"
              style={{ ...inputStyle, paddingLeft: 32 }} />
          </div>
          <select value={headerFilter} onChange={(e) => setHeaderFilter(e.target.value)} style={{ ...inputStyle, maxWidth: 200 }}>
            <option value="all">All Headers</option>
            {headers.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
          </select>
        </div>
        <button onClick={onAdd} className="flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-semibold text-white shrink-0" style={{ background: C.green }}>
          <Plus size={16} /> Add Expense
        </button>
      </div>
      <div className="rounded-2xl shadow-sm overflow-hidden" style={{ background: C.card, border: `1px solid ${C.border}` }}>
        <ExpenseTable rows={filtered} headerNameById={headerNameById} onEdit={onEdit} onDelete={onDelete} />
      </div>
      <p className="text-xs" style={{ color: C.muted }}>{filtered.length} of {expenses.length} entries shown</p>
    </div>
  );
}

/* ---------------------------------- REPORTS VIEW ---------------------------------- */
function ReportsView({ headers, expenses, headerStats, headerNameById }) {
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [headerFilter, setHeaderFilter] = useState("all");
  const [vendorFilter, setVendorFilter] = useState("");
  const [addedByFilter, setAddedByFilter] = useState("all");

  const addedByOptions = useMemo(() => [...new Set(expenses.map((e) => e.addedBy))], [expenses]);

  const filtered = useMemo(() => {
    return expenses.filter((e) => {
      if (dateFrom && e.date < dateFrom) return false;
      if (dateTo && e.date > dateTo) return false;
      if (headerFilter !== "all" && e.headerId !== headerFilter) return false;
      if (vendorFilter.trim() && !(e.vendor || "").toLowerCase().includes(vendorFilter.trim().toLowerCase())) return false;
      if (addedByFilter !== "all" && e.addedBy !== addedByFilter) return false;
      return true;
    });
  }, [expenses, dateFrom, dateTo, headerFilter, vendorFilter, addedByFilter]);

  const filteredTotal = filtered.reduce((s, e) => s + Number(e.amount), 0);
  const scopedBudget = headerFilter === "all" ? headers.reduce((s, h) => s + Number(h.budget), 0) : (headers.find(h => h.id === headerFilter)?.budget || 0);

  const byHeader = useMemo(() => {
    const map = {};
    filtered.forEach((e) => { map[e.headerId] = (map[e.headerId] || 0) + Number(e.amount); });
    return Object.entries(map).map(([id, amt]) => ({ id, name: headerNameById[id] || "—", amount: amt })).sort((a, b) => b.amount - a.amount);
  }, [filtered, headerNameById]);

  const byMonth = useMemo(() => {
    const map = {};
    filtered.forEach((e) => {
      const d = new Date(e.date + "T00:00:00");
      const key = `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
      map[key] = (map[key] || 0) + Number(e.amount);
    });
    return Object.entries(map).map(([month, amount]) => ({ month, amount }));
  }, [filtered]);

  const byDate = useMemo(() => {
    const map = {};
    filtered.forEach((e) => { map[e.date] = (map[e.date] || 0) + Number(e.amount); });
    return Object.entries(map).sort((a, b) => new Date(b[0]) - new Date(a[0]));
  }, [filtered]);

  const overBudget = headerStats.filter((h) => h.over);

  return (
    <div className="space-y-6">
      <div className="rounded-2xl p-5 shadow-sm grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3" style={{ background: C.card, border: `1px solid ${C.border}` }}>
        <Field label="Date From"><input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} style={inputStyle} /></Field>
        <Field label="Date To"><input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} style={inputStyle} /></Field>
        <Field label="Budget Header">
          <select value={headerFilter} onChange={(e) => setHeaderFilter(e.target.value)} style={inputStyle}>
            <option value="all">All Headers</option>
            {headers.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
          </select>
        </Field>
        <Field label="Vendor"><input value={vendorFilter} onChange={(e) => setVendorFilter(e.target.value)} placeholder="Vendor name…" style={inputStyle} /></Field>
        <Field label="Added By">
          <select value={addedByFilter} onChange={(e) => setAddedByFilter(e.target.value)} style={inputStyle}>
            <option value="all">Everyone</option>
            {addedByOptions.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </Field>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard label="Scoped Budget" value={fmtPKR(scopedBudget)} icon={Wallet} tone="blue" />
        <KPICard label="Scoped Used" value={fmtPKR(filteredTotal)} sub={`${filtered.length} entries`} icon={ReceiptText} tone="purple" />
        <KPICard label="Scoped Remaining" value={fmtPKR(scopedBudget - filteredTotal)} icon={TrendingUp} tone={scopedBudget - filteredTotal < 0 ? "red" : "green"} />
        <KPICard label="Scoped Utilization" value={`${pct(filteredTotal, scopedBudget).toFixed(1)}%`} icon={FileBarChart2} tone="blue" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="rounded-2xl shadow-sm overflow-hidden" style={{ background: C.card, border: `1px solid ${C.border}` }}>
          <div className="px-5 py-4 text-sm font-semibold" style={{ borderBottom: `1px solid ${C.border}`, color: C.text }}>Header-wise Spending</div>
          <div className="divide-y" style={{ borderColor: C.border }}>
            {byHeader.length === 0 && <div className="px-5 py-6 text-sm text-center" style={{ color: C.muted }}>No data for this filter.</div>}
            {byHeader.map((h) => (
              <div key={h.id} className="px-5 py-3 flex justify-between text-sm" style={{ borderBottom: `1px solid ${C.border}` }}>
                <span style={{ color: C.text }}>{h.name}</span>
                <span className="font-semibold" style={{ color: C.text }}>{fmtPKR(h.amount)}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl shadow-sm overflow-hidden" style={{ background: C.card, border: `1px solid ${C.border}` }}>
          <div className="px-5 py-4 text-sm font-semibold" style={{ borderBottom: `1px solid ${C.border}`, color: C.text }}>Monthly Spending</div>
          <div className="divide-y" style={{ borderColor: C.border }}>
            {byMonth.length === 0 && <div className="px-5 py-6 text-sm text-center" style={{ color: C.muted }}>No data for this filter.</div>}
            {byMonth.map((m) => (
              <div key={m.month} className="px-5 py-3 flex justify-between text-sm" style={{ borderBottom: `1px solid ${C.border}` }}>
                <span style={{ color: C.text }}>{m.month}</span>
                <span className="font-semibold" style={{ color: C.text }}>{fmtPKR(m.amount)}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl shadow-sm overflow-hidden" style={{ background: C.card, border: `1px solid ${C.border}` }}>
          <div className="px-5 py-4 text-sm font-semibold" style={{ borderBottom: `1px solid ${C.border}`, color: C.text }}>Highest Spending Headers</div>
          <div className="divide-y" style={{ borderColor: C.border }}>
            {byHeader.slice(0, 5).map((h, i) => (
              <div key={h.id} className="px-5 py-3 flex items-center gap-3 text-sm" style={{ borderBottom: `1px solid ${C.border}` }}>
                <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0" style={{ background: C.greenLight, color: C.green }}>{i + 1}</span>
                <span className="flex-1" style={{ color: C.text }}>{h.name}</span>
                <span className="font-semibold" style={{ color: C.text }}>{fmtPKR(h.amount)}</span>
              </div>
            ))}
            {byHeader.length === 0 && <div className="px-5 py-6 text-sm text-center" style={{ color: C.muted }}>No data for this filter.</div>}
          </div>
        </div>

        <div className="rounded-2xl shadow-sm overflow-hidden" style={{ background: C.card, border: `1px solid ${C.border}` }}>
          <div className="px-5 py-4 text-sm font-semibold flex items-center gap-1.5" style={{ borderBottom: `1px solid ${C.border}`, color: C.text }}>
            <AlertTriangle size={14} color={C.red} /> Over-Budget Headers
          </div>
          <div className="divide-y" style={{ borderColor: C.border }}>
            {overBudget.length === 0 && <div className="px-5 py-6 text-sm text-center" style={{ color: C.muted }}>No headers are currently over budget.</div>}
            {overBudget.map((h) => (
              <div key={h.id} className="px-5 py-3 flex justify-between text-sm" style={{ borderBottom: `1px solid ${C.border}` }}>
                <span style={{ color: C.text }}>{h.name}</span>
                <span className="font-semibold" style={{ color: C.red }}>+{fmtPKR(Math.abs(h.remaining))}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-2xl shadow-sm overflow-hidden" style={{ background: C.card, border: `1px solid ${C.border}` }}>
        <div className="px-5 py-4 text-sm font-semibold" style={{ borderBottom: `1px solid ${C.border}`, color: C.text }}>Date-wise Spending</div>
        <div className="max-h-72 overflow-y-auto divide-y" style={{ borderColor: C.border }}>
          {byDate.length === 0 && <div className="px-5 py-6 text-sm text-center" style={{ color: C.muted }}>No data for this filter.</div>}
          {byDate.map(([date, amt]) => (
            <div key={date} className="px-5 py-2.5 flex justify-between text-sm" style={{ borderBottom: `1px solid ${C.border}` }}>
              <span style={{ color: C.text }}>{fmtDate(date)}</span>
              <span className="font-semibold" style={{ color: C.text }}>{fmtPKR(amt)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------- EXPORT VIEW ---------------------------------- */
function toCSV(rows) {
  return rows.map((r) => r.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
}
function downloadCSV(csv, filename) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function ExportView({ headers, expenses, headerNameById, notify }) {
  const exportExpenses = () => {
    const rows = [["Date", "Budget Header", "Segment", "Description", "Vendor/Purpose", "Amount (PKR)", "Mode of Payment", "BU", "Added By", "Remarks"]];
    expenses.forEach((e) => rows.push([fmtDate(e.date), headerNameById[e.headerId] || "—", e.segment || "", e.description, e.vendor || "", e.amount, e.mode || "", e.bu || "", e.addedBy, e.remarks || ""]));
    downloadCSV(toCSV(rows), "expense-entries.csv");
    notify("Expense entries exported.");
  };
  const exportHeaders = () => {
    const rows = [["Header Name", "Allocated Budget", "Used", "Remaining", "Utilization %", "Status", "Start Date", "End Date"]];
    headers.forEach((h) => {
      const used = expenses.filter((e) => e.headerId === h.id).reduce((s, e) => s + Number(e.amount), 0);
      rows.push([h.name, h.budget, used, h.budget - used, pct(used, h.budget).toFixed(2), h.status, fmtDate(h.startDate), h.endDate ? fmtDate(h.endDate) : "Till Date"]);
    });
    downloadCSV(toCSV(rows), "budget-headers.csv");
    notify("Budget headers exported.");
  };
  const exportSummary = () => {
    const totalBudget = headers.reduce((s, h) => s + Number(h.budget), 0);
    const totalUsed = expenses.reduce((s, e) => s + Number(e.amount), 0);
    const rows = [
      ["Metric", "Value"],
      ["Total Budget", totalBudget],
      ["Total Used", totalUsed],
      ["Total Remaining", totalBudget - totalUsed],
      ["Utilization %", pct(totalUsed, totalBudget).toFixed(2)],
      ["Period", "20 Jul 2026 to " + fmtDate(todayISO())],
    ];
    downloadCSV(toCSV(rows), "budget-summary.csv");
    notify("Summary report exported.");
  };

  const cards = [
    { title: "Expense Entries", desc: `Export all ${expenses.length} expense records with header, vendor, amount and remarks.`, action: exportExpenses },
    { title: "Budget Headers", desc: `Export all ${headers.length} budget headers with allocated, used, remaining and utilization.`, action: exportHeaders },
    { title: "Summary Report", desc: "Export overall totals and utilization for the current budget cycle.", action: exportSummary },
  ];

  return (
    <div className="space-y-5">
      <p className="text-sm" style={{ color: C.muted }}>Download workplace services budget data as CSV files, ready to open in Excel.</p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {cards.map((c) => (
          <div key={c.title} className="rounded-2xl p-5 shadow-sm flex flex-col" style={{ background: C.card, border: `1px solid ${C.border}` }}>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3" style={{ background: C.greenLight }}>
              <Download size={17} color={C.green} />
            </div>
            <h4 className="text-sm font-semibold mb-1.5" style={{ color: C.text }}>{c.title}</h4>
            <p className="text-xs flex-1 mb-4" style={{ color: C.muted }}>{c.desc}</p>
            <button onClick={c.action} className="rounded-xl px-4 py-2.5 text-sm font-semibold text-white" style={{ background: C.green }}>
              Export CSV
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------------------------------- SETTINGS VIEW ---------------------------------- */
function SettingsView({ onReset, onClear, headerCount, expenseCount, onPull, syncing, sheetConfigured }) {
  const [confirmClear, setConfirmClear] = useState(false);
  return (
    <div className="max-w-2xl space-y-5">
      <div className="rounded-2xl p-5 shadow-sm" style={{ background: C.card, border: `1px solid ${C.border}` }}>
        <h3 className="text-sm font-semibold mb-1" style={{ color: C.text }}>Workspace Info</h3>
        <p className="text-xs mb-4" style={{ color: C.muted }}>General information about this budget dashboard.</p>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between"><span style={{ color: C.muted }}>Organization</span><span style={{ color: C.text }}>Disrupt.com</span></div>
          <div className="flex justify-between"><span style={{ color: C.muted }}>Department</span><span style={{ color: C.text }}>Workplace Services</span></div>
          <div className="flex justify-between"><span style={{ color: C.muted }}>Budget Cycle</span><span style={{ color: C.text }}>20 Jul 2026 → Till Date</span></div>
          <div className="flex justify-between"><span style={{ color: C.muted }}>Budget Headers</span><span style={{ color: C.text }}>{headerCount}</span></div>
          <div className="flex justify-between"><span style={{ color: C.muted }}>Expense Entries</span><span style={{ color: C.text }}>{expenseCount}</span></div>
        </div>
      </div>

      <div className="rounded-2xl p-5 shadow-sm" style={{ background: C.card, border: `1px solid ${C.border}` }}>
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-sm font-semibold" style={{ color: C.text }}>Google Sheet Sync</h3>
          <Badge tone={sheetConfigured ? "green" : "muted"}>{sheetConfigured ? "Connected" : "Not connected"}</Badge>
        </div>
        <p className="text-xs mb-4" style={{ color: C.muted }}>
          {sheetConfigured
            ? "New, edited and deleted expenses are pushed to the \"App Expense Log\" tab automatically."
            : "Add your Apps Script Web App URL in the code (GOOGLE_SHEETS_WEBHOOK_URL) to turn this on."}
        </p>
        <button
          onClick={onPull}
          disabled={!sheetConfigured || syncing}
          className="flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-semibold"
          style={{ background: C.greenLight, color: C.green, opacity: !sheetConfigured || syncing ? 0.5 : 1 }}
        >
          <RotateCcw size={15} className={syncing ? "animate-spin" : ""} /> {syncing ? "Pulling…" : "Pull Latest from Sheet"}
        </button>
      </div>

      <div className="rounded-2xl p-5 shadow-sm" style={{ background: C.card, border: `1px solid ${C.border}` }}>
        <h3 className="text-sm font-semibold mb-1" style={{ color: C.text }}>Data Management</h3>
        <p className="text-xs mb-4" style={{ color: C.muted }}>Your data is saved automatically and stays available after refreshing.</p>
        <div className="flex flex-wrap gap-3">
          <button onClick={onReset} className="flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-semibold" style={{ background: C.greenLight, color: C.green }}>
            <RotateCcw size={15} /> Restore Sample Data
          </button>
          {!confirmClear ? (
            <button onClick={() => setConfirmClear(true)} className="flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-semibold" style={{ background: C.redLight, color: C.red }}>
              <Trash2 size={15} /> Clear All Data
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-xs" style={{ color: C.red }}>Are you sure? This can't be undone.</span>
              <button onClick={() => { onClear(); setConfirmClear(false); }} className="rounded-lg px-3 py-1.5 text-xs font-semibold text-white" style={{ background: C.red }}>Yes, clear</button>
              <button onClick={() => setConfirmClear(false)} className="rounded-lg px-3 py-1.5 text-xs font-semibold" style={{ background: "#EEF2F0", color: C.muted }}>Cancel</button>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-start gap-3 rounded-2xl px-5 py-4" style={{ background: "#EAEEFE" }}>
        <Info size={16} color={C.blue} className="shrink-0 mt-0.5" />
        <p className="text-xs" style={{ color: "#2C3E82" }}>
          {sheetConfigured
            ? "Expenses saved on this device also sync to the shared Google Sheet, so other devices can pull the same data."
            : "Data currently persists in secure app storage tied to this dashboard. Ask Workplace Services IT if you'd like this connected to a shared Google Sheet or database for team-wide access."}
        </p>
      </div>
    </div>
  );
}

/* ---------------------------------- EXPENSE MODAL ---------------------------------- */
function ExpenseModal({ headers, initial, onClose, onSave, headerStats, expenses, notify }) {
  const editingId = initial?.id || null;
  const initialHeaderId = initial?.headerId || (headers[0]?.id || "");
  const initialHeaderName = headers.find((h) => h.id === initialHeaderId)?.name || "";
  const [form, setForm] = useState({
    date: initial?.date || todayISO(),
    headerId: initialHeaderId,
    segment: initial?.segment || segmentsForHeader(initialHeaderName)[0] || "",
    description: initial?.description || "",
    amount: initial?.amount ?? "",
    mode: initial?.mode || PAYMENT_MODES[0],
    vendor: initial?.vendor || "",
    bu: initial?.bu || BU_OPTIONS[0],
    addedBy: initial?.addedBy || ADDED_BY_OPTIONS[0],
    imageData: initial?.imageData || null,
    imageName: initial?.imageName || "",
    remarks: initial?.remarks || "",
  });

  const selectedHeader = headerStats.find((h) => h.id === form.headerId);
  const projected = selectedHeader ? selectedHeader.used + Number(form.amount || 0) : 0;
  const willExceed = selectedHeader && Number(form.amount) > 0 && projected > selectedHeader.budget;
  const segmentOptions = segmentsForHeader(selectedHeader?.name || "");
  const segmentStats = selectedHeader
    ? getSegmentBreakdown(selectedHeader.name, selectedHeader.id, expenses).find((s) => s.segment === form.segment)
    : null;
  const segmentProjected = segmentStats ? segmentStats.used + Number(form.amount || 0) : 0;
  const segmentWillExceed = segmentStats && segmentStats.budget > 0 && Number(form.amount) > 0 && segmentProjected > segmentStats.budget;

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const onHeaderChange = (e) => {
    const newHeaderId = e.target.value;
    const newHeaderName = headers.find((h) => h.id === newHeaderId)?.name || "";
    const newSegments = segmentsForHeader(newHeaderName);
    setForm((f) => ({ ...f, headerId: newHeaderId, segment: newSegments[0] || "" }));
  };

  const MAX_IMAGE_BYTES = 1.5 * 1024 * 1024; // ~1.5MB, keeps localStorage usable
  const onImageChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      notify?.("Please attach an image file.", "error");
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      notify?.("Image is too large — please attach a file under 1.5MB.", "error");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setForm((f) => ({ ...f, imageData: reader.result, imageName: file.name }));
    reader.readAsDataURL(file);
  };
  const removeImage = () => setForm((f) => ({ ...f, imageData: null, imageName: "" }));

  return (
    <Modal title={editingId ? "Edit Expense" : "Add Expense"} onClose={onClose} wide>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
        <Field label="Expense Date"><input type="date" value={form.date} onChange={set("date")} style={inputStyle} /></Field>
        <Field label="Budget Header">
          <select value={form.headerId} onChange={onHeaderChange} style={inputStyle}>
            {headers.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
          </select>
        </Field>
        <Field label="Segment">
          <select value={form.segment} onChange={set("segment")} style={inputStyle}>
            {segmentOptions.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </Field>
        {selectedHeader && (
          <div className="sm:col-span-2 -mt-1 mb-3 space-y-2">
            <div className="rounded-xl px-4 py-3 grid grid-cols-3 gap-2" style={{ background: C.bg, border: `1px solid ${C.border}` }}>
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: C.muted }}>Header Budget</div>
                <div className="text-sm font-bold tabular-nums" style={{ color: C.text }}>{fmtPKR(selectedHeader.budget)}</div>
              </div>
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: C.muted }}>Used So Far</div>
                <div className="text-sm font-bold tabular-nums" style={{ color: C.text }}>{fmtPKR(selectedHeader.used)}</div>
              </div>
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: C.muted }}>Available</div>
                <div className="text-sm font-bold tabular-nums" style={{ color: selectedHeader.remaining < 0 ? C.red : C.green }}>{fmtPKR(selectedHeader.remaining)}</div>
              </div>
            </div>
            {segmentStats && segmentStats.budget > 0 && (
              <div className="rounded-xl px-4 py-3 grid grid-cols-3 gap-2" style={{ background: C.greenLight, border: `1px solid ${C.border}` }}>
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-wide truncate" style={{ color: C.muted }} title={segmentStats.segment}>{segmentStats.segment}</div>
                  <div className="text-sm font-bold tabular-nums" style={{ color: C.text }}>{fmtPKR(segmentStats.budget)}</div>
                </div>
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: C.muted }}>Used</div>
                  <div className="text-sm font-bold tabular-nums" style={{ color: C.text }}>{fmtPKR(segmentStats.used)}</div>
                </div>
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: C.muted }}>Available</div>
                  <div className="text-sm font-bold tabular-nums" style={{ color: segmentStats.remaining < 0 ? C.red : C.green }}>{fmtPKR(segmentStats.remaining)}</div>
                </div>
              </div>
            )}
          </div>
        )}
        <div className="sm:col-span-2">
          <Field label="Description"><input value={form.description} onChange={set("description")} placeholder="e.g. Lunch for Auto OS Team" style={inputStyle} /></Field>
        </div>
        <Field label="Amount (PKR)"><input type="number" min="0" value={form.amount} onChange={set("amount")} placeholder="0" style={inputStyle} /></Field>
        <Field label="Mode of Payment">
          <select value={form.mode} onChange={set("mode")} style={inputStyle}>
            {PAYMENT_MODES.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </Field>
        <Field label="Vendor / Purpose"><input value={form.vendor} onChange={set("vendor")} placeholder="e.g. Prompt Cafe, 140-H" style={inputStyle} /></Field>
        <Field label="BU">
          <select value={form.bu} onChange={set("bu")} style={inputStyle}>
            {BU_OPTIONS.map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
        </Field>
        <Field label="Added By">
          <select value={form.addedBy} onChange={set("addedBy")} style={inputStyle}>
            {ADDED_BY_OPTIONS.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </Field>
        <div className="sm:col-span-2">
          <Field label="Attach Image (optional)">
            {form.imageData ? (
              <div className="flex items-center gap-3 rounded-xl px-3 py-2" style={{ border: `1px solid ${C.border}` }}>
                <img src={form.imageData} alt="Receipt preview" className="w-12 h-12 object-cover rounded-lg" />
                <span className="text-xs flex-1 truncate" style={{ color: C.muted }}>{form.imageName}</span>
                <button type="button" onClick={removeImage} className="p-1.5 rounded-lg hover:bg-gray-100">
                  <X size={14} color={C.muted} />
                </button>
              </div>
            ) : (
              <input type="file" accept="image/*" onChange={onImageChange} style={inputStyle} />
            )}
          </Field>
        </div>
        <div className="sm:col-span-2">
          <Field label="Remarks (optional)"><input value={form.remarks} onChange={set("remarks")} style={inputStyle} /></Field>
        </div>
      </div>

      {segmentWillExceed && (
        <div className="flex items-start gap-2 rounded-xl px-4 py-3 mb-2" style={{ background: C.redLight }}>
          <AlertTriangle size={16} color={C.red} className="shrink-0 mt-0.5" />
          <div className="text-xs" style={{ color: "#7A241E" }}>
            <span className="font-semibold">This will exceed the {segmentStats.segment} segment budget</span> by {fmtPKR(segmentProjected - segmentStats.budget)}.
          </div>
        </div>
      )}
      {willExceed && (
        <div className="flex items-start gap-2 rounded-xl px-4 py-3 mb-2" style={{ background: C.redLight }}>
          <AlertTriangle size={16} color={C.red} className="shrink-0 mt-0.5" />
          <div className="text-xs" style={{ color: "#7A241E" }}>
            <span className="font-semibold">This will exceed the {selectedHeader.name} budget</span> by {fmtPKR(projected - selectedHeader.budget)}. The header will be marked Over Budget after saving.
          </div>
        </div>
      )}

      <div className="flex justify-end gap-3 mt-2">
        <button onClick={onClose} className="rounded-xl px-4 py-2.5 text-sm font-semibold" style={{ background: "#EEF2F0", color: C.muted }}>Cancel</button>
        <button onClick={() => onSave(form, editingId)} className="rounded-xl px-5 py-2.5 text-sm font-semibold text-white" style={{ background: C.green }}>
          {editingId ? "Save Changes" : "Add Expense"}
        </button>
      </div>
    </Modal>
  );
}

/* ---------------------------------- HEADER MODAL ---------------------------------- */
function HeaderModal({ initial, onClose, onSave }) {
  const editingId = initial?.id || null;
  const [form, setForm] = useState({
    name: initial?.name || "",
    budget: initial?.budget ?? "",
    startDate: initial?.startDate || todayISO(),
    endDate: initial?.endDate || "",
    status: initial?.status || "Active",
  });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <Modal title={editingId ? "Edit Budget Header" : "Add Budget Header"} onClose={onClose}>
      <Field label="Header Name"><input value={form.name} onChange={set("name")} placeholder="e.g. Refreshments" style={inputStyle} /></Field>
      <Field label="Allocated Budget (PKR)"><input type="number" min="0" value={form.budget} onChange={set("budget")} style={inputStyle} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Start Date"><input type="date" value={form.startDate} onChange={set("startDate")} style={inputStyle} /></Field>
        <Field label="End Date (optional)"><input type="date" value={form.endDate} onChange={set("endDate")} style={inputStyle} /></Field>
      </div>
      <Field label="Status">
        <select value={form.status} onChange={set("status")} style={inputStyle}>
          <option>Active</option>
          <option>Inactive</option>
        </select>
      </Field>
      <div className="flex justify-end gap-3 mt-2">
        <button onClick={onClose} className="rounded-xl px-4 py-2.5 text-sm font-semibold" style={{ background: "#EEF2F0", color: C.muted }}>Cancel</button>
        <button onClick={() => onSave(form, editingId)} className="rounded-xl px-5 py-2.5 text-sm font-semibold text-white" style={{ background: C.green }}>
          {editingId ? "Save Changes" : "Add Header"}
        </button>
      </div>
    </Modal>
  );
}

/* ---------------------------------- CONFIRM MODAL ---------------------------------- */
function ConfirmModal({ title, body, onCancel, onConfirm }) {
  return (
    <Modal title={title} onClose={onCancel}>
      <p className="text-sm mb-6" style={{ color: C.muted }}>{body}</p>
      <div className="flex justify-end gap-3">
        <button onClick={onCancel} className="rounded-xl px-4 py-2.5 text-sm font-semibold" style={{ background: "#EEF2F0", color: C.muted }}>Cancel</button>
        <button onClick={onConfirm} className="rounded-xl px-5 py-2.5 text-sm font-semibold text-white" style={{ background: C.red }}>Delete</button>
      </div>
    </Modal>
  );
}
