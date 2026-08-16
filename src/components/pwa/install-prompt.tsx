"use client";

import { useEffect, useState } from "react";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function isStandalone(): boolean {
  return window.matchMedia("(display-mode: standalone)").matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
}

export function PwaInstallPrompt() {
  const [installEvent, setInstallEvent] = useState<InstallPromptEvent | null>(null);
  const [iosDevice, setIosDevice] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [showIosHelp, setShowIosHelp] = useState(false);

  useEffect(() => {
    const initialState = window.setTimeout(() => {
      const standalone = isStandalone();
      setInstalled(standalone);
      setIosDevice(/iphone|ipad|ipod/i.test(navigator.userAgent) && !standalone);
    }, 0);

    const handleInstallAvailable = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as InstallPromptEvent);
    };
    const handleInstalled = () => {
      setInstalled(true);
      setInstallEvent(null);
    };

    window.addEventListener("beforeinstallprompt", handleInstallAvailable);
    window.addEventListener("appinstalled", handleInstalled);
    return () => {
      window.clearTimeout(initialState);
      window.removeEventListener("beforeinstallprompt", handleInstallAvailable);
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

  async function install() {
    if (!installEvent) return;
    await installEvent.prompt();
    await installEvent.userChoice;
    setInstallEvent(null);
  }

  if (installed || (!installEvent && !iosDevice)) return null;

  return (
    <section className="install-pwa-card" aria-label="Install MyPuppy">
      <span className="install-pwa-icon" aria-hidden="true">⌂</span>
      <div>
        <strong>Keep MyPuppy close</strong>
        <p>{iosDevice ? "Add MyPuppy to your Home Screen so your dog can reach you more reliably." : "Install MyPuppy on your phone for a more app-like experience and notifications."}</p>
        {iosDevice ? (
          <>
            <button className="small-button" onClick={() => setShowIosHelp((current) => !current)}>{showIosHelp ? "Hide steps" : "Show me how"}</button>
            {showIosHelp && <small className="install-pwa-steps">Tap <strong>Share</strong> in Safari, then choose <strong>Add to Home Screen</strong>.</small>}
          </>
        ) : (
          <button className="small-button" onClick={install}>Add to Home Screen</button>
        )}
      </div>
    </section>
  );
}
