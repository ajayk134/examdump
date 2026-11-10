(() => {
  const API_BASE = window.EXAMDUMP_API_BASE || "https://exam.dumpsk134.workers.dev";

  const providerSelect = document.getElementById("providerSelect");
  const providerSearch = document.getElementById("providerSearch");
  const providerOptions = document.getElementById("providerOptions");

  const listFilter = document.getElementById("listFilter");
  const examsList = document.getElementById("examsList");
  const examContainer = document.getElementById("examContainer");
  const emptyState = document.getElementById("empty");
  const examCount = document.getElementById("examCount");

  let cache = new Map();

  let selectedProvider = null;
  let providerExamMap = {};
  let allExams = [];

  /* ================= HELPERS ================= */

  function cleanExamTitle(examKey) {
    return examKey.split("__")[0];
  }

  async function fetchJson(path) {
    if (cache.has(path)) return cache.get(path);

    const pw = sessionStorage.getItem("exam_pw");
    const headers = {};
    if (pw) headers["X-Exam-Password"] = pw;

    const res = await fetch(path, { headers });
    if (!res.ok) throw new Error("Fetch failed");

    const json = await res.json();
    cache.set(path, json);
    return json;
  }

  /* ================= DROPDOWNS ================= */

  function openDropdown(el) {
    el.dataset.open = "true";
    el.querySelector(".options").style.display = "block";
  }

  function closeDropdown(el) {
    el.dataset.open = "false";
    el.querySelector(".options").style.display = "none";
  }

  function toggleDropdown(el) {
    el.dataset.open === "true" ? closeDropdown(el) : openDropdown(el);
  }

  /* ================= PROVIDERS ================= */

  function renderProviders(index) {
    providerOptions.innerHTML = "";

    Object.entries(index).forEach(([key, meta]) => {
      const li = document.createElement("li");
      li.className = "option-item";
      li.dataset.key = key;
      li.textContent = meta.title;
      li.onclick = () => selectProvider(key, meta);
      providerOptions.appendChild(li);
    });
  }

  async function selectProvider(providerKey, meta) {
    selectedProvider = providerKey;

    providerSearch.value = meta.title;
    closeDropdown(providerSelect);

    examContainer.style.display = "block";
    emptyState.style.display = "none";
    listFilter.value = "";

    examsList.innerHTML = `<li class="empty-state">Loading exams...</li>`;

    try {
      const examsJson = await fetchJson(`${API_BASE}/${selectedProvider}/exams`);
      providerExamMap = examsJson[selectedProvider] || {};
      allExams = Object.keys(providerExamMap).sort();

      examCount.textContent = `${allExams.length} exams`;
      renderExamList(allExams);
    } catch (err) {
      examsList.innerHTML = `<li class="empty-state">Error loading exams.</li>`;
    }
  }

  /* ================= EXAMS LIST ================= */

  function renderExamList(exams) {
    examsList.innerHTML = "";

    if (!exams.length) {
      examsList.innerHTML = `<li class="empty-state">No matching exams</li>`;
      return;
    }

    exams.forEach(exam => {
      const li = document.createElement("li");
      li.className = "exam-row";
      li.innerHTML = `
        <div class="exam-left">
          <div class="exam-title">
            ${cleanExamTitle(exam)}
            <span style="opacity:.7;font-size:0.9em;font-weight:normal;margin-left:8px;">
              (${providerExamMap[exam]})
            </span>
          </div>
        </div>
        <div class="exam-right" style="display:flex; gap: 8px;">
          <button class="open-small primary-btn" data-mode="practice">Practice</button>
          <button class="open-small ghost-btn" data-mode="reading">Read</button>
        </div>
      `;

      li.onclick = () => navigate(exam, 'practice'); // default row click to practice

      const btns = li.querySelectorAll("button");
      btns[0].onclick = e => { e.stopPropagation(); navigate(exam, 'practice'); };
      btns[1].onclick = e => { e.stopPropagation(); navigate(exam, 'reading'); };

      examsList.appendChild(li);
    });
  }

  function navigate(exam, mode = 'practice') {
    const page = mode === 'practice' ? 'practice_mode.html' : 'reading_mode.html';
    window.location = `${page}?provider=${encodeURIComponent(selectedProvider)}&exam=${encodeURIComponent(exam)}`;
  }

  /* ================= SEARCH ================= */

  providerSearch.oninput = e => {
    const q = e.target.value.toLowerCase();
    [...providerOptions.children].forEach(li => {
      li.style.display = li.textContent.toLowerCase().includes(q) ? "" : "none";
    });
  };

  listFilter.oninput = e => {
    const q = e.target.value.toLowerCase();
    renderExamList(allExams.filter(ex => cleanExamTitle(ex).toLowerCase().includes(q)));
  };

  /* ================= EVENTS ================= */

  providerSearch.onfocus = () => openDropdown(providerSelect);
  providerSelect.querySelector(".caret").onclick = () => toggleDropdown(providerSelect);

  document.addEventListener("click", e => {
    if (!providerSelect.contains(e.target)) closeDropdown(providerSelect);
  });

  document.addEventListener("keydown", e => {
    if (e.key === "Escape") closeDropdown(providerSelect);
  });

  /* ================= LOGIN & INIT ================= */

  const loginCard = document.getElementById("loginCard");
  const mainApp = document.getElementById("mainApp");
  const pwInput = document.getElementById("pwInput");
  const loginBtn = document.getElementById("loginBtn");
  const loginError = document.getElementById("loginError");

  loginBtn.onclick = async () => {
    loginError.style.display = "none";
    const pw = pwInput.value.trim();
    if (!pw) return;

    sessionStorage.setItem("exam_pw", pw);
    loginBtn.textContent = "Verifying...";
    
    try {
      const index = await fetchJson(`${API_BASE}/index`);
      renderProviders(index);
      loginCard.style.display = "none";
      mainApp.style.display = "block";
      emptyState.style.display = "none";
    } catch(err) {
      loginError.style.display = "block";
      sessionStorage.removeItem("exam_pw");
    } finally {
      loginBtn.textContent = "Unlock Database";
    }
  };

  pwInput.onkeypress = (e) => {
    if (e.key === "Enter") loginBtn.click();
  };

  (async function init() {
    if (!sessionStorage.getItem("exam_pw")) {
      loginCard.style.display = "block";
      return;
    }

    try {
      const index = await fetchJson(`${API_BASE}/index`);
      renderProviders(index);
      mainApp.style.display = "block";
      emptyState.style.display = "none";
    } catch(err) {
      sessionStorage.removeItem("exam_pw");
      loginCard.style.display = "block";
    }
  })();
})();
