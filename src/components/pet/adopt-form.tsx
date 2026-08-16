"use client";

import { useActionState, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { createPetAction, type CreatePetResult } from "@/app/actions/pet";

const DOGS = [
  {
    type: "caramelo" as const,
    name: "Caramelo",
    title: "The Brazilian Legend",
    emoji: "🐕",
  },
  {
    type: "fiapo" as const,
    name: "Fiapo de Manga",
    title: "Tiny. Fluffy. Chaotic.",
    emoji: "🐶",
  },
  {
    type: "malhadinho" as const,
    name: "Malhadinho",
    title: "100% Dog. Breed Classified.",
    emoji: "🐕‍🦺",
  },
];

export function AdoptForm() {
  const router = useRouter();
  const [selected, setSelected] = useState<(typeof DOGS)[number]["type"]>("caramelo");
  const [name, setName] = useState("");
  const [created, setCreated] = useState(false);

  const [state, formAction, pending] = useActionState<CreatePetResult | undefined, FormData>(
    async (previous, formData) => {
      const result = await createPetAction(previous, formData);
      if (result.ok && result.petId) {
        setCreated(true);
        router.push(`/pet/meet?petId=${encodeURIComponent(result.petId)}`);
      }
      return result;
    },
    undefined,
  );

  const selectedDog = DOGS.find((dog) => dog.type === selected) ?? DOGS[0];
  const displayName = name.trim() || selectedDog.name;

  return (
    <form action={formAction} className="adopt-form" noValidate>
      <input type="hidden" name="archetype" value={selected} />
      <div className="dog-picker" role="radiogroup" aria-label="Choose your dog">
        {DOGS.map((dog) => (
          <button
            key={dog.type}
            type="button"
            role="radio"
            aria-checked={selected === dog.type}
            className={`dog-choice ${selected === dog.type ? "selected" : ""}`}
            onClick={() => setSelected(dog.type)}
          >
            <span className="choice-emoji" aria-hidden="true">
              {dog.emoji}
            </span>
            <span>
              <strong>{dog.name}</strong>
              <small>{dog.title}</small>
            </span>
            <span className="check" aria-hidden="true">
              {selected === dog.type ? "✓" : ""}
            </span>
          </button>
        ))}
      </div>

      <label className="name-label" htmlFor="pet-name">
        What will you call them?
      </label>
      <input
        id="pet-name"
        name="name"
        maxLength={18}
        value={name}
        onChange={(event) => setName(event.target.value)}
        placeholder={`Leave empty to adopt ${selectedDog.name}`}
      />
      {state?.errors?.name?.map((message) => (
        <p key={message} className="field-error" role="alert">
          {message}
        </p>
      ))}
      {state?.errors?.form?.map((message) => (
        <p key={message} className="form-error" role="alert">
          {message}
        </p>
      ))}

      <button type="submit" className="primary-button" disabled={pending || created}>
        {pending || created ? "Preparing the meeting..." : `Meet ${displayName}`} <span>→</span>
      </button>
    </form>
  );
}

export function MeetDog({ children, petName, emoji }: { children?: ReactNode; petName: string; emoji: string }) {
  return (
    <main className="shell onboarding">
      <div className="brand-mark">
        My<span>Puppy</span>
      </div>
      <div className="eyebrow">Step 2 of 2 — Say hello</div>
      <h1>Meet {petName}.</h1>
      <div className="hero-dog" aria-hidden="true">
        <span className="sun" />
        <span className="dog-emoji">{emoji}</span>
        <span className="spark spark-one">✦</span>
        <span className="spark spark-two">✷</span>
      </div>
      <p className="lede">
        {petName} is looking at you like this was the best idea all day. From here on, every good moment is shared.
      </p>
      {children}
    </main>
  );
}
