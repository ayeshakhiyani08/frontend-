import { useEffect, useMemo, useRef, useState } from 'react';
import { BrowserRouter, Navigate, NavLink, Outlet, Route, Routes, useNavigate, useParams } from 'react-router-dom';

const appBasename = (import.meta.env.BASE_URL || '/').replace(/\/$/, '') || '/';
import { io } from 'socket.io-client';
import { API_BASE_URL, api } from './services/api';
import './App.css';

const API_URL = API_BASE_URL;

const defaultUsers = {
  customer: { name: 'Ali Khan', email: 'customer@supportflow.com', role: 'customer' },
  agent: { name: 'Nadia Shah', email: 'agent@supportflow.com', role: 'agent' },
};

const safeJsonParse = (value) => {
  try {
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
};

const parseStoredUser = () => safeJsonParse(localStorage.getItem('supportflow-user')) || defaultUsers.customer;
const parseStoredToken = () => localStorage.getItem('supportflow-token') || '';

const fetchJson = async (url, token = '', options = {}) => {
  const headers = { ...(options.headers || {}) };

  if (!headers['Content-Type'] && !(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return fetch(url, { ...options, headers });
};

function ProtectedRoute({ isLoggedIn, children }) {
  if (!isLoggedIn) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

function RoleProtectedRoute({ isLoggedIn, user, allowedRole, children }) {
  if (!isLoggedIn) {
    return <Navigate to="/login" replace />;
  }

  if (user?.role && user.role !== allowedRole) {
    return <Navigate to={user.role === 'customer' ? '/customer/dashboard' : '/agent/dashboard'} replace />;
  }

  return children;
}

function AppShell({ user, role, onLogout }) {
  const navItems = role === 'customer'
    ? [
        { to: '/customer/tickets', label: 'My Tickets' },
        { to: '/customer/profile', label: 'Profile' },
      ]
    : [
        { to: '/agent/tickets', label: 'My Tickets' },
        { to: '/agent/profile', label: 'Profile' },
      ];

  return (
    <div className="app-shell dashboard-shell">
      <aside className="sidebar">
        <div className="brand-box">
          <span className="brand-mark">S</span>
          <div>
            <p className="eyebrow">SupportFlow</p>
            <h2>{role === 'customer' ? 'Customer' : 'Agent'}</h2>
          </div>
        </div>

        <nav className="sidebar-nav">
          {navItems.map((item) => (
            <NavLink key={item.to} to={item.to} className={({ isActive }) => (isActive ? 'sidebar-link active' : 'sidebar-link')}>
              {item.label}
            </NavLink>
          ))}
          <button type="button" className="sidebar-link logout-button" onClick={onLogout}>Logout</button>
        </nav>
      </aside>

      <div className="main-content">
        <Outlet />
      </div>
    </div>
  );
}

function DashboardHeader({ title, subtitle, showGenerateButton, searchValue, onSearchChange }) {
  return (
    <header className="dashboard-header">
      <div>
        <p className="eyebrow">Overview</p>
        <h1>{title}</h1>
      </div>

      <div className="header-actions">
        <input
          className="search-input"
          type="search"
          placeholder="Search tickets"
          aria-label="Search tickets"
          value={searchValue || ''}
          onChange={(event) => onSearchChange?.(event.target.value)}
        />
        {showGenerateButton ? (
          <NavLink to="/customer/generate-ticket" className="primary-button generate-button">Generate Ticket</NavLink>
        ) : null}
      </div>
    </header>
  );
}

function StatsGrid({ stats }) {
  return (
    <section className="stats-grid">
      {stats.map((stat) => (
        <article key={stat.label} className="metric-card">
          <span>{stat.label}</span>
          <strong>{stat.value}</strong>
          <small>{stat.meta}</small>
        </article>
      ))}
    </section>
  );
}

function TicketTable({ tickets, emptyMessage, role = 'customer', currentPage = 1, totalPages = 1, onPageChange = null }) {
  return (
    <section className="panel table-panel">
      <div className="panel-header compact">
        <div>
          <p className="eyebrow">Ticket list</p>
          <h2>{emptyMessage}</h2>
        </div>
      </div>

      <div className="table-wrap">
        <table className="ticket-table">
          <thead>
            <tr>
              <th>Ticket</th>
              <th>{role === 'customer' ? 'Title' : 'Customer'}</th>
              <th>Category</th>
              <th>Priority</th>
              <th>Status</th>
              <th>Created</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {tickets.length > 0 ? tickets.map((ticket) => (
              <tr key={ticket._id || ticket.id}>
                <td>{ticket.ticketNumber || ticket._id?.slice(-6) || 'SF-0000'}</td>
                <td>{role === 'customer' ? (ticket.title || ticket.subject) : (ticket.customerName || 'Ali Khan')}</td>
                <td>{ticket.category || 'General Support'}</td>
                <td><span className={`priority-pill ${String(ticket.priority || 'medium').toLowerCase()}`}>{ticket.priority || 'Medium'}</span></td>
                <td>{ticket.status}</td>
                <td>{formatDate(ticket.createdAt)}</td>
                <td>
                  <NavLink
                    to={role === 'customer' ? `/customer/tickets/${ticket._id}` : `/agent/tickets/${ticket._id}`}
                    className="secondary-button"
                  >
                    View
                  </NavLink>
                </td>
              </tr>
            )) : (
              <tr>
                <td colSpan={7} className="empty-row">{emptyMessage}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {onPageChange ? <PaginationRow currentPage={currentPage} totalPages={totalPages} onPageChange={onPageChange} /> : null}
    </section>
  );
}

function LandingPage({ setRole }) {
  const navigate = useNavigate();

  const handleRoleSelect = (nextRole) => {
    setRole(nextRole);
    navigate('/login');
  };

  return (
    <div className="landing-shell">
      <nav className="landing-nav">
        <div className="brand-block light-brand landing-brand">
          <span className="brand-mark">S</span>
          <div>
            <p className="eyebrow">Operations suite</p>
            <h1>SupportFlow</h1>
          </div>
        </div>

        <div className="landing-nav-actions">
          <button type="button" className="secondary-button ghost-button" onClick={() => navigate('/login')}>Login</button>
          <button type="button" className="primary-button" onClick={() => handleRoleSelect('customer')}>Get started</button>
        </div>
      </nav>

      <main className="landing-hero">
        <div className="landing-copy">
          <span className="feature-chip">AI triage + human support</span>
          <h1>Turn every complaint into a fast, confident service outcome.</h1>
          <p>
            SupportFlow helps customers raise issues, lets agents resolve them faster, and turns chaos into a clean, visible support workflow.
          </p>
          <div className="hero-actions">
            <button type="button" className="primary-button" onClick={() => handleRoleSelect('customer')}>Customer portal</button>
            <button type="button" className="secondary-button" onClick={() => handleRoleSelect('agent')}>Agent workspace</button>
          </div>

          <div className="landing-metrics">
            <div>
              <strong>4.9/5</strong>
              <span>Customer satisfaction</span>
            </div>
            <div>
              <strong>72%</strong>
              <span>Faster resolution</span>
            </div>
            <div>
              <strong>24/7</strong>
              <span>Live visibility</span>
            </div>
          </div>
        </div>

        <div className="landing-visual" aria-label="Dashboard preview">
          <div className="workspace-card">
            <div className="window-bar">
              <span className="dot red" />
              <span className="dot yellow" />
              <span className="dot green" />
            </div>

            <div className="workspace-header">
              <div>
                <small>Support queue</small>
                <strong>Live operations</strong>
              </div>
              <span className="status-badge pending-ticket">12 new</span>
            </div>

            <div className="mini-dashboard-grid">
              <div className="mini-panel blue">
                <span>Total tickets</span>
                <strong>428</strong>
              </div>
              <div className="mini-panel green">
                <span>Resolved</span>
                <strong>320</strong>
              </div>
            </div>

            <div className="ticket-preview-list">
              <div className="ticket-preview active">
                <div>
                  <strong>SF-1024</strong>
                  <small>Kitchen sink leak</small>
                </div>
                <span className="priority-pill medium">Medium</span>
              </div>
              <div className="ticket-preview">
                <div>
                  <strong>SF-1027</strong>
                  <small>Power outage</small>
                </div>
                <span className="priority-pill high">High</span>
              </div>
              <div className="ticket-preview">
                <div>
                  <strong>SF-1031</strong>
                  <small>AC not cooling</small>
                </div>
                <span className="priority-pill low">Low</span>
              </div>
            </div>
          </div>
        </div>
      </main>

      <section className="feature-grid">
        <article className="feature-card">
          <div className="icon-badge">AI</div>
          <h3>Smart triage</h3>
          <p>Complaint descriptions are classified into the right category and urgency without manual guesswork.</p>
        </article>
        <article className="feature-card">
          <div className="icon-badge">RT</div>
          <h3>Real-time routing</h3>
          <p>Agents see new tickets instantly and customer updates arrive without page refreshes.</p>
        </article>
        <article className="feature-card">
          <div className="icon-badge">UX</div>
          <h3>Fast collaboration</h3>
          <p>Clear conversations, action history, and status controls keep everyone aligned on the same ticket.</p>
        </article>
      </section>
    </div>
  );
}

function LoginPage({ role, setRole, onLogin }) {
  const navigate = useNavigate();

  const submitLogin = async (event) => {
    const ok = await onLogin(event);
    if (ok) {
      navigate(role === 'customer' ? '/customer/dashboard' : '/agent/dashboard');
    }
  };

  return (
    <div className="auth-shell">
      <div className="auth-layout">
        <aside className="auth-hero">
          <div className="brand-block light-brand">
            <span className="brand-mark">S</span>
            <div>
              <p className="eyebrow">Ticket intelligence</p>
              <h1>SupportFlow</h1>
            </div>
          </div>

          <div className="hero-copy">
            <h2>Faster issue resolution for every customer concern.</h2>
            <p>Track complaints, route them to the right team, and give customers a clearer support experience.</p>
          </div>

          <ul className="auth-features">
            <li>AI-powered complaint triage</li>
            <li>Dedicated customer and agent workflows</li>
            <li>Live updates and ticket conversations</li>
          </ul>

          <div className="mini-stat-grid">
            <div>
              <strong>24/7</strong>
              <span>Support visibility</span>
            </div>
            <div>
              <strong>AI</strong>
              <span>Issue analysis</span>
            </div>
          </div>
        </aside>

        <div className="auth-card">
          <div className="auth-card-header">
            <p className="eyebrow">Welcome back</p>
            <h2>{role === 'customer' ? 'Customer login' : 'Agent login'}</h2>
          </div>

          <form onSubmit={submitLogin} className="auth-form">
            <div className="role-switch" aria-label="User role switcher">
              <button type="button" className={role === 'customer' ? 'role-button active' : 'role-button'} onClick={() => setRole('customer')}>
                Customer
              </button>
              <button type="button" className={role === 'agent' ? 'role-button active' : 'role-button'} onClick={() => setRole('agent')}>
                Agent
              </button>
            </div>

            <label>
              Email
              <input key={`login-email-${role}`} name="email" type="email" defaultValue={role === 'customer' ? defaultUsers.customer.email : defaultUsers.agent.email} />
            </label>
            <label>
              Password
              <input key={`login-password-${role}`} name="password" type="password" defaultValue={role === 'customer' ? 'Customer123!' : 'Agent123!'} />
            </label>

            <button type="submit" className="primary-button full-width">Login</button>

            <p className="auth-switch-text">
              Don&apos;t have an account?{' '}
              <NavLink to="/register">Register</NavLink>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}

function RegisterPage({ role, setRole, onRegister }) {
  const navigate = useNavigate();

  const onSubmit = async (event) => {
    const success = await onRegister(event);
    if (success) {
      navigate(role === 'customer' ? '/customer/dashboard' : '/agent/dashboard');
    }
  };

  return (
    <div className="auth-shell">
      <div className="auth-layout">
        <aside className="auth-hero">
          <div className="brand-block light-brand">
            <span className="brand-mark">S</span>
            <div>
              <p className="eyebrow">New account</p>
              <h1>SupportFlow</h1>
            </div>
          </div>

          <div className="hero-copy">
            <h2>Build a smarter support system from day one.</h2>
            <p>Create your customer or agent profile and start managing support requests with live updates.</p>
          </div>

          <ul className="auth-features">
            <li>Track ticket progress in one place</li>
            <li>Route issues based on role permissions</li>
            <li>Review AI suggestions and action history</li>
          </ul>

          <div className="mini-stat-grid">
            <div>
              <strong>1 click</strong>
              <span>Ticket creation</span>
            </div>
            <div>
              <strong>Live</strong>
              <span>Case updates</span>
            </div>
          </div>
        </aside>

        <div className="auth-card">
          <div className="auth-card-header">
            <p className="eyebrow">Create account</p>
            <h2>{role === 'customer' ? 'Customer signup' : 'Agent signup'}</h2>
          </div>

          <form onSubmit={onSubmit} className="auth-form">
            <div className="role-switch" aria-label="User role switcher">
              <button type="button" className={role === 'customer' ? 'role-button active' : 'role-button'} onClick={() => setRole('customer')}>
                Customer
              </button>
              <button type="button" className={role === 'agent' ? 'role-button active' : 'role-button'} onClick={() => setRole('agent')}>
                Agent
              </button>
            </div>

            <label>
              Full name
              <input name="name" type="text" placeholder="Enter your name" />
            </label>
            <label>
              Email
              <input name="email" type="email" placeholder="you@example.com" />
            </label>
            <label>
              Password
              <input name="password" type="password" placeholder="Create a password" />
            </label>

            <button type="submit" className="primary-button full-width">Register</button>

            <p className="auth-switch-text">
              Already have an account?{' '}
              <NavLink to="/login">Login</NavLink>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}

function useTickets(token, refreshKey = 0, user = null) {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) {
      setTickets([]);
      return;
    }

    let isMounted = true;
    const load = async () => {
      setLoading(true);
      setError('');

      try {
        const endpoint = user?.role === 'customer' ? `${API_URL}/customer/tickets` : `${API_URL}/agent/tickets`;

        const response = await fetch(endpoint, { headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` } });
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload?.message || 'Unable to load tickets.');
        }

        if (isMounted) {
          setTickets(payload);
        }
      } catch (loadError) {
        if (isMounted) {
          setError(loadError.message);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    load();
    return () => {
      isMounted = false;
    };
  }, [token, refreshKey, user]);

  return { tickets, loading, error };
}

function formatDate(value) {
  if (!value) return 'N/A';
  return new Date(value).toLocaleString();
}

function Toaster({ toast, onClose }) {
  if (!toast) return null;

  return (
    <div className={`toast toast-${toast.type}`} role="status" aria-live="polite">
      <span>{toast.message}</span>
      <button type="button" onClick={onClose} aria-label="Close notification">ï¿½</button>
    </div>
  );
}

function TicketMessageThread({ ticketId, token, currentUser, showToast, refreshKey }) {
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!ticketId || !token) {
      setMessages([]);
      return;
    }

    let ignore = false;

    const loadMessages = async () => {
      try {
        const response = await fetchJson(`${API_URL}/complaints/${ticketId}/messages`, token);
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload.message || 'Unable to load messages.');
        }

        if (!ignore) {
          setMessages(payload);
        }
      } catch (error) {
        console.error(error);
      }
    };

    loadMessages();
    return () => {
      ignore = true;
    };
  }, [ticketId, token, refreshKey]);

  const sendMessage = async () => {
    if (!draft.trim()) {
      showToast?.('error', 'Message is required.');
      return;
    }

    try {
      setLoading(true);
      const response = await fetchJson(`${API_URL}/complaints/${ticketId}/messages`, token, {
        method: 'POST',
        body: JSON.stringify({ message: draft }),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.message || 'Message failed.');
      }

      setMessages((previous) => [...previous, payload]);
      setDraft('');
      showToast?.('success', 'Message sent successfully.');
    } catch (error) {
      showToast?.('error', error.message || 'Message failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <article className="case-card" style={{ marginTop: '18px' }}>
      <h3>Ticket chat</h3>
      <div className="message-thread">
        {messages.length === 0 ? (
          <p className="empty-state">No messages yet.</p>
        ) : (
          messages.map((message) => {
            const isMine = message.senderId === currentUser?.id || message.senderRole === currentUser?.role;
            return (
              <div key={message._id || `${message.createdAt}-${message.senderRole}`} className={`message-bubble ${isMine ? 'mine' : 'other'}`}>
                <div className="message-meta">
                  <strong>{message.senderRole === 'customer' ? 'Customer' : 'Agent'}</strong>
                  <span>{formatDate(message.createdAt)}</span>
                </div>
                <p>{message.message}</p>
              </div>
            );
          })
        )}
      </div>

      <div className="chat-composer" style={{ marginTop: '14px' }}>
        <textarea value={draft} onChange={(event) => setDraft(event.target.value)} rows="3" placeholder="Write a message" />
        <button type="button" className="primary-button" onClick={sendMessage} disabled={loading}>
          {loading ? 'Sending...' : 'Send message'}
        </button>
      </div>
    </article>
  );
}

function getPageNumbers(currentPage, totalPages) {
  const pages = [];
  for (let index = 1; index <= totalPages; index += 1) {
    pages.push(index);
  }
  return pages;
}

function PaginationRow({ currentPage, totalPages, onPageChange }) {
  if (totalPages <= 1) {
    return null;
  }

  return (
    <div className="pagination-row">
      <button type="button" className="secondary-button" onClick={() => onPageChange(currentPage - 1)} disabled={currentPage === 1}>Previous</button>
      <div className="page-number-group">
        {getPageNumbers(currentPage, totalPages).map((page) => (
          <button
            key={page}
            type="button"
            className={page === currentPage ? 'primary-button page-button active' : 'secondary-button page-button'}
            onClick={() => onPageChange(page)}
          >
            {page}
          </button>
        ))}
      </div>
      <button type="button" className="secondary-button" onClick={() => onPageChange(currentPage + 1)} disabled={currentPage === totalPages}>Next</button>
    </div>
  );
}

function CustomerDashboardPage({ user, token, refreshKey, showToast }) {
  const { tickets, loading, error } = useTickets(token, refreshKey, user);
  const customerTickets = useMemo(
    () => tickets.filter((ticket) => {
      const matchesCustomerId = ticket.customerId && user.id && String(ticket.customerId) === String(user.id);
      const matchesEmail = ticket.email?.toLowerCase() === String(user.email || '').toLowerCase();
      const matchesName = ticket.customerName === user.name;
      return matchesCustomerId || matchesEmail || matchesName;
    }),
    [tickets, user]
  );

  const pending = customerTickets.filter((ticket) => ticket.status === 'Pending').length;
  const inProgress = customerTickets.filter((ticket) => ['Accepted', 'In Progress'].includes(ticket.status)).length;
  const completed = customerTickets.filter((ticket) => ticket.status === 'Completed').length;

  return (
    <main className="dashboard-page">
      <DashboardHeader title="Customer Dashboard" showGenerateButton={true} />
      <StatsGrid
        stats={[
          { label: 'Total Tickets', value: customerTickets.length, meta: 'All complaints' },
          { label: 'Pending Tickets', value: pending, meta: 'Awaiting review' },
          { label: 'In Progress Tickets', value: inProgress, meta: 'Active cases' },
          { label: 'Completed Tickets', value: completed, meta: 'Resolved' },
        ]}
      />
      {loading ? <div className="loading-state">Loading tickets...</div> : null}
      {error ? <div className="error-state">{error}</div> : null}
      <TicketTable tickets={customerTickets} emptyMessage="No tickets yet" role="customer" />
    </main>
  );
}

function GenerateTicketPage({ user, token, showToast }) {
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState({
    title: '',
    complaint: '',
    address: '',
    image: '',
    priority: 'High',
  });

  const submitTicket = async (event) => {
    event.preventDefault();
    setError('');

    if (!form.title.trim()) {
      setError('Title is required.');
      showToast?.('error', 'Title is required.');
      return;
    }

    if (form.complaint.trim().length < 15) {
      setError('Complaint must be at least 15 characters long.');
      showToast?.('error', 'Complaint must be at least 15 characters long.');
      return;
    }

    try {
      setIsSubmitting(true);
      const response = await fetchJson(`${API_URL}/customer/complaints`, token, {
        method: 'POST',
        body: JSON.stringify({
          title: form.title,
          complaint: form.complaint,
          address: form.address,
          image: form.image,
          priority: form.priority,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.message || 'Ticket submission failed.');
      }

      setSubmitted(true);
      setForm({ title: '', complaint: '', address: '', image: '', priority: 'High' });
      showToast?.('success', 'Ticket submitted successfully.');
    } catch (submitError) {
      const message = submitError.message || 'Ticket submission failed.';
      setError(message);
      showToast?.('error', message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="ticket-shell">
      <aside className="ticket-hero">
        <p className="eyebrow">Complaint intake</p>
        <h2>Submit a new support request</h2>
        <p className="ticket-hero-copy">
          Share the issue details and weï¿½ll triage it automatically to the right category and urgency.
        </p>

        <div className="ticket-checklist">
          <div>
            <strong>1.</strong>
            <span>Describe what happened.</span>
          </div>
          <div>
            <strong>2.</strong>
            <span>Add your service address.</span>
          </div>
          <div>
            <strong>3.</strong>
            <span>Track the ticket until resolution.</span>
          </div>
        </div>
      </aside>

      <section className="ticket-form-panel panel">
        <div className="panel-header compact">
          <div>
            <p className="eyebrow">New complaint</p>
            <h2>Generate ticket</h2>
          </div>
        </div>

        <form className="complaint-form" onSubmit={submitTicket}>
          <label>
            Complaint title
            <input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="Water supply issue" required />
          </label>

          <label>
            Detailed complaint
            <textarea value={form.complaint} onChange={(event) => setForm({ ...form, complaint: event.target.value })} rows="5" placeholder="Describe the problem in detail" required minLength={15} />
          </label>

          <label>
            Address / Location
            <input value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} placeholder="Plot 12, Gulshan, Karachi" />
          </label>

          <label>
            Optional image URL
            <input value={form.image} onChange={(event) => setForm({ ...form, image: event.target.value })} placeholder="https://example.com/image.jpg" />
          </label>

          <div className="field-row two-columns">
            <label>
              Priority
              <select value={form.priority} onChange={(event) => setForm({ ...form, priority: event.target.value })}>
                <option>Low</option>
                <option>Medium</option>
                <option>High</option>
                <option>Critical</option>
              </select>
            </label>
          </div>

          <button type="submit" className="primary-button submit-button" disabled={isSubmitting}>
            {isSubmitting ? 'Submitting...' : 'Submit ticket'}
          </button>
        </form>

        {error ? <p className="message error" style={{ marginTop: '18px' }}>{error}</p> : null}
        {submitted ? (
          <div className="message success" style={{ marginTop: '18px' }}>
            Ticket submitted successfully. Your unique ticket number has been assigned and is now pending review.
          </div>
        ) : null}
      </section>
    </main>
  );
}

function CustomerTicketsPage({ user, token, refreshKey, showToast }) {
  const { tickets, loading, error } = useTickets(token, refreshKey, user);
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const customerTickets = useMemo(
    () => tickets.filter((ticket) => {
      const matchesCustomerId = ticket.customerId && user.id && String(ticket.customerId) === String(user.id);
      const matchesEmail = ticket.email?.toLowerCase() === String(user.email || '').toLowerCase();
      const matchesName = ticket.customerName === user.name;
      return matchesCustomerId || matchesEmail || matchesName;
    }),
    [tickets, user]
  );

  const filteredTickets = useMemo(() => {
    const value = search.trim().toLowerCase();
    if (!value) return customerTickets;

    return customerTickets.filter((ticket) => [
      ticket.ticketNumber,
      ticket.title,
      ticket.category,
      ticket.status,
      ticket.complaint,
    ].some((entry) => String(entry || '').toLowerCase().includes(value)));
  }, [customerTickets, search]);

  const pageSize = 10;
  const totalPages = Math.max(1, Math.ceil(filteredTickets.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const currentTickets = filteredTickets.slice((safeCurrentPage - 1) * pageSize, safeCurrentPage * pageSize);

  useEffect(() => {
    setCurrentPage(1);
  }, [search]);

  return (
    <main className="dashboard-page">
      <DashboardHeader title="My Tickets" showGenerateButton={true} searchValue={search} onSearchChange={setSearch} />
      {loading ? <div className="loading-state">Loading tickets...</div> : null}
      {error ? <div className="error-state">{error}</div> : null}
      <TicketTable
        tickets={currentTickets}
        emptyMessage="No customer tickets found"
        role="customer"
        currentPage={safeCurrentPage}
        totalPages={totalPages}
        onPageChange={setCurrentPage}
      />
    </main>
  );
}

function CustomerTicketDetailsPage({ user, token, refreshKey, showToast }) {
  const { id } = useParams();
  const { tickets } = useTickets(token, refreshKey, user);
  const [cancelMessage, setCancelMessage] = useState('');
  const [canceling, setCanceling] = useState(false);
  const [ticketState, setTicketState] = useState(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewText, setReviewText] = useState('');
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const ticket = tickets.find((item) => item._id === id);

  useEffect(() => {
    setTicketState(ticket || null);
  }, [ticket]);

  const activeTicket = ticketState || ticket;

  const cancelTicket = async () => {
    if (!activeTicket || activeTicket.status !== 'Pending') {
      setCancelMessage('Only pending tickets can be cancelled.');
      showToast?.('error', 'Only pending tickets can be cancelled.');
      return;
    }

    try {
      setCanceling(true);
      const response = await fetchJson(`${API_URL}/complaints/${id}/cancel`, token, { method: 'PATCH' });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.message || 'Could not cancel ticket.');
      }

      setCancelMessage('Ticket cancelled successfully.');
      setTicketState({ ...activeTicket, status: 'Cancelled', decision: 'Cancelled' });
      showToast?.('success', 'Ticket cancelled successfully.');
    } catch (error) {
      const message = error.message || 'Unable to cancel ticket.';
      setCancelMessage(message);
      showToast?.('error', message);
    } finally {
      setCanceling(false);
    }
  };

  const submitReview = async () => {
    if (!activeTicket || activeTicket.status !== 'Completed') {
      showToast?.('error', 'Reviews can only be submitted for completed tickets.');
      return;
    }

    if (!reviewText.trim()) {
      showToast?.('error', 'Review message is required.');
      return;
    }

    try {
      setReviewSubmitting(true);
      const response = await fetchJson(`${API_URL}/complaints/${id}/review`, token, {
        method: 'PATCH',
        body: JSON.stringify({ rating: reviewRating, review: reviewText }),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.message || 'Review submission failed.');
      }

      setTicketState({ ...activeTicket, rating: reviewRating, review: reviewText });
      setReviewText('');
      showToast?.('success', 'Your review has been submitted.');
    } catch (error) {
      showToast?.('error', error.message || 'Review submission failed.');
    } finally {
      setReviewSubmitting(false);
    }
  };

  if (!activeTicket) {
    return <main className="panel"><h2>Ticket not found</h2></main>;
  }

  return (
    <main className="panel" style={{ maxWidth: '900px', margin: '0 auto' }}>
      <div className="panel-header compact">
        <div>
          <p className="eyebrow">Ticket details</p>
          <h2>{activeTicket.title || activeTicket.subject}</h2>
        </div>
        <span className={`priority-pill ${String(activeTicket.priority || 'medium').toLowerCase()}`}>{activeTicket.priority || 'Medium'}</span>
      </div>

      <div className="case-list">
        <article className="case-card">
          <p><strong>Ticket number:</strong> {activeTicket.ticketNumber || 'SF-1001'}</p>
          <p><strong>Customer:</strong> {activeTicket.customerName || user.name}</p>
          <p><strong>Status:</strong> {activeTicket.status}</p>
          <p><strong>Assigned to:</strong> {activeTicket.assignedTo || 'Waiting for assignment'}</p>
          <p><strong>Category:</strong> {activeTicket.category || 'General Support'}</p>
          <p><strong>Created:</strong> {formatDate(activeTicket.createdAt)}</p>
          <p><strong>Updated:</strong> {formatDate(activeTicket.updatedAt)}</p>
          <p><strong>Description:</strong> {activeTicket.complaint || activeTicket.description}</p>
          <p><strong>Address:</strong> {activeTicket.address || 'Not provided'}</p>
          <p><strong>Suggested Category:</strong> {activeTicket.aiSuggestion?.category || activeTicket.category || 'General'}</p>
          <p><strong>Suggested Priority:</strong> {activeTicket.aiSuggestion?.priority || activeTicket.priority || 'Medium'}</p>
          <p><strong>Short Summary:</strong> {activeTicket.aiSuggestion?.summary || activeTicket.aiSummary || 'AI analysis needs agent review.'}</p>

          {activeTicket.status === 'Pending' ? (
            <button type="button" className="primary-button" onClick={cancelTicket} disabled={canceling}>
              {canceling ? 'Cancelling...' : 'Cancel ticket'}
            </button>
          ) : null}

          {cancelMessage ? <p className="message success" style={{ marginTop: '16px' }}>{cancelMessage}</p> : null}

          {activeTicket.review ? (
            <div className="review-result">
              <strong>Customer review: {activeTicket.rating}/5</strong>
              <p>{activeTicket.review}</p>
            </div>
          ) : null}
        </article>

        {activeTicket.status === 'Completed' && !(activeTicket.review || activeTicket.rating != null) ? (
          <article className="case-card" style={{ marginTop: '18px' }}>
            <h3>Rate this support</h3>
            <label>
              Rating
              <select value={reviewRating} onChange={(event) => setReviewRating(Number(event.target.value))}>
                {[1, 2, 3, 4, 5].map((value) => (
                  <option key={value} value={value}>{value} star{value > 1 ? 's' : ''}</option>
                ))}
              </select>
            </label>
            <label style={{ marginTop: '10px', display: 'block' }}>
              Review
              <textarea value={reviewText} onChange={(event) => setReviewText(event.target.value)} rows="4" placeholder="Tell us how the support experience was" />
            </label>
            <button type="button" className="primary-button" onClick={submitReview} disabled={reviewSubmitting} style={{ marginTop: '12px' }}>
              {reviewSubmitting ? 'Submitting...' : 'Submit Review'}
            </button>
          </article>
        ) : null}

        <TicketMessageThread ticketId={id} token={token} currentUser={user} showToast={showToast} refreshKey={refreshKey} />
      </div>
    </main>
  );
}

function CustomerProfilePage({ user }) {
  return (
    <main className="dashboard-page">
      <DashboardHeader title="Profile" />
      <section className="panel table-panel profile-panel">
        <div className="panel-header compact">
          <div>
            <p className="eyebrow">Account</p>
            <h2>Customer profile</h2>
          </div>
        </div>

        <div className="profile-grid">
          <div className="profile-item"><label>Name</label><strong>{user.name}</strong></div>
          <div className="profile-item"><label>Email</label><strong>{user.email}</strong></div>
          <div className="profile-item"><label>Role</label><strong>{user.role}</strong></div>
          <div className="profile-item"><label>Member since</label><strong>2026</strong></div>
        </div>
      </section>
    </main>
  );
}

function AgentDashboardPage({ user, token, refreshKey, showToast }) {
  const { tickets, loading, error } = useTickets(token, refreshKey, user);
  const assigned = useMemo(() => tickets || [], [tickets]);

  const pending = assigned.filter((ticket) => ticket.status === 'Pending').length;
  const accepted = assigned.filter((ticket) => ticket.status === 'Accepted').length;
  const inProgress = assigned.filter((ticket) => ticket.status === 'In Progress').length;
  const completed = assigned.filter((ticket) => ticket.status === 'Completed').length;

  return (
    <main className="dashboard-page">
      <DashboardHeader title="Agent Dashboard" />
      <StatsGrid
        stats={[
          { label: 'Total Assigned', value: assigned.length, meta: 'Active queue' },
          { label: 'Pending', value: pending, meta: 'Awaiting action' },
          { label: 'Accepted', value: accepted, meta: 'Queued' },
          { label: 'In Progress', value: inProgress, meta: 'Working' },
          { label: 'Completed', value: completed, meta: 'Resolved' },
        ]}
      />
      {loading ? <div className="loading-state">Loading tickets...</div> : null}
      {error ? <div className="error-state">{error}</div> : null}
      <TicketTable tickets={assigned} emptyMessage="No assigned tickets" role="agent" />
    </main>
  );
}

function AgentTicketsPage({ user, token, refreshKey, showToast }) {
  const { tickets, loading, error } = useTickets(token, refreshKey, user);
  const [filter, setFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  const assigned = useMemo(() => tickets || [], [tickets]);

  const filteredTickets = useMemo(() => {
    const searchValue = search.trim().toLowerCase();
    return assigned.filter((ticket) => {
      const matchesFilter = filter === 'All' || ticket.status === filter;
      const matchesSearch = !searchValue || [
        ticket.ticketNumber,
        ticket.customerName,
        ticket.title || ticket.subject,
        ticket.category,
        ticket.status,
      ].some((value) => String(value || '').toLowerCase().includes(searchValue));

      return matchesFilter && matchesSearch;
    });
  }, [assigned, filter, search]);

  const pageSize = 10;
  const totalPages = Math.max(1, Math.ceil(filteredTickets.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const currentTickets = filteredTickets.slice((safeCurrentPage - 1) * pageSize, safeCurrentPage * pageSize);

  useEffect(() => { setCurrentPage(1); }, [filter, search]);

  return (
    <main className="dashboard-page">
      <DashboardHeader title="My Assigned Tickets" searchValue={search} onSearchChange={setSearch} />
      <section className="panel" style={{ marginBottom: '20px' }}>
        <div className="panel-header compact">
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            {['All', 'Pending', 'Accepted', 'In Progress', 'Completed', 'Rejected'].map((option) => (
              <button
                type="button"
                key={option}
                className={filter === option ? 'primary-button' : 'secondary-button'}
                onClick={() => setFilter(option)}
                style={{ minWidth: '110px' }}
              >
                {option}
              </button>
            ))}
          </div>
        </div>
      </section>
      {loading ? <div className="loading-state">Loading tickets...</div> : null}
      {error ? <div className="error-state">{error}</div> : null}
      <TicketTable
        tickets={currentTickets}
        emptyMessage="No assigned tickets yet"
        role="agent"
        currentPage={safeCurrentPage}
        totalPages={totalPages}
        onPageChange={setCurrentPage}
      />
    </main>
  );
}

function AgentTicketDetailsPage({ user, token, refreshKey, showToast }) {
  const { id } = useParams();
  const { tickets } = useTickets(token, refreshKey, user);
  const [priority, setPriority] = useState('Medium');
  const [rejectionReason, setRejectionReason] = useState('');
  const [completionNote, setCompletionNote] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [ticketState, setTicketState] = useState(null);
  const ticket = tickets.find((item) => item._id === id);

  useEffect(() => {
    setTicketState(ticket || null);
  }, [ticket]);

  const activeTicket = ticketState || ticket;

  const refreshTicket = async (response) => {
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.message || 'Action failed.');
    }

    setTicketState(payload);
    const successMessage = payload.status === 'Accepted'
      ? 'Ticket accepted successfully.'
      : payload.status === 'Rejected'
        ? 'Ticket rejected successfully.'
        : `Status updated to ${payload.status}.`;
    setMessage(successMessage);
    showToast?.('success', successMessage);
  };

  const acceptTicket = async () => {
    if (!activeTicket) return;
    setLoading(true);
    try {
      const response = await fetchJson(`${API_URL}/complaints/${id}/decision`, token, {
        method: 'PATCH',
        body: JSON.stringify({ decision: 'accept', agentName: user.name, priority }),
      });
      await refreshTicket(response);
    } catch (error) {
      const errorMessage = error.message || 'Unable to accept ticket.';
      setMessage(errorMessage);
      showToast?.('error', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const rejectTicket = async () => {
    if (!activeTicket) return;
    if (!rejectionReason.trim()) {
      const errorMessage = 'Rejection reason is required.';
      setMessage(errorMessage);
      showToast?.('error', errorMessage);
      return;
    }

    setLoading(true);
    try {
      const response = await fetchJson(`${API_URL}/complaints/${id}/decision`, token, {
        method: 'PATCH',
        body: JSON.stringify({ decision: 'reject', agentName: user.name, rejectionReason }),
      });
      await refreshTicket(response);
    } catch (error) {
      const errorMessage = error.message || 'Unable to reject ticket.';
      setMessage(errorMessage);
      showToast?.('error', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (nextStatus) => {
    if (!activeTicket) return;

    if (nextStatus === 'Completed' && !completionNote.trim()) {
      const errorMessage = 'Completion note is required before completing a ticket.';
      setMessage(errorMessage);
      showToast?.('error', errorMessage);
      return;
    }

    setLoading(true);
    try {
      const response = await fetchJson(`${API_URL}/complaints/${id}/status`, token, {
        method: 'PATCH',
        body: JSON.stringify({
          status: nextStatus,
          completionNote: nextStatus === 'Completed' ? completionNote : undefined,
          resolutionNote: nextStatus === 'Completed' ? completionNote : undefined,
        }),
      });
      await refreshTicket(response);
    } catch (error) {
      const errorMessage = error.message || 'Unable to update status.';
      setMessage(errorMessage);
      showToast?.('error', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  if (!activeTicket) {
    return <main className="panel"><h2>Ticket not found</h2></main>;
  }

  const history = [
    { label: 'Created', value: formatDate(activeTicket.createdAt) },
    { label: 'Pending', value: activeTicket.status === 'Pending' ? 'Awaiting action' : 'Handled' },
    { label: 'Accepted', value: ['Accepted', 'In Progress', 'Completed'].includes(activeTicket.status) ? 'Accepted by agent' : 'Not accepted yet' },
    { label: 'In Progress', value: ['In Progress', 'Completed'].includes(activeTicket.status) ? 'Work started' : 'Not started yet' },
    { label: 'Completed', value: activeTicket.status === 'Completed' ? 'Closed successfully' : 'Open' },
  ];

  return (
    <main className="panel" style={{ maxWidth: '900px', margin: '0 auto' }}>
      <div className="panel-header compact">
        <div>
          <p className="eyebrow">Ticket detail</p>
          <h2>{activeTicket.title || activeTicket.subject}</h2>
        </div>
        <span className={`priority-pill ${String(activeTicket.priority || 'medium').toLowerCase()}`}>{activeTicket.priority || 'Medium'}</span>
      </div>

      <div className="case-list">
        <article className="case-card">
          <p><strong>Ticket number:</strong> {activeTicket.ticketNumber || 'SF-1001'}</p>
          <p><strong>Customer name:</strong> {activeTicket.customerName}</p>
          <p><strong>Email:</strong> {activeTicket.email}</p>
          <p><strong>Complaint:</strong> {activeTicket.complaint || activeTicket.description}</p>
          <p><strong>Address:</strong> {activeTicket.address || 'Not provided'}</p>
          <p><strong>AI category:</strong> {activeTicket.aiSuggestion?.category || activeTicket.category || 'General'}</p>
          <p><strong>AI priority:</strong> {activeTicket.aiSuggestion?.priority || activeTicket.priority || 'Medium'}</p>
          <p><strong>AI summary:</strong> {activeTicket.aiSuggestion?.summary || activeTicket.aiSummary || 'AI analysis needs agent review.'}</p>
          <p><strong>Current status:</strong> {activeTicket.status}</p>
        </article>

        <article className="case-card" style={{ marginTop: '18px' }}>
          <h3>Ticket history</h3>
          <ul>
            {history.map((entry) => (
              <li key={entry.label}><strong>{entry.label}:</strong> {entry.value}</li>
            ))}
          </ul>
        </article>

        {(activeTicket.status === 'Pending' || activeTicket.status === 'Accepted' || activeTicket.status === 'In Progress') ? (
          <article className="case-card agent-actions" style={{ marginTop: '18px' }}>
            <div className="action-panel">
              <h3>Take action</h3>

              {activeTicket.status === 'Pending' && (
                <div className="action-card">
                  <label>
                    Priority
                    <select value={priority} onChange={(event) => setPriority(event.target.value)}>
                      <option>Low</option>
                      <option>Medium</option>
                      <option>High</option>
                    </select>
                  </label>

                  <label style={{ marginTop: 12 }}>
                    Rejection reason (required to reject)
                    <textarea value={rejectionReason} onChange={(event) => setRejectionReason(event.target.value)} rows="3" placeholder="Explain why this ticket is rejected" />
                  </label>

                  <div className="action-row">
                    <button type="button" className="primary-button action-cta" onClick={acceptTicket} disabled={loading}>Accept ticket</button>
                    <button type="button" className="secondary-button action-cta" onClick={rejectTicket} disabled={loading}>Reject ticket</button>
                  </div>
                </div>
              )}

              {activeTicket.status === 'Accepted' && (
                <div className="action-card">
                  <p className="muted">Ticket is accepted. Move it into the work queue when ready.</p>
                  <div className="action-row" style={{ marginTop: 12 }}>
                    <button type="button" className="primary-button action-cta" onClick={() => updateStatus('In Progress')} disabled={loading}>Move to In Progress</button>
                  </div>
                </div>
              )}

              {activeTicket.status === 'In Progress' && (
                <div className="action-card">
                  <label>
                    Completion note
                    <textarea value={completionNote} onChange={(event) => setCompletionNote(event.target.value)} rows="4" placeholder="Describe the resolution before marking completed" />
                  </label>

                  <div className="action-row">
                    <button type="button" className="primary-button action-cta" onClick={() => updateStatus('Completed')} disabled={loading}>Mark as Completed</button>
                  </div>
                </div>
              )}
            </div>

            <aside className="action-summary">
              <h4>Quick summary</h4>
              <p><strong>Assigned to:</strong> {activeTicket.assignedTo || 'Unassigned'}</p>
              <p><strong>AI suggestion:</strong> {activeTicket.aiSuggestion?.summary || activeTicket.aiSummary || 'ï¿½'}</p>
              <p><strong>SLA:</strong> {activeTicket.slaHours || 'N/A'} hours</p>

              <div style={{ marginTop: 12 }}>
                <h5>History</h5>
                <ul className="history-list">
                  <li>Created: {formatDate(activeTicket.createdAt)}</li>
                  <li>Last updated: {formatDate(activeTicket.updatedAt)}</li>
                  <li>Status: <span className={`status-badge ${String(activeTicket.status).toLowerCase().replace(/ /g, '-')}`}>{activeTicket.status}</span></li>
                </ul>
              </div>
            </aside>
          </article>
        ) : null}

        {message ? <p className="message success" style={{ marginTop: '18px' }}>{message}</p> : null}
        <TicketMessageThread ticketId={id} token={token} currentUser={user} showToast={showToast} refreshKey={refreshKey} />
      </div>
    </main>
  );
}

function AgentProfilePage({ user, token, refreshKey }) {
  const { tickets } = useTickets(token, refreshKey, user);
  const completedTickets = tickets.filter((ticket) => ticket.status === 'Completed' && (ticket.agentName === user.name || ticket.assignedTo === user.name));
  const ratings = completedTickets.filter((ticket) => Number.isFinite(Number(ticket.rating)) && Number(ticket.rating) >= 1 && Number(ticket.rating) <= 5);
  const averageRating = ratings.length ? (ratings.reduce((sum, ticket) => sum + Number(ticket.rating), 0) / ratings.length).toFixed(1) : '0.0';

  return (
    <main className="dashboard-page">
      <DashboardHeader title="Profile" />
      <section className="panel table-panel profile-panel">
        <div className="panel-header compact">
          <div>
            <p className="eyebrow">Account</p>
            <h2>Agent profile</h2>
          </div>
        </div>

        <div className="profile-grid">
          <div className="profile-item"><label>Name</label><strong>{user.name}</strong></div>
          <div className="profile-item"><label>Email</label><strong>{user.email}</strong></div>
          <div className="profile-item"><label>Role</label><strong>{user.role}</strong></div>
          <div className="profile-item"><label>Team</label><strong>Support Operations</strong></div>
          <div className="profile-item"><label>Average Rating</label><strong>{averageRating} / 5</strong></div>
          <div className="profile-item"><label>Total Reviews</label><strong>{ratings.length}</strong></div>
        </div>
      </section>
    </main>
  );
}

function App() {
  const [role, setRole] = useState('customer');
  const [token, setToken] = useState(() => parseStoredToken());
  const [user, setUser] = useState(() => parseStoredUser());
  const [isLoggedIn, setIsLoggedIn] = useState(() => Boolean(parseStoredToken()));
  const [toast, setToast] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const socketRef = useRef(null);

  const showToast = (type, message) => {
    setToast({ type, message });
    window.setTimeout(() => setToast(null), 3200);
  };

  useEffect(() => {
    if (!isLoggedIn || !token) {
      return undefined;
    }

    const socket = io('http://localhost:5001', { transports: ['websocket', 'polling'] });
    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('join-ticket', 'global');
    });

    const handleRealTimeEvent = (payload) => {
      showToast('success', payload.message || 'SupportFlow update received.');
      setRefreshKey((value) => value + 1);
    };

    socket.on('new-ticket', handleRealTimeEvent);
    socket.on('ticket-accepted', handleRealTimeEvent);
    socket.on('ticket-rejected', handleRealTimeEvent);
    socket.on('status-updated', handleRealTimeEvent);
    socket.on('new-message', handleRealTimeEvent);
    socket.on('ticket-completed', handleRealTimeEvent);
    socket.on('ticket-reviewed', handleRealTimeEvent);

    return () => {
      socket.disconnect();
    };
  }, [isLoggedIn, token]);

  // Ensure the stored user matches the server-side token -- avoids stale local fallback showing wrong tickets
  useEffect(() => {
    const hydrate = async () => {
      if (!token) return;

      try {
        const resp = await api.get('/auth/me');
        if (resp?.data?.user) {
          const serverUser = resp.data.user;
          setUser(serverUser);
          localStorage.setItem('supportflow-user', JSON.stringify(serverUser));
          setRole(serverUser.role || 'customer');
        }
      } catch (err) {
        // token invalid or expired â€” clear local session
        localStorage.removeItem('supportflow-token');
        localStorage.removeItem('supportflow-user');
        setToken('');
        setUser(defaultUsers.customer);
        setRole('customer');
        setIsLoggedIn(false);
      }
    };

    hydrate();
  }, [token]);

  const persistSession = (nextUser, nextToken) => {
    localStorage.setItem('supportflow-user', JSON.stringify(nextUser));
    localStorage.setItem('supportflow-token', nextToken);
    setUser(nextUser);
    setToken(nextToken);
    setRole(nextUser.role);
    setIsLoggedIn(true);
  };

  const handleLogin = async (event) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const email = String(formData.get('email') || '').trim();
    const password = String(formData.get('password') || '');

    try {
      const response = await api.post('/auth/login', { email, password, role });
      const payload = response.data;

      persistSession(payload.user, payload.token);
      showToast('success', `Welcome back, ${payload.user.name}.`);
      return true;
    } catch (error: any) {
      const message = error?.response?.data?.message || error.message || 'Login failed.';
      showToast('error', message);
      return false;
    }
  };

  const handleRegister = async (event) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const name = String(formData.get('name') || '').trim();
    const email = String(formData.get('email') || '').trim();
    const password = String(formData.get('password') || '');

    try {
      const response = await api.post('/auth/register', { name, email, password, role });
      const payload = response.data;

      persistSession(payload.user, payload.token);
      showToast('success', `Account created for ${payload.user.name}.`);
      return true;
    } catch (error: any) {
      const message = error?.response?.data?.message || error.message || 'Registration failed.';
      showToast('error', message);
      return false;
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('supportflow-token');
    localStorage.removeItem('supportflow-user');
    socketRef.current?.disconnect();
    setToken('');
    setUser(defaultUsers.customer);
    setRole('customer');
    setIsLoggedIn(false);
    setRefreshKey(0);
    showToast('success', 'You have been logged out.');
  };

  return (
    <BrowserRouter basename={appBasename}>
      <Toaster toast={toast} onClose={() => setToast(null)} />
      <Routes>
        <Route path="/" element={isLoggedIn ? <Navigate to={role === 'customer' ? '/customer/dashboard' : '/agent/dashboard'} replace /> : <LandingPage setRole={setRole} />} />
        <Route path="/login" element={<LoginPage role={role} setRole={setRole} onLogin={handleLogin} />} />
        <Route path="/register" element={<RegisterPage role={role} setRole={setRole} onRegister={handleRegister} />} />

        <Route path="/customer" element={<RoleProtectedRoute isLoggedIn={isLoggedIn} user={user} allowedRole="customer"><AppShell user={user} role="customer" onLogout={handleLogout} /></RoleProtectedRoute>}>
          <Route path="dashboard" element={<CustomerDashboardPage user={user} token={token} refreshKey={refreshKey} showToast={showToast} />} />
          <Route path="generate-ticket" element={<GenerateTicketPage user={user} token={token} showToast={showToast} />} />
          <Route path="tickets" element={<CustomerTicketsPage user={user} token={token} refreshKey={refreshKey} showToast={showToast} />} />
          <Route path="tickets/:id" element={<CustomerTicketDetailsPage user={user} token={token} refreshKey={refreshKey} showToast={showToast} />} />
          <Route path="profile" element={<CustomerProfilePage user={user} />} />
          <Route index element={<Navigate to="dashboard" replace />} />
        </Route>

        <Route path="/agent" element={<RoleProtectedRoute isLoggedIn={isLoggedIn} user={user} allowedRole="agent"><AppShell user={user} role="agent" onLogout={handleLogout} /></RoleProtectedRoute>}>
          <Route path="dashboard" element={<AgentDashboardPage user={user} token={token} refreshKey={refreshKey} showToast={showToast} />} />
          <Route path="tickets" element={<AgentTicketsPage user={user} token={token} refreshKey={refreshKey} showToast={showToast} />} />
          <Route path="tickets/:id" element={<AgentTicketDetailsPage user={user} token={token} refreshKey={refreshKey} showToast={showToast} />} />
          <Route path="profile" element={<AgentProfilePage user={user} token={token} refreshKey={refreshKey} />} />
          <Route index element={<Navigate to="dashboard" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;

