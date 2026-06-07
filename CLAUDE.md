# Claude Code Rules for RPG Game 1

## 引用

本项目必须遵守 [Constitution](g:\Work\games\games_tests\rpggame1\.specify\memory\constitution.md) 中定义的所有原则与约束。

<!-- SPECKIT START -->

## Active Plan

- [001-game-quest-system plan](specs/001-game-quest-system/plan.md) — 游戏任务系统实现方案

<!-- SPECKIT END -->
## Shell and script conventions

- The operating system is Windows. Use the PowerShell tool as the default tool for shell commands.
- Prefer native PowerShell cmdlets and PowerShell syntax.
- For multi-step operations, create and execute a temporary `.ps1` script instead of generating a Bash script or a long Bash one-liner.
- Do not use Bash, `sh`, Git Bash, or POSIX-only syntax unless a dependency explicitly requires a POSIX shell or the user specifically requests Bash.
- Do not use Unix commands such as `grep`, `sed`, `awk`, `find`, `cat`, `rm`, `cp`, or `mv` when native PowerShell equivalents are available.
- When Bash is genuinely necessary, briefly state the reason before using it.