import React from "react";
import { Link } from "react-router-dom";
import useAuth from "../hooks/useAuth";
import {
  Bot,
  BookOpen,
  Calendar,
  Flag,
  Lightbulb,
  MapPin,
  MessageCircle,
  Route,
  User,
  Users,
} from "lucide-react";

const SECTIONS = [
  {
    id: "chat",
    icon: Bot,
    title: "AI Chat",
    path: "/chat",
    tag: "Start here",
    description:
      "Your main assistant for life in Iași. Ask about visas, residence permits, university enrolment, housing, healthcare, banking, transport, and day-to-day integration. Use quick prompts, type or speak your question, and revisit past conversations from the sidebar.",
  },
  {
    id: "topics",
    icon: BookOpen,
    title: "Topics",
    path: "/chat",
    tag: "Inside Chat",
    description:
      "Open the Topics tab in Chat for curated starters—visa & permits, healthcare, housing, university life, banking, and transport—so you do not have to guess what to ask first.",
  },
  {
    id: "tips",
    icon: Lightbulb,
    title: "Tips",
    path: "/chat",
    tag: "Inside Chat",
    description:
      "Practical advice from the Tips tab: IGI registration deadlines, finding a family doctor, student transport cards, local markets, and useful Romanian phrases locals appreciate.",
  },
  {
    id: "roadmap",
    icon: Route,
    title: "Quest Roadmap",
    path: "/roadmap",
    tag: "Step-by-step",
    description:
      "A guided journey from admission through visa, housing, and arrival. Track progress, open each milestone, and work through checklists with links to verified official resources.",
  },
  {
    id: "activities",
    icon: Calendar,
    title: "Activities",
    path: "/activities",
    tag: "Campus & city",
    description:
      "Browse clubs, events, sports, volunteering, study groups, and cultural meetups in Iași. Filter by type and schedule, save your interests, and see recommendations tailored to your profile.",
  },
  {
    id: "buddies",
    icon: Users,
    title: "Buddy Finder",
    path: "/buddies",
    tag: "Connect",
    description:
      "Meet other international students by country, programme, or language. Use one-click matching or pick someone manually, then chat privately once you are connected.",
  },
  {
    id: "forum",
    icon: MessageCircle,
    title: "Peer Q&A",
    path: "/forum",
    tag: "Community",
    description:
      "Ask questions and read answers from students who have already navigated applications, visas, and life in Romania. Vote on helpful replies and share your own experience.",
  },
  {
    id: "profile",
    icon: User,
    title: "Profile",
    path: "/profile",
    tag: "Personalise",
    description:
      "Set your student type, university and faculty in Iași, country of origin, and bio. A complete profile improves buddy matching, activity suggestions, and keeps your assistant context accurate.",
  },
];

const STEPS = [
  {
    segments: [
      { type: "text", value: "Complete your " },
      { type: "link", to: "/profile", label: "Profile" },
      { type: "text", value: " so matching and recommendations work well." },
    ],
  },
  {
    segments: [
      { type: "text", value: "Check the " },
      { type: "link", to: "/roadmap", label: "Quest Roadmap" },
      { type: "text", value: " for official steps and deadlines." },
    ],
  },
  {
    segments: [
      { type: "text", value: "Use " },
      { type: "link", to: "/chat", label: "AI Chat" },
      { type: "text", value: " (or " },
      { type: "link", to: "/chat", label: "Topics" },
      { type: "text", value: ") whenever you need clear answers fast." },
    ],
  },
  {
    segments: [
      { type: "text", value: "Join " },
      { type: "link", to: "/activities", label: "Activities" },
      { type: "text", value: " and connect via " },
      { type: "link", to: "/buddies", label: "Buddy Finder" },
      { type: "text", value: " or " },
      { type: "link", to: "/forum", label: "Peer Q&A" },
      { type: "text", value: " as you settle in." },
    ],
  },
];

export default function Guide() {
  const { user } = useAuth();
  const displayName = user?.username || "student";

  return (
    <div className="nv-page nv-guide-page">
      <header className="nv-guide-intro">
        <p className="nv-guide-eyebrow">
          <MapPin size={14} aria-hidden />
          Iași, Romania · International students
        </p>
        <h1 className="nv-page-title">Welcome to NaviRo</h1>
        <p className="nv-page-sub">
          Hi {displayName} — NaviRo is your AI companion for applying to
          university, getting a visa, and integrating in Iași. Use this guide to
          understand each part of the app, then jump straight to what you need.
        </p>
      </header>

      <section className="nv-guide-hero nv-anim">
        <div className="nv-guide-hero-brand">
          <span className="nv-guide-logo-icon" aria-hidden>
            🧭
          </span>
          <div>
            <p className="nv-guide-logo-text">
              Navi<span>Ro</span>
            </p>
            <p className="nv-guide-logo-sub">
              Navigate relocation with confidence
            </p>
          </div>
        </div>
        <p className="nv-guide-hero-text">
          From eVisa paperwork and IGI registration to finding housing near
          campus and making friends—everything is organised so you spend less
          time searching and more time settling in.
        </p>
        <Link to="/chat" className="nv-btn-primary">
          Open AI Chat
        </Link>
      </section>

      <section className="nv-section">
        <h2 className="nv-section-title">Suggested path for new arrivals</h2>
        <div className="nv-callout">
          <ol className="nv-guide-steps">
            {STEPS.map((step, index) => (
              <li key={index}>
                {step.segments.map((segment, segIndex) =>
                  segment.type === "link" ? (
                    <Link
                      key={segIndex}
                      to={segment.to}
                      className="nv-guide-step-link"
                    >
                      {segment.label}
                    </Link>
                  ) : (
                    <span key={segIndex}>{segment.value}</span>
                  ),
                )}
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="nv-section">
        <h2 className="nv-section-title">Explore the app</h2>
        <div className="nv-guide-grid">
          {SECTIONS.map(({ id, icon: Icon, title, path, tag, description }) => (
            <Link key={id} to={path} className="nv-guide-card nv-anim">
              <div className="nv-guide-card-head">
                <span className="nv-guide-card-icon" aria-hidden>
                  <Icon size={20} strokeWidth={2} />
                </span>
                <span className="nv-guide-card-tag">{tag}</span>
              </div>
              <strong className="nv-guide-card-title">{title}</strong>
              <span className="nv-guide-card-desc">{description}</span>
              <span className="nv-guide-card-cta">
                Go to {title}
                <Flag size={14} aria-hidden />
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section className="nv-section nv-guide-footer">
        <p className="nv-page-sub" style={{ margin: 0 }}>
          Need a human touch? Check external resources in your Profile toolkit,
          or ask in Peer Q&amp;A — someone in Iași has likely been through the
          same step.
        </p>
        <div className="nv-guide-footer-actions">
          <Link to="/profile" className="nv-btn-secondary">
            Open Profile
          </Link>
        </div>
      </section>
    </div>
  );
}
