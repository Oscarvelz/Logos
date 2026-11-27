## 1.4.264 — Hidden to the half; the toast's Undo can be read

Built on Hark's shell cure (source 5bba6faf56, CI 166),
which is now part of this tree: the bubble window carries
FLAG_LAYOUT_NO_LIMITS — the root cause of the whole dock
affair (the window manager clamped the overlay inside the
screen, so the docked seat past the edge was always pulled
back whole; five waves of state machinery were innocent),
midAudio means real progress (frac strictly between
0.0005 and 0.999), stale guards expire (a page "playing"
unconfirmed for 15 s; a hand-down older than 8 s), and
every held dock run writes its reason to the stage journal.

Oscar's two orders on seeing it work (2026-11-27):

THE HALF. «Ahora que se oculte a la mitad» — the docked
bubble now hides to exactly half the jewel: dockShift is
bubbleSize()/2 + dp(4), so half the jewel stays in sight
past the edge at whatever size he chose, replacing the
fixed 30dp sliver of 1.4.258–263.

THE TOAST'S COLOURS. His Cyberpunk screenshot: the
«Playing what you copied» toast is an inverted pill (the
theme's text colour as its ground — near-white in
Cyberpunk) and its Undo wore the raw signal yellow on
that white: illegible. The button can never wear the raw
accent on the inverted pill; each theme now gives it a
legible depth of its own family, extending the dark
theme's standing patch (#8a5a0e): light wears the light
gold #e9bd72 (its pill is dark), Tron a deep cyan #006a7a,
Cyberpunk a deep magenta print #d10056 of its neon.
CSS only; the toast's shape and words are untouched.

Presentation impact: none — no anchor, presence or text
changed (pure CSS and shell geometry).
## Shell (Hark, 2026-11-27) — the edge dock, unblocked

Taken over from Muse's report (1.4.258–263: the bubble never hid on Oscar's phone).
- **Main cause:** the bubble window had no FLAG_LAYOUT_NO_LIMITS. The window manager
  clamps overlays inside the screen, so the docked seat (past the edge) was pulled
  back and the whole jewel stayed visible. The flag is now set on the bubble window.
- **midAudio()** now means real progress: frac strictly between 0.0005 and 0.999, not
  finished. A session parked at zero (loaded, never played, or a recording that reset
  to zero) no longer holds the bubble out. Native voice is judged the same way.
- **Stale guards cut:** a page "playing" that has not pushed in 15 s (it pushes every
  120 ms while sounding) no longer holds the dock; a hand-down older than 8 s with no
  release is dropped.
- **Diagnostics:** every held run writes its reason once per change to the stage
  journal (lastTry): "dock held: panel / hand / playing / audio paused mid-way".
- Not tested on a device; compiled in CI.

## 1.4.263 — The finished recording speaks its end; the headset button serves again

Two verdicts of Oscar's (2026-11-27), both answered literally.

THE BUBBLE THAT WOULD NOT HIDE. The reading HAD finished —
his word — and the bubble sat out whole on 1.4.262. The
seat, convicted in code: the bubble has two faces. The
listen face carries `fin` (1.4.237) and the 1.4.260
mid-audio guard reads it honestly. The RECORDING face
(clip.ts: Library recordings, Create results) carried no
`fin` at all, and at a clip's natural end its clock resets
to 0 — so the shell read the standing face as a reading
forever at its start (active, no fin, fraction 0) and the
mid-audio guard held the bubble out PERMANENTLY after any
recording finished, until another session displaced the
face. The guard was doing its duty; the face was lying by
omission. Cure: the clip player now witnesses its own end
(`ended`, set at the natural end, cleared by play, by a
new clip, and by a seek back into the middle), and the
clip face speaks `fin` from it, exactly as the listen face
does. The mid-audio norm itself is untouched: a recording
paused mid-way still holds the bubble out; a finished one
no longer does.

THE HEADSET BUTTON. 1.4.173 closed the headphone replay
of a finished reading by Oscar's dictation verdict (a
parked-awake session caught a stray PLAY from a dictation
stop and restarted a reading uninvited). His ruling now:
«No reviertas nada a menos que mis botones vuelvan a
servir» — the buttons must serve again. The finished
reading parks AWAKE once more (the 1.4.160 shape): while
its card stands finished, the media session stays active,
the router hands it his headphone PLAY, and the reading
replays from 0. The 173 risk returns with the deed and is
named in the code and in the delivery: a stray PLAY while
the finished card stands can restart the reading; the
card's stop retires the park. A paused reading still
sleeps (1.4.154 stands) — the park is for the finished
alone.

Shell + page wave: no bench exists for the media session
or the overlay; the CI compile is the shell gate, the
battery judges the page, and his phone is the judge.
## 1.4.262 — The dress watchdog: a visit never survives his gaze

The black screen, diagnosed with Oscar's own sighting
answers (2026-11-27): it covers the whole screen; Back
cures it; the gold λ never appears; it came back stronger
in a morning of heavy bubble testing.

The mechanism: a bubble errand that must wake the page
runs as a ghost visit — the activity dressed invisible
(web alpha 0, transparent paint, not touchable) so the
work happens without flashing the app. But the activity's
window is OPAQUE with a near-black ground (@color/bg), so
clothes left standing read as a full-screen black. The
page never died (hence no splash, and arrivalCheck's
rescue never applied); Back left the task, and the next
arrival's stay-conversion stripped the clothes (hence the
cure). Every black screen in this house's history was
this family (1.4.204's manufactured visit, 1.4.153's black
pull-back, 1.4.236's corpse page) — each entry road fenced
in its wave, and still the family returned.

The cure aims at the symptom's one necessary condition:
ghost still true while he looks. onResume now arms a
watchdog (four seconds — a healthy visit is retired by
its pulse long before, and a backstage errand never
resumes at all): if the dress is still on and the activity
is resumed, the visit is lifted on the spot (exitGhost)
and the rescue leaves its witness on the Settings line
("a visit was lifted from the screen"), so the next
sighting carries evidence of which road was taken.
Healthy visits are untouched: they run un-resumed and
retire by pulse or failsafe as before.

Shell wave: no bench exists for the overlay or the
activity dress; the CI compile is the gate and his phone
the judge.
## 1.4.261 — Voices completed: the reading voice can be crowned; the flags stop being cut; the 260 shell cure rides here

Three deeds in one wave:

1. THE 260 SHELL CURE RIDES HERE. 1.4.260's web half is
   live, but its Android build FAILED (CI 162): midAudio()
   wrapped NativeSpeaker.panelJson() in JSONObject(...) —
   panelJson already returns a JSONObject, so no such
   constructor exists. The builder's error, named. Fixed
   (the call now reads the object directly); the mid-audio
   dock norm ships in this wave's APK.

2. THE READING VOICE'S OWN CARD GAINS THE DEED (Oscar,
   2026-11-27: «Continúa sin dejarme seleccionar la voz que
   quiero»). 257 withheld "Make default" from the resolved
   reader's card — but a reader who reads by a Listen pick
   is not the stored default, so the pick's own card (Marcos)
   offered no deed: the voice he wanted to predetermine
   could not be made permanent anywhere in Voices. The
   offer is now judged by the two offices the one deed
   serves: a card offers the button when its voice is not
   the stored default (the deed crowns it — the pick
   converts into the predetermination) OR when a pick
   governs its language (the deed releases it — the
   outranked default's card, the 257 case). Absent only
   where the voice already is the predetermined one and
   nothing stands over her. Judged by the voices-center
   bench: 22/22, his specimen verbatim, both deeds walked.

3. THE FLAGS STOP BEING CUT (Oscar: «tarjetas cortadas por
   borde. Contra la ley de envoltorio»). The card flag
   (.default-flag) straddles the card's top edge by design
   (top: -7px); the accordion's animated wrapper
   (.vgroup-body > div, overflow: hidden) clips at the
   grid's top edge, so the FIRST card of every open group
   lost the top of its flag — measured on the bench (flag
   top 68, wrapper top 74) and seen in his screenshot. The
   grid now carries the flag's room as its own top padding
   (.voice-grid padding-top: 8px): the straddle stands, the
   clip is gone, on the Voices page and in the picker alike.
   Bench-proven at phone width: the first card's flag
   renders whole.

Presentation: the make-default anchor's presence rule
changes again — absent only on the stored default's card
when no pick governs her language; the pick's own card now
carries it. Relay owed to the Presentation lane.
## 1.4.260 — The dock obeys the old norm: never mid-audio

Oscar's verdict on 259 (2026-11-27, three screenshots): the
dock now works — his second screenshot shows the jewel
hidden behind the phone's edge, the form of his third
screenshot (another app's edge tab): «Se oculta detrás del
borde del teléfono. Exactamente lo que quiero.» But the
TIMING broke his old norm: «Lo que se oculta es el aro, no
la burbuja! No ocultes el aro si hay audio a la mitad. Solo
cuando el audio finaliza. Mi antigua norma.»

The correction: what the dock takes away is the RING — the
reading's progress — and a reading in course keeps its ring
in sight even when paused (the ring retires only at the
end, 1.4.237). The first build counted a paused reading as
free to hide (declared as a builder's choice in 258's
notes); his norm overrules it.

The cure (BubbleService, the dock judge only): dockRun now
also waits out midAudio() — a session in course and not
finished. The device voice answers through its own panel
word (done); the page road reads the push: active, the
finished flag (fin) unset, and the fraction short of the
end (the recording's face carries no fin; its fraction is
its word). The dock proceeds only when nothing stands
mid-way: no session, or the audio finalized. His hand
stays sovereign — the outward slide hides the bubble
whenever HE orders it; the guard binds only the automatic
wait. Everything else from 258/259 stands: the three-second
wait, the 30dp sliver behind the edge, the tap that only
restores, play keeping the jewel out.

Shell wave: no bench exists for the overlay; the CI
compile is the gate and his phone the judge.
## 1.4.259 — The dock, cured: the slide is the gesture, and the wait cannot starve

Oscar's verdict on 258 (2026-11-27): «No noto ningún
comportamiento asociado a lo que te pedí de esconder en el
borde. La burbuja no hace nada y no registra mis gestos para
ocultarla manualmente.»

Two defects, both in the first build's judges:

1. THE GESTURE JUDGE DEMANDED A FLICK. The manual hide was
   judged only inside the seat-gesture branch — a fast flick
   (≥24dp in ≤400 ms, faster than 0.45 px/ms). His order was
   «un simple desliz hacia afuera»: a deliberate slide at his
   hand's own speed fell below the flick floor, was judged as
   a plain drag, and the bubble glided home. The gesture was
   never registered because the judge was listening for a
   different gesture. Cured: ANY moved release is now judged
   for the slide — the travel points mostly outward
   (|dx| ≥ 0.55 of the travel, sign toward the edge of the
   side where the jewel is released) and the jewel is
   released PAST its nearest home's centre toward the edge
   (≥16dp) — pushed into the border, not merely carried. The
   seat gesture keeps its priority: a fast flick that names
   a place (the down-left diagonal from the middle seat
   still lands on the bottom corner, 240's law) seats; the
   slide docks only where the gesture names no place, which
   is every road that points past the edge.

2. THE WAIT COULD STARVE SILENTLY. The dock run died on its
   transient guards (panel standing, a hand resting) with
   nothing in the bubble's ordinary life guaranteed to
   re-arm it, and its playing witness was the raw push
   snapshot, whose last word a frozen page can leave standing
   at "playing" forever. Cured: a blocked run re-arms short
   (1.2 s) and judges again; the witness is the shell's own
   mirrors (playingNow, kept current by refreshPanel from
   both drivers, and NativeSpeaker.playing); and every
   refreshPanel that finds the bubble out, unplayed and
   unpaneled ensures a run is pending, idempotently
   (dockPending), so the dwell is never reset by traffic and
   never lost by a missed arm.

Declared bounds unchanged from 258: the wait is three
seconds, the sliver 30dp, the seat system untouched, the
gates sovereign over any release that rests on them.
Shell wave: no bench exists for the overlay; the CI
compile is the gate and his phone the judge. His check
that the shell took: the Settings footer reads 1.4.259.
## 1.4.258 — The bubble docks at its edge

Oscar's order (2026-11-27): «Haz que la burbuja se esconda
automáticamente en el borde de donde esté. Que deje ver parte
de su icono para tocarlo y abrirlo rápidamente. Entonces, si
no se le da play, permanece un instante en la espera, y luego
transiciona a su borde. Pero si se le da play, la espera
queda vista, para dejar ver al aro. De todas formas, haz que
la burbuja acepte el gesto de esconder en su borde. Un simple
desliz hacia afuera, apuntando al borde, señala a la burbuja
que el usuario quiere esconderla manualmente. Y el
comportamiento se repite.»

The deed (BubbleService, shell wave): the bubble's home
stays its seat — the dock is a veil over it. When nothing is
playing and no panel stands, a three-second wait ends in a
glide outward to the seat's own edge, until only a sliver of
the jewel (30dp of it) shows. Play undocks it at once and
keeps it out for as long as it plays, so the ring can be
seen; when play stops, the wait runs again and the cycle
repeats. A tap on the sliver brings it back out (that tap's
only deed — the next tap is the tap as always). A quick
slide aimed outward, toward the edge of the side where the
bubble is released, docks it by hand at once: the seat is
re-judged to the nearest place first, then the one glide
carries it out. A drag that takes hold of the sliver
carries it as always, undocked. Opening the panel undocks
it; closing the panel starts the wait again. A hand resting
on the bubble holds the wait off.

Declared bounds: the wait is three seconds, chosen, and
tunable by his word; the dwell is judged by the shell's own
playing witness, so a reading the shell cannot see (none —
both drivers report to it) is the only kind that could dock
mid-sound, and the dock judge re-checks at the moment of
gliding. Shell wave: no bench exists for the overlay; the
CI compile is the gate and his phone the judge.
## 1.4.257 — Voices is the only center: Make default takes the stage

Oscar's report (2026-11-27, with his photo): in Voices, Noa
wears "Default · Español" and Marcos wears "Now reading ·
Español" — and he cannot make Noa read: «No puedo elegir en
voces la que quiero predeterminar. Antes había un botón para
eso, pero lo quitamos por redundancia. La regla de
consistencia dice que hay que dársela a Voices, el único
centro para cambiar la voz del lector.»

What the code said: the photo also settles yesterday's male
voice — it is Marcos, a neural voice standing as a Listen
pick (voiceOverride) over the default. The pick is set by
the Listen-side doors (the picker, the desk chips, the
panel's voice key, which cycles the favorites of the
session's language — Noa and Marcos are both his Spanish
favorites, in that order) and it never expires on its own.
The R2-T7-4 design had deliberately weakened Voices to
match: Make default stored the default only, its toast
confessed the pick still read, and the stored default's own
card offered no deed at all. So the center he names could
show him the truth and could not act on it.

The cure, by his consistency ruling: voiceCardTruth now
offers Make default on every card whose voice is not the
resolved reader for its language — the stored-but-outranked
default included — and the tap stores the default AND
releases the governing pick in the same set, so the chosen
voice reads. The flags keep their offices (Default = the
stored default; Now reading = the standing pick). Judged
by test/wave257-voices-center.ts (16/16, his specimen
verbatim) and proven on the bench at phone width: seeded
with his exact state, Noa's card offers the deed; after the
tap the pick is gone from the stored settings, Marcos's
"Now reading" flag is retired, and Noa's card offers the
deed no more. The Listen-side doors keep their pick — a
pick is an order given there; what changed is that Voices,
the center, can always reclaim the stage from it.

Presentation impact: the `voice-card:{voiceId}:make-default`
anchor's presence rule changes — the button is absent only
on the card that is the resolved reader for its language
(the registry's "a default card loses the button" now reads
"a card that already reads for its language loses the
button; a stored default outranked by a standing pick keeps
it, and its tap releases the pick"). Relay sent.
## 1.4.256 — A silent render no longer surrenders the voice on its own

Oscar's report (2026-11-26): the white-noise sound is back,
and the voice changes on its own — he is listening to a
female voice, he stops, he copies another text to hear it,
and a male voice has been selected, «sin que yo lo ordene».

What the code says, read firsthand: the male voice is the
device voice, and it takes the stage through the 1.4.122
rescue — when the neural voice renders a sentence as digital
silence, playIndex hands the whole session to the shell's
device voice at once. That road fires on ONE silent render,
with no retry. After a stop, with the page woken from the
background, the first render of a new text is exactly where
a still-frozen engine worker — or a model not yet re-seated
— returns zeros of the right duration (122's own diagnosis).
While the engine struggles, the background keep-alive plays,
which is the noise that rides under a long preparation; the
surrender then changes the voice for the whole text. The
voice catalogue itself cannot be the source: every default
the router may substitute is female (Zoey, Noa, Alba, Lola).

The cure (player/listen.ts, the one door every sentence's
start passes): a silent render now earns a revival before
any surrender — reviveRender re-ensures the model, gives the
worker a beat to thaw, and renders the sentence once more in
his voice. Only a second silence hands the session over,
because 122's law also stands: never leave him in silence.
The shell's own takeover chain (for a page that is wholly
dead, not merely wedged) is untouched, by design.

Declared bounds: the keep-alive's level is unchanged — the
noise he hears is the long struggle, and the revival is what
shortens it; if a hiss still rides a healthy start, that is
the next hunt and it will be aimed at the keep-alive itself.
There is no bench that can freeze a real engine worker the
way Android does; the battery and the typecheck are the
gates here, and his phone is the judge, as with every
playback wave.

Presentation impact: none.
## 1.4.255 — The bubble's tap plays the fresh copy (queue off)

Oscar's ask (2026-11-26): the floating button itself should
play the freshly copied audio with just a tap, as before —
no paste key in between — whenever the copy queue is OFF.
With the queue ON, the tap substitutes nothing and the copy
button keeps asking (1.4.249's deed, untouched).

The tap's two deeds (BubbleService.tapBubble, the ACTION_UP
tap branch now lands here instead of togglePanel):

- Queue OFF, panel closed: the tap reads the clipboard (the
  direct read, or the blink when the direct read sees nothing
  without focus). A FRESH catch — one the page has never
  confirmed pulling, judged against the committed key
  (isFreshCatch) — is delivered as a manual catch at once:
  the page's hand-paste road (248) plays it immediately,
  replacing the stage, no card. A catch that is not fresh,
  an empty clipboard, or a blink that never lands falls back
  to the tap's old deed: the panel opens. The blink road is
  the tap's own (tapCatchAt, spent by deliverFromClip): its
  fallback is the panel, never readClip's app-opening floor.
- Queue ON, or the panel already standing: the tap is
  exactly what it was — it opens or closes the panel.

The declared bound: freshness is judged by content, the
only witness a background reader has — copying the very
same words again is indistinguishable from the copy already
heard, so that tap opens the panel, where the paste key
plays even the same words again (248). And if the shell's
queue witness (queueModeSeen) is stale, the page still
judges the delivery by its own law: a manual catch with the
queue on lines up at the tail and substitutes nothing, so
both stale directions land safe.

Shell only — no bench exists for the shell; CI's compile is
the gate and Oscar's phone the judge, as with every shell
wave.

Presentation impact: none.
## 1.4.254 — The numbers are read whole, with their gender kept

Oscar's order (2026-11-26): the audio engine must read
keeping the gender of the word, and must read the numbers
below the thousands whole — «en lugar de decir cinco noventa,
que lea quinientos noventa» — and his example: «1,200 piezas»
is «mil doscientas piezas», with the feminine.

The engine composes neither the hundreds nor the agreement
on its own, so a Spanish segment's integers are spelled out
in words before the voice sees them, in the same seat as
252/253 (speakable(), Spanish segments only, after the format
normalization): spanishNumberWords() composes 0–999,999 whole
(590 → «quinientos noventa», 12,345 → «doce mil trescientos
cuarenta y cinco») and agrees with what is counted — the
hundreds and a final «uno» take the feminine before a
feminine noun, the apocope before a masculine one. The
gender is read from the article before the number when there
is one, else from the noun after it (ending, feminine
suffixes, the common exceptions: día/problema masculine,
mano/noche/calle feminine). The apocope belongs only before
a noun — «hay 21» stays «veintiuno».

Fences: decimals keep their digit form (252's deed); times,
dates, version chains, ranges and percents stand as written;
digit strings longer than six stand (they are codes, not
counts); with no gender sign either way the citation form
stands, as Spanish itself defaults; English segments are
never rewritten. The displayed text is untouched — only the
spoken text is spelled out.

Judged by test/wave254-numbers.ts (22/22, his specimens
verbatim), with the 252 and 253 benches re-run green beside
it (253's whole-road line re-judged to the new truth: the
format is normalized first, then spelled out).

Presentation impact: none.
## 1.4.253 — The mirror training: «1,200 piezas» stops reading as «1 coma doscientos»

Oscar's report (2026-11-26, with his photo of a message of
mine): the Spanish voice interposes a comma in English-shaped
thousands — «1,200» comes out «1 coma doscientos» instead of
«mil doscientos», and «2,352» comes out «2 coma 352» instead
of «dos mil trescientos cincuenta y dos». «Ese es un error de
lectura.»

The mirror of 1.4.252, in the same seat (speakable(), Spanish
segments only): an English thousands group — a comma followed
by exactly three digits, in chain — is rewritten with the
Spanish thousands dot before the voice sees it.

- 1,200 → 1.200; 2,352 → 2.352; 1,234,567 → 1.234.567.
- The order inside the rule keeps the crossings apart: the
  full English money shape first (1,234.56 → 1234,56, from
  252), then the thousands commas, then the dot decimals
  (2.00 → 2,00, from 252).
- The Spanish forms are never touched: a comma with one or
  two digits after it is a Spanish decimal (2,00 and 2,5
  stand), 1.234,56 stands, 2.000 stands — and the decimal
  rule cannot eat a thousands dot this rule just wrote.
  Malformed groups (1,2000), comma-space lists and colon
  times (09:11) stand as written. English segments are never
  rewritten.

Judged by test/wave253-numbers.ts (13/13, his specimens
verbatim) with 252's bench re-run green beside it. The proof
is the text the voice receives; the phone's ear is the final
judge, as always.

Presentation impact: none.
## 1.4.252 — The voice stops reading «2.00 dólares» as two thousand

Oscar's report (2026-11-26, with his photo): «Esta cifra la lee
como 2,000 dólares en lugar de 2 dólares. Entrena el motor de
audio para que no las confunda.»

The confusion is a format crossing: in Spanish the dot is the
thousands separator and the comma the decimal one, but texts
pasted from English sources carry the English decimal dot —
and the voice, reading Spanish, takes «2.00» for a thousands
group. The training lands in the one seat every speech road
passes through, speakable(): a Spanish segment's English-shaped
decimals are rewritten to the Spanish form before the voice
sees them.

- 2.00 → 2,00; 15.50 → 15,50; 3.75 → 3,75 — the plain dot
  decimal with exactly two fraction digits.
- 1,234.56 → 1234,56 — the full English money shape loses its
  thousands commas and gains the decimal comma.
- The Spanish forms are never touched: 2.000 stays two
  thousand, 1.234,56 stays as written. A dot with one digit
  (2.5) or three-plus (3.1416), and chained dots (1.4.250),
  stand as they are — only the shape that gets misread is
  rewritten. English segments are never rewritten.

Judged by test/wave252-numbers.ts: his specimen and every
fence pass (12/12). The proof is the text the voice receives;
the phone's ear is the final judge, as always.

Presentation impact: none.
## 1.4.251 — The lowered player, corrected: the whole player goes down, the desk and the bar hide

Oscar's correction of 1.4.250, the same night: «No era reducir,
prácticamente eliminar el espectro o la parte de arriba del
reproductor. Era simplemente bajar todo el reproductor y
esconder el escritorio de abajo.» 250 folded the player card's
own furniture; that reading was mine, and it is reverted whole.

- The quiet-hours key now lowers the WHOLE player, intact —
  chips, spectrum, scrubber and all. The desk below the player
  (the TabletDesk in the side column) hides, and the app goes
  immersive exactly as it does for a reading: the bottom bar —
  Listen, Voices, Create, Library, Settings — slides away and
  the player settles into the freed bottom. In the wide side
  column the player stack settles at the column's foot. The
  text window above takes everything they leave: that widening
  was the point of the key from the start.
- The mechanism rides the house's own immersive law: App's
  immersive condition gains the lowered state beside the
  playing one, and the pin still vetoes both. The desk's
  hiding and the side column's settling are two rules keyed to
  the page's data-player-low seat. Nothing of the card itself
  is folded, hidden or shrunk.
- The key, its seat, its faces and its words are 250's,
  unchanged; the fold clears itself when playback starts, as
  before.

Presentation impact: none beyond 250's relay — the
listen-nav-pin contract (the seat stands always; a deed per
hour) is unchanged; only the quiet-hours deed's mechanism was
corrected, and the lane is told.
## 1.4.250 — The player's left key stands in the quiet hours too: lower the player, widen the text window

Oscar's ask (2026-11-25, with photos): the transport's left key —
the one that, while playing, pins the bottom bar back — should
also serve when nothing is playing: there it should LOWER the
player, so the text window above widens («para ensanchar la
ventana de arriba»).

- The seat now stands always. While playing it is unchanged in
  deed and face (the bottom-bar pin, 1.4.115). While nothing
  plays it is the player's lower/raise key: one tap folds the
  player card's upper furniture away — the chips row, the
  spectrum, the scrubber and the engine notes — leaving the meta
  line and the whole transport standing; the next tap raises the
  player whole. Its labels say the deed in both languages
  («Lower the player» / «Raise the player»).
- The widening needs no new geometry: on the phone and in the
  landscape column the text card already flexes to fill what the
  player leaves, so the freed room becomes the upper window's by
  the house's own flex law. In the wide side column the same fold
  hands its room to the desk below the player.
- The fold clears itself when playback starts (a new store,
  playerLow, beside navPin; the clearing mirrors the pin's own
  self-clearing law): the listening face is always the whole
  face, and lowering is a writing-hours choice, re-made with one
  tap after the reading ends.

Presentation impact: the listen-nav-pin anchor's contract
widens — the seat stands always, with a deed per hour (pin while
playing, lower/raise while quiet). The anchor record's
precondition now says so; no anchor is minted or retired, and
DOC_TOTALS are unchanged. Relayed to the Presentation lane with
this wave.
## 1.4.249 — The paste key's card returns, and with it the confirmed front paste

Oscar's report (2026-11-25): the panel's paste key had pasted in
silence since 239 — with the queue on, the text lined up at the
tail and nothing said a word; the confirmation window he
remembered («simplemente era para dejarle saber al usuario qué
hacía ese botón y que reemplazaba al texto que estaba ahí») was
206's card, retired in 239 by his copy-order law. His ruling: the
law stands for everything that merely arrives; the paste key is
the hand's one exception, confirmed every time, exactly as 206
had it.

- The paste key, when something stands to be displaced (a
  session on the stage, or a line waiting), first shows its card
  — «Hear the last copy now?» — worded by the mode: ahead of the
  line when a line stands, replacing what plays when none does.
  «Not now» spends nothing: no read is made. On an empty stage
  the key is the key it has always been — no card, it pastes.
- The confirmation ARMS the front stamp; the stamp itself is
  laid by deliver() on the manual delivery the confirmation set
  in motion (twenty-second arm, spent by any manual delivery,
  stamped or not), so an empty or failed read can never leave a
  live stamp standing for an unrelated catch to be misjudged by.
  The 206 stamp plumbing — companion pasteFront/pasteFrontAt,
  Bridge bubblePasteFront, inert since 239 — carries it again.
- The page judges a stamped delivery by the front road before
  any other (pullClip and the birth pull alike): with the queue
  on, queueFrontArrival puts the copy at the head and plays it
  now; the standing current leaves the line (its place is kept
  as a replaced session's always is), and the line behind keeps
  its order. With the queue off, the stamped paste lands at
  once, replacing what plays.
- queue.ts offers enqueueFront again — one door, not an arrival
  door: a hand copy of a text already waiting moves that text to
  the head instead of duplicating it. Arrivals still only ever
  join the tail; test/wave206-front.ts now judges both halves of
  the refined law and passes.

Presentation impact: none — no anchor, surface or copy in the
lesson system changes; the stage's version strings rise with
the wave, as always.
## 1.4.248 — The hand paste lands at once (Grok's lane, integrated verified)

The first change to arrive from Grok's lane (`grok-lane`, commit 2a9c4ce0, on a base of 1.4.247) — reviewed file by file against canon, corrected at one point, and integrated here; the lane's first attempt (a shortcut in the visibility handler, where a hand ask already landed at once) changed no behaviour and was not carried over, and the law comments it had trimmed stand restored.

What was wrong, in Oscar's report of 2026-11-22: the panel's paste key could die in silence — no tray, no play. One of its silent deaths lived in the page: the shell has always marked a hand-asked delivery with a manual flag (`m`, written by takeClip in BubbleService) and the page never read it, so a stored hand paste was judged like any automatic arrival — and at the page's birth pull, a hand paste of the very words heard last was discarded by the same-words gate outright.

The cure, as integrated: both stored-catch pulls (the clip pull and the birth pull) now read the manual mark. With the copy queue OFF, a hand paste plays at once, even when its words are identical to the last catch's — the finger asked. With the queue ON, the integration adds the guard the lane's patch lacked: the hand paste still lines up at the tail through the arrival judge, as Oscar's copy-order law (1.4.239) commands — the manual mark buys it nothing there, and nothing jumps the line. Automatic arrivals are judged exactly as before, and the replace question (1.4.192) is untouched.

Web-only: the shell already writes the mark, so no Android change rides with this wave. The page roads are bridge-fed and cannot be exercised by the bench harness; the change is verified by construction, the full gates, and the judge test for the copy-order law — Oscar's phone is the final judge, with the test from his own report: copy a text, hear it, copy the same text again, tap the panel's paste key — it must play again at once.

## 1.4.247 — The stage's Settings learns the list-detail

The Presentation stage's fiction is the app's true form or it teaches a Settings that no longer exists — so the fiction follows the app into list-detail (1.4.246), at the same tier and in the same shape. At 1200px and wider, the stage's Settings surface stands with the five trays as a list at the left and the seated tray's cards as the detail beside it; below the tier, the trays stack exactly as before, and on the phone nothing changes.

The seat is shared machinery, not a fiction-local habit: it lives in the stage's UI store (settingsTray), the stage's DOM sync keeps the painted attribute ahead of React, and the anchor resolver seats the tray before it resolves any beat that points at a Settings card — the Library's two tabs taught the pattern, and the Settings search in the fiction performs the same deed (seat the owning tray, then land). No beat can ever be resolved against a card that is not displayed. The tray map is the app's own: Neural voice and Pronunciation under The voice; Playback and the Floating player under Listening; Appearance and Language under The screen; Presentations under Learn; Backup and About under Your data.

Bench-verified at 1280×800: a lesson about the Floating Player stands on the Settings surface with Listening already seated by the resolver and the Playback card in the detail — one tray, and only one, on display. No anchors minted or retired; the registry is untouched.

## 1.4.246 — Settings in list and detail

The last restructure of the pane system (direction A): at the two-pane tier, Settings stops being a masonry of trays and becomes a list-detail. The five trays are the list — a sticky 320px column at the left, each row carrying the tray's icon, its name and its one line, the chosen one lit with the surface, the edge and a gold inset bar. The chosen tray's cards stand as the detail beside it, inside the tray's own sunken paint, capped at 840 so the rows of controls keep their measure at the widest tier. The tray's own header hides in this form — the list already names it.

Nothing moved house. The trays never unmount: the unselected ones are simply not displayed, so every card keeps its state, its fold and its anchor, and the clusters law stands untouched — pieces intact inside their tray, in their order. The search learned the new geography: a result first selects the tray that owns its card, then opens the card and scrolls to it, exactly as it lands below the tier. Below 1200px the page is byte-for-byte the Settings Oscar already knows — tray masonry, headers and all — and the phone never sees the list at all.

Presentation impact: the Settings anchors are unchanged (every card keeps its data-present id and its home tray); the stage's Settings fiction still shows the tray masonry at wide widths — mirroring the list-detail on the stage is the lane's call, relayed with this wave.

Bench-verified at 1280×800 (list and detail composed; tray switching by tap; a search for "backup" selects Your data and lands on the Backup card, open), at 1920×1200 (detail capped, composition centred), and on the phone (unchanged). Web only.

## 1.4.244 — The stage's tablet rules stay on the stage (2026-11-22)

Oscar's tablet report: «My tablet look AWFUL. Not optimization whatsoever. The text is not showing, and there are large blank black empty spaces. Horrible looking. Settings is decent but not very well. Listen is full of gaps, as the rest.»

Reproduced on the bench at 1280×800 before touching anything — every word of it, and the mechanism measured in the DOM: on Create, the real `.create-grid` stood 475px wide at the page's right edge, its text column computed at 119px, the placeholder wrapping letter by letter («Wha/t/shou/ld/Logo/s/reco/rd?»); on Listen, the real `.listen-grid` stood 627px wide with the page's remaining ~480px a black void. Settings and Voices were spared — the fingerprint that named the culprit.

The mechanism: the Presentation stage's «TABLET TRUTH» section (presentation-stage.css, R2-T6-8) dresses the stage's fiction pages in the app's wide arrangements. Its child rules name stage-only classes, but its two root rules were never scoped — `.listen-page { display: grid; grid-template-columns: minmax(0, 1.35fr) minmax(360px, 1fr) }` and the twin `.create-page` rule (plus the ≥1500 three-column template) match the REAL pages too, because the fiction borrows the real pages' own class names. At any window ≥1100px wide the real Listen and Create pages became two-column grids whose first column took the page head and whose second crushed the content grid to its minimum. The phone never saw it (below the breakpoint the section sleeps), and portrait tablets neither — the wide landscape window is the only country it ruled.

The cure: **the whole section is scoped to the stage** — every rule now hangs from `[data-stage-surface]`, where the fiction's roots live by construction (presentation-stage.tsx wraps each surface in its named container). The stage keeps its tablet truth; the real pages fall back to their own wide rules in styles.css, which were correct all along and simply never got to rule. No real-app CSS changed; no stage behaviour changed.

Verified on the bench at 1280×800 and 1920×1200 after the fix: Create's text column takes its wide share with the placeholder on one line, Listen's grid spans the page (text | player + desk, and the three-column ladder at ≥1500), Library and Voices unchanged, Settings untouched. The presentation suites and fences stand as the stage's gates.

- Declared bound: the stage's own wide fiction was verified by its suites and by the scoping's construction (its roots are inside the containers the selectors now require); a guided Presentation walked on a wide screen remains the lane's to eyeball.
- Presentation impact: the stage's CSS is scoped, its arrangements unchanged — declared to the lane with this wave's relay.

## 1.4.243 — The lock has a voice (2026-11-22)

Oscar's own closing of the lock evening: «Hay una forma de dejarle saber al usuario de que el candado está puesto y cuáles son las consecuencias de eso, porque si las hubiera tenido, no te hubiera siquiera preguntado, porque siempre fue eso y nunca me di cuenta de ese error.» The lock had been holding his copies in silence — its only receipt was a line in a log no one reads in the moment — and every symptom (the empty line, the unswapped keys, the absent drum) presented as some other part failing.

The cure: **a hold announces itself at the moment it happens.**

- When the stage lock holds a copy back (the queue off — with the queue on there is no hold since 1.4.241), a brief toast stands over whatever screen he is on: «The stage is locked — a copy was held back» / «La escena está bloqueada — una copia fue retenida». The state and its consequence, in one breath, at the only moment they matter.
- **Once per setting of the lock**: the first hold after the lock is set speaks; later holds stay silent, so copying five texts is not five announcements. Setting the lock again — off and on — arms the voice again (`setLocked` resets the flag; the flag starts unspoken at the service's birth, so a lock left on across a restart also speaks at its first hold).
- The lock's card keeps the full explanation (1.4.241); the toast is its herald, not its replacement. Nothing else about the lock changes: hand pastes were never held, and are not now.

- Declared bound: shell work — no bench exists for it; the toast rides the same service-context road the blink's «Clipboard is empty» toast already travels. The CI compile is its gate and Oscar's phone the judge.
- Presentation impact: none — no anchor, surface or copy changes beyond the toast's own sentence.

## 1.4.242 — The drum stands in both shapes (2026-11-22)

The same night the stage lock starved his queue (1.4.241), Oscar found the speed drum dead: «¿Qué fue lo que hiciste que ahora ni siquiera está funcionando el botón para acelerar el audio o desacelerarlo?» Nothing shipped that day had touched the drum — the mechanism was older and quieter: since 1.4.207 the drum stood only in the panel's QUEUE shape, because there the transport's − and + keys give their seats to the track keys and the rate needed another home. In the normal shape the rate stayed printed inside the counter's line — «Sentence 6 of 26 · 1×» — as dead text, at the very seat where the drum lives in the other shape. With his line empty all evening, the panel never changed shape, and the «1×» he tapped was print, not a control.

His ruling, when the mechanism was laid out: «Tendrás que hacer que sirva también para cambiarlo desde ahí sin remover el botón de menos y más.» — the drum must work from there too, and the − and + keys stay.

The cure is one condition removed:

- **The rate splits onto the drum whenever the counter's writing carries one** — the last « · » in the sub-line — in the queue shape and the normal shape alike. subV keeps the counting half; the drum rolls the rate (drag loops the steps, a tap steps up, each detent applies live through the Bridge's rate door — the drum's deed since 1.4.207, unchanged).
- **The − and + keys are untouched**: in the normal shape both roads now stand — the keys step the rate from the transport, the drum rolls it from the counter line. One rate, two roads, as the queue shape already had the drum beside its track keys.
- Writings with no rate (a recording's clock, the seek scrub's counting line) carry no «×» after the separator, so no drum stands there — the split's own test, as before.

- Declared bound: shell work — no bench exists for it; the change is a single condition in refreshPanel's sub block plus its comments, verified by reading the seats before and after. The CI compile is its gate and Oscar's phone the judge.
- Presentation impact: none — no anchor, surface or copy changes.

## 1.4.241 — The lock guards the stage, not the line (2026-11-22)

Oscar's report, with two photos: «el botón de copiados en cola no está funcionando… lo toco, lo activo y lo desactivo, pero no funciona… cuando copio texto en cola, no se guarda ni uno solo, por mucho que muestre que está activo.» The panel's queue sheet showed the lever on and the line empty; the transport never swapped to its track keys, because the line never grew.

The diagnosis, in plain words: his stage lock was on. The lock's own card has only ever promised one hold — «a copied text won't replace what you're hearing» — but the shell's delivery door implemented it as a blanket hold: with the lock on, every automatic catch died at the door, queue or no queue. When the queue was born (1.4.198) its arrivals stopped being replacements — they line up and wait their turn, displacing nothing — and the door was never told. His hand pastes still landed (a hand ask was never the lock's business), which is why the line had worked in the morning and silently refused his copies from the chats.

The cure — the lock keeps its promise, exactly:

- **The shell's door** (`deliver`): the lock holds a catch back only when the queue mode is off. The shell now keeps the mode as the page last reported it (`queueModeSeen`, mirrored from the same pushes that feed the panel's count and titles) and consults it at the lock's door. Manual deliveries were never held and are not now.
- **The app's own arrival road** (the visibility read) honours the lock under the same condition: queue on, the read proceeds and the copy lines up; queue off, the lock still holds it, as before.
- **The lock's card now says the whole truth**: locked, a copy won't replace what you're hearing — and with the copy queue on, copies still line up and wait their turn.

- Declared bound: `queueModeSeen` is the shell's last-seen mode from the page's own pushes; before a fresh service's first push it reads off, so a catch in that first breath, with the lock on, would be held once — the panel's first push lands within moments of the bubble's birth. Shell work has no bench; the CI compile is its gate and Oscar's phone the judge. The page half's condition is a one-line gate beside the road's existing lock check.
- Presentation impact: none — no anchor, surface or copy changes beyond the lock card's own sentence, which is the shell's, not the stage's.

## 1.4.240 — The diagonal's line decides (2026-11-22)

Oscar's verdict on the gesture work, the same afternoon it landed: «Has progresado enormemente, donde falta afinar todavía son los gestos diagonales que te llevan a la mitad de la pantalla ya sea a la izquierda o a la derecha. Los gestos son diagonales nada más.» — and, clarified a breath later: he meant the diagonal gestures, only those.

The flaw, measured on the seats themselves: 1.4.236 judged every place within ~45° of the gesture's line by projection alone — nearest for a short flick, farthest for a long one. From a top corner, a short 45° diagonal's smallest projection is the FAR TOP corner: near along the line, but the diagonal does not point at it (it stands ~45° off the gesture). The place the diagonal actually points at is the opposite edge's MIDDLE (~3° off the line from a top corner), with the far bottom corner behind it on nearly the same line (~21° off).

The tuning — the gesture's law gains a tier, nothing else moves:

- **The places on the gesture's own line (within ~23°) are judged first**, by the standing measure: a short flick takes the nearest of them, a long one the farthest. A short diagonal from a top corner now rests at the edge middle it points at; a long diagonal continues to the far corner on that same line. Straight-down and straight-across gestures are untouched — their middles and corners were always on the line.
- **Only when no place stands on the line** does the wider field (~45°, as before) answer, and then with its single best-aligned place — so from the left middle, a down-left diagonal still lands on the bottom-left corner (his original 1.4.235 example, where no place stands on the diagonal's line at all).
- A gesture aimed where no place lies still wins nothing, and the drag gates keep their 400 ms rest (1.4.236) — the gates are not the gesture.

- Declared bound: shell work — no bench exists for it; the geometry was verified by hand against every example Oscar has given (235's three, 236's two conflicts, today's diagonal). The CI compile is its gate and Oscar's phone the judge.
- Presentation impact: none — no anchor, surface or copy changes.

## 1.4.239 — The line keeps the copy order (2026-11-22)

Oscar's law, stated plainly: «¿Cómo se decide el orden de las copias? Por orden de copiado, no por orden de entrada. El primer texto que copio gana su posición para ser escuchado de primero. El segundo, segundo puesto. El tercer texto que copio, tercer puesto y así consecutivamente, en lugar de ir montando de primero los últimos textos. Lo que define el orden de los audios es el orden de los textos copiados.»

One road in the house broke that law — his own deed of 1.4.206: the panel's Paste key, with the copy queue on, asked «Put the last copy first?» and, on confirmation, the fresh copy jumped to the head of the line, took the stage, and the standing current was removed from the line altogether. Every hand paste re-ordered the line by recency — the last texts rode first.

The road is retired, whole:

- **The panel's Paste key** no longer asks about the front. It reads the clipboard, with the queue on or off alike. With the mode on, the page lines the delivery up at the tail in its copy turn; with the mode off, the key is exactly the key it has always been (the copy takes the stage at once).
- **The page's arrival judge** is one road now: every shell delivery — caught automatically or delivered by the hand paste — joins the tail through `queueArrival`. `queueFrontArrival`, `enqueueFront` and the paste-front stamp's readers are gone; the shell's stamp plumbing (companion flag + Bridge door) stands inert and uncalled, declared here rather than silently kept.
- Nothing already in the line is ever displaced or removed by an arrival; an arrival plays at once only when the line has no current and the stage is free — the courtesy the copies have always had.

- Bench: the queue battery + presentation suites and fences are this wave's gates; the panel half (the retired card) is shell work with no bench — the CI compile is its gate and Oscar's phone the judge.
- Presentation impact: none — no anchor, surface or copy changes (the retired card was a shell hint card, never an anchored surface).

## 1.4.238 — The corner controls answer again (2026-11-22)

Oscar's report, over a photo of the panel's queue sheet: «no me permite desactivar la lista en bucle desde la ventana flotante. La toco y simplemente me saca de la lista.» The sheet's lever never asked its question — the tap closed the panel instead.

The mechanism, measured on the seats themselves: the bubble's window lies OVER the panel's corner (1.4.227's re-raise), and since 1.4.234 that window carries 14dp of breathing room on every side for the drawn shadow. The panel seats itself a graze away from the jewel's centre, so the window's touch bounds reach some 16dp into the panel's corner — exactly where the queue sheet's lever and the title row's lock live. A tap aimed at the lever's thumb (its natural target, at the switch's right end) landed on the bubble's window, and a bubble tap with the panel open closes the panel. Before 234 the window was the jewel's own size and its bounds ended where the jewel ends; the shadow's room is what grew the overlap.

The cure keeps both laws: **while the panel stands, the bubble's window wears its visual size** — its touch bounds end where the jewel ends, as they did before 234 — **and the drawn shadow hugs the jewel** (face + 6dp instead of + 18dp; over the panel's own card, the wide fall of shadow is not what is missed). The moment the panel closes, the window takes its breathing room and the full shadow back. Both transitions reseat the bubble in the same act, so the jewel itself never moves a hair — only the window's invisible bounds step back off the panel's corner, and return.

This wave jumped the queue ahead of the diagonal-gesture tuning (which follows as 1.4.239): a control that cannot be touched at all is worse than a gesture that needs tuning.

- Declared bound: shell work — no bench exists for it; the CI compile is its gate and Oscar's phone the judge. The web half of this release is the version stamp only.
- Presentation impact: none — no anchor, surface or copy changes.

## 1.4.237 — The ring retires at the end (2026-11-22)

Oscar's new principle, over a photo of the finished «Sobre sube» (Sentence 18 of 18, the bubble wearing its complete ring): «cuando el aro termina de llenarse porque el audio terminó de reproducirse, desaparece, en lugar de que quede el aro completo con su vuelta… Como ya terminó, no es necesario.» A complete ring resting on a finished reading is a leftover, not information.

The ring now retires when the reading ends. The end is judged on honest signals, never on a guess: the page's push gains **`fin`** — the listen session's own finished flag, set only at a natural end and cleared by any seek or new play — the device voice's panelJson gains **`done`** (its natural-completion witness, the same one its snapshot already carried), and the shell also honours the seat itself standing at the very end (frac ≥ 0.999, not playing), which is how a finished recording reads. On any of them, the ring hides and its seats reset, so the next reading seats it afresh.

The distinction Oscar's principle implies is kept: a **paused** reading carries none of those signals and keeps its ring resting on its seat — the reading is still alive. Only the end retires it. Replay, a seek, or the queue stepping to the next text clears the end flag, and the ring returns with the new reading.

- Declared bound: the shell half has no bench — the CI compile is its gate and Oscar's phone the judge. The page half is one added field in the panel push; the battery and presentation suites stand as its gates.
- Presentation impact: none — no anchor, surface or copy changes.

## 1.4.236 — The gesture measured, the gates meant, the page reborn (2026-11-22)

Oscar's verdict on 1.4.235 was warm — «Lo que hiciste me gustó mucho. Los gestos están funcionando bastante bien» — and it carried two conflicts by the gesture's own nature, plus a third wound from the first:

**One. The down gesture overshot the middle.** Judging direction alone, a downward flick from a top corner fell all the way to the bottom corner: on a tall screen the edge's middle and the far corner stand on the same downward line, and the far one won the tie. His measure: «Si bajo debería quedar en medio y si sigo bajando debería ir hasta abajo… un gesto largo fuera el responsable de bajar hasta abajo, pero un gesto corto de dejarlo en medio.» The flick now has a measure: candidates are the places lying within ~45° of the gesture's line; a **short** gesture (under 130dp of travel) takes the nearest of them along that line, a **long** one the farthest. Down from a top corner: short rests at the middle, long continues to the bottom corner — and the same measure serves every direction (a long diagonal now reaches the far place on its line instead of stopping at the near one).

**Two. The gates ate gestures.** The Remove and Open Logos gates live across the top — exactly the road a left flick from the top-right corner travels on its way to the top-left. His flick swept the Remove gate and the bubble was removed by error: «todavía no hacemos una separación entre el gesto y la oportunidad de llevar la burbuja a cualquiera de estas dos opciones.» The separation is intent, made measurable: **a gate takes the release only when the bubble has rested on it for 400 ms** — a hand that means a gate stops on it; a gesture merely crosses. An unarmed crossing falls through to the gesture judge, so the flick completes its errand. The gates' look is unchanged; only their taking is guarded.

**Three. The black screen after the removal.** Re-entering Logos after the accidental removal showed a black screen that only a force-close could leave. The mechanism: removing the bubble stops its service, whose onDestroy evicts and **destroys** the backstage page (1.4.128's law — a parentless page must not keep speaking) — but the activity may still be alive, and on its next arrival it took the destroyed page home and showed its corpse: black, forever, no reload ever offered. The backstage now counts its evictions; an activity whose page was evicted behind its back **reborns a fresh page in the corpse's seat** instead of reparenting it. The 1.4.128 law stands — the page still dies with the house; it simply no longer takes the next arrival down with it.

- Declared bound: the shell has no bench — the CI compile is its gate and Oscar's phone the judge. The web half of this release is the version stamp only.
- Presentation impact: none — no anchor, surface or copy changes.

## 1.4.235 — The sphere understands the gesture (2026-11-22)

Oscar's order: «Haz que la esfera de widget reconozca el tipo de gesto. Si hago un gesto hacia abajo con ella, quiere decir que se va a su posición más cerca… Si hago un gesto hacia la izquierda, se iría a la izquierda y continuaría en el centro del borde… Si lo hago en diagonal, la esfera se va a la esquina inferior izquierda. Es una forma más inteligente de usar el widget.» His complaint underneath it: a short swipe meant to move the bubble out of the way changed nothing, because the release was judged only by where the finger stopped.

- The bubble now reads the gesture's KIND. A **short, quick swipe** (at least 24dp of travel, under 400 ms, moving faster than a careful drag) is a flick: it names a direction, not a point. On release the sphere glides to the predetermined place that lies most nearly **in that direction from its current home** — down one step on its own edge (top corner → edge middle → bottom corner), across to the other edge on its own row, or diagonally to the place the diagonal points at (from the left middle, a down-left flick lands on the bottom-left corner, as he described).
- A gesture aimed where no place lies — up, from a top corner — wins nothing: the sphere stays home.
- A **long, unhurried drag** keeps the 1.4.233 law: carried by the hand, it rests at the place nearest the release point. A drop on a drag gate (Remove / Open Logos) still belongs to the gate — the flick is judged only when no gate is targeted.
- Declared bound: the shell has no bench — the CI compile is its gate and Oscar's phone the judge. The web half of this release is the version stamp only.
- Presentation impact: none — no anchor, surface or copy changes.

## 1.4.234 — The shadow without the square (2026-11-22)

Oscar's find, with two close-ups of the bubble against a light wall: «se ve el cuadrado de la sombra, precisamente porque hasta ahí llega el corte del ícono flotante. No quiero ese cuadrado… no se ve terminado o premium.»

- The diagnosis: the bubble's window was exactly the bubble's own size, and the face's elevation shadow spreads wider than that — so the window's square bounds clipped the shadow, and the cut showed as a straight-edged square around the jewel on light backgrounds.
- The cure retires the elevation shadow entirely. The shadow is now **drawn**: a soft black oval under the face that fades to nothing (three-stop radial falloff), seated a breath below centre where a real shadow falls. And the bubble's **window grows by 14dp on every side** — pure breathing room — so the drawn shadow falls and fades entirely inside it. No elevation, no clip, no square.
- The jewel itself does not move: seats are still computed for the visible span exactly as 1.4.231/233 settled them, then shifted by the breathing room, so the λ lands in precisely the same place in all six homes; centres everywhere (panel graze, drag settle, gate hover) are read off the window's centre, which is the jewel's centre.
- Declared bound: the shell has no bench — the CI compile is its gate and Oscar's phone the judge. The web half of this release is the version stamp only.
- Presentation impact: none — no anchor, surface or copy changes.

## 1.4.233 — Six predetermined places (2026-11-22)

Oscar's order, with his photo of the bubble dragged to the left edge's middle: «Hay dos posiciones en las que me encantaría también que la burbuja se posicione determinadamente y es a mitad de la pantalla en su respectivo borde… Entonces serían seis lugares predeterminados.»

- The bubble's home widens from four corners to **six predetermined places**: the four corners plus the middle of the left edge and the middle of the right edge (seats 4 and 5). Its memory still NAMES the place (the same prefs key, widened), and every seat is re-measured against the real screen each time: a middle seat's height is the screen's own middle, `(height − bubble) / 2`, on whatever screen the phone has today.
- The old fraction memory, on its first run under the widened law, names its nearest of the six (top band → corner, bottom band → corner, middle band → edge middle) — his habitual right-side spot, a little above centre, now lands on the middle-right seat instead of a corner.
- Release anywhere: the bubble glides to the nearest of the six seat centres.
- The panel reads its arrangement off the seat as before — its side from the seat's side, its unfold direction from the seat's row. A middle seat has no row of its own: the panel unfolds **below** when its natural height fits below the graze, else **above** when it fits there, else below with the words window yielding (the 1.4.222 law) — judged against the same screen every time, so a middle seat gives the same arrangement every time too. The grip rides the free corner exactly as before.
- Declared bound: the shell has no bench — the CI compile is its gate and Oscar's phone the judge. The web half of this release is the version stamp only.
- Presentation impact: none — no anchor, surface or copy changes.

## 1.4.232 — The queue asks in both houses (2026-11-22)

Oscar, from the Listen page's own queue sheet: the X's remove
without asking, the little book saves without asking, and the
lever turns the queue off without asking — while the floating
panel's list asks before all of its deeds. And his follow-up,
with the panel's list in hand: what stands in one house stands
in the other, so whoever learns one surface already knows the
other — and the panel's list lacks the little book entirely.

- The app sheet now asks, in the panel's own words, in the
  app's one question window: removing a row ("Remove from the
  queue" — "“title” will leave the line."), saving one row
  ("Save to Listen later" — "“title” will be saved in the
  Library to hear later."), emptying the line ("Empty the
  queue" — "Every text in the line will be removed. What is
  playing keeps playing."), and the lever both ways ("Turn on
  the copy queue?" / "Turn off the copy queue?", the off card
  saying plainly that the line will be erased). A declined
  question changes nothing — the lever stays where it stood.
- The panel's queue list gains the little book per row — the
  Lucide book-down drawn in the row's muted tone, for copied
  texts only (books and recordings already live in the
  Library, as in the app since 1.4.229). Tapping it opens the
  panel's quick confirmation card with the same words, and the
  confirmed deed travels a new stamped road
  (queuesaveitem → bubbleQueueSave) to the page, which saves
  that one item to Listen later. The push now also carries
  each item's kind (qk) so the shell knows which rows earn
  the book.

Presentation impact: none — no anchor moved; the sheet's
controls keep their seats, only their deeds gained the
question, and the panel's list is shell furniture.

## 1.4.231 — The bubble's home is a corner (2026-11-22)

Oscar's ruling, with five screenshots of the panel standing over
another app in several different arrangements: the bubble does
not stay in its corner. It overlaps the window in one shot, sits
under it in another, takes a different corner each time — "a
veces es random y así no se puede". His diagnosis: the app does
not have his phone's screen mapped, so it does not know where
to sit. And his retraction, in his own words: the rule that the
bubble stands above when it is in the centre — the mid-room
rule of 2026-11-10 — was his own error; "eso no es así". The
bubble should always be in the corner where it belongs.

He is right on both counts. The bubble's memory was a pair of
screen fractions — a position measured against whatever screen
the day it was saved, re-measured against today's — and the
panel derived its seat from wherever that left the bubble, with
the mid-room branch inventing a third arrangement when the
bubble rested mid-screen. Three arrangements, no fixed point:
from his seat, random.

- The bubble's home is now NAMED, not measured: it remembers a
  corner (top-left, top-right, bottom-left, bottom-right), and
  the seat is computed from that corner against the real screen
  at the moment of seating — at birth, on every panel opening,
  on every configuration change. The old fraction memory names
  its nearest corner on first run and is never used again.
- The hand may still carry the bubble anywhere; where it rests
  is the nearest corner, gliding there on release, and that
  corner becomes its remembered home.
- The panel's seat is read off the bubble's corner: a top
  corner hangs the panel below the graze, a bottom corner
  raises it above — with a new seatAbove mirroring 1.4.222's
  seatBelow, so the words window yields the overflow toward
  the top exactly as it already yielded it toward the bottom,
  and the graze outranks the fit in both directions. The
  mid-room branch is deleted. Same corner, same arrangement,
  every time; the bubble's window still outranks the panel's
  (1.4.227), so the λ sits whole on its corner of the card.

Declared bound: while the panel stands open the bubble does
not change corners on its own — a new corner is chosen by the
hand, by dragging the bubble there (the panel follows).

Presentation impact: none.

## 1.4.230 — No white holes (2026-11-22)

Oscar's report (09:57, photo): the white rectangle is back — the
visualizer's seat in the Listen player standing pure white — and
he has also seen the splash flicker toward a white window. His
verdict: it is the same problem. He is right about the family:
a surface that should wear the app's dark ground showing white
instead. Two seats, two cures.

- The visualizer's white seat is the defect of 1.4.196 returned.
  Its canvas is handed to a worker through OffscreenCanvas — a
  one-way door: once transferred, the page can never draw on it
  again, and a transferred canvas whose worker has not painted,
  or whose surface the system discarded under pressure, shows
  the compositor's white backing. The 1.4.197 watchdog cured the
  never-paints case; this return walked around it (a surface
  lost after the first frame is no watchdog's witness). The road
  itself is retired: the visualizer draws on the page's own
  thread, as the fallback always did. A plain canvas unpainted
  is transparent over the dark card — it can be plain, never a
  white hole. The worker file remains as a tombstone. Declared
  trade: under heavy synthesis load the bars may drop a frame;
  they did the same on every fallback day since 1.4.197 and the
  seat never sat white.
- The boot white: the document itself carried no ground — only
  the splash div was painted inline, so any frame shown before
  the app's stylesheet lands (cold start, a service-worker
  reload between versions) fell to the browser's default white.
  The document now paints its ground inline in the head style,
  keyed to the theme the boot script settles: #09090d dark,
  #f5f1e8 light. No frame of the app's life can be white now:
  not before the splash, not between the splash and the app.

Presentation impact: none — the visualizer keeps its element,
its class and its anchor; only its drawing hand changed.

## 1.4.229 — The line takes the Library in (2026-11-22)

Oscar's word (09:10, with a photo of a book's menu): to make the
queue far more useful, add the option to place files or books in
the line from the Library, so they wait one below the other to
be played.

- «Add to the queue» now stands in both Library menus — a book's
  menu (under Continue reading) and a file's menu. The deed turns
  the queue mode on when it stands off (a line that is not
  registering is no line to join), lines the resident up behind
  whatever waits, and starts it at once only when the stage is
  free — the courtesy a copy already receives.
- The line's record learns two new kinds beside the copy: a book
  and a recording carry only their Library name, fetched when
  their turn comes. A book plays by the book road — the whole
  book as one session, opening at its own saved place, a finished
  book from its start, its progress writing back to the shelf.
  A recording plays by the Library's road — from where it was
  left, a finished one from the top. A text file lines up as the
  text it is. A resident deleted before its turn is stepped over:
  the line never stalls on a ghost.
- Both finish judges now serve the mixed line: a reading's end
  (the book item's key is re-noted with the staged text's key
  when it takes the stage) and a recording's end (a new clip-end
  judge, with the orphan judgment the text road already makes).
- «Send to Listen later» keeps its promise honestly in a mixed
  line: only the copies move house — books and recordings already
  live in the Library, so they simply go home when the line
  empties; the per-item save key likewise stands only on copies.

Presentation impact: two anchors minted in canon — lib-menu-queue
(C-122) and bk-menu-queue (C-123), MINT, in the menus' own files.
Relayed to the Presentation lane.

## 1.4.228 — The main player follows the floating one (2026-11-22)

Oscar's word (09:05): in the main Listen player, while the
copy-queue listening stands, the 15/30 jump keys must become the
previous/next track keys, exactly as the floating panel already
does — two important icons hold the row's ends in that view, so
the jumps have no seat there. When he turns queue listening off,
or the line is emptied, the jump keys return with whatever
seconds Settings holds.

- The swap condition mirrors the panel's own: the line stands
  when the queue mode is on AND the line holds texts
  (`copyQueue && items.length > 0`). Turning the mode off erases
  the line (1.4.198), so both of his return conditions are this
  one count.
- The track keys wake only while a queued text holds the stage
  (`currentId` set) — pressed otherwise they could do nothing,
  and a key that does nothing is worse than no key. They step
  through `stepQueue`, the panel's own road: past the end a press
  is claimed and rests; before the start it replays the current
  text.
- The seats keep their names (`listen-prev` / `listen-next`) —
  the anchors name the seat; its deed gains the queue mode.
  Faces: Lucide SkipBack / SkipForward, filled, in the jump
  keys' own seat classes.

Presentation impact: the stage fiction renders its own transport
keys and holds no queue, so the fiction stays truthful as it
stands; the real seats' deed gaining a mode is declared here and
relayed to the Presentation lane.

## 1.4.227 — The bubble sits ON its window, never behind it (2026-11-22)

Oscar's standing complaint, sharpened by two more photos: «sigue siendo el posicionamiento de la burbuja… donde sí tiene espacio no debería mostrarse detrás de la ventana, sino muy bien posicionada». The seat geometry was already honest (1.4.222 made the graze outrank the fit), but the panel's window is BORN AFTER the bubble's, so Android paints the card over the jewel: the bubble's lower cap slid under the panel's top edge in every territory, however well the corner seated. The cure is rank, not geometry: the moment the panel is born, openPanel re-raises the bubble's window above it (removeView + addView with its own params), so the settled graze now reads as what it always meant to be — the λ enthroned ON its window, whole in its corner — while any later window (a hint card, a drag target) still rises above them both. The bubble's own placement never moves; only who paints over whom changed. Presentation impact: none.

## 1.4.226 — The ring eats from the device voice's table too (2026-11-22)

Oscar, on 1.4.225: «Nada. Ni siquiera se muestra el anillo en ningún texto avanzando.» He was right, and the miss was mine: the smoothing cured the jumps for the page's own voices, but the ring had a second, older starvation I had not seen — it read only the page's pushes, and while the DEVICE voice speaks (the shell's own NativeSpeaker), the page's session is not the driver, so its pushes stop feeding the ring. The panel lived through those same readings because it reads NativeSpeaker.panelJson() on that road; the ring had no such road and never showed at all. The ring now takes its seat from the same source the panel uses: while NativeSpeaker is active, panelJson (which carries frac with word-level progress, ci, ct, playing) feeds updateBubbleRing, and the 225 extrapolation smooths those seats the same way. Presentation impact: none.

## 1.4.225 — The ring runs smooth; the logo a breath smaller (2026-11-22)

Two of Oscar's asks from one photo. (1) THE RING, SMOOTH: the bubble's progress ring «no estaba corriendo… y cuando corre lo hace a tropezón». Convicted in the chain: the ring drew the pushed fraction raw, and that fraction arrives in steps — a word at a time from the page's voices, a whole sentence at a time from the device voice — so the arc froze for stretches and then jumped. The ring now works like the shade card's (the 1.4.196 recipe, brought to the bubble): each new seat teaches it its pace (an averaged velocity from the seats themselves), a 33 ms ticker extrapolates the drawn arc between seats, capped at the end of the sentence being read so it can never run ahead of the voice; a seek or a new text re-seats it exactly, and a pause rests it on the seat. (2) THE LOGO, A BREATH SMALLER: «Todo está excelente, no te pido que lo cambies — solo disminuye su tamaño al menos un seis por ciento para que se centre mejor en la esfera.» The vector composition now draws at 92% of the face — the geometry untouched, by his word. Presentation impact: none.

## 1.4.224 — The number he sets is the only number (2026-11-22)

Oscar's photo and question: the bubble stood ghosted at a whisper while its transparency slider read 100% — «¿por qué, si literalmente le estoy diciendo que no sea transparente?» The cause was a second, hidden amount: «Dim when idle» multiplied his setting down to 15% (phone) / 45% (tablet) after four seconds untouched. His ruling, in full: at 100% the bubble never fades — and in principle, «la cantidad de desvanecimiento que yo pongo manualmente debe ser la misma, sin datos contradictorios… de otro modo sería como no darle al usuario poder completo sobre la burbuja». The automatic whisper is therefore retired altogether, not merely capped: the fade timer, its 0.15/0.45 depths and the «Dim when idle» switch are gone from the shell, the bridge and Settings (a stored bubbleFade in old settings/backups now rides inert and is no longer restored). The bubble wears exactly the opacity its slider sets, at rest and at work; the one other hand on it remains his own 1.4.197 order — while the panel stands open, the bubble wears the panel's set opacity. If a resting fade ever returns, it will return as a number he sets himself. Presentation impact: none (the retired row carried no anchor and no stage mirror).

## 1.4.223 — The Splash's own logo, drawn as vectors in the bubble (2026-11-22)

Oscar's photo and ruling: the bubble's λ still showed one leg fat and the other thin, and the fix was already solved — «implementarlo en la burbuja tal y como está en el Splash. Incluso puedes añadir las ondas al lado.» He was right about the cause too, in effect: both stencil waves (219, 222) read the letter's SHADING as coverage — an alpha mask built from luminance fattens the leg the artwork lights and starves the leg it shadows. The stencil road is abandoned. The bubble's LambdaView now draws the logo's own VECTOR geometry, transcribed 1:1 from public/logo.svg (the same paths the splash draws): the λ as two filled subpaths (the group's translate folded in) and the two sound arcs as round-capped strokes (each SVG arc re-expressed as an arcTo on its measured centre — r146 about (270.3, 268), r190 about (281.4, 268)); the 512 canvas maps onto the face, keeping the icon's proportions. The gold families (Legacy, and Light — the jewel is dark in both) wear the logo's own gradient (#fbe3b0 → #e9bd72 → #b9843a, the SVG's stops); Tron and Cyberpunk wear their accent flat — the geometry is the logo's in every family. The transcription was verified by rasterizing the SVG and the Kotlin numbers side by side: 42 of 22,671 ink pixels differ (edge rounding only). The raster stencil machinery in BubbleService is deleted; PlaybackService's medallions keep their seats, untouched. Presentation impact: none.

## 1.4.222 — The graze outranks the fit; the letter at its true weight (2026-11-22)

Two of Oscar's photo findings. (1) THE BURIED BUBBLE: with a tall panel and the bubble seated high, the panel's top edge cut through the bubble's lower half — «se queda ahí abajo» — instead of the bubble resting on its corner. Convicted in positionPanel: the bottom-fit clamp (`coerceAtMost(sh2 − ph − margin)`) dragged the panel UP over the bubble whenever the panel's full height did not fit below the graze seat. The graze is now sacred: a new seatBelow() keeps the seat and makes the WORDS window give up the overflow (it scrolls internally, the amber word stays centred) down to a 36dp floor, restoring its natural height whenever the room allows (every seat is judged against the natural height, phNat); only a panel too tall for even that falls back to the old clamp, saving its footer as a last resort. Sibling cured in the same wave: a panel whose words ARRIVE after seating now re-seats too (only the words-vanishing road re-seated before). (2) THE LETTER'S WEIGHT: the bubble's λ read thicker than the app icon's and off-centre. Measured against the artwork itself: the composition's true bounds are x 188..375, y 122..279 (letter 188..321 + its wave 357..375 as one group) — the borrowed crop ran 59px too wide on the right, parking the letter left of centre with the wave at the rim — and the stencil's soft ramp (floor 70) let the artwork's luminous halo pose as ink at up to two-thirds strength, fattening every stroke. BubbleService's stencil now crops the true bounds and ramps from the glow's ceiling (135, full at 195), tracking the letter's body. PlaybackService's medallion crop is untouched — a different seat, approved there. Presentation impact: none.

## 1.4.221 — The counter line, painted honestly (2026-11-22)

Oscar's find, from his own panel: «La línea de sentence count y el número exacto de velocidad desaparecen cuando el texto comienza a reproducirse. Solamente aparecen cuando traigo la barra de progreso a cero.» The cause, convicted in refreshPanel: the sub-line's diff block recorded `shownSub` on every push even when no panel stood — refreshes run with the panel closed — so a panel born mid-reading believed its counter line already painted and stood empty until the sentence string changed; dragging the seek bar painted it only because the scrub writes the line by hand, bypassing the diff. The title two lines above had always kept the honest discipline (a value is remembered as shown only when a living view received it); the sub block alone had skipped it. The cure gives the sub block the same discipline: `shownSub`/`shownSubMode` are recorded only inside the living view's reach, so a closed panel remembers nothing and the newborn panel paints its line in full at its first refresh — counter and rate drum alike (the drum's seating lived in the same block). Shell-only change; CI is the gate, Oscar's phone the judge. Presentation impact: none.

## 1.4.220 — The bubble breathes; the ball back to its size (2026-11-22)

Oscar's yes to the offered breath, with his condition attached: «que la burbuja respire… pero recuerda reducir su tamaño para que no cubra todo el reproductor de notificaciones». Two changes. (1) The breath: while the bubble floats idle, its halo now swells and settles on a slow lung — 3.4 s each way, alpha 0.16→0.40 with a breath of scale to 1.13 — implemented as the halo's idle state in BubbleService (startBreath/stopBreath). Precedence is the halo's standing order: the 1.1 s playing pulse outranks the breath, the invite/cheer ripples borrow the halo and hand it back (their ends resume the breath), and a system set to no motion (animator duration scale 0) gets none. (2) The palette disc returns to r=160 — the size Oscar had already called good («estaba bastante bien como estaba antes») — with the λ at 212; the amber now rides on 218's pre-compensated gold rather than on the disc's size, so the ball no longer covers the system's player. Declared calibration: if his phone reports the bar slipping back toward orange at this size, the disc steps back up — his screenshot is the instrument. Presentation impact: none.

## 1.4.219 — The medallion, refined: a smaller ball, the true letter (2026-11-21)

Oscar's verdict on 218 came with two refinements. (1) The colour landed — «se ve mucho mejor… la misma barra de avance» — but the palette disc at r=230 stood too large behind the system's player: «la bola está demasiado grande… reducida de tamaño». The disc settles at r=190 (the λ at 252 wide): the pre-compensated gold still owns the extraction, the ball reads smaller. (2) The floating bubble's central letter was a serif typeface's λ — a cheap stand-in beside the app icon's letterform («una versión más barata y pobre del logo… es solo la letra»). The bubble's face now draws the TRUE λ: the same artwork stencil the shade card's Ring wears (BubbleService gains the stencil recipe — the artwork's crop as an alpha mask), tinted with the family's ring colour in a new LambdaView; the serif glyph survives only as the fallback if the artwork cannot be read. The bubble's ring, ground and colours are untouched — only the letter changed seats. Asked and answered in the delivery: a breathing animation and fireflies behind the SYSTEM's player are not possible — that surface renders a still image and no app can animate it; the breathing life can only live on Logos's own surfaces (the bubble), offered, not built unasked. Presentation impact: none.

## 1.4.218 — The palette face, recalibrated (2026-11-21)

Oscar's verdict on 1.4.215: the system player's bar was still orange. His screenshot also carried the proof of what did land — the panel's background was already the medallion, so the metadata art reaches the panel; what fails is the extraction's arithmetic. Samsung's new player paints a waveform whose colours are extracted from the artwork with their saturation driven up, and Legacy's pale gold at full saturation is precisely that burnt orange; a disc of the pure accent feeds the same result. The recalibration, in paletteArt only: (1) the disc grows from r=158 to r=230, so the gold family owns the canvas and the dark ground's browns leave the extraction; (2) the disc wears a pre-compensated gold — paler and a breath yellower than the accent (Legacy rgb(243,208,141); Light lifted to rgb(198,148,66)) — chosen so the system's saturation lands on amber instead of overshooting it. The already-saturated families (Tron, Cyberpunk) wear the pure accent unchanged. The λ grows with the disc (300 wide), still in the ground's colour. The notification's face is untouched: the Ring stands. Presentation impact: none. Declared bound, as with every extraction wave: the mapping is the system's own and Oscar's phone is the judge; if the bar still overshoots, the compensation steps further in the direction his screenshot reports.

## 1.4.217 — The lock, a shade smaller (2026-11-21)

Oscar's phone judged 1.4.216's drawn lock: the theme is right, the size overshot by a shade — «puedes hacer el candado ahora un poquito más pequeño, pero un poquito». The lock's grid unit steps from 1.15× to 1.07×: still a touch larger than the bookmark and the book beside it (the standing order from the same evening), no longer the largest face on the row. One number in BubbleService.kt, plus the version stamps. Presentation impact: none.

## 1.4.216 — Cerca: the drum beside the counter, and the lock joins the theme (2026-11-21)

Oscar's two panel orders. (1) The speed drum exiled at the sub-line's far end moves close to the sentence counter: three distances were rendered on one base and he picked «1 · Cerca» — the counter now hugs its own words (its weight is gone) and the drum stands ~14dp after the last digit (a 4dp margin plus the drum's own left padding), close with air, so the numbers never blur into each other. The wheel itself is untouched: drag rolls, tap steps. (2) The stage lock was the panel's last emoji — a 🔒 TextView at 10.5sp sitting beside two gold line-drawn keys; Oscar saw it drawn in the mock in the theme's own line and ordered it so («por fin el mismo tema»), a touch larger: the lock is now a glyphDiscKey drawing the Lucide lock (shackle closed, or open while unlocked) at a 1.15× grid unit, and its state changes repaint instead of swapping emoji.

- BubbleService.kt only, plus the version stamps. The lock's field is a View now; showLockHint and refreshPanel invalidate it where they once set its text.
- Presentation impact: none — the panel is the shell's own surface; no page, anchor or fiction seat is involved.
- Numbering note: this wave carries the pick Oscar made as «214» and ships as 216, because 215 (the system player's accent) went out first; the version never walks backwards.

## 1.4.215 — The system player's bar wears the theme's accent (2026-11-21)

Oscar's photo of the system's media panel (the «This phone» player): its progress bar stood in a burnt orange-red, and he ordered it amber — Legacy's colour — adjusted to the theme. Diagnosis, verified in the shell: the notification already carried `setColor(accent)` since 1.4.196, but the system's media panel does not take its scrubber colour from there — it extracts a palette from the session's artwork, and the artwork was the Ring: nine-tenths dark ground with the accent in fine strokes, whose extraction Samsung saturates into orange.

- The session metadata now carries its own face (`paletteArt` in PlaybackService.kt): the medallion — a full disc of the theme's pure accent with the λ standing in the ground's colour, over the family's ground and halo — so the palette's dominant vibrant colour is the accent itself in every family (Legacy gold, Light's deep gold, Tron's cyan, Cyberpunk's pink). Cached per family; any drawing failure falls back to the card's face.
- The notification's large icon is untouched: the Ring remains the card's face exactly as designed. Only the metadata's two art keys changed seats.
- Presentation impact: none — no page, anchor or fiction surface is involved; the change is entirely in the shell's session metadata.
- Declared bound: the extraction is the system's own; this wave attacks the mechanism with the strongest palette the design allows, and Oscar's phone is the judge, as with every shell wave.

## 1.4.213 — Create, in three trays (2026-11-21)

Create's first design treatment. Oscar asked for the page's buttons and chips to be treated under the wrap law («la forma no es esclava de la función»); three directions were rendered with his real text and judged on his phone, and he chose **B — Three trays** «cleaner and more professional by far», with the refinement that ornaments repeating what is already said (initial medallions beside names) are not wrap but noise — the wrap is not minimalism, but it is sharply not maximalism.

- The page now groups by territory under small gold caps labels, in sunken trays wearing the Settings clusters' paint (theme variants included — Tron keeps its lit fillet, Cyberpunk its flat top fillet): **The text** (the editor card, unchanged inside) · **The voice** · **The output**.
- The voice chips obey an even three-column grid — every chip the same width, no ragged wrap and no orphan «More…» row. The chosen voice answers beneath the grid as a gold-rimmed bar (the voice's own tile, name, accent badge, tagline) and gains the picker's own preview button, so the chosen voice can be heard before rendering; the auto-detect line rests at the card's foot.
- The output tray divides Speed · Format · Title with hairlines; above Generate, a quiet summary line speaks the whole deed: words · ≈ duration · format · voice (accent).
- Presentation impact: the stage's Create fiction mirrors the three trays (its cards now stand under The text / The voice / The output labels; the Generate and fx seats stay in the output card). No anchor moved; the preview button in the real page's chosen bar carries no anchor (the picker's PreviewBtn gained an opt-out, its own anchor untouched).

## 1.4.212 — One button, one face (2026-11-21)

Oscar's eye, twice in one evening. First: the bubble panel's ⚑ flag and the
app Listen player's bookmark do exactly the same deed — both file a mark at
the current moment — so they must wear the same face. Second: the app's Save
button (a bookmark with a small +) was a near-twin of the mark and could be
mistaken for it; Save needed a face of its own. After three rendered rounds
(the book that receives, its reinforcements, and a fresh no-book round),
Oscar chose the first design: **the book that receives** — a book with an
arrow entering it (Lucide BookDown, the app's own icon set).

- Panel (BubbleService): the mark key's ⚑ text glyph is gone; a new
  glyphDiscKey helper draws the **bookmark** on the app's 24-grid in the
  disc's gold, same 24dp disc, same deed (showMarkHint). The save key's
  bare "+" is gone; the same helper draws the **book that receives**.
  The mark's teaching card no longer names a flag («The mark» / «La
  marca»; "It marks this moment…" / "Marca este momento…").
- App (ListenPage): every Save seat trades BookmarkPlus for BookDown —
  the editor head (listen-save, 21), the queue rows' save-to-later (17),
  and the reader head (listen-reader-save, 13, word kept). The mark
  button already wore the bookmark; nothing about any deed changed.
- Presentation: the stage fiction's two Listen save glyphs wore a generic
  floppy (Save); they now mirror the app's chosen face (BookDown). No
  anchor moved — listen-save and listen-reader-save name the same
  elements. The lesson player's own save-record button (BookmarkPlus in
  presentation-player) is a different deed and was left alone.

## 1.4.211 — The wheel comes to the app

Oscar (2026-11-21): for balance, the app's own Listen screen
changes speed the same way the bubble learned in 1.4.207 — the
chip keeps its face (the gauge, the number), and the number is
the wheel: drag up or down to roll the speeds in a loop, a tap
to step up. «Ya no necesitamos la tarjeta de speed» — the app's
Speed sheet is deleted.

- **The chip is the wheel.** Pointer drag with capture, 26 px
  per detent as in the bubble; each detent steps the ladder
  [0.75 … 2] with wrap, applies at once through setRate, rolls
  the number in from the side it came (110 ms), and ticks
  (navigator.vibrate where the surface has it). A press with no
  detent is a tap: one step up. Keyboard activation (detail 0)
  also steps up, so the button stays a button. An off-ladder
  rate (set finely in Settings) seeds the wheel at its nearest
  rung. The chip keeps its class, its aria name, and its seat.
- **The Speed sheet is deleted whole** — its preset chips, its
  fine slider, and its note. A finer rate still exists: the
  Settings slider (0.5–2.5) is untouched, and the wheel steps
  from wherever it stands.
- **Presentation impact: real, and integrated in this wave.**
  The sheet's anchor (listen-speed-sheet, A-35) is retired with
  lineage; the stage fiction loses its speed sheet, the stage
  chip now shows the fiction rate and a performed tap steps it
  (stageStepSpeed), and AD4's speed scene is re-anchored to the
  chip and rewritten to teach the wheel truthfully — tap steps
  up, drag rolls the loop, fine values live in Settings. A
  relay goes to the Presentation lane with this wave.

## 1.4.210 — The queue's door stands

Oscar, from his phone (2026-11-21): reopening Logos, the copy
queue's icon was gone — because the queue stood off in Settings.
He does not want it to disappear: the door must stand even when
the queue is off, and tapping it should let him turn the queue
on right there, with the switch the queue's own card already
carries, without a trip to Settings.

- **The Listen player's queue chip is unconditional now.** It
  used to render only when the queue was on or the line held
  texts — vanishing in exactly the state where it is needed,
  since the sheet behind it is where the switch lives. Off and
  empty it wears the bare icon (no count, no accent); the count
  and the accent still come with the line. The sheet itself is
  unchanged: its «Queue what I copy» switch, its explanation,
  and the line were already there — they were simply
  unreachable when the door hid.

Presentation impact: none — the chip and its seat already exist
(the stage's Listen fiction carries no queue chip and no anchor
record claims it); the change only removes a render condition
in the real page. No relay owed.

## 1.4.209 — The queue sheet, right-sized

Oscar, from his phone (2026-11-21): the queue sheet's back arrow
is retired — a tap outside the sheet is the way back — and the
on/off lever takes the arrow's seat at the head row's right end;
and the sheet had grown to fill the whole screen over three
texts, where before it hugged its content.

- **The arrow is gone; the lever sits at the right end.** The
  head row is now the count (taking the slack) and the lever.
  Tapping outside the sheet while it stands open closes the
  sheet alone (before, an outside tap collapsed the whole
  panel); the footer's queue key still toggles it too. The
  phone's back key belongs to the app underneath a floating
  window — Android does not deliver it to the panel — so the
  outside tap is the sheet's way back, and it is now exact.
- **The sheet is the card's size again.** The 205 one-piece
  glow was a MATCH_PARENT child of the sheet: a content-less
  view with a match-parent height claims the window's whole
  measure for itself, and the sheet — and the panel window —
  stretched to the screen. The glow now rides in the sheet's
  background as a layer over the base gradient (a background
  never takes part in measurement), painting the identical
  light; and while the sheet stands open, toggleQueueList pins
  the window's height to the card's own height, so nothing
  inside the sheet can stretch it again. The colours Oscar
  praised are untouched — only the size is cured. The empty
  line's off text now points at the lever above it, not at
  Settings.

Presentation impact: none — the change is shell-side (the
panel's queue sheet); no page element, anchor, or flow moves.
No relay owed.

## 1.4.208 — The splash's understudy (the white block, cured the spectrum's way)

Oscar, opening the app: for a moment, very briefly, the splash screen's icon and animation turned into a white block — «tal y como estaba el bloque del espectro antes, pero esta vez para el splash screen». The shell's own frames are all dark by construction (the system splash background, the window, and the WebView's background are all #0A0A0F), so the block was born inside the page's splash itself: the medallion is a 240×240 animated layer whose entrance animated a blur over its whole face — the same family as the spectrum's block before 1.4.197: when that layer's frame is not ready, the phone shows the empty block for an instant.

- **A static twin under the animated mark.** An identical, self-contained, animation-free copy of the medallion (its own gradient defs, the birth seat, the resting arcs) now stands exactly beneath `.sp-mark`, sharing only the cheap lift transform. If the animated layer ever drops a frame, the twin shows through: the worst case is a still mark for a blink — never a white block. Proven on the bench by hiding the animated mark outright: the twin carries the whole medallion alone.
- **The blur is out of the entrance and the exit.** `spFadeIn` is a plain fade now (no `filter: blur(8px)` over the medallion), and the splash's exit no longer blurs the full screen — opacity and scale only. The blur was the heaviest paint on the layer at the coldest moment of the app's life.
- **Presentation impact: NONE** — index.html's splash only; no page element, anchor, or stage fiction changes. No relay owed.

Web-only wave (index.html + version stamps), as 204/203/199/195 — the shell reads the page live, so no APK is owed. The block itself is a compositor frame-drop on Oscar's phone and cannot be reproduced on the bench; the bench proves the understudy stands complete in the animated mark's place.

## 1.4.207 — The speed wheel (Oscar's combination lock)

Oscar's verdict on 205's speed card, with his phone's photo of it: the buttons were excellent, but the card is «ancho e innecesariamente espacioso» — his replacement design, verbatim in spirit: run the speed the way the numbers run on a combination lock; rotating the number like a gear takes no extra space and opens no window — drag down or up and the speeds roll in a loop. «Eso sí sería interesante de ver y más sencillo.»

- **The card is gone.** `showSpeedCard` is deleted whole; nothing opens. The counter's «▾» cue goes with it.
- **The drum.** In the queue shape, the rate leaves the counter's writing and stands as its own drum at the end of the sub-line: the counter keeps the counting half («Sentence 5 of 10»), and a gold bold `rateV` at the row's end carries the rate alone. Outside the queue shape — or whenever the writing carries no rate (a clip's time line) — the drum hides and the counter carries the whole writing, exactly as before 205.
- **The roll.** A vertical drag on the drum turns it: every 26 dp of travel is one gear detent — up raises the rate, down lowers it, and the loop never ends (past 2× comes 0.75×). Each detent rolls the new writing into the window from the side it came (110 ms), ticks under the finger (CLOCK_TICK), and applies live through the Bridge's absolute-rate door — the same `ratePick` stamp the card used, so the page half is untouched since 204. A tap with no detent turned nudges one step up.
- **Honest paint while rolling.** While a hand is on the drum (`wheelLive`), pushes never repaint it — the drum shows the hand's own rolling; the standing step re-syncs from the counter's witness on the next push after the hand lifts. The drum's step seeds from the rate the counter witnesses (`currentRateFromSub`, kept from 205) and thereafter from the pushes themselves.
- **Presentation impact: NONE** — the panel is shell-native; no page element, anchor, or stage fiction changes. No relay owed.

Shell-only wave (BubbleService.kt) plus the version stamps; the page is untouched. The drum's feel — detent size, roll, tick — is judged on Oscar's phone; CI is the compile gate. (First CI run failed honestly: the pushed sub is a nullable String, and the split called methods on it bare — cured by judging a non-null witness copy inside the block; run 128 green.)

## 1.4.206 — The queue's own lever, and Paste now jumps the line (Oscar, 2026-11-21)

Two orders from Oscar's photos of the 1.4.201 panel, built the same evening 1.4.205 landed. Presentation impact: NONE — no anchor moves, no registry change; no relay owed.

- **The queue's own lever.** In the queue sheet's head, after «Copy queue · N» and before the back arrow, a small switch in the Auto lever's face (same scale, same gold) turns the copy-queue mode on or off without a trip to Settings — and the footer's queue key is untouched, as he ordered. A tap does not flip it: the lever steps back and a short card asks first. Off: «The line will be erased, and copies will stop lining up — a copy will take the stage as it did before.» On: «What you copy will line up and play one text after the next, instead of replacing what is playing.» Only the card's answer flips the lever and pokes the page (new verbs queueon/queueoff, judged in runCollected beside clearqueue — they act on the setting, never on a session; the mode's own settings watcher performs the erasure, here as everywhere). The lever follows the page's pushed truth in syncQueueUi, guarded for three seconds after a hand flip so a stale push cannot revert what his finger just decided.
- **Paste now jumps the line.** While the mode is on, the footer's Paste key gains its second deed: a short card («Put the last copy first?») explains that the fresh copy will jump to the front of the line and take the place of what is playing, the rest of the line staying behind it. On confirm, the shell stamps the delivery (pasteFront, the rate stamp's twin) and reads the clipboard; the page pulls the stamp at the Bridge (bubblePasteFront, twenty seconds, pulled once) and judges the arrival by the new front road: enqueueFront seats the text at the head (a text already in the line MOVES there — one entry, never two), the line's standing current leaves the line, and the new head plays at once. Re-pasting the text on stage plays it again from the top. A lone session on stage is replaced by the play, as any hand paste replaces. With the mode off, Paste now is exactly the key it has always been. Declared edge: the stamp is judged at the delivery doors (pullClip, the startup pull, and the hand-ask clipboard road when the shell could not read); an automatic catch pulled through the same doors inside the stamp's twenty seconds would be front-judged too — the window opens only behind his confirmed tap, and the stamp is consumed by the first pull.

The front seat is bench-proven at the record (test/wave206-front.ts, 7/7: fresh head, move-not-duplicate, order behind preserved). The shell has no bench: the Android CI compile is its gate, Oscar's phone the judge.

## 1.4.205 — The panel in the queue's shape (Oscar's panel round, 2026-11-21)

Six panel orders from Oscar's evening with 1.4.201 in hand, all shell (BubbleService + the MainActivity Bridge); the page's half of the speed road (the absolute-rate listener) already shipped in 1.4.204. Presentation impact: NONE — no anchor moves, no registry change, nothing on the stage wears the panel's transport; no relay owed.

- **The hint cards darken (his Vela verdict, applied here).** «Las tarjetas de ayuda tienen demasiado blanco.» cardPal's Legacy dark face stepped from rgb(79,70,58)/(60,53,44) to rgb(44,38,30)/(30,26,21) — a whisper above the panel's own (34,29,23)/(19,16,13); the discs and dividers darkened in step. The separation is now carried by the rim and the edge stack (the Calibration Law), never by a luminance leap. Light, Tron and Cyberpunk card palettes untouched.
- **The transport wears the queue's shape.** While a copy queue stands (the push's count > 0), the row rebuilds itself: the time jumps move OUT to the −/+ seats at the −/+ size (34), the inner 42 seats go to previous/next AUDIO (the standing media glyphs, the panel's own "prev"/"next" verbs — the line is travelled like songs), and the −/+ keys leave the row. fitControls learned the shape: the same five numbers (34/42/54/42/34) seat both rows, so the footprint never changes. When the line empties, the row rebuilds exactly as it was. Nothing is deleted — the speed keys return with the empty line.
- **The speed lives on the counter.** In the queue shape the sentence counter («Sentence 5 of 10 · 1.1×») wears a trailing ▾ and its tap opens the speed list — the app's own eight steps in the hint cards' mould, the standing rate in gold (read off the counter's own writing). A tap stores the pick in the shell (ratePick, stamped like the seek), pokes "rate", and the page sets it absolutely through Bridge.bubbleRate (twenty seconds of life, no session judgment — the rate is global). The chosen speed stays written on the counter, as it always was.
- **The queue sheet breathes.** Its exit arrow grows a little (15 → 19 in a 26 → 32 dp seat); «Empty the whole list» keeps its words a touch smaller (13 → 12); and the gold glow now lies over the WHOLE sheet (radial, centered on the top edge, radius 240) instead of a 120 dp band whose bottom edge cut the fade in two — «se ve como un error que haya un corte de color». One piece, no cut.
- **The ⚑ mirror.** The panel's unsaved-mark card now mirrors the app's 1.4.204 ruling: save first; «Not now» leads to the warning card («Without saving, this mark lasts only while this text is open or playing…») and only there does «Mark anyway» mark. showHintCard learned an optional cancel deed for the chain; every other card is untouched.
- **The footer's symmetry.** The enter-sign key takes the far RIGHT seat — where the queue's key sat — and the rest step one seat left: [paste][eye][queue][enter]. The queue's count badge travels with its key.

Shell has no bench: the Android CI compile is the gate, Oscar's phone the judge — the card darkness, the row's two shapes, the counter's list and the sheet's one-piece face are all his to verdict.

## 1.4.204 — Marks ask first, dialogs breathe, the ⚑ gets its receipt (2026-11-21)

Oscar's three orders from his phone this evening. (1) In the app's dialog
windows the Cancel/Delete buttons sat right against the legend — the
shared body style (.keepask-body) now carries 20px of air beneath it, so
every window built on it (the confirm host, the book keep-ask, the new
mark ask) sets its buttons lower. (2) A mark on a text that is not saved
is a bookmark in a file that may not exist tomorrow — his Library showed
a saved mark whose text was gone ("That text is no longer in Listen").
The Listen mark door now ASKS first: save the text to the Library and
the mark lives with it; Mark anyway stands only under the spoken
warning — the mark lasts while this text is open or playing, and dies
when the text is replaced. And the promise is kept in code: playLooseMark
now falls back to the saved Library copy — when the draft has moved on,
the copy comes back into Listen at the marked sentence, so a mark made
after saving truly stays with its text. (3) The panel's ⚑ error (the
black-screen trip) is cured at its root on the page side: a landed mark
changed nothing the panel state push carries, so the shell's poke watch
judged every mark on a quiet session unheard and manufactured a ghost
visit. marks.ts now keeps an epoch counter that every handled mark
moves; the push carries it as `marks`, and the mark listener pushes
right after marking — the press is witnessed, no visit is manufactured.
(The standing M-12 identity dedupe already ensured a re-fired mark
could never duplicate; the harm was the visit itself.) The page also
gains the absolute-rate listener (logosandroid-rate, pulled through the
Bridge like bubbleSeek) ahead of the panel's speed list in 1.4.205.

Presentation impact: none — no anchor moves, no registry change. The
new mark-ask sheet carries no data-present (no anchor minted); the
lane may mint one when it teaches the mark door.

Tests: test/wave204-marks.ts 9/9 (epoch moves per handled mark, the
identity dedupe holds). Battery 50 pass / 3 known non-runnable, suites
129/129, Fence 0 and the anchor fence green. Benches at phone width:
the ask sheet opens on an unsaved text; Mark anyway files one mark;
Save to Library files the clip and the mark, and after the draft is
replaced the mark reopens its saved copy in Listen; the confirm
dialog's buttons sit 20px lower.

## 1.4.203 — The player's voice chip retires to the desk; the queue takes its seat

Oscar's determination, over his own annotated photo of the chip row: the button that chose the voice in the Listen player **duplicated the voice choice the desk below already gives**, and the row was too full to breathe. So:

- **The voice chip is out of the player.** The row now stands: language · sleep · speed — and it breathes.
- **The copy queue takes the microphone's seat** — the row's last place, where the voice chip stood (his arrow drew exactly that move). Its anchor and deed are unchanged; only its seat moved.
- **The desk becomes a real substitute.** Its voices card now stands always (before, it vanished when the user had no favorites — which would have taken the substitute down with it), and beside the favorite chips it carries what the removed chip held: **the door to the full picker** — every voice, Automatic, search — wearing the chip's own face (gold dot, Mic2, its label said whole: «Choose a voice»). Nothing the chip offered is lost; it just lives where Oscar said it belongs.
- **The anchor follows the deed.** `listen-voice-chip` is a CLASS anchor (`.voice-chip`); the class now lives on the desk's door — exactly one element, opening the same picker — so the beats that tap it (Q0, Q3, AD5) need no script changes. Its registry record's probe moves from ListenPage.tsx to desk.tsx, where the element now lives. Declared bound: the desk is the wide layout's column, so the anchor's real element exists where the desk exists; on the phone, the Voices tab remains the catalog's door.
- The sealed stage's fiction mirrors the move: no voice chip in the player fiction; the door stands in the desk fiction's voices card, carrying the class.

Presentation impact: declared here and relayed to the Presentation lane — the `listen-voice-chip` element moved from the player row to the desk (same class, same deed, probe file updated in canon's transcription); no beat text or structure changes.

## 1.4.202 — The Q3 remap lands: the Pocket beat points at the accordion

The 1.4.200 accordion left Q3's Pocket beat pointing at an element the page no longer has (declared in the 200 notes: its stay-here landing reported unlandable until the lane re-mapped it). The Presentation lane did the remap in its copy, verified it there, and handed it over; canon integrated it INTEGRA, NO REEMPLACES — only the Q3 changes crossed, because the lane's copy stands behind canon on other cures (the T6-9 tag-qualified locator, the family-aware lookup, several companion attributes, the 1.4.167 desk record), and every one of those survives untouched.

- **The beat**: `q3-filter-pocket` is now `q3-section-pocket` — it taps `voices-section-head:pocket`, the Pocket section's head, and its feet say what the gesture does, in both languages («The catalog sorts into sections; tap Pocket and its voices open here.»). The goal is unchanged: with the section open, Alba's card stands in the grid for the two beats that examine her.
- **The registry**: `voices-section-head:{group}` enters as MINT with companion `data-group` (several heads share the one mint, so the companion names the member), and `voices-filter:{key}` leaves the active registry for the new **RETIRED_ANCHORS** lineage list — kept with its death note («real-element-removed-in-1.4.200…»), never resolvable. The exchange is one-for-one: 323 active anchors, 251 MINT, totals unmoved. The anchor fence now imports and audits the retired list (a retired id found in ANCHORS, or one missing its note, fails the fence). The footprint table's key follows the rename, with the lane's maintenance note. `voices-empty-fav`'s precondition now says what is true: «Favorites section open…».
- **The stage (canon-only half — the lane's copy has no stage to mirror)**: the sealed stage's Voices fiction is an accordion now, like the real page — Favourites, Pocket, English, Español; one section open at a time; a section's cards exist only while it stands open; language sections hold Phonon voices and Pocket voices live in their own section, as in the real composition; the empty-favorites note lives inside its section. `stageUi.voicesFilter` is `voicesSection` now.
- **Gates, against the pre-integration baseline**: identical — anchor fence GREEN (the retired record listed with its note), Fence 0 exit 0, presentation suites 129/129.

Presentation impact: this wave IS the presentation change — Q3's pocket beat has a real destination again, in the app and on the sealed stage.

## 1.4.201 — No ellipses: a chip is complete or it is not there

Oscar's law, stated 2026-11-21 with two close-ups of the Listen player's chip row — the voice chip wearing a cut name («● N…») and the language chip cut to «Auto · …»: «No me gustan los puntos suspensivos. El ícono está completo o no está.»

- **The voice chip wears the voice icon.** The current voice's NAME no longer rides the Listen voice chip — long names arrived truncated by design (the chip capped at 170 px, its text span ellipsizing). The chip now carries the standing gold dot and **Mic2**, the app's own voice symbol (the same glyph the bottom nav draws for Voices), whole at any name length. The name itself lives one tap away, in the picker the chip opens. The 1.4.60 player-meta comment is amended: the name is now said nowhere on the player card.
- **The language chip stands complete.** Its text span no longer ellipsizes and the chip never shrinks (`flex: none`): «Auto · EN», «Auto · EN + ES» and the manual labels stand whole — the room comes from the voice chip's new narrowness. The ellipsis mechanism is removed from the player's chips entirely (`.chip-txt` is nowrap, no overflow cut); the sleep and speed chips already wore complete contents.
- **The panel title obeys the same law.** The bubble panel's session title ellipsized at the end («Sobre Escu…», photographed by Oscar the same afternoon). It now auto-sizes its type (17 sp down to 11 sp) until the title stands complete on its line; the dots are gone. The queue list's rows keep their compact form by the 198 design — the full titles live in the app, whose queue sheet is the line's complete record.

- **The panel footer, at his further word the same afternoon** (folded into this wave before publishing): the «Listen» key's icon changes AGAIN — the 200 sound wave described the area but not the deed; this key takes him INTO the application, so it now wears the enter sign, an arrow going into the app's frame. And the footer steps down once more on the PHONE only: the four discs go 25 → 22 dp with their margins, and the Auto lever shrinks on both devices — a little on the tablet (×0.9), more on the phone (×0.78); the tablet's discs keep the 200 size, as he ordered.
- **The queue list, at his word over his own photos of it** (he loves its simplicity; folded in before publishing): a row's ✕ now ASKS first — the hint card names the text and only its answer drops it; a universal key at the sheet's foot, «Empty the whole list», empties the line behind its own confirmation, which says exactly that (the page gains the matching `clearqueue` verb; what is playing keeps playing, as the card states); the sheet's way out wears a BACK ARROW instead of an ✕, so it can never be confused with the rows' drops; and the sheet itself gets a designed face instead of a black slab — the panel card's own furniture: the rim around its gradient, the gold glow lying on its top, a hairline under its head.

Presentation impact: none — the voice chip keeps its seat and anchor (`listen-voice-chip`); only its contents changed, from a name to an icon. The shell half has no bench: CI compiles the Kotlin, and Oscar's phone judges the panel.

## 1.4.200 — The Voices sections fold and open; the panel's footer fits its line

Two of Oscar's orders from 2026-11-21, minutes apart, one wave:

- **The Voices page is the picker's accordion (his words, from his phone).** The horizontal filter chips at the top are GONE — «elimina eso, para que queden verticalmente en mi teléfono» — and the sections themselves do the filters' work now: Favorites, Pocket, Spanish·Spain, Spanish·Mexico, English·American, English·British stand as a vertical stack of the picker's own `.vgroup` heads, all folded when the page opens, one open at a time, each retraced or opened with a tap. A closed head's meta line says what waits inside — the count, or the section's default in gold («Default · Noa»), as the picker's closed heads name the selected voice. An empty Favorites keeps its section; its body carries the standing «No favorites yet» card (the `voices-empty-fav` element survives there). Search keeps its flat grid and gains an honest empty note. The page's accordion stands on the page's ground (the open head's sticky backing and the stack's rings take `--bg`, not the sheet's `--bg-2`), and on a tablet the heads take more room and a larger title while an open section distributes its cards in the standing wide grid — the wide view composed, not stretched. The 199 card cure stands untouched (name alone, badges whole on their own row).
- **The bubble panel's footer fits (his words, from his close-ups).** The footer's discs were so large the row overflowed the panel and the last key — the queue key the 198 wave added — stood half cut at the card's edge. All four discs (paste, listen, hide, queue) go from 30 dp to 25 dp and their margins tighten (12/8/8/8 → 10/6/6/6): 28 dp returned to the row, everything on one line, nothing cut. And the «Listen» key's headphones are retired at his word — the glyph invited the wrong reading (a headset key) for a key whose deed is going to the listening area; it now wears the listening area's own symbol, the sound wave the app's nav draws for Listen (five round-capped bars of uneven height). Its name and deed are unchanged.

Presentation impact: the `voices-filter:{key}` MINT anchor loses its element in the real app — the chips it named no longer exist; Q3's pocket-filter beat still runs whole on the sealed stage (its fixture keeps its chips), but its stay-here landing in the real app now reports unlandable, honestly, until the lane re-maps that beat. `voices-head`, `voices-search`, `voices-grid` (now the accordion's wrapper) and `voices-empty-fav` keep their elements. A relay goes to the Presentation lane with this wave. The shell half has no bench: CI compiles the Kotlin, and Oscar's phone judges the footer.

## 1.4.199 — The Voices page wears the picker's organization

Oscar's order (2026-11-21, with two screenshots): improve the look and organization of the voices on the Voices page — the voices reached from Listen (the picker) look better organized and distributed. His screenshot named the defects himself: the page was one flat run of 57 cards, and the «On this device» badge, seated inside the name row, was squeezed until it wrapped word by word («On / this / device») and crowded the card's head.

- **One organization for the whole app.** The page now renders the picker's own sections, built by the picker's own `pickerGroups` (exported from chrome.tsx, unchanged): Favorites, Pocket, then Spanish·Spain, Spanish·Mexico, English·American, English·British — each with the picker's head furniture (the stack of the section's first voices' colours, the serif title, the region, the count). The page's filters narrow the same sections (a language filter passes through as the picker's own lang gate; Favorites and Pocket filters keep their single section); search shows one flat grid, as the picker's search state does. Within a section, cards distribute in the standing grid (1 column on the phone, 2 from 640px, 3 from 1180px). Exactly one element carries the `voices-grid` anchor (the sections' wrapper); the stage is untouched.
- **The card's head, uncluttered.** The name stands alone on its line; the badges (accent, Pocket, On this device) move to their own row under it, each `white-space: nowrap` — a badge can wrap to the next line as a whole, never stack word by word. Nothing else on the card moved: the flag, the tagline, Make default, the star and the preview keep their seats and their laws (voiceCardTruth, the M-44 favorites truth, the M-49 on-device claim).

Presentation impact: none beyond the stage's version strings — no relay owed. Web-only wave (no shell change): no Android CI run, no APK; it reaches Oscar by closing and reopening Logos.

## 1.4.198 — The copy queue: copies line up, the line plays through, and the line can move to Listen later

Oscar's design, in his words across 2026-11-21: he copies several texts one after another and wants them heard in order — today only the last copy survives. Plus his second thought the same hour: what he cannot save while it plays should not be lost — the line itself should be saveable, whole or piece by piece, into the Library's Listen later, which should play as a playlist. And the headset question dissolved into a fact: his Picun F8 Pro's manual says the dial's double press is NEXT TRACK and its triple press is PREVIOUS — the headset has no seek keys at all — so no choice was ever needed: the track keys travel the line, and the seconds leaps stay on the panel and the card.

- **The mode (`settings.copyQueue`, default off):** a switch with its explanatory card in Settings (the Bubble card) and the same switch at the top of the queue sheet. ON: every arrival — shell catch, arrival-in-app, hand paste — goes through `queueArrival` (bubble.ts) and LINES UP instead of taking the stage: no 192 ask (nothing is displaced), no resume card, no Undo toast. The line's tail judges duplicates: copying the same text twice in a row, copying what is playing, or copying the current item adds nothing. An arrival starts at once only when the stage is free (nothing loaded, the last thing finished, no recording sounding); otherwise it lines up behind. OFF: the record is erased whole (his rule, judged on the settings change) and Logos is the app it always was.
- **The line (`src/lib/queue.ts`, persisted at `logos.queue.v1`):** items with title + estimated seconds, `currentId` for the one on stage, and an `orphanKey`: removing the item on stage does not stop its sound — the successor is seated as current and the removed key is kept, so the finish judge recognises the orphan's end and steps to the successor. The store is proven by `test/wave198-queue.ts` (15/15: tail dedupe, successor seating, orphan, persistence, erasure). All deeds live in bubble.ts: `playQueuedText` (the quiet loader — drafts + lastText + load + play, none of the clipboard ceremony), the finish judge (one arbiter for both lines: the later chain first, then the queue; a standing resume card outranks the line; a queue that waited behind a lone session starts when that session ends), and `registerTrackSkip` in listen.ts (the queue claims next/previous only while one of its items holds the stage; a press it declines falls through to the book deed, then the sentence step — at the line's end a hand press is claimed and does nothing, rather than stepping a sentence nobody asked for).
- **The faces:** Listen gains a queue chip in the player (count when the line stands) opening the queue sheet — the switch, the list (title + estimated duration, the sounding one marked), tap to jump, ✕ to drop, a bookmark per item (save it to Listen later; it keeps its place — saving is not a removal), «Send the whole line to Listen later» (moves them, in arrival order, and empties the line) and «Clear». The bubble panel gains a footer queue key wearing the count as a badge; its tap opens the line over the panel card (rows from the push's titles; tap plays, ✕ drops — pulled through Bridge seats under the seek's own laws: twenty seconds, the session it was chosen against). Every push now carries `queue/qcur/qmode/qt`. The panel's save key, with a line standing, asks its question on its own card: «Just this text» (the standing save) or «The whole line, to Listen later» (the `savequeue` poke).
- **The card and the headset (PlaybackService):** the push's count is harvested in `noteBubblePush`; while it stands above zero the session declares SKIP (the 172 book law, extended to the second line of tracks) and `act("next"/"prev")` routes to the page even over the shell's own voice — the line lives page-side whichever voice speaks it. `onMediaButtonEvent`: NEXT/PREVIOUS travel the line while it stands and leap by the Settings seconds when it does not (the 194 floor, untouched); FAST_FORWARD/REWIND always leap. The panel's sentence buttons never moved.
- **Listen later is a playlist (Library):** a saved text played from the Library now takes its line with it — `playLaterChain` plays the later texts in arrival order (createdAt ascending), each ending starting the next; the later filter gains «Play in order». Opening a later text without playing keeps the single-text road.
- **Declared bounds:** the queue holds copied TEXTS only (books keep their law when no queue item holds the stage; recordings step their own ±15 s as always). A queue item's text lives in the line's record (localStorage) until it is played, dropped, cleared, sent to the Library, or the mode is turned off. Sending the line to Listen later uses the standing `saveForLater` road item by item (a text already saved can be saved again, exactly as the standing save key allows). The panel list shows the push's titles (capped at 60 characters) — the page remains the line's only full record.

Presentation impact: none beyond the stage's version strings — no relay owed. The pre-198 snapshot failed under an environment write-block (its files are 0 bytes and were discarded); rollback ground truth is the remote source branch's 1.4.197 tree (head 3199dad1).

## 1.4.197 — The bubble wears the window's opacity, the Ring comes to the bubble, and the spectrum can never sit white

Three of Oscar's words from 2026-11-21, one wave:

- **The opacity rule (his determination, after the two sliders turned out to be his own settings):** when the window opens, the bubble takes the WINDOW's opacity — it does not look right for the λ to stay at its own transparency beside a panel at another level — and takes its own back when the panel closes. Three seats in `BubbleService.kt`: the open path animates the bubble to `panelAlpha()` with the panel's own birth; `collapsePanel` restores `awakeAlpha()`; `applyLook` honours the same rule if the look is re-pushed while the panel stands.
- **The Ring around the floating λ (his choice, asked and answered):** a `RingView` rides as the bubble window's top child — fine track in the theme's ring colour at low alpha, the accent arc filling clockwise from the top, a bead with its halo at the frontier — fed on every push by `updateBubbleRing()` from the stage's own fraction (a reading's sentence fraction, a recording's clock fraction). No active session, no ring: the bubble is exactly the jewel it always was. The shade card keeps its own Ring from 193/196; the two instruments now agree because both drink from the session's truth.
- **The white spectrum (his report on 196's first open: the Listen spectrum's seat sat white; a force-stop cured it):** the visualizer's preferred path hands its canvas to a worker (OffscreenCanvas) — a one-way door. When that worker never presents a frame (a cold or broken chunk load on a first open), the transferred canvas sits on the compositor's white backing and the page can never reclaim it. Cure: the worker posts `painted` after its first real frame; the page runs a 2.5 s watchdog, and on silence it remounts the canvas (new key) under its own 2D drawing. The spectrum can fall back to plain — it cannot sit white again. Declared: the trigger condition (a first-open worker failure) is not reproducible on the bench; the fallback path is the standing 2D drawer, and the watchdog's wiring is code-verified — Oscar's next first open is the judge.

Presentation impact: none beyond the stage's version strings — no relay owed.

## 1.4.196 — The Ring, judged on Oscar's phone: the bar advances, in the theme's colour

Oscar's verdict on 1.4.193 (2026-11-21, with shade screenshots): the seek bar does not advance — with a short 2-second text it starts, moves a little, snaps back to the start and keeps doing that in a loop; the bar renders RED, "not the colour of Logos, Legacy"; and a second screenshot shows a fresh reading wearing the finished one's 100% artwork. All three are shell-side, in `PlaybackService.kt`:

- **The snap-back.** The session state was re-anchored at the last progress SEAT on every republish — and republishes arrive on the ring's percent steps and clip-stage changes, mid-sentence, while the panel had already extrapolated past the seat. Cure: the seat is stamped when it lands (`progAtMs`, monotonic), and `faceSession` extrapolates the seat to the anchor moment — position + elapsed × the seat's own speed, capped at the duration — while playing; paused, the seat stands as published. Any re-anchor now agrees with the panel's own extrapolation, so the bar cannot be dragged backwards by a rebuild.
- **The stale face.** The ring's fraction came from the bubble push's sentence fraction — a different clock from the progress seat, and one whose last word could be a finished session's. Cure: the ring's fraction and percent are derived in `noteProgress` from the progress seat itself (pos/dur) — one truth for the bar and the artwork; a new session's first seat re-faces the card. The push still brings the theme family, and a family change still rebuilds the card.
- **The colour.** 1.4.193 set the notification's tint to the family's GROUND colour; Samsung painted the card's furniture (the seek bar above all) red-orange from it. Cure: the tint is now the family's ACCENT — Legacy gold (233,189,114), Light (154,102,20), Tron (0,229,255), Cyberpunk (255,42,109) — the colour that is Logos in each theme.

Also reported the same morning: the bubble panel stays OPAQUE when opened. The look's two sliders are separate seats (bubble / panel); the question of Oscar's own Panel transparency value is with him — if it reads under 100 while the panel stands opaque, the break is the shell's application and gets its own hunt; nothing in this wave touches the look. Declared plainly, as with all shell work: there is no bench for the shade — Oscar's phone is the judge of the bar's motion and the colour alike. Presentation impact: none beyond the stage's version strings — no relay owed.

## 1.4.195 — The pins: the models are now verified against digests that live in the app

Oscar delegated the campaign report's open decisions ("toma las decisiones aquí. Confío en ti."). Three are ratified as they already stood and are settled here, not pending: **P12 stays click** (a lesson's tap is unambiguous; a gesture can misfire and trap — and the lesson never traps). **P17 stays STRICT in Logos, ununified with Cadence** (a "seen" in Logos is Oscar's own mastery record; a lesson that could not present does not get marked seen — Cadence keeps its softer rule because there partial progress is real work; the divergence is by design). **Q2's λ stays narrated** (executing it would touch the real bubble switch; supreme isolation outranks show-don't-tell at exactly that one point, and the narration teaches why).

The two pins did not need values from Oscar — they needed measurement, and measuring them exposed something bigger than the pins:

- **The upstream Pocket manifest's `sha256` fields are 16-hex PREFIXES, not full digests.** Everything built on them quietly failed in production: `expectedSha256` returned null for a prefix, so model downloads were never digest-verified at all; and the probe's `entryMatchesModel` compared the body's full hash against the prefix, so **Pocket certification could never pass with a real manifest** — the "downloaded" state, the Voices badges and keep.ts' stamp arming all rode on a comparison no real body could satisfy. The test suite modelled the manifest with full digests, so the benches never saw it. Speech itself was never affected (the worker loads independently), which is why it hid.
- **The measurement (2026-11-21, from the canonical upstreams):** Pocket EN model 176,992,315 B → `010c6701d007277e…3745`; ES model 173,604,779 B → `fd31ae98160932ed…dd81` — both computed digests extend the manifests' own prefixes and match their byte counts. Phonon's four files at the already-pinned commit 1191d231… matched the in-tree size table to the byte, and their digests are now measured too (gguf `96fa0678…7e27`, tokenizer `a5e8c606…9433`, config `e312ab69…f82e`, voice `dc537478…0f1a`).

The cure, all seats in the app's own code: the full digests live in `pocket-assets.js` (`PINNED_MODEL_SHA256`) and `phonon.ts` (`PHONON_MODEL_SHA256`) — in the shipped source, never in a travelling manifest. Pocket: `fetchAsset` resolves a model.onnx version through the pin (a prefix names its pin; wrong bytes are refused against the FULL pin; an unpinned model digest is refused before any byte is trusted; malformed shapes still fall to the malformed law); the probe requires the manifest's prefix to extend the pin and its byte count to be the pinned count, records the FULL pin as the language's identity, and judges the body against it — certification passes for a real model for the first time; the offline fallback resolves legacy prefix records to the pin and matches cache keys by the pin's family; `pocketEnsure` passes a pin gate before spawning (a reachable manifest naming another model refuses the load in the open with `PIN_REFUSAL`; an unreachable manifest proves nothing, so the load proceeds as before and certification judges after — declared bound). Phonon: the integrity pass now hashes every model body that passes the size bars and evicts on digest mismatch, so exact-size garbage no longer certifies; `phononCached` needed no change (the pass runs at its head). Declared bounds: Pocket's encoder, assets, renikud and espeak files remain digest-unverified (their manifest values are also prefixes; no full digests were measured for them — a future measurement can pin them the same way); a legitimate upstream model change will now refuse until a release re-pins deliberately — that refusal is the pin working, and it speaks its reason.

Gates: the real-file bench (`~/workspace/logos195-pinbench.ts`, uncommitted — it needs the measured files on disk) passes 8/8: the real EN model certifies online and offline, same-size wrong bytes refuse, the keep stamp writes bound to the full pin despite a blocked registry, the real Phonon four certify, a same-size wrong config refuses and is evicted. Seven committed tests were re-scoped to the pin world with their reasons written in their headers (audit-w3-t410, wavec-t4-pocket-engine, wavec-t4-assets, cure-waveD-pocket-keep, cure-waveD-phonon leg A flipped to the closure, cure-waveE-engines C3, cure-waveD-voice-badge) — no leg was silently dropped; the displaced true-positives are the bench's. Presentation impact: none beyond the stage's version strings — no relay owed.

## 1.4.194 — Headset leaps: the keys now reach the reading

Oscar's order: from the floating window he could not advance or rewind the audio with his headsets. The investigation read the whole key road before touching anything, and the destination end was innocent — onRewind/onFastForward and act()'s routing to the shell voice or the page all stand. The keys died at the delivery end, at two confirmed doors:

- **No audio focus was ever requested** — zero AudioManager use in the shell. The system's media router crowns the focus holder; Logos never claimed the crown, so in the bubble posture (app backgrounded, the shell's own voice speaking) headset keys went to another app's session or to none.
- **No onMediaButtonEvent of our own** — the framework's default mapping honours NEXT/PREVIOUS only when the session declares SKIP. Over a pasted text it does not (the card's settled law), so the double/triple press — the gesture headsets actually send for adelantar/atrasar — was dropped silently; over a book it stepped one sentence instead of leaping.

The cure, in PlaybackService only: focus is claimed while a reading sounds and let go when it stops or the card retires — the same law as the wake lock and the session's sleep (held for routing; ducking and loss manners stay with the voices). And the callback now reads key events itself: FAST_FORWARD and NEXT leap forward by the Settings seconds, REWIND and PREVIOUS leap back, on the key's down-stroke only; every other key keeps the framework's road. Declared: on a headset, next/previous IS the leap — the card's own SKIP buttons and the panel's buttons keep their settled semantics untouched; only keys arriving as key events take this door. The paused case keeps its standing shape: a sleeping session takes no keys, as before. Bench honesty: shell work has no bench — Android CI is the compile gate and Oscar's headsets on his phone are the judge.

## 1.4.193 — The Ring: the notification finally shows where the reading is

Oscar's order, with his screenshot of the system card: the buttons worked, but nothing anywhere showed the audio's progress — "it is as if it did not exist." He refused the typical advancing ball and asked for something supremely Logos, theme-adaptive. A design study (three concepts rendered as real sheets) and a platform study (fourteen sources) preceded the build; he chose **A · THE RING, "por mucho."**

- **Why the bar was dead (the platform verdict).** The media session published no duration, a position of UNKNOWN, and a hard-coded speed of 1f, and never declared a seek action — so the system's card drew its furniture with nothing inside it. A custom notification view is not honoured on Samsung/Android 13+, so the premium road is the one the system does honour: truthful session data, plus the artwork.
- **Road 1 — the session tells the truth.** The page publisher now measures the session and sends it over a new bridge: position and duration on the book's own timeline (rendered sentence lengths where they exist, the jump keys' honest estimates where they do not, re-anchored every sentence; a recording's real clock and its true rate), plus the session's real speed. The session publishes duration + position + speed and declares SEEK_TO; the system extrapolates between publishes, so the page speaks on sentence boundaries, never per second. Dragging the system's seek bar lands through the panel seek's own law — stamped with its session, dead after twenty seconds, judged at the pull door — and walks the same durations the publisher summed, so the bar's target and the bar's position share one ruler. While the shell's own voice holds the stage, a seek takes the fraction directly, as the panel's bar does. An old page against this shell (or the reverse) keeps exactly the old face: no duration seated, no seek declared, position UNKNOWN.
- **Road 2 — the Ring.** The card's artwork is drawn by the shell at runtime: a fine ring around the medallion fills clockwise over a dim hairline as the reading advances, a luminous bead rides the frontier, and the percent stands beneath the λ — the λ itself lifted from the bundled artwork as an alpha stencil (its bounds measured from the file) and tinted per theme. Legacy gold on warm charcoal, Light's deep gold on ivory, Tron's cyan with its glow, Cyberpunk's magenta printed flat with a yellow bead — the palettes are the themes' own tokens, and the notification's tint follows the family too. The face steps only when the rounded percent (or the family) changes: a long reading costs at most a hundred redraws. A finished reading closes the ring. Declared choices: the percent wears the platform serif (the house fonts are the page's, not the shell's); the metadata album line was left unset — the card's own text already carries the sentence and the clock, and a second, unlocalised sentence would have been furniture, not truth.
- **Bench honesty.** The shell has no bench: the Kotlin compiles through Android CI, the page side is type-checked and suite-tested, and the face itself is judged where it lives — on Oscar's phone, in the shade, under each theme.

## 1.4.192 — The app asks before it replaces + Friend Wave E: Round 4 closed (52 breaks cured)

- **Ask before replacing (Oscar's order).** Entering the app with a fresh copy used to take the stage silently — the copied text replaced whatever was loaded, even mid-listen. The automatic arrival road now asks first, in the house confirmation window, whenever something is at stake: a live session whose text differs from the copy, or a draft in the box that differs. "Replace with the copied text?" — Replace hands over the stage (the displaced reading keeps its resume card, as always); Cancel, the scrim and Escape keep everything untouched and mark the copy seen, so the same text never asks twice, while a new copy asks anew. A hand ask — the bubble's paste, the panel's paste icon, Paste & play — still lands at once: his finger asked. An empty stage has nothing to lose and is never asked. The delete confirmation keeps its red face; the question wears the primary one — one window, two voices.

Round 4 of the prejudice campaign found 52 confirmed breaks on the 191 tree (0 critical · 0 high · 15 medium · 37 low); this wave cures all 52. The round's theme: the cures' own guards were where the breaks lived.

- **Adoption restores the session's own text.** The shell handoff now stamps its own record synchronously, inside the handoff itself; adoption reads that record first, so a page death can no longer rebuild the session out of whatever stale draft sits in the box. A record whose fingerprint disagrees with its text restores nothing.
- **The shell judges receipts by incarnation.** A page's pushes are latched under the incarnation that made them: a press the poked page provably heard is never re-executed after a reload; a stored pause is retired by the page's own answer (a page that never answered still collects it — the handover stands); a seek whose page died is re-poked once into the new page instead of being swallowed; session coordinates are kept per driver, so no index is ever paired with the other driver's sentence total; a forward leap at the last sentence completes the book, like the step key.
- **The library heals every phantom.** The dedupe census no longer crowns the first phantom and stops: every content-less copy of a text heals under its own id, beside a healthy copy too, from its full record (cover included), and a heal is a keeping by deed (temp: false). Imports are serialised at the write phase, so two imports of the same file racing can no longer mint identical twins. Orphaned content rows are reaped at the end of each import, judged inside their own delete transaction.
- **Phonon eviction arms on evidence.** A file joins the evicted set only when a follow-up read confirms it is gone; unlanded evictions stay retryable and the return value tells the truth. Eviction now judges fault, not consumption: bytes that were fully served and then rejected are evicted; silence after full service (a slow phone) leaves healthy bytes standing. Settings' storage figure is filed under the engine landscape and re-measured only when the landscape changes, instead of re-reading ~250 MB of bodies on every refresh.
- **Backup speaks the app's own pronunciation law.** The merge judges all overlapping entries, order-independent: a scoped and an unscoped reading of one word land whole together on a fresh phone, in either file order; only a true clash (different readings for a language both entries speak) is kept, and counted. Duplicate mark ids dedupe within the file as well as against the phone. A clip whose only-copy audio is absent counts as skipped, and the report now names the two skip causes separately (records missing vs audio that could not be written), each with its own true sentence in the toast. Progress is validated to its 0–1 range; SVG covers are refused at the door.
- **Presentation records sign their witnesses.** Each completed step is now recorded with its identity beside its place: if a lesson is edited, the finish trusts exactly the seats whose step still stands there — appends cost nothing, an inserted step refuses only the seats it shifted. Malformed skip entries can no longer bar a module forever, and an out-of-range saved place can no longer be laundered into a full walk. One honest cost: records written by 1.4.191 and earlier carry no signatures, so their completed-step witness is refused on first read — the resume place stands, but coverage is re-earned with one re-walk per module, once.
- **Create: a promised job is somewhere at every moment.** The render queue's 50 ms handoff gap is closed by a handoff seat the dedupe door judges, the queue counts, and cancel can call back — no admission can silently eat a shifted job again. Dedupe keys carry the title as the render writes it (trimmed) and, for a re-render, no caller speed the render provably ignores. Pronunciations fire on possessives ("Saoirse's" speaks its entry, suffix intact) while contractions still refuse ("don" stays out of "don't").
- **Intake: gates judge what they name.** One prose veto now judges every chapter-heading branch, testing case by plain comparison its own regex flags cannot blind — "Chapter 3 The Storm" is a heading again, "Chapter 3 was the hardest…" stays prose, and ordinal-first prose ("One part of the story was missing.") no longer heads a chapter. The mojibake witness counts E2-lead damage (â…) too, so a mis-stamped UTF-8 book warns instead of shelving garbled. A UTF-16 declaration must agree with the body's own shape; on disagreement the bytes win, with a warning. GIF and PDF claims need real structure (a walked block stream reaching an image; an object or xref inside the file), not a label. The sentence splitter splits at "He left.She stayed home."; References sections stop at comma-qualified headings too; junk detection convicts boilerplate phrases, not topics; list lines mid-document are content, not crumbs.

Battery: tsc clean; the test loop stands at 48 pass with only the three known non-runnable files failing identically on the baseline; presentation suites 129/129; Fence 0 11/11; the λ guarantee probes (main, 8th, 9th) and the anchor fence green; entry-seeding clean; every Wave E cure probe passes at the far end. The new ask was bench-proven at phone width against the built app in its shell posture: the question stands while the loaded text stays untouched, Cancel keeps it, the same copy does not ask twice, a new copy asks again, and Replace hands over the stage.

## 1.4.191 — Prejudice Round 3 → Friend Wave D: all 69 (shell + web)

Round 3 hunted the 190 tree and found **69 confirmed breaks — 0 critical · 4 high · 18 medium · 47 low** (full record: ~/workspace/logos-prejudice/round3/TALLY.md). The severity keeps collapsing (125 → 65 → 69, and the highs are nearly gone); what remains lives at the joints between cures. This wave cures all 69 — nine offices, every cure probe-proven at the far end, and two confessions lead the list because they are the round's real lesson: **187's phantom heal never worked at store level** (the healed text landed under a fresh random id no shelf record pointed at — the book stayed unopenable while its verdict read cured; the cure now re-keys the content under the phantom's own id and the probe reads the store, not the return value), and **adopting a shell-native session stopped the very session it adopted** (the restore's stop order fired unconditionally; adoption now withholds the shell order, and the probe counts the stop calls: zero). Playback: a finished native reading's done mark can no longer be overwritten by the same handler pass's fresh-record save; the playhead gate distrusts backward teleports exactly as it distrusts forward ones; resume and marks now key on the whole-text fingerprint the code's own comment prescribed (stored marks keep a dual-accept door; resume records, being pointers, do not); the render ledger subtracts only deletes that landed; the shell publisher's dedupe key carries the sentence text itself; a scrub fraction is spent only on its own sentence and dies at every device handoff; the browser media card returns to the reading when a clip ends. Shell (Kotlin, mechanism-traced; CI compiles before this publish is declared): both panel witnesses now demand the page generation, so a reload inside the watch window can no longer manufacture a receipt for a dead poke; the pending-press take judges every head in one step and the page drains the queue in-breath; tail coalescing judges the tail's age and stamp, so two presses 25 seconds apart against a dead page both execute; the clipboard catch is one lock; drop receipts queue instead of overwriting; the displaced-session memory is a bounded set, not one slot; and SKIP at the final sentence of a device-voice reading now takes the completion road (the sentence-stepping itself remains the declared residual). Library: a pre-190-fingerprint phantom heals under its own id through the legacy court; the clip-twin backfill runs a census on every refresh instead of firing once behind an empty-twin gate; both databases memoise their connection and prune their write chains; a winning backup no longer strips the phone's cover. Engines: Phonon evicts the files a failed load actually served from cache, so in-place corruption heals on the next load instead of being served forever (DECLARED: the full cure is a pinned per-file SHA-256 table measured from the real files — a pin-location decision in the C-2 family, for Oscar; no hash was invented); a blocked digest-registry write no longer disarms the keep stamp; cache sizes count measured bodies, never headers. Settings/Backup: book validation now proves author and refuses a raw cover member (the two fields its renderers dereference); cover/blob payloads decode only from data: URLs — a text/html payload is never fetched or stored; the pronunciation merge keys on word AND language, so a file's Spanish "pan" lands beside the phone's English one; duplicate ids in one file count once; marks at the cap report landed AND evicted; export counts skipped clips beside skipped books; an explicitly emptied favorites list gets its true explanation, not the ghost one; the verbatim field carry can no longer be used to swap an object's prototype. Presentations: **the finish now judges the record's witnesses** — a «Watch» landing or an unearned resume can no longer launder unwitnessed steps into «seen» (coverage = this run's presented steps ∪ the record's done[]); beat 1 resolves against the stage the lesson actually keeps (the opening and lesson branches now share one mount — «Empezar» no longer throws away the stage beat 1 was resolved against); the λ wire is dead after teardown (the guarantee's 9th specimen, now an in-tree probe, HELD); a skip bars «seen» across runs until the step is truly presented; no finish path softens a standing needs-refresh; a done[] claim beyond its module's length is refused whole. Create/Voices: Settings' pronunciation door stamps a language (new entries are born scoped; twins in the other language survive an add; the list shows each entry's language; DECLARED: entries created before this wave stay "Both languages" by the settled law that scoping never silently retires a standing entry — their owner can delete and re-add them scoped); a scoped entry now wins over an unscoped twin regardless of storage order; names keep their shape ("O'Brien" → "Oh-bree-en", "McDonald" → "Mik-donald"); an all-caps sentence end no longer swallows the next word; the Voices page's "On this device" badge judges each voice's own engine and language; a repeated Generate tap is refused as a duplicate instead of rendering the same audio three times; the per-voice tally credits speech, not the silences around it. Intake: dotted initialisms are a shape now, not a list (U.K., U.N., E.U., a.k.a., P.O. Box hold their sentences); narrow-wrapped prose imports as the paragraphs it is, not one block per line; the junk standard is one at every length; "He got an A. She smiled." splits while "J. R. R. Tolkien" joins; e.g./i.e. never end a sentence; "Chapter 3 was the hardest part…" is prose again; a tidy numbered list is no longer welded into a run-on; the GIF sniffer reads the block, not just its introducer; a BOM no longer silences the HTML/FB2 magics; the encoding lie detector convicts on overwhelming evidence and judges UTF-16 declarations by shape; "References and notes" stops the import; a title's site suffix strips only when it truly names the site; OCR must now read at least as cleanly as the layer it replaces; initialled bylines survive the noise filter. Battery: tsc clean; every loadable test suite green (the three pre-existing runner limits unchanged); presentation suites 129/129; Fence 0 11/11; λ specimens 1–9 HOLD; anchor fence GREEN; entry-seeding clean; the round's headline probes re-run by the parent (adoption stop-count 3/3, phantom at store level 12/12, Watch-forge HELD, backup battery 41/41). Next: Prejudice Round 4 hunts the whole tree again — the campaign ends when a full round finds nothing.

## 1.4.190 — Prejudice Round 2 → Friend Wave C: the 36 lows (web only)

Round 2's low shelf closes (records: ~/workspace/logos-prejudice/cure-waveC-*.md); Rounds 1 and 2 now stand fully cured — 190 confirmed breaks across both hunts. Playback: the now-reading stamp survives a quota failure in a mirrored memory (and retires honestly when its book is purged); the shell publisher's dedupe key carries the voice, so a paused voice change reaches the media card; the bubble's resume card and its stage trigger are judged together after a reload — a card whose stage is gone retires instead of squatting over the draft's return. Backup/Settings: the import report counts what it skipped (deleted marks, clips) and measures the marks that actually landed; a favorites list that would land empty is withheld whole — the phone keeps its stars; unknown settings fields ride through a restore verbatim (forward versions survive the trip); one shared envelope clamps every numeric setting on both the load and the patch road; validation judges each block only as deep as its consumers read it, so inert damage no longer vetoes a whole restore. Library: the format sniffer demands self-consistent headers (prose opening "BM…" or "GIF89a is…" no longer routes to OCR; a real BMP/GIF still does); the content hash sees chapter boundaries, and a stored old-formula hash is re-judged by recompute instead of waving duplicates past; the clip twin's backfill writes only records still present (no ghost resurrections); putBook runs in the per-book write queue. Engines: a complete over-long download body is accepted (only a short one is refused); **a digest-shaped version that is not a true SHA-256 now fails CLOSED with a loud error — C-2's verification can no longer be switched off silently by a malformed digest**; Pocket's cached flag answers per language; the manifest fetch carries a 10-second deadline, so a stalled network reads as offline and the recorded-digest fallback answers. Intake: the sentence gate knows the discourse openers (Suddenly, Meanwhile, Finally, Today, Well — and their Spanish twins) and title words split only when what follows cannot be a name ("Main St. It was quiet." splits; "St. Paul" joins); a 600-character spaceless token is emitted whole, never sawn at 520; dotted numbers are not web addresses; the spoken link word follows the sentence's language ("enlace"); a PDF's thin text layer is no longer discarded when OCR finds a little — OCR must materially out-read the layer, else the two join; an EPUB's mimetype entry is read, not assumed; a poem's unpunctuated closing lines survive import; the reference apparatus ends an article at any length; WebImport's Undo window matches the clipboard's 10 seconds. Create/Voices: an export pre-flight failure lands in the error state with the app's own wording (and the queued job still runs) instead of dying as an unhandled rejection; pronunciation entries no longer eat hyphens, slashes or decimal points ("well-known", "3.14" survive); the Voices page tells one truth per card — the stored default wears "Default", a governing Listen pick wears "Now reading" on its own card, and the toast names the pick when it governs. Battery: tsc clean; presentation suites 129/129; Fence 0 11/11; λ holds + 8th HELD; anchor fence GREEN; entry-seeding clean; every loadable test suite green. Next: Prejudice Round 3 hunts the whole tree again — the campaign ends when a full round finds nothing.

## 1.4.189 — Prejudice Round 1 → Friend Wave B: the 30 lows (web only)

The last open Round-1 surface closes: all 30 lows cured or proven already-cured (records: ~/workspace/logos-prejudice/cure-waveB-*.md). Round 1 now stands 125/125. Playback: the saved-render key now includes the pause baked into the audio (a changed Sentence Pause no longer replays the old silence); the resume record learns "finished", so a completed reading is not offered back as if mid-way; a clip step past the end lands a breath before it instead of converting the saved place into "done"; the browser device voice's word highlight follows its real boundary events instead of sitting on word 0; a failed render-cache census no longer silently disables saving (the record lands, the budget sweep stands down, the failure is witnessed); a book session's SKIP now goes book-to-book on every page road (shelf order, each book at its own saved place) — DECLARED: while the shell's own device voice drives, SKIP still steps a sentence inside the shell; that road is not cured here. Stored jump seconds are honored as stored — 0 means 0 (the `|| 15` / `|| 30` substitutions are gone). Library: an extensionless audio file no longer wears its name's first letters as its "format", and a duration-0 clip's record heals the first time the player learns its real length (DECLARED: a backup-restored clip with a saved place and no duration shows the estimate until its first play); a dangling EPUB package file raises a readable error, never a raw TypeError, and missing spine chapters leave no links to redirect; Undo of a temp-book deletion restores it kept, and backup restores land kept; a backup export now counts and declares the books it had to leave out (their text missing on this phone). Engines: the keep note is a list — a joint eviction reports every lost model, not just the last; the Kokoro cleanup flag is set only when the deletes actually succeed (a failure retries next launch); T4-15 was found already cured in-tree (the post-T4-11 load gate plus the stamp's own retries) and is recorded, not rebuilt. Settings/Intake: the search index was probe-proven to already carry transparency/storage/reader (M-30's cure, re-verified, not rebuilt); durations now derive from one honest table — 165 wpm English, 175 Spanish — and WebImport's speed range matches playback's [0.5, 2.5]; narrow-wrapped prose whose continuation opens with a capital joins as one sentence, and the wrap verdict is one shared rule for the reader and the book splitter; a title's " | " suffix is stripped only when it names the site; import dedupe was probe-proven to eat headings only, never refrains; a pure subscription pitch now counts as junk at any length. Presentations (system side; no lesson words changed): the probe's second localStorage key is swept — one real key again; the first-run offer is consumed only by an answer and can appear even where storage throws; overall progress credits only steps actually completed (a «Watch» landing at step 30 credits 0, where it credited 17); search titles follow the live UI language. Create/Voices: pronunciation replacements keep the source's capitalization ("TOMATO!" → "TOMAHTO!"); dictionary entries can carry a language and fire only on their own language's segments (DECLARED: entries added in Settings are still unscoped until that surface stamps a language — the mechanism is enforced at the speech point); «New» clears the Create title; a mixed-language export credits the voice that sang the bulk and lists every voice that sang (the Library record carries the list; the Library page still displays the main voice). Shell: T2-21 (a stale stored press died silently) was found already cured in 185 — both doors leave the receipt on the Settings line — and is verified, not rebuilt. Three audit probes were re-pinned to the contracts the cures established (the T1-5 jump fraction to the honest wpm table, the keep probe to the notes list, the T4-10 probe to a real digest — which also proves the C-2 certification holds end-to-end). Battery: tsc clean; presentation suites 129/129; Fence 0 11/11; λ 7/7 + 8th HELD; anchor fence GREEN; entry-seeding clean; every test/*.ts suite that the in-memory runner can load passes (two suites remain unloadable by that runner — the pdfjs `?url` limit, pre-existing on 188 — and one dead probe imports a path from another project). Next: Wave C cures Round 2's 36 lows as 1.4.190, then Prejudice Round 3 hunts the whole tree again.

## 1.4.188 — Oscar's own finding: the lesson card covered what it explains; the tablet stage was a false screen (web only)

From Oscar's tablet (2026-11-17 07:13): the Presentation card placed itself over the very function the caption was explaining, and on large screens the stage was badly adjusted — a narrow centred column that mirrors nothing about real tablet use. The bench proved both in the app's own geometry (1280×800: stage width 860 of 1280; the "header confirms your text" beat measured the card over the framed header by 36,720 px², a second beat by 7,200 px²). Root causes, decoded from the specimens: the seat was judged against rects captured while the player's own SMOOTH scroll was still travelling, and afterwards only size/scroll guards watched it — a subject that moved without resizing or scrolling was invisible; the card's height input was the LAST caption's height, so a taller caption rendered over the footprint its seat had cleared; the card GLIDED between seats, crossing the subject in transit; and beats declaring effect/subject regions could still take the legacy half-rule seat when a region measured late. The cure (record: logos-prejudice/round2/cure-t6-8-framing.md): the framing scroll is a cut, never a glide; the card's height is state, so a taller caption re-seats; a lifetime guard (mutation + heartbeat, difference-gated) re-judges the seat whenever the subject moves; declared-region beats are always judged against the footprint; geometry gained SIDE seats — beside the footprint before any seat that covers part of it; and the card no longer glides between seats at all (every seat is a birth, the fade its only motion). The stage now tells the truth on large screens: no width cap past the rail, Listen in the real two-column grid (three columns ≥1500, the desk its own column), Voices on the real voice-grid ladder, Create on its real two-column grid, Library clips in two columns, Settings at its real 1180 measure. Declared gaps: the stage's book tiles remain row cards, not the shelf's cover tiles; the acceptance sweep covered Q0's first five beats at both widths. Verification: overlap measured 0 at every sampled instant (settled and mid-transition) at 1280×800 and 390×844, the exact specimen beat included; suites 129/129, Fence 0 11/11, both λ probes hold, anchor fence GREEN, entry-seeding clean, tsc clean. (Numbering note: 187's entry promised the lows as 188/189 — Oscar's finding took this slot; the lows follow as 189/190.)

## 1.4.187 — Prejudice Round 2 → Friend Wave A: the 6 highs + 23 mediums (shell + web)

Round 2 of Oscar's campaign («ataca por todos los francos… hasta que no quede nada») hunted the cured 185 tree and the 186 merge: **65 confirmed breaks — 0 critical · 6 high · 23 medium · 36 low** (full record: ~/workspace/logos-prejudice/round2/REPORT.md). This wave cures the 29 highs+mediums (plus one low pulled forward); the 36 Round-2 lows and the 30 remaining Round-1 lows follow as 188/189, then Round 3 hunts again. **First, the confession this wave exists because of:** the 186 integration itself regressed canon — the map claimed the lane runner carried only the H-1 cure; it also carried H-28's presented-steps tracking, and the wholesale port dropped it, so a chapters jump + one tap could mark a module «seen» with 36 of 37 beats never presented (R2-T6-1, HIGH). Restored from the pre-186 snapshot and composed with P17: un-presented finishes now land in-progress at the end beat, never seen. Three more highs were the merge's own seams: the λ guarantee fell to an 8th specimen (during the opening phase the stage rendered unshielded and its λ button was a live write — a tap before «Empezar» flipped the real switch, and a kill there left it flipped; cured by holding seed-mode across the opening phase + a pointer-events shield in the player, and the specimen is now an in-tree probe, lambda-guarantee-8th.probe.mjs, HELD); a transient entry miss deadlocked the opening phase (reveal retries scheduled on the held clock could never arm, and the snapshot never showed opening=true — both halves cured); P14 stranded Interactive lessons on any backgrounding (was-playing is now recorded for both modes). Presentation mediums: seedBefore consults livedPerformed; a blocked opening's «Ahora no» now finalises the miss (needs-refresh + skip on record — the engine suite's old pin asserting the discard was re-ruled to the new contract); withWatchLanding spreads the whole record (the 186 fields survive a «Watch» landing). Playback: the PlayheadGate can no longer freeze forever after a mid-track speed drop (setRate re-anchors the gate; a bounded honest-travel re-base covers the rest — the anti-teleport spine is untouched, probe 21/21), and a page reload during a shell-native session adopts it honestly instead of retiring the card over a live reading. Shell (Kotlin, mechanism-verified; CI compiles before this publish is declared live): the backstage drain gained a page-epoch witness (a reload's own init push can no longer earn it; MainActivity reports each finished load), pendingKey ages by the same 20-second law at the dedupe door, every poke keeps its own watch (a burst against a hung renderer stores every press, in order), backstageServe returns true only when it served something (the stall watch can fire again), and the page's context slot has a single writer (R2-T2-5, cured early). Library: every clip write runs in the per-id queue (a deleted playing clip can no longer resurrect), blob-free patches write the twin alone, a content-less phantom book heals by re-import instead of trapping the file forever, Listen's back-to-book writes the pos+progress+done triple, and both databases answer a blocked upgrade honestly instead of spinning forever. Engines: certification now measures — Phonon against the pinned commit's true per-file sizes, Pocket by hashing the body with C-2's own SHA-256 against the key's digest (presence and size alone certify nothing). Settings/Backup: mig140's healing proof now examines every field its apply branch touches (a live voice override can no longer be destroyed by a "proven" fingerprint), clip validation runs at the depth consumers require (a malformed text clip is refused at the door, before any write), and backup merge/rollback read the full book record — restores no longer strip the phone's own covers (closing L-4's cover half too). Create: a second export admission inside the pre-flight window queues instead of double-rendering (probe 11/11 with a negative control). Intake: the sentence gate knows Spanish openers (el/la/los/las, ¿, ¡, quotes) without welding true joins, list-shaped newline blocks stay list items while wrapped prose still joins, a bare numeral line is a chapter only with heading evidence, and a lying encoding prolog is detected — the book decodes as the UTF-8 it is and carries a warning naming the lie. Battery: tsc clean; presentation suites 129/129; Fence 0 11/11; λ probes 7/7 + the 8th HELD; anchor fence GREEN; entry-seeding bench clean; every cure flipped its hunt probe or stands mechanism-verified in its office record (~/workspace/logos-prejudice/round2/cure-track-*.md). Honest unverifieds, stated: the four IndexedDB cures are mechanism/probe-verified in node, not yet on a device; Pocket certification now hashes the 177 MB body per probe cycle — device cost unmeasured. Presentation review: no lesson's words changed; the blocked-opening exit now writes the record its own law always promised.

## 1.4.186 — The Presentation lane's 18 principles, integrated (web only)

The 🐆 Present - Logos lane's complete 18-principles delta, integrated onto canon per its INTEGRATION-MAP (INTEGRA, NO REEMPLACES — no lane file replaced a file canon had moved). What landed: the opening window (P1 — every entry, «Watch» landings included, opens behind it and «Empezar» confirms at the entered place; an unconfirmed exit writes nothing); the pace recalibration (P2 — labels unchanged, the physical rate behind a label is now label/2, so the new 1× is the old 0.5×; a stored old-scale speed is discarded once to label 1 by the normaliser, never reinterpreted); two-phase beats (read, then perform, then the result rests 1 s); the birth latch; the veil at exactly 45% with the ✕ window centered on the screen; footprint framing (control + effect union, the subject in a dashed box); frame riding; declared gesture listeners (P12 — click, not pointerdown); background pause + persist with mode and pause restored as recorded; the strict honest ending (P17 — any skip, seed-misses included and persisted, ends the module needs-refresh with the tally declared on the end card); 156 effect/subject annotations across the 20 scripts; Q2/AD1/AD12 declare what they leave or cannot show; AD14 restores the theme it changed; the index names Android-only modules on their own cards. **The λ reconciliation (the wave's safety core):** the lane's fiction ledger decides what a λ act MEANS (lambdaOn() reads the ledger only — replay can no longer invert against the real switch's position), canon's C-1/H-1 discipline decides when the real switch may be WRITTEN (seed-mode bracket + performSeeded — zero real writes during seeding) and guarantees it is put back (capture at creation, compare-current restore on the one teardown funnel, host net behind it). The guarantee is now an in-tree probe — scripts/presentation/lambda-guarantee.probe.mjs, seven call-log specimens including the kill-and-resume case — and it HOLDS. Two honest notes: (1) the stage's λ dot now shows the FICTION state (it starts at the fiction default), not a mirror of your real switch — intended by the ledger design, declared here so it is not misread as a regression; (2) the map claimed the lane runner already consumed resumeFrom — it did not; canon's H-26 launch point was re-implemented inside the lane's prepare (stepId → step → scene, outranking the record), and M-34's seed-gap landing is superseded by the lane's blocked-opening design (a required entry miss blocks the opening phase instead of landing past a gap). One lane probe needle was amended to the merged call shape (prepare with resumeFrom); its invariant — prepare, never start — stands. Battery on the merged tree: engine 92/92, catalogue 20/20 (M-37's resumeHead block substituted per the map), player 17/17, Fence 0 11/11, anchor fence GREEN, entry-seeding bench clean, λ probe holds, tsc 0 errors. **Decisions riding as built, for Oscar's review:** P2's doubled wall durations at the same labels; the Stay-here window staying in the card (the ✕ window is the centered one); P12's click feel; P17's strictness (Cadence's softer rule diverges — unification is his call). Presentation review: this wave IS the presentation system; the lane's §2.6 bench list (12 items) remains owed in the lane.

## 1.4.185 — Friend Rule cure, wave 3: the 60 mediums, audited (live; shell CI run 114 after a one-word compile fix — peekPendingPress is private)

Wave 3 of four; full record in ~/workspace/logos-prejudice/cure-wave-3.md. The wave was worked by 15 offices whose coordinator left before closing it, so this entry rests on a finisher's audit of the tree itself — six audit offices re-derived every verdict from the current code, probes re-run wherever one exists. The honest count: **49 of 60 mediums cured; 2 never touched; 9 incomplete**, none rounded up. Playback is whole: the card no longer claims PLAYING through "Preparing…", jump keys leap true seconds at any speed and stay in device mode, paused seeks keep their fraction and never start sound unasked, Continue never offers the on-stage book back to itself, the render ledger is one serialized chain that counts the store, renderKey and the now-reading fingerprint are full-text dual hashes (T1-13, the one unapplied cure, was applied at closing), and recordings now reach the media card without a borrowed SKIP. Engines and Settings are whole: the offline probe certifies per language, cache-write failures speak instead of succeeding silently, Delete model clears its keep stamps, eviction is re-checked all session, backup import validates the whole file before writing a byte and merges by one stated rule that never silently rewinds. Library: content is sniffed before it is routed, decoding honours BOM/declared/UTF-16 with warnings that now live on the tile, in the menu and on the book's first screen; duplicates return the existing book with its progress; positions clamp; a done book re-opened at the start un-finishes truthfully. Presentation: FAMILY_SCOPES is deleted outright, the picker group resolves to its section, hidden elements no longer resolve, the stage λ button has a real hand. Create/Voices: previews are real renders through the engine, pronunciation no longer cascades or fires inside words, an explicit Create voice wins every segment, and the picker can no longer hide the active voice. Intake: honorifics and initialisms hold their sentences, bare domains are recognized, WebImport's overwrite carries an Undo. **The mop-up (same night, parent desk): all 11 remainders closed — the wave is 60/60.** T2-16: the numbered set is complete — 1200 shipped faces now cover every legal value 1–600 in both directions (the runtime-bitmap road is impossible on the framework MediaSession, whose custom actions take resource ids only; the name-resolution mechanism already handled any value). M-3: the sub-200-char refusal is gone — only a PDF with no readable letter at all is refused, with a truthful message. T2-10: stored presses carry identity numbers; the backstage drain names the poked press by number and is earned by its own evidence (a push whose content moved, in the press's own context). T2-11: the seek bar and the sentence scrub poke through a watched door that wakes the page on silence. T2-17: the panel lever's mark stands until the page consumes it, however long it slept. T2-19: the page now reads the shell's session stamps and checks them at execution — a stored verb (and a stored seek) can no longer land on a different book, clip or draft than the one the panel showed, recovery included. M-10: the deleted book's draft purge compares by identity (nowReadingFor) — probe 7/7. M-11: books read from a blob-free twin store (bookmeta, DB v2, backfilled at upgrade); covers are fetched one at a time when a tile or a backup needs one. T6-12: an unlandable landing's declared reason now reaches the learner — worded honestly in search «Go», and spoken by toast after a stay-here that cannot land, instead of silence. F8-5: plain abbreviations hold their sentences again — probe 11/11. F8-8: a typed-but-never-played draft evicted by a clipboard arrival leaves a persisted card that restores it (unplayed) when the clip ends, and the Undo window is ten seconds with that card standing behind it. Full record: cure-wave-3.md + cure-wave-3-mopup-shell.md + cure-wave-3-mopup-ts.md. Presentation review: no lesson's words changed by this wave; T6-8's declared consequence stands — beats that relied on the silent first-match now miss honestly and are flagged to the script lane, not re-pointed in silence.

## 1.4.184 — Friend Rule cure, wave 2: the remaining 24 highs (in tree, awaiting publish)

Wave 2 of four; full record in ~/workspace/logos-prejudice/cure-wave-2.md. Playback: the publisher speaks the fresh page's inactive truth once at load (the stale-card chain closes); handToShell tells the truth (playing: true) and a native→page progress channel now exists end to end (NativeSpeaker snapshot + "nativepos" poke + bubbleNativePos pull, proportional mapping for foreign segmentations) so panel, fold, resume and Play follow the device voice; the playhead is bounded by the audio clock, not event count — throttled replays cured, anti-teleport kept stronger. Shell: utterance callbacks are scoped to flight + generation (pause no longer skips; corpses no-op); the ghost stamp is set only where a ghost visit truly begins and every human arrival clears it. Library: deleteBook runs in the write queue behind the reader floor (shelf delete passes force), clips got the same queue, put/delete are single two-store transactions and Undo is offered whenever a meta existed. Engines: short bodies refused for every asset; both engines' "downloaded" probes verify real bytes (Pocket: manifest size; Phonon: integrity pass + all four files); cached state is per-engine; both load watchdogs run on a real clock; dropWorker settles its waiters; Phonon loads are generation-stamped so zombies die inert. Presentation: «Go» resolves through the registry's own resolver (89 land, 9 honestly unlandable, 0 silent; the unfold precondition parses 29/29 — T6-7 cured early); resumeFrom is wired through to the runner; Watch merges instead of clobbering; «Seen» now requires the steps to have been presented. Settings: voice ids must exist in the catalogue; load() sanitises every field it reads; the backup now carries the whole clips Library, blobs included (ad14's "clips are not inside" line is now false — relayed to the Presentation lane, not edited here). Intake: normalizeUrl keeps balanced parentheses. Every cure flipped its hunt probe; the three Kotlin cures stand re-read-verified. Presentation review: no lesson's words changed by this wave; H-26's launch point rides Wave 1's λ-safe seeding.

## 1.4.183 — Friend Rule cure, wave 1: both criticals + the eight worst highs (in tree, awaiting publish)

Oscar ordered the cure with the same intensity as the hunt: «fabrica la cura… para cada problema.» Wave 1 of four, built in-tree by six offices under the Friend Rule; full record in ~/workspace/logos-prejudice/cure-wave-1.md. C-1/H-1: the lessons' λ door now captures the real bubble switch at entry and restores it on every exit (scenario teardown + host net, idempotent), and entry seeding absorbs λ internally — the presented demonstration still genuinely flips the switch. C-2: Pocket downloads are SHA-256-verified against the digest their cache key carries before anything is stored, cache hits included; poison is evicted, never trusted (the upstream pin remains Oscar's to rule — it needs trusted values). H-2: a reader floor makes the open book unsweepable, deterministically. H-3: the corpse checks test the real never-pushed condition (nowAt == 0). H-4: migration flags flush only after the payload lands, with a one-time shape-gated healing pass for already-burned devices. H-5: backup import restores settings through a sanitizer; the false footnote is gone. H-6/H-7: both clipboard dedupe keys now fingerprint the whole text (SHA-256 shell-side, dual cyrb53 page-side); manual bypasses verified intact. H-8: TTS init has a 10-second watchdog, an honest failure receipt, and a retry on the next play press. Every cure flipped its hunt probe (82 in-memory checks) or stands mechanism-verified by re-read (the three Kotlin cures; CI compiles at publish). Presentation review: the λ cures change the door's bookkeeping, not any lesson's words; the seeding invariant the bench protects is preserved (55/55 + bench clean).

## 1.4.182 — The panel's numbers, one more step down (shell + web stamp)

Oscar, with a crop of 181's transport row: «Again, make the numbers smaller.» One more step of the same size: the panel jump numbers go 10 → 9 dp, baseline lift 3.6 → 3.2 in step. Just that. Presentation review: no teaching surface touched.

## 1.4.181 — The panel's numbers a little smaller (shell + web stamp)

Oscar: «Now make the numbers in the round arrows for the floating player be smaller too, but a little bit. Just that.» The seconds inside the panel's jump keys: 11 → 10 dp, the baseline lift shrinking in step (4 → 3.6) so the number stays centered in the ring. Just that — nothing else moves. Presentation review: no teaching surface touched.

## 1.4.180 — The panel's arrow breathes in, ten percent (shell + web stamp)

Oscar, on 179's panel: «Now it's much better. Reduce the size of the arrow a little bit too from the bubble player, just a little bit. Perhaps 8% or 10%.» The panel jump keys' drawn arrow scales by 0.9 — arc radius dp(10) → dp(9), head tip 4.6 → 4.1, half-base 4.2 → 3.8 (in jumpBtn's onDraw). The disc (42dp, from 179) and the seconds number (dp(11)) keep their sizes; nothing else moves. Presentation review: no teaching surface touched.

## 1.4.179 — The numbers get onto the card; the panel's proportions settle (shell + web stamp)

Two orders from Oscar, 2026-11-15, each with his screenshot. (1) The media card, wearing 178's larger arrows: «the notification player still doesn't have the numbers there. Fix that.» The fork offered in 178's delivery is settled by the order itself — the numbers go on. Session custom actions take only resource icons, so the seconds ride as SHIPPED PICTURES: 36 PNG faces (drawable-nodpi, generated by ~/workspace/logos179-gen.py with the settled recipe at bitmap scale) covering the round values — 5–60 by fives, then 75, 90, 120, 180, 240, 300 — and `jumpActionIcon(sec, dir)` in PlaybackService picks the face the live prefs name, cached. Outside the set the plain arrow stands and the action's name still tells the seconds truly: no number rather than a wrong one. (2) The floating player, opened by his new word for exactly this («I just made up my mind…» — the 178 hands-off covered the panel's glyph, not its proportions): the jump keys shrink to their rank under the toggle (speed/jump/toggle 38/46/54 → 34/42/54, in the factories and in fitControls alike), and the play glyph is optically centered. Measured on his screenshot before touching anything: the five discs were symmetric to the pixel and the gold disc's center sat at the panel's exact center (352.0 vs 351.5) — what leaned left was the play TRIANGLE's mass inside the disc, as a right-pointing triangle's does. The refresh now nudges the play image 3dp right inside the disc (paddingStart 6dp); the symmetric pause bars take no nudge. Nothing else in the panel moves. Presentation review: no teaching surface touched.

## 1.4.178 — The rings grow so the numbers can breathe (web + shell)

Oscar, 2026-11-15, with three screenshots: «in the main app, the numbers stay at the center, but the round arrows sit too close to the numbers. The round arrows should be larger… to provide enough room for the numbers that sit at the center of the buttons. And with regard to the notification player, they don't even have the numbers that they should have. They are empty and they are small… Both of them should follow the same logic… Leave the floating player alone. It is good as it is. Do not touch it.»

The glyph grows by its own recipe: the arc's radius 7.9 → 9.4, its center settling at (12, 12.9), the head re-derived at the new radius (base centered on the arc's end, as 174 settled), the number a touch smaller (0.40 → 0.38 of the key) and seated 1px lower to meet the ring's true center. Applied to the main player's JumpKey (player + mini player) and to the media session's two vector faces (ic_jump_back / ic_jump_fwd), so the card's arrows follow the same logic and read larger. The bubble panel is NOT touched — its canvas drawing keeps the 174 geometry, at his explicit word. The shade notification's bitmap buttons are not touched either: they already draw the live numbers.

The one thing this wave cannot do, stated to Oscar plainly in the delivery: the system media card draws its buttons from FIXED resource icons the app ships, so a number that follows Settings cannot be printed inside the card's arrows — the seconds live in the actions' names there, and drawn live on the shade notification's own buttons. Burning today's numbers into the card icons as pictures was NOT done silently: frozen numbers would lie the day he changes Settings. That fork is his to call, and it is put to him in the delivery message. Presentation review: no teaching surface touched.

## 1.4.177 — Each search lives with what it searches (web only)

Oscar, 2026-11-15, with two screenshots of Settings: the lesson search («Find a lesson or a function») stood inside the Learn tray, OUTSIDE the Presentations card — «the search bar is misplaced… For presentations, it should have its own integrated search bar, but after I open presentations, not outside… And if that is not the search bar for the general settings, add one at the very top, following the same standards.»

Both halves done. (1) The lesson search moved INSIDE Presentations: `PresentationsCard` gained a `searchSlot` prop, rendered at the head of the opened index, and Settings passes `PresentationSearch` through it; the block itself shed its card wrapper (no card inside a card). It appears only after Presentations opens — its home is the index, as the Presentation law's search always implied. (2) A general Settings search now stands at the very top of the page, in the same field grammar (same label, same 48px field): `SettingsSearch` + a `SETTING_INDEX` of the nine cards (Neural voice, Pronunciation, Playback, Floating player, Appearance, Language, Presentations, Backup, About), matched in both languages (titles, subs and a keyword line each, diacritic-stripped). A tap lands home the house way: it unfolds the target card where it lives (its own header, clicked only if folded) and scrolls it into view — the search never paints a copy of a setting. Presentation review, for the lane: the index gained the searchSlot seam (presentation-index.tsx) — the search's seat is the one furniture change; no lesson, anchor or stage behavior changes.

## 1.4.176 — The card's side buttons come back, wearing the arrows (shell + web stamp)

Oscar, 2026-11-15, with his screenshot of the finished card wearing a lone play button: «The latest update removed the two buttons responsible to forward and backwards the audio. Bring them back with a new design when listening to a singular book or text. By that I mean the arrows and the specific number chosen in settings.» The removal was 172's, and its reasoning failed on his phone: a text session stopped declaring SKIP_TO_NEXT/PREVIOUS, predicting the system's media card would fall back to REWIND/FAST_FORWARD for its side slots. It does not — the card showed nothing at the sides, and 173's (correct, dictation-mandated) sleep left the finished card the same way.

The jumps now ride as the media session's OWN custom actions on every reading — book, text and finished alike: `jumpback` / `jumpfwd` custom actions on the PlaybackState, handled by the callback's new `onCustomAction` into the same `act()` road the shade buttons use. Their face is the corrected arrow, as two new vector resources (`ic_jump_back` / `ic_jump_fwd`, the 173/174 geometry). The platform takes only resource icons for session actions, so the drawn number cannot ride on the card — the seconds live in the action's name («Jump back 15 seconds»), read live from the same bubble prefs the shade's numbered bitmap buttons draw from; the shade notification keeps the numbered faces themselves, untouched. SKIP's seat is unchanged (books keep it, texts never declare it), and the 173 sleep is NOT touched: the session still sleeps while no sound flows. Whether Samsung's panel renders custom actions for a sleeping finished session is the one thing only his phone can answer, and it is stated to him as such. Presentation review: no teaching surface touched.

## 1.4.175 — The tour offer moves to the center of the screen (web only)

Oscar, 2026-11-15, with his phone's screenshot: the first-run offer («New here? Logos can teach you itself.») stood in flow at the top of the Listen page — «The tour card should be at the center of the screen, not at the top, to make it difficult to miss.» It now opens as a centered window over a dimmed world: the presentation family's veil (darkened, slightly desaturated, never blurred) takes the taps, and the card sits at the screen's center in the house's sheet grammar (same seat, same popIn entrance). The offer's terms are unchanged — once, never imposed, Start the tour / Not now — only its seat moved. Web only; the shell stays 1.4.174. Presentation review: this IS the presentation system's own door; no lesson, anchor or stage behavior changes.

## 1.4.174 — The arrowhead sits centered on the circle's turn (web + shell)

Oscar on 173, 2026-11-15: «Ahora sí está mejor, solo que la flecha necesita centrarse más en la vuelta del círculo… la cabeza de la flecha está demasiado arriba y entonces el círculo no se centra en el centro de la base de la flecha.» Right again: the head's base trailed behind the arc's end along the tangent, so the head rode high and the ring met the triangle off its base's center. The base is now centered exactly ON the arc's end — the ring's line passes through the middle of the base edge — in the player's JumpKey, the panel's canvas keys and the shade's bitmaps. Paint only; nothing else moves. Presentation review: no teaching surface touched.

## 1.4.173 — The arrows, corrected to his reference + the dictation autoplay, closed at its door (web + shell)

**The arrows (his verdict on 172, 2026-11-15 09:29 EST: «Esas no son flechas. Literalmente las flechas están invertidas… Van hacia atrás, no hacia adelante.»)** He was right, and the error was structural: in 172 the head straddled the arc's START, with the shaft extending in front of the tip — the arrow flew backward. Read off his reference image itself this time, the true recipe: the arc runs nearly the whole circle (310° of sweep) and ARRIVES at the head; the head is a closed filled triangle straddling the arc's END, its tip pointing along the travel into the small gap at the top, toward the arc's free tail. Forward: arc starts at the upper right (−55°), sweeps clockwise into a head just left of the top, tip pointing right; backward mirrors it (start 235°, head just right of the top, tip pointing left). Applied identically in the player's JumpKey, the panel's canvas keys and the shade's bitmaps, and bench-rendered against his reference before shipping. The 172 entry below stands as the record of the miss.

**The dictation autoplay.**

Oscar, 2026-11-15: he finishes dictating with the keyboard's mic in another app, and the stopped Logos audio starts by itself — «perhaps it does it only one time». A full census of every road by which speech can start without his hand (his law: diagnosis first) found the culprit, and it was one of ours: **the 1.4.160 finished-reading park**. When a reading finishes, the page leaves the session active and the shell published it with `isActive = playing || finished` — the parked session held the phone's media-button router indefinitely, and the stray PLAY that a dictation session's start or stop shakes loose on this phone (the exact event the 1.4.154 sleep was built against) landed on it and restarted the reading from the first sentence. The one-time shape is the park's signature: his corrective pause is a mid-reading pause — the one state that sleeps — so the next dictation finds no door; and every finished reading re-arms it. His material made it his common case: short copied texts finish quickly.

**The fix separates the card from the session.** The finished CARD stands exactly as before, and its own buttons keep the replay road (they travel the service's intents, which reach the callback awake or asleep — a tap on the finished card still replays from the first sentence). The SESSION now sleeps whenever no sound is flowing, finished or paused alike: `isActive = playing`. The price is named, not hidden: the headphone button can no longer replay a finished reading, because a sleeping session is a door that button cannot open — that was the 160 wish, and the dictation verdict closes the trade.

**Two smaller doors of the same family, closed by the same principle.** (a) A pause taken during «Preparing…» used to leave `buffering` standing, and both publishers counted buffering as playing — the shell session stayed awake claiming PLAYING after an honest pause; `pauseImpl` now cancels the claim, and both publishers report sound only (buffering rides its own `busy` flag, as it always could). (b) The page's web Media Session handlers (a second framework session inside the WebView, which the 154 sleep never covered) are no longer installed inside the app at all — the shell's session is the only media face there; in a browser, where no shell exists, they install as before.

**Presentation review.** No anchor, surface or behavior of the lessons changes; the stage's sessions are fiction and never publish to the shell.

## 1.4.172 — The jump keys learn to be arrows (web + shell)

Oscar, with his reference in hand: the 1.4.163 jump keys «no parecen flechas». Two faults, one in the drawing recipe all three surfaces shared. The head was an OPEN chevron — two stroked lines meeting at a point — where his reference (and every standard rotate glyph) wears a CLOSED, filled triangle. And the arc swept 290°, a near-full ring that read as a circle and squeezed the number inside it. The widget (the bubble panel) wore it worst; the main player and the notification shade carried the same recipe.

**The corrected glyph, one recipe everywhere.** The arc opens at the top — 250° of sweep, its head near one o'clock — and the head is a single filled triangle STRADDLING the arc's end: the tip leads past it along the tangent, the base trails behind it, so the arc flows into the head and the whole mark reads as one arrow. The number sits in the open middle with air around it. Drawn identically in the player's `JumpKey` (now a hand-drawn SVG in chrome.tsx; the borrowed Lucide rotate icons are retired from this duty), the panel's canvas keys in BubbleService, and the shade's bitmap icons in PlaybackService — the key looks the same everywhere it lives. The seconds, the commands and the seats are untouched; only the face changed.

**The card's buttons transform (same wave, Oscar's screenshot).** His media card wore track-skip glyphs (⏮ ⏭) over a pasted text. His ruling: between books the track seat is right; over a text those buttons must become the jumps. A text session no longer declares SKIP_TO_NEXT/PREVIOUS to the system at all — the card's side slots fall to REWIND/FAST_FORWARD, which since 1.4.163 ARE the jumps by his configured seconds; a book session declares both vocabularies exactly as before. The distinction rides the publish the page already sends (`book` carries a title only for a book). The system's card draws its own faces for the standard buttons — what the session controls is which buttons exist; the numbered arrows remain the shade notification's own buttons, as they were.

**The bubble's preselected size (same wave, Oscar).** Standard is the preselection: the default was already 'm' on both sides of the bridge, so a one-time migration (logos.mig172) lifts a stored Small — from before this word — to Standard; a Small chosen afterwards is the user's and stays.

**Presentation review.** Paint only: no anchor, id or behavior changed (the stage's jump keys are its own drawing and keep the stage's face, as before).

## 1.4.171 — Settings learns clusters (web)

The house pattern arrives at the last flat Settings page in the fleet. Oscar pointed at his memory instead of explaining — the pattern is consecrated there (born in Vela, kept in Brizna 1.5.81 and Faro 1.3.285) — and this wave applies it to Logos exactly as written: sunken trays grouped by territory, each with a short name in the app's voice and one line saying what it holds; the cards inside intact (content, anchors, ids untouched); the loose pieces at the foot, outside the trays.

**The five territories.** *The voice* — Neural voice, Pronunciation. *Listening* — Playback, Floating player. *The screen* — Appearance, Language. *Learn* — Presentations (search and index). *Your data* — Backup. About Logos and the version line stay loose at the foot, as the pattern prescribes. Two cards changed seats to make the territories true: Playback and the Floating player moved below Pronunciation, so The voice holds both of its cards and Listening both of its own — moves of whole sections, byte-identical inside (verified: every `set-*` anchor still resolves exactly once).

**The tray.** Painted from the active theme's tokens under the Calibration Law: one tone under the page (`text 4%` over `bg`), the 1px edge stack (hairline, top light, short shadow), never a big jump of light. Each theme keeps its grammar — Tron lights the tray's fillet in its sovereign cyan with the glow contained in the edge; Cyberpunk prints flat, signal yellow only on the top fillet and the tray's name; Legacy light gets a white top light. At tablet widths the masonry distributes by tray (`break-inside: avoid` on the cluster), as the fleet's houses do.

**Presentation review.** Every settings anchor survives exactly once in the same cards; the lessons' landings are unchanged. The fiction stage keeps its own flat Settings arrangement for now — mirroring the trays on stage is a refresh item for the Presentation lane, stated here, not silently absorbed.

## 1.4.170 — The bubble names itself; its cards learn calibration (shell)

Two orders Oscar gave from the Cadence workshop (2026-11-14 22:41–22:42), relayed to this desk.

**A held disc speaks its name.** The panel footer's three discs — Paste, Listen, Hide — were glyph-only, and a glyph you cannot name is a guess. Now a short hold (480 ms) floats a small pill above the disc with its name (Pegar / Escuchar / Ocultar in Spanish), with a haptic tick; the release that follows a hold does NOT run the deed, and a plain tap works exactly as before — same press squash, same actions. The pill wears the panel's own family in every theme, flat-faced with the calibrated edge (hairline, whisper of top light, short shadow), takes no touches, and dies with the finger, with the panel, or with the service. Built into `footBtn` itself, so the three discs share one behaviour and one code path.

**The popup cards under the Calibration Law.** Every explainer card the bubble raises (Save to Library, Lock/Unlock the stage, the ⚑ mark, Remove the bubble — one renderer, `showHintCard`) carried the exact defect Oscar diagnosed in Vela: a white-ish wash across the top half — here a diagonal rim blazing gold from the top-left corner plus a radial gold glow breathing over the top 96 dp, switched on a breath after the card arrived like a lamp. His recipe, applied literally: separation is a band, not a direction. The face is now ONE family tone, flat (a single `cardPal` blend, no top-to-bottom ramp); the edge is the 1px stack — a hairline rim whose light lives only at the top and dies down the sides, a whisper of family light (10% of the family's gold) that dies inside the top 30 dp, and a short shadow (elevation 24 → 10). The lamp beat is gone; the card arrives in one settle. The dimmed-world scrim behind it (his 1.4.152 pick) is untouched.

**Presentation review.** Shell-only plus version strings: no anchor, surface or beat is affected; the stage's About line follows the version as always.

**Verification, stated plainly.** The shell has no bench: what is proven here is the code (one renderer, one button factory, teardowns on every exit path) and the CI build. The feel — the hold's timing, the pill's seat, the card's new quiet — is judged on Oscar's phone, as every bubble wave has been.

## 1.4.169 — The electric themes come alive (web)

Oscar's enrichment orders (2026-11-14, with the Tron Legacy / Tron Ares / Cyberpunk 2077 posters as references), built the house way: research first, as a team — a scout dissected Weekly's Tron, two choreographers censused where each colour actually lands in Logos today. One correction the scout brought back: **Weekly has no starfield.** What reads as shooting stars is a beam system — thin bars of light with white-hot heads crossing the header (cyan out, amber back) on long rest cycles, over a static grid-and-circuits ground. That recipe, re-derived for Logos's chrome, is what shipped.

**The beams.** Pseudo-elements on chrome that already exists: the top bar carries cyan out (8.5s, delay 1.2s) and amber back (delay 5.45s, so they alternate like traffic); the dock carries amber (10s); the rail carries a vertical cyan beam for tablets. The sweep is ~15% of each cycle — the rest is darkness, which is why they read as shooting stars and not as a marquee. Tron glows (Weekly's exact gradients: tail → colour at 78% → white-hot head at 96%, soft shadow); Cyberpunk prints the same geometry FLAT — a yellow bar across the top, a magenta one back across the dock, a yellow one down the rail, no halo anywhere. Under Tron the ground also gains Weekly's circuit tile (one SVG layer over the 44px grid, nodes and all — including the discipline that beams live on chrome, never on a root wrapper). All ambient animation is gated behind `prefers-reduced-motion: no-preference`, runs on transform/opacity only, and pauses wholesale while the tab is hidden (`html[data-hidden]`, App.tsx).

**Tron: orange becomes the user's colour.** The census was blunt — orange had exactly four consumers in the whole app. Now: every favorite star wears it (voices collapse their first/later split into orange; clips, shelf covers and the desk's star follow), progress fills warm as they advance (player, book, desk and meter bars run cyan→orange, the thumb stays ice), the desk's picked favorite voice is orange, external book links wear it at full strength, and the amber horizon in the aurora rises (.05 → .09). Cyan keeps ~three quarters of the coloured weight — the play key, nav, brand, reader light are untouched. **Ares red** arrives as a new token (`--ares #ff1e14`) under one rule: light, never ink — the Listen eyebrow's live dot glows with it, the player card carries a red hairline along its bottom edge (every card's top seam is cyan; the stage's underside is Ares), and the Settings swatch gains a red sliver so the picker itself promises the trio. Error red stays what it always was: flat text beside its word.

**Cyberpunk: magenta becomes the user's neon, danger becomes red.** One token value moves — `--danger` #ff2a6d → **#ff3131** — and every error and delete inherits true red automatically, so magenta leaves the danger seat entirely and can never be confused with it again. Magenta (`--neon`) takes the marks a user's own hand makes: later-starred voices (their cyan halo dies — flat print), clip/book/desk favorite stars, and the reader's marked passages (wash and margin bar). The visualizer gains an undertow: `--viz-edge` exists only in this theme, feeding the waveform gradient's quiet outer stops magenta while the centre stays yellow — the poster's yellow signal over a magenta city. The hazard stripe gains one red tooth in its cadence, the magenta aurora corner rises (.05 → .08), and yellow's leftover blurred halos (progress glows, the live dot, the slider lock, the brand mark's glow) go flat in the same stroke, so the new colours never look more disciplined than the sovereign. Legacy is untouched everywhere; the shell keeps its 1.4.165 dress (its own ordered wave is next on the board).

**Presentation review.** Paint, background and swatches only: no anchor moves, no beat reads a colour, the stage keeps its own dress. Nothing for the lane in this wave.

**Verification.** Rendered in both themes at phone and tablet widths with the beams caught mid-sweep (bench-only negative delays on the real elements): Tron Listen with the circuit ground, the amber beam crossing the top bar, orange stars and warming progress; Cyberpunk Listen with the flat yellow beam, magenta undertow in the visualizer and magenta marks; Settings in both, swatches wearing their third colour. Legacy rendered once more to prove it did not move. Oscar's devices remain the judges — above all whether the beams' rest feels like the Grid's traffic or like noise; the delays are one-line tunings if his eye disagrees.

## 1.4.168 — The tablet gets its treatment (web)

Oscar's tablet orders (2026-11-14, with his Tron tablet screenshot and a crop of the damage), three changes, all wide-screen only — the phone's layout is untouched except where noted.

**The desk's third column holds his books now.** The TextMap's second card mapped the current text's paragraphs — the very words already on stage in the main window, repeated. It is a bookshelf door now: the books he starred as favorites, newest-touched first, each row the title, author and reading progress with its star; tap and the book opens. With no favorites yet it shows his books instead, with one quiet line saying a star in a book's menu pins it here. The star itself needed no building: books already carry it (`BookMeta.fav`, the shelf menu's «Add to favorites», the star badge on the cover, the Favorites filter) — papers and PDFs are books in Logos, so they were covered by the same door. The stats card above it («This text») is untouched: numbers about the text, not the text repeated.

**Continue Listening moves below the player on tablets, and stays.** Stretched across the top, the card spent the listening folded away (the phone's 1.4.159 behaviour) — on a tablet there is room, so there it now renders in the side column, directly under the player, always present while there is something to continue. The phone keeps its fold exactly as 1.4.167 left it. The card is the same component with the same anchors; only its seat changes with width.

**The sliced «DEFAULT · …» flags.** His crop showed the voice cards' default flags with their text cut at the card's top border. Two faults compounded: the flag straddles the border (top: −7px) while `.voice-card` lives under `content-visibility: auto`, whose paint containment clips whatever crosses the card's edge; and the pill's own height was only a line-height, free to let the glyphs ride up. Default cards (at most two — one per language) now step out of content-visibility, and the flag carries a fixed 15px height with flex centering, so the text sits in the pill's middle whatever the font does. The general lesson is his order's own wording: text cut by the borders of its boxes is a defect of the box, never of the text.

**Presentation review (the lane's maintenance law, stated here as required).** Affected: module AD13 («Large Screens»). The real app no longer renders `desk-textmap-paragraphs` — the anchor record stays in the registry because the fiction stage still carries the card, and AD13's tap-a-paragraph beat (`ad13-textmap-tap`) now teaches a surface the real desk has replaced; its stats beats and every desk anchor in TabletDesk (`desk-tablet`, `desk-book`, `desk-fav-voices`, `desk-recent`) are untouched and still true. The new Favorite Books card deliberately carries no anchor — minting one is the lane's design to make, flagged here as a coverage item alongside the AD13 refresh. The Continue card's move changes no anchor (the same rows resolve in the stage as before); the stage's own desk and Continue seats are the lane's to mirror when it refreshes AD13.

**Verification.** Rendered at 1600×900 against a seeded bench library (a starred book at 42%, a plain one): the third column shows «Favorite books» with the starred book and its progress, the stats card above it, no paragraphs card anywhere; the Continue card stands below the player in the side column and — with a session playing in the bench — stays standing, while at phone width the top fold behaves exactly as 1.4.167 measured it. The Voices page at tablet width shows both default flags whole, text centered in the pill, nothing sliced. Oscar's tablet remains the final judge.

## 1.4.167 — One clock for the stage, and the wheel not reinvented (web + shell)

Two orders from Oscar's phone (2026-11-14, late), each small, each about feel.

**The Continue card learns the stage's clock.** While audio sounds, the Listen stage settles into its immersive shape: the bottom bar glides away and the page's own padding follows, both riding `--glide` (.95s in, .76s back, `--ease-glide`). The Continue card's fold (1.4.159) kept its own quicker clock — .38s — so the card vanished first and the eye read the mismatch as a jump: «Actualmente, Continue Listening se oculta primero y parece un salto brusco.» The fold now carries the glide's own values per direction (closing: `grid-template-rows var(--glide) var(--ease-glide)`, opacity on the bar's delayed curve; opening: the bar's return values), so the card, the bar and the page hide and return as one movement — «Esa sincronización hace que se vea más premium.» The fold's condition is unchanged (the reading, a recording, buffering), and on tablets the card's placement work is a separate order still on the board — this wave touches timing only. The Presentation stage was reviewed against the change, as the lane's law requires: its Continue card never animates (a standing folded tint), no anchor or beat reads the fold's duration — nothing there moves.

**The paste disc takes the standard glyph.** The panel's paste disc (1.4.162) wore a drawing of my own — a board, a clip, an arrow coming down into it. Oscar sent the symbol itself, two overlapping pages, with the standing order: «Miren, no reinventen la rueda. Este botón para pegar.» The disc now draws exactly that: the back page peeking at the top-left, the front page filled with the disc's own colour (so the back page's lines stop at its edge, as the symbol is drawn everywhere) and inked over it; pressed, the fill warms with the disc as the disc itself warms. Same disc, same seat, same guaranteed-floor read behind it — only the glyph changed. The editor's paste key already wears the library's standard icon and was not touched.

**Verification.** The fold was measured on the bench at phone width, not eyeballed: with the class flipped, the card's height was sampled through the animation — closing now spans the glide (samples still moving at .38s, where the old clock had long finished, and settling at ≈.95s), opening ≈.76s, both on the house easing. The shell change is drawing code only; the CI build is its compile proof, and the glyph was rendered large off-device for a visual read before shipping. Oscar's phone remains the judge of the feel, as always.

## 1.4.166 — The app learns to teach itself: Presentations arrive (web)

The Presentation system — built and verified whole in the Present-Logos lane's isolated copy (born on 1.4.156) — was handed to this desk by Oscar's order («Si terminaste, pásalo al canon principal de la aplicación») and integrated file-by-file onto the 1.4.165 canon: INTEGRA, NO REEMPLACES. Only the presentation tree, its fiction stage and its one Settings contact point traveled; everything else in the copy's diff was its old base and stayed behind.

**What it is.** Twenty guided modules — a Quick floor (Q0–Q5) and an Advanced floor (AD1–AD14), 988 beats — that walk the whole app live on a sealed fiction stage. Supreme isolation is the law of the house: the stage is built fiction in an empty app, and Fence 0 proves real data byte-identical after any run, however it ends. The C′ card sits beside the function it explains: counter, mode button with its word, speed, chapters, pause, ✕; the explanation is the protagonist; the veil behind it darkens and slightly desaturates (saturate 0.65) and never blurs, so the app underneath stays inferable through a sharp focus hole. Interactive and Automatic switch live on one clock (0.5×–2×); Interactive carries the icon-only ‹ › pair, ‹ returning to the exact lived place. A mid-module «Stay here» first opens its window; the last-used unfinished module heads the index under its resume line; one progress line totals the whole catalogue; durations are honest «Approx. N min» at Automatic 1×, never seconds. Law 15 is baked in: on the truly important functions the presentation does not just tell — it taps the function itself, in Automatic too, and the effect is seen executed on the stage (14 beats converted), and 25 helps were rewritten to resolve a real doubt instead of naming what is on screen.

**The integration itself.** All 251 designed anchors were minted in the real app and verified one by one (251/251). The host contributes the launch bus, the stage's stores, and a resolver that steers the stage to each anchor's surface and lands timed fiction (imports, renders, web reads) at the moment a beat focuses its landed state — no lesson ever waits on a wall clock. The fiction stage mounts all seven surfaces at once and speaks only through the scenario port; the λ switch is its one real touch, through the sandbox's own discipline. Settings gains the Presentations card (after Floating player) and, above it, «Find a lesson or a function»: the scene registry is derived from the scripts themselves, every scene findable by what it teaches, each hit offering both landings — Watch (the lesson, resumed at that scene, its fiction seeded) and Go (the real function, unfolded and scrolled into view). A first-run offer waits once on Listen — «New here? Logos can teach you itself.» — and declining leaves it silently in Settings. The manual bridge is closed for Logos by Oscar's decision: there is no Manual, and the lane's topic list stands as inventory only.

**The last defect, found by the gate.** The module sweep ran 19 of 20 clean; AD6 died at its seek beat because the bar could never be born: `createStore.set` merges into an object state, so the stage's two primitive stores — the active clip and the book's keep-state — were shredded by their own setter (a string becomes a character-index object, never equal to what was set). A hand click on the card's own Play door failed identically, which split the fault from the runner to the store. Both stores now wrap their value in an object, with the trap documented at the declaration; the keep badge's flip to «Kept», silently stuck the same way, is cured by the same stroke.

**Verification.** All 20 modules run end-to-end to «seen» on the shipping tree; the only skips are the designed optional beats whose states a lesson narrates conditionally. Package tests 74/74; Fence 0 11/11; the anchor fence GREEN for every probeable anchor. Rendered verification in English and Spanish at phone width (Settings section, search, index, first-run offer, Q0 live) and AD13 at desktop width (rail, wide Library, card and veil). Web only — the Android shell is untouched in this wave. The lane's bench list (PLAN §2.6) remains the lane's to finish; its prudent wordings stand until then.

## 1.4.165 — Tron and Cyberpunk come to live beside Legacy (web + shell)

Oscar's order (2026-11-14): "Keep the current theme as legacy because I love it, and go to study how Tron and cyberpunk work both in Faro and Cadence. Bring those principles and adapt everything to our player… This, of course, will include the floating bubble for both themes." Built under the Themes Integration Law his dictation made standing the same day: research first as a team (three parallel studies — the canonical palettes online, Faro's canon, Cadence's canon), the fleet before the web, Legacy sacred, each theme its own palette and physics, adapt never transplant.

**The picker.** Appearance now offers three rows — Legacy ("Charcoal and gold — the original."), Tron ("Light lines on the deep black of the Grid."), Cyberpunk ("Signal yellow print on warm black.") — each with a split-disc swatch in its own colours. Legacy keeps its Dark/Light/System Seg, shown only while Legacy is the family, and returning to Legacy restores the mode he last used there (`lastLegacy`, remembered whenever a Legacy mode is chosen). The electric themes are night themes, like the fleet's.

**Tron**, adapted to Logos's token contract: ground #02060c rising through #0a1c2e, surfaces as cyan-tinted glass (4.5–13%), ice text #e6faff, the sovereign accent #00e5ff with its lighter voice #6fe3ff, Clu's orange #ff9d2a holding the violet seat (the second voice — favourites and secondary marks), red #ff2a2a for errors only. The Grid itself lies under the app (a 44px line lattice at 4.5%), cards carry the top light-seam and a faint contour glow — Cadence's glass law: colour at the contour, interiors deep and clean. Corners tighten (8/12/16), display type becomes Orbitron, selection paints cyan.

**Cyberpunk**, wearing Faro's corrected identity (warm print, not Cadence's violet glass): warm black #0b0a08, parchment text #f2eee3, signal yellow #fcee0a FLAT — primary buttons and the play key lose every blurred glow and top-light; filled rectangular shapes take the 12px chamfer; data cyan #00f0ff holds the violet seat, magenta #ff2a6d is danger, green #00e67a is ok. A hazard stripe runs only at the top bar's threshold, selection is yellow ink on black, display type is Rajdhani, corners tighten (6/10/14). The round play key keeps its circle — the player's own shape — but prints flat.

**The shell wears them too.** The page pushes the family with the look (`bubbleLook.th`) and with every panel state (`fam`); BubbleService keeps it in prefs so the bubble is born dressed even before the page wakes. Tron panel: deep blue-black, cyan accent seat, ice ink. Cyberpunk panel: warm black, yellow accent seat. The hint cards step one tone away inside each family, as they do in Legacy. The bubble face itself — charcoal jewel today — turns deep blue with a cyan ring and λ under Tron, warm near-black with a yellow ring and λ under Cyberpunk, and repaints LIVE when the theme changes while it floats. Legacy's face is untouched. The media notification keeps the app's charcoal-gold artwork, as it always has — a system surface, outside the themes' reach today.

## 1.4.164 — A little lock on the Settings sliders (web)

Oscar's ask, with his Floating player card on screen (2026-11-14): "Para barras como este añade un candelito chiquito que se ilumina cuando está activado y con una animación para evitar hacer cambios por error mientras se desliza uno por los ajustes." So every slider in Settings — Listening speed, Pause between sentences, Bubble transparency, Panel transparency — now rests under a small lock at its right end. The lock starts ON and lit gold (with its soft glow), the bar itself dimmed and disabled: a finger scrolling the page slides past and changes nothing. One tap pops the shackle open (a short pop animation, the light dies, the bar wakes to full light) and the slider is his to move; another tap locks it again. The animation dies under prefers-reduced-motion. The free sliders outside Settings (the Speed sheet, Export speed) keep their old behaviour — the guard belongs to the scrolling surface he named. Web only; the themes wave moves to 1.4.165.

## 1.4.163 — The keys leap by time now (web + shell)

Oscar's order, with his photo of a browser player mid-load (2026-11-14): "De momento tenemos dos flechitas seguidas para avanzar el texto o retrocederlo. Mira este navegador… Tiene quince segundos para atrás y treinta segundos hacia adelante. Este tipo de iconos es precisamente el que quiero para logos." The double triangles retire everywhere they advanced the text. In their place, on the Listen transport, the mini-player, the bubble panel and the notification shade: a circular arrow wearing its seconds — the number is the setting itself, drawn live, so the key always tells the truth.

The leap is by TIME, not by line: Settings → Playback gains **Jump back** and **Jump forward**, free seconds from 1 to 600, his defaults 15 and 30. The page's jumpBy walks the buffer's own timeline (a rendered sentence knows its true length; an unrendered one is estimated from its words) and lands through the scrubber's door; recordings step by the same seconds; the device voice, which speaks whole sentences, converts the leap to a sentence count at its own rate. The media session's seek vocabulary (headsets, the QS card's seek) leaps too; SKIP keeps the step — a sentence today, the book-to-book seat when a queue exists, as he framed it ("como si fuese una canción, pasar de un libro a otro"). The shade's two buttons are drawn fresh each build as bitmap icons carrying the current seconds; the panel's keys draw theirs from the same prefs on every draw; the page keeps the shell's copy current through the look bridge (jb/jf). Sentence stepping survives where precision lives: the keyboard arrows, the scrubber, tapping a sentence.

## 1.4.162 — Paste returns to the panel, as an icon (web + shell)

Oscar's discovery, with his panel photo (2026-11-14): "puesto que la app no detecta que estoy copiando un texto nuevo, entonces no abre el reproductor. La app piensa que como estoy copiando el mismo texto, no estoy copiando un texto nuevo." Exactly right: the automatic roads dedupe by content — a re-copy of the same words is, to them, no news — and no automatic road may overrule that without looping on its own deliveries. His remedy, in his words: "vuelvas a añadir el botoncito de paste que antes estaba, pero esta vez no como palabra, sino como ícono en la esquina, mismo tamaño."

So Paste now returns where it lived before 1.4.117 took the word away: the panel footer, as a third 30 dp disc beside the headphones and the eye — a clipboard with its clip and a down-arrow, drawn in the footer's own hand. Its tap runs the old guaranteed-floor read (readClip(true): the panel reads, the blink reads, and if neither can, Logos opens and its page reads) — and a hand ask has always bypassed both the lock and the hash in deliver(). One page gate learned the same lesson: the arrival read's draft gate (clipboard text == the standing draft ⇒ "already seen") now also yields to a hand ask, so re-copying the very text Logos already holds restarts it fresh instead of being swallowed. Automatic arrivals keep every dedupe they had. Web 1.4.161 → 1.4.162. (The Tron/Cyberpunk appearance wave follows as its own release — this fix ships first, alone.)

## 1.4.161 — Once the model is home, its card presents folded (web)

Oscar's word, with his Settings photo (2026-11-14): "Once the audio model has been downloaded, there is no need for these settings to be unfolded, so it should present itself folded, just as if the model is not downloaded." The Neural voice card was hard-coded `defaultOpen` — it arrived unfolded in every state, forever showing him the Ready details he no longer needs. Now the card arrives open only while it still has something to ask of him: no model yet (the download offer), a download in progress, or an error to answer. Once the model is downloaded — loaded and ready, or resting in storage — the card presents folded like every other card on the page, its contents one tap away as always. If he is standing on the page while a download completes, the card stays open until his next visit; a card never folds itself out from under the person using it. Web 1.4.160 → 1.4.161.

## 1.4.160 — The finished reading parks, so the headphone can bring it back (web + shell)

Oscar's scenario, with his photo of the panel standing over a finished reading (2026-11-14): "Un audio se terminó, se pausó, pero quiero reiniciarlo tocando el botón de play de mi audífono… sin necesidad de volver a copiar nada, solo utilizando el botón de mis auriculares."

The chain was broken at its first link. The PAGE has always known how to replay — its play() restarts a finished session at sentence 0, and the session still holds the text, nothing to re-copy. But no definite PLAY could ever arrive: at the finish, the publisher sent the 1.4.155 blank and the shell retired the card AND the service, session released — a headphone press had no Logos door left to knock on. And a mid-book pause sleeps by 1.4.154's law, deliberately.

The fix splits the two states the way Oscar's words split them. A FINISHED reading no longer retires: the publisher sends it through a new bridge call (mediaF — old shells never see it and keep the old blank, new pages on old shells fall back to it too) carrying the book's title and the word "Finished", and the service PARKS: the card stands in the shade, the session stays awake as the router's target, and any play — the headphone button, the card's own keys, the panel — travels the definite road to a page that replays from the first sentence. A mid-book PAUSE keeps sleeping (1.4.154 untouched — that protection is what stopped readings resuming while he dictates), and a CLOSED session still publishes the blank and retires whole (1.4.155 untouched). The trade is stated where it lives, in build(): a parked session can hear a stray order the way any awake session can; dismissing the finished card shuts the door, and the card is swipeable precisely because it stands paused, not ongoing. Scope, honestly: readings park; finished recordings never published to this card (the 1.4.156 note stands), and the park lives as long as Logos holds the session — a full process death leaves the Continue card in the app as the road back. Web 1.4.159 → 1.4.160.

## 1.4.159 — While it sounds, the Continue card steps aside (web)

Oscar's ask, with his screenshot (2026-11-14): "It would be appropriate that if I play any audio that is there in the major listening area, the card above that is showcasing the continuous listening hides itself to allow the main listening area of the text [to] fulfil all its potential and use its position. If I stop the audio, then a transition would make the continuous listening card again appear."

Built exactly so: the Continue Listening card on the Listen screen now sits in a fold (the house grid-rows fold, worn the other way round — open at rest). While anything sounds in the main listening area — the reading playing or buffering, or a recording sounding through the clip player — the card folds itself away on the transition and the text takes the whole stage; the moment the audio stops (pause, end, session closed), the card unfolds back. It never unmounts, so its place and contents are exactly as they were. His reading of "stop" includes pause — his word governs; if he wants the card to stay away while paused mid-book, one word changes it. Web 1.4.158 → 1.4.159.

## 1.4.158 — Down to zero, his word; and the pronunciation fields get their room (web + shell)

Oscar's verdict on 1.4.157, from his phone (2026-11-14): "Make it arrive to 0, let the user make their mind. It's theirs to choose. Same for panel transparency. You can very well suggest settings." So both transparency sliders now run the full 0–100 (page Range mins and the shell's lookBa/lookPa clamps alike); 100% stays as the standing suggestion — the default the app offers, never a fence. At 0 the bubble is invisible yet still floats where it was, tappable as ever; that is the user's choice to make, stated here so nobody calls it a bug.

His second catch, same photos: in Pronunciation, the "Word in the book" field showed its text cut mid-word ("Word in th…") and the focused field's ring crowded off — two fields plus the Add button on one phone-width row left each field ~99px, less than its own placeholder. The pair is stacked now: the book word takes a full-width line; "Say it as" and Add share the second. Both placeholders and the selection ring render whole at phone width. Web 1.4.157 → 1.4.158.

## 1.4.157 — The floating window gets a look of its own (web + shell)

Oscar's ask (2026-11-14): if it isn't already there, add a Settings option to configure the floating player's look — the bubble's transparency above all, plus whatever else is fitting. It wasn't there: the bubble card carried only the on/off switch, the lever, and the words. Now, in the same card, four look controls, all travelling the lever's own road (Settings → page push → Bridge → the service's prefs, repainted in place):

- **Bubble transparency** (40–100%): the λ's resting opacity. The idle whisper is now that opacity at the house's fade depth — at 100% the fade lands exactly where it always has (45% tablet, 15% phone).
- **Panel transparency** (60–100%): the panel card's opacity, entrance included.
- **Dim when idle** (on, as today): off, the bubble keeps the set transparency always.
- **Bubble size** (Small / Standard / Large): window, face, halo and λ scale together; the change relayouts the living bubble where it floats.

Shell: BubbleService keeps the look in its prefs (look_ba/look_pa/look_fade/look_size) with `setLook` + a `lookHook` repaint, mirroring onNow; every wake/birth animation that used to aim at full opacity now aims at the set one. No rollback snapshot this wave — the VM's write-guard was mid-flap and shell copies failed EPERM; the git source branch at 1.4.156 (05695ad) is the rollback point, named here so it isn't lost. Web 1.4.156 → 1.4.157.

## 1.4.156 — Two players, one stage: the bubble sees recordings too (web only)

Oscar's report (2026-11-14): he starts an audio in the app, leaves to do other things, and cannot check it from the bubble — "la burbuja mantiene, al parecer, desconexión con la app principal." His own asymmetry was the clue: bubble-started audio shows in the app, app-started audio never shows in the bubble. Proven in the code: the house has TWO players. The reading voice (the listen store) is the only one the bubble's panel has ever mirrored — and everything the bubble starts is a reading. Finished audio (Library recordings, Create results) plays through clip.ts's own player and its own store, which never wrote a word to the listen store: the panel sat at "Ready" while a recording sounded.

- **The panel follows the stage (bubble.ts).** The push now describes whichever player holds it: a live clip session (key `clip:…`; voice samples `preview:…` are not sessions and never take the panel) owns the push while it sounds, or while it stands loaded with no reading session live. Its face is a recording's truth: title, clock (`{played} of {total}`), progress fraction — no sentences, no words zone. clip.ts's store learned the clip's title/artist for this, and gained resumeClip()/stepClip().
- **The keys serve the stage too.** Panel play/pause drive the clip when it owns the stage (bubble.ts handlers); the media keys' toggle/prev/next (listen.ts) likewise — prev/next walk a recording's timeline by fifteen seconds, since it has no sentences to step; the seek bar seeks the clip. The reading-only keys (marks, save, voice wheel, speed) answer with a toast — "That key belongs to readings" — instead of landing nowhere. Stored panel presses collected later route by the same ownership, and a collected play can no longer resurrect a reading over a standing recording.
- The truce between the players (starting one pauses the other) already existed; what was missing was the shared mirror. Shell untouched — the panel already paints whatever the page pushes and pokes the page for its keys; the page was simply not telling it about recordings. Known sibling, deliberately untouched: the system's media card follows readings only — recordings reach it only through the page's own web media-session metadata. Web 1.4.155 → 1.4.156.

## 1.4.155 — The card may not outlive its page (web + shell)

Oscar's report (2026-11-13, evening, photos of the shade): the media player "se muestra renuente" — it cannot be swiped away when he no longer needs it, and it shows itself playing (pause glyph up) when nothing is sounding. Proven chain, from the code: the card's truth has exactly ONE writer — the page's listen.subscribe publisher — and whole classes of page death and rebirth leave it lying forever. A reloaded page (watch reload, crash recovery, a fresh cold open) starts its publisher behind the `started` gate and, with an empty session store, NEVER publishes again until the next play: the service keeps the dead page's last word — "playing" — behind a foreground service, which is also why no swipe can remove it. And a finished reading published a *paused* card (book's face, last sentence) that likewise stayed forever.

- **The page publishes the end (web).** In the publisher, `ended = !active || finished`: a finished reading now publishes the blank truth (no book, no sentence), and the shell's long-standing blank branch puts the card away and stops the service. The card leaves when the reading does.
- **A fresh page buries the old card (shell).** PlaybackService now tracks `cardUp` and keeps an `instance` reference with an in-process `forceStop()`. MainActivity.onPageFinished: a page that just loaded owns no session by construction, so any card still standing belongs to the page it replaced — it is put away on the spot; if the new page starts a reading, its own publishes raise the card again. (A backstage page brought home is never reloaded, so a living session's card is untouched.)
- **The dying activity stops asking politely (shell).** onDestroy used to send the card away via `startService("stop")` wrapped in runCatching — an intent that can die undelivered from a backgrounded, dying activity, silently. It now calls `forceStop()` directly, gated exactly like the backstage preservation beside it: while the bubble lives, the page may live on backstage and keep the card honest, so it stands; otherwise it goes.
- **Stated plainly:** while a reading is merely PAUSED, Android still will not let that system card be swiped away — it stands as his resume surface, and no app can change that. What changes is that it can no longer stand over silence: end of reading, close of the app, or a reborn page each put it away on their own. Web 1.4.153 → 1.4.155 so both halves carry the wave's number.

## 1.4.154 — The card gets its buttons back, and the session sleeps while paused (shell only)

Oscar's verdict on 1.4.153, with photos (2026-11-13): the media card now shows ONLY the play button — the previous/next buttons vanished entirely ("the notification player lacks or is missing these two functions... where are the icons that allow me to forward and backward that audio, just as it is in the app?") — and the dictation autoplay RECURRED, now at keyboard activation as well as stop. Two corrections, both owned plainly: the census's claim that the system's card maps REWIND/FAST_FORWARD to the double-triangle glyphs was wrong on his phone (that declaration makes the card drop the buttons instead), and the declared residual from 153 — a system-delivered PLAY honoured by a healthy session — materialised, so the lever named in advance is now pulled.

- **The buttons exist again.** The system's media card offers previous/next ONLY to a session declaring ACTION_SKIP_TO_NEXT/PREVIOUS, and it draws those two buttons itself, in its own glyphs — no API lends that surface the app's icons; that constraint is the system's, stated here rather than hidden. The session declares SKIP (for the card) AND REWIND/FAST_FORWARD (for the surfaces that speak seek); all four callbacks land on the same one-sentence step, so the deed is the app's even where the drawing isn't. The notification shade's own buttons — the surface that takes the app's icons — keep wearing the plain double triangles they have always worn.
- **The session sleeps while paused.** It was born active and stayed active forever, so while Oscar's reading sat paused it kept holding the device's media-button router — and a PLAY nobody pressed (the kind a dictation session's start or stop shakes loose on this phone) resumed the voice in the middle of his work in another app. Now build() publishes `isActive = playing` with every state, and the session is born inactive: asleep, the router has no Logos to hand stray orders to. His own taps keep their roads — the card's buttons travel the controller road, which reaches the callback awake or asleep, and the shade's buttons are the service's own intents; while the voice plays, the session is awake and every key answers. Closed in passing: no clipboard listener exists anywhere in the shell, so the keyboard cannot be triggering a catch. Web stays 1.4.153. The on-device tests are Oscar's: card buttons present and stepping, card play resuming a paused reading, and a dictation in another app leaving his paused Logos silent.

## 1.4.153 — A press keeps its meaning: the census wave (web + shell)

Oscar's report (2026-11-13, three symptoms in one morning): he paused the audio from the bubble, moved on, and Logos pulled him back to a black screen; later, the moment he stopped dictating a message in another app, the paused audio started by itself; and the media card "refused to cooperate" — its taps did nothing — while wearing the barred skip glyphs instead of the seek triangles chosen in 1.4.118. A read-only census reconstructed all three chains with file/line evidence before any patch. Verdicts: the 1.4.152 scrim is RULED OUT for the black screen (translucent warm veil, never without its card, cannot front an activity); the shell has no audio-focus code at all, so no focus-return resume exists to blame; three of the shell's safety nets were each acting on remembered state that morning — and each memory was stale.

- **Definite presses, the whole way (PlaybackService).** The media session's callback receives definite "play"/"pause" from the system — and act() used to flatten them back into a bare "toggle" for the page, a flip judged against the page's own playing bit: the 1.4.89 inversion hazard in reverse, and the dead card's most probable mechanism (after the autoplay desynced the session, his definite pause-tap could land as a resume). The page has definite doors (logosandroid-play/pause, 1.4.89); a press now travels under its own name from every surface — panel, notification, media session.
- **The session speaks seek, not skip.** The media card the system draws comes from the session's PlaybackState, which declared ACTION_SKIP_TO_NEXT/PREVIOUS — hence the barred track glyphs, promising a skip-to-another-recording the keys never do. It now declares ACTION_REWIND/ACTION_FAST_FORWARD and the callback answers onRewind/onFastForward with prev/next: the card wears the plain double triangles, the same family the panel keys adopted in 1.4.118. The notification's own buttons already wore rew/ff and are unchanged.
- **Stored presses expire (BubbleService + MainActivity + page).** A command stored for a sleeping page kept its meaning forever: collectPending ran only at page init (+700/+2200 ms), so a "play" stored while the page merely slept could be collected at the next unrelated reload and auto-start a recovered session — the stored-command road of the dictation-morning autoplay, and a collected "pause" could silence a different, later session. Now every store is stamped (storePendingCmd) and every collection goes through takePendingCmd: older than twenty seconds, the order is dropped, never obeyed. And the page collects at the doors the clip pull already uses — window focus and visibility-return — not only at init, so a press stored during a mere sleep is collected in its own moment or not at all.
- **The ghost dress seam (MainActivity).** The black pull-back's chain: a paused-mid-render page stops pushing state in a stopped activity; the stall watch (last push said "busy", 8 s of silence) fires a ghost visit, then a reload visit; the visit's invisibility depends on enterGhost, which onNewIntent runs only `if (!resumed && !ghost)` — an intent arriving mid-transition (while Oscar's own app-switching is moving the task) skips its dressing, and the fronted task shows the opaque #0A0A0F root over a reloading or backstage-parented page: black Logos, uninvited. Ghost intents are now stamped on arrival (ghostIntentAt) and onResume re-dresses from a fresh stamp (< 2 s) before any stay logic runs; the stamp is cleared wherever a visit ends or becomes his stay, so a human arrival can never be dressed by mistake.
- **Declared residual, honestly.** If the system itself redelivers PLAY to the active media session when a dictation session tears down (the one link no repo can prove — it is also exactly "the moment he stopped recording"), no callback signal separates it from his own tap on the card's play button, and a healthy session will still honour it. This wave removes every indirect resurrection — no flips, no stale stores, no late collections — but if the autoplay recurs after 1.4.153, the remaining lever is to stop honouring session-level play at all (card/headset resume would then live only on the panel and in the app) — Oscar's call, on that evidence. Web bumps 1.4.149 → 1.4.153 so the Settings stamp names the wave on both halves.

## 1.4.152 — The confirmation windows get their world dimmed and their light wired in (shell only)

Oscar's order (2026-11-13): upgrade the confirmation windows' look — "not about text distribution... it's about how the overall background and card as a whole portrays itself." Per his design law the round went research-first as a team (web research + a house-language spec + a critic); the diagnosis all three signed: the card was the only surface in the house with no light source — cardPal() defines a gold "glow" for it that showHintCard never used — floating on no field, same-material card over same-material panel, separated by a hairline and a shadow with nothing darker to fall into. Two directions were presented; Oscar picked (after correcting a mistaken tap) **the dimmed world** — the first option — over the lit card alone.

- **The veil.** A full-screen warm dim settles behind the card: argb(118, 10, 8, 5) in the dark theme, a symmetric warm argb(90, 62, 48, 28) on the light one — never neutral black, per the house rule. It is FLAG_NOT_TOUCHABLE: the panel beneath answers the finger exactly as before; the veil is company, not a lock. It fades in over 220 ms and lifts over 160 ms; it is hard-removed in onDestroy so a dimmed world can never outlive the bubble.
- **The lit rim.** The card's plain 1 dp stroke is replaced by a rim that behaves like light: a TL_BR gradient (gold warmed toward ink → gold → gold sunk into the face's deep tone) carried on a LayerDrawable ring 1 dp proud of the face — the gradient-border workaround built from house drawables. The face itself becomes a three-stop falloff of the settled tones; corner radii unchanged (21 over 20); elevation rises 16 → 24 dp, which finally registers against the dimmed mid-tone field.
- **The glow, at last.** The panel's signature radial gold glow now breathes inside the card too (radius 170 dp, 96 dp tall, cardPal's own unused "glow" colour) — and it arrives in a second beat: the card settles first (scale 0.90 → 1 + fade, 230 ms, DecelerateInterpolator), the light fades in 60 ms later over 240 ms, as if a lamp were switched on above it. Leaving is quicker (130/160 ms) and the two layers leave together; views are captured before fields clear, so a new card can be born while the old one fades.
- Frozen, as ordered: every word, size, padding, the 300 dp width, the centred seat, FLAG_NOT_FOCUSABLE, the 9-second auto-dismiss. Web stays 1.4.149.

## 1.4.151 — The footer icons take their proper size; the headphones get cups (shell only)

Oscar's verdict on 1.4.150 (2026-11-13, photo of the footer on his phone): "Excellent. It's just that the icons are too big as they are right now for the small windows in my phone. Could you make a better icon for the listen icon?" Both halves obeyed:

- **Smaller.** Both discs shrink 38 → 30 dp and their glyphs with them (radius 10 → 8 dp); the pair now takes 80 dp of the footer instead of 102, in proportion with the Auto switch they sit beside. Nothing else in the row moved.
- **A better listen icon.** The first headphones were a band and two bare line pads — at panel size they read as a horseshoe. The band stays; the pads are now filled capsules — ear cups with a body to them — and the mark reads as headphones at a glance. Same ink, same pressed warmth; only the drawing changed.

## 1.4.150 — The panel's footer trades its word for two icons (shell only; Oscar's design order)

His words (2026-11-13, with a photo of the panel footer): "To make it look more premium, instead of hide bubble, add a small eye that will hide the bubble when you tap over it after the confirmation window. Also add a second icon next to it that, just by tapping over it, I'm sent to the listening area of logos. Has to be an icon. I'm thinking that by pressing the back button of my phone, I am taken back to the very place I was listening using the bubble."

- **The eye.** The footer's "Hide bubble" text is gone. In its place, at the footer's right end, a gold-line eye drawn on the same 38 dp disc the speed keys wear — same pressed warmth, same give under the finger (the 1.4.134 treatment). Its tap opens the SAME confirmation card as before ("Remove the bubble? … Remove / Not now"); only the deed after confirming is unchanged: panel collapses, bubble retires. The word survives only as the icon's accessibility name.
- **The headphones.** Beside the eye, a second disc drawn with a headphone band and pads — the listening area's door. One tap: the panel folds away and Logos comes forward ON THE LISTEN PAGE (a `logos.listen` arrival), not on whatever page the app happened to be left on. Warm arrivals steer the living page (`location.hash = '#/listen'`); a cold one loads there directly; one caught mid-load is re-steered when the page finishes loading.
- **Back completes the round trip.** A headphones arrival is a VISIT (the ghost's human cousin): while he is on the listening area, the phone's Back sends Logos to the back — moveTaskToBack, the same polite exit the ghost uses — so the app he was listening from resurfaces, instead of Back rewinding Logos' own pages under him. The moment he wanders off the listening area, or arrives any other way, Back returns to its ordinary manners (page history first, the double-press leave after). Playback is untouched either way: leaving never stops the voice.
- Nothing else in the panel changed; the notification's own "Hide bubble" action keeps its word (it is a notification, not the panel). Web stays 1.4.149.

## 1.4.149 — The Pocket warning was a false alarm: the checker used a name Pocket never files under

Oscar, same day (17:13 EST): he played a Pocket voice exactly as instructed and the Storage note stood unchanged — "Normal, yet?" No. It was the checker, not the saving, that was broken. `pocketCached()` searched Pocket's cache keys for `pocket-tts-english` — the library's display name for the model — but the loader files the model under its manifest name and digest: `model.onnx?v=<sha>`. The manifest is public and settles it: the English model is 176,992,315 B, its encoder 39,183,564 B, its assets 1,654,421 B — together precisely the ~218 MB this bucket holds inside Settings' 291 MB total. The probe could never match, so every Pocket load "proved" the model unsaved and the note re-set itself forever; no amount of playing could clear it. This entry also corrects 1.4.147's note, which promised the warning would clear itself after the healed load — with the probe broken, it could not.

- **pocketCached asks for the real key now**: it reads the language's manifest (a few hundred bytes), matches `model.onnx?v=<that digest>` among the cache keys, and falls back to a shape check (a model-sized `model.onnx` entry) when the manifest can't be fetched.
- **keep.ts retires the standing false note**: checkStamps now clears a 'notSaved' note at startup when the model is in fact saved, so his current warning dies on this version's first launch — no play required.
- Untouched: 1.4.147's integrity refusal (the crash-side fix) and everything else. The crash and the note were two different faults wearing one coat.

## 1.4.148 — The bottom desk learns to hurry (Oscar: tab switches feel slow)

His words (2026-11-12): "work on the smoothness and fastness present in the bottom desk. I feel they take too long to move from one page to the other one." A read-only investigation mapped the switch path first; the felt slowness was mostly theatre stacked in series, plus two real costs:

- **Three animations in series, now one.** Every switch ran the router's `document.startViewTransition` (which FREEZES the old page on screen while the new one mounts, then cross-fades ~250 ms) on top of the page's own 420 ms entrance — which itself started at opacity 0, so the destination arrived invisible and faded in a second time. The view transition is gone from router.ts (plain state update), and the entrance is a single 200 ms fade-and-rise.
- **The blur is gone.** The old entrance animated `filter: blur(4px)` + scale over the full viewport — per-frame repaint of the whole page, the classic phone-GPU jank the codebase already feared for long pages. `pageIn` is now opacity + translateY only (compositor-cheap), one recipe for all pages; the `.long` classification and PageWrap's forced-layout measuring effect are deleted with it.
- **Library no longer re-reads his audio on every visit.** Its mount effect called refreshLibrary(), which structured-clones every saved clip INCLUDING its audio blob out of IndexedDB, then throws the blobs away — a cost that grew with his library, paid on every single Library tap. Startup and every mutation already refresh; the mount read is deleted.
- **Voices paints less on arrival.** `.voice-card` gains `content-visibility: auto` (the pattern book paragraphs already use), so the 57-card page skips layout/paint for off-screen cards on first paint.
- **Deliberately NOT in this wave:** keep-alive pages (keeping all five mounted so repeat switches are instant) — it changes every page's mount assumptions (polls, intervals and intake effects would run while hidden) and is only worth its risk if this wave still feels slow on his phone; and the immersive nav's ~1 s glide tax when crossing Listen during playback, which is designed choreography, not accident. Both are named here so the next step is a decision, not a search.

## 1.4.147 — Pocket heals its own cache (Oscar's report: Pocket now stops the app)

His words (2026-11-12): since the Kokoro install, Pocket "forces the app to stop — that didn't happen before installing Kokoro, so something is missing there"; and the Storage card's "loaded but couldn't be saved" note did not clear after playing Pocket (the play itself died). He was right that something was missing — not a file on the site (the published tree was re-diffed: Pocket's worker and its runtime are byte-identical to the pre-Kokoro build, and everything it needs is live), but the integrity of Pocket's saved model ON HIS PHONE.

The mechanism, from the app's own patched asset layer (src/engine/pocket-assets.js, whose header already feared this family): Pocket's model lives in the 'pocket-tts-models-v2' cache; a cache write interrupted by the app DYING can leave a truncated body under a truthful content-length header — and during 1.4.143–1.4.145 the app died repeatedly, mid-write included. cacheGet never checked: it handed the truncated bytes onward as a whole model, the runtime choked on them at load, and the app stopped — deterministically, every Pocket attempt. The keep.ts "couldn't be saved" note was the same wound seen from the other side.

- **The fix is a refusal**: cacheGet now measures the body against its header; a mismatch drops the entry and reports a miss, so that one file downloads fresh and whole on the next Pocket load. Nothing else changes — no bucket wipe, no full 179 MB re-download unless the big file itself is the truncated one; healthy entries are served exactly as before. After the healed load, the keep stamp finds Pocket saved and the Storage note clears itself.
- Declared: if Pocket still stops the app after a guaranteed-whole cache, the fault is in the load itself (threads/memory) and the next lever is Pocket's thread count — but the evidence (worked before Kokoro; died in the era of interrupted writes; the note that would not clear) points at the cache, and this makes the cache self-healing permanently, not just once.

## 1.4.146 — Kokoro removed, completely (Oscar's verdict)

His words (2026-11-12): «Kokoro es demasiado para la aplicación o que la cierra. Elimínalo completo sin tocar el resto.» The q8 build of 1.4.144 closed the app on his phone too — the engine is simply too heavy for this WebView at any storage precision worth having, and two strikes was the whole trial. Removed whole, the 1.4.142 way, touching nothing else:

- **Engine out**: `src/engine/kokoro.ts` and `kokoro.worker.ts` deleted; every kokoro branch in engine.ts (routing, queue, cache accounting, cross-engine release) gone; deps `kokoro-js` and `@huggingface/transformers` uninstalled; the bundled `public/ort/` runtime deleted. The one piece of Kokoro that stays is its cleanup: `removeKokoroCaches()` runs once per device and deletes the `transformers-cache` and `kokoro-voices` Cache Storage buckets — nothing else uses them — so his phone recovers the ~100–270 MB Kokoro downloaded.
- **Voices out**: the 28 kk_ voices leave the catalog (85 → 57 voices: 50 Phonon + 7 Pocket, exactly the pre-Kokoro fleet); the picker loses its Kokoro section, the Voices page its Kokoro filter, Settings its Kokoro branch and credits line, es.ts its three Kokoro strings.
- **Previews out**: the 25 kk_ preview MP3s and their previews.json entries removed (82 → 57 ids).
- **Settings migrate**: `kk_` leaves the settings whitelist, so a saved Kokoro default lands on Pocket Alba/Lola, a Kokoro override clears, Kokoro favorites filter out — the same landing every removed engine gets.
- **Hosted files deleted** from the site: all of `models/kokoro82/` (fp16 parts, q8 parts, voices, meta) and `previews/kk_*.mp3`, plus the ORT runtime files. Pocket's and Phonon's models, voices, previews and behavior are byte-for-byte untouched.
- Restoration path (only if Oscar ever reverses): pre-removal snapshot in ~/workspace/backups/logos-pre-1.4.146-files/ (incl. both engine files); the Kokoro spike rig and models remain in ~/workspace/logos-kokoro-spike/.

## 1.4.145 — The Continue listening card goes on a diet (Oscar's screenshot)

His words over the screenshot: the Continue listening chips "should be way smaller so they don't get confused with the text player. Reduce its height. No reason to be as it is to say so little." Right — the card was spending a header line plus a two-line row (title stacked over "12% read") on a title and a percentage, at near-player visual weight.

- The row is now ONE line: kind disc (30→24px) · title (14.5→13.5px, still ellipsized) · "· 12% read" riding the same line in muted 12px · play ring (26→22px). Row padding 8→4px, card padding tightened, the gold header kept but a touch smaller. One-entry card ≈ 92px → ≈58px tall by the styles' arithmetic. Nothing else moved: same entries, same order, same resume actions, same hairlines between rows.
- Pure presentation (styles.css + two icon sizes in continue.tsx); no behavior change. Not bench-photographed — this machine's headless browser is still down (see 1.4.144); the layout is guarded by nowrap + ellipsis in both languages, and Oscar's phone is the judge, as ever.

## 1.4.144 — Kokoro at q8: the same complete model, half the weight (Oscar's pick)

1.4.143's fp16 Kokoro crashed the app on Oscar's phone — his report: "Kokoro breaks the app. 😄 Any idea to avoid that? The app closes." The diagnosis: memory. The load stacked copies (hosted parts held in the page, an assembled 163 MB blob, then the runtime's own copy with fp16 weights inflating toward fp32 in its work area) until the WebView ran out and took the app down. Offered three routes; Oscar chose q8 — and the record matters: **q8 is not a distilled model.** Same architecture, all 82M weights, stored at 8 bits and run on integer kernels; the model is complete, the storage is leaner (92 MB vs 163 MB). The spike had already proven q8 speaks (Heart at RTF ~6 on this throttled box, healthy audio).

- **Engine**: the worker loads `dtype: 'q8'`; the manager seeds `onnx/model_quantized.onnx` from 4 hosted parts under `models/kokoro82/parts-q8/` (concatenation md5 = the original file). The fp16 parts stay hosted as a fallback until q8 is proven on his phone; a stale fp16 seed left by a 1.4.143 attempt is deleted during seeding, and Delete-model clears both keys.
- **Memory discipline**: the seed now STREAMS the parts through a ReadableStream into the cache (peak memory ≈ one chunk, never the whole model resident in the page); Kokoro's thread count is capped at 2; and Kokoro's load ALWAYS frees Pocket and Phonon first, on every device class (they reload on demand when next chosen). Settings' Kokoro card now reads ~102 MB.
- **Previews land**: all 25 baked Kokoro samples are in (the three British men — Fable, George, Lewis — still have no preview: their bakes died with this machine's browser and will follow). Note the 1.4.143 entry below overclaims here — it says every voice has a baked preview; in fact none shipped in 143 (the machine's write fault blocked the MP3 encodes that day). previews.json was reconstructed for this release after the same fault zeroed it: the 57 surviving ids were recovered verbatim from the live 1.4.143 bundle (50 Phonon + 7 Pocket), then the 25 kk ids appended — 82 total.
- **Declared**: in-app synthesis is still not bench-proven on this machine (its headless browser remains down); the q8 path itself is spike-proven, the seeding/download layer bench-proven in 1.4.143. Oscar's phone is the judge: pick a Kokoro voice, press play — the app should survive, download ~102 MB once, and read. If it still closes, the next lever is the runtime's arena options, and the one after that is retiring Kokoro.

## 1.4.143 — Kokoro, the full model (web)

Oscar's word, minutes after Pocket Fast left: «Instala
Kokoro. Déjame convencerme» — and, underlined, «Kokoro el
completo, no el destilado». So this is the whole Kokoro 82M
(hexgrad, Apache-2.0) at fp16 — the complete model, not a
distilled or cut-down edition — as a third engine beside
Phonon and Pocket. Twenty-eight English voices, American and
British, each carrying its community quality grade in its
tagline (Heart is the flagship, Grade A; the male bench tops
out at C+, which the research predicted and the taglines say
out loud). Every voice has a baked preview, baked with the
shipped fp16 build itself. Kokoro is English only: Spanish
stays with Pocket and Phonon, exactly as the research found.

Hosting follows the spike proven the same afternoon
(~/workspace/logos-kokoro-spike): the 163 MB model travels as
seven parts under models/kokoro82/ (the service worker
bypasses that path), the app assembles them on the phone and
seeds the Transformers browser cache under this origin's
hub-mirror URLs; the voices seed into the kokoro-voices cache
the same way. Nothing is fetched from Hugging Face at
runtime, and the download works offline-first like the other
engines after it lands. Synthesis runs in a worker on ONNX
Runtime WASM (assets bundled under ort/), never on the UI
thread. The legacy-cache purge no longer touches
transformers-cache / kokoro-voices — they are Kokoro's again.

Declared limits: fp32 (326 MB) cannot live in a phone
browser, so fp16 is the complete model's practical form —
same weights, half-precision storage, indistinguishable in
the spike's measurements (fp16 and q8 both spoke; fp16 kept
for fidelity). Kokoro's speed on Oscar's phone is his
measurement to make; the Settings card shows its real-time
factor once it has read. Whether Kokoro stays is, as with
Pocket Fast, his ear's decision.

## 1.4.142 — Pocket Fast removed, by Oscar's verdict (web)

He heard it and decided, in his words: «Remove Pocket Fast
from Logos. Fast, yes, high quality voces, no.» The frame he
set when it was built — implement first, decide after
listening — closes here. The distilled engine is out whole:
its seven voices, its picker section, its Settings branch,
its preview samples, its engine wiring. Phonon and the big
Pocket are untouched, Spanish included — the research that
preceded the verdict found nothing that retires Pocket, and
the distilled voices did not earn its place. A phone that
had a Pocket Fast voice saved lands safely: the settings
migration no longer admits ds_ ids, so a saved default falls
back to Pocket Alba/Lola, an override clears, favorites
filter clean — nothing dangles, nothing errors.

## 1.4.141 — the worker file never reached the server (web)

Oscar's Settings card named it plainly: «phonon-tts worker
failed: could not start». Not the download, not the worker
of 1.4.140's theory — the worker SCRIPT itself. When
Pocket Fast arrived (1.4.137, phonon-tts 0.7.0), the build
minted a new family of chunks — the engine worker, its
helpers, three loader pieces, plus two lazy chunks — and
eight of them were never committed to the site. The list
checked at publish time covered what the page references
directly; files the app fetches by computed name at runtime
fell through the hole, and every bench ran on a complete
local build, so nothing caught it. On the phone the worker
request answered 404 and the engine died before its first
fetch — while Phonon, whose worker predates the bump and
was already on the server, kept working. 1.4.140's service-
worker change stands as harmless hygiene, but it was NOT
the cure and is not claimed as one. The eight files are
committed now, and the publish check has changed for good:
the branch's full file tree is diffed against the build —
no candidate lists.

## 1.4.140 — Pocket Fast died where only it travels (web)

Oscar picked Michael, pressed play: «Engine error», zero of
five sentences. First theory — the worker's response rewrap
mislabelling gzip'd files — was tested against a faithful
control (a local server that gzips everything, the model
inside the worker's scope, Michael himself) and DISPROVEN:
desktop Chromium loads Pocket Fast through the old worker
without blinking. What survives every test is the delta
itself: Pocket Fast is the only engine whose model lives on
Logos' own pages, so it is the only one whose 25 MB body the
service worker fetches, rewraps and streams out of
respondWith() — and Android's WebView is precisely where a
synthesized body that size cannot be trusted, while every
direct-fetch engine (Phonon, Pocket, both from Hugging
Face, passed through untouched) works on the same phone.
The worker now steps aside for everything under models/:
the browser fetches those files straight from the server,
the road every working engine already travels. The rewrap
also drops Content-Encoding and Content-Length — the body
it hands on is the decoded stream, and its headers now say
so. If a first-attempt download left a truncated copy in
the model's cache, Settings → Pocket Fast → Delete model
clears it; the next play downloads clean.

## 1.4.139 — Pocket Fast voices get their play buttons (web)

Oscar, with the picker fixed: «I am still missing the
playback option that allows me to listen to the voice before
choosing any of them.» Right — the picker's play button only
exists for voices with a baked sample file, and Pocket Fast
arrived with none. Baked now, with the shipped model build
itself (the same 24.6 MB GGUF his phone downloads): all seven
voices speak the standard sample line («Words carry meaning.
Here is how I sound when I read to you.»), encoded exactly
like the existing samples (24 kHz mono MP3, 64 kb/s), and
registered in the preview list — so the ▶ appears beside
every Pocket Fast name in the picker, and the Voices tab
plays the same instant samples instead of warming the model.

## 1.4.138 — Jane was missing from the picker (web)

Oscar opened the voice picker on his phone and asked:
«Missing Jane?» She was in the app — the Voices tab listed
her — but the picker sheet (chrome.tsx) builds its sections
by hand, and 1.4.137 never gave Pocket Fast a section there,
so none of its seven voices could be chosen from Listen,
which is where voices are actually picked. Fixed: a «Pocket
Fast» section now sits right after «Pocket» («7 voices ·
Distilled engine»), with the same treatment as its family —
accent badges in the section, a «Pocket Fast» badge when one
of its voices appears under Favorites. My miss, recorded
plainly: the 1.4.137 bench proved the Voices tab and the
engine, but never opened the picker.

## 1.4.137 — Pocket Fast: the distilled Pocket arrives (web)

Oscar asked whether Kyutai's distilled Pocket models (October
2026) could be implemented, and to decide about the big Pocket
afterwards — its Spanish voices are his reason it may stay.
Investigation first: the small models are a different
architecture (one-step drifting flow head, separate 128-d Mimi
decoder), no ONNX export of them exists anywhere, so the current
Pocket stack could never run them. But Gradium's xn-ptts runtime
supports them, and its browser package — phonon-tts, already in
Logos for the Phonon engine — loads Pocket checkpoints directly.
Proven by spike before integration: the 18.2M checkpoint
synthesized in headless Chromium through that exact stack, at
real-time speed on a throttled sandbox; Kyutai publishes 9.9×
real-time on one desktop thread (WER 0.85%, better than the
100M's 0.92%). Weights quantized with xn-ptts's own tool to a
24.6 MB q8+bf16 GGUF (from 112 MB f32), verified speaking in
the same harness; the hosted build omits the speaker encoder —
it drops only cloning a voice from a recording, which this
engine never offered; the precomputed voices are unaffected. NEW: a third engine, «Pocket Fast», English only —
seven voices (Jane, Alba, Anna, Mary, Michael, George, Paul)
under the Voices page's Pocket filter with a «Pocket Fast»
badge; the model is hosted on Logos' own pages and downloads
once, then works offline. Engine routing, memory discipline and
queue/timeout laws mirror the existing engines; phonon-tts
bumped 0.6.0 → 0.7.0 (the API Logos uses is unchanged). The big
Pocket and its Spanish voices are untouched. His ear is the
judge: intelligibility is measured, not transcription-verified.
Found on the bench and fixed in the same wave: the settings
migration that drops voice ids from older versions only knew
the ph_/pk_ prefixes — it would have silently eaten a Pocket
Fast default or favorite on the next cold start; ds_ is now
whitelisted beside them.

## 1.4.136 — Pocket takes a fourth thread (web)

Oscar: Pocket voices take too long processing, and they stop.
The whole path was audited before touching anything. Already at
their stops: cross-origin isolation (the service worker's
COOP/COEP is what lets WASM threads exist at all), the sampler
at 1 decode step — its fastest setting, read from the model's
own published config — the voice encoder fetched lazily (never
for built-in voices), the disk render cache, the 400-sentence
prefetch window, and the RTF-aware cushion. This library's
models have no int8 edition; that faster bundle belongs to a
different runtime, and adopting it would be an engine
transplant, not a setting.

The one knob left: Pocket's thread cap rises from 3 to 4.
Kyutai tuned for two desktop cores; phone cores are several
times weaker, and four is where the pool starts waiting on its
slowest member. Everything else in the release is the honest
arithmetic, told to Oscar in the delivery: at 1.5x listening
speed a renderer that works at ~1x real time falls behind no
matter the cushion — the stops at that speed are math, not a
malfunction. Web only; the shell stays 1.4.135's.

## ## 1.4.135 — A scrubbed sentence enters square (shell)

Oscar's crops: after scrubbing by swiping the words, the text
stayed displaced — lines starting mid-word at one edge, cut off
by the panel, never centring. The mechanism, found in
updateWords: a sentence change calls wv.animate().cancel() to
restart the fade — an indiscriminate cancel that also killed
the scrub's lean-return (scrubCommit animates translationX
home over 140 ms; the refresh lands at 60 ms). The words froze
mid-lean, wearing the dead gesture's displacement forever.

Now a sentence change restores the words square in the same
breath: translationX set to 0 and any horizontal scroll pinned
home before the fade — the lean belongs to the gesture and
dies with its sentence. Same-sentence scrubs keep their glide
home; the vertical centring of the amber word is untouched.
Shell only.

## ## 1.4.134 — The speed keys answer the finger (shell)

Oscar: the panel's − / + speed keys change the rate but give no
feedback — "make the bubble feel more intentional." The keys
(the one speedBtn factory builds both) now answer a tap: while
pressed, the disc warms toward gold, its ring turns gold and
the glyph lights gold; the key gives to 0.9 under the finger
and springs back on release. The deed — pokeOrWake slower /
faster, the refresh a breath later — is byte-identical. The
transport keys were not asked about and were not touched.
Shell only.

## ## 1.4.133 — The header trio, smaller (shell)

Oscar's close-up of the panel's title row: the mark, save and
lock medallions (32 dp discs) outweigh the title they serve —
"Make these three icons way smaller, please. There's no need
for them to have that size." They are 24 dp now, glyphs scaled
with them (⚑ 11, + 14, lock 10.5), spacing 6 dp. Same seats,
same deeds, same explanations before they act. Shell only.

## ## 1.4.132 — The middle of the room (shell)

Oscar's three screenshots: with the λ resting mid-screen on his
phone, the open panel didn't know where to go — the λ ended up
stranded in the middle of the panel's top edge, sunk into the
player. The mechanism, in positionPanel: the panel seats a
CORNER against the bubble (his settled 1.4.95 design), but the
wide phone panel clamps that corner to a far edge when the
bubble is mid-screen, so the top edge cuts through the circle
instead of grazing it.

Phone only, middle only: when the seated corner would land more
than a bubble's width away from the bubble, the corner seat is
forgotten — the panel unfolds straight BELOW the bubble, its
top edge resting under the whole circle (the same 2 dp graze,
vertical now; above only when below cannot fit), the bubble
stays in the middle on top, and the birth grows out of the
point beneath it. Corners and borders keep the corner seat
exactly as it was, and tablets keep it everywhere. Shell only;
the web stays 1.4.131.

## ## 1.4.131 — The version closes Settings (web)

The fleet's universality, at Oscar's order through the main
chat: six of the eight apps end their Settings with the version
as the last line on the screen; Logos kept its number inside the
About card's subtitle, with the credits running on below it.

Now the Settings screen's final element is the closing line —
"Version 1.4.131" / "Versión 1.4.131", small, centered, dim —
drawn from the same VERSION constant the page already keeps, so
there is still exactly one number to maintain. The About card is
untouched; nothing else changed. Bench-verified: the line is the
page's last child, centered, 12 px. Web only.

## ## 1.4.130 — Settings folds (web)

Oscar's whole order, and only it: "make the shapes of the
settings fold themselves and gain a small distance in between."
Measured first: the cards touched — the gap between them was
0 px; the page read as one long slab.

- Every Settings card folds now. The header (icon, title, its
  one-line summary) is the handle, with a chevron that turns as
  it opens; the fold runs on the grid-rows fold the fleet uses,
  and sleeps under reduced-motion. The first card — Neural
  voice, with its live status — arrives open; the rest arrive
  folded, so Settings opens as a tidy index.
- The cards stand 14 px apart, first measured, then set.

Nothing else moved: same cards, same contents, same order. Bench
facts: 8 cards, gap 14, first open, a tap on a folded header
unfolds it. Web only; the shell stays 1.4.128's.

## ## 1.4.129 — The mini player, finished (web)

Oscar, on the mini bar that follows a session through the other
sections: "You are doing too much with that player. Do not show
me the text… As it is, it looks unfinished because of the text
on the left." He was right — the current sentence crowded the
bar's left side at whatever length the sentence happened to be,
and the strip never looked like a finished thing.

The mini is transport only now: rewind, the gold toggle, fast-
forward — a slim centered strip with its progress hairline —
while he moves through Voices, Create, Library and Settings.
The words live in Listen, where they belong; tapping the bar's
own body (not a key) still opens Listen. Verified on the bench:
the bar's text content is empty and its children are exactly the
three keys and the hairline. Web only; the shell stays 1.4.128's.

## ## 1.4.128 — One page, ever

Oscar's morning verdict on the night's work: "Imposible parar el
audio" — the voice kept speaking after he closed the floating
window, and pressing Play on the text in the app did not stop it.
His screenshot showed the anatomy exactly: the panel reading
sentence 26 of 40 with the word lit, while the app's own player
sat at "Ready" with a Play button. TWO pages. One voice answered
to no switch because every switch in the house was wired to the
other page.

The birth: the backstage keeps the page alive in its invisible
window when the activity goes out of sight (1.4.111 — by design).
When Samsung later reclaims the stopped activity, the page
survives backstage — also by design (1.4.112). But the NEXT
activity instance simply made its OWN new page and never asked
the backstage for the old one: `bringWebHome` early-returns when
the new view is already seated, so the backstage page stayed in
its window forever — playing, pushing the state the panel
believes, unreachable. The same failure Oscar met on November 8,
by a road the intervening versions paved one honest step at a
time.

- The backstage now names its tenant, and a newborn activity
  evicts and DESTROYS a held page before making its own. One
  page, ever. The ordinary return — the activity still alive —
  keeps the reparent exactly as it was; only an activity born
  after the system reclaimed the old one passes this gate.
- The service's own death destroys the backstage page too:
  `release()` parked it parentless, and a parentless page keeps
  its renderer, its audio and its voice with no switch left.
- Two drivers, one stage, in the small as well: the page's Play
  now silences the shell's voice as it starts (by either road the
  shell took the stage), and the page's session teardown stops
  the shell's voice unconditionally, not only for handovers.

The test is the scene itself: listen through the bubble with
Logos in the background until the system reclaims it, reopen
Logos, and every switch must answer. His phone is the judge, as
always — this one is confessed, not claimed.

## ## 1.4.127 — Skin wave 2: the small courtesies (web)

The second polish wave, same law — finish, never replacement.
Selected text now wears the house gold in both themes instead of
the browser's blue; scrollbars go thin and take the theme's own
line colour (the reader's raw gray bar was the loudest unfinished
detail on the screen); and keyboard or switch focus shows a gold
ring, never the default blue. The sheets, checked for the same
treatment, already wore their own top light — left exactly as
they were. Verified rendered in both themes; geometry untouched,
as in every skin wave. Web only; the shell stays 1.4.125's.

## ## 1.4.126 — Skin wave 1: the top light (web)

Under Oscar's third order of the night — Muse commands the look;
skin only, polish never replacement — the first wave gives every
card in both themes the finish the fleet learned elsewhere: light
falls from the top. A new `--sheen` token (a whisper of white in
the dark theme, a porcelain glow in the light) rides as a gradient
over every `.card`, fading by the middle; nothing moves, nothing
changes size — the same rooms, better lit.

And the bloom he asked for, kept moderate: a slow light now crosses
the gold of the play disc and the primary buttons every few
seconds (a sheen sweep, transform only), and the bottom bar's lit
tab blooms once — a small spring pop — as it takes the stage. All
of it sleeps under `prefers-reduced-motion`. Judged on rendered
screenshots in both themes before shipping: geometry identical,
the finish visibly warmer. Web only; the shell stays 1.4.125's.

## ## 1.4.125 — His stop outranks every rescue

The night's deep audit of the self-firing audio — the complaint
Oscar has repeated all evening — found the main door still open
after 1.4.120. The native fallback chain knows how to tell a FROZEN
page from a flowing one, but nothing in it knew what a DELIBERATE
STOP looks like: a paused page and a frozen page are equally still.
So: copy a text, listen, press stop — and thirty seconds later the
chain, faithful to its orders, first sent a ghost visit (the app
"asking to appear again") and fifteen seconds after that handed
the STOPPED text to the device voice, which read it aloud from
nowhere. The ~30-second delay in his report is the chain's own fuse.

- **The quiet-state gate:** both native checks now begin by asking
  whether the page is at rest — neither playing nor busy. At rest
  ends the chain where it stands: no visit, no takeover. The
  chain's jurisdiction is sessions that CLAIM to be working.
- **The error carve-out:** the page's pushes now carry an `err`
  flag. Quiet WITH an error is not his pause — it is a failure
  asking for the floor, and the rescue proceeds as before. Quiet
  without one is his word, and it is final.
- **Disarm on any definite stop:** a pause that reaches the shell
  by any road — the panel, the media card, the native voice's own
  pause — invalidates the armed chain on the spot, so even a stop
  inside the first thirty seconds is already law when the fuse
  would have run out.
- **The pre-warm visit is his too:** the bubble service used to
  warm the page with a ghost visit on every service start —
  including the system's sticky restarts after the process died
  (overnight, Samsung's reaper), which pass no intent at all. A
  visit summoned by nobody was the other half of "the app appeared
  on its own". The warm-up now belongs only to starts his hand
  asked for.

The other watches were audited and stand as they are: the progress
watch already requires playing-and-busy, the stall watch requires
work in progress, and the page's session recovery only ever answers
a pressed key. Rollback: the pre-1.4.125 snapshot plus the 1.4.124
snapshot for the web files.

## ## 1.4.124 — A stop is a stop, in both directions

The self-review found the handover's reverse leak. A session handed
to the shell's voice is PAUSED on the page — so everything the page
later says about stopping lands nowhere:

- The **sleep timer** fires the page's `pause()`, which early-returns
  on a paused session: the shell's voice would read straight past
  Oscar's sleep deadline, all night if the text ran that long.
- **Starting a new text** tore the page session down (`stop()`)
  while the shell kept reading the OLD one — two sessions, one
  voice, wrong book.

The page now has a door back: `bubbleNativeStop`. The page's own
stops — its pause (the sleep timer's word included) and its session
teardown — stop the shell's voice whenever the device mode holds
the stage. And the echo is guarded: pauses that arrive FROM the
shell (its courtesy poke, a stored pause) travel a separate path
(`pauseFromShell`) and never bounce back as a stop order — 1.4.120's
law would otherwise turn every native pause into a full stop.
Older shells lack the door and simply ignore the call.

Bench: the handover probe passes unchanged on the new build (full
text handed over, the page's speech bridge untouched). CI compiles
the shell; Oscar's phone — a handed-over session that still obeys
his sleep timer — is the verdict.

## ## 1.4.123 — The detector learns where loudness lives (web)

The night's self-review caught 1.4.122's silence detector judging
the wrong witness. `envelope()` peak-NORMALIZES: every render's
envelope is scaled so its loudest frame is 1.0 — so a whisper of
noise wears a full-height envelope, and a detector reading the
envelope catches exact zeros and misses near-silence entirely.
(Flat waves in a screenshot, likewise, testify about missing peaks
data, not about loudness.) The judgment now reads the SAMPLES' own
peak — the only honest witness:

- a saved render's peak is computed where it is decoded
  (`getPersistedRender` returns it alongside the envelope);
- a fresh render is judged on its gained samples;
- the floor is 0.005: levelled speech peaks far above it, digital
  silence is 0, and faint engine noise falls under it.

Bench, before and after, same two planted poisons: under 1.4.122
the exact-zero entry was evicted and the 0.002-amplitude entry
SURVIVED; under 1.4.123 both are evicted at the first poll. The
handover to the shell's voice (1.4.122) is untouched. Web only;
the shell stays 1.4.122's.

## ## 1.4.122 — The app learns to hear silence; the session changes hands

Oscar's evidence, two screenshots nineteen seconds apart: the panel
at sentence 9, then sentence 11 — the word lit, the position
advancing, the wave strip FLAT, the toggle at rest, and no sound.
Plus his second charge: reading in Spanish, the English sentences
no longer speak English, as was agreed. One mechanism explains
both: **the voice was returning silence of exactly the right
duration.** A wedged engine — or one voice's missing model — can
synthesize zeros; every downstream system (the clock, the word
highlight, the sentence counter, the panel) then "plays" a sentence
nobody hears. The English sentences of a Spanish text are exactly
the ones a sick English model would silence. And once saved, the
saved-processing cache (1.4.112) served the poison forever. The app
had no ears. Now it does:

- **A render is judged by its envelope.** Speech — even levelled,
  quiet speech — peaks far above 0.02; digital silence is 0. A
  fresh render that comes back silent FAILS like any other render
  error (never cached, never saved), and a saved render found
  silent is EVICTED and rendered fresh. The one legitimate silence
  (a sentence that was only a code, which becomes a breath) is
  untouched — it never carries a render key.
- **A silent render hands the session to the shell.** The page's
  failure rescue now treats 'the voice rendered silence' as a
  first-class failure: `handToShell()` stops the page and gives the
  text — from the very sentence where it stopped — to the shell's
  Android TTS, which is a real voice and switches language sentence
  by sentence (the agreement, kept). The page's own device bridge
  (`playDevice`) takes the same door whenever the shell is present:
  inside a WebView, `speechSynthesis` can run a sentence to
  "completion" without producing any sound at all; real browsers,
  whose bridge is honest, keep it.
- **Shell side of the door:** a new bridge call `bubbleNative`, a
  new `BubbleService.handToNative` (which also arms the native
  chain's memory, so the older floors can see this text), and
  `NativeSpeaker.takeOver` learns to start mid-text at the handed
  sentence. The fallback chain's state moved into the companion so
  the handover and the chain share one memory.

Bench: the handover is proven end to end — with the shell stubbed,
pressing play handed the full text over at sentence 0 and the
page's speechSynthesis was never touched (0 calls). The silence
detector's bench leg could not be driven here (the sandbox browser
cannot fetch the voice model at all — "Engine error" — so the
render path never opens); its arithmetic is envelope-peak against
a floor, and its wiring is the same render() every sentence passes
through. Oscar's phone — a Spanish text with English sentences,
heard in both languages, nothing advancing in silence — is the
verdict.

## ## 1.4.121 — The floor was judging flow against a photograph of the past (shell)

Oscar's report: the panel sits on "Processing…" / "Waiting for
Logos…" and the audio NEVER begins. The native floor built in
1.4.112 was supposed to make that impossible — and in code, it
could not fire for exactly the freeze Oscar kept meeting:

- **The flow test compared the page against its state at ARM
  time** — the moment of delivery, before the page had even pulled
  the text. A page that took the text, pushed one busy state and
  then froze forever differed from that pre-delivery snapshot at
  every check, so it read as "flowing" — and both native checks
  stood down while the panel processed forever. (That is also why
  the floor's rescues were real but rare: they only fired when the
  page had never pushed anything at all.)
- **Fix: a moving baseline.** Every check re-baselines — flowing
  means the signature moved SINCE THE PREVIOUS CHECK. One move
  earns one more window (a single push followed by stone is the
  classic freeze, not flow); movement in both windows is real
  flow and the chain stands down, with the progress watch — which
  always had the right discipline — standing guard.
- **The yield asks twice.** The native voice now returns the stage
  only on sustained flow — movement at two consecutive looks —
  where one twitch used to hand it back to a page that froze again
  a sentence later with nobody left armed.
- **A failed speech engine no longer bricks the floor.** One
  transient TTS init failure latched `failed` for the life of the
  process and every later takeover surrendered on the spot; the
  corpse is now retired and each takeover may try a fresh engine.
- **The mid-session takeover checks its text.** The progress
  watch's takeover now verifies the frozen session IS the catch
  whose text the shell holds — otherwise visits are its only
  medicine, never another text's voice.

Shell-only; the web stays 1.4.119. CI compiles it; Oscar's frozen
catch — copy, wait, and hear the device voice take over when the
page cannot — is the verdict.

## ## 1.4.120 — A stop is a stop for the whole house (shell)

Oscar's report: he stops the audio, goes to other things — and later
the engine launches BY ITSELF, and throws him into the app besides.
The root, in code: **the page never heard his stop.** The device
voice is a shell creature; when Oscar pauses it, only it pauses. The
page owns the session, and its session still said "playing" — so
every later resurrection of the page (a ghost visit, a reload, a
renderer recovery, including the 1.4.117 visit reload) did what a
playing session does on waking: it started the audio on its own,
uninvited, sometimes long after. Fixes:

- **`NativeSpeaker.pause()` now pauses the whole house.** It routes
  through `BubbleService.notePagePaused()`: the page is poked with a
  definite "pause" when it can hear it, and a "pause" is stored as
  the pending command when it cannot — the page's collection has
  honoured a stored pause as silence (never as a summon) since
  1.4.89, so a resurrected page now wakes to a STOPPED session.
  Play-side intents (native resume, a takeover, a fresh delivery)
  clear the stored pause: the newest word is his.
- **Only a human arrival may turn a visit into a stay.** Any
  non-ghost intent used to strip the ghost clothes; now the intent
  must carry a human fingerprint — ACTION_MAIN (his icon, the λ
  gate, both notifications' open buttons, the paste floor — all
  stamped MAIN where they lacked it), VIEW, SEND, or the install
  action. A bare system redelivery leaves the visit a visit.
- **A visit's tenancy is ten seconds, not twenty-five** — one that
  has not breathed by then is not reviving anything the watches
  will not retry on their own.

Shell-only; the web stays 1.4.119. CI compiles it; Oscar's phone —
stop the device voice, walk away, and meet only silence — is the
verdict.

## ## 1.4.119 — The sentence is a handle

Oscar's imagination, verbatim: slide the sentence in the panel and
the progress bar moves with it — right, the bar advances; left, it
falls back. Built exactly so:

- **The gesture.** A clearly horizontal drag on the panel's
  reading-along text is claimed as a scrub (vertical drags keep their
  old job — the words still scroll; the scroll method anchors first,
  the claim only lands when the slide proves horizontal). Travel is
  counted in sentences — one per 26dp — so a short slide steps a few
  sentences in a book of any size. While the finger travels, the
  words lean with it (damped), the seek bar follows live, and the
  status line reads the landing spot ("Sentence 12 of 31"). On lift,
  the seek goes through the very door the seek bar uses
  (`seekFrac` + poke "seek", or the device voice's own seekTo) and
  the words settle back.
- **The coordinates.** Counting in sentences needs the driver's own
  numbers, so the page push and the device voice's panel state now
  both carry `ci`/`ct` (current sentence / sentence count);
  `refreshPanel` remembers them, and the scrub is simply unavailable
  until a state with coordinates has arrived.

Web + shell. The CI compile proves the shell; the gesture's feel —
claim threshold, step size, the lean — is judged on Oscar's phone,
where panel gestures have always had their final say.

## ## 1.4.118 — Honest arrows

Oscar's inconsistency, in his words: the step keys wore track glyphs
(|◁ ▷|) — the promise of another audio — while the keys actually step
one sentence, a few seconds (prev even restarts the current sentence
when it is more than a breath in). He liked the buttons as they were;
the change was allowed only for genuinely better icons. The seek pair
is precisely that: the BAR was the lie, so the bar is what leaves.
Double triangles (Rewind / FastForward on the web; ic_media_rew /
ic_media_ff in the shell) — the universal sign for "scrub a little",
same filled family as the play/pause they sit beside, same sizes,
same seats, same behavior. Everywhere the pair appears: the Listen
transport, the mini player, the bubble panel, and the media
notification.

## ## 1.4.117 — Fewer words, brighter cards, no Paste now (shell)

Oscar's round, from his screenshots:

- **Paste now leaves the panel footer.** A copied text arrives on its
  own now — the catch delivers it without being asked — so the manual
  key only repeated what already happened. The footer keeps Auto and
  Hide; `readClip` itself stays (the lever and the panel's own opening
  still read through it).
- **Hide asks first.** Tapping Hide (Ocultar) now raises the small
  confirmation card instead of removing the bubble on the spot:
  "Remove the bubble? — You can always turn it back on in Settings."
  ("¿Quitar la burbuja? — Puedes volver a activarla en Ajustes."),
  Remove / Not now. The deed itself is unchanged (collapse + stop).
- **Confirmation cards: contrast refined, text cut to the bone.** The
  explainer cards' muted steps closer to the ink in both themes
  (dark 203→226 warm; light parchment 110→84 deep) — the body and the
  cancel word were the dimmest text in the app. And every card body
  says the same in fewer words, EN and ES: Save ("Save what's playing
  to your Library, to hear it again anytime."), Lock ("Locked: a
  copied text won't replace what you're hearing." — its Paste-now
  clause died with the key), Unlock, and both ⚑ cards.
- **The black screen, one more layer.** Oscar: stopped, stepped out,
  ~30 seconds later the app surfaced on its own wearing the same
  black. A ghost visit that finds a corpse page now buries it on the
  spot: the visit whispers (`evaluateJavascript`, same test as the
  1.4.116 arrival check) and reloads the page invisibly if it cannot
  answer — instead of parking the corpse for a later arrival to meet.
  And a visit that continues across a resume re-nails its ghost
  clothes (alpha 0, transparent, untouchable), so a visit can never
  be caught visible halfway.

Shell-only; the web stays 1.4.115. CI compiles it; Oscar's phone —
the footer, the cards, and no black self-appearance — is the verdict.

## ## 1.4.116 — The unstoppable reading, and the black screen (shell)

Oscar's report, two failures in one evening:

1. **The panel's pause could not stop the device voice.** The toggle
   computes its definite intent (1.4.89's law) from the PAGE's pushed
   state — but while the shell's own speaker (1.4.112) holds the
   stage, that state is a dead letter: a takeover that began from a
   page that never got to say "playing" leaves it false forever, so
   every tap computed "play" and re-issued play. The reading could
   not be stopped from the panel, ever. **Fix:** the toggle's truth
   is the DRIVER's — `NativeSpeaker.playing` while it is active, the
   page's push otherwise. The media notification's toggle had the
   same inversion (`lastPlaying` is page-borne) and takes the same
   law in PlaybackService. The definite media-session callbacks were
   never wrong — which is why a system gesture could stop what the
   panel could not.

2. **The black screen that never left.** When a renderer dies while
   its WebView sits BACKSTAGE, the old `recoverWeb` removed the view
   from `root` (not its real parent), destroyed a still-attached
   view, and installed the replacement into a stopped activity's
   root — the backstage window kept the corpse and `bringWebHome`
   then early-returned, leaving nothing alive to paint. **Fix:**
   recovery takes the dead view out of its actual parent and seats
   the replacement in the dead page's actual place — a fresh
   backstage window when it died backstage, the root otherwise
   (poke and the media bridge read the `web` field, so they follow
   on their own). **And a belt:** a renderer can also HANG without
   dying — no funeral, just black. On every real arrival (not a
   ghost visit) the page is now whispered to (`evaluateJavascript`):
   a living page answers instantly and nothing happens; silence
   earns one reload, continued silence the full rebuild. Skipped
   when the page has never pushed state in this process — a first
   load in flight is not a corpse.

Shell-only; the web stays 1.4.115. As ever with the shell, the CI
compile is the bench proof available here; Oscar's phone — pause
under the device voice, and opening Logos after a background death —
is the verdict.

## ## 1.4.115 — The bottom-bar key (the house is gone)

Correction, plainly: 1.4.114 misunderstood Oscar. The house key left
the app for the phone's home screen; what he asked for lives INSIDE
Logos — while the audio plays, the app is immersive: the bottom bar
(the tab chips) slides away and the player settles into its place,
and the only way to see that bar again was to stop the audio. The
house, its bridge door (`toDesktop`) and its label are removed in
full. In their place:

- **The bottom-bar key** (new store `src/lib/navpin.ts`): the empty
  seat at the left of the player's transport row now carries a
  panel-bottom key, shown while the audio plays. Tapped, it pins the
  bottom bar back — the player glides up to its normal place, the bar
  returns — **without stopping the reading**; tapped again, the bar
  slides away and the player settles back down. In App.tsx the pin
  simply suppresses the immersive state (`immersive && !pin.pinned`),
  so all the existing glide choreography is reused untouched. The pin
  clears itself when playback stops: the next play starts immersive,
  as designed. Icons: PanelBottomOpen / PanelBottomClose — a panel,
  not a house. Labels: "Show the bottom bar" / "Hide the bottom bar"
  ("Mostrar / Ocultar la barra inferior").

## ## 1.4.114 — The desktop key

Oscar, from his own screenshot: inside the app there was no way to see
the home screen behind without stopping the audio first. The empty
seat at the left of the player's transport row is now a key (a house,
shown only inside the app): one tap and Logos steps aside — the task
goes to the back, the desktop emerges — while the reading keeps
playing untouched: the page parks backstage as the activity stops,
and the bubble and the media card stay in charge. New bridge method
`LogosAndroid.toDesktop()` (`moveTaskToBack(true)`, the same motion
the ghost visits leave by); the web asks `desktopSupported()` so a
plain browser keeps the empty seat. Label: "Show the home screen" /
"Mostrar el escritorio".

## ## 1.4.113 — No cropped buttons (shell)

Oscar's screenshot: with the reader dragged to his preferred width,
the panel's − and + keys hung off both edges, cut in half. Cause: the
transport row was born at a fixed 262 dp (keys 38/46/54/46/38 + 10 dp
gaps) — an exact fit only for the default 302 dp panel — while the
reader can be dragged down to 240 dp. Fix (`fitControls()`, called at
panel build and on every reader resize): the row is seated from the
panel's real inner width — gaps give first (10 → 6 → 4 dp), then the
keys scale together, the toggle always the largest. At the narrowest
panel the row still fits exactly; at default width nothing changes.

## ## 1.4.112 — Hark's backstage, made reliable + the processing is saved

Oscar, twice over: Hark's backstage (below) is the right idea and it
works — sometimes. When it doesn't, the bubble still can't load the
text without a trip into the app. And separately: stop the audio,
close the panel, come back later — the engine processes everything
again from zero, because nothing saved the processing.

- **Progress, not pulse (shell).** Every watch the shell keeps measured
  the page's pulse — its state pushes — and a stuck page can push a
  living pulse forever: Oscar's frozen panel said playing + Processing
  while the reading position never moved an inch, and every watch stood
  down. The new chain watches the position SIGNATURE (title, sentence,
  word, fraction): a caught text gets the page, then one REAL ghost
  visit (the backstage shortcut no longer neuters the rescue), then a
  fair deadline — still frozen, and the shell reads the text itself.
  The same watch stands guard mid-session for a freeze after minute one.
- **The shell's own voice (new: `NativeSpeaker.kt`).** The device's
  text-to-speech, driven from the bubble's foreground service, sentence
  by sentence — no WebView, no activity, no model: it reads even with
  the page stone dead. The panel is driven in the exact shape of the
  page's own pushes and names the voice honestly ("Device voice ·
  Sentence 3 of 12"); the amber word follows via range callbacks. Panel
  keys, the seek bar and the media notification all route to it while
  it holds the stage; if the page starts flowing, it yields the stage
  back to the neural voice. `AndroidManifest` gains the TTS `<queries>`
  so the engine is discoverable on Android 11+.
- **The backstage can't be torn down by a reclaimed activity (shell).**
  `MainActivity.onDestroy` used to release the backstage and null the
  poke unconditionally — an activity the system reclaimed in the
  background silently demolished the whole arrangement. While the
  bubble service lives, both are the service's to keep; the next
  activity replaces them, and the service's own `onDestroy` releases
  for good.
- **Pre-warm (shell).** With the bubble on and no page anywhere, the
  service pays ONE ghost visit when it starts: the page is built and
  parked backstage before the day's first copy, so the first copy is
  served at full speed instead of paying a cold visit.
- **The processing is saved (web: `src/player/rendercache.ts`).** A
  rendered sentence's WAV now goes to IndexedDB (`logos-renders`,
  ~60 MB cap, oldest swept first), keyed by the spoken string + voice
  — position-independent, so the same sentence hits in any book, any
  day; a voice change or a dictionary edit changes the key and
  correctly re-renders. On a hit the WAV is decoded by hand (no
  AudioContext, no gesture rules) and the sentence plays from disk.
  Stop, close, reload, discarded page: press play and it simply plays.
  Declared limits: the media notification still follows the page while
  the device voice holds the stage; the device voice is the system's,
  plainer than the neural one — it is a floor, not a replacement.

## ## Shell (Hark, 2026-11-09) — the backstage: the bubble reads without visiting the app

- **Cause of the trip into the app:** with Logos out of sight, its WebView sat in
  a stopped MainActivity, so Chromium counted the page hidden and throttled it
  (no frames, slow timers). A clip caught by the bubble reached a page that could
  not start the engine, so the watches paid a ghost visit (the black flash).
- **Fix (`Backstage.kt`):** when MainActivity stops and the bubble is running, the
  same WebView moves into an invisible overlay window (window alpha 0, not
  touchable, not focusable, same size). Chromium keeps it visible, so the engine
  renders and plays at full speed while Oscar stays in the other app. onStart and
  onResume take it home before the activity draws; onDestroy of either side
  closes the window. One page, one engine, nothing duplicated.
- `BubbleService.backstageServe()`: while the page is backstage, `ghostWake()` and
  `wakeForPending()` poke the page directly (pending command or "clip") instead of
  launching the activity. Ghost visits remain only for a page that is truly gone.
- Not tested on a device (no emulator here). If a phone ever shows the overlay
  stealing touches, check FLAG_NOT_TOUCHABLE and alpha 0 first.

## 1.4.110 — Wave 3 of the button audit: the fine edges (A-2, B-1, B-2, B-3, C-3, C-4, C-5, D-S2, A-3/D-5)

- **Sleep timer sheet marks the armed duration** (A-2): the store now
  remembers the chosen minutes (`sleepMins`, set and cleared inside
  setSleepTimer), and the sheet paints that option `on`, like Off
  already did.
- **A metadata edit no longer zeroes a text clip's size** (B-1):
  updateClip recomputed size from the blob on every patch; text clips
  have no blob, so fav/rename/finish wrote size 0 and the «on this
  device» header undercounted. Size now changes only when a blob does.
- **The shelf badge shows the STATE** (B-2): a temporary book wears
  «Once» with its clock, a kept book «Keep» with its pin — the label
  and aria keep naming the tap's action, as they did.
- **The clip bar is a slider only while its clip holds the stage**
  (B-3): role, label and valuenow are conditional on `active`; in
  repose it no longer advertises a seek it will not perform.
- **The reader seek never promises a number it won't rest at** (C-3):
  while dragging, fill, thumb, % and chapter all show the LANDING
  place (the seek rests on block starts) instead of the finger's raw
  share — the 77%-promised, 63%-rested gap is closed: the number
  shown is now the landing block's own share, end to end. (The scroll
  tracker's "top of the screen" line was also aligned with the jump's
  landing line, header+16 vs the old +8, so the two definitions of
  the reading place agree.)
- **Reader paragraphs answer the keyboard** (C-5): every block is
  focusable and Enter/Space selects it, exactly like a tap.
- **Errors speak the app's language** (C-4, D-S2): a failed audiobook
  export and a failed voice-model download now say what happened in
  human, translated words («The audiobook could not be finished…»,
  «Not enough storage…», «Could not download the voice model —
  check your connection…») instead of the browser's raw text.
- **The reader head's aria-labels go through t()** (A-3/D-5):
  «Smaller text», «Bigger text» and «Save to Library» were hardcoded
  English; the dictionary already carried them, they were never asked.

## 1.4.109 — Wave 2 of the button audit: reach and rescue nets (A-1/B-6, E-2, E-3)

- **A-1/B-6: the Continue row for a pasted text no longer eats itself.**
  Listen auto-prepared the draft 1.2 s after the page opened; the
  prepared session IS the draft, and the row hides whenever the session
  is the same text — so the resume offer vanished ~1.3 s after it was
  born, before a finger could reach it (two audit fronts converged on
  this). Now, while a saved resume for this exact draft stands, the
  auto-prepare waits: the row stays, and typing (which changes the
  text's key) re-arms preparation on its own. And the row's tap now
  also leaves the editor for the reading view (ContinueRow's
  onResume) — resuming is one tap again, landing on the reader at the
  saved sentence.
- **E-2: voice, ⚑ and ＋ get the transport keys' safety net.** They
  poked the page directly; if Android had retired the activity behind
  the service, the press died without a trace. All four sites now use
  pokeOrWake — a dead page means the press is stored as the pending
  command and collected after a ghost visit. The page's collector also
  re-fires mark/save/voice at the session its recovery restores (the
  one the panel was showing), like prev/next already did.
- **E-3: the media notification's buttons survive the activity.** They
  routed through a lambda the activity installs on create and clears
  on destroy; a START_STICKY revive of PlaybackService alone left a
  visible notification whose ⏮ ▶/⏸ ⏭ silently did nothing. Presses
  now go through act(): live activity — unchanged ("toggle" as
  before); no activity — the press is stored as a DEFINITE play or
  pause (from the last published state, never a bare toggle) in the
  same pending-command slot, and BubbleService.wakeForPending pays
  the page a ghost visit to collect it.

## 1.4.108 — Wave 1 of the button audit: say it only once it's true (C-1, C-2, E-1)

- **C-1 (the audit's one ENGAÑOSO): the reader's bookmark now actually
  lands.** updateBook was a bare read-modify-write; the bookmark's write
  and the reader's own position saver, holding an older photo of the
  record, stomped each other and the bookmark died. books.ts now runs
  ONE writer at a time per book (a per-id queue), every write reads the
  record fresh inside its turn, and a patch may be a function of that
  fresh record. The bookmark toggle, the panel's mark (marks.ts) and
  the Saved Marks removal (marks.tsx) all compute from the fresh
  record. And the «Bookmarked» toast is born only AFTER the write has
  landed — verify before claiming.
- **C-2, same root:** «Mark as finished» keeps its 100%: the position
  saver now derives its patch from the fresh record and honours
  `done` (progress stays 1 once done), so a later position save can no
  longer re-derive the bar back to 63%. The finish toast also waits
  for the landing.
- **E-1: the panel stops celebrating early.** The shell toasted
  «Saved to Library» in the very tap that SENT the save poke — before
  the page saved, and even when there was nothing to save. Both ＋
  confirm paths now capture whether the text was already saved and
  toast only when the page's own pushed state flips to saved
  (toastSavedWhenTrue, checks at 0.9 s and 2.2 s); otherwise silence —
  the page's toast («Nothing to save yet», «Already in your
  library») tells the truth inside the app. The ⚑ first-time card
  keeps teaching where marks live, but its title no longer claims
  the deed («The ⚑ mark», not «Marked»).

## 1.4.107 — The phone's missing line (Oscar's find: 'solo muestra la cabecita, no la cola')

- On his phone the panel's progress bar showed only the round thumb —
  no track line behind it; on the tablet the same panel drew it fine.
  Cause, in the code: the track and its gold fill were GradientDrawables
  with **no height of their own** — the 4dp line existed only as the
  layer insets' arithmetic (the bar is 24dp, insets carve 10 + 10).
  Androids that size the track from the layers' own height found none
  and drew nothing; the thumb, which always declared its 12dp, survived
  alone. The tablet's Android stretches to the insets instead.
- Fix: both drawables now declare `setSize(-1, dp(4))`; the insets stay
  exactly as they were, so the tablet's line is pixel-for-pixel the one
  it already had, and the phone gains the same line from the same place.
- Shell only, plus the version.

## 1.4.106 — A window, in both directions (Oscar: 'redimensionarlo en ambas direcciones')

- The panel reader's two axes are now **independent**, like a window:
  pull the grip sideways and the reader widens without growing tall;
  pull it up or down and it grows tall without widening; drag diagonally
  for both at once. The letters follow the average of the two axes.
- Width and height persist separately per device kind (`rscaleW*` /
  `rscaleH*`); a size saved under 1.4.105 seeds both axes on first read,
  so nobody's chosen size is lost.
- Shell only, plus the version. Everything else — the seat that grazes
  the bubble, the grip's corner, the amber walk — untouched.

## 1.4.105 — The panel's reader stretches (Oscar's idea, approved the night 1.4.104 shipped)

- **Drag the free corner**: two small gold ticks hug the corner of the panel
  opposite the one that grazes the bubble. Dragging it grows the words
  window — more sentences in view, and the letters grow with the window.
  The seated corner never moves: the panel grows away from its bubble,
  never over it.
- **Remembered**: the size persists per device kind (phone / tablet) in the
  bubble's own prefs, like the bubble's spot. One drag, once — then it
  simply opens that size.
- Shell only, plus the version: the scale (0.75–1.9) drives the panel
  width, the words window height and the words' text size together
  (`curScale` / `wordsHeight` / `wordsTextSize` in BubbleService); the grip
  shows only while the words show. Untouched at scale 1 — the panel is
  exactly the one from 1.4.104 until a hand stretches it.

## 1.4.104 — The app speaks Spanish (Oscar: a Language setting, the whole app translated, nothing working touched)

- **Settings → Language**: a new card with **English | Español**. One tap and every
  word of the interface changes — pages, sheets, menus, toasts, confirmations.
- **The whole web app** runs through one small dictionary (`src/lib/i18n.ts`,
  keys are the English strings; `src/lib/es.ts` holds the Spanish). Oscar's rule
  governed every line: **the translation fits the design, never the reverse** —
  where a faithful rendering ran long, the Spanish got shorter (`Playback` →
  `Escucha`, `Storage` → `Espacio`, the reader hint trimmed) and no layout moved.
  User content is never translated: book titles, his texts, voice names stay his.
- **The shell follows**: the page's push now carries `lang`; BubbleService
  learns it from the push (companion `uiLang`, set by the `nowJson` setter) and
  the panel, hint cards, drag targets, notification, receipts and toasts speak
  the chosen language. MainActivity's toasts and error page too.
- New setting `uiLang` ('en' | 'es', default 'en') in `logos.settings.v1`;
  `<html lang>` follows it. Nothing else changed: no engine, player, library
  or bubble behaviour was touched — only the words.
- The About credits (third-party license notices) stay as written.

## 1.4.103 — The amber walks the panel, and the window keeps it centred

Oscar, watching the 1.4.102 panel read this very chat back to him:
let it advance word by word with the amber, like the app — and
keep the reading centred, because off-centre the text hides.
The push now carries the word index (wi), timed from the
sentence's own audio envelope — the reader's method, word-lead
and all — with a character-dealt fallback when no envelope
exists; the playing cadence tightens to 120 ms to feed it.
In the panel, the sounding sentence is composed word by word:
said in full ink, the spoken word dark on gold, the words to
come in muted. The zone is now a fixed-height window (106dp
tablet, 60dp phone) the words scroll inside with faded edges,
and every word change glides the window so the amber word sits
at its centre. The panel no longer breathes in height as
sentences change — the window's size is steady; the text moves.

## 1.4.102 — The panel reads along

Oscar's idea, approved with 'Sorpréndeme': the bubble's panel now
shows the WORDS. The push carries the sentence sounding now plus
its neighbours, cleaned and capped; the panel seats a serif words
zone under the status line — on the tablet the panel widens to
360dp and the three sentences ride together (the neighbours
dimmed, the sounding one in full ink), on the phone the sounding
sentence alone, three lines at most. A sentence change settles in
with a short fade; the panel re-seats itself on its corner as its
height breathes. When there are no words — no session, or the new
Settings lever ('Words in the panel', beside the bubble's other
switches) turned off — the panel is exactly the one he knows.

## 1.4.101 — On the phone, the reader's four buttons shrink

Oscar's screenshot: on the phone the reader head's four buttons
(A−, A+, Save, Edit) ate so much width that 'Tap a word to start
there.' wrapped to two lines. Phone only (max-width 839px): the
pills drop to 24px with tighter padding and gaps, and Save / Edit
ride as their icons alone — the words return on wider screens.
The hint now sits on one line. The tablet is untouched, as he
allowed ('en la tableta quizá no haga falta'). Web only.

## 1.4.100 — The Listen reader's text grows and shrinks

Oscar's ask: make the Listen reading text bigger or smaller, on
phone and tablet, 'muy optimizado para mi tableta'. The reader now
carries a size ladder (80% → 200% in eight rungs) walked by two
small pills in the reader's own head — A− and A+ — so the size is
changed from the reading chair, not from a settings expedition;
the same stepper also lives in Settings → Playback, beside
Highlight, with the percentage shown and a reset. The size is one
CSS variable over the reader's two bases (19px phone, 21px on wide
screens), so on the tablet the ladder runs from a compact 17px to
a true large-print 42px, line-height breathing with it. The choice
persists with the rest of his settings. Web only — no APK.

## 1.4.99 — The gray screen was my transparency; the dark ground returns

Oscar's episode, in his words: the button dead for a few seconds,
then a GRAY screen he does not like, stuck for ~12 seconds, then
everything back. One story explains all three beats: Samsung had
killed Logos entirely, the first touches found no living service,
and the rescue's cold revive spent those seconds with the system's
starting window on screen. Since 1.4.91 that window is transparent
with its preview disabled — and a preview-less transparent window
is exactly what Samsung paints system GRAY while an app cold-boots.
The transparency (window background, splash background, disabled
preview) is reverted: a cold revive now wears Logos' own dark
ground, like the app opening, never a gray void. The zero-animation
starts and the quicker retire from 1.4.91 stay. Honest residue: a
revive from a full kill still takes the seconds a cold boot takes;
the lever against the kills themselves is his (Logos → Battery →
Unrestricted).

## 1.4.98 — A shallower ghost on tablets

Oscar: the tablet's screen is longer, so the bubble's ghost rest
(the fade to 15% after four untouched seconds) makes the floating
icon hard to find there. On tablets only, the rest now fades to
45% — visibly resting, but findable at a glance across the big
screen. The phone keeps its 15% whisper; the four-second clock and
the instant wake on touch are unchanged.

## 1.4.97 — A shorter graze, and a larger tablet bubble

Oscar: 'casi' — the gap between the button and the rectangle was
too long, and the Logos button on his tablet should be bigger. The
gap had a geometric cause: the panel's corners are rounded (24dp),
so its drawn edge sits ~10dp back from the geometric corner along
the diagonal; seating the corner point on the circle left the drawn
shapes a full step apart. The seat now compensates for the arc, so
the drawn corner ends ~2dp from the bubble's circle — close, and
still never overlapping. The tablet bubble grows again at his word:
76dp window, 60dp face, 66dp halo, λ at 28sp; the phone keeps its
size, and the face size now lives in bubbleFace() like the rest.

## 1.4.96 — The corner grazes the circle; nothing overlaps

Oscar, closer: 'En realidad no deben superponerse. El borde
puntiagudo del rectángulo debe apenas rozar el círculo del botón
flotante, pero en esa dirección.' The seat moves out by the
diagonal: the panel's corner point now rests ON the bubble's
circle — centre plus radius along the 45° diagonal toward the
panel — touching, never crossing. Same four corners as 1.4.95
(top-left / top-right, bottom pair when the panel opens upward),
and the birth pivot is the grazing corner itself.

## 1.4.95 — The bubble sits on the panel's corner (a correction)

Oscar corrected 1.4.94: he never asked the bubble to travel to the
device's corner. His picture: draw an arrow from the centre of the
player's rectangle to one of its corners — the bubble belongs at
the end of that arrow, pinned ON the corner of the rectangle,
wherever on the screen the pair is. So the glide is deleted whole;
the bubble never moves on its own again. The panel now deploys so
a corner lands exactly under the bubble's centre: top-left when
the bubble lives on the left, top-right on the right, the matching
bottom corner when the panel must open upward. The panel's birth
grows out of that corner. Also his second ask in the same breath:
the bubble is a little larger on tablets (66dp window, 52dp face)
— 'un poquito, un poquito más'; phones keep their size, and every
measurement that knew the old size now follows one helper.

## 1.4.94 — On open, the bubble takes its corner

Oscar: he likes the panel beside its bubble, but when the player
opens he wants the pair cornered — the λ itself glides to the
nearest top corner (left, or right when it lives on that side) and
the panel deploys tucked into the corner under it, rather than the
two settling up high mid-screen. The corner becomes the bubble's
remembered spot until a hand drags it somewhere else; closing the
panel leaves it there.

## 1.4.93 — The panel opens beside its bubble

Oscar: the free bubble exposed an old habit — the panel still
travelled to a screen edge (whichever half the bubble was in), so a
tap in one corner meant a trip to the other side. Now the panel
hugs the λ: it centres itself on the bubble horizontally and hangs
below it by preference, standing above only when the bottom edge
refuses, and sliding only as far as the screen's edges force. Its
birth grows out of the bubble from the matching edge, and once laid
out, its real height gets the final word on the spot.

## 1.4.92 — The bubble lives where his hand leaves it

Oscar: the bubble should stay anywhere on the screen, not just dock
at the sides — on the tablet above all. Until now it could be dragged
anywhere but snapped to the nearest edge on release, and it forgot
the spot on every restart. Now a drop settles where it lands: it
docks only when let go near an edge, and the place is remembered as
screen fractions — a restart returns it to its spot, and a rotation
recomputes the same relative place on the new shape instead of
losing it at a corner. The drag gates (Remove / Open Logos) are
unchanged, and the panel still opens on the bubble's nearer side,
below it.

## 1.4.91 — The visit stops flashing black

Oscar: when the engine doesn't load, the trip to the app should be
faster and unnoticeable — as it stands it looks like an error. What he
sees is the system's own starting paint, drawn before any Logos code
runs: a splash and preview window on @color/bg (#0A0A0F, near-black,
icon blanked long ago) — a full black screen, out of nowhere, then
gone. Now: the splash background and the theme window background are
transparent, the preview window is disabled, ghost starts carry a
zero-animation ActivityOptions bundle, leaving a visit also cuts with
no transition, and the visit retires 400 ms after the sound flows
instead of 900. Real opens are untouched in substance — the activity
paints its own dark ground in code on its first frame, as it always
has; only the system's black first paint is gone.

## 1.4.90 — Subtraction: the stage hold is deleted

Oscar: a white noise behind every load and Processing — new, and not
there in the simple early versions. He was right about the cause's
address: something added along the way. It was the native stage hold
(1.4.84): a loop the shell played while the page rendered. Its samples
were written {255, 0, 1} instead of {-1, 0, 1} — the -1 lost its high
byte — so the 'near-silent' file crackled audibly. The whole mechanism
is now deleted (player, audio focus, file retired), not quietened.
What remains on guard is silent: the wakelock, the watches, the ghost
visit (with 1.4.89's intent and moveTaskToBack fixes inside). Nothing
in the shell makes sound anymore except his books.

## 1.4.89 — A pause is a pause, and a visit no longer kills the page

Oscar answered the open question himself, with screenshots: shell 1.41
and web 1.4.88 were both aboard when he recorded the failure — so the
ghost build itself misbehaved, and the code shows two compounding
defects, matching his account beat for beat ('quiero parar el audio y
no me deja; me envía a la aplicación, me saca, me envía; tuve que
arrastrar la burbuja para cerrarla'):

1. THE INVERTED PAUSE. The panel sent a bare 'toggle'. Pressed against
   a dead page, the press was stored, the visit revived the page, and
   collectPending 'fulfilled' the toggle by RECOVERING THE SESSION —
   which plays it. His pause became a play. Now a press carries a
   definite intent, read from the pushed state at press time: PAUSE
   when it says playing, PLAY when it says paused, through the poke,
   the watchdog rungs and the stored command alike. collectPending
   honours a stored pause as silence (it never summons playback); a
   stored play routes through the same event road as a live press.
   Headset/media 'toggle' keeps its old handler — it acts on a living
   page, where a toggle is honest.

2. THE VISIT KILLED ITS OWN PATIENT. leaveGhost() called finish() —
   which destroys the only activity, and the WebView with it, so the
   page the visit had just revived died as the visit left, playback
   and all; the next press started the whole cycle from a corpse. A
   visit now leaves via moveTaskToBack(true): the activity merely
   stops, page and session alive, his app in front. The ghost look is
   restored 350 ms later, guarded by a visit counter so a fresh visit
   is never stripped by the previous one's cleanup; and a return with
   no intent behind it (Recents) turns any lingering visit into his
   stay in onResume.

## 1.4.88 — The ghost visit: the bubble stops dragging you into the app

Oscar's verdict on the watches: they cured the frozen voice by opening
the application, and the application then made the voice run — but that
forces the user to go to the app when he never expected to. The bubble
exists precisely to avoid that trip; it is a shortcut. He is right, and
the watches now rescue differently. Every automatic wake — the delivery
watch, the stall watch, and a panel key press that finds the page gone —
now arrives as a GHOST VISIT: MainActivity resumes transparent and
touch-through (FLAG_NOT_TOUCHABLE + FLAG_NOT_FOCUSABLE, WebView alpha
0, no transition), the page breathes and finishes its render, and the
moment its state says sound is flowing (or nothing is coming after a
fair wait) the visit leaves by itself, with a 25 s hard cap. His app
underneath stays usable the whole time; he never lands in Logos. A real
arrival mid-visit (his tap on the icon, a share) simply turns the visit
into his stay — screen back, flags off. The only full openings left are
the ones his own hand explicitly asks for: the λ Open Logos drag gate,
tapping the app, and the rare Paste-now floor that must open the app to
read the clipboard at all. Receipts renamed honestly: "needed a visit",
"panel key visited Logos". Shell + web version strings; the web code
itself is unchanged.

## 1.4.87 — Nothing is deleted by a single tap (with 1.4.86 inside)

Oscar's ask, verbatim in spirit: a confirmation window before deleting
any file. One window for the whole app — confirmDelete/ConfirmHost in
ui.tsx, a Sheet in the app's own finish naming the file and what will
happen, Cancel / Delete — and every deletion in the app now passes
through it: a book from its menu, a Library file from its menu, a
multi-select delete from the toolbar (selection mode survives a Cancel,
so a second thought costs nothing), the Saved Marks trash (the one
delete that had no Undo at all), and Settings' Delete model. The Undo
toasts stay where they existed, as a second net. The automatic Once
sweep is untouched — it is not a deletion the user taps, it is the
Once law itself. This release also carries 1.4.86 (below), built
minutes earlier and never published on its own: the pagehide dismissal
of the device voice.

## 1.4.86 — The dying page dismisses its voice

Oscar: the main app and the floating icon ran two completely different
audios at once, and one of them could not be stopped even after closing
the bubble. His Settings evidence convicted the mechanism: the receipt
read "panel key woke Logos · 3:23 PM" (the phone had destroyed the app's
page while the panel stayed alive, so a key press had to resurrect it),
and the stage journal showed the NEW session stepping healthily in the
neural voice (13→14→15→16→17, no device tags). The overlap was the OLD
session's device voice: system speech is handed to the phone's speech
service, whose queue can outlive the page that queued it — speaking a
text nobody can stop, because every stop switch lives in the dead page —
while the resurrected page starts the same session in the neural voice.
Web only: on pagehide the page now cancels its device voice first, so a
watchdog reload or any orderly teardown leaves no orphan speaking.
Neural audio needs no such dismissal; it dies with the page. Honest
residue: if the phone kills a page without warning mid-sentence, up to
that one sentence can still finish on its own — it always ends by
itself, and a force-stop ends it instantly.

# Logos — notes

Logos is a phone-first, private text-to-speech PWA. It is a simplified rebuild of
[BetterTTS](https://github.com/SysAdminDoc/BetterTTS) by SysAdminDoc (MIT). The
upstream LICENSE is kept, with an added copyright line for the Logos changes.

## What it does

- **Listen** (`#/listen`): paste or type text, or share it in from another app, and
  press Play. The text is split into sentences. Logos prepares audio until what is
  ready covers the rest of the text at the measured speed, then reads to the end
  without stopping while the remainder renders in the background. Play/pause,
  previous/next sentence, a draggable progress bar (YouTube-style, sentence
  tooltip), speed 0.5× to 2.5× (instant, pitch kept), a live spectrum drawn on its
  own thread, and the current sentence highlighted. Tap any sentence to jump there;
  sentences already rendered play instantly. Lock-screen controls via the Media
  Session API. While audio is being prepared an inaudible track keeps the page
  alive, so it keeps working while you use other apps and starts speaking on its
  own. Detects English vs Spanish per paragraph, or force EN / ES. Remembers your
  last text.
- **Create** (`#/create`): renders the whole text into an **MP3** (128 kbps, encoded
  as it goes) or **WAV** file, with voice, speed (time-stretched, pitch kept) and a
  title. Play, Download, Share, and an automatic save to the Library.
- **Library** (`#/library`): clips in IndexedDB; replay with seek, download, share,
  open in Listen, delete with Undo, search.
- **Voices** (`#/voices`): PocketTTS voices — English: Alba, Anna, Michael, Liat,
  Omer; Spanish: Lola, Javert. Preview clips in `public/previews/pk_*.mp3`
  (generated in Node with pocket-tts-onnx). Star favourites, set a default per
  language.
- **Settings** (`#/settings`): voice status and download progress, Download now,
  Delete model, storage with "Protect", download on first play, device voice
  bridge (off by default), speed, pause between sentences, highlight, theme, About.
- **Offline**: the service worker caches the app shell, the ONNX Runtime WASM, and
  the PocketTTS manifest/voice files; pocket-tts-onnx keeps the models in Cache
  Storage (`pocket-tts-models-v2`). After the first download everything works
  offline.
- **Share target**: installed PWA appears in Android's share sheet.

## Voice engine

- [Pocket TTS](https://github.com/kyutai-labs/pocket-tts) by Kyutai (100M params,
  CC BY 4.0), exported to ONNX by
  [pocket-tts-onnx](https://github.com/thewh1teagle/pocket-tts-onnx) (CC BY 4.0),
  running on ONNX Runtime Web (WASM, multi-threaded) in a Web Worker.
- One model per language (~179 MB each), downloaded the first time that language is
  read. One worker per language; phones keep one loaded at a time.
- `src/engine/pocket.ts` (manager + priority queue), `src/engine/pocket.worker.ts`,
  `src/engine/engine.ts` (the app-facing API and status store).
- A cached model loading into memory shows as Ready; play waits for it quietly.
- The service worker adds COOP/COEP headers (cross-origin isolation, adapted from
  BetterTTS) so ONNX Runtime can use threads on GitHub Pages.

## Build & deploy (GitHub Pages)

```bash
npm install
npm run build              # → dist/
```

- Base path in `vite.config.ts` (`VITE_BASE`, default `/Logos/`).
- Deploy: copy the contents of `dist/` to the root of `Oscarvelz/Logos` (main),
  keep `.nojekyll` and `LICENSE`. Source lives on the `source` branch.

## Licences

- Code: MIT (© SysAdminDoc, © Oscar Arnoldo Velasquez for the Logos changes).
- Pocket TTS models: CC BY 4.0 (Kyutai); pocket-tts-onnx: CC BY 4.0. Credited in
  About and LICENSE.
- `@breezystack/lamejs` (MP3): LGPL-3.0. Fonts: Manrope, Instrument Serif (OFL).

## Tests (headless Chromium)

`test/`: `ui.mjs` (pages, layouts, themes, share target), `pocket120.mjs`
(PocketTTS English + Spanish playback), `seek121.mjs` (instant back, scrubber),
`bg122.mjs` (keep-alive while preparing), `viz113.mjs` (off-thread spectrum).
`chain-proxy.mjs` lets headless Chromium reach Hugging Face. Real audio output,
lock-screen controls and true background behaviour need a real phone.

## 1.4.15 web import (moved from project brief)
- src/lib/webtext.ts fetchWebText: Wikipedia API → Jina Reader (r.jina.ai JSON) → raced CORS relays (api.cors.lol, codetabs, allorigins, corsproxy.io) + @mozilla/readability. finish() strips links, images, tables, [n], captions/credits, bylines, dates, junk, stop sections.
- Sandbox IP blocked by Jina/relays; tests route api.cors.lol to curl (test/webrelay1415.mjs, test/webui1415.mjs).
- UI components/webimport.tsx: input → loading → preview → Listen now / Listen later / Save the audio. Library + opens it; clipboard URL on Listen opens it; bare URL in editor shows .url-banner. Clips carry url and site.
## 1.4.22
- text.ts expandAbbrev (ES_ABBR) via speakable(text, lang) in listen + exporter: EEUU/EE.UU./E.E.U.U. → Estados Unidos, RR.HH., FF.AA., JJ.OO., Sr./Sra./Dr., etc.
## 1.4.23
- src/engine/keep.ts startKeeping() (main.tsx): persist() at start; after each engine/lang turns ready, checks the cache 4 s later and stamps localStorage logos.kept; on start a stamp without a cache sets logos.keepNote 'cleared'; a failed write sets 'notSaved'. Settings Storage row shows Protected/Not protected and the note. Test test/keep1423.mjs.
## 1.4.24
- vite.config.ts plugin pocketAssets swaps pocket-tts-onnx's dist/assets.js for src/engine/pocket-assets.js (page + worker; NOPATCH=1 disables). Downloads into one buffer and caches it once (stock kept ~3 copies, ~530 MB peak). Streaming response.clone() into Cache.put failed ("network error") for the 177 MB model in Chrome, so not used. Tests test/pocketcache1424.mjs, test/phononcache1424.mjs (both cache fine in sandbox).

## 1.4.27 Books (2026-11-05)
- Library has a Saved | Books switch (`logos.shelf`). Books live in IndexedDB `logos-books` (stores `books` = BookMeta incl. cover Blob, `content` = chapters). `src/lib/books.ts`.
- Import: `src/lib/book/import.ts` → epub.ts (JSZip; spine, nav/ncx contents, internal links + footnotes; a long file is split where a contents entry lands on a heading), pdf.ts (pdfjs-dist **legacy** build, since the modern build needs Uint8Array.toHex; rebuilds paragraphs/headings, drops running heads and page numbers, reads printed page numbers, keeps outline and link annotations snapped to words, cover = page 1 render; scanned PDFs refused), formats.ts (docx via mammoth, fb2, html, md incl. footnotes, txt incl. Gutenberg START/END + chapter-line detection, rtf). Shared `html.ts` walker and `finish.ts` (chapterize, resolve links, contents, auto links: contents-page lines, "capítulo IV"/"chapter 4" mentions, "página 37" in PDFs).
- Reader `src/pages/BookPage.tsx` at `#/book/<id>` (hides topbar/nav via html[data-book]): header (search, contents, Aa), chapter view, Back chip after link jumps, note pop-up for footnotes, search across the book (accent/case-insensitive, 500 cap, find bar with prev/next), tap a paragraph → Listen from here / bookmark / copy, bottom bar with progress, time left, Listen. Position saved per book.
- Not supported: MOBI/AZW/DJVU/DOC/ODT (message asks for EPUB or PDF); OCR for scanned PDFs; sharing files into Logos.
- Tests: test/books1427.mjs (import summary), test/reader1427.mjs (reader flows); fixtures in test/books (not pushed).

## 1.4.28 Share books into Logos (2026-11-05)
- manifest share_target is now POST multipart to ./share-target (title, text, url, files "books": epub/pdf/docx/fb2/txt/md/html/rtf + octet-stream). sw.js takeShare(): files → Cache `logos-share` (`__share/<stamp>-<i>`, x-name header) then 303 to `?sharedfiles=N#/library`; text → 303 to `?title&text&url` (old consumeShareTarget path). LibraryPage takeSharedFiles() → importMany() one after another ("Importing 2 of 5"). Needs the SW active (any earlier visit). Test test/sharefiles1428.mjs.

## 1.4.29 PDF import cleanup (2026-11-05)
Oscar's OCR'd PDF (How the Mind Works) imported badly: blurb as title, running heads "24 I HOW THE MIND WORKS" kept, OCR junk lines as chapters.
- pdf.ts: per page, drop caps join their line; OCR noise lines dropped (letter share < 45 % or word quality < 0.5). Running heads matched fuzzily (letters-only key, top 3/bottom 2 lines, ≥3 % of pages, contains/Levenshtein). Printed page numbers also read from the start of a running head.
- Title: PDF metadata (junk-filtered) → most frequent running head (title-cased) → file name with 2+ words → first big line on page 1.
- No outline: chapters from the printed contents page (entries "IX. Title 89", sub-entries ending in comma dropped, running-head garbage cut before the chapter number), placed via printed→PDF page map or its usual offset, matched to the heading on that page.
- Headings must not start lowercase and need word quality ≥ 0.7.
- Book reader: mini player hidden on #/book; the bottom bar Listen turns into Pause while playing. Mini player text now wraps, no ellipsis.
- Fixture test/books/talks.pdf (archive.org talkstoteacherso00jame_bw, OCR layer): 15+2 chapters from its contents page, real title.

## 1.4.30 Book polish (2026-11-05)
- Reader header shows the short title (before ":"/"—") wrapped, no line clamp/ellipsis. Import card title and web-loading line wrap instead of ellipsis.
- PDF cover: first non-blank page of 1–4 (ink > 1.2 %), else the drawn cover.
- Author "James, William, 1842-1910" → "William James" (tidyAuthor in finish.ts).

## 1.4.31 (2026-11-05)
- Launch splash in index.html (pure HTML/CSS, shows before JS): starts as the exact app icon (matches Android's native splash), gold shine sweeps the lambda, sound ripples pulse from the arcs, mark lifts and shrinks, "Logos" letters rise, tagline "Listen to anything", then zoom/blur fade. Min 2.9 s, max 6 s, once per session (sessionStorage logos-splash), reduced-motion static. main.tsx calls window.__logosReady after paint + fonts. Frame test test/splashframes.mjs (pauses animations at set times).
- Voice chip shows the voice actually reading (voiceFor(lang) / s.voices[current]); before it showed the saved override even when Auto picked the other language.
- PDF contents: parsed line by line first ("J Standard Equipment 3" → 1.; OCR digit map J l I | ! O S B; roman front-matter pages like "Preface ix" placed by title), with the paragraph reading as fallback; the reading with more chapters wins. Fixture test/books/mindlike.pdf (fpdf2, synthetic Pinker-like).
- Pages taller than 2.2 screens (Voices) enter without blur (pageInLong) — Oscar saw the screen drop on Voices.
- index.html now also copied to the source branch.

## 1.4.32 (2026-11-05)
- Splash: first frame now matches Android's native splash on Samsung (squircle rx 200/512, content at .91 scale, 98% size, 10px above centre); during the lift the squircle morphs to the 116 radius and content to full size (1.15 s, starts .7 s). Ripples/arcs/glow wait ~.5 s so the first frames are the still icon. Lockup is absolutely positioned around the screen centre.
- Book ⇄ Listen: listenFrom saves a paragraph map (lib/book/nowreading.ts, localStorage logos.nowReading). Book bar shows Pause + "Follow" (→ Listen) when this book is the one in Listen. Listen head shows the book card "Back to book", which sets the book's pos to the paragraph being read and opens it. Test follow1431.mjs.

## 1.4.33 + Logos for Android (android-1, 2026-11-05)
- Android shell lives in branch `source` at android/ (package com.oscarvelz.logos, minSdk 29), workflow .github/workflows/android.yml builds on push to android/** and publishes release android-N with Logos.apk (https://github.com/Oscarvelz/Logos/releases/latest/download/Logos.apk). Signing key logos.p12 (alias logos); private copy + password in /workspace/work/logos-android-private. Working copy /workspace/work/logos-android.
- Shell: WebView on https://oscarvelz.github.io/Logos/ with app-private storage, UA tag "LogosAndroid/x", renderer priority important, native ACTION_OPEN_DOCUMENT picker (any file when accept lists extensions), share/open-with intents (text → ?title&text, files → ?sharedfiles=N#/library read via bridge sharedList/sharedChunk/sharedDone), downloads via bridge saveChunk/saveDone into Download/Logos (+share sheet for Share buttons), PlaybackService (mediaPlayback foreground service, MediaSession notification with prev/play/next, partial wake lock while playing), self-update check on android-N releases, plain dark Android 12 splash (page splash fades the mark in when UA has LogosAndroid).
- Web side: import.ts takeFromAndroid; audio.ts downloadBlob(blob, name, share) Android path; listen.ts reports playback to LogosAndroid.playing and listens for logosandroid-toggle/next/prev; phonon threads() also allows threads when shared WebAssembly memory works without cross-origin isolation (WebView).
- Unverified on a device: WebView speed / threads, notification, shares. No emulator in the sandbox.

## 1.4.34 (2026-11-05)
- Real cause of the Voices "drop": on a 384 px-wide phone the voice cards were 375 px (grid 1fr min-content), making the page 393 px wide; Android then zooms out and the fixed bottom bar slides down and gets clipped. Fix: voice-grid minmax(0,1fr), voice-card min-width 0, html/body overflow-x clip.
- In the Android app (UA LogosAndroid): Storage says "Kept inside the Logos app…", no Protect button, no Device voice bridge row.

## 1.4.35 (2026-11-05)
- Tablet (≥1100 px, Galaxy Tab S10 Ultra landscape): Listen editor/reader fill the screen height beside the player; Settings in two balanced columns (set-cols/set-group).
- Books shelf: cover size control (small/medium/large, localStorage logos.shelfSize; phone default large = 2 a row, tablet default medium). Phone S/M/L = 4/3/2 a row; wider screens minmax 100/138/184.
- Book reader text can now go down to 11 px (was 14).

## 1.4.36 (2026-11-06) — tablet only; phone frozen at Oscar's request
- Old-version flip-back: sw.js navigations now fetch with cache 'no-cache' (GitHub Pages' 10-min HTTP cache handed back the previous index.html), install pre-cache uses cache 'reload', other network-first GETs no-cache; register with updateViaCache 'none' and reg.update() on visibility.
- Ready/Voice status pill moved from the rail's bottom corner to under the brand (rail-status).
- Listen ≥1100: right column = player + TabletDesk (src/components/desk.tsx): Continue/Start reading book card, Favorite voices chips (hidden when height ≤900), Recent in Library (opens in Listen).
- Book reader ≥1100: contents/bookmarks pinned in a left column (TocBody side), header Contents button hidden there, bottom bar centred over the text column.

## 1.4.37 (2026-11-06) — big tablet (Tab S10 Ultra landscape ≈ 1973×1202 CSS, DPR 1.5; portrait ≈ 1232×1973)
- Measured from Oscar's screenshots (rail 138 px real = 92 CSS). ≥1500 px rules at the end of styles.css; phone untouched.
- Listen: text | player + desk | TextMap (stats: listening time, words, sentences, paragraphs, language, % heard; paragraph map that jumps with seek). Editor/reader fill the height.
- Create: text | settings | RecordingsPanel (play recordings in place).
- Library: Saved and Books side by side (lib-split), tabs hidden.
- Voices five across; Settings three columns; Book: contents | text (860) | BookInfo (progress ring, time left, Listen/Search/Text, bookmarks).
- Test: /tmp-style script big.mjs at 1973×1180 and 1232×1940.

## 1.4.38 (2026-11-06)
- Tablet (>=840): engine pill moved from the rail into Listen title line, right edge (.lh-status); rail pill hidden on Listen. Phone untouched.

## 1.4.39 (2026-11-06)
- Paste in the Android app: WebView blocks clipboard-read, so readClipboard() (src/lib/clipboard.ts) uses LogosAndroid.clipboard() (new in the shell, ClipboardManager) and falls back to navigator.clipboard.

## 1.4.40 (2026-11-06)
- Listen Paste button now loads the clipboard text and starts playing at once (was: open editor and only prepare). Test test/pastetest.mjs (stubs LogosAndroid.clipboard). Android signing moved to secrets LOGOS_KS_B64/LOGOS_KS_PASS, key v2 (v1 was public).

## 1.4.41 (2026-11-06, Muse, at Oscar's request)
- Books shelf grid: tile titles clamped to two lines with an ellipsis and a fixed two-line height, words no longer break mid-word (was overflow-wrap: anywhere, unlimited lines, uneven cards). Full title still shows in the reader and the book menu.
- Recently read sort: the tile sub-line now also says when the book was last read (Today / Yesterday / N d ago / date), so the order is visible on the cards.

## 1.4.42 (2026-11-06, Muse, at Oscar's request)
- Book reader: the bottom bar's progress line is now a seek bar. Drag (or tap) anywhere on it to move through the book by words, like scrubbing a video: while dragging, the bar previews the target percent and chapter in a small bubble and the % / chapter readout follows; releasing jumps there (undoable via Back). Arrow keys move 5% when the bar is focused. New inverse helper posAtProgress in lib/books.ts (progressAt's mirror). The drag works within a single chapter too, by block word counts.
- Reader header on phones: the book line is now one line with an ellipsis instead of wrapping, the chapter title is capped at two lines and no longer breaks words mid-word, and the header icons align to the top line instead of floating mid-title.

## 1.4.43 (2026-11-06, Muse, at Oscar's request)
- Listen "Back to book" card: only the book name's layout changed (icon and card design untouched). The title is now capped at two balanced lines with an ellipsis and no longer breaks words mid-word, so it sits evenly in the card instead of sprawling and leaving empty gaps.

## 1.4.49 (2026-11-07, Muse, at Oscar's request)
- No more Android-gray menus: the two native `<select>` sort controls (Books shelf, Library) are gone. A new `MenuSelect` in ui.tsx keeps the same themed pill when closed and opens the app's own Sheet (premium floating window, display-font title, menu-list rows, the current choice marked with a gold check) instead of the platform's gray option sheet.
- Premium media notification: Android draws the notification / lock-screen media card from Media Session metadata — the app cannot style the card, only feed it. Listen's metadata now titles the card with the book's title when the text came from a book (via the now-reading map) instead of the current sentence, which scrolled random headings across the card; both players (Listen and clips) offer a dedicated full-bleed artwork (`public/media-artwork.png`, 1024px, warm charcoal with gold lambda, arcs and ring, plus a 512px version) at absolute URLs, so the card takes the app's warm dark-and-gold theme instead of a generic system blue. The home-screen icons are unchanged.

## 1.4.48 (2026-11-06, Muse, at Oscar's request)
- OCR for scanned PDFs, as a fallback only: while a PDF is read page by page, any page whose text layer yields under 30 characters is rendered at 3× and read with Tesseract (English + Spanish), and the recognised lines — words with their positions and sizes — are converted into the same line shape the text layer produces, so segmentation, headings, chapters and the cover-title pass treat a scanned book exactly like a typed one. Typed pages never touch OCR. The engine and both language files are vendored under `public/ocr/` (~18 MB, fetched lazily on the first scanned page, so the app shell is unchanged) via the `tesseract.js` dependency; a page with no ink skips OCR entirely, words under 25% confidence are dropped, and the parser's existing line-quality filter still removes seal/logo noise afterwards. Verified beforehand on Oscar's scanned DC5-716 form: prose and field labels read at 95%+ (the import progress shows "Reading scanned pages (OCR)"); checkbox grids still come out rough, and a fully scanned book takes seconds per page — this rescues otherwise unreadable files, it does not make scans equal to typed text. The old "scanned pictures" error now only appears when OCR also recovers too little.

## 1.4.47 (2026-11-06, Muse, at Oscar's request)
- PDF titles: the importer now reads the title the way a person does — from the cover. A new pass over the first three pages takes the lines printed in display type (≥1.8× body height), groups them by size, and uses the biggest qualifying group as the title (title-cased when the cover shouts in caps). Guards: a lone short word in strictly the biggest type is the publisher's mark, not the title (the CBI-SUA cover leads with "UCCI" over "SUBSTANCE USE ADULT"); generic section words (Contents, Preface, Introduction…) never qualify; running heads are excluded. Priority is now metadata title → cover title → running head → first-heading guess → filename, so a good printed title is no longer outranked by the file's name. Verified against real files: the Grammar Checker Manual (no metadata) now imports under its printed title instead of a filename expansion, and CBI-SUA's cover resolves to "Substance Use Adult" when its metadata is ignored.

## 1.4.46 (2026-11-06, Muse, at Oscar's request)
- Importing a single book (PDF included) no longer leaves you on the shelf watching the Importing card: when the import finishes, the book loads straight into Listen and starts reading aloud from the beginning, with the text following along — the same session the book page's "Listen from here" builds (now-reading map, draft, 40,000-character session cap), started from chapter 1. A book with no readable text falls back to opening in the reader as before. Multi-file imports keep the previous behaviour (toast on the shelf, no auto-play).

## 1.4.45 (2026-11-06, Muse, at Oscar's request)
- Reader bottom bar: the bar is taller at the top (top padding 6px → 18px), giving the progress track its own lane above the buttons. In 1.4.44 the inset track (top 8px) landed in the buttons' band and the line crossed over the play and Follow buttons; now the track passes above them in its own space, clear of both. The drag strip shrinks to that lane (20px), and the mini player offset above the bar grows with it (78px → 90px).

## 1.4.44 (2026-11-06, Muse, at Oscar's request)
- Reader bottom bar: the progress track no longer rides the bar's top border, where the bar's rounded corners and overflow clipped it (and sliced the thumb in half at 0%/100%). The track now sits inside the bar (14px insets, 8px down, rounded ends, 4px tall) with the thumb riding inside it; drag fractions are measured against the inset track itself, so the thumb stays exactly under the finger, and the seek tooltip follows the same inset.

## 1.4.85 (2026-11-08, Muse — shell: the stall watch, and the hold confines itself)

Oscar's verdict on 1.4.84, with the screenshot to prove the confession worked: press play, close the window or lock the phone — white noise forever, 'Waiting for Logos…' in the panel. Two lessons. (1) The native hold keeps the PROCESS alive, but a hidden page's workers can still be frozen by the browser — and a frozen page sends no pushes, so nothing noticed. The STALL WATCH now watches the pulse: while the state says the page is working (rendering a sentence, or building its head start), eight seconds without a single push is a stall, and Logos comes forward by itself — where, in Oscar's words, the same work takes seconds; six more silent seconds and the page is reloaded as it arrives (receipts: 'the render needed a wake' / 'the render needed a reload'). A page whose pulse advances is working, however slowly, and is left alone. (2) The hold outstayed its welcome: with the page frozen, the busy state never cleared, so the near-silent loop (and the page's own) hissed on forever. It is quieter now, and it EXPIRES after sixty seconds unless a fresher busy push renews it — protection with a term, never an open-ended noise. The stale 'Waiting for Logos…' confession also covers the Preparing… state now.

## 1.4.84 (2026-11-08, Muse — shell: the shell itself holds the stage while the page renders)

One gap survived 1.4.83, and Oscar's screenshot caught it the same afternoon: the panel caught a long copied text and showed 'Processing…' — the page HAD started (so the delivery watch confirmed and stood down) — but the backgrounded page then simply never finished rendering, until he opened the real app, when it took seconds. The page's own silent keep-alive loop was supposed to make the system count it as playing media; this time it wasn't believed. So the shell stops asking the page to vouch for itself: while the pushed state says BUSY, the service holds the stage NATIVELY — audio focus plus its own near-silent looped file — the same credentials a music app presents, held exactly over the vulnerable stretch and released the moment real audio flows or the state rests. The delivery watch also learned the difference between alive-and-working and frozen-mid-work: after a wake, a page whose pulse advances is left alone however long its render takes; a page whose pulse has not moved, still claiming busy, climbs to the reload. And the panel tells the truth about a stall: a 'Processing…' whose state is twenty seconds old reads 'Waiting for Logos…'.

## 1.4.83 (2026-11-08, Muse — shell + web: a catch must confirm, and every ladder gains its last rung)

Oscar named the exact stretch where the floating stage dies: copy a text, open the panel, tap anywhere outside to close it — the text never plays; reopen the panel and it is frozen, its play key dead. His own receipts isolated it: the catch READ fine ('read 826 chars via the panel'), yet no stage move ever followed. The handoff was the weak link: the shell stores the text and pokes the page once, and the page collected a stored catch ONLY on that poke — a poke that falls into a sleeping page is lost, and the text sat stored forever while the panel showed the last living state like a photograph. Now: (1) THE DELIVERY WATCH — every catch arms a watch in the shell; the page confirms by pulling the text or pushing a living state, and if no confirmation lands in ~2.5 s the shell brings Logos forward itself so the page collects the text in the open (receipt: 'the catch needed a wake'); if the page that comes forward is itself dead, a second check asks for a reload as it arrives ('the catch needed a reload'), and the fresh page recovers both the session and the catch on its own. (2) THE PAGE PULLS ON ANY RETURN — focus, visibility, and startup all pull a stored catch, not only the poke (the pull clears the store, so repeats are safe). (3) THE PLAY KEY'S LAST RUNG — poke, wake, and now, if the state still has not moved after the wake, a native reload of the page in place; the shell's 'reload' command is intercepted by the activity and never reaches the dead page as an event.

## 1.4.82 (2026-11-08, Muse — web only: the playhead may never leap)

Oscar's screen recording: mid-playback the panel's counter sprinted from sentence 4 to sentence 12 in about a second — digits overlapping in the recording — while the app itself stood at sentence 4 and kept playing calmly; the panel's seek dot raced to match its counter. Two roads let the position teleport instead of step: the time-follower (syncCurrent) adopted whatever sentence the audio clock computed, however far away, and the audio element's 'ended' handler snapped the position straight to the track's last sentence in a single set. Both are now fenced: time-following may advance the position by at most one sentence per step (the playhead physically crosses boundaries one at a time), and the 'ended' handler advances from where the playhead honestly is, no snap. And so the next mystery, if there ever is one, solves itself: the page now keeps a stage journal — every move the playhead makes, with the clock and the voice mode — and Settings shows the last few under 'Stage moves'.

## 1.4.81 (2026-11-08, Muse — web only: the endless Processing was an invisible head start)

Not every eternal 'Processing…' is a hang. The cushion — the head start the player builds so a slow phone never stops mid-text — sized itself from the render-speed average, and that average was a LIFETIME one: the first synthesis after a model loads (ten times slower than the rest) poisoned it, the formula then demanded nearly the whole text rendered before the first sound, and the panel showed a bare 'Processing…' with no progress while minutes of honest work went by. Short texts never noticed; longer copies 'stayed dead'. Three corrections: (1) render speed is now measured over the last eight sentences only, so one warm-up falls out of the average almost at once; (2) the cushion has a wall-clock budget — after 25 seconds it plays with whatever head start exists and keeps rendering ahead during playback (running dry later shows an honest per-sentence Processing…, never one endless silence up front); (3) the panel now SHOWS the preparation — while the cushion builds, its line reads 'Preparing… N of M to start' instead of the frozen word.

## 1.4.80 (2026-11-08, Muse — web only: nothing in the voice engine may hang forever)

The other corpse, found with Oscar watching: with the NEW APK installed, the panel open in front of him, the app untouched, a copied text sat in 'Processing…' forever. The trail: both voice engines run a single-file queue — one job in flight, the rest waiting — and NOTHING anywhere had a timeout. One synthesis that never answers (a wedged worker, a deadlocked model) jams the queue for every sentence behind it, and playIndex waits on that promise eternally: no error, no fallback, no sound. Now the silence itself is treated as death. (1) A dispatch watchdog in both engines: a job unanswered after 45 s is failed with a TimeoutError, the wedged worker/instance is buried, and the next job raises a fresh one. (2) A load watchdog: a model load that reports nothing — not even progress — for two minutes is killed and its waiters failed honestly. Progress refreshes the clock, so a slow honest download is never touched. (3) The session layer refuses silence: if the playhead's render fails while the listener waits, the device voice reads that one sentence (once per sentence per session — a rescue, never a loop) while the neural engine heals. Worst case now is a pause while the engine restarts itself — never an eternal Processing…

## 1.4.79 + shell (2026-11-08, Muse — the icon keeps working after the tap: a wakelock for the render)

Oscar's law, stated plainly: 'el usuario pretende que lo único que está en sus manos es tocar el icono para que el icono haga después su trabajo.' But copy → tap the bubble → lock the screen (or tap away to dismiss the panel), and the text never became sound. The diagnosis: the vulnerable stretch is the RENDER — while the engine synthesizes the first sentences no audio is playing yet, so nothing tells the device to stay awake; the screen locks, the processor suspends, and the work sleeps mid-sentence. The shell already ran as a mediaPlayback foreground service with the WAKE_LOCK permission declared — it simply never held one. Now every state push calls syncWakeLock: while the pushed state says playing or busy, BubbleService holds a PARTIAL_WAKE_LOCK (ten-minute holds, refreshed by each push, released the moment the state rests, and never honoured from a state older than 90 s — a dead page can't drain the battery). One tap; the icon finishes the job in the dark.

## 1.4.78 + shell (2026-11-08, Muse — the cards soften: one tone away, not the other pole)

Oscar's refinement of.77, in his words: 'El contraste está demasiado marcado. ¿Qué tal un charcoal o un gris oscuro que no se acerque al negro puro para poder demarcar contraste, pero permanecer cerca del tema del reproductor?' The full pole-swap (cream on dark) shouted. cardPal() is now its own gentle step: on the dark player, a WARM CHARCOAL (79,70,58 → 60,53,44 — a dark gray that never nears pure black) with a fine gold edge; on the light player, a deeper parchment. Demarcated, close to the player's theme, never Android gray.

## 1.4.77 + shell (2026-11-08, Muse — the explainer cards wear the other pole)

Oscar liked the round but caught the blend: 'the pop-up windows should be a different tone so they don't get mixed up with the player… I don't want the Android gray. I despise that design. I want something premium, but at a different tone, keeping everything cohesive with the beauty of logos.' The hint card drew from the panel's own palette, so card and player merged into one surface. The palettes are now two named members of the family (lightPal / darkPal), and the explainer cards take the OTHER pole: a cream card laid on the dark player, a dark note on the light one — unmistakably a separate sheet, still entirely Logos. No gray, nothing foreign.

## 1.4.76 + shell (2026-11-08, Muse — marks ask where they would live; a lock guards the stage)

Two circumstances from Oscar. (1) MARKS: the ⚑ on a text that lives only in the moment would leave marks with no home — 'si guarda marcadores de audios que en la librería no están, luego se va a hacer complicado encontrarlos'. The pushed bubble state now carries `saved` (the playing text is a book, or matches a text clip in the Library). On saved content the ⚑ marks at once, as before — a moment cannot wait for a card — and explains itself exactly once. On unsaved content it refuses kindly: a card ('Not in your Library yet — marks live with their audio…') offering **Save to Library** first. (2) THE LOCK: a 🔓/🔒 key joins the panel's title row. While locked, automatic catches cannot evict what's playing — deliver() turns non-manual deliveries away at the gate ('the lock held a copy back' in the receipt line) and the page's own arrival read honours the same lock through the new bubbleLock bridge; **Paste now**, a hand ask, always lands. The lock explains itself by card before it takes or releases the stage, like the + and the ⚑: every panel button now says what it does, briefly, before it does it.

## 1.4.75 + shell (2026-11-08, Muse — a 'Processing…' line, and a watchdog for the zombie bridge)

Oscar separated the two silences himself: sometimes the engine is simply rendering ('se demora') — for that he asked a line that says PROCESSING instead of no feedback; and sometimes, even with a tiny copied text, the panel 'no responde al tacto y a la orden de reproducir'. (1) The pushed bubble state now carries `busy` (the engine's buffering flag — neural audio being rendered for the current sentence), and the panel's sub line reads 'Processing…' while it lasts, in place of the sentence line. (2) The deeper death: the activity can live while its WebView renderer dies, leaving `poke` non-null but speaking into nothing — the .72/.74 wake only fired when poke was null. The toggle key now carries a WATCHDOG: a landed toggle always flips the playing bit in the pushed state; if ~1.2 s later it has not moved, the press escalates to the full forced wake (pendingCmd + bring Logos forward), behind which the .74 session recovery waits.

## 1.4.74 (2026-11-08, Muse — the wake now brings the session back, not just the app)

Oscar, with the new shell in: 'Pensé que ya estaba resuelto pero ahí sigue dormido.' He was right — 1.4.72's wake was half a cure. When Android retires the page, the SESSION dies with it; waking Logos and replaying the press onto an empty player still feels like a dead panel. The collected press now rebuilds what was playing before it lands: the same three legs Continue listening trusts, newest first — a book from its saved page (playBook at meta.pos), a clip from its saved second (or its text), a pasted/copied text from the draft store at its tracked sentence (resume.ts key + idx). 'toggle' is fulfilled by the recovery itself (it plays); prev/next are replayed onto the restored session a breath later. Web-only on top of the 1.4.73 shell.

## 1.4.73 + shell (2026-11-08, Muse — the experiment retires with its answer; the + key explains itself)

Oscar ran the probe on his Samsung: the signal did not come through — 'El experimento no parece haber funcionado, entonces ya tenemos nuestra respuesta.' Even holding the one window focus, One UI did not deliver another app's copy to the bubble. The doubt is closed on paper AND on his device. The experiment is therefore retired whole: listener, probe mode, Settings switch and bridge all removed — no dead switch left behind. And his second ask in the same breath: the panel's + key now explains itself before acting — tapping it raises a small floating card in the panel's own finish ('Save to Library — keeps the text playing now in your Library, so you can hear it again whenever you like') with **Save** and **Not now**; Save does the deed with its toast, the card also fades on its own after 9 s or when the panel closes.

## 1.4.72 + shell (2026-11-08, Muse — the panel keys can no longer die in silence)

Oscar: 'A veces el reproductor flotante no responde al play después de un rato.' The chain is panel key → BubbleService.poke → MainActivity's WebView. MainActivity nulls `poke` in onDestroy — and Samsung retires stopped activities behind a living foreground service, so after a while the panel (native, still showing the last state) presses into nothing. The keys now check: if the page is asleep, the press is REMEMBERED (`pendingCmd`), Logos is brought forward, the waking page collects the press through `bubblePendingCmd()` and dispatches it like a live one (transport keys only fire if a session is actually active), and the wake leaves its receipt in Settings' 'Last clipboard try' ('panel key woke Logos') — so the next silent press, if any, names itself.

## 1.4.71 + shell (2026-11-08, Muse — the copy experiment: closing the last centimetre of doubt on Oscar's own phone)

Research verdict (sourced, 2026-11-08): for an ordinary overlay + foreground service, background copy detection DOES NOT WORK — AOSP gates both the clip-change listener and reads to the single focused window's owner or the default IME (denial reproduced on Galaxy S21/A72: "application is not in focus"). Zero-tap auto-play is impossible for that shape; it exists only via the default IME, Accessibility heuristics, or an ADB-granted READ_LOGS watch. One gap no source closed: nobody has device-tested a FOCUSABLE overlay against the gate. So the shell now carries the experiment, off by default: BubbleService registers an OnPrimaryClipChangedListener (any heard signal waves the bubble and leaves its receipt in Settings' "Last clipboard try"), and a **Copy experiment** switch (Settings → Floating bubble) makes the bubble window FOCUSABLE — holding the one focus — whereupon a heard signal also attempts the read and, if the text comes through, plays it. Two minutes decides it on his Samsung; the switch warns that typing elsewhere may not connect until a text field is tapped, and turning it off restores the polite bubble.

## 1.4.70 + shell (2026-11-08, Muse — Oscar's scenario: the copied text is playing, and the wish to KEEP it strikes)

A **+** key joins the ⚑ on the panel's title row — beside the text's name, where the wish occurs. One tap while a copied text plays: the page saves the session's text into the Library as a Listen-later resident (`logosandroid-save` → saveForLater with the text's own title, language, current voice and estimated length) — temporary becomes permanent without leaving the bubble. The shell answers with its own "Saved to Library" toast (the page's toast can't be seen from another app). A book session is refused kindly ("Already in your library — it's a book"). Also carries the catch-wave: when the tap on the bubble lands a fresh delivery, the bubble answers with two halo rings — "¡lo tengo!" — the wave at the one moment Android lets it know (commit 8e0f31d).

## 1.4.69 + shell (2026-11-08, Muse — Oscar: the pretty spectrum belongs in the floating player too)

The panel gains the player's own spectrum: eighteen mirrored gold bars under the sub line, drawn from the SAME levels feed as Listen's Visualizer (`levels()` — the real envelope around the playhead, centre bar = now). The page pushes bar heights inside the state JSON a few times a second while playing (push dedupes at rest); the native SpectrumView eases toward them at ~30 fps, so four pushes a second move like water. At rest the bars settle to the same faint line the big player idles at. Carries the run-24 compile fix (title layoutParams inside its apply block, commit ccd965b).

## 1.4.68 + shell (2026-11-08, Muse — Oscar: "Métele mano a todo eso" — every loose thread from the review, closed)

The bubble grows up, and the app gets its memory. **(1) Return-to-book:** a copied clip that interrupts a session leaves a card behind (persisted); when the clip ENDS, the interrupted listening resumes at its sentence with a "Back to …" toast — the interruption heals itself. A second clip keeps the original card; anything Oscar loads by hand retires it, and Undo still means stay. **(2) Panel seek:** a slim gold bar under the keys shows true progress (sentence + within-sentence fraction, pushed live) and dragging it seeks through the bridge (`logosandroid-seek` → seekFraction) — a "¿qué dijo?" no longer costs a hunt. **(3) The voice wheel:** a long-press on the λ steps to the next favorite voice for the current language (settings voiceOverride + refreshVoices, position kept); the bubble pulses in answer, and the media card names the new voice. **(4) Marks — "keep this moment":** a flag key on the panel's title row and a bookmark key in Listen's transport both mark the sentence on the needle. A mark inside a book joins the BOOK's own bookmark list (one list, two doors — the reader's system, not a rival); a loose mark ties to its draft. Library → Saved gains a Marks section: tap to jump back and play, trash to remove. **(5) Continue listening:** a card at the top of Listen unifies the three memories — the book at its page (% shown), the clip at its second, the pasted text at its sentence (session resume now tracked and persisted) — newest first, one tap resumes. Book→Listen at a place is factored into playbook.ts (playImported delegates). **(6) Backup:** Settings gains a Backup card — one JSON file with books (+content, progress, bookmarks, covers), loose marks, the pronunciation dictionary and the Listen draft (settings stay the phone's own; clips excluded — they re-render from what IS in the file). Export shares/downloads, import restores and merges. **(7) The wave (his addition mid-build):** the halo sends out short rings — three — when the bubble arrives, when Oscar LEAVES Logos (MainActivity.onStop; the true moment nearest the copy, since Android still gives no app a background clipboard watch), and just after a delivery when the panel closes; a resting ghost brightens while it waves and re-rests after. The wave never claims to have seen a copy it didn't see.

## 1.4.67 + shell (2026-11-08, Muse — Oscar: the essential keys, speed included; and nothing may simply JUMP)

(1) **Speed joins the panel's essential keys.** The controls row is now five discs: **− · prev · play · next · +**, stepping along the player's own ladder (0.75–2×; the ladder now lives once in listen.ts as RATE_STEPS and both the Listen sheet and the bubble step on it — stepRate starts from the nearest step when the slider left the speed between rungs). The current speed rides the panel's sub line ("Sentence 8 of 24 · 1.05×"), pushed live because the state push already listens to settings. (2) **Nothing pops any more.** The panel is born from the bubble: it scales 0.86 → 1 with a fade over 190 ms, pivoting on the point nearest the λ, and leaves the same way in reverse (120 ms); the bubble itself also arrives (fade + grow, 240 ms) instead of appearing. Short, smooth, settled — the premium feel he asked for, with no bounce. (3) **The ghost rest** (his ask an hour later: no obvious button sitting on his screen): four seconds untouched — and not while the panel is open or a drag is live — the bubble fades over 700 ms to a whisper (alpha 0.15), still exactly where he left it at the edge; a finger wakes it instantly and restarts the clock, and closing the panel restarts it too.

## 1.4.66 (2026-11-08, Muse — Oscar: the float switch is buried in Settings; and the bubble must never ask, never delete)

Two rulings from the Listen chair itself. (1) **The λ in the header is now the bubble's switch.** The brand mark (top bar, and the tablet rail) is a button wherever the shell supports the bubble: tap it and the bubble goes out — the listening continues, now through the bubble — with the same permission errand as Settings if the permission is missing; tap again and it comes in. While it floats, the mark wears a gold ring and a gold dot, so the state is visible at a glance. The word "Logos" beside it still goes home, as always. In a plain browser the mark stays a mark. The native state is polled change-only (the 1.4.64 lesson: no re-render churn in the top bar). (2) **The bubble's law, verified in the code before promising it:** a copied text NEVER raises the Keep/Once question (that sheet belongs only to files shared in — PDF, image), creates no book, and deletes nothing. It takes the player's stage only: playClipboardText sets the Listen draft and plays. The book it interrupted keeps both of the sweep's protections — it remains the now-reading book (endSession does not clear it) and the most recently opened — so the temporary-book sweep passes it by; the book is deleted only by the rule Oscar wrote for imports (moving to another book), never by a clipboard.

## Shell with web 1.4.65, second pass (2026-11-08, Muse — Oscar's verdict: "Ahora se ve y corre muchísimo mejor", then three panel corrections)

His field notes, all three answered. (1) **Tapping the bubble did not close the panel** — a race, found and fixed: that tap is also an OUTSIDE touch for the panel's window (which collapsed it) and then the bubble's own tap arrived and toggled it back open. Outside-collapses now stamp their moment, and a toggle within 450 ms of one is read as the close it was. Tap-outside still closes; tap-the-λ now truly toggles. (2) **The ✕ beside the keys is gone** — its job moved to the bubble itself; the trio takes the whole row, centred, and better finished (prev/next at 50 dp, the play key at 58 dp wearing a 2 dp gold ring). (3) **The Paste & play pill retired**: he is right that copy → tap already pastes and plays, so the billboard goes. Its soul survives as a whisper — a small gold "Paste now" in the lever row, still wired to the same guaranteed-floor read (panel → blink → open Logos and the page reads it), for the day the automatic path ever misses.

## Shell with web 1.4.65 (2026-11-08, Muse — Oscar: the bubble smaller and prettier, with drag gates at the top)

The bubble shrinks from a 56 dp coin to a 46 dp jewel: a warm radial sheen falling from its top-left inside the gold ring, a soft shadow, the λ at 22 sp, the halo at 52 dp. And holding it is now a gesture with somewhere to go (his other app does this, and he asked for the same manners): the moment a drag begins, two gates rise at the top of the screen — **✕ Remove** and **λ Open Logos** — the panel steps aside, the gate under the bubble grows and takes its colour (ember red for Remove, gold for Open), and letting go on a gate does it: Remove retires the bubble exactly like Hide; Open snaps the bubble back to its edge and brings Logos forward. Letting go anywhere else snaps to the edge, as before. The gates never take touches themselves (NOT_TOUCHABLE); they are targets, not buttons.

## 1.4.65 + shell (2026-11-08, Muse — Oscar's field test of the bubble: "copio y no reproduce nada", and the panel must follow the app)

His screenshots showed the bubble and panel alive (title, sentence, controls all true) but a fresh copy never played. The read had exactly two chances (a blind +260 ms direct read, then the blink) and no memory of failing. Now it has layers and a memory: (1) the panel re-reads DIRECTLY whenever its window gains focus (debounced, direct-only so the blink can never loop), on top of the open read and the blink; (2) Paste & play has a guaranteed floor — if nothing was delivered within a second, the shell opens Logos with wantClip set and the page reads the clipboard itself, focused, regardless of the lever; (3) every attempt writes its outcome ("read N chars via the panel / the blink", "the panel saw the clipboard empty", "opened Logos to read it") to the bubble prefs, and the Settings card shows it as "Last clipboard try: …" — the next failure will be evidence, not a mystery. THE PANEL FOLLOWS THE APP (his words: "No true black. El acabado premium con el spectrum del reproductor"): the flat near-black card is gone — the panel is now the player's own spectrum, a warm charcoal gradient (#221D17 → #13100D) with the player's soft gold glow lying on its top, serif title, the media keys in lifted discs, a gradient-gold Paste & play, a gold-tinted lever; and the page pushes its theme in the state JSON, so in Logos' light theme the panel wears the warm paper palette instead. Web 1.4.65 carries the theme push, the wantClip arrival, and the Settings line.

## 1.4.64 (2026-11-08, Muse — Oscar's report: the app felt slow, switches and nav behind his finger)

Two lags, one root of mine from 1.4.63 and one of presentation. (1) The bubble's state push re-analysed the WHOLE text (describeText: keywords, names, several regex passes over up to a whole book) on every player tick — cushion updates fire constantly while the voice renders — so the main thread was busy re-deriving a title it already knew, and everything else (switches, tab changes) queued behind it. The title is now computed once per text and cached (keyed by length + opening; describeText also capped to the first 12,000 chars, plenty for a title). (2) The Floating bubble switch rendered from the native poll (up to 1.2 s stale), so the λ appeared on screen before the switch's amber caught up — Oscar's screenshot exactly. The switch is now optimistic: it answers the finger at once, and the poll (which also only re-renders when the native state actually changed) confirms or corrects it. The nav itself had no delay built in; it was painting behind the same busy thread.

## 1.4.63 + shell android-18 (2026-11-08, Muse — Oscar's waking dream, approved "Me parece genial")

THE FLOATING BUBBLE. A small λ floats over other apps (BubbleService, TYPE_APPLICATION_OVERLAY, draggable, snaps to an edge, gold halo pulses while reading). Tap → a mini-player: title + sentence from the page, previous / play-pause / next (the page's own logosandroid-* events), Paste & play, the Auto lever, Hide bubble. THE LEVER ("Play the clipboard", settings.bubbleAuto, mirrored into native prefs because the bubble must know it with the page asleep): ON — opening the panel reads the clipboard and the copied text takes the stage, replacing what was playing, always with an Undo toast; opening Logos right after copying plays it too (visibilitychange + the existing bridge clipboard read). OFF — the bubble only controls; pasting stays manual. THE HONEST LIMIT, told to Oscar before building: Android has forbidden background clipboard reading since Android 10, so zero-tap is impossible for any normal app — the tap on the bubble IS the permission moment. Reads go through the panel's focused window, falling back to ClipActivity, a transparent activity that blinks, reads under its brief focus (via an Android-14-sanctioned background-start pending intent), and is gone. If the page is dead, Paste & play reopens Logos and the page pulls the stored clip as it loads. Web side: src/lib/bubble.ts (state push, clip arrival with Undo, lever sync both ways, dedupe by clip fingerprint in localStorage), a Floating player card in Settings (bubble switch with the overlay-permission flow, the lever, and the plain explanation), drafts/saveLastText carry the text, ListenPage leaves editing when the bubble loads. Native side: BubbleService.kt + ClipActivity.kt, Bridge.bubble* methods, SYSTEM_ALERT_WINDOW, MainActivity revives the service if it was left on. NOT YET PROVEN: the Kotlin compiles only in the gated Actions run (no Android SDK in the VM) and every behavior is Oscar's to test on the phone — the clipboard focus dance especially.

## 1.4.62 (2026-11-08, Muse, at Oscar's word: Settings "parece estar desparramado" — scattered)

Settings is now cards, as he asked: one card per topic, each opening with the family icon chip and a header that says what the card holds, so information is found by its icon. Neural voice (Cpu — "The reading voice — it lives on this device, downloads once, then works offline"): the engine block and its storage/switch rows, formerly a card plus a loose list, now live together inside the one card, parted by a hairline; the big decorative Cpu inside retired (the header carries it). Playback (SlidersHorizontal — "How listening feels, sentence by sentence"). Pronunciation (Mic — "Words said your way — names, places, terms of art"; the row's own description trimmed of what the header now says). Appearance (Palette — "The light of the room"). About Logos (the app icon itself in the chip — "Version … · private, on-device text-to-speech"; the old logo row inside retired, its facts carried by the header). Inside the cards the lists shed their own chrome and sit flush; nothing else moved, no setting changed its place within its topic.

## 1.4.61 (2026-11-08, Muse — a fine adjustment to the Listen header, at Oscar's feeling: "le hace falta un ajuste fino, poquito")

He loves the eyebrow ("Ready to read") and the words line; the title and the lines under it wanted a small, fine adjustment. What the screenshot actually showed: the summary printed the pasted text's markdown bones — a literal "**" before its first word — and ran ragged over three lines. Three small things, nothing moved: (1) the header's title and summary are now display prose — `plainText` in describe.ts strips **, __, ~~, backticks and link syntax before anything is analysed or shown (saved clips' titles are cleaned by the same pass; the on-device AI headline gets it too); (2) the summary is held to two lines; (3) the title's type is tightened a notch (line-height 1.15, a breath of negative tracking, one more pixel of air above the summary). Verified in Node on his screenshot's own text: the summary comes back "Es W3 (Pack D: «empty intensifiers») en el motor de elección de palabras." — bones gone.

## 1.4.60 (2026-11-07, Muse, from Oscar's screenshot)

The line under the player named the voice a second time ("Noa · ES · 3:03 left") when the voice chip above already says Noa. His word: unnecessary. The line now carries only what the chip cannot say — the time left, and "Device voice" when the phone's own voice is standing in (a state no chip shows). One fact, one home.

## 1.4.59 (2026-11-07, Muse — Oscar's correction to 1.4.58, his rule verbatim in substance)

The two rows were mine and he rejected them: the player window grew and the text window shrank — "Lo conveniente es reducir el tamaño de las pastillas y las letras para que todo vuelva a caber en la misma fila. Me gusta lo compacto y el buen uso del espacio, no crear espacio en blanco." So: one row again, exactly as before 1.4.58, and the four chips fit by being smaller — the player's chips are now 34px tall (were 40), type 12.5px (was 14), padding and gaps tightened, icons at 14px; the voice chip keeps a 170px cap its short names never reach. The player is back to its old height and the text window keeps its room. Standing lesson, his: compact is a feature; never buy legibility with vertical space that belongs to the text.

## 1.4.58 (2026-11-07, Muse, from Oscar's screenshot of the Listen player)

The four player chips shared one row, and the row starved them: the language chip read "Auto · …" and the voice chip "N…". His question was whether to rearrange them, present them differently, or remove one. Nothing was removed — each chip has a job — the row was split in two by kind: **identity on top** (language at the left, voice at the right, full 40px size, the voice chip's old 150px cap raised to 210px so a name fits whole) and **playback below** (sleep timer, speed, at a slightly smaller 36px). On any phone width both rows now hold their full text with room to spare, and the grouping reads at a glance: what is speaking, then how it plays.

## 1.4.57 (2026-11-07, Muse — the audio-engine round Oscar asked for: "elevemos a Logos a lo que siempre debe ser")

Five improvements, all pointed at the voice engine and at listening to whole books:

1. **Whole-book sessions.** Both doors into Listen (a fresh import, and Listen from here in a book) capped the session text at 40,000 characters, so a long book stopped mid-way. The cap is gone: a session is the whole book (or from here to the end). To keep a phone safe, the player's rendered-audio cache is now bounded — the synthesis lookahead is a 400-sentence window that follows the playhead (was 5,000), and rendered sentences far behind (30 kept for stepping back) or far ahead are dropped and simply re-render if you return to them.
2. **A pronunciation layer at the one funnel everything spoken passes through** (`speakable`, used by live listening and by export): codes are named, never spelled — UUIDs and hashes of 8+ hex characters become the word "code"/"código", and machine file names (share-media-<hash>.png, IMG_2044.jpg) are dropped entirely. A sentence that was only a code becomes a breath of silence in both the player and the exporter. Plus the reader's own **pronunciation dictionary** (Settings → Pronunciation): word → "say it as", whole-word and case-insensitive, stored on the device and applied to listening and exports alike.
3. **Make audiobook.** A book's info panel gains a button that renders the whole book through the existing export engine in the background (queued behind any running job, progress on the button) and lands it in Library as a normal audio clip.
4. **Finer per-sentence voice switching.** Auto mode already chose a voice per sentence, but only for sentences over 40 characters at high confidence — short quoted sentences in the other language kept the paragraph's voice. The threshold is now ~24 characters at 0.6 confidence, so a short English quote inside a Spanish book (and back) changes voice.
5. **Sleep timer + loudness levelling.** Listen gains a moon chip: 10–60 minutes, counting down on the chip, the last ten seconds fading to silence before it pauses (full volume restored for the next play; cleared when a new session loads). And every rendered sentence — live and exported — is levelled toward a common loudness (target RMS 0.16, gain capped ×0.6–×1.5, peak-guarded), so a long book sounds even instead of louder/softer per sentence.

Verified: the speech layer, the dictionary, the per-sentence switching and the levelling gains replayed in Node against the real compiled modules — 22 checks, all green (full/short hashes, UUID EN+ES, hashed and machine file names dropped, real words/versions/dates untouched, dictionary whole-word, a short quoted English sentence switching inside Spanish text, gain caps and the peak guard). Build (tsc + vite) green. On-device confirmation is Oscar's: reopen Logos (Settings → 1.4.57), listen to a long book past where 40,000 characters used to end it, share a chat with codes in it, and try the moon.

## 1.4.56 (2026-11-07, Muse, LIVE — web-only, no shell change)

Oscar's retest of 1.4.55, sharing Muse's own 1.4.55 report back into Logos: the title fix is confirmed on his phone — the book is titled from its own first line and the hash is gone. One ghost remained: the reader header showed a chapter called "Mm". The Muse card's blue logo mark OCRs as a lone "Mm", and the plain-text parser's chapter-line rule reads M as a Roman numeral, so the logo became a chapter. parseImage now drops a first line that is only that glyph when real text follows it. His test also re-confirmed the standing limit with numbers: the shared message runs about 290 words; the book holds 165 — everything up to the card's own cut point, read cleanly; the rest was never in the picture.

And the Keep sheet, at his word from a screenshot of it: five seconds is all the sheet gives you, so its legend is now two short lines in his own phrasing — "Keep saves it." / "Once removes it later." — one per line, instead of the single long sentence ("…when you move to another book"). The one word for the temporary choice is still Once, everywhere.

## 1.4.55 (2026-11-07, Muse, LIVE — web-only, no shell change)

Oscar's on-device test of 1.4.54: the text still arrived short and the title was the raw share filename. Two findings. (1) The books in his screenshot were imported by a Logos page that had been open since before the 1.4.54 publish — a loaded page keeps running the code it loaded with, so those imports ran the old single-pass OCR; a web push does not swap code mid-session, and the app must be reopened for a release to be the one that runs. (2) The title was a real defect in every version: the importing card labelled the import with Android's invented file name ("share-media-<hash>.png"), and a machine name could survive as a book's title. Now: `isMachineName`/`titleFromText` in finish.ts — the importing card shows "Shared image"/"Shared file" for machine names, finishBook ignores them as titles, and an image import whose file name is machine-made takes its title outright from its own OCR text (first strong line, cut at a word boundary, no ellipsis). Real file names behave exactly as before.

## 1.4.54 (2026-11-07, Muse, LIVE — web-only, no shell change)
- Oscar: sharing a conversation image into Logos plays only part of the text. Two causes, kept apart: (1) the sharing app itself cuts long messages — Muse's share card ends the text with "…" and a "from Muse app" footer (visible in Oscar's own 2026-11-07 share-sheet screenshot, before Logos is even chosen); those words are not in the pixels and no OCR can recover them. (2) Logos' image OCR scaled by the LONGEST side, so a tall screenshot's letters shrank with its height (a 1000×6160 card was read at 0.5×) and the bottom read worst.
- Image OCR (pdf.ts ocrImageText) now reads tall pictures in overlapping horizontal bands (1500px bands, 220px overlap, in scaled space) at a scale set by the picture's WIDTH (target ≈2000px, clamp 0.6–3), stitches the lines in order and drops duplicates read in an overlap (same normalised text, tops within 0.6 line height). The recogniser was factored into recognizePx (canvas pixels, y-down); ocrCanvasLines maps it exactly as before, so the scanned-PDF path is behaviour-identical. Verified: build (tsc+vite) green; the band/stitch logic was replayed in Node with the same vendored Tesseract build on a synthetic 1000×6160 card (120 lines, small 27px print, scale 2, 10 bands) — merged result: exactly 120/120 lines, no duplicates, last line present. Lines sliced by a band edge are skipped and read whole by the next band (overlap 220 scaled px ≫ line height). Note the desktop engine read even 1080×10120 single-pass — the banding defends the phone's smaller real print and canvas limits, it is not claimed the desktop ever cut.
- Shared-card honesty (image.ts): a trailing "…"/"..." cut mark and the "from … app" footer are detected after OCR; the footer and the mark are stripped, the book still imports with what arrived, and BookMeta.warn carries the explanation; importMany toasts it for 9s ("This shared image arrived cut off… For the whole message, copy it and use Paste in Listen."). RawBook.warn → finishBook → BookMeta.warn.
- Web-only; no shell change. Oscar's final proof on device: share a long Muse message (expect the cut-off warning) and a full tall scrolling screenshot (expect the complete text).
