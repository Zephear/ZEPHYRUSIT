// ==========================================
// AUTHORIZATION
// ==========================================
let currentUser = null;

function initLoginApp() {
  const loginForm = document.getElementById('login-form');
  if (!loginForm) return;

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const errorEl = document.getElementById('login-error');

    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (response.ok) {
        localStorage.setItem('jwt_token', data.access_token);
        currentUser = {
          user_id: data.user_id,
          username: data.username,
          role: data.role,
        };
        errorEl.style.display = 'none';

        document.getElementById('login-section').style.display = 'none';
        document.getElementById('main-nav').style.display = 'flex';
        document.getElementById('main-content').style.display = 'block';

        document.querySelectorAll('.admin-only').forEach((el) => {
          el.style.display = currentUser.role === 'admin' ? '' : 'none';
        });

        showPage('home');
        initNewsApp();
        initNotesApp();
        initRegisterApp();
        initDirectoryApp();

        const nameEl = document.getElementById('user-info-name');
        const roleEl = document.getElementById('user-info-role');
        if (nameEl) nameEl.textContent = '👤 ' + data.username;
        if (roleEl) {
          roleEl.textContent = data.role === 'admin' ? 'Admin' : 'User';
          roleEl.className = 'user-info-role role-' + data.role;
        }
      } else {
        errorEl.style.display = 'block';
      }
    } catch (error) {
      const errorEl = document.getElementById('login-error');
      errorEl.style.display = 'block';
    }
  });
}
// ==========================================
// USER REGISTRATION LOGIC
// ==========================================

function initRegisterApp() {
  const openRegBtn = document.getElementById('open-register-modal-btn');
  const cancelRegBtn = document.getElementById('cancel-register-btn');
  const saveRegBtn = document.getElementById('save-register-btn');
  const regOverlay = document.getElementById('register-modal-overlay');

  if (openRegBtn) {
    openRegBtn.addEventListener('click', (e) => {
      e.preventDefault();
      if (currentUser && currentUser.role === 'admin') {
        regOverlay.classList.add('active');
      }
    });
  }

  if (cancelRegBtn) {
    cancelRegBtn.addEventListener('click', closeRegisterModal);
  }

  if (regOverlay) {
    regOverlay.addEventListener('click', (e) => {
      if (e.target === regOverlay) closeRegisterModal();
    });
  }

  if (saveRegBtn) {
    saveRegBtn.addEventListener('click', handleRegisterUser);
  }
}

function closeRegisterModal() {
  const regOverlay = document.getElementById('register-modal-overlay');
  if (regOverlay) regOverlay.classList.remove('active');
  document.getElementById('reg-username').value = '';
  document.getElementById('reg-password').value = '';
  document.getElementById('reg-role').value = 'user';
}

async function handleRegisterUser() {
  const username = document.getElementById('reg-username').value.trim();
  const password = document.getElementById('reg-password').value.trim();
  const role = document.getElementById('reg-role').value;

  if (!username || !password) {
    alert('Please fill in both username and password.');
    return;
  }

  const token = localStorage.getItem('jwt_token');

  try {
    const response = await fetch('/api/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        username: username,
        password: password,
        role: role,
      }),
    });

    const data = await response.json();

    if (response.ok) {
      alert(data.message || 'User registered successfully!');
      closeRegisterModal();
    } else {
      alert(data.error || 'Registration error.');
    }
  } catch (error) {
    console.error('Registration error:', error);
    alert('No connection to the server.');
  }
}
// ==========================================
// LOGOUT LOGIC
// ==========================================

function initLogoutApp() {
  const logoutBtn = document.getElementById('logout-btn');
  if (!logoutBtn) return;

  logoutBtn.addEventListener('click', (e) => {
    e.preventDefault();

    currentUser = null;
    localStorage.removeItem('jwt_token');
    document.getElementById('username').value = '';
    document.getElementById('password').value = '';
    document.getElementById('login-error').style.display = 'none';

    document.getElementById('main-nav').style.display = 'none';
    document.getElementById('main-content').style.display = 'none';

    document.getElementById('login-section').style.display = 'flex';
  });
}

// ==========================================
// EMPLOYEE DIRECTORY LOGIC
// ==========================================

function initDirectoryApp() {
  const openDirBtn = document.getElementById('open-directory-btn');
  const closeDirBtn = document.getElementById('close-directory-btn');
  const dirOverlay = document.getElementById('directory-modal-overlay');

  if (openDirBtn) {
    openDirBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      await loadDirectory();
      dirOverlay.classList.add('active');
    });
  }

  if (closeDirBtn) {
    closeDirBtn.addEventListener('click', () => {
      dirOverlay.classList.remove('active');
    });
  }

  if (dirOverlay) {
    dirOverlay.addEventListener('click', (e) => {
      if (e.target === dirOverlay) dirOverlay.classList.remove('active');
    });
  }
}

async function loadDirectory() {
  const container = document.getElementById('employee-list-container');
  container.innerHTML = '<p style="text-align:center;">Loading data...</p>';

  try {
    const res = await fetch('/api/users');
    if (res.ok) {
      const users = await res.json();
      container.innerHTML = '';

      const table = document.createElement('table');
      table.style.width = '100%';
      table.style.borderCollapse = 'collapse';

      const isAdmin = currentUser && currentUser.role === 'admin';

      table.innerHTML = `
        <tr style="border-bottom: 1px solid rgba(255,255,255,0.2); text-align: left;">
          <th style="padding: 10px;">ID</th>
          <th style="padding: 10px;">Username</th>
          <th style="padding: 10px;">Role</th>
          ${isAdmin ? '<th style="padding: 10px;">Action</th>' : ''}
        </tr>
      `;

      users.forEach((user) => {
        const tr = document.createElement('tr');
        tr.style.borderBottom = '1px solid rgba(255,255,255,0.05)';

        const usernameColor = user.role === 'admin' ? '#2b9720' : '#fff';
        const roleIcon = user.role === 'admin' ? '🛡️ Admin' : '👤 User';
        const isSelf = currentUser && currentUser.user_id === user.id;

        let deleteCell = '';
        if (isAdmin) {
          deleteCell = isSelf
            ? `<td style="padding: 10px; color: rgba(255,255,255,0.25); font-size: 0.8em;">—</td>`
            : `<td style="padding: 10px;">
                <button onclick="deleteEmployee(${user.id}, '${user.username}')"
                  style="background: rgba(255,107,107,0.15); border: 1px solid rgba(255,107,107,0.4);
                         color: #ff6b6b; border-radius: 6px; padding: 4px 10px; cursor: pointer;
                         font-size: 0.85em; transition: background 0.2s;"
                  onmouseover="this.style.background='rgba(255,107,107,0.3)'"
                  onmouseout="this.style.background='rgba(255,107,107,0.15)'"
                >🗑️ Delete</button>
               </td>`;
        }

        tr.innerHTML = `
          <td style="padding: 10px; color: rgba(255,255,255,0.5);">${user.id}</td>
          <td style="padding: 10px; font-weight: 600; color: ${usernameColor};">${user.username}${isSelf ? ' <span style="font-size:0.75em;color:#2b9720;">(you)</span>' : ''}</td>
          <td style="padding: 10px; font-size: 0.9em;">${roleIcon}</td>
          ${deleteCell}
        `;
        table.appendChild(tr);
      });

      container.appendChild(table);
    } else {
      container.innerHTML =
        '<p style="color: #ff6b6b;">Failed to load employees.</p>';
    }
  } catch (e) {
    console.error('Directory error:', e);
    container.innerHTML =
      '<p style="color: #ff6b6b;">No connection to the server.</p>';
  }
}

window.deleteEmployee = async (userId, username) => {
  if (
    !confirm(
      `Are you sure you want to delete employee "${username}"?\nThis will also delete all their notes.`,
    )
  )
    return;

  try {
    const res = await fetch(`/api/users/${userId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requester_id: currentUser.user_id,
        requester_role: currentUser.role,
      }),
    });

    const data = await res.json();

    if (res.ok) {
      await loadDirectory();
    } else {
      alert(data.error || 'Failed to delete employee.');
    }
  } catch (e) {
    console.error('Delete employee error:', e);
    alert('No connection to the server.');
  }
};
// ==========================================
// SITE NAVIGATION
// ==========================================

function showPage(page) {
  document.querySelectorAll('.page-section').forEach((section) => {
    section.classList.remove('active');
  });
  const targetSection = document.getElementById(page + '-section');
  if (targetSection) targetSection.classList.add('active');

  document.querySelectorAll('.nav-link').forEach((link) => {
    link.classList.remove('active');
  });

  if (page === 'home') {
    const link = document.querySelector('.nav-link:nth-child(1)');
    if (link) link.classList.add('active');
  } else if (page === 'dictionary') {
    const link = document.querySelector('.nav-link:nth-child(2)');
    if (link) link.classList.add('active');
    loadNotes();
  }
}

// ==========================================
// NEWS LOGIC
// ==========================================

let allNews = [];
let editingNewsId = null;

function getReadNewsIds() {
  if (!currentUser) return [];
  const stored = localStorage.getItem(`read_news_${currentUser.username}`);
  return stored ? JSON.parse(stored) : [];
}

function setReadNewsIds(ids) {
  if (!currentUser) return;
  localStorage.setItem(
    `read_news_${currentUser.username}`,
    JSON.stringify(ids),
  );
}

async function loadNews() {
  try {
    const res = await fetch('/api/news');
    if (res.ok) {
      allNews = await res.json();
      renderNews();
    }
  } catch (e) {
    console.error('Error loading news', e);
  }
}

function openNewsModal(editId = null) {
  editingNewsId = editId;
  const modalTitle = document.getElementById('news-modal-title');
  const titleInput = document.getElementById('news-title-input');
  const contentInput = document.getElementById('news-content-input');
  const saveNewsBtn = document.getElementById('save-news-btn');
  const newsModalOverlay = document.getElementById('news-modal-overlay');

  if (editId !== null) {
    const news = allNews.find((n) => n.id === editId);
    modalTitle.textContent = 'Edit News';
    titleInput.value = news.title;
    contentInput.value = news.content;
    saveNewsBtn.textContent = 'Update';
  } else {
    modalTitle.textContent = 'Add News';
    titleInput.value = '';
    contentInput.value = '';
    saveNewsBtn.textContent = 'Save';
  }

  newsModalOverlay.classList.add('active');
}

function closeNewsModal() {
  document.getElementById('news-modal-overlay').classList.remove('active');
  editingNewsId = null;
  document.getElementById('news-title-input').value = '';
  document.getElementById('news-content-input').value = '';
}

async function handleSaveNews() {
  const title = document.getElementById('news-title-input').value.trim();
  const content = document.getElementById('news-content-input').value.trim();

  if (!title || !content) {
    alert('Please fill in both title and content.');
    return;
  }

  const token = localStorage.getItem('jwt_token');

  try {
    let res;
    if (editingNewsId !== null) {
      res = await fetch(`/api/news/${editingNewsId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ title, content }),
      });
    } else {
      res = await fetch('/api/news', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ title, content }),
      });
    }

    if (res.ok) {
      closeNewsModal();
      await loadNews();
    } else {
      alert('Error saving news');
    }
  } catch (e) {
    alert('No connection to the server');
  }
}

function renderNews() {
  const container = document.getElementById('news-list-container');
  if (!container) return;
  container.innerHTML = '';

  if (allNews.length === 0) {
    container.innerHTML =
      '<p style="color: #888; text-align: center; margin-top: 40px;">No news yet.</p>';
    return;
  }

  const readIds = getReadNewsIds();

  allNews.forEach((news) => {
    const isRead = readIds.includes(news.id);
    const card = document.createElement('div');
    card.className = `content news-card ${isRead ? 'news-read' : ''}`;

    let adminActions = '';
    if (currentUser && currentUser.role === 'admin') {
      adminActions = `
        <button class="pin-btn" onclick="editNews(${news.id})" title="Edit">✏️</button>
        <button class="delete-btn" onclick="deleteNews(${news.id})" title="Delete">🗑️</button>
      `;
    }

    const formattedContent = news.content.replace(/\n/g, '<br>');

    card.innerHTML = `
      <div class="card-header">
        <h2 class="section-subtitle" style="margin: 0; text-align: left;">
          ${isRead ? news.title : `<span class="accent">${news.title}</span>`}
        </h2>
        <div class="card-actions">
          <button class="pin-btn ${isRead ? 'active' : ''}" onclick="toggleNewsRead(${news.id})" title="${isRead ? 'Mark as unread' : 'Mark as read'}">
            ${isRead ? '✅' : '👁️'}
          </button>
          ${adminActions}
        </div>
      </div>
      <p class="section-text" style="text-align: left; margin-top: 12px; margin-bottom: 0;">${formattedContent}</p>
      ${isRead ? '<div class="news-read-label" style="text-align: left; font-size: 0.85rem; color: #888; margin-top: 15px;">✓ Read</div>' : ''}
    `;
    container.appendChild(card);
  });
}

window.toggleNewsRead = (id) => {
  let readIds = getReadNewsIds();

  if (readIds.includes(id)) {
    readIds = readIds.filter((readId) => readId !== id);
  } else {
    readIds.push(id);
  }

  setReadNewsIds(readIds);
  renderNews();
};

window.editNews = (id) => openNewsModal(id);

window.deleteNews = async (id) => {
  if (!confirm('Are you sure you want to delete this news post?')) return;
  const token = localStorage.getItem('jwt_token');
  try {
    await fetch(`/api/news/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    await loadNews();
  } catch (e) {
    console.error(e);
  }
};

function initNewsApp() {
  const openNewsModalBtn = document.getElementById('open-news-modal-btn');
  const cancelNewsBtn = document.getElementById('cancel-news-btn');
  const saveNewsBtn = document.getElementById('save-news-btn');
  const newsModalOverlay = document.getElementById('news-modal-overlay');

  if (openNewsModalBtn) {
    if (currentUser && currentUser.role !== 'admin') {
      openNewsModalBtn.style.display = 'none';
    } else {
      openNewsModalBtn.style.display = 'inline-block';
      openNewsModalBtn.addEventListener('click', () => openNewsModal(null));
    }
  }

  if (cancelNewsBtn) cancelNewsBtn.addEventListener('click', closeNewsModal);
  if (saveNewsBtn) saveNewsBtn.addEventListener('click', handleSaveNews);
  if (newsModalOverlay)
    newsModalOverlay.addEventListener('click', (e) => {
      if (e.target === newsModalOverlay) closeNewsModal();
    });

  loadNews();
}

// ==========================================
// NOTES LOGIC
// ==========================================

let allNotes = [];
let activeTab = 'All Notes';
let editingNoteId = null;

async function loadNotes() {
  if (!currentUser) return;
  try {
    const res = await fetch(`/api/notes/${currentUser.user_id}`);
    if (res.ok) {
      allNotes = await res.json();
      renderNotes();
    }
  } catch (e) {
    console.error('Error loading notes', e);
  }
}

function initNotesApp() {
  const tabs = document.querySelectorAll('.alphabet-search .alpha-btn');
  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      tabs.forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
      activeTab = tab.getAttribute('data-range');
      updateModalForm();
      renderNotes();
    });
  });

  const openModalBtn = document.getElementById('open-modal-btn');
  const closeModalBtn = document.getElementById('cancel-note-btn');
  const saveNoteBtn = document.getElementById('save-note-btn');
  const modalOverlay = document.getElementById('note-modal-overlay');

  if (openModalBtn) openModalBtn.addEventListener('click', openModal);
  if (closeModalBtn) closeModalBtn.addEventListener('click', closeModal);
  if (saveNoteBtn) saveNoteBtn.addEventListener('click', handleSaveNote);
  if (modalOverlay)
    modalOverlay.addEventListener('click', (e) => {
      if (e.target === modalOverlay) closeModal();
    });

  const firstTab = document.querySelector('.alphabet-search .alpha-btn');
  if (firstTab) firstTab.classList.add('active');

  updateModalForm();
}

function openModal() {
  const modalOverlay = document.getElementById('note-modal-overlay');
  if (modalOverlay) modalOverlay.classList.add('active');
}

function closeModal() {
  const modalOverlay = document.getElementById('note-modal-overlay');
  if (modalOverlay) modalOverlay.classList.remove('active');
  document.getElementById('note-title').value = '';
  document.getElementById('note-content').value = '';
  document.getElementById('task-assignee').value = '';
  editingNoteId = null;
  updateModalForm();
}

function updateModalForm() {
  const openModalBtn = document.getElementById('open-modal-btn');
  const assigneeGroup = document.getElementById('assignee-group');
  const modalTitle = document.getElementById('modal-title');
  const saveNoteBtn = document.getElementById('save-note-btn');
  if (!openModalBtn) return;

  if (activeTab === 'Tasks' && currentUser && currentUser.role !== 'admin') {
    openModalBtn.style.display = 'none';
  } else {
    openModalBtn.style.display = 'inline-flex';
    const labelEl = openModalBtn.querySelector('.btn-label');
    if (labelEl)
      labelEl.textContent = activeTab === 'Tasks' ? 'Assign Task' : 'Add Note';
  }

  if (!editingNoteId) {
    if (activeTab === 'Tasks') {
      modalTitle.textContent = 'Assign New Task';
      if (assigneeGroup) assigneeGroup.style.display = 'flex';
      saveNoteBtn.textContent = 'Assign';
    } else {
      modalTitle.textContent = 'Create ' + activeTab;
      if (assigneeGroup) assigneeGroup.style.display = 'none';
      saveNoteBtn.textContent = 'Save';
    }
  }
}

window.editNote = (id) => {
  const note = allNotes.find((n) => n.id === id);
  if (!note) return;

  editingNoteId = id;

  document.getElementById('note-title').value = note.title;
  document.getElementById('note-content').value = note.content;

  if (note.type === 'Tasks') {
    document.getElementById('task-assignee').value = note.assignee || '';
  }

  document.getElementById('modal-title').textContent = 'Edit Note';
  document.getElementById('save-note-btn').textContent = 'Update';

  openModal();
};

function renderNotes() {
  const container = document.getElementById('notes-list-container');
  if (!container) return;
  container.innerHTML = '';

  const filteredNotes = allNotes.filter((note) => {
    if (activeTab === 'All Notes')
      return note.type === 'All Notes' && !note.is_pinned;
    if (activeTab === 'Pinned')
      return note.is_pinned === true && note.type !== 'Tasks';
    if (activeTab === 'Tasks') return note.type === 'Tasks';
    if (activeTab === 'Passwords') return note.type === 'Passwords';
    return false;
  });

  if (filteredNotes.length === 0) {
    container.innerHTML =
      '<p style="color: #888; text-align: center; grid-column: 1 / -1; margin-top: 40px;">No notes found in this category.</p>';
    return;
  }

  filteredNotes.forEach((note) => {
    const card = document.createElement('div');
    card.className = `note-card ${note.is_completed ? 'completed' : ''}`;

    let extraMeta = '';
    let actionBtn = '';

    const pinBtnHtml =
      note.type !== 'Tasks'
        ? `<button class="pin-btn ${note.is_pinned ? 'active' : ''}" onclick="togglePin(${note.id})" title="Pin / Unpin">📌</button>`
        : '';

    let editBtnHtml = `<button class="pin-btn" onclick="editNote(${note.id})" title="Edit note">✏️</button>`;
    let deleteBtnHtml = `<button class="delete-btn" onclick="deleteNote(${note.id})" title="Delete note">🗑️</button>`;

    if (note.type === 'Tasks') {
      extraMeta = `<span class="badge">Assignee: ${note.assignee || '—'}</span>`;

      if (
        !note.is_completed &&
        (currentUser.role === 'admin' || currentUser.username === note.assignee)
      ) {
        actionBtn = `<button class="task-action-btn" onclick="toggleTask(${note.id})">Mark Done</button>`;
      } else if (note.is_completed) {
        actionBtn = `<span style="color: #2b9720;">✓ Completed</span>`;
      }

      if (currentUser && currentUser.role !== 'admin') {
        editBtnHtml = '';
        if (!note.is_completed) {
          deleteBtnHtml = '';
        }
      }
    } else {
      const badgeLabel = note.type === 'All Notes' ? 'General' : note.type;
      extraMeta = `<span class="badge">${badgeLabel}</span>`;
    }

    const formattedContent = note.content.replace(/\n/g, '<br>');
    card.innerHTML = `
      <div class="card-header">
        <h3>${note.title}</h3>
        <div class="card-actions">
          ${editBtnHtml}
          ${pinBtnHtml}
          ${deleteBtnHtml}
        </div>
      </div>
      <p>${formattedContent}</p>
      <div class="note-meta">${extraMeta}${actionBtn}</div>
    `;
    container.appendChild(card);
  });
}

async function handleSaveNote() {
  const title = document.getElementById('note-title').value.trim();
  const content = document.getElementById('note-content').value.trim();
  const assignee = document.getElementById('task-assignee').value.trim();

  if (!title || !content) {
    alert('Please fill in both title and content.');
    return;
  }
  if (
    activeTab === 'Tasks' &&
    currentUser.role === 'admin' &&
    !assignee &&
    !editingNoteId
  ) {
    alert('Please enter an assignee username.');
    return;
  }

  let noteType =
    activeTab === 'Tasks'
      ? 'Tasks'
      : activeTab === 'Passwords'
        ? 'Passwords'
        : 'All Notes';

  try {
    let res;

    if (editingNoteId) {
      res = await fetch(`/api/notes/${editingNoteId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          content,
        }),
      });
    } else {
      res = await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: currentUser.user_id,
          title,
          content,
          type: noteType,
          assignee: activeTab === 'Tasks' ? assignee : null,
          is_pinned: activeTab === 'Pinned',
        }),
      });
    }

    if (res.ok) {
      closeModal();
      await loadNotes();
    } else {
      alert('Error saving note');
    }
  } catch (e) {
    alert('No connection to the server');
  }
}

window.toggleTask = async (id) => {
  try {
    await fetch(`/api/notes/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_completed: true }),
    });
    await loadNotes();
  } catch (e) {
    console.error(e);
  }
};

window.togglePin = async (id) => {
  const note = allNotes.find((n) => n.id === id);
  if (!note) return;
  try {
    await fetch(`/api/notes/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_pinned: !note.is_pinned }),
    });
    await loadNotes();
  } catch (e) {
    console.error(e);
  }
};

window.deleteNote = async (id) => {
  if (!confirm('Are you sure you want to delete this note?')) return;
  try {
    await fetch(`/api/notes/${id}`, { method: 'DELETE' });
    await loadNotes();
  } catch (e) {
    console.error(e);
  }
};

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('main-nav').style.display = 'none';
  document.getElementById('main-content').style.display = 'none';

  initLoginApp();
  initLogoutApp();
});
