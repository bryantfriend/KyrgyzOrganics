# Kyrgyz Organics Lucky Hamster animations

Animation is handled with scoped CSS classes in `styles.css`:

- `.hg-is-spinning` rotates the hamster wheel and bounces the mascot.
- `.hg-reel.hg-spinning` blurs and scrolls symbols while preserving reel dimensions.
- `.hg-seed-bump` gives updated counters a short reward bounce.
- `.hg-confetti-burst` displays a celebratory burst for larger wins.
- Reduced motion users receive short opacity changes instead of continuous movement.

All animation hooks are local to `/hamster_game/` and do not depend on the main OAKO.kg site.
