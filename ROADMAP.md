# Iron Log roadmap

Planned work that isn't built yet. Each item says why it's wanted, what to check before starting, and the build order.

---

## Under-18 mode (planned, not started)

**Why:** an under-18 user who also trains for school endurance sports may start using the app. Today the app treats every user as an adult. Nothing outside the Claude prompts reads `state.goals.age` or `state.goals.sex`.

**Women:** no changes needed. Research supports the same programming, rest times, exercises and frequency for both sexes (Roberts 2020; Lundberg 2024; Nuckols 2026). Cycle-based training has no support (Colenso-Semple 2023). Lighter lifters can already set a smaller jump per exercise (`ownStep`).

### What the research says (provisional)
These come from search-result summaries. The journal hosts were blocked when this was researched, so confirm the numbers in step 0.

| Topic | Youth guidance | What the app does now |
|---|---|---|
| Effort | Stop with some fatigue, not at failure | `effortFor` goes to 0–1 reps in reserve in the last week of a block. Only heavy barbell lifts are held at 1–2 (`targetFor`). |
| Load and reps | Novices: 1–2 sets, ≤60% 1RM (about 15+ reps, our conversion). Add 5–10% once 15 reps are easy. | 3 sets by default. Heavy lifts 6–10 reps, or 3–6 on the strength scheme (`DEFAULTS`, `SCHEMES`). The general scheme's "Lighter" option (10–15 / 10–15 / 12–20) is close. |
| Frequency | 2–3 sessions a week on non-consecutive days, rising in the late teens | Day chips allow 2–6, with no spacing rule |
| Weekly volume | Low to start | The planner's floor is 8 hard sets a week per major muscle (6 on the general goal), the cap is 20, and the "recovers fast, +2 sets" rule adds more |
| Rest between sets | About 1 min for most youth; 2–3 min as loads get heavier. Teens may need more than children (Bottaro 2011). | 75–150 s (`DEFAULTS`, `restFor`), editable per exercise. **No change needed.** |
| Recovery between sessions | Youth may need *more* recovery between hard sessions, not less (Faigenbaum & Westcott). Sport practice counts toward the total load. | Fatigue check and check-ins exist but don't know about sport |
| Diet and weight | AAP 2016: don't encourage dieting or weight talk in adolescents; focus on habits | Goal "Lose fat, keep muscle", Cutting and Gaining phases, calorie advice in `weightAdvice`, and an adult protein target in `proteinGoal` |
| Maximal lifts | AAP 2008: no 1-rep-max attempts until fully grown. Not yet confirmed that AAP 2020 keeps this. | The app doesn't schedule max attempts |
| Exercises | Technique and supervision first; no confirmed banned list | Full library. Coach the first few sessions of heavy barbell lifts. |
| Claude | Anthropic's usage policy (effective Nov 12, 2026) allows under-18s only with safeguards: age checks, filtering, AI disclosure and COPPA compliance | Key entry and AI features open to everyone |

### Build order

**0. Before building**
- Read in full and confirm or correct the table above:
  - Lloyd et al. 2014 international consensus (BJSM, doi 10.1136/bjsports-2013-092952)
  - AAP 2020, "Resistance Training for Children and Adolescents" (doi 10.1542/peds.2020-1011)
  - AAP 2016, Golden et al. on obesity and eating-disorder prevention, especially anything on self-weighing
- Decisions for the parent:
  - Hide the whole Body tab, or only its advice (weigh-ins and photos stay, coaching goes)?
  - Do Claude features stay off entirely?

**1. Foundation**
- Add one helper, e.g. `const youth = () => (state.goals.age || 0) > 0 && state.goals.age < 18`. It's derived from age, so there's no new saved field and no save-format change.
- **Age unset must behave exactly as today.**
- Move the age field somewhere it's seen at setup, with a line saying it adjusts training for under-18s. It's a guardrail, not a lock.

**2. Training limits.** Apply each limit where the value is produced, not in the display.
- `effortFor`: never return less than 2 reps in reserve when `youth()`. That also covers the heavy-lift override in `targetFor`.
- `DEFAULTS` and `SCHEMES`: use 10–15-rep ranges, and start at 2 sets. Hide or adjust the strength scheme's 3–6 range.
- Planner volume (the weekly set targets near `capN` and the floor): first read how that section builds targets, then set a lower floor and cap for youth, and turn off or limit the "+2 sets" feedback rule.
- Day chips: offer at most 3, and warn when training days are back to back.
- `targetFor` first-time text: say "a weight you could lift 15+ times; stop at 10–15 with 2–3 left".
- `stepFor` / `granFor`: check the default jumps against "add 5–10%". A 5 lb dumbbell jump is far more than 10% for light weights. Consider smaller default steps for youth.

**3. Body and diet**
- Hide the "Lose fat, keep muscle" goal and the Cutting and Gaining phases in `goalsBody`, and force `phaseOf()` to maintain.
- Remove **all** of `weightAdvice` for youth, not only the cut branch. The maintain branch would flag a growing teen's normal weight gain as off target, and the gain branch gives calorie advice.
- `proteinGoal`: drop the adult g/kg target. Show habits, or nothing.
- Review the waist-to-height line and the "fits" notes (`waistNote` and nearby) for adult framing.
- Apply the parent's decision from step 0 on weigh-ins and progress photos.

**4. Claude**
- When `youth()`: hide the key entry and every AI entry point (coach, plan the next block, log from a photo, ask for an exercise). The app already works without a key.
- If AI is ever enabled for youth, AI-built blocks must pass the same limits as step 2. Today the plan reader only clamps sets to 1–8 and rest to 30–300 s.

**5. In-season sport**
- Add one optional setting (e.g. `state.goals.sport = { inSeason:bool }`) and default it in `migrate()`.
- When in season: 2 lifting days a week, lower volume and no hard final week. Reuse the existing check-in ("rough" / "recovery") and `fatigueCheck`; don't build a new system.

**6. Tests and checks**
- In `tests/run.js`:
  - With age 14, no exercise in any week of a block gets a target under 2 reps in reserve.
  - With age unset, the output is identical to today (regression).
  - A backup made before the change restores cleanly after it.
- Check the layout at 390 px.
- No new offline files are expected, so `sw.js` stays as it is.
