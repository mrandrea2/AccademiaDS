"use client";
import { useWorkspace } from "@/lib/use-workspace";
import {
  ArrowUpRight,
  CalendarDays,
  ChartNoAxesCombined,
  ChevronRight,
  GraduationCap,
  Layers,
  LayoutDashboard,
  Library,
  ListChecks,
  Menu,
  Mic,
  PenLine,
  Route,
  Scale,
  Settings,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Button } from "./ui/button";

import { Cards } from "./modules/cards";
import { Dashboard } from "./modules/dashboard";
import { Legal } from "./modules/legal";
import { LibraryModule } from "./modules/library";
import { Oral } from "./modules/oral";
import { Paths } from "./modules/paths";
import { Preferences } from "./modules/preferences";
import { Quiz } from "./modules/quiz";
import { Statistics } from "./modules/statistics";
import { Tutor } from "./modules/tutor";
import { Written } from "./modules/written";
const nav = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "biblioteca", label: "Biblioteca", icon: Library },
  { id: "percorsi", label: "Percorsi di studio", icon: Route },
  { id: "quiz", label: "Quiz e simulazioni", icon: ListChecks },
  { id: "flashcard", label: "Flashcard", icon: Layers },
  { id: "scritta", label: "Prova scritta", icon: PenLine },
  { id: "orale", label: "Prova orale", icon: Mic },
  { id: "tutor", label: "Tutor AI", icon: Sparkles },
  { id: "normativa", label: "Normativa", icon: Scale },
  { id: "statistiche", label: "Statistiche", icon: ChartNoAxesCombined },
  { id: "impostazioni", label: "Impostazioni", icon: Settings },
];
export function Academy() {
  const { state, update, ready, user, status, error } = useWorkspace();
  const [section, setSection] = useState("dashboard");
  const [mobile, setMobile] = useState(false);
  const [search, setSearch] = useState("");
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    const sync = () => {
      const candidate = new URLSearchParams(location.search).get("section");
      setSection(
        nav.some((n) => n.id === candidate) ? candidate! : "dashboard",
      );
    };
    sync();
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, []);
  useEffect(() => {
    if (!mobile) return;
    const previous = document.activeElement as HTMLElement | null;
    const sidebar = document.getElementById("main-navigation")!;
    const getFocusable = () =>
      Array.from(
        sidebar.querySelectorAll<HTMLElement>("a[href],button:not([disabled])"),
      ).filter((el) => el.getClientRects().length > 0);
    getFocusable()[0]?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMobile(false);
        previous?.focus();
      }
      if (event.key === "Tab") {
        const elements = getFocusable();
        const first = elements[0];
        const last = elements[elements.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", keydown);
    return () => {
      document.body.style.overflow = oldOverflow;
      document.removeEventListener("keydown", keydown);
    };
  }, [mobile]);
  function go(id: string) {
    setSection(id);
    setMobile(false);
    history.pushState({}, "", `?section=${id}`);
    setTimeout(() => heading.current?.focus(), 0);
  }
  const active = nav.find((n) => n.id === section)!;
  return (
    <div className="app-shell">
      <a className="skip" href="#main">
        Vai al contenuto
      </a>
      {mobile && (
        <button
          className="backdrop"
          aria-label="Chiudi navigazione"
          onClick={() => setMobile(false)}
        />
      )}
      <aside
        id="main-navigation"
        className={`sidebar ${mobile ? "is-open" : ""}`}
        aria-label="Navigazione principale"
      >
        <Link href="/" className="brand">
          <span className="brand-mark">
            <GraduationCap size={27} />
          </span>
          <span>
            DS <strong>Academy</strong>
            <small>IL TUO PROSSIMO PASSO</small>
          </span>
        </Link>
        <Button
          variant="ghost"
          size="icon"
          className="mobile-close"
          aria-label="Chiudi menu"
          onClick={() => setMobile(false)}
        >
          <X />
        </Button>
        <div className="nav-label">IL TUO SPAZIO DI STUDIO</div>
        <nav>
          {nav.map((n, i) => (
            <div key={n.id}>
              {i === 7 && <div className="nav-divider" />}
              {i === 10 && <div className="nav-divider" />}
              <a
                href={`?section=${n.id}`}
                onClick={(e) => {
                  e.preventDefault();
                  go(n.id);
                }}
                aria-current={section === n.id ? "page" : undefined}
                className={`nav-item ${section === n.id ? "active" : ""}`}
              >
                <n.icon size={20} />
                <span>{n.label}</span>
                {n.id === "tutor" && (
                  <span className="nav-ai" aria-hidden="true">
                    AI
                  </span>
                )}
              </a>
            </div>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="study-note">
            <span className="gold-dot" /> Un passo alla volta.
            <p>
              La tua prossima sfida
              <br />
              comincia da qui.
            </p>
          </div>
          <div className="profile">
            <span className="avatar">{user ? "DS" : "TU"}</span>
            <div>
              <strong>
                {user ? "Account personale" : "Il tuo spazio personale"}
              </strong>
              <small>
                {user ? "Archivio privato" : "Modalità demo locale"}
              </small>
            </div>
          </div>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <div className="breadcrumb">
            <Button
              size="icon"
              variant="ghost"
              className="mobile-menu"
              aria-label="Apri menu"
              aria-expanded={mobile}
              aria-controls="main-navigation"
              onClick={() => setMobile(true)}
            >
              <Menu />
            </Button>
            <span>Il mio spazio</span>
            <ChevronRight size={15} />
            <strong>{active.label}</strong>
          </div>
          <div className="top-actions">
            <span className="privacy-label">
              <ShieldCheck size={16} /> Studio personale
            </span>
            <span className="avatar small">DS</span>
          </div>
        </header>
        <main id="main" className="main">
          <div className="mode-banner">
            <span className="status-dot" />
            <span>
              {user
                ? "Account connesso · documenti privati e sincronizzazione Supabase"
                : "Demo locale · dati salvati solo in questo browser, contenuti di esempio non ufficiali"}
            </span>
            <button onClick={() => go("impostazioni")}>
              {user ? "Gestisci account" : "Informazioni e accesso"}{" "}
              <ArrowUpRight size={14} />
            </button>
          </div>
          <div className="page-heading">
            <div>
              <p className="eyebrow">IL TUO PERCORSO, OGNI GIORNO</p>
              <h1 ref={heading} tabIndex={-1}>
                {section === "dashboard"
                  ? "Il tuo futuro inizia da qui."
                  : active.label}
              </h1>
              <p>
                {section === "dashboard"
                  ? "Dai forma alla tua preparazione. Un obiettivo, una competenza, un passo alla volta."
                  : descriptions[section]}
              </p>
            </div>
            {section === "dashboard" && (
              <div className="date-chip">
                <CalendarDays size={17} />
                {new Intl.DateTimeFormat("it-IT", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                  timeZone: "Europe/Rome",
                }).format(new Date())}
              </div>
            )}
          </div>
          {error && (
            <div role="alert" className="error-box">
              {error}
            </div>
          )}
          {!ready ? (
            <div aria-busy="true">
              <div className="skeleton h-52" />
              <div className="skeleton h-80" />
            </div>
          ) : (
            <>
              {section === "dashboard" && <Dashboard state={state} go={go} />}
              {section === "biblioteca" && (
                <LibraryModule
                  state={state}
                  update={update}
                  search={search}
                  setSearch={setSearch}
                />
              )}
              {section === "percorsi" && (
                <Paths state={state} update={update} />
              )}
              {section === "quiz" && <Quiz state={state} update={update} />}
              {section === "flashcard" && (
                <Cards state={state} update={update} />
              )}
              {section === "scritta" && (
                <Written state={state} update={update} status={status} />
              )}
              {section === "orale" && <Oral state={state} update={update} />}
              {section === "tutor" && (
                <Tutor state={state} cloud={Boolean(user)} go={go} />
              )}
              {section === "normativa" && (
                <Legal state={state} update={update} />
              )}
              {section === "statistiche" && <Statistics state={state} />}
              {section === "impostazioni" && (
                <Preferences
                  state={state}
                  update={update}
                  connected={Boolean(user)}
                />
              )}
            </>
          )}
          <footer>
            <span>
              DS Academy <span className="footer-dot">·</span> Coltiva le
              competenze. Costruisci il tuo percorso.
            </span>
            <span role="status" aria-live="polite">
              {status}
            </span>
          </footer>
        </main>
      </div>
    </div>
  );
}
const descriptions: Record<string, string> = {
  biblioteca:
    "Le tue fonti, raccolte e tracciabili. Uno spazio privato per studiare con metodo.",
  percorsi:
    "Nove aree di studio, da adattare al programma del bando applicabile.",
  quiz: "Allena il ragionamento, comprendi gli errori e misura i tuoi progressi.",
  flashcard: "Ripassa al momento giusto con la ripetizione dilazionata SM-2.",
  scritta: "Organizza le idee, argomenta le scelte e rivedi la tua risposta.",
  orale: "Dai voce al tuo ragionamento. Esercitati su casi e decisioni.",
  tutor: "Cerca evidenze nei tuoi documenti. Ogni risposta parte dalle fonti.",
  normativa:
    "Consulta le fonti ufficiali e verifica sempre versione e vigenza.",
  statistiche:
    "Leggi i tuoi risultati e scegli dove concentrare il prossimo ripasso.",
  impostazioni:
    "Gestisci il tuo spazio, i dati personali e le preferenze di studio.",
};
