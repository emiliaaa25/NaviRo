import React, { useEffect, useState } from "react";
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
        setErr(
          data.message ||
            `Server error (${res.status}). Check if API is running.`,
        );
        setQuestions([]);
        return;
      }
      setQuestions(data.questions || []);
    } catch (e) {
      setErr(e.message || "Could not load forum.");
      setQuestions([]);
    }
  };

  const loadDetail = async (id) => {
    try {
      const res = await fetch(`${api}/forum/questions/${id}`);
      const data = await res.json();
      if (!res.ok) {
        setErr(data.message || "Question not found.");
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
      setMsg("Log in to post.");
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
        setMsg("Question posted.");
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
            Questions and answers from other students (housing, documents, life
            here). List on the left — click a question to see answers on the
            right. Vote with ▲ / ▼ (authentication required).
          </p>
        </div>
      </header>

      {err && (
        <p className="nv-form-error nv-mb-md" role="alert">
          {err}
        </p>
      )}
      {msg && <p className="nv-form-success nv-mb-md">{msg}</p>}

      <div className="nv-forum-layout">
        <section className="nv-section">
          <h2 className="nv-section-title">Questions</h2>
          {questions.length === 0 && !err && (
            <div className="nv-forum-empty nv-mb-md">
              <p>No questions in database yet, or still loading.</p>
              <p>
                Once you start the API with the latest code, some demo examples
                should appear. You can also post your first question below
                (title + text, then "Post") — you must be logged in.
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

          <h3 className="nv-section-title">New Question</h3>
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
          <button
            type="button"
            className="nv-btn-primary"
            onClick={postQuestion}
          >
            Post Question
          </button>
        </section>

        <section className="nv-section nv-forum-detail">
          <h2 className="nv-section-title" style={{ fontSize: "16px" }}>
            Question Details
          </h2>
          {selected ? (
            <>
              <h3 className="nv-section-title">{selected.title}</h3>
              <p className="nv-forum-detail-meta">
                {selected.username} · score {selected.score}
              </p>
              <p className="nv-forum-detail-body">{selected.body}</p>
              <h3 className="nv-section-title">Answers</h3>
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
              <button
                type="button"
                className="nv-btn-primary"
                onClick={postAnswer}
              >
                Post Answer
              </button>
            </>
          ) : (
            <p className="nv-page-sub">
              Select a question from the list on the left to see the full text
              and answers here.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}