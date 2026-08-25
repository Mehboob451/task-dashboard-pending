import { useState, useEffect, useMemo } from 'react'
import { db } from './firebase'
import {
  collection, addDoc, updateDoc, deleteDoc, doc,
  onSnapshot, serverTimestamp, query, orderBy
} from 'firebase/firestore'

// ---------- helpers ----------
const todayStr = () => new Date().toISOString().slice(0, 10)
const fmtDate = (d) => {
  if (!d) return '—'
  const dt = new Date(d + 'T00:00:00')
  return dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}
const daysOverdue = (d) => {
  const diff = Math.floor((new Date(todayStr()) - new Date(d)) / 86400000)
  return diff
}
const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December']

const STATUS = {
  pending: { label: 'Pending', color: '#e8a33d', bg: '#fdf3e2' },
  followup: { label: 'Follow-up Pending', color: '#c1584f', bg: '#fbeae8' },
  completed: { label: 'Completed', color: '#2f8f7f', bg: '#e6f3f0' },
}

const TABS = [
  { id: 'reminders', label: 'Reminders', num: '01' },
  { id: 'monthly', label: 'Monthly Planner', num: '02' },
  { id: 'emails', label: 'Email Inbox', num: '03' },
  { id: 'add', label: 'New Task', num: '04' },
  { id: 'pending', label: 'All Pending', num: '05' },
  { id: 'completed', label: 'Completed Log', num: '06' },
]

export default function App() {
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('reminders')
  const [navOpen, setNavOpen] = useState(false)

  useEffect(() => {
    const q = query(collection(db, 'tasks'), orderBy('followUpDate', 'asc'))
    const unsub = onSnapshot(q, (snap) => {
      setTasks(snap.docs.map(d => ({ id: d.id, ...d.data() })))
      setLoading(false)
    })
    return () => unsub()
  }, [])

  const addTask = async (data) => {
    await addDoc(collection(db, 'tasks'), {
      ...data,
      status: 'pending',
      comment: data.comment || '',
      createdAt: serverTimestamp(),
    })
  }

  const setStatus = async (id, status) => {
    await updateDoc(doc(db, 'tasks', id), { status, updatedAt: serverTimestamp() })
  }

  const setComment = async (id, comment) => {
    await updateDoc(doc(db, 'tasks', id), { comment })
  }

  const editTask = async (id, fields) => {
    await updateDoc(doc(db, 'tasks', id), fields)
  }

  const removeTask = async (id) => {
    await deleteDoc(doc(db, 'tasks', id))
  }

  const dueToday = useMemo(() =>
    tasks.filter(t => t.status !== 'completed' && t.followUpDate <= todayStr()),
    [tasks]
  )
  const pendingCount = useMemo(() =>
    tasks.filter(t => t.status !== 'completed').length,
    [tasks]
  )

  const renderTab = () => {
    if (loading) return <div className="empty-note">Loading your dashboard…</div>
    switch (tab) {
      case 'reminders':
        return <Reminders tasks={dueToday} setStatus={setStatus} setComment={setComment} onGo={setTab} />
      case 'monthly':
        return <Monthly tasks={tasks} addTask={addTask} setStatus={setStatus} />
      case 'emails':
        return <Emails tasks={tasks.filter(t => t.source === 'email')} addTask={addTask} setStatus={setStatus} setComment={setComment} />
      case 'add':
        return <AddTask addTask={addTask} onDone={() => setTab('pending')} />
      case 'pending':
        return <Pending tasks={tasks.filter(t => t.status !== 'completed')} setStatus={setStatus} setComment={setComment} removeTask={removeTask} editTask={editTask} />
      case 'completed':
        return <CompletedLog tasks={tasks.filter(t => t.status === 'completed')} setStatus={setStatus} />
      default:
        return null
    }
  }

  return (
    <div className="shell">
      <header className="topbar">
        <button className="hamburger" onClick={() => setNavOpen(v => !v)}>☰</button>
        <div className="brand">
          <span className="brand-mark">◈</span>
          <div>
            <div className="brand-title">Pending Desk</div>
            <div className="brand-sub">{new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}</div>
          </div>
        </div>
        <div className="alert-pill" onClick={() => setTab('reminders')}>
          <span className="alert-dot" style={{ opacity: dueToday.length ? 1 : 0.25 }} />
          {dueToday.length} due now
        </div>
      </header>

      <div className="body">
        <nav className={`sidenav ${navOpen ? 'open' : ''}`}>
          {TABS.map(t => (
            <button
              key={t.id}
              className={`nav-item ${tab === t.id ? 'active' : ''}`}
              onClick={() => { setTab(t.id); setNavOpen(false) }}
            >
              <span className="nav-num">{t.num}</span>
              <span>{t.label}</span>
              {t.id === 'reminders' && dueToday.length > 0 && <span className="nav-badge">{dueToday.length}</span>}
              {t.id === 'pending' && pendingCount > 0 && <span className="nav-badge muted">{pendingCount}</span>}
            </button>
          ))}
        </nav>

        <main className="content">{renderTab()}</main>
      </div>
    </div>
  )
}

// ---------- Reminders ----------
function Reminders({ tasks, setStatus, setComment, onGo }) {
  const [note, setNote] = useState({})

  if (tasks.length === 0) {
    return (
      <Panel title="Reminders" desc="Everything due today or earlier lands here automatically. Nothing pending stays quiet, it rolls forward until you close it.">
        <div className="empty-note">✓ Nothing due right now. Anything you add will show up here on its date.</div>
      </Panel>
    )
  }

  return (
    <Panel title="Reminders" desc="Everything due today or earlier. Unfinished items carry over day after day until marked done.">
      <div className="card-list">
        {tasks.map(t => {
          const overdue = daysOverdue(t.followUpDate)
          return (
            <div key={t.id} className={`task-card ${overdue > 0 ? 'overdue' : ''}`}>
              <div className="task-card-top">
                <div>
                  <div className="task-title">{t.title}</div>
                  <div className="task-meta">
                    {t.location && <span>📍 {t.location}</span>}
                    <span>Due {fmtDate(t.followUpDate)}</span>
                    {overdue > 0 && <span className="overdue-flag">{overdue} day{overdue > 1 ? 's' : ''} overdue</span>}
                    {t.source === 'email' && <span className="email-flag">✉ from email</span>}
                  </div>
                </div>
                <StatusPill status={t.status} />
              </div>
              {t.description && <p className="task-desc">{t.description}</p>}
              <textarea
                className="comment-box"
                placeholder="Why is this still pending? Add a note…"
                defaultValue={t.comment}
                onChange={e => setNote(n => ({ ...n, [t.id]: e.target.value }))}
                onBlur={() => note[t.id] !== undefined && setComment(t.id, note[t.id])}
              />
              <div className="task-actions">
                <button className="btn btn-done" onClick={() => setStatus(t.id, 'completed')}>Mark Complete</button>
                <button className="btn btn-followup" onClick={() => setStatus(t.id, 'followup')}>Flag Follow-up</button>
              </div>
            </div>
          )
        })}
      </div>
    </Panel>
  )
}

// ---------- Monthly Planner ----------
function Monthly({ tasks, addTask, setStatus }) {
  const [cursor, setCursor] = useState(() => { const n = new Date(); return { y: n.getFullYear(), m: n.getMonth() } })
  const [selectedDay, setSelectedDay] = useState(todayStr())
  const [form, setForm] = useState({ title: '', location: '' })

  const byDate = useMemo(() => {
    const map = {}
    tasks.forEach(t => {
      if (!t.followUpDate) return
      map[t.followUpDate] = map[t.followUpDate] || []
      map[t.followUpDate].push(t)
    })
    return map
  }, [tasks])

  const firstOfMonth = new Date(cursor.y, cursor.m, 1)
  const startWeekday = firstOfMonth.getDay()
  const daysInMonth = new Date(cursor.y, cursor.m + 1, 0).getDate()
  const cells = []
  for (let i = 0; i < startWeekday; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  const dateStr = (d) => `${cursor.y}-${String(cursor.m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`

  const submit = (e) => {
    e.preventDefault()
    if (!form.title.trim()) return
    addTask({ title: form.title, location: form.location, description: '', followUpDate: selectedDay, source: 'task' })
    setForm({ title: '', location: '' })
  }

  return (
    <Panel title="Monthly Planner" desc="Place a task on any date. On that day it automatically appears in Reminders and stays until you close it.">
      <div className="month-layout">
        <div>
          <div className="month-nav">
            <button className="btn btn-ghost" onClick={() => setCursor(c => c.m === 0 ? { y: c.y - 1, m: 11 } : { y: c.y, m: c.m - 1 })}>← Prev</button>
            <div className="month-label">{MONTH_NAMES[cursor.m]} {cursor.y}</div>
            <button className="btn btn-ghost" onClick={() => setCursor(c => c.m === 11 ? { y: c.y + 1, m: 0 } : { y: c.y, m: c.m + 1 })}>Next →</button>
          </div>
          <div className="cal-grid cal-head">
            {['Su','Mo','Tu','We','Th','Fr','Sa'].map(d => <div key={d} className="cal-headcell">{d}</div>)}
          </div>
          <div className="cal-grid">
            {cells.map((d, i) => {
              if (!d) return <div key={i} className="cal-cell empty" />
              const ds = dateStr(d)
              const items = byDate[ds] || []
              const isToday = ds === todayStr()
              const isSelected = ds === selectedDay
              return (
                <button key={i} className={`cal-cell ${isToday ? 'today' : ''} ${isSelected ? 'selected' : ''}`} onClick={() => setSelectedDay(ds)}>
                  <span className="cal-daynum">{d}</span>
                  {items.length > 0 && <span className="cal-dot-row">{items.slice(0,3).map((it,idx) => <span key={idx} className="cal-dot" style={{ background: STATUS[it.status]?.color || '#e8a33d' }} />)}</span>}
                </button>
              )
            })}
          </div>
        </div>

        <div className="month-side">
          <div className="side-heading">{fmtDate(selectedDay)}</div>
          <form onSubmit={submit} className="mini-form">
            <input placeholder="Add a task for this date…" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
            <input placeholder="Where is it pending? (optional)" value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} />
            <button className="btn btn-primary" type="submit">Add to {fmtDate(selectedDay)}</button>
          </form>
          <div className="side-list">
            {(byDate[selectedDay] || []).length === 0 && <div className="empty-note small">No tasks on this date.</div>}
            {(byDate[selectedDay] || []).map(t => (
              <div key={t.id} className="mini-task">
                <div>
                  <div className="mini-title">{t.title}</div>
                  {t.location && <div className="mini-loc">📍 {t.location}</div>}
                </div>
                <StatusPill status={t.status} small />
              </div>
            ))}
          </div>
        </div>
      </div>
    </Panel>
  )
}

// ---------- Emails ----------
function Emails({ tasks, addTask, setStatus, setComment }) {
  const [form, setForm] = useState({ title: '', content: '', location: '', followUpDate: todayStr(), comment: '' })
  const [note, setNote] = useState({})

  const submit = (e) => {
    e.preventDefault()
    if (!form.title.trim()) return
    addTask({
      title: form.title,
      description: form.content,
      location: form.location,
      followUpDate: form.followUpDate,
      comment: form.comment,
      source: 'email',
    })
    setForm({ title: '', content: '', location: '', followUpDate: todayStr(), comment: '' })
  }

  return (
    <Panel title="Email Inbox" desc="Paste in an actionable email. It becomes a reminder for the date you choose, with room to note why it's stuck.">
      <form onSubmit={submit} className="stack-form">
        <input placeholder="Email subject / task name" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} required />
        <textarea placeholder="Paste the email content here…" rows={4} value={form.content} onChange={e => setForm(f => ({ ...f, content: e.target.value }))} />
        <div className="form-row">
          <input placeholder="Where / who is this pending with?" value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} />
          <input type="date" value={form.followUpDate} onChange={e => setForm(f => ({ ...f, followUpDate: e.target.value }))} />
        </div>
        <input placeholder="Comment — why is it pending? (optional)" value={form.comment} onChange={e => setForm(f => ({ ...f, comment: e.target.value }))} />
        <button className="btn btn-primary" type="submit">Add Email Reminder</button>
      </form>

      <div className="card-list" style={{ marginTop: 28 }}>
        {tasks.length === 0 && <div className="empty-note small">No email items yet.</div>}
        {tasks.map(t => (
          <div key={t.id} className="task-card">
            <div className="task-card-top">
              <div>
                <div className="task-title">✉ {t.title}</div>
                <div className="task-meta">
                  {t.location && <span>📍 {t.location}</span>}
                  <span>Follow up {fmtDate(t.followUpDate)}</span>
                </div>
              </div>
              <StatusPill status={t.status} />
            </div>
            {t.description && <p className="task-desc">{t.description}</p>}
            <textarea
              className="comment-box"
              placeholder="Why is this still pending?"
              defaultValue={t.comment}
              onChange={e => setNote(n => ({ ...n, [t.id]: e.target.value }))}
              onBlur={() => note[t.id] !== undefined && setComment(t.id, note[t.id])}
            />
            <div className="task-actions">
              <button className="btn btn-done" onClick={() => setStatus(t.id, 'completed')}>Mark Complete</button>
              <button className="btn btn-followup" onClick={() => setStatus(t.id, 'followup')}>Flag Follow-up</button>
            </div>
          </div>
        ))}
      </div>
    </Panel>
  )
}

// ---------- Add Task ----------
function AddTask({ addTask, onDone }) {
  const [form, setForm] = useState({ title: '', location: '', description: '', followUpDate: todayStr() })

  const submit = (e) => {
    e.preventDefault()
    if (!form.title.trim()) return
    addTask({ ...form, source: 'task' })
    setForm({ title: '', location: '', description: '', followUpDate: todayStr() })
    onDone()
  }

  return (
    <Panel title="New Task" desc="General intake form. Fill in what the task is, where it's stuck, and when to follow up — it'll show up in Reminders on that date.">
      <form onSubmit={submit} className="stack-form wide">
        <label className="field-label">Task name</label>
        <input placeholder="e.g. Send revised quotation to client" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} required />

        <label className="field-label">Where is it pending?</label>
        <input placeholder="e.g. Accounts team / Vendor X / My desk" value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} />

        <label className="field-label">Details</label>
        <textarea placeholder="Any extra detail…" rows={3} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />

        <label className="field-label">Follow-up date</label>
        <input type="date" value={form.followUpDate} onChange={e => setForm(f => ({ ...f, followUpDate: e.target.value }))} />

        <button className="btn btn-primary wide" type="submit">Add Task</button>
      </form>
    </Panel>
  )
}

// ---------- Pending overview ----------
function Pending({ tasks, setStatus, setComment, removeTask, editTask }) {
  const [filter, setFilter] = useState('all')
  const [note, setNote] = useState({})
  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm] = useState({ title: '', location: '', description: '', followUpDate: '' })

  const filtered = tasks.filter(t => filter === 'all' ? true : t.status === filter)
    .sort((a, b) => (a.followUpDate || '').localeCompare(b.followUpDate || ''))

  const startEdit = (t) => {
    setEditingId(t.id)
    setEditForm({
      title: t.title || '',
      location: t.location || '',
      description: t.description || '',
      followUpDate: t.followUpDate || todayStr(),
    })
  }

  const saveEdit = (id) => {
    if (!editForm.title.trim()) return
    editTask(id, editForm)
    setEditingId(null)
  }

  return (
    <Panel title="All Pending" desc="Every task still open, across reminders, planner and email — one list, sorted by date.">
      <div className="filter-row">
        {['all', 'pending', 'followup'].map(f => (
          <button key={f} className={`chip ${filter === f ? 'chip-active' : ''}`} onClick={() => setFilter(f)}>
            {f === 'all' ? 'All' : STATUS[f].label}
          </button>
        ))}
      </div>
      {filtered.length === 0 && <div className="empty-note">Nothing here — you're caught up.</div>}
      <div className="card-list">
        {filtered.map(t => {
          const overdue = daysOverdue(t.followUpDate)
          const isEditing = editingId === t.id

          if (isEditing) {
            return (
              <div key={t.id} className="task-card editing">
                <label className="field-label">Task name</label>
                <input value={editForm.title} onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))} />
                <label className="field-label">Where is it pending?</label>
                <input value={editForm.location} onChange={e => setEditForm(f => ({ ...f, location: e.target.value }))} />
                <label className="field-label">Details</label>
                <textarea rows={3} value={editForm.description} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} />
                <label className="field-label">Date</label>
                <input type="date" value={editForm.followUpDate} onChange={e => setEditForm(f => ({ ...f, followUpDate: e.target.value }))} />
                <div className="task-actions">
                  <button className="btn btn-primary" onClick={() => saveEdit(t.id)}>Save Changes</button>
                  <button className="btn btn-ghost" onClick={() => setEditingId(null)}>Cancel</button>
                </div>
              </div>
            )
          }

          return (
            <div key={t.id} className={`task-card ${overdue > 0 ? 'overdue' : ''}`}>
              <div className="task-card-top">
                <div>
                  <div className="task-title">{t.source === 'email' ? '✉ ' : ''}{t.title}</div>
                  <div className="task-meta">
                    {t.location && <span>📍 {t.location}</span>}
                    <span>Due {fmtDate(t.followUpDate)}</span>
                    {overdue > 0 && <span className="overdue-flag">{overdue}d overdue</span>}
                  </div>
                </div>
                <StatusPill status={t.status} />
              </div>
              {t.description && <p className="task-desc">{t.description}</p>}
              <textarea
                className="comment-box"
                placeholder="Why is this still pending?"
                defaultValue={t.comment}
                onChange={e => setNote(n => ({ ...n, [t.id]: e.target.value }))}
                onBlur={() => note[t.id] !== undefined && setComment(t.id, note[t.id])}
              />
              <div className="task-actions">
                <button className="btn btn-done" onClick={() => setStatus(t.id, 'completed')}>Mark Complete</button>
                <button className="btn btn-followup" onClick={() => setStatus(t.id, 'followup')}>Flag Follow-up</button>
                <button className="btn btn-ghost" onClick={() => startEdit(t)}>Edit</button>
                <button className="btn btn-ghost" onClick={() => removeTask(t.id)}>Delete</button>
              </div>
            </div>
          )
        })}
      </div>
    </Panel>
  )
}

// ---------- Completed log ----------
function CompletedLog({ tasks, setStatus }) {
  const sorted = [...tasks].sort((a, b) => (b.followUpDate || '').localeCompare(a.followUpDate || ''))
  return (
    <Panel title="Completed Log" desc="Everything you've closed out. A record of what got done, and when it was due.">
      {sorted.length === 0 && <div className="empty-note">Nothing completed yet — finished tasks land here.</div>}
      <div className="card-list">
        {sorted.map(t => (
          <div key={t.id} className="task-card completed">
            <div className="task-card-top">
              <div>
                <div className="task-title strike">{t.source === 'email' ? '✉ ' : ''}{t.title}</div>
                <div className="task-meta">
                  {t.location && <span>📍 {t.location}</span>}
                  <span>Was due {fmtDate(t.followUpDate)}</span>
                </div>
              </div>
              <StatusPill status={t.status} />
            </div>
            <div className="task-actions">
              <button className="btn btn-ghost" onClick={() => setStatus(t.id, 'pending')}>Reopen</button>
            </div>
          </div>
        ))}
      </div>
    </Panel>
  )
}

// ---------- shared bits ----------
function Panel({ title, desc, children }) {
  return (
    <div className="panel">
      <div className="panel-head">
        <h1>{title}</h1>
        <p>{desc}</p>
      </div>
      {children}
    </div>
  )
}

function StatusPill({ status, small }) {
  const s = STATUS[status] || STATUS.pending
  return <span className={`status-pill ${small ? 'small' : ''}`} style={{ color: s.color, background: s.bg }}>{s.label}</span>
}
