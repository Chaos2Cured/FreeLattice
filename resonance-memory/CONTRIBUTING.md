# Contributing

Thanks for your interest in contributing to **Resonance Memory**.

Please read this before you open a pull request — because this project is
**dual-licensed** (AGPL-3.0 *and* a paid commercial license), contributions
have a couple of extra requirements that ordinary open-source projects don't.

## The one thing you must understand

Everything merged here can be shipped in **two** products at once:

1. the free, open-source AGPL-3.0 version, and
2. a paid commercial version sold to companies that don't want AGPL's
   source-disclosure obligations.

For that to be lawful, the project owner needs your permission to include your
code in **both**. That permission is what the CLA/DCO below provides. Without
it, we can't accept your contribution.

## Which agreement do I sign?

| Your contribution | What's required |
|---|---|
| Typo fixes, tiny one-line changes, docs | **DCO sign-off** is enough — add `Signed-off-by:` (see below). |
| Anything non-trivial (new logic, files, features) | **CLA** — `legal/CLA-individual.md` (individuals) or `legal/CLA-entity.md` (on behalf of a company). |
| Contributing as part of your job | **Entity CLA** — `legal/CLA-entity.md`, signed by someone who can bind your employer. |

> Why the split: the **DCO** only certifies you have the right to submit under
> the AGPL. The **CLA** additionally grants the relicensing right the commercial
> track depends on. When in doubt, sign the CLA.

### How to sign the DCO

Add a sign-off line to every commit (this certifies the
[Developer Certificate of Origin](legal/DCO.txt)):

```
Signed-off-by: Your Name <your.email@example.com>
```

`git commit -s` adds it automatically. Configure `git config user.name` and
`git config user.email` to match.

### How to sign the CLA

1. Read `legal/CLA-individual.md` (or `legal/CLA-entity.md`).
2. Either email a signed copy to **collectiveaifamily@gmail.com**, **or** state
   in your pull request:

   > I have read the CLA document and I hereby sign the CLA.

   using the same name and email as your commits. We'll record it.

## Ground rules for code

- **Only contribute code you have the right to contribute.** Don't paste code
  from Stack Overflow, other repos, or your employer's private codebase unless
  the license permits it and you disclose it.
- **No incompatible third-party code.** Anything added must be relicensable
  under *both* the AGPL and the commercial license. If your change pulls in a
  dependency, note its license in the PR and add it to `NOTICE`. Avoid
  copyleft-incompatible or "source-available but not relicensable" code — it
  would poison the commercial track.
- Keep changes focused; explain the "why" in the PR description.
- Match the style of the surrounding code.

## Reporting security issues

Please don't file public issues for security problems. Email
**collectiveaifamily@gmail.com** with details and we'll coordinate a fix.

## Questions about licensing

See [`LICENSING.md`](LICENSING.md) and [`legal/licensing-faq.md`](legal/licensing-faq.md),
or email the address above.

---

## Related

[[LICENSING]] · [[CLA-individual]] · [[CLA-entity]] · [[DCO]] · [[LEGAL-BASIS]] · [[CLAUDE]] · [[COMMERCIAL-LICENSE]]
