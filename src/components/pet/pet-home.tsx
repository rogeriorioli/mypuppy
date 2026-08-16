"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getPetMood, type PetAction, type PetEvent, type PetState } from "@/domain/pet/engine";
import { doPetAction } from "@/app/actions/pet";
import { signOutAction } from "@/app/actions/auth";
import { enablePushNotifications, disablePushNotifications, isPushSupported } from "@/lib/push-client";
import type { PetHomeData } from "@/types/dto";

type Tab = "home" | "memories" | "profile" | "settings";

const ARCHETYPE_META: Record<string, { title: string; description: string; emoji: string }> = {
  caramelo: { title: "The Brazilian Legend", description: "Friendly, clever, and always ready for an adventure.", emoji: "🐕" },
  fiapo: { title: "Tiny. Fluffy. Chaotic.", description: "Dramatic, affectionate, and suspiciously good at naps.", emoji: "🐶" },
  malhadinho: { title: "100% Dog. Breed Classified.", description: "Playful, curious, and on permanent delivery-driver watch.", emoji: "🐕‍🦺" },
};

const EVENT_NOTES: Record<string, string> = {
  PET_HUNGRY: "Someone has been staring at the food bowl.",
  PET_VERY_HUNGRY: "The food bowl situation has become urgent.",
  PET_WANTS_WALK: "The leash has appeared in the middle of the room. Suspicious.",
  PET_NEEDS_ATTENTION: "A gentle nose boop has been deployed.",
  PET_BORED: "Counting ceiling tiles. Send entertainment.",
  PET_SLEEPY: "A very necessary Soneca is approaching.",
  PET_SLEEPING: "Zzz... dreaming about treats.",
  PET_HAPPY: "Tail operating at maximum capacity.",
  PET_EXCITED: "Zoomies imminent. Clear the area.",
  PET_CLEAN_FRESH: "Smells like victory and lavender shampoo.",
  PET_MISSES_OWNER: "Waiting by the door. Still the goodest employee.",
  PET_OWNER_RETURNED: "Full-body wiggle. The reunion is official.",
};

function formatValue(value: number) {
  return `${Math.round(value)}%`;
}

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

interface Memory {
  id: string;
  text: string;
  createdAt: string;
}

export function PetHome({ initial, user }: { initial: PetHomeData; user: { email: string; name: string } }) {
  const [tab, setTab] = useState<Tab>("home");
  const [state, setState] = useState<PetState>(initial.state);
  const [sleeping, setSleeping] = useState(initial.sleeping);
  const [mood, setMood] = useState(initial.mood);
  const [reaction, setReaction] = useState(initial.reaction);
  const [memories, setMemories] = useState<Memory[]>(initial.memories);
  const [activeAction, setActiveAction] = useState<PetAction | null>(null);
  const [cooldowns, setCooldowns] = useState<Partial<Record<PetAction, number>>>({});
  const [notifications, setNotifications] = useState(
    () => typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted",
  );
  const [notice, setNotice] = useState<string | null>(null);
  const refreshing = useRef(false);

  const refresh = useCallback(async () => {
    if (refreshing.current) return;
    refreshing.current = true;
    try {
      const response = await fetch(`/api/pet?petId=${encodeURIComponent(initial.petId)}`);
      if (!response.ok) return;
      const data = (await response.json()) as { state: PetState; sleeping: boolean; events: PetEvent[] };
      setState(data.state);
      setSleeping(data.sleeping);
      setMood(getPetMood(data.state, data.sleeping));
    } catch {
      // Offline or network issue: keep the last known state.
    } finally {
      refreshing.current = false;
    }
  }, [initial.petId]);

  useEffect(() => {
    const timer = window.setInterval(refresh, 30000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  async function perform(action: PetAction) {
    if (cooldowns[action]) return;
    const result = await doPetAction(initial.petId, action);
    if (!result.ok) {
      if (result.reason === "ON_COOLDOWN") {
        setReaction(`${initial.name} is still processing that magnificent idea.`);
        if (result.retryAfterMs) {
          setCooldowns((current) => ({ ...current, [action]: result.retryAfterMs ?? 0 }));
        }
      } else if (result.reason === "SLEEPING") {
        setReaction(`Shhh. ${initial.name} is deep in a Soneca right now.`);
      } else {
        setReaction(`${initial.name} needs a Soneca before another round.`);
      }
      return;
    }
    if (result.state) {
      setState(result.state);
      setMood(getPetMood(result.state, sleeping));
    }
    if (result.reaction) setReaction(result.reaction);
    if (result.memory) setMemories((current) => [{ id: `${Date.now()}`, text: result.memory!, createdAt: new Date().toISOString() }, ...current].slice(0, 30));
    setActiveAction(action);
    window.setTimeout(() => setActiveAction(null), 650);
  }

  async function toggleNotifications() {
    if (!isPushSupported()) {
      setNotice("This browser keeps notifications tucked away, but we can still hang out here.");
      return;
    }
    if (notifications) {
      const removed = await disablePushNotifications();
      setNotifications(!removed);
      setNotice(removed ? `No worries. ${initial.name} will keep the important gossip right here.` : "Could not update notification settings.");
      return;
    }
    const result = await enablePushNotifications();
    setNotifications(result.ok);
    if (result.ok) setNotice(`${initial.name} will let you know when something important happens.`);
    else if (result.reason === "denied") setNotice("No permission granted — that is completely fine too.");
    else setNotice("Push is not available here yet, but everything still works in-app.");
  }

  const archetype = ARCHETYPE_META[initial.archetype] ?? ARCHETYPE_META.caramelo;
  const activeEvent = initial.events[0];
  const eventNote = activeEvent ? (EVENT_NOTES[activeEvent] ?? `${initial.name} has something to say.`) : reaction;

  return (
    <main className="app-shell">
      <header className="app-header">
        <div className="brand-mark">
          My<span>Puppy</span>
        </div>
        <div className="header-actions">
          <button className="icon-button" aria-label="Open settings" onClick={() => setTab("settings")}>
            ♧
          </button>
          <button className="avatar" aria-label="Open profile" onClick={() => setTab("profile")}>
            {initial.name.slice(0, 1).toUpperCase()}
          </button>
        </div>
      </header>

      {tab === "home" && (
        <>
          <section className="pet-header">
            <div>
              <p className="eyebrow">{archetype.title}</p>
              <h1>{initial.name}</h1>
              <p className="reaction">{reaction}</p>
            </div>
            <div className={`pet-stage mood-${mood} ${activeAction ? `action-${activeAction.toLowerCase()}` : ""}`}>
              <span className="stage-sun" />
              <span className="stage-dog" aria-label={`${initial.name} is feeling ${mood}`}>
                {archetype.emoji}
              </span>
              <span className="ground" />
            </div>
          </section>

          <section className="status-board" aria-label={`${initial.name} current status`}>
            <Status label="Hunger" value={state.hunger} tone="warm" inverted />
            <Status label="Happiness" value={state.happiness} tone="green" />
            <Status label="Energy" value={state.energy} tone="blue" />
            <Status label="Affection" value={state.affection} tone="pink" />
          </section>

          <section className="actions">
            <div className="section-heading">
              <div>
                <p className="eyebrow">What should we do?</p>
                <h2>Make a little magic.</h2>
              </div>
              <span className="trait">{initial.dominantTrait.toLowerCase().replace("_", " ")}</span>
            </div>
            <div className="action-grid">
              <ActionButton label="Feed" icon="🥣" action="FEED" cooldown={Boolean(cooldowns.FEED)} sleeping={sleeping} onClick={perform} />
              <ActionButton label="Play" icon="⚽" action="PLAY" cooldown={Boolean(cooldowns.PLAY)} sleeping={sleeping} onClick={perform} />
              <ActionButton label="Rolê" icon="🦮" action="WALK" cooldown={Boolean(cooldowns.WALK)} sleeping={sleeping} onClick={perform} />
              <ActionButton label="Cafuné" icon="♡" action="CAFUNE" cooldown={Boolean(cooldowns.CAFUNE)} sleeping={sleeping} onClick={perform} />
            </div>
          </section>

          <section className="event-note">
            <span className="event-dot" />
            <div>
              <strong>{eventNote}</strong>
              <small>
                Walk need {formatValue(state.walkNeed)} · Hygiene {formatValue(state.hygiene)}
                {sleeping ? " · Sleeping" : ""}
              </small>
            </div>
          </section>
        </>
      )}

      {tab === "memories" && <MemoriesView petName={initial.name} memories={memories} />}
      {tab === "profile" && <ProfileView data={initial} archetypeTitle={archetype.title} />}
      {tab === "settings" && (
        <SettingsView
          userName={user.name}
          userEmail={user.email}
          notifications={notifications}
          notice={notice}
          pushSupported={isPushSupported()}
          onToggleNotifications={toggleNotifications}
        />
      )}

      <nav className="bottom-nav" aria-label="Main navigation">
        <NavButton active={tab === "home"} label="Home" icon="⌂" onClick={() => setTab("home")} />
        <NavButton active={tab === "memories"} label="Memories" icon="♡" onClick={() => setTab("memories")} />
        <NavButton active={tab === "profile"} label="Profile" icon="☼" onClick={() => setTab("profile")} />
        <NavButton active={tab === "settings"} label="Settings" icon="⚙" onClick={() => setTab("settings")} />
      </nav>
    </main>
  );
}

function Status({ label, value, tone, inverted }: { label: string; value: number; tone: string; inverted?: boolean }) {
  const displayed = inverted ? 100 - value : value;
  return (
    <div className="status">
      <div>
        <span>{label}</span>
        <strong>{formatValue(inverted ? displayed : value)}</strong>
      </div>
      <div className="bar" role="meter" aria-valuenow={Math.round(displayed)} aria-valuemin={0} aria-valuemax={100} aria-label={`${label}: ${formatValue(displayed)}`}>
        <span className={`bar-fill ${tone}`} style={{ width: `${displayed}%` }} />
      </div>
    </div>
  );
}

function ActionButton({
  label,
  icon,
  action,
  cooldown,
  sleeping,
  onClick,
}: {
  label: string;
  icon: string;
  action: PetAction;
  cooldown: boolean;
  sleeping: boolean;
  onClick: (action: PetAction) => void;
}) {
  return (
    <button className="action-button" onClick={() => onClick(action)} disabled={cooldown || sleeping} aria-label={`${label}${sleeping ? " (sleeping)" : cooldown ? " (cooling down)" : ""}`}>
      <span className="action-icon" aria-hidden="true">
        {icon}
      </span>
      <span>{label}</span>
    </button>
  );
}

function MemoriesView({ petName, memories }: { petName: string; memories: Memory[] }) {
  return (
    <section className="content-view">
      <p className="eyebrow">The little things</p>
      <h1>{petName}&apos;s memories</h1>
      <p className="view-lede">A tiny scrapbook of the days you made together.</p>
      {memories.length ? (
        <div className="memory-list">
          {memories.map((memory) => (
            <div className="memory-item" key={memory.id}>
              <span aria-hidden="true">✦</span>
              <div>
                <strong>{memory.text}</strong>
                <small>
                  <time dateTime={memory.createdAt}>{formatRelative(memory.createdAt)}</time>
                </small>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <span aria-hidden="true">♡</span>
          <strong>Your first memory is waiting.</strong>
          <p>Give {petName} some Cafuné and make the day a little more special.</p>
        </div>
      )}
    </section>
  );
}

function ProfileView({ data, archetypeTitle }: { data: PetHomeData; archetypeTitle: string }) {
  const emoji = ARCHETYPE_META[data.archetype]?.emoji ?? "🐕";
  return (
    <section className="content-view">
      <div className="profile-dog" aria-hidden="true">
        {emoji}
      </div>
      <p className="eyebrow">{archetypeTitle}</p>
      <h1>{data.name}</h1>
      <p className="view-lede">{ARCHETYPE_META[data.archetype]?.description}</p>
      <div className="profile-card">
        <div>
          <span>Days together</span>
          <strong>{data.daysTogether}</strong>
        </div>
        <div>
          <span>Happiness</span>
          <strong>{formatValue(data.state.happiness)}</strong>
        </div>
        <div>
          <span>Top trait</span>
          <strong>{data.personality[0]?.trait.toLowerCase().replace("_", " ") ?? "attached"}</strong>
        </div>
      </div>
      <h2>Personality</h2>
      <div className="trait-list">
        {data.personality.slice(0, 4).map((entry) => (
          <div key={entry.trait}>
            <span>{entry.trait.toLowerCase().replace("_", " ")}</span>
            <div className="bar" role="meter" aria-valuenow={entry.value} aria-valuemin={0} aria-valuemax={100} aria-label={`${entry.trait}: ${entry.value}%`}>
              <span className="bar-fill green" style={{ width: `${entry.value}%` }} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function SettingsView({
  userName,
  userEmail,
  notifications,
  notice,
  pushSupported,
  onToggleNotifications,
}: {
  userName: string;
  userEmail: string;
  notifications: boolean;
  notice: string | null;
  pushSupported: boolean;
  onToggleNotifications: () => void;
}) {
  return (
    <section className="content-view">
      <p className="eyebrow">Make it yours</p>
      <h1>Settings</h1>
      <p className="view-lede">Keep MyPuppy close — always on your terms.</p>
      <div className="settings-list">
        <div className="setting-row">
          <div>
            <strong>Signed in as</strong>
            <small>
              {userName} · {userEmail}
            </small>
          </div>
        </div>
        <div className="setting-row">
          <div>
            <strong>MyPuppy notifications</strong>
            <small>
              {pushSupported
                ? notifications
                  ? "Your dog can call you back."
                  : "Get a gentle nudge when your dog misses you."
                : "Push is not supported on this device yet."}
            </small>
          </div>
          {notifications ? (
            <button className="small-button" onClick={onToggleNotifications}>
              Turn off
            </button>
          ) : (
            <button className="small-button" onClick={onToggleNotifications} disabled={!pushSupported}>
              Enable
            </button>
          )}
        </div>
        <div className="setting-row">
          <div>
            <strong>Reduced motion</strong>
            <small>Follows your device preference automatically.</small>
          </div>
          <span className="setting-on">Auto</span>
        </div>
        {notice && (
          <p className="settings-notice" role="status">
            {notice}
          </p>
        )}
        <div className="setting-row danger-row">
          <div>
            <strong>Sign out</strong>
            <small>Your dog will be right here when you return.</small>
          </div>
          <form action={signOutAction}>
            <button type="submit" className="small-button danger">
              Sign out
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}

function NavButton({ active, label, icon, onClick }: { active: boolean; label: string; icon: string; onClick: () => void }) {
  return (
    <button className={active ? "nav-active" : ""} onClick={onClick} aria-current={active ? "page" : undefined} aria-label={label}>
      <span aria-hidden="true">{icon}</span>
      <span>{label}</span>
    </button>
  );
}
