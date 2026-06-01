# Audit Field Taxonomy
> Forward-looking field classification for the v2 redaction view. Every field in the audit system is tagged as either **structural** (safe to export and share) or **private** (visible only to the authenticated user). This taxonomy ensures the v2 ledger and redaction view fall out naturally without refactoring.

## Consent Ledger Fields

| Field | Tag | Rationale |
|---|---|---|
| `messageId` | structural | Opaque identifier, no content |
| `timestamp` | structural | When the event occurred |
| `consentType` | structural | What decision was made (depth_granted, standard_kept, consent_withdrawn) |
| `companionId` | structural | Which AI persona was active |
| `aiIdentityHash` | structural | Cryptographic identity of the AI, not human-readable content |
| `trustLevel` | structural | Numeric trust tier at the time of consent |
| `signature` | structural | Cryptographic proof of the record's integrity |
| `promptHash` | structural | SHA-256 of the user's message — proves the prompt existed without revealing content |
| `responseHash` | structural | SHA-256 of the AI's response — proves the response existed without revealing content |
| `promptText` | private | The actual user message — contains personal content |
| `responseText` | private | The actual AI response — may contain sensitive depth content |
| `provenance.provider` | structural | Which provider served the response |
| `provenance.model` | structural | Which model was used |
| `provenance.latency` | structural | Response time in milliseconds |

## Router Health Log Fields

| Field | Tag | Rationale |
|---|---|---|
| `timestamp` | structural | When the event occurred |
| `providerKey` | structural | Which provider was affected |
| `event` | structural | What happened (healthy, probation, unhealthy, failover) |
| `latency` | structural | Response time that triggered the event |
| `failoverTarget` | structural | Where the system fell back to |

## Response Cache Fields

| Field | Tag | Rationale |
|---|---|---|
| `queryHash` | structural | Opaque hash of the cached query |
| `timestamp` | structural | When the response was cached |
| `provider` | structural | Which provider generated the cached response |
| `responseText` | private | The actual cached response content |
| `hitCount` | structural | How many times the cache was used |

---

## The Export Rule

When the user exports their audit log (v2), the system includes all **structural** fields and excludes all **private** fields. The exported artifact proves that events happened, that consent was given or withheld, that providers were used, and that the system behaved as claimed — without revealing the content of any conversation.

The full view (all fields) is visible only to the authenticated user in the browser. The exported view is what can be shared with a journalist, a partner, a court, or anyone the user chooses to show.

**Only the owner can export. Only the user can share.**
