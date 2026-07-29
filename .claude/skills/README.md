# Superpowers Skills

Vendored from [obra/superpowers-skills](https://github.com/obra/superpowers-skills) (MIT — see `LICENSE`), a community-editable skills library for Claude Code covering brainstorming, planning, TDD, systematic debugging, code review, and related collaboration workflows.

Claude Code auto-discovers these as project skills, so anyone working on this repo with Claude Code gets them automatically — no per-user install needed.

## Structure

Upstream nests each skill under a category folder (`skills/testing/test-driven-development/`, etc.), but Claude Code's project-skill discovery only scans one directory level below `.claude/skills/`. So this copy is **flattened**: every leaf skill directory sits directly under `.claude/skills/` (e.g. `.claude/skills/test-driven-development/`), and the three category-level `ABOUT.md` attribution notes (from `architecture/`, `problem-solving/`, `research/`) are consolidated into `ATTRIBUTION.md`.

## Updating

This is a point-in-time copy, not a live link back to upstream. To pull in newer skills or fixes:

```sh
git clone --depth 1 https://github.com/obra/superpowers-skills.git /tmp/superpowers-skills

# Remove the current flat skill dirs, keeping README/ATTRIBUTION/LICENSE/REQUESTS
find .claude/skills -mindepth 1 -maxdepth 1 -type d -exec rm -rf {} +

# Flatten each category's skills up to .claude/skills/, and re-collect any
# category-level ABOUT.md files into ATTRIBUTION.md before diffing/committing
for cat in /tmp/superpowers-skills/skills/*/; do
  find "$cat" -mindepth 1 -maxdepth 1 -type d -exec mv {} .claude/skills/ \;
done
cp /tmp/superpowers-skills/LICENSE .claude/skills/LICENSE
```

Then re-check for name collisions, rebuild `ATTRIBUTION.md` from any `ABOUT.md` files still under `/tmp/superpowers-skills/skills/*/`, and diff/commit as a normal PR so any local changes to these skills aren't silently clobbered.
