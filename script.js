/**
 * Student Management System — script.js
 * Pure vanilla JS, no frameworks
 * All data loaded from data.json via fetch
 */

// ─── App State ──────────────────────────────────────────────────────────────
const State = {
  currentUser: null,
  data: null,
  darkMode: true,
  currentPage: 'dashboard',
  attendanceSession: {},   // { studentId: 'present'|'absent' }
  notifications: [],
  uploadedFiles: [],
};

// ─── DOM Helpers ────────────────────────────────────────────────────────────
const $ = (s, ctx = document) => ctx.querySelector(s);
const $$ = (s, ctx = document) => [...ctx.querySelectorAll(s)];
const esc = s => String(s).replace(/[<>&"]/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;'}[c]));

function toast(msg, type = 'info') {
  const c = document.getElementById('toast-container');
  const icons = { success: '✅', error: '❌', info: 'ℹ️', warning: '⚠️' };
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.innerHTML = `<span>${icons[type]}</span> ${esc(msg)}`;
  c.appendChild(t);
  setTimeout(() => t.remove(), 3400);
}

// ─── Load Data ───────────────────────────────────────────────────────────────
async function loadData() {
  try {
    const res = await fetch('data.json');
    State.data = await res.json();
  } catch (e) {
    // fallback inline minimal data
    toast('Could not load data.json — using demo data', 'warning');
    State.data = { students: [], teachers: [], attendance: [], fees: [], subjects: [], users: [], notifications: [], classes: [], school: { name: 'School', logo: 'S' } };
  }
}

// ─── Auth ────────────────────────────────────────────────────────────────────
function hashPassword(pwd) {
  // Simple deterministic hash (not crypto, just obfuscation for demo)
  let h = 5381;
  for (let i = 0; i < pwd.length; i++) h = (h * 33) ^ pwd.charCodeAt(i);
  return (h >>> 0).toString(16);
}

function setupAuthForm() {
  // Tab switching
  $$('.auth-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      $$('.auth-tab').forEach(t => t.classList.remove('active'));
      $$('.auth-form').forEach(f => f.classList.remove('active'));
      tab.classList.add('active');
      $(`#${tab.dataset.tab}-form`).classList.add('active');
    });
  });

  // Login
  $('#login-btn').addEventListener('click', handleLogin);
  $('#login-email').addEventListener('keydown', e => e.key === 'Enter' && handleLogin());
  $('#login-password').addEventListener('keydown', e => e.key === 'Enter' && handleLogin());

  // Register
  $('#register-btn').addEventListener('click', handleRegister);

  // Demo quick-fill
  $$('.demo-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const [email, password, role] = btn.dataset.creds.split('|');
      $('#login-email').value = email;
      $('#login-password').value = password;
      toast(`Filled ${role} credentials`, 'info');
    });
  });
}

function handleLogin() {
  const email = $('#login-email').value.trim();
  const password = $('#login-password').value.trim();
  if (!email || !password) { toast('Please fill all fields', 'error'); return; }

  const user = State.data.users.find(u => u.email === email && u.password === password);
  if (!user) { toast('Invalid email or password', 'error'); return; }

  State.currentUser = user;
  toast(`Welcome back, ${user.name}! 👋`, 'success');
  launchApp();
}

function handleRegister() {
  const name  = $('#reg-name').value.trim();
  const email = $('#reg-email').value.trim();
  const pass  = $('#reg-password').value.trim();
  const role  = $('#reg-role').value;

  if (!name || !email || !pass) { toast('Please fill all fields', 'error'); return; }
  if (State.data.users.find(u => u.email === email)) { toast('Email already registered', 'error'); return; }

  const newUser = {
    id: `u${Date.now()}`,
    name, email, password: pass, role,
    avatar: name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0,2),
    phone: '', joinDate: new Date().toISOString().split('T')[0]
  };
  State.data.users.push(newUser);
  State.currentUser = newUser;
  toast(`Account created! Welcome, ${name}!`, 'success');
  launchApp();
}

function launchApp() {
  document.getElementById('auth-screen').style.display = 'none';
  const app = document.getElementById('app');
  app.classList.add('visible');
  initApp();
}

function handleLogout() {
  State.currentUser = null;
  document.getElementById('app').classList.remove('visible');
  document.getElementById('auth-screen').style.display = 'flex';
  toast('Logged out successfully', 'info');
  // Reset forms
  ['#login-email','#login-password','#reg-name','#reg-email','#reg-password'].forEach(s => $(s) && ($(s).value = ''));
}

// ─── App Init ────────────────────────────────────────────────────────────────
function initApp() {
  renderSidebar();
  renderTopbar();
  setupNavigation();
  setupThemeToggle();
  setupNotifications();
  setupChatbot();
  setupMobileMenu();
  renderDashboard();
  setupAllPages();
}

// ─── Sidebar ─────────────────────────────────────────────────────────────────
function renderSidebar() {
  const u = State.currentUser;
  $('#sidebar-user-avatar').textContent = u.avatar;
  $('#sidebar-user-name').textContent = u.name;
  $('#sidebar-user-role').textContent = u.role;
  $('#sidebar-user-role').className = `role-badge ${u.role}`;

  // Show/hide nav items based on role
  const perms = {
    admin:   ['dashboard','students','teachers','attendance','fees','subjects','analytics','reports','uploads','settings'],
    teacher: ['dashboard','students','attendance','subjects','analytics','reports','uploads'],
    student: ['dashboard','my-attendance','my-fees','subjects','reports'],
  };

  const allowed = perms[u.role] || [];
  $$('.nav-item[data-page]').forEach(item => {
    item.style.display = allowed.includes(item.dataset.page) ? '' : 'none';
  });

  // Unread notification count
  const unread = State.data.notifications.filter(n => !n.read && (n.targetRole === 'all' || n.targetRole === u.role)).length;
  const badge = $('#notif-badge');
  if (badge) badge.textContent = unread || '';
  if (badge) badge.style.display = unread ? '' : 'none';
}

function renderTopbar() {
  $('#page-title').textContent = formatPageTitle(State.currentPage);
}

function formatPageTitle(page) {
  const map = {
    dashboard: 'Dashboard', students: 'Students', teachers: 'Teachers',
    attendance: 'Attendance', 'my-attendance': 'My Attendance',
    fees: 'Fee Management', 'my-fees': 'My Fees',
    subjects: 'Subjects', analytics: 'Analytics', reports: 'Reports',
    uploads: 'File Uploads', settings: 'Settings'
  };
  return map[page] || page;
}

// ─── Navigation ──────────────────────────────────────────────────────────────
function setupNavigation() {
  $$('.nav-item[data-page]').forEach(item => {
    item.addEventListener('click', () => {
      navigateTo(item.dataset.page);
      // Close mobile menu
      document.getElementById('sidebar').classList.remove('open');
      document.getElementById('sidebar-overlay').classList.remove('open');
    });
  });

  $('#logout-btn').addEventListener('click', handleLogout);
}

function navigateTo(page) {
  State.currentPage = page;
  $$('.nav-item').forEach(i => i.classList.toggle('active', i.dataset.page === page));
  $$('.page').forEach(p => p.classList.toggle('active', p.id === `page-${page}`));
  $('#page-title').textContent = formatPageTitle(page);

  // Re-render page content
  const renderers = {
    dashboard: renderDashboard,
    students: renderStudents,
    teachers: renderTeachers,
    attendance: renderAttendance,
    'my-attendance': renderMyAttendance,
    fees: renderFees,
    'my-fees': renderMyFees,
    subjects: renderSubjects,
    analytics: renderAnalytics,
    reports: renderReports,
    uploads: renderUploads,
    settings: renderSettings,
  };
  if (renderers[page]) renderers[page]();
}

// ─── Mobile Menu ─────────────────────────────────────────────────────────────
function setupMobileMenu() {
  const btn = document.getElementById('hamburger-btn');
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebar-overlay');

  btn.addEventListener('click', () => {
    sidebar.classList.toggle('open');
    overlay.classList.toggle('open');
  });

  overlay.addEventListener('click', () => {
    sidebar.classList.remove('open');
    overlay.classList.remove('open');
  });
}

// ─── Theme Toggle ────────────────────────────────────────────────────────────
function setupThemeToggle() {
  const btn = document.getElementById('theme-toggle');
  btn.addEventListener('click', () => {
    State.darkMode = !State.darkMode;
    document.body.classList.toggle('light-mode', !State.darkMode);
    btn.innerHTML = State.darkMode ? '☀️ Light' : '🌙 Dark';
    toast(State.darkMode ? 'Dark mode on' : 'Light mode on', 'info');
  });
}

// ─── Notifications ────────────────────────────────────────────────────────────
function setupNotifications() {
  const btn = document.getElementById('notif-btn');
  const panel = document.getElementById('notif-panel');

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    panel.classList.toggle('open');
    renderNotifications();
  });

  document.addEventListener('click', (e) => {
    if (!panel.contains(e.target) && e.target !== btn) panel.classList.remove('open');
  });
}

function renderNotifications() {
  const panel = document.getElementById('notif-panel');
  const u = State.currentUser;
  const notifs = State.data.notifications.filter(n => n.targetRole === 'all' || n.targetRole === u.role);

  const icons = { fee: '💰', attendance: '📅', announcement: '📢' };
  panel.innerHTML = `
    <div class="notif-header">
      <span>Notifications</span>
      <span style="color:var(--text-muted);font-size:12px">${notifs.filter(n=>!n.read).length} unread</span>
    </div>
    ${notifs.length ? notifs.map(n => `
      <div class="notif-item ${n.read ? '' : 'unread'}">
        <div class="notif-icon ${n.type === 'fee' ? 'fee' : n.type === 'attendance' ? 'attend' : 'ann'}">${icons[n.type] || '🔔'}</div>
        <div class="notif-text">
          <p>${esc(n.message)}</p>
          <span>${n.date}</span>
        </div>
      </div>
    `).join('') : '<div class="notif-item"><p style="color:var(--text-secondary);font-size:13px">No notifications</p></div>'}
  `;
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
function renderDashboard() {
  const d = State.data;
  const u = State.currentUser;

  // Stats
  const totalStudents = d.students.length;
  const totalTeachers = d.teachers.length;
  const totalPresent  = d.attendance.filter(a => a.status === 'present').length;
  const totalAtt      = d.attendance.length;
  const attPct        = totalAtt ? Math.round((totalPresent / totalAtt) * 100) : 0;
  const feesPaid      = d.fees.filter(f => f.paid).reduce((s, f) => s + f.amount, 0);
  const feesTotal     = d.fees.reduce((s, f) => s + f.amount, 0);
  const feePct        = feesTotal ? Math.round((feesPaid / feesTotal) * 100) : 0;

  const statsEl = document.getElementById('dashboard-stats');
  if (!statsEl) return;

  statsEl.innerHTML = `
    <div class="stat-card cyan" onclick="navigateTo('students')" style="cursor:pointer">
      <div class="stat-icon cyan">👨‍🎓</div>
      <div class="stat-info">
        <div class="label">Total Students</div>
        <div class="value">${totalStudents}</div>
        <div class="change up">↑ Active enrollments</div>
      </div>
    </div>
    <div class="stat-card amber" onclick="navigateTo('teachers')" style="cursor:pointer">
      <div class="stat-icon amber">👨‍🏫</div>
      <div class="stat-info">
        <div class="label">Total Teachers</div>
        <div class="value">${totalTeachers}</div>
        <div class="change up">↑ Faculty members</div>
      </div>
    </div>
    <div class="stat-card green" onclick="navigateTo('attendance')" style="cursor:pointer">
      <div class="stat-icon green">📅</div>
      <div class="stat-info">
        <div class="label">Attendance Rate</div>
        <div class="value">${attPct}%</div>
        <div class="change ${attPct >= 75 ? 'up' : 'down'}">${attPct >= 75 ? '↑ Good' : '↓ Needs attention'}</div>
      </div>
    </div>
    <div class="stat-card red" onclick="navigateTo('fees')" style="cursor:pointer">
      <div class="stat-icon red">💰</div>
      <div class="stat-info">
        <div class="label">Fee Collection</div>
        <div class="value">${feePct}%</div>
        <div class="change ${feePct >= 70 ? 'up' : 'down'}">₹${(feesPaid/1000).toFixed(0)}k collected</div>
      </div>
    </div>
  `;

  renderDashboardCharts(attPct, feePct, feesPaid, feesTotal - feesPaid);
  renderRecentActivity();
}

function renderDashboardCharts(attPct, feePct, paidFees, unpaidFees) {
  // Bar chart - Attendance by class
  const d = State.data;
  const classes = d.classes || ['10A','10B','11B','12A'];

  const classPcts = classes.map(cls => {
    const students = d.students.filter(s => s.class === cls);
    if (!students.length) return 0;
    const ids = students.map(s => s.id);
    const records = d.attendance.filter(a => ids.includes(a.studentId));
    if (!records.length) return 0;
    return Math.round(records.filter(r => r.status === 'present').length / records.length * 100);
  });

  setTimeout(() => {
    // Attendance Bar Chart
    const ctx1 = document.getElementById('attendance-chart');
    if (ctx1) {
      if (ctx1._chart) ctx1._chart.destroy();
      ctx1._chart = new Chart(ctx1, {
        type: 'bar',
        data: {
          labels: classes,
          datasets: [{
            label: 'Attendance %',
            data: classPcts,
            backgroundColor: ['rgba(0,212,255,0.7)','rgba(45,220,138,0.7)','rgba(255,181,71,0.7)','rgba(181,127,255,0.7)'],
            borderRadius: 6,
            borderSkipped: false,
          }]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            y: {
              beginAtZero: true, max: 100,
              grid: { color: 'rgba(255,255,255,0.05)' },
              ticks: { color: '#8890aa', callback: v => v + '%' }
            },
            x: { grid: { display: false }, ticks: { color: '#8890aa' } }
          }
        }
      });
    }

    // Fee Pie Chart
    const ctx2 = document.getElementById('fee-chart');
    if (ctx2) {
      if (ctx2._chart) ctx2._chart.destroy();
      ctx2._chart = new Chart(ctx2, {
        type: 'doughnut',
        data: {
          labels: ['Paid', 'Unpaid'],
          datasets: [{
            data: [paidFees, unpaidFees],
            backgroundColor: ['rgba(45,220,138,0.85)','rgba(255,92,122,0.85)'],
            borderWidth: 0,
            hoverOffset: 6,
          }]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: {
            legend: { position: 'bottom', labels: { color: '#8890aa', padding: 16, font: { size: 12 } } },
            tooltip: { callbacks: { label: ctx => ` ₹${(ctx.raw/1000).toFixed(1)}k` } }
          },
          cutout: '68%'
        }
      });
    }
  }, 80);
}

function renderRecentActivity() {
  const container = document.getElementById('recent-activity');
  if (!container) return;
  const d = State.data;

  // Last 5 fee transactions
  const recentFees = d.fees.filter(f => f.paid).slice(-5).reverse();
  container.innerHTML = recentFees.map(f => {
    const s = d.students.find(s => s.id === f.studentId);
    return `
      <div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid var(--border)">
        <div class="table-avatar">${s ? s.avatar : '?'}</div>
        <div style="flex:1">
          <div style="font-size:13px;font-weight:600">${s ? esc(s.name) : 'Unknown'}</div>
          <div style="font-size:11.5px;color:var(--text-secondary)">${esc(f.type)} — ${esc(f.term)}</div>
        </div>
        <div style="text-align:right">
          <div style="font-size:13px;font-weight:700;color:var(--green)">₹${f.amount.toLocaleString()}</div>
          <div style="font-size:11px;color:var(--text-muted)">${f.paidDate}</div>
        </div>
      </div>`;
  }).join('') || '<p style="color:var(--text-secondary);font-size:13px">No recent transactions</p>';
}

// ─── Students Page ────────────────────────────────────────────────────────────
function renderStudents(filter = '') {
  const d = State.data;
  let students = d.students;
  const classFilter = $('#class-filter') ? $('#class-filter').value : 'all';
  const search = filter || ($('#student-search') ? $('#student-search').value.toLowerCase() : '');

  if (classFilter && classFilter !== 'all') students = students.filter(s => s.class === classFilter);
  if (search) students = students.filter(s =>
    s.name.toLowerCase().includes(search) ||
    s.rollNumber.toLowerCase().includes(search) ||
    s.email.toLowerCase().includes(search)
  );

  const tbody = document.getElementById('students-tbody');
  if (!tbody) return;

  tbody.innerHTML = students.map(s => `
    <tr>
      <td>
        <span class="table-avatar">${esc(s.avatar)}</span>
        <span style="font-weight:600">${esc(s.name)}</span>
      </td>
      <td><span class="badge cyan">${esc(s.rollNumber)}</span></td>
      <td>${esc(s.class)}</td>
      <td>${esc(s.email)}</td>
      <td>${esc(s.phone)}</td>
      <td>
        <div class="action-btns">
          <button class="btn-icon" onclick="viewStudent('${s.id}')" title="View">👁️</button>
          <button class="btn-icon" onclick="editStudent('${s.id}')" title="Edit">✏️</button>
          <button class="btn-icon danger" onclick="deleteStudent('${s.id}')" title="Delete">🗑️</button>
        </div>
      </td>
    </tr>
  `).join('') || `<tr><td colspan="6"><div class="empty-state"><div class="icon">👨‍🎓</div><h4>No Students Found</h4><p>No students match your criteria</p></div></td></tr>`;
}

function setupStudentsPage() {
  const btn = document.getElementById('add-student-btn');
  if (btn) btn.addEventListener('click', () => openStudentModal());

  const search = document.getElementById('student-search');
  if (search) search.addEventListener('input', () => renderStudents());

  const cf = document.getElementById('class-filter');
  if (cf) {
    const d = State.data;
    cf.innerHTML = `<option value="all">All Classes</option>` +
      (d.classes || []).map(c => `<option value="${c}">${c}</option>`).join('');
    cf.addEventListener('change', () => renderStudents());
  }
}

function openStudentModal(studentId = null) {
  const modal = document.getElementById('student-modal');
  const s = studentId ? State.data.students.find(s => s.id === studentId) : null;
  document.getElementById('student-modal-title').textContent = s ? 'Edit Student' : 'Add Student';
  document.getElementById('student-id-field').value = s ? s.id : '';
  document.getElementById('student-name-field').value = s ? s.name : '';
  document.getElementById('student-roll-field').value = s ? s.rollNumber : '';
  document.getElementById('student-class-field').value = s ? s.class : '';
  document.getElementById('student-email-field').value = s ? s.email : '';
  document.getElementById('student-phone-field').value = s ? s.phone : '';
  document.getElementById('student-parent-phone-field').value = s ? s.parentPhone : '';
  document.getElementById('student-address-field').value = s ? s.address : '';
  document.getElementById('student-dob-field').value = s ? s.dob : '';
  modal.classList.add('open');
}

function saveStudent() {
  const id     = document.getElementById('student-id-field').value;
  const name   = document.getElementById('student-name-field').value.trim();
  const roll   = document.getElementById('student-roll-field').value.trim();
  const cls    = document.getElementById('student-class-field').value;
  const email  = document.getElementById('student-email-field').value.trim();
  const phone  = document.getElementById('student-phone-field').value.trim();
  const pPhone = document.getElementById('student-parent-phone-field').value.trim();
  const addr   = document.getElementById('student-address-field').value.trim();
  const dob    = document.getElementById('student-dob-field').value;

  if (!name || !roll || !cls) { toast('Name, Roll Number and Class are required', 'error'); return; }

  if (id) {
    // Edit
    const idx = State.data.students.findIndex(s => s.id === id);
    if (idx >= 0) {
      Object.assign(State.data.students[idx], { name, rollNumber: roll, class: cls, email, phone, parentPhone: pPhone, address: addr, dob,
        avatar: name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0,2) });
      toast('Student updated successfully', 'success');
    }
  } else {
    // Add
    State.data.students.push({
      id: `s${Date.now()}`, userId: null, name, rollNumber: roll, class: cls, email, phone,
      parentPhone: pPhone, address: addr, dob, joinDate: new Date().toISOString().split('T')[0],
      avatar: name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0,2),
      subjects: []
    });
    toast('Student added successfully', 'success');
  }

  document.getElementById('student-modal').classList.remove('open');
  renderStudents();
  renderDashboard();
}

function editStudent(id) { openStudentModal(id); }

function deleteStudent(id) {
  if (!confirm('Delete this student? This cannot be undone.')) return;
  State.data.students = State.data.students.filter(s => s.id !== id);
  toast('Student deleted', 'warning');
  renderStudents();
  renderDashboard();
}

function viewStudent(id) {
  const s = State.data.students.find(s => s.id === id);
  if (!s) return;
  const d = State.data;

  const modal = document.getElementById('view-student-modal');
  const body  = document.getElementById('view-student-body');

  // Attendance stats
  const attRecords = d.attendance.filter(a => a.studentId === s.id);
  const attPct = attRecords.length ? Math.round(attRecords.filter(a => a.status === 'present').length / attRecords.length * 100) : 0;

  // Fee status
  const fees = d.fees.filter(f => f.studentId === s.id);
  const paid = fees.filter(f => f.paid).reduce((sum, f) => sum + f.amount, 0);
  const due  = fees.filter(f => !f.paid).reduce((sum, f) => sum + f.amount, 0);

  body.innerHTML = `
    <div class="profile-hero">
      <div class="profile-avatar">${esc(s.avatar)}</div>
      <div class="profile-info">
        <h3>${esc(s.name)}</h3>
        <p>${esc(s.rollNumber)} · Class ${esc(s.class)}</p>
        <div style="margin-top:8px;display:flex;gap:6px">
          <span class="badge cyan">${esc(s.class)}</span>
          <span class="badge green">${attPct}% Attendance</span>
          ${due > 0 ? `<span class="badge red">₹${due.toLocaleString()} Due</span>` : `<span class="badge green">Fees Clear</span>`}
        </div>
      </div>
    </div>
    <div class="detail-grid">
      <div class="detail-item"><div class="key">Email</div><div class="val">${esc(s.email||'—')}</div></div>
      <div class="detail-item"><div class="key">Phone</div><div class="val">${esc(s.phone||'—')}</div></div>
      <div class="detail-item"><div class="key">Parent Phone</div><div class="val">${esc(s.parentPhone||'—')}</div></div>
      <div class="detail-item"><div class="key">Date of Birth</div><div class="val">${esc(s.dob||'—')}</div></div>
      <div class="detail-item"><div class="key">Join Date</div><div class="val">${esc(s.joinDate||'—')}</div></div>
      <div class="detail-item"><div class="key">Address</div><div class="val">${esc(s.address||'—')}</div></div>
    </div>
    <div style="margin-top:16px">
      <h4 style="font-size:13px;font-weight:700;margin-bottom:10px;color:var(--text-secondary)">ATTENDANCE</h4>
      <div class="progress-bar"><div class="progress-fill ${attPct >= 75 ? 'green' : 'red'}" style="width:${attPct}%"></div></div>
      <p style="font-size:12px;color:var(--text-muted);margin-top:4px">${attPct}% — ${attRecords.filter(a=>a.status==='present').length}/${attRecords.length} days present</p>
    </div>
    <div style="margin-top:16px">
      <h4 style="font-size:13px;font-weight:700;margin-bottom:10px;color:var(--text-secondary)">FEES</h4>
      <div style="display:flex;gap:12px;flex-wrap:wrap">
        <div style="flex:1;min-width:100px;background:var(--green-dim);border-radius:var(--radius-sm);padding:12px;text-align:center">
          <div style="font-size:11px;color:var(--green);font-weight:700">PAID</div>
          <div style="font-size:18px;font-weight:800;color:var(--green)">₹${paid.toLocaleString()}</div>
        </div>
        <div style="flex:1;min-width:100px;background:var(--red-dim);border-radius:var(--radius-sm);padding:12px;text-align:center">
          <div style="font-size:11px;color:var(--red);font-weight:700">DUE</div>
          <div style="font-size:18px;font-weight:800;color:var(--red)">₹${due.toLocaleString()}</div>
        </div>
      </div>
    </div>
  `;

  modal.classList.add('open');
}

// ─── Teachers Page ────────────────────────────────────────────────────────────
function renderTeachers() {
  const tbody = document.getElementById('teachers-tbody');
  if (!tbody) return;
  const d = State.data;
  tbody.innerHTML = d.teachers.map(t => `
    <tr>
      <td><span class="table-avatar">${esc(t.avatar)}</span><span style="font-weight:600">${esc(t.name)}</span></td>
      <td>${esc(t.email)}</td>
      <td>${t.subjects.map(s => `<span class="badge cyan" style="margin:1px">${esc(s)}</span>`).join('')}</td>
      <td>${t.classes.map(c => `<span class="badge purple" style="margin:1px">${esc(c)}</span>`).join('')}</td>
      <td>${esc(t.qualification||'—')}</td>
      <td>
        <div class="action-btns">
          <button class="btn-icon" onclick="deleteTeacher('${t.id}')" title="Delete">🗑️</button>
        </div>
      </td>
    </tr>
  `).join('');
}

function deleteTeacher(id) {
  if (!confirm('Remove this teacher?')) return;
  State.data.teachers = State.data.teachers.filter(t => t.id !== id);
  toast('Teacher removed', 'warning');
  renderTeachers();
}

// ─── Attendance ────────────────────────────────────────────────────────────────
function renderAttendance() {
  const d = State.data;
  const classFilter = $('#att-class-filter') ? $('#att-class-filter').value : 'all';
  let students = classFilter === 'all' ? d.students : d.students.filter(s => s.class === classFilter);

  const grid = document.getElementById('attendance-mark-grid');
  if (!grid) return;

  grid.innerHTML = students.map(s => {
    const status = State.attendanceSession[s.id] || 'neutral';
    return `
      <div class="attendance-card" id="att-card-${s.id}">
        <div class="table-avatar">${esc(s.avatar)}</div>
        <div class="att-student-info">
          <div class="sname">${esc(s.name)}</div>
          <div class="sroll">${esc(s.rollNumber)} · ${esc(s.class)}</div>
        </div>
        <div class="att-controls">
          <button class="att-btn ${status === 'present' ? 'present' : 'neutral'}" onclick="markAttendance('${s.id}', 'present')">✅</button>
          <button class="att-btn ${status === 'absent' ? 'absent' : 'neutral'}" onclick="markAttendance('${s.id}', 'absent')">❌</button>
        </div>
      </div>`;
  }).join('') || '<div class="empty-state"><div class="icon">📅</div><h4>No students</h4></div>';
}

function markAttendance(studentId, status) {
  State.attendanceSession[studentId] = State.attendanceSession[studentId] === status ? 'neutral' : status;
  renderAttendance();
}

function submitAttendance() {
  const date = document.getElementById('att-date') ? document.getElementById('att-date').value : new Date().toISOString().split('T')[0];
  const subject = document.getElementById('att-subject') ? document.getElementById('att-subject').value : 'General';
  let count = 0;

  Object.entries(State.attendanceSession).forEach(([sid, status]) => {
    if (status !== 'neutral') {
      State.data.attendance.push({
        id: `a${Date.now()}_${sid}`,
        studentId: sid, date, status, subject
      });
      count++;
    }
  });

  if (!count) { toast('No attendance marked', 'warning'); return; }
  State.attendanceSession = {};
  toast(`Attendance submitted for ${count} students`, 'success');
  renderAttendance();
}

function renderMyAttendance() {
  const u = State.currentUser;
  const d = State.data;
  const student = d.students.find(s => s.userId === u.id);
  const container = document.getElementById('my-attendance-content');
  if (!container) return;

  if (!student) {
    container.innerHTML = `<div class="empty-state"><div class="icon">📅</div><h4>No attendance records found</h4></div>`;
    return;
  }

  const records = d.attendance.filter(a => a.studentId === student.id);
  const present = records.filter(r => r.status === 'present').length;
  const absent  = records.filter(r => r.status === 'absent').length;
  const pct     = records.length ? Math.round(present / records.length * 100) : 0;

  container.innerHTML = `
    <div class="stats-grid" style="margin-bottom:20px">
      <div class="stat-card green">
        <div class="stat-icon green">✅</div>
        <div class="stat-info"><div class="label">Present</div><div class="value">${present}</div></div>
      </div>
      <div class="stat-card red">
        <div class="stat-icon red">❌</div>
        <div class="stat-info"><div class="label">Absent</div><div class="value">${absent}</div></div>
      </div>
      <div class="stat-card cyan">
        <div class="stat-icon cyan">📊</div>
        <div class="stat-info"><div class="label">Percentage</div><div class="value">${pct}%</div></div>
      </div>
    </div>
    <div class="card">
      <div class="card-header"><h3>Attendance History</h3></div>
      <div class="card-body">
        <div class="table-wrap">
          <table>
            <thead><tr><th>Date</th><th>Subject</th><th>Status</th></tr></thead>
            <tbody>
              ${records.length ? records.map(r => `
                <tr>
                  <td>${r.date}</td>
                  <td>${esc(r.subject)}</td>
                  <td><span class="badge ${r.status === 'present' ? 'green' : 'red'}">${r.status}</span></td>
                </tr>
              `).join('') : '<tr><td colspan="3" style="text-align:center;color:var(--text-secondary);padding:30px">No records</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}

// ─── Fees ─────────────────────────────────────────────────────────────────────
function renderFees(filter = 'all') {
  const d = State.data;
  const tbody = document.getElementById('fees-tbody');
  if (!tbody) return;

  const currentFilter = filter || (document.getElementById('fee-status-filter') ? document.getElementById('fee-status-filter').value : 'all');
  let fees = d.fees;
  if (currentFilter === 'paid') fees = fees.filter(f => f.paid);
  if (currentFilter === 'unpaid') fees = fees.filter(f => !f.paid);

  tbody.innerHTML = fees.map(f => {
    const s = d.students.find(s => s.id === f.studentId);
    return `
      <tr>
        <td><span class="table-avatar">${s ? esc(s.avatar) : '?'}</span>${s ? esc(s.name) : 'Unknown'}</td>
        <td>${esc(f.term)}</td>
        <td>${esc(f.type)}</td>
        <td>₹${f.amount.toLocaleString()}</td>
        <td>${esc(f.dueDate)}</td>
        <td><span class="badge ${f.paid ? 'green' : 'red'}">${f.paid ? 'Paid' : 'Pending'}</span></td>
        <td>
          <div class="action-btns">
            ${!f.paid ? `<button class="btn-icon" onclick="markFeePaid('${f.id}')" title="Mark Paid" style="color:var(--green)">✅</button>` : ''}
            ${f.paid ? `<button class="btn-icon" onclick="generateReceipt('${f.id}')" title="Receipt">🧾</button>` : ''}
          </div>
        </td>
      </tr>`;
  }).join('') || `<tr><td colspan="7" style="text-align:center;padding:40px;color:var(--text-secondary)">No fee records</td></tr>`;

  // Fee summary
  const feeSum = document.getElementById('fee-summary');
  if (feeSum) {
    const paid   = d.fees.filter(f => f.paid).reduce((s, f) => s + f.amount, 0);
    const unpaid = d.fees.filter(f => !f.paid).reduce((s, f) => s + f.amount, 0);
    feeSum.innerHTML = `
      <span style="color:var(--green);font-weight:700">✅ Collected: ₹${paid.toLocaleString()}</span>
      <span style="margin:0 12px;color:var(--border-bright)">|</span>
      <span style="color:var(--red);font-weight:700">⏳ Pending: ₹${unpaid.toLocaleString()}</span>
    `;
  }
}

function markFeePaid(feeId) {
  const fee = State.data.fees.find(f => f.id === feeId);
  if (!fee) return;
  fee.paid = true;
  fee.paidDate = new Date().toISOString().split('T')[0];
  fee.receiptNo = `REC-${new Date().getFullYear()}-${String(Date.now()).slice(-4)}`;
  toast('Fee marked as paid ✅', 'success');
  renderFees();
}

function generateReceipt(feeId) {
  const fee = State.data.fees.find(f => f.id === feeId);
  if (!fee) return;
  const student = State.data.students.find(s => s.id === fee.studentId);
  const school  = State.data.school;

  const modal = document.getElementById('receipt-modal');
  const body  = document.getElementById('receipt-body');

  body.innerHTML = `
    <div class="receipt">
      <div class="receipt-header">
        <h3>${esc(school.name)}</h3>
        <p style="font-size:12px;color:var(--text-secondary)">${esc(school.address)}</p>
        <p style="font-size:13px;font-weight:700;margin-top:10px;color:var(--amber)">FEE RECEIPT</p>
      </div>
      <div class="receipt-row"><span class="key">Receipt No.</span><span class="val">${esc(fee.receiptNo)}</span></div>
      <div class="receipt-row"><span class="key">Student Name</span><span class="val">${student ? esc(student.name) : 'N/A'}</span></div>
      <div class="receipt-row"><span class="key">Roll Number</span><span class="val">${student ? esc(student.rollNumber) : '—'}</span></div>
      <div class="receipt-row"><span class="key">Class</span><span class="val">${student ? esc(student.class) : '—'}</span></div>
      <div class="receipt-row"><span class="key">Fee Type</span><span class="val">${esc(fee.type)}</span></div>
      <div class="receipt-row"><span class="key">Term</span><span class="val">${esc(fee.term)}</span></div>
      <div class="receipt-row"><span class="key">Date Paid</span><span class="val">${esc(fee.paidDate)}</span></div>
      <div class="receipt-total"><span>Total Amount</span><span class="val">₹${fee.amount.toLocaleString()}</span></div>
      <p style="text-align:center;font-size:11px;color:var(--text-muted);margin-top:18px">This is a computer-generated receipt.</p>
    </div>
  `;

  modal.classList.add('open');
}

function renderMyFees() {
  const u = State.currentUser;
  const d = State.data;
  const student = d.students.find(s => s.userId === u.id);
  const container = document.getElementById('my-fees-content');
  if (!container) return;

  if (!student) {
    container.innerHTML = `<div class="empty-state"><div class="icon">💰</div><h4>No fee records</h4></div>`;
    return;
  }

  const fees = d.fees.filter(f => f.studentId === student.id);
  const paid = fees.filter(f => f.paid).reduce((s, f) => s + f.amount, 0);
  const due  = fees.filter(f => !f.paid).reduce((s, f) => s + f.amount, 0);

  container.innerHTML = `
    <div class="stats-grid" style="margin-bottom:20px">
      <div class="stat-card green">
        <div class="stat-icon green">✅</div>
        <div class="stat-info"><div class="label">Paid</div><div class="value">₹${paid.toLocaleString()}</div></div>
      </div>
      <div class="stat-card red">
        <div class="stat-icon red">⏳</div>
        <div class="stat-info"><div class="label">Due</div><div class="value">₹${due.toLocaleString()}</div></div>
      </div>
    </div>
    <div class="card">
      <div class="card-header"><h3>Fee Details</h3></div>
      <div class="card-body">
        <div class="table-wrap">
          <table>
            <thead><tr><th>Term</th><th>Type</th><th>Amount</th><th>Due Date</th><th>Status</th><th>Receipt</th></tr></thead>
            <tbody>
              ${fees.map(f => `
                <tr>
                  <td>${esc(f.term)}</td>
                  <td>${esc(f.type)}</td>
                  <td>₹${f.amount.toLocaleString()}</td>
                  <td>${f.dueDate}</td>
                  <td><span class="badge ${f.paid ? 'green' : 'red'}">${f.paid ? 'Paid' : 'Pending'}</span></td>
                  <td>${f.paid ? `<button class="btn-icon" onclick="generateReceipt('${f.id}')">🧾</button>` : '—'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}

// ─── Subjects ─────────────────────────────────────────────────────────────────
function renderSubjects() {
  const d = State.data;
  const grid = document.getElementById('subjects-grid');
  if (!grid) return;

  const icons = { 'Mathematics': '📐', 'Physics': '⚛️', 'Chemistry': '🧪', 'Biology': '🌿', 'English': '📖', 'History': '🏛️', 'Computer Science': '💻' };
  const colors = ['cyan', 'amber', 'green', 'red', 'purple'];

  grid.innerHTML = d.subjects.map((sub, i) => {
    const teacher = d.teachers.find(t => t.id === sub.teacherId);
    const color = colors[i % colors.length];
    return `
      <div class="subject-card">
        <div class="subject-icon" style="background:var(--${color}-dim);color:var(--${color})">${icons[sub.name] || '📚'}</div>
        <h4>${esc(sub.name)}</h4>
        <p>Code: ${esc(sub.code)} · ${sub.credits} Credits</p>
        <p style="margin-bottom:10px">Teacher: <strong>${teacher ? esc(teacher.name) : 'Unassigned'}</strong></p>
        <div class="subject-meta">
          ${sub.classes.map(c => `<span class="class-pill">${c}</span>`).join('')}
        </div>
      </div>`;
  }).join('');
}

// ─── Analytics ────────────────────────────────────────────────────────────────
function renderAnalytics() {
  const container = document.getElementById('analytics-content');
  if (!container) return;

  container.innerHTML = `
    <div class="analytics-grid">
      <div class="card">
        <div class="card-header"><h3>Monthly Attendance Trend</h3></div>
        <div class="card-body"><div class="chart-wrap"><canvas id="analytics-att-chart"></canvas></div></div>
      </div>
      <div class="card">
        <div class="card-header"><h3>Fee Collection Monthly</h3></div>
        <div class="card-body"><div class="chart-wrap"><canvas id="analytics-fee-chart"></canvas></div></div>
      </div>
      <div class="card">
        <div class="card-header"><h3>Students by Class</h3></div>
        <div class="card-body"><div class="chart-wrap"><canvas id="analytics-class-chart"></canvas></div></div>
      </div>
      <div class="card">
        <div class="card-header"><h3>Subjects Distribution</h3></div>
        <div class="card-body"><div class="chart-wrap"><canvas id="analytics-sub-chart"></canvas></div></div>
      </div>
    </div>
  `;

  setTimeout(() => {
    const d = State.data;
    const months = ['Sep','Oct','Nov','Dec','Jan','Feb'];
    const attData = [72, 78, 80, 68, 75, 82];
    const feeData = [45000, 60000, 55000, 80000, 70000, 90000];

    // Attendance Line
    const c1 = document.getElementById('analytics-att-chart');
    if (c1) new Chart(c1, {
      type: 'line',
      data: {
        labels: months,
        datasets: [{ label: 'Attendance %', data: attData, borderColor: '#00d4ff', backgroundColor: 'rgba(0,212,255,0.08)', borderWidth: 2.5, tension: 0.4, fill: true, pointBackgroundColor: '#00d4ff', pointRadius: 4 }]
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: {
        y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#8890aa', callback: v => v + '%' } },
        x: { grid: { display: false }, ticks: { color: '#8890aa' } }
      }}
    });

    // Fee Bar
    const c2 = document.getElementById('analytics-fee-chart');
    if (c2) new Chart(c2, {
      type: 'bar',
      data: {
        labels: months,
        datasets: [{ label: 'Fee ₹', data: feeData, backgroundColor: 'rgba(255,181,71,0.7)', borderRadius: 6 }]
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: {
        y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#8890aa', callback: v => '₹' + (v/1000).toFixed(0) + 'k' } },
        x: { grid: { display: false }, ticks: { color: '#8890aa' } }
      }}
    });

    // Students by class
    const classes = d.classes || [];
    const classCounts = classes.map(c => d.students.filter(s => s.class === c).length);
    const c3 = document.getElementById('analytics-class-chart');
    if (c3) new Chart(c3, {
      type: 'doughnut',
      data: {
        labels: classes,
        datasets: [{ data: classCounts, backgroundColor: ['rgba(0,212,255,0.8)','rgba(45,220,138,0.8)','rgba(255,181,71,0.8)','rgba(181,127,255,0.8)'], borderWidth: 0 }]
      },
      options: { responsive: true, maintainAspectRatio: false, cutout: '60%', plugins: { legend: { position: 'bottom', labels: { color: '#8890aa', padding: 12 } } } }
    });

    // Subjects distribution
    const c4 = document.getElementById('analytics-sub-chart');
    if (c4) new Chart(c4, {
      type: 'radar',
      data: {
        labels: d.subjects.map(s => s.name),
        datasets: [{ label: 'Classes Assigned', data: d.subjects.map(s => s.classes.length), backgroundColor: 'rgba(0,212,255,0.15)', borderColor: '#00d4ff', borderWidth: 2, pointBackgroundColor: '#00d4ff' }]
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: {
        r: { grid: { color: 'rgba(255,255,255,0.06)' }, ticks: { display: false }, pointLabels: { color: '#8890aa', font: { size: 11 } } }
      }}
    });
  }, 80);
}

// ─── Reports ──────────────────────────────────────────────────────────────────
function renderReports() {
  const content = document.getElementById('reports-content');
  if (!content) return;
  content.innerHTML = `
    <div class="report-cards">
      <div class="report-card" onclick="generateStudentReport()">
        <div class="report-icon" style="background:var(--cyan-dim);color:var(--cyan)">👨‍🎓</div>
        <h4>Student Report</h4>
        <p>Full list of all students with details</p>
        <div style="margin-top:14px"><span class="badge cyan">PDF</span></div>
      </div>
      <div class="report-card" onclick="generateAttendanceReport()">
        <div class="report-icon" style="background:var(--green-dim);color:var(--green)">📅</div>
        <h4>Attendance Report</h4>
        <p>Attendance records and percentages</p>
        <div style="margin-top:14px"><span class="badge green">PDF</span></div>
      </div>
      <div class="report-card" onclick="generateFeeReport()">
        <div class="report-icon" style="background:var(--amber-dim);color:var(--amber)">💰</div>
        <h4>Fee Report</h4>
        <p>Fee collection and pending dues</p>
        <div style="margin-top:14px"><span class="badge amber">PDF</span></div>
      </div>
      <div class="report-card" onclick="exportToExcel()">
        <div class="report-icon" style="background:var(--purple-dim);color:var(--purple)">📊</div>
        <h4>Export to Excel</h4>
        <p>Export student data as CSV</p>
        <div style="margin-top:14px"><span class="badge purple">CSV</span></div>
      </div>
    </div>
  `;
}

function generateStudentReport() {
  const d = State.data;
  const school = d.school;
  const rows = d.students.map(s => `
    <tr>
      <td>${esc(s.rollNumber)}</td>
      <td>${esc(s.name)}</td>
      <td>${esc(s.class)}</td>
      <td>${esc(s.email)}</td>
      <td>${esc(s.phone)}</td>
    </tr>
  `).join('');

  const html = `<!DOCTYPE html><html><head><title>Student Report</title>
  <style>body{font-family:sans-serif;padding:24px}h1{font-size:20px}h2{font-size:15px;color:#666}table{width:100%;border-collapse:collapse;margin-top:20px}th,td{border:1px solid #ccc;padding:8px;text-align:left}th{background:#f0f0f0}</style>
  </head><body>
  <h1>${esc(school.name)} — Student Report</h1>
  <h2>Generated: ${new Date().toLocaleDateString()}</h2>
  <table><thead><tr><th>Roll No</th><th>Name</th><th>Class</th><th>Email</th><th>Phone</th></tr></thead><tbody>${rows}</tbody></table>
  </body></html>`;

  downloadHTML(html, 'student-report.html');
  toast('Student report downloaded', 'success');
}

function generateAttendanceReport() {
  const d = State.data;
  const rows = d.students.map(s => {
    const records = d.attendance.filter(a => a.studentId === s.id);
    const pct = records.length ? Math.round(records.filter(r => r.status === 'present').length / records.length * 100) : 0;
    return `<tr><td>${esc(s.rollNumber)}</td><td>${esc(s.name)}</td><td>${esc(s.class)}</td><td>${records.filter(r => r.status === 'present').length}</td><td>${records.filter(r => r.status === 'absent').length}</td><td>${pct}%</td></tr>`;
  }).join('');

  const html = `<!DOCTYPE html><html><head><title>Attendance Report</title>
  <style>body{font-family:sans-serif;padding:24px}h1{font-size:20px}table{width:100%;border-collapse:collapse;margin-top:20px}th,td{border:1px solid #ccc;padding:8px}th{background:#f0f0f0}</style>
  </head><body><h1>${esc(d.school.name)} — Attendance Report</h1><h2>Generated: ${new Date().toLocaleDateString()}</h2>
  <table><thead><tr><th>Roll</th><th>Name</th><th>Class</th><th>Present</th><th>Absent</th><th>%</th></tr></thead><tbody>${rows}</tbody></table>
  </body></html>`;

  downloadHTML(html, 'attendance-report.html');
  toast('Attendance report downloaded', 'success');
}

function generateFeeReport() {
  const d = State.data;
  const rows = d.fees.map(f => {
    const s = d.students.find(s => s.id === f.studentId);
    return `<tr><td>${s ? esc(s.name) : '—'}</td><td>${esc(f.term)}</td><td>${esc(f.type)}</td><td>₹${f.amount}</td><td>${f.paid ? 'Paid' : 'Pending'}</td><td>${f.paidDate||'—'}</td></tr>`;
  }).join('');

  const html = `<!DOCTYPE html><html><head><title>Fee Report</title>
  <style>body{font-family:sans-serif;padding:24px}h1{font-size:20px}table{width:100%;border-collapse:collapse;margin-top:20px}th,td{border:1px solid #ccc;padding:8px}th{background:#f0f0f0}</style>
  </head><body><h1>${esc(d.school.name)} — Fee Report</h1><h2>Generated: ${new Date().toLocaleDateString()}</h2>
  <table><thead><tr><th>Student</th><th>Term</th><th>Type</th><th>Amount</th><th>Status</th><th>Paid On</th></tr></thead><tbody>${rows}</tbody></table>
  </body></html>`;

  downloadHTML(html, 'fee-report.html');
  toast('Fee report downloaded', 'success');
}

function exportToExcel() {
  const d = State.data;
  const headers = ['Roll No,Name,Class,Email,Phone,Parent Phone,Address,DOB,Join Date'];
  const rows = d.students.map(s => [s.rollNumber,s.name,s.class,s.email,s.phone,s.parentPhone,s.address,s.dob,s.joinDate].map(v => `"${v||''}"`).join(','));
  const csv = [headers, ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'students.csv';
  a.click();
  toast('CSV exported', 'success');
}

function downloadHTML(html, filename) {
  const blob = new Blob([html], { type: 'text/html' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
}

// ─── Uploads ──────────────────────────────────────────────────────────────────
function renderUploads() {
  const content = document.getElementById('uploads-content');
  if (!content) return;
  content.innerHTML = `
    <div class="upload-zone" id="drop-zone" onclick="document.getElementById('file-upload-input').click()">
      <div class="upload-icon">📂</div>
      <p>Drag & drop files here, or <span>browse</span></p>
      <p style="font-size:12px;margin-top:6px">Supports: PDF, DOCX, PNG, JPG, ZIP</p>
    </div>
    <input type="file" id="file-upload-input" multiple style="display:none" accept=".pdf,.docx,.png,.jpg,.jpeg,.zip">
    <div id="uploaded-files-list" style="margin-top:20px"></div>
  `;

  document.getElementById('file-upload-input').addEventListener('change', handleFileUpload);

  const zone = document.getElementById('drop-zone');
  zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('drag-over'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
  zone.addEventListener('drop', e => {
    e.preventDefault();
    zone.classList.remove('drag-over');
    handleFileDrop(e.dataTransfer.files);
  });

  renderUploadedFilesList();
}

function handleFileUpload(e) {
  handleFileDrop(e.target.files);
}

function handleFileDrop(files) {
  Array.from(files).forEach(file => {
    State.uploadedFiles.push({ name: file.name, size: (file.size / 1024).toFixed(1) + ' KB', date: new Date().toLocaleDateString(), type: file.type });
  });
  toast(`${files.length} file(s) uploaded`, 'success');
  renderUploadedFilesList();
}

function renderUploadedFilesList() {
  const list = document.getElementById('uploaded-files-list');
  if (!list) return;
  if (!State.uploadedFiles.length) {
    list.innerHTML = `<div class="empty-state"><div class="icon">📂</div><h4>No files uploaded yet</h4></div>`;
    return;
  }
  list.innerHTML = `
    <div class="card">
      <div class="card-header"><h3>Uploaded Files</h3></div>
      <div class="card-body">
        <div class="table-wrap">
          <table>
            <thead><tr><th>Name</th><th>Size</th><th>Date</th><th>Action</th></tr></thead>
            <tbody>
              ${State.uploadedFiles.map((f, i) => `
                <tr>
                  <td>📄 ${esc(f.name)}</td>
                  <td>${esc(f.size)}</td>
                  <td>${esc(f.date)}</td>
                  <td><button class="btn-icon danger" onclick="removeUpload(${i})">🗑️</button></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}

function removeUpload(i) {
  State.uploadedFiles.splice(i, 1);
  renderUploadedFilesList();
  toast('File removed', 'info');
}

// ─── Settings ─────────────────────────────────────────────────────────────────
function renderSettings() {
  const content = document.getElementById('settings-content');
  if (!content) return;
  const u = State.currentUser;
  content.innerHTML = `
    <div class="card" style="max-width:600px">
      <div class="card-header"><h3>Profile Settings</h3></div>
      <div class="card-body">
        <div class="profile-hero" style="margin-bottom:20px">
          <div class="profile-avatar">${esc(u.avatar)}</div>
          <div class="profile-info">
            <h3>${esc(u.name)}</h3>
            <p>${esc(u.email)}</p>
            <span class="role-badge ${u.role}">${u.role}</span>
          </div>
        </div>
        <div class="form-group"><label>Full Name</label><input type="text" id="settings-name" value="${esc(u.name)}"></div>
        <div class="form-group"><label>Email</label><input type="email" id="settings-email" value="${esc(u.email)}"></div>
        <div class="form-group"><label>Phone</label><input type="text" id="settings-phone" value="${esc(u.phone||'')}"></div>
        <div class="form-group"><label>New Password (leave blank to keep)</label><input type="password" id="settings-password" placeholder="••••••••"></div>
        <button class="btn btn-cyan" onclick="saveSettings()">💾 Save Changes</button>
      </div>
    </div>
    <div class="card" style="max-width:600px;margin-top:16px">
      <div class="card-header"><h3>Appearance</h3></div>
      <div class="card-body" style="display:flex;align-items:center;gap:16px">
        <span>Dark Mode</span>
        <button class="btn btn-outline" onclick="document.getElementById('theme-toggle').click()">
          ${State.darkMode ? '☀️ Switch to Light' : '🌙 Switch to Dark'}
        </button>
      </div>
    </div>
  `;
}

function saveSettings() {
  const u = State.currentUser;
  const name     = document.getElementById('settings-name').value.trim();
  const email    = document.getElementById('settings-email').value.trim();
  const phone    = document.getElementById('settings-phone').value.trim();
  const password = document.getElementById('settings-password').value.trim();

  if (!name || !email) { toast('Name and email are required', 'error'); return; }

  const userIdx = State.data.users.findIndex(u2 => u2.id === u.id);
  u.name = name; u.email = email; u.phone = phone;
  u.avatar = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0,2);
  if (password) u.password = password;
  if (userIdx >= 0) Object.assign(State.data.users[userIdx], u);

  toast('Settings saved successfully', 'success');
  renderSidebar();
  renderTopbar();
}

// ─── Chatbot ─────────────────────────────────────────────────────────────────
function setupChatbot() {
  const btn    = document.getElementById('chatbot-btn');
  const window_ = document.getElementById('chatbot-window');
  const closeBtn = document.getElementById('chatbot-close');
  const sendBtn = document.getElementById('chat-send');
  const input  = document.getElementById('chat-input');

  if (!btn) return;

  btn.addEventListener('click', () => window_.classList.toggle('open'));
  closeBtn.addEventListener('click', () => window_.classList.remove('open'));

  sendBtn.addEventListener('click', sendChatMessage);
  input.addEventListener('keydown', e => e.key === 'Enter' && sendChatMessage());

  // Welcome message
  appendChatMsg('bot', `Hello! I'm your school assistant 🏫\n\nYou can ask me:\n• "Show my attendance"\n• "Check my fees"\n• "How many students?"\n• "List teachers"`);
}

function appendChatMsg(type, text) {
  const msgs = document.getElementById('chat-messages');
  if (!msgs) return;
  const div = document.createElement('div');
  div.className = `chat-msg ${type}`;
  div.innerHTML = esc(text).replace(/\n/g, '<br>');
  msgs.appendChild(div);
  msgs.scrollTop = msgs.scrollHeight;
}

function sendChatMessage() {
  const input = document.getElementById('chat-input');
  const msg = input.value.trim();
  if (!msg) return;

  appendChatMsg('user', msg);
  input.value = '';

  setTimeout(() => {
    const reply = processChatMessage(msg.toLowerCase());
    appendChatMsg('bot', reply);
  }, 400);
}

function processChatMessage(msg) {
  const d = State.data;
  const u = State.currentUser;

  if (msg.includes('attendance') && (msg.includes('my') || u.role === 'student')) {
    const student = d.students.find(s => s.userId === u.id);
    if (student) {
      const records = d.attendance.filter(a => a.studentId === student.id);
      const pct = records.length ? Math.round(records.filter(r => r.status === 'present').length / records.length * 100) : 0;
      return `📅 Your Attendance:\n• Present: ${records.filter(r => r.status === 'present').length} days\n• Absent: ${records.filter(r => r.status === 'absent').length} days\n• Percentage: ${pct}%\n\n${pct >= 75 ? '✅ Good attendance!' : '⚠️ Attendance below 75%!'}`;
    }
    return `📅 Overall school attendance: ${Math.round(d.attendance.filter(a => a.status === 'present').length / d.attendance.length * 100)}%`;
  }

  if (msg.includes('fee') || msg.includes('dues')) {
    if (u.role === 'student') {
      const student = d.students.find(s => s.userId === u.id);
      if (student) {
        const fees = d.fees.filter(f => f.studentId === student.id);
        const due = fees.filter(f => !f.paid).reduce((s, f) => s + f.amount, 0);
        return due > 0 ? `💰 You have ₹${due.toLocaleString()} in pending fees.\nPlease pay before the due date to avoid late charges.` : '✅ All your fees are paid! Great job!';
      }
    }
    const paid = d.fees.filter(f => f.paid).reduce((s, f) => s + f.amount, 0);
    const due  = d.fees.filter(f => !f.paid).reduce((s, f) => s + f.amount, 0);
    return `💰 Fee Summary:\n• Collected: ₹${paid.toLocaleString()}\n• Pending: ₹${due.toLocaleString()}\n• Total students with dues: ${new Set(d.fees.filter(f => !f.paid).map(f => f.studentId)).size}`;
  }

  if (msg.includes('student')) {
    if (msg.includes('how many') || msg.includes('count') || msg.includes('total')) {
      return `👨‍🎓 There are ${d.students.length} students enrolled across ${d.classes.length} classes.`;
    }
    return `👨‍🎓 Student Info:\n• Total: ${d.students.length}\n• Classes: ${d.classes.join(', ')}\n\nGo to Students page for full details.`;
  }

  if (msg.includes('teacher')) {
    return `👨‍🏫 Teachers:\n${d.teachers.map(t => `• ${t.name} — ${t.subjects.join(', ')}`).join('\n')}`;
  }

  if (msg.includes('subject') || msg.includes('course')) {
    return `📚 Subjects offered:\n${d.subjects.map(s => `• ${s.name} (${s.code})`).join('\n')}`;
  }

  if (msg.includes('hello') || msg.includes('hi') || msg.includes('hey')) {
    return `Hello, ${u.name}! 👋 How can I help you today?`;
  }

  if (msg.includes('help')) {
    return `I can help with:\n• "Show my attendance"\n• "Check my fees"\n• "How many students?"\n• "List teachers"\n• "Show subjects"`;
  }

  return `I didn't quite get that. Try asking:\n• "Show my attendance"\n• "Check my fees"\n• "How many students?"\n\nType "help" for more options.`;
}

// ─── Setup All Pages ──────────────────────────────────────────────────────────
function setupAllPages() {
  setupStudentsPage();
  setupFeeFilters();
  setupAttendancePage();
  setupModals();
  setupAddTeacherModal();
  setupAddFeeModal();
}

function setupFeeFilters() {
  const cf = document.getElementById('fee-status-filter');
  if (cf) cf.addEventListener('change', () => renderFees());
}

function setupAttendancePage() {
  const cf = document.getElementById('att-class-filter');
  if (cf) {
    cf.innerHTML = `<option value="all">All Classes</option>` +
      (State.data.classes || []).map(c => `<option value="${c}">${c}</option>`).join('');
    cf.addEventListener('change', () => renderAttendance());
  }

  const sf = document.getElementById('att-subject');
  if (sf) {
    sf.innerHTML = State.data.subjects.map(s => `<option value="${esc(s.name)}">${esc(s.name)}</option>`).join('');
  }

  const submitBtn = document.getElementById('submit-att-btn');
  if (submitBtn) submitBtn.addEventListener('click', submitAttendance);

  // Set today's date
  const dateInput = document.getElementById('att-date');
  if (dateInput) dateInput.value = new Date().toISOString().split('T')[0];
}

function setupModals() {
  // Generic close on overlay click
  $$('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', e => {
      if (e.target === overlay) overlay.classList.remove('open');
    });
  });

  $$('.modal-close').forEach(btn => {
    btn.addEventListener('click', () => btn.closest('.modal-overlay').classList.remove('open'));
  });

  // Student modal save
  const saveBtn = document.getElementById('save-student-btn');
  if (saveBtn) saveBtn.addEventListener('click', saveStudent);

  // Populate class select in modal
  const classSelect = document.getElementById('student-class-field');
  if (classSelect) {
    classSelect.innerHTML = State.data.classes.map(c => `<option value="${c}">${c}</option>`).join('');
  }
}

function setupAddTeacherModal() {
  const btn = document.getElementById('add-teacher-btn');
  if (!btn) return;
  btn.addEventListener('click', () => {
    document.getElementById('teacher-modal').classList.add('open');
  });

  const saveBtn = document.getElementById('save-teacher-btn');
  if (saveBtn) saveBtn.addEventListener('click', saveTeacher);
}

function saveTeacher() {
  const name  = document.getElementById('teacher-name-field').value.trim();
  const email = document.getElementById('teacher-email-field').value.trim();
  const phone = document.getElementById('teacher-phone-field').value.trim();
  const qual  = document.getElementById('teacher-qual-field').value.trim();
  const subj  = document.getElementById('teacher-subjects-field').value.trim();
  const cls   = document.getElementById('teacher-classes-field').value.trim();

  if (!name || !email) { toast('Name and email are required', 'error'); return; }

  State.data.teachers.push({
    id: `t${Date.now()}`, userId: null, name, email, phone, qualification: qual,
    subjects: subj.split(',').map(s => s.trim()).filter(Boolean),
    classes:  cls.split(',').map(c => c.trim()).filter(Boolean),
    joinDate: new Date().toISOString().split('T')[0],
    avatar: name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0,2)
  });

  document.getElementById('teacher-modal').classList.remove('open');
  toast('Teacher added successfully', 'success');
  renderTeachers();
  renderDashboard();
}

function setupAddFeeModal() {
  const btn = document.getElementById('add-fee-btn');
  if (!btn) return;
  btn.addEventListener('click', () => {
    // Populate student select
    const sel = document.getElementById('fee-student-field');
    if (sel) {
      sel.innerHTML = State.data.students.map(s => `<option value="${s.id}">${esc(s.name)} (${s.rollNumber})</option>`).join('');
    }
    document.getElementById('fee-modal').classList.add('open');
  });

  const saveBtn = document.getElementById('save-fee-btn');
  if (saveBtn) saveBtn.addEventListener('click', saveFee);
}

function saveFee() {
  const sid    = document.getElementById('fee-student-field').value;
  const amount = parseFloat(document.getElementById('fee-amount-field').value);
  const type   = document.getElementById('fee-type-field').value.trim();
  const term   = document.getElementById('fee-term-field').value.trim();
  const due    = document.getElementById('fee-due-field').value;

  if (!sid || !amount || !type || !term) { toast('All fields are required', 'error'); return; }

  State.data.fees.push({
    id: `f${Date.now()}`, studentId: sid, amount, type, term, dueDate: due,
    paid: false, paidDate: null, receiptNo: null
  });

  document.getElementById('fee-modal').classList.remove('open');
  toast('Fee record added', 'success');
  renderFees();
}

// ─── Entry Point ──────────────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', async () => {
  await loadData();
  setupAuthForm();

  // Make functions available globally (called from HTML onclick)
  Object.assign(window, {
    navigateTo, viewStudent, editStudent, deleteStudent,
    markAttendance, submitAttendance, markFeePaid, generateReceipt,
    deleteTeacher, generateStudentReport, generateAttendanceReport,
    generateFeeReport, exportToExcel, removeUpload, saveSettings
  });
});