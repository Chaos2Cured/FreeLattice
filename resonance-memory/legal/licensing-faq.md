# Licensing FAQ

> Plain-language answers. The binding terms are in `LICENSE` (AGPL-3.0) and, if
> you buy one, your signed `COMMERCIAL-LICENSE.md`. *(Written by an AI, not a
> lawyer — usable as-is; free human help in `USING-THIS-WITHOUT-A-LAWYER.md`.)*

## For users / companies

**Q: Is this free?**
Yes — under the AGPL-3.0. You can use, run, modify, and share it for free, as
long as you honor the AGPL, whose main condition is: if you run a **modified**
version as a network service, you must offer your users the complete source of
your modified version.

**Q: I just want to run it internally, unmodified. Do I need to pay?**
No. Internal use, even in a company, is fine under the AGPL. The source-offer
obligation is triggered by **distributing** or by **network-serving a modified
version** to outside users.

**Q: I want to build a SaaS on this but keep my code closed. What do I do?**
Buy a commercial license. That's exactly the case this dual-license exists for.
The AGPL would require you to publish your modified source; the commercial
license removes that obligation for a fee. Email
`collectiveaifamily@gmail.com`, subject `Commercial license — Resonance Memory`.

**Q: What counts as a "modification" that triggers AGPL § 13?**
Changing the code and then letting users interact with that changed version over
a network. Running the software *unmodified* behind a service is treated
differently than shipping a *modified* version to network users — but the line
can be subtle, and combined/derivative works count. If you're unsure and your
business depends on the answer, get the commercial license or ask a lawyer.

**Q: Can I use it in a proprietary desktop/mobile app I distribute?**
Distributing a combined/derivative work under AGPL means offering source to your
recipients. If you don't want to do that, get the commercial license.

**Q: How much does the commercial license cost?**
It's quoted per engagement based on your use and scale. Reach out with what
you're building.

**Q: What do I actually get with the commercial license?**
The right to use the code in closed-source/proprietary and SaaS products without
AGPL's copyleft, plus optional warranty, support, and indemnification terms you
negotiate. See `COMMERCIAL-LICENSE.md`.

## For contributors

**Q: Why do I have to sign a CLA?**
Because the project is sold under two licenses. To include your code in the
commercial version, the owner needs your permission to license it under terms
other than the AGPL. The CLA grants that while letting you keep your copyright.
See `CONTRIBUTING.md`.

**Q: Do I lose ownership of my contribution?**
No. The CLA is a **license**, not an assignment — you keep copyright and can
still use your own code however you like.

**Q: Isn't it unfair that the owner can sell my contribution?**
That's the deal dual licensing makes explicit up front, and it's the same model
MySQL and Qt use. If you're not comfortable with it, contribute only under the
DCO (trivial fixes), or don't contribute code you want to keep out of the
commercial build.

## For the owner (operational notes)

- Keep proof you authored 100% of the code (git history) — it's your standing to
  license commercially.
- Get commercial deals **signed**; keep signed CLAs on file before merging
  outside code.
- Don't merge third-party code that can't be relicensed commercially — it would
  restrict the commercial track. Record any third-party code in `NOTICE`.
- Consider registering the copyright before you need to enforce. See
  `legal/LEGAL-BASIS.md` §6.

---

## Related

[[LICENSING]] · [[USING-THIS-WITHOUT-A-LAWYER]] · [[LEGAL-BASIS]] · [[CLA-individual]] · [[CONTRIBUTING]]
