# Skills

This directory holds [Claude Code skills](https://code.claude.com/docs) maintained
in this repo. Each skill is a subdirectory containing a `SKILL.md` file (and
optionally `scripts/` and `references/` for supporting files).

## Directory layout

```
skills/
  <skill-name>/
    SKILL.md          # required: frontmatter + instructions
    scripts/           # optional: helper scripts the skill can run
    references/         # optional: docs the skill can read for more detail
```

## Installing a skill locally

To make a skill in this repo available to Claude Code on your machine, copy
it into your user skills directory:

```bash
mkdir -p ~/.config/claude-code/skills/
cp -r skills/<skill-name> ~/.config/claude-code/skills/
```

Restart Claude Code (or start a new session) so it picks up the new skill.

## Built-in document skills (not vendored here)

`docx`, `pdf`, `pptx`, and `xlsx` — Anthropic's official Word/PDF/PowerPoint/
Excel skills — ship natively with Claude Code and claude.ai. They're
available in every session automatically, so there's nothing to install and
no folder for them in this directory. Their source is proprietary
(Anthropic's Services license prohibits extracting or redistributing the
files), so this repo intentionally does not contain copies of them.

## Adding a new skill

1. Create a new folder under `skills/` named after the skill (kebab-case).
2. Add a `SKILL.md` with YAML frontmatter (`name`, `description`) followed by
   the skill's instructions. See `skills/example-skill/SKILL.md` for a
   starting template.
3. Keep the description specific about when the skill should trigger — it's
   the only thing used to decide whether to load the skill.
