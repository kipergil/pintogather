# Attribution

Some skills in this directory were adapted from the [Amplifier](https://github.com/microsoft/amplifier) project (commit 2adb63f858e7d760e188197c8e8d4c1ef721e2a6, 2025-10-10). Per-category notes from the upstream superpowers-skills repo, consolidated here since the category folders themselves were flattened away:

# Architecture Skills - Attribution

This skill was derived from agent patterns in the [Amplifier](https://github.com/microsoft/amplifier) project.

**Source Repository:**
- Name: Amplifier
- URL: https://github.com/microsoft/amplifier
- Commit: 2adb63f858e7d760e188197c8e8d4c1ef721e2a6
- Date: 2025-10-10

## Skills Derived from Amplifier Agents

**From ambiguity-guardian agent:**
- preserving-productive-tensions - Recognizing when disagreements reveal valuable context, preserving multiple valid approaches instead of forcing premature resolution

## What Was Adapted

The ambiguity-guardian agent preserves productive contradictions and navigates uncertainty as valuable features of knowledge. This skill extracts the core pattern-recognition capability: distinguishing when tensions should be preserved (context-dependent trade-offs) vs resolved (clear technical superiority).

Adapted as scannable guide with symptom-based triggers ("going back and forth", "keep changing mind") and practical preservation patterns (configuration, parallel implementations, documented trade-offs).

---

# Problem-Solving Skills - Attribution

These skills were derived from agent patterns in the [Amplifier](https://github.com/microsoft/amplifier) project.

**Source Repository:**
- Name: Amplifier
- URL: https://github.com/microsoft/amplifier
- Commit: 2adb63f858e7d760e188197c8e8d4c1ef721e2a6
- Date: 2025-10-10

## Skills Derived from Amplifier Agents

**From insight-synthesizer agent:**
- simplification-cascades - Finding insights that eliminate multiple components
- collision-zone-thinking - Forcing unrelated concepts together for breakthroughs
- meta-pattern-recognition - Spotting patterns across 3+ domains
- inversion-exercise - Flipping assumptions to reveal alternatives
- scale-game - Testing at extremes to expose fundamental truths

**From ambiguity-guardian agent:**
- (architecture) preserving-productive-tensions - Preserving multiple valid approaches

**From knowledge-archaeologist agent:**
- (research) tracing-knowledge-lineages - Understanding how ideas evolved

**Dispatch pattern:**
- when-stuck - Maps stuck-symptoms to appropriate technique

## What Was Adapted

The amplifier agents are specialized long-lived agents with structured JSON output. These skills extract the core problem-solving techniques and adapt them as:

- Scannable quick-reference guides (~60 lines each)
- Symptom-based discovery via when_to_use
- Immediate application without special tooling
- Composable through dispatch pattern

## Core Insight

Agent capabilities are domain-agnostic patterns. Whether packaged as "amplifier agent" or "superpowers skill", the underlying technique is the same. We extracted the techniques and made them portable.

---

# Research Skills - Attribution

This skill was derived from agent patterns in the [Amplifier](https://github.com/microsoft/amplifier) project.

**Source Repository:**
- Name: Amplifier
- URL: https://github.com/microsoft/amplifier
- Commit: 2adb63f858e7d760e188197c8e8d4c1ef721e2a6
- Date: 2025-10-10

## Skills Derived from Amplifier Agents

**From knowledge-archaeologist agent:**
- tracing-knowledge-lineages - Understanding how ideas evolved over time to find old solutions for new problems and avoid repeating past failures

## What Was Adapted

The knowledge-archaeologist agent excels at temporal analysis of knowledge evolution, paradigm shift documentation, and preserving the "fossil record" of ideas. This skill extracts the core research techniques for understanding why current approaches exist before proposing changes.

Adapted with practical search strategies (decision records, git archaeology, conversation history) and scoped for mature codebases (explicitly notes to skip for greenfield projects).
