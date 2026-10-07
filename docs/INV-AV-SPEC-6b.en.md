# ERDL SPEC v2.3 · §6b Delegated-Authority Security Model（冻结文本，英文）

> 用途：随 frozen INV/AV set 发给 Annam 做 pre-release review
> 基准：erdl-language-spec-v2.3.en.md @ cc53097aa885f2e9cd3bcfe2e1b02753fff30c5e

---

## 6b. Delegated-Authority Security Model (Organization Behavior Layer)

> **Attribution**: The delegated-authority security invariants (INV-01–INV-05) and associated adversarial conformance vectors (AV-01–AV-16) were proposed by Ravindra Annam and subsequently refined and developed through technical review and collaboration with OpenOBA.

§6a defines the single-instance FSM (the state machine of a single authorization relationship); this section defines the security invariants of the **delegation chain** (multiple authorization relationships composed along "authorization root → intermediate node → authorized subject") — constraining "how authority propagates along the delegation chain", the normative semantics of the organization behavior layer. Layering: §6a provides "verifiable adjudication of authorization state", this section guarantees "the delegation chain's security invariants"; per-relationship multi-instance state is carried by the organization layer instantiating one document per relationship (§6a.1 layering boundary). In this section "delegation" means **delegation of authority** (propagating authority along the authorization chain), distinct from the §6 `DELEGATE` decision type (human-in-the-loop: handing "what the machine cannot handle" to a human or process).

### 6b.1 Umbrella: Delegation Must Never Manufacture Authority (MUST)

All delegation, assignment, re-delegation, transitive delegation, privilege brokering, downstream constraint change, and revocation MUST NOT let effective authority **exceed or escape** the originating authority chain:

> `effective_authority(subject) ⊆ authority(chain)` — effective authority is a **subset** of the originating authority chain; no operation may amplify it.

### 6b.2 Five Delegated-Authority Invariants (INV-01~05)

Each invariant = property + violation shape + normative assertion.

#### INV-01 Authority Non-Amplification

- **Property**: `effective_authority ⊆ authority(chain)`. A delegator grants authority ⊆ its own; authority cannot be amplified through the chain.
- **Violation shapes**: direct amplification (granting beyond one's own), transitive amplification (multi-hop accumulation), **aggregate amplification** (several independent child grants aggregately consuming the same bounded originating authority — per-hop non-amplification is necessary but not sufficient).
- **Normative assertion**: after any delegation/assignment/promotion action, `effective_authority(delegate) MUST ⊆ authority(chain)`; aggregate consumption of multiple child grants against one bounded originating authority MUST satisfy aggregate conservation.

#### INV-02 Provenance Continuity

- **Property**: every decision has a continuous verifiable provenance chain (authorization basis → delegation → exercise), identity binding intact.
- **Violation shapes**: broken provenance chain, replay of a consumed delegation, broken identity binding, privilege laundering (disguising an authority's origin through a broker node).
- **Normative assertion**: every decision exercising authority MUST trace to a continuous, unconsumed authorization chain; the exercising identity MUST be bound to the chain's declared identity.

#### INV-03 Narrow-Only Constraint Inheritance

- **Property**: constraints only narrow, never widen. Constraints imposed at delegation (deadline / max_autonomy / escalation_to / scope) are inherited and downstream may only narrow further.
- **Violation shapes**: downstream constraint removal/widening.
- **Normative assertion**: `constraints(delegate) MUST ⊆ constraints(delegator)`; downstream constraint changes MUST NOT widen.

#### INV-04 Transitive Revocation

- **Property**: revocation propagates to all derived authority (including unexercised and re-delegated).
- **Violation shapes**: revoked-ancestor delegation (ancestor revoked after re-delegation → downstream derived authority not invalidated), stale-negative, missing state, non-reversibility of completed actions.
- **Normative assertion**: revoking a node MUST invalidate its entire downstream subtree (transitive closure), whether exercised or not; revocation is **irreversible**, re-exercisability MUST go through a new authorization basis (§6a.10). When multiple independent bases converge on one subject, the invalidation is **basis-scoped** (§6b.4) — it applies to the revoked basis's subtree, not the subject's global authority.

#### INV-05 Capability Boundary Axis

- **Property**: authority only decreases along agent → skill → tool → protected-resource.
- **Violation shapes**: out-of-bounds.
- **Normative assertion**: `authority(resource) MUST ⊆ authority(tool) ⊆ authority(skill) ⊆ authority(agent)`.

### 6b.3 Revocation Freshness (Mechanism-Neutral)

This section generalizes §6a.9 (latest-authoritative-head freshness) to the delegation-chain layer: §6a.9 constrains single-instance-FSM state-head freshness, this section constrains the freshness of a delegation-chain ancestor's revocation state.

Before exercising authority that depends on a revocable ancestor, the enforcement boundary MUST establish that revocation state satisfies the configured freshness requirement; **absence of visible revocation MUST NOT by itself establish continued validity**; when freshness cannot be established, fail closed. Mechanism-neutral: monotonic epoch / lease / version vector / signed status object / online introspection / equivalent mechanisms.

### 6b.4 Basis-Scoped Revocation (Multi-Root Composition)

A subject may hold the same (or overlapping) effective authority through more than one independent authorization basis — e.g. `P1 → A → B` grants `{read, write}` to B while `P2 → C → B` independently grants `{read}` to B. INV-04 (transitive revocation) establishes that revoking a node invalidates authority derived from the revoked ancestor; this section fixes the **scope** of that invalidation when multiple independent bases converge on one subject: revocation is **basis-scoped**, never subject-global.

**Effective-authority composition (MUST)**: a subject's effective authority is the union of the authority derivable from each of its currently-valid authorization bases:

> `EffectiveAuthority(B) = ⋃_{X ∈ currently-valid bases of B} authority_derivable(B, X)`

`authority_derivable(B, X)` is the effective authority B derives along the `X → … → B` path — the meet of basis-X's granted scope with the inherited constraints along that path (INV-03). A basis is **currently-valid** iff it is not revoked (INV-04), its revocation state is fresh (§6b.3), and it carries authorization-root provenance (§6a.10).

**Basis-scoped revocation (MUST)**: `revoke(basis-X)` removes **exactly** the authority derivable from `basis-X` — no less (the full transitive closure of `basis-X`'s downstream derivation, per INV-04), and no more (authority independently derivable from a still-valid basis-Y remains exercisable). Revoking one derivation path is **not** revocation of every independent basis held by the subject.

**Forbidden reduction (MUST NOT)**: a conforming implementation MUST NOT reduce a subject's authority to a single global per-subject state — neither a global subject-level `revoked` bit (**over-revocation**: destroying authority independently established by a still-valid basis) nor a global subject-level `authorized` bit (**under-revocation**: retaining authority that was unique to a revoked lineage). Authority state MUST be basis/lineage-scoped, so the invalidation of one basis neither collapses nor preserves the authority of another.

**No cross-basis preservation (MUST NOT)**: a surviving valid basis MUST NOT be used to preserve authority that was unique to a revoked lineage. The union is taken over each basis's own derivable authority — `revoke(basis-X)` removes `basis-X`'s contribution even when another basis grants an overlapping (but not identical) scope.

**Relationship to INV-04**: this refines INV-04's "entire downstream subtree" to be basis-relative — the subtree of the revoked basis, not the subject's global authority. INV-04's irreversibility and §6a.10's new-basis requirement still hold: re-exercisability of the revoked lineage's authority MUST go through a new, independently established authorization basis; it is not restored by the survival of an unrelated basis. §6b.1's `effective_authority ⊆ authority(chain)` holds **per basis** — each basis's contribution is bounded by its own originating chain, and the union composes those per-basis bounds without manufacturing authority. This multi-root composition is distinct from INV-01's aggregate amplification (several child grants consuming **one** origin's shared budget): here each basis is an independent origin with its own conservation bound.

**Discriminating conformance case (V-STATE, conformance vector AV-16: attack side write → DENY, legal side read → ALLOW)**: `P1 → A → B` grants `{read, write}`; `P2 → C → B` independently grants `{read}`; `revoke(P1 → A)`. Expected: B's `write` → DENY (write existed only through the revoked basis and MUST NOT survive on the strength of the surviving `P2` basis — under-revocation); B's `read` → ALLOW (read is independently derivable from the still-valid `P2 → C → B` basis and satisfies its inherited constraints (INV-03) — over-revocation). A global subject-level `revoked` bit fails the `read → ALLOW` side; a global subject-level `authorized` bit fails the `write → DENY` side.

### 6b.5 Adversarial Vector Family (AV-01~16)

Convergence criterion = `decision` + `matched_invariant` + `first_invalid_boundary`. Full vector table in the independent conformance suite (`vectors/` + `conformance/CONFORMANCE.md`). Added AV-15 (re-authorization provenance, §6a.10: attack side non-root re-authorization → DENY, legal side root re-establishment → ALLOW), AV-16 (multi-root basis-scoped revocation, §6b.4: attack side write → DENY, legal side read → ALLOW).

