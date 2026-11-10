(() => {
  const API_BASE = window.EXAMDUMP_API_BASE || "https://exam.dumpsk134.workers.dev";

  const params = new URLSearchParams(window.location.search);
  const provider = params.get("provider");
  const exam = params.get("exam");

  const container = document.getElementById("questionsContainer");
  const examTitle = document.getElementById("examTitle");
  const errorEl = document.getElementById("error");

  if (!provider || !exam) {
    examTitle.textContent = "No exam selected";
    return;
  }

  examTitle.textContent = exam.slice(0, exam.indexOf("__") >>> 0);

  /* ================= HELPERS ================= */

  const stripOption = (text = "", key = "") =>
    text.replace(new RegExp(`^\\s*${key}[\\.\\):\\-]\\s*`, "i"), "").trim();

  const hasValidVotes = votes =>
    Array.isArray(votes) && votes.some(v => v.vote_count > 0);

  const getMostVotedOptions = votes => {
    const mv = votes?.find(v => v.is_most_voted);
    return mv?.voted_answers?.replace(/\s+/g, "").split("") || [];
  };

  const el = (tag, cls, text) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  };

  /* ================= IMAGE OBSERVER ================= */

  const imageObserver = (() => {
    if (!("IntersectionObserver" in window)) return null;

    return new IntersectionObserver(
      (entries, obs) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const img = entry.target;
            const delay = Math.floor(Math.random() * 120);
            setTimeout(() => {
              if (img.dataset.src) {
                img.src = img.dataset.src;
                delete img.dataset.src;
              }
            }, delay);
            obs.unobserve(img);
          }
        });
      },
      { rootMargin: "200px", threshold: 0.01 }
    );
  })();

  function createDeferredImage(src) {
    const img = document.createElement("img");
    img.loading = "lazy";
    img.referrerPolicy = "no-referrer";
    img.alt = "";
    if (src) img.dataset.src = src;
    imageObserver ? imageObserver.observe(img) : (img.src = src);
    return img;
  }

  /* ================= CONTENT RENDER ================= */

  function renderContent(parent, content, inline = false, key = "") {
    if (!Array.isArray(content)) return;

    if (inline) {
      const span = document.createElement("span");
      content.forEach(i => {
        if (i.type === "text") {
          span.append(stripOption(i.value, key) + " ");
        } else if (i.type === "image") {
          span.appendChild(createDeferredImage(i.src));
        }
      });
      if (span.textContent.trim() || span.children.length) {
        parent.appendChild(span);
      }
      return;
    }

    content.forEach(i => {
      if (i.type === "text") {
        parent.appendChild(el("p", null, i.value));
      } else if (i.type === "image") {
        parent.appendChild(createDeferredImage(i.src));
      }
    });
  }

  /* ================= RENDER EXAM ================= */

  function renderExam(questions) {
    container.innerHTML = "";
    const keys = Object.keys(questions);
    if (!keys.length) return;

    const CHUNK = 8;
    let i = 0;

    function renderChunk() {
      const frag = document.createDocumentFragment();
      const end = Math.min(i + CHUNK, keys.length);

      for (; i < end; i++) {
        const qKey = keys[i];
        const q = questions[qKey];

        const card = el("div", "question-card");
        card.tabIndex = 0;

	card.appendChild(el("h2","question-title",(q.Title?.match(/Exam\s+(.*?)(?=\s+discussion\s+-\s+ExamTopics)/i)?.[1]) || qKey));

        if (q.Question?.content?.length) {
          const qt = el("div", "question-text");
          renderContent(qt, q.Question.content);
          card.appendChild(qt);
        }

        const mostVoted = hasValidVotes(q.Vote_count)
          ? getMostVotedOptions(q.Vote_count)
          : [];

        if (q.Choices) {
          const ul = el("ul", "choices");

          Object.keys(q.Choices).sort().forEach(k => {
            const li = el("li", "choice-item");
            li.appendChild(el("span", "choice-letter", `${k}.`));
            renderContent(li, q.Choices[k].content, true, k);

            if (mostVoted.includes(k)) {
              li.appendChild(el("span", "badge-most-voted", "Most Voted"));
            }

            ul.appendChild(li);
          });

          card.appendChild(ul);
        }

        if (q.Answer?.content?.length) {
          const ans = el("div", "answer-box");
          renderContent(ans, q.Answer.content);

          if (hasValidVotes(q.Vote_count)) {
            ans.appendChild(
              el("div", "vote-summary", "Community vote distribution")
            );

            const bar = el("div", "vote-bar");
            const total = q.Vote_count.reduce(
              (s, v) => s + v.vote_count,
              0
            );

            q.Vote_count
              .filter(v => v.vote_count > 0)
              .sort((a, b) => b.vote_count - a.vote_count)
              .forEach((v, idx) => {
                const pct = Math.round((v.vote_count / total) * 100);
                const seg = el(
                  "div",
                  `vote-segment vote-rank-${idx + 1}`,
                  `${v.voted_answers} (${pct}%)`
                );
                seg.style.width = `${pct}%`;
                bar.appendChild(seg);
              });

            ans.appendChild(bar);
          }

          card.appendChild(ans);
        }

        frag.appendChild(card);
      }

      container.appendChild(frag);

      if (i < keys.length) {
        setTimeout(renderChunk, 40);
      } else {
        container.querySelector(".question-card")?.focus();
      }
    }

    renderChunk();
  }

  /* ================= FETCH ================= */

  fetch(`${API_BASE}/${provider}/${exam}`)
    .then(res => {
      if (!res.ok) throw new Error();
      return res.json();
    })
    .then(json => {
      const questions = json?.[exam];
      if (!questions) throw new Error();
      renderExam(questions);
    })
    .catch(() => {
      errorEl.style.display = "block";
      errorEl.textContent = "❌ Failed to load exam";
    });
})();
