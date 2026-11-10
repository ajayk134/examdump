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

  function getFlatText(content) {
    if (!Array.isArray(content)) return "";
    return content.map(i => {
      if (i.type === "text")  return i.value || "";
      if (i.type === "break") return "\n";
      if (i.type === "image") return "[image attached]";
      return "";
    }).join("").trim();
  }

  // Collect all image URLs from a content array
  function getImages(content) {
    if (!Array.isArray(content)) return [];
    return content.filter(i => i.type === "image" && i.src).map(i => i.src);
  }

  /* ================= GLOBALS ================= */
  let allQuestionsData = {};
  let allQuestionsKeys = [];
  let currentPage = 1;
  let itemsPerPage = 10;

  function renderPaginationControls() {
    const totalPages = Math.ceil(allQuestionsKeys.length / itemsPerPage);
    if (totalPages <= 1 && itemsPerPage === 10) return; // Don't show if single page initially maybe? No, let's always show.

    const pagCont = el("div", "pagination-container");

    const selWrapper = el("div", "per-page-wrapper");
    selWrapper.appendChild(el("span", null, "Questions per page: "));
    const sel = document.createElement("select");
    [10, 50, 100, 500, 1000, 2000].forEach(val => {
        const opt = document.createElement("option");
        opt.value = val;
        opt.textContent = val;
        if (val === itemsPerPage) opt.selected = true;
        sel.appendChild(opt);
    });
    sel.onchange = (e) => {
        itemsPerPage = parseInt(e.target.value, 10);
        currentPage = 1;
        renderPage();
        window.scrollTo({ top: 0, behavior: "smooth" });
    };
    selWrapper.appendChild(sel);
    
    const totalSpan = el("span", null, ` (Total: ${allQuestionsKeys.length})`);
    totalSpan.style.marginLeft = "8px";
    totalSpan.style.color = "#666";
    totalSpan.style.fontWeight = "normal";
    selWrapper.appendChild(totalSpan);

    const navWrapper = el("div", "page-nav-wrapper");
    const prevBtn = el("button", "btn-page", "« Prev");
    prevBtn.disabled = currentPage === 1;
    prevBtn.onclick = () => {
        if (currentPage > 1) {
            currentPage--;
            renderPage();
            window.scrollTo({ top: 0, behavior: "smooth" });
        }
    };

    const status = el("span", "page-status", `Page ${currentPage} of ${totalPages}`);

    const nextBtn = el("button", "btn-page", "Next »");
    nextBtn.disabled = currentPage === totalPages;
    nextBtn.onclick = () => {
        if (currentPage < totalPages) {
            currentPage++;
            renderPage();
            window.scrollTo({ top: 0, behavior: "smooth" });
        }
    };

    navWrapper.appendChild(prevBtn);
    navWrapper.appendChild(status);
    navWrapper.appendChild(nextBtn);

    pagCont.appendChild(selWrapper);
    pagCont.appendChild(navWrapper);

    container.appendChild(pagCont);
  }

  /* ================= RENDER EXAM ================= */

  function renderPage() {
    container.innerHTML = "";
    if (!allQuestionsKeys.length) return;

    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = Math.min(startIndex + itemsPerPage, allQuestionsKeys.length);
    const pageKeys = allQuestionsKeys.slice(startIndex, endIndex);

    const CHUNK = 8;
    let i = 0;

    function renderChunk() {
      const frag = document.createDocumentFragment();
      const chunkEnd = Math.min(i + CHUNK, pageKeys.length);

      for (; i < chunkEnd; i++) {
        const qKey = pageKeys[i];
        const q = allQuestionsData[qKey];

        const card = el("div", "question-card");
        card.tabIndex = 0;

        card.appendChild(el("h2", "question-title", qKey));

        if (q.Question?.content?.length) {
          const qt = el("div", "question-text");
          renderContent(qt, q.Question.content);
          card.appendChild(qt);
        }

        const mostVoted = hasValidVotes(q.Vote_count)
          ? getMostVotedOptions(q.Vote_count)
          : [];

        // Extract correct answer letter from Answer content
        let correctAnswer = "";
        if (q.Answer?.content?.length) {
          const rawText = q.Answer.content.map(c => c.value).join(" ").trim();
          // Attempt to match "Suggested Answer: A" or "Correct Answer: A"
          const match = rawText.match(/(?:Suggested|Correct)\s*Answer:\s*([A-Z]+)/i);
          if (match) {
            correctAnswer = match[1].toUpperCase();
          } else {
            // fallback: extract only A-Z if it's very short
            const cleanup = rawText.replace(/[^A-Z]/gi, "").toUpperCase();
            if (cleanup.length <= 8) correctAnswer = cleanup;
          }
        }

        const hasChoices = q.Choices && Object.keys(q.Choices).length > 0;
        let isAnswerVisible = false;

        const actionBar = el("div", "action-bar");
        const toggleBtn = el("button", "btn-toggle-answer", "Show Answer");
        toggleBtn.disabled = hasChoices;
        const aiExplainBtn = el("button", "btn-ai-explain", "✨ AI Explain");
        const feedback = el("div", "feedback-msg");
        actionBar.appendChild(toggleBtn);
        actionBar.appendChild(aiExplainBtn);
        actionBar.appendChild(feedback);

        if (q.Choices) {
          const ul = el("ul", "choices");

          Object.keys(q.Choices).sort().forEach(k => {
            const li = el("li", "choice-item interactive");
            li.dataset.key = k;
            li.appendChild(el("span", "choice-letter", `${k}.`));
            renderContent(li, q.Choices[k].content, true, k);

            if (mostVoted.includes(k)) {
              const badge = el("span", "badge-most-voted", "Most Voted");
              badge.style.display = "none"; // Hide initially
              li.appendChild(badge);
            }

            li.onclick = () => {
              if (isAnswerVisible) return; // Prevent change after answer is shown
              
              const requiredLength = correctAnswer ? correctAnswer.length : 1;
              const isSelected = li.classList.contains("selected");
              const currentSelections = ul.querySelectorAll(".choice-item.selected").length;
              
              // Limit selections based on requiredLength
              if (!isSelected && currentSelections >= requiredLength) {
                return; // Prevent selecting more than the required amount
              }
              
              li.classList.toggle("selected");
              
              // Enable button only when exactly the required number of choices are selected
              const selectedKeys = [...ul.querySelectorAll(".choice-item.selected")].map(c => c.dataset.key).sort().join("");
              card.dataset.selection = selectedKeys;
              toggleBtn.disabled = selectedKeys.length !== requiredLength;
              
              if (selectedKeys.length === requiredLength) {
                ul.classList.add("limit-reached");
              } else {
                ul.classList.remove("limit-reached");
              }
            };

            ul.appendChild(li);
          });

          card.appendChild(ul);
        }

        card.appendChild(actionBar);

        // Build Full Answer Section (Hidden initially)
        const fullAnsSec = el("div", "full-answer-section");
        
        // 1. Suggested Answer Box
        if (q.Answer?.content?.length) {
          const ansBox = el("div", "answer-box");
          renderContent(ansBox, q.Answer.content);
          fullAnsSec.appendChild(ansBox);
        }
        

        // 3. Vote Distribution
        if (hasValidVotes(q.Vote_count)) {
          const voteDiv = el("div", "vote-dist");
          voteDiv.appendChild(el("div", "vote-summary", "Community vote distribution"));

          const bar = el("div", "vote-bar");
          const total = q.Vote_count.reduce((s, v) => s + v.vote_count, 0);

          q.Vote_count
            .filter(v => v.vote_count > 0)
            .sort((a, b) => b.vote_count - a.vote_count)
            .forEach((v, idx) => {
              const pct = Math.round((v.vote_count / total) * 100);
              const seg = el("div", `vote-segment vote-rank-${idx + 1}`, `${v.voted_answers} (${pct}%)`);
              seg.style.width = `${pct}%`;
              bar.appendChild(seg);
            });
          voteDiv.appendChild(bar);
          fullAnsSec.appendChild(voteDiv);
        }
        const aiRespBox = el("div", "ai-explanation-box");
        aiRespBox.style.display = "none";

        fullAnsSec.appendChild(aiRespBox);
        card.appendChild(fullAnsSec);
        card.appendChild(aiRespBox); // AI box lives outside fullAnsSec so it's always visible

        // AI Handle
        aiExplainBtn.onclick = async () => {
          if (aiRespBox.innerHTML.includes("Explain") && !aiRespBox.innerHTML.includes("thinking")) return;
          
          aiRespBox.style.display = "block";
          
          try {
             // 1. Check if signed in to Puter
             if (!puter.auth.isSignedIn()) {
                aiRespBox.innerHTML = `<em>Please sign in to Puter to use AI (check for a popup)...</em>`;
                await puter.auth.signIn();
             }

             aiRespBox.innerHTML = "<em>AI is thinking...</em>";
             
             const qText = getFlatText(q.Question.content);

             // Build choices string — detect if all choices are image-only
             const choiceEntries = Object.entries(q.Choices || {});
             let cArray;
             let mapped = [];
             if (!choiceEntries.length) {
               cArray = "No text choices — this is a visual/drag-drop question.";
             } else {
               mapped = choiceEntries.map(([k, v]) => `${k}: ${getFlatText(v.content)}`);
               const allImages = mapped.every(c => c.endsWith("[image attached]"));
               cArray = allImages
                 ? `Options A–${choiceEntries[choiceEntries.length-1][0]} are all image-based and cannot be shown as text.`
                 : mapped.join("\n");
             }
             const ansStr = correctAnswer || "Not specified";
             
             const hasImageInQuestion = qText.includes("[image attached]");
             const hasImageInChoices = mapped.length > 0 && mapped.every(c => c.endsWith("[image attached]"));
             const isDragDrop = !choiceEntries.length;
             const hasMixedChoices = choiceEntries.length > 0 && !hasImageInChoices;

             // Build context-aware prompt
             let contextNote = "";
             if (isDragDrop) {
               contextNote = "This is a drag-and-drop or matching question. There are no standard multiple-choice options. Explain the concept being tested based on the question text and correct answer.";
             } else if (hasImageInChoices) {
               contextNote = "All answer options in this question are images and cannot be shown as text. Use the correct answer label to explain what it likely represents and why it is correct.";
             } else if (hasImageInQuestion) {
               contextNote = "This question includes an image that cannot be shown here. Explain the concept being tested based on the text context and correct answer.";
             }

             const prompt = `You are an expert technical certification exam tutor. A student needs a clear explanation for the following exam question.

Question:
${qText}

${isDragDrop || hasImageInChoices ? "" : `Answer Choices:\n${cArray}\n`}Correct Answer: ${ansStr}

${contextNote ? `Context: ${contextNote}\n` : ""}Instructions:
- Explain in plain conversational English why "${ansStr}" is the correct answer.
- ${isDragDrop || hasImageInChoices ? "Explain the concept and technology involved." : "Briefly state why the other options are incorrect."}
- No markdown syntax, no asterisks, no hashtags, no bullet points.
- Write in clear, flowing paragraphs.
- Do not start with phrases like "Sure!", "Of course!", or "Great question!"
- Keep it concise \u2014 2 to 4 paragraphs maximum.`;

             aiRespBox.innerHTML = `<strong>🤖 AI Explanation:</strong><p id="ai-stream-text"><span class="ai-cursor">▍</span></p>`;
             const streamEl = aiRespBox.querySelector("#ai-stream-text");

             // Collect all image URLs from question + all choices + answer
             const imageUrls = [
               ...getImages(q.Question?.content),
               ...choiceEntries.flatMap(([, v]) => getImages(v.content)),
               ...getImages(q.Answer?.content),
             ];

             // Build multimodal message content array
             const msgContent = [
               { type: "text", text: prompt },
               ...imageUrls.map(url => ({ type: "image_url", image_url: { url } }))
             ];

             const resp = await puter.ai.chat(
               [{ role: "user", content: msgContent }],
               { stream: true, model: 'gpt-4o-mini' }
             );
             let started = false;
             let buffer = "";
             for await (const part of resp) {
               if (!started) {
                 streamEl.innerHTML = ""; // remove cursor once first token arrives
                 started = true;
               }
               buffer += part?.text || "";
               // Convert markdown-like syntax to clean HTML on the fly
               const clean = buffer
                 .replace(/#{1,6}\s?/g, "")          // remove ### headings
                 .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>") // **bold**
                 .replace(/\*(.+?)\*/g, "<em>$1</em>")             // *italic*
                 .replace(/\n/g, "<br/>");
               streamEl.innerHTML = clean;
             }
          } catch(err) {
             console.error("Puter AI Error:", err);
             // Special handling for blocked popups or user cancel
             if (err.message?.includes('popup')) {
                 aiRespBox.innerHTML = `<span style="color:red">Login popup was blocked. Please allow popups for this site and try again.</span>`;
             } else {
                 aiRespBox.innerHTML = `<span style="color:red">AI unavailable. (Error: ${err.message || 'Check Puter Login'})</span>`;
             }
          }
        };

        // Toggle Logic
        toggleBtn.onclick = () => {
          isAnswerVisible = !isAnswerVisible;
          if (isAnswerVisible) {
            toggleBtn.textContent = "Hide Answer";
            fullAnsSec.classList.add("visible");
            aiExplainBtn; // always visible, nothing to do here
            card.querySelectorAll(".badge-most-voted").forEach(b => b.style.display = ""); // Show badges

            const userSelection = card.dataset.selection || "";
            let isCorrect = false;

            if (hasChoices) {
              if (correctAnswer) {
                const sortedCorrect = correctAnswer.split("").sort().join("");
                const sortedUser = userSelection.split("").sort().join("");
                isCorrect = sortedUser === sortedCorrect;
                
                if (isCorrect) {
                  feedback.textContent = `✅ Correct!`;
                  feedback.className = "feedback-msg correct";
                } else if (userSelection.length > 0) {
                  feedback.textContent = `❌ Wrong. Correct answer is ${correctAnswer}`;
                  feedback.className = "feedback-msg wrong";
                } else {
                  feedback.textContent = `💡 Correct answer is ${correctAnswer}`;
                  feedback.className = "feedback-msg";
                }
                
                card.querySelectorAll(".choice-item.interactive").forEach(li => {
                  const k = li.dataset.key;
                  if (correctAnswer.includes(k)) {
                    li.classList.add("correct");
                  } else if (userSelection.includes(k)) {
                    li.classList.add("wrong");
                  }
                });
              } else {
                // Edge case: answer couldn't be evaluated
                feedback.textContent = `Answer parsing failed. Check suggested answer box.`;
              }
            } else {
              feedback.textContent = `Check the suggested answer below.`;
              feedback.className = "feedback-msg";
            }
          } else {
            toggleBtn.textContent = "Show Answer";
            fullAnsSec.classList.remove("visible");
            aiExplainBtn; // always visible
            aiRespBox.style.display = "none";
            aiRespBox.innerHTML = "";
            card.querySelectorAll(".badge-most-voted").forEach(b => b.style.display = "none"); // Hide badges
            feedback.textContent = "";
            card.dataset.selection = "";
            toggleBtn.disabled = hasChoices;
            card.querySelectorAll(".choice-item.interactive").forEach(li => {
              li.classList.remove("correct", "wrong", "selected");
            });
            const ulElem = card.querySelector("ul.choices");
            if (ulElem) ulElem.classList.remove("limit-reached");
          }
        };

        frag.appendChild(card);
      }

      container.appendChild(frag);

      if (i < pageKeys.length) {
        setTimeout(renderChunk, 40);
      } else {
        container.querySelector(".question-card")?.focus();
        if (allQuestionsKeys.length > 0) {
          renderPaginationControls();
        }
      }
    }

    renderChunk();
  }

  /* ================= FETCH ================= */

  fetch(`${API_BASE}/${provider}/${exam}`)
    .then(res => {
      if (!res.ok) throw new Error("Failed");
      return res.json();
    })
    .then(json => {
      const questions = json?.[exam];
      if (!questions) throw new Error("Failed");
      allQuestionsData = questions;
      allQuestionsKeys = Object.keys(questions);
      renderPage();
    })
    .catch((err) => {
      errorEl.style.display = "block";
      errorEl.textContent = "❌ Failed to load exam";
    });
})();
