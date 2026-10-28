import { Link } from "react-router";

// The privacy policy, at a stable public URL because Google Play requires one
// before an app that uses the camera and microphone can be released to any
// track, internal testing included.
//
// It describes WHAT THE APPS DO TODAY and nothing more. A policy that promises
// a feature into existence is worse than no policy: the Play data safety form
// has to match this page, and the day recording actually ships both have to be
// updated together, before the build that does it.
//
// Plain language on purpose. Four people playing a game with their mates
// should be able to read this in a minute and know exactly what happens to
// their face and their voice.

const UPDATED = "28 October 2026";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="text-xl font-semibold text-white">{title}</h2>
      <div className="mt-3 space-y-3 text-[15px] leading-relaxed text-slate-300">{children}</div>
    </section>
  );
}

export function PrivacyPage() {
  return (
    <main className="min-h-dvh bg-[#0b0c1a] px-5 py-12">
      <div className="mx-auto max-w-2xl">
        <Link to="/" className="text-sm text-green-400 hover:text-green-300">
          ← Guess the List
        </Link>

        <h1 className="mt-6 text-3xl font-bold text-white">Privacy policy</h1>
        <p className="mt-2 text-sm text-slate-400">Last updated {UPDATED}</p>

        <p className="mt-6 text-[15px] leading-relaxed text-slate-300">
          This covers the Guess the List website and the Tenable apps for iOS and Android. It is
          written for the people who actually use them: you, and whoever you invite into a game.
        </p>

        <Section title="What we collect">
          <p>
            <strong className="text-white">An account, if you make one.</strong> An email address
            and a password. The password is stored only as a scrypt hash — we cannot read it, and
            neither can anyone who obtains the database.
          </p>
          <p>
            <strong className="text-white">A display name, if you join as a guest.</strong> Whatever
            you type. No account, no email, nothing else. It is shown to the other players in your
            room and kept with that room&rsquo;s record.
          </p>
          <p>
            <strong className="text-white">What happens in a game.</strong> The guesses typed, which
            answers were found and when, and which rounds were played. This is the game&rsquo;s own
            record of itself.
          </p>
          <p>
            <strong className="text-white">Camera and microphone, while you are in a room.</strong>{" "}
            Both start switched off. They turn on only when you tap the button and grant the
            permission, and you can turn them off again at any moment.
          </p>
        </Section>

        <Section title="What happens to your camera and microphone">
          <p>
            Video and audio are sent live to the other people in your room, through LiveKit, so you
            can see and hear each other. That is the only thing they are used for.
          </p>
          <p>
            <strong className="text-white">They are not recorded and not stored.</strong> Nothing is
            kept after the room ends, and nobody — including us — can watch a game back. If that
            ever changes, this page and the app will say so before the version that does it is
            released, and recording will be something every player is asked about rather than
            something that happens to them.
          </p>
          <p>
            We do not use your camera, microphone, voice or face for advertising, profiling,
            training any model, or anything else.
          </p>
        </Section>

        <Section title="Who else sees it">
          <p>
            <strong className="text-white">The other players in your room.</strong> That is the
            point of the game. A room is private: it can only be joined with its invite link or
            code.
          </p>
          <p>
            <strong className="text-white">LiveKit</strong> carries the live video and audio between
            devices. <strong className="text-white">Railway</strong> hosts the server and its
            database.
          </p>
          <p>
            We do not sell anything to anyone, and there are no advertising or analytics trackers in
            the apps.
          </p>
        </Section>

        <Section title="Deleting your data">
          <p>
            Email <a className="text-green-400 hover:text-green-300" href="mailto:frontendjoetube@gmail.com">frontendjoetube@gmail.com</a>{" "}
            and your account and its game history will be deleted. Guests have no account to delete;
            a display name and the guesses from a room are all that exists.
          </p>
        </Section>

        <Section title="Children">
          <p>
            The games are not aimed at children under 13, and accounts are not knowingly created for
            them.
          </p>
        </Section>

        <Section title="Contact">
          <p>
            <a className="text-green-400 hover:text-green-300" href="mailto:frontendjoetube@gmail.com">
              frontendjoetube@gmail.com
            </a>
          </p>
        </Section>
      </div>
    </main>
  );
}
