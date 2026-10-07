# ERDL SPEC v2.3 · §6b Delegated-Authority Security Model（冻结文本，英文）

> 用途：随 frozen INV/AV set 发给 Annam 做 pre-release review
> 基准：erdl-language-spec-v2.3.en.md @ cc53097aa885f2e9cd3bcfe2e1b02753fff30c5e

---

## 6b. Delegated-Authority Security Model (Organization Behavior Layer)

> **Attribution**: The delegated-authority security invariants (INV-01–INV-05) and associated adversarial conformance vectors (AV-01–AV-14) were proposed by Ravindra Annam and subsequently refined and developed through technical review and collaboration with OpenOBA.

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
- **Normative assertion**: revoking a node MUST invalidate its entire downstream subtree (transitive closure), whether exercised or not; revocation is **irreversible**, re-exercisability MUST go through a new authorization basis (§6a.10).

#### INV-05 Capability Boundary Axis

- **Property**: authority only decreases along agent → skill → tool → protected-resource.
- **Violation shapes**: out-of-bounds.
- **Normative assertion**: `authority(resource) MUST ⊆ authority(tool) ⊆ authority(skill) ⊆ authority(agent)`.

### 6b.3 Revocation Freshness (Mechanism-Neutral)

This section generalizes §6a.9 (latest-authoritative-head freshness) to the delegation-chain layer: §6a.9 constrains single-instance-FSM state-head freshness, this section constrains the freshness of a delegation-chain ancestor's revocation state.

Before exercising authority that depends on a revocable ancestor, the enforcement boundary MUST establish that revocation state satisfies the configured freshness requirement; **absence of visible revocation MUST NOT by itself establish continued validity**; when freshness cannot be established, fail closed. Mechanism-neutral: monotonic epoch / lease / version vector / signed status object / online introspection / equivalent mechanisms.

### 6b.5 Adversarial Vector Family (AV-01~14)

Convergence criterion = `decision` + `matched_invariant` + `first_invalid_boundary`. Full vector table in the independent conformance suite (`vectors/` + `conformance/CONFORMANCE.md`).

