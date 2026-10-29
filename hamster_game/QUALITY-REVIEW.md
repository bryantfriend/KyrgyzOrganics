# Lucky Hamster quality review

Reviewed 29 October 2026 against [CrazyGames quality guidelines](https://docs.crazygames.com/requirements/quality/).

Scope: improve the existing OAKO bakery loyalty game. This is not a CrazyGames submission, SDK integration, certification, or review of that platform's separate mandatory publishing requirements.

| Area | Implementation and evidence |
| --- | --- |
| First play | Guest play goes directly to the machine. Three short tips sit beside the hamster; the Spin control works immediately after loading. Tips can be skipped, disappear after the first spin, and can be replayed from How to play. No registration modal blocks the first spin. |
| Goals and honesty | The reward strip shows a target, seed balance, and progress bar. Help explains random outcomes and current server-configured odds. Losing awards zero seeds without removing saved seeds. Guest progress is explicitly identified as guest progress. |
| Responsiveness | Spin disables immediately during a request, so repeated input cannot submit concurrent spins. A delayed request displays a waiting message; a failed request leaves a retryable control. Server-owned balances and existing idempotency remain unchanged. |
| Loading | Sixteen valid PNG assets have optimized WebP counterparts: 21,702,910 bytes reduced to 1,470,630 bytes. Originals remain available. The scene warms only the normal hamster and reel symbols before play; celebration artwork warms afterward. An eight-second artwork timeout prevents a stalled image from blocking Spin indefinitely. These are asset-size measurements, not a claim about real-user loading time. |
| Layout | Automated checks cover 320×568, 393×650, 768×1024, 1280×800, 1280×720, and 844×390. Portrait/tablet/desktop Spin is visible above the navigation without scrolling. Short landscape allows scrolling with navigation in document flow. Screenshots were inspected. |
| Input and accessibility | Pointer, touch and Space use the same spin action. Modified Space and held-key repeats cannot trigger extra spins. Browser shortcuts are not captured. Dialog focus excludes hidden/disabled controls, Tab stays inside the dialog, and Escape closes it. Visible keyboard focus and improved control sizing/contrast were added. |
| Motion and sound | Reduced-motion users see no cycling reels or confetti and get the result as soon as the server responds after a short minimum transition. Sound starts off, remains optional, and the preference survives reload and server updates. Tones use the existing consistent low gain and do not play in a hidden tab. |
| Visual consistency | Existing cream/sage bakery artwork, typography, hamster reactions and brand identity are retained. Reward artwork from known optimized assets uses WebP; other configured paths remain untouched. |
| Maintainability | Rewards, odds, gifts, purchase codes and reporting remain managed by the existing admin/backend. This pass does not change the economy or invent new tasks. |

## Verification

- `node tests/hamster-quality.cjs`: layout, first-play skip/replay, keyboard behavior, delayed/failed requests, loss/pair/jackpot outcomes, reaction reset, sound persistence, reduced motion and dialog focus.
- `node tests/hamster-ui.cjs`: existing gameplay, email/phone UI, daily gift, purchase code, customization, WhatsApp consent and admin flows. Also invokes the web-game skill's browser client.
- Browser tests use mocked cloud responses. They do not send real SMS, claim live purchases, or establish real-world reward fairness.
- Screenshots: ignored `test-results/hamster/quality/` and `test-results/hamster/skill/`.

## Remaining limitations

- Phone signup has a reported Firebase error 39 before SMS delivery, including on MEGA. Email registration is the tested fallback; this quality pass does not fix that upstream issue.
- The game is luck-based loyalty entertainment, not a skill challenge. Reward pacing, player enjoyment and long-term retention need real playtesting; automated tests cannot certify them.
- The interface is currently English. Kyrgyz/Russian localization requires a separate complete translation pass.
- The game needs a network connection for authoritative progress. No offline reward grants are introduced.
- CrazyGames publication eligibility, account integration, real-world rewards and any applicable platform policies require separate review before submission.
