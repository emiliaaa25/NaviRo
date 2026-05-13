import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import useAuth from "../hooks/useAuth";

export default function PeerForum() {
  const { token } = useAuth();
  const api = import.meta.env.VITE_API_URL || "/api";
  const [questions, setQuestions] = useState([]);
  const [selected, setSelected] = useState(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [tags, setTags] = useState("");
  const [answerBody, setAnswerBody] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const load = async () => {
    setErr("");
    try {
      const res = await fetch(`${api}/forum/questions?limit=50`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(data.message || `Eroare server (${res.status}). Verifică dacă API-ul rulează.`);
        setQuestions([]);
        return;
      }
      setQuestions(data.questions || []);
    } catch (e) {
      setErr(e.message || "Nu s-a putut încărca forumul.");
      setQuestions([]);
    }
  };

  const loadDetail = async (id) => {
    try {
      const res = await fetch(`${api}/forum/questions/${id}`);
      const data = await res.json();
      if (!res.ok) {
        setErr(data.message || "Întrebarea nu a fost găsită.");
        return;
      }
      if (data.success) setSelected(data.question);
    } catch (e) {
      setErr(e.message || "Error");
    }
  };

  useEffect(() => {
    load();
  }, []);

  const postQuestion = async () => {
    if (!token) {
      setMsg("Loghează-te ca să publici.");
      return;
    }
    try {
      const res = await fetch(`${api}/forum/questions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ title, body, tags }),
      });
      const data = await res.json();
      if (data.success) {
        setTitle("");
        setBody("");
        setTags("");
        setMsg("Întrebarea a fost publicată.");
        load();
      } else setMsg(data.message || "Failed");
    } catch (e) {
      setMsg(e.message || "Error");
    }
  };

  const postAnswer = async () => {
    if (!token || !selected) return;
    try {
      const res = await fetch(`${api}/forum/answers`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ question_id: selected.id, body: answerBody }),
      });
      const data = await res.json();
      if (data.success) {
        setAnswerBody("");
        loadDetail(selected.id);
        load();
      } else setMsg(data.message || "Failed");
    } catch (e) {
      setMsg(e.message || "Error");
    }
  };

  const voteQ = async (id, vote) => {
    if (!token) return;
    await fetch(`${api}/forum/questions/${id}/vote`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ vote }),
    });
    load();
    if (selected?.id === id) loadDetail(id);
  };

  const voteA = async (id, vote) => {
    if (!token) return;
    await fetch(`${api}/forum/answers/${id}/vote`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ vote }),
    });
    if (selected) loadDetail(selected.id);
    load();
  };

  return (
    <div className="nv-page nv-forum-page">
      <header className="nv-page-header">
        <div>
          <h1 className="nv-page-title">Peer Q&amp;A</h1>
          <p className="nv-page-sub">
            Întrebări și răspunsuri de la alți studenți (locuință, acte, viață
            aici). Lista din stânga — click pe o întrebare ca să vezi răspunsurile
            în dreapta. Votează cu ▲ / ▼ (e nevoie să fii autentificat).
          </p>
        </div>
        <nav className="nv-page-nav">
          <Link to="/chat">Chat</Link>
          <Link to="/activities">Activities</Link>
          <Link to="/buddies">Buddy Finder</Link>
          <Link to="/forum" className="nv-active">
            Peer Q&amp;A
          </Link>
          <Link to="/profile">Profile</Link>
        </nav>
      </header>

      {err && (
        <p className="nv-form-error nv-mb-md" role="alert">
          {err}
        </p>
      )}
      {msg && <p className="nv-form-success nv-mb-md">{msg}</p>}

      <div className="nv-forum-layout">
        <section className="nv-section">
          <h2 className="nv-section-title">Întrebări</h2>
          {questions.length === 0 && !err && (
            <div className="nv-forum-empty nv-mb-md">
              <p>
                Încă nu există întrebări în baza de date, sau încă se încarcă.
              </p>
              <p>
                După ce pornești API-ul cu ultimul cod, ar trebui să apară câteva
                exemple demo. Poți și să publici prima ta întrebare mai jos
                (titlu + text, apoi „Post”) — trebuie să fii logat.
              </p>
            </div>
          )}
          <ul className="nv-forum-q-list">
            {questions.map((q) => (
              <li key={q.id}>
                <button
                  type="button"
                  className="nv-forum-q-item"
                  onClick={() => {
                    loadDetail(q.id);
                  }}
                >
                  <span className="nv-forum-score">{q.score}</span>
                  <span>{q.title}</span>
                  <span className="nv-forum-meta">{q.username}</span>
                </button>
                <div className="nv-forum-vote-row">
                  <button type="button" onClick={() => voteQ(q.id, 1)}>
                    ▲
                  </button>
                  <button type="button" onClick={() => voteQ(q.id, -1)}>
                    ▼
                  </button>
                </div>
              </li>
            ))}
          </ul>

          <h3 className="nv-section-title">Întrebare nouă</h3>
          <input
            className="nv-filter-input nv-mb-sm"
            placeholder="Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <textarea
            className="nv-forum-textarea"
            placeholder="How did you solve housing in Iași?"
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
          <input
            className="nv-filter-input nv-mb-sm"
            placeholder="Tags (optional)"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
          />
          <button type="button" className="nv-btn-primary" onClick={postQuestion}>
            Publică întrebarea
          </button>
        </section>

        <section className="nv-section nv-forum-detail">
          <h2 className="nv-section-title" style={{ fontSize: "16px" }}>
            Detaliu întrebare
          </h2>
          {selected ? (
            <>
              <h3 className="nv-section-title">{selected.title}</h3>
              <p className="nv-forum-detail-meta">
                {selected.username} · score {selected.score}
              </p>
              <p className="nv-forum-detail-body">{selected.body}</p>
              <h3 className="nv-section-title">Răspunsuri</h3>
              <ul className="nv-forum-a-list">
                {(selected.answers || []).map((a) => (
                  <li key={a.id} className="nv-forum-answer">
                    <div className="nv-forum-answer-head">
                      <strong>{a.username}</strong>
                      <span>score {a.score}</span>
                    </div>
                    <p>{a.body}</p>
                    <div className="nv-forum-vote-row">
                      <button type="button" onClick={() => voteA(a.id, 1)}>
                        ▲
                      </button>
                      <button type="button" onClick={() => voteA(a.id, -1)}>
                        ▼
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
              <textarea
                className="nv-forum-textarea"
                placeholder="Your answer…"
                value={answerBody}
                onChange={(e) => setAnswerBody(e.target.value)}
              />
              <button type="button" className="nv-btn-primary" onClick={postAnswer}>
                Publică răspunsul
              </button>
            </>
          ) : (
            <p className="nv-page-sub">
              Alege o întrebare din lista din stânga ca să vezi textul complet și
              răspunsurile aici.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
