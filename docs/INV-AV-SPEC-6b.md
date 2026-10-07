# ERDL 规范 v2.3 · §6b 委托权威安全模型（冻结文本，中文）

> 用途：随 frozen INV/AV set 发给 Annam 做 pre-release review
> 基准：erdl-language-spec-v2.3.md @ cc53097aa885f2e9cd3bcfe2e1b02753fff30c5e

---

## 6b. 委托权威安全模型（组织行为层）

> **署名（attribution）**：委托授权安全不变量（INV-01–INV-05）及相关对抗一致性向量（AV-01–AV-16）由 Ravindra Annam 提出，随后在与 OpenOBA 的技术评审与协作中进一步细化与完善。

§6a 定义单实例 FSM（单个授权关系的状态机）；本节定义**委派链**（多个授权关系沿「授权根 → 中间节点 → 被授权主体」组合）的安全不变量——约束「授权如何沿委派链传播」，是组织行为层的规范性语义。分层：§6a 提供「授权状态的可验证裁决」，本节保证「委派链的安全不变量」；per-授权关系的多实例状态由组织层为每个关系实例化一个文档承载（§6a.1 分层边界）。本节「委派」指**授权委派**（delegation of authority，沿授权链传播权限），与 §6 的 `DELEGATE` 决策类型（人机协同：把「机器搞不定」交给人或流程）语义不同。

### 6b.1 总纲：委派不得制造权威（MUST）

一切委派、下达、再委托、传递委派、特权中介、下游约束变更、撤销，都 MUST NOT 让有效权威**超出或逃逸**起源权威链：

> `effective_authority(subject) ⊆ authority(chain)` —— 有效权威是起源权威链的**子集**，任何操作不得放大它。

### 6b.2 五条委托权威不变量（INV-01~05）

每条不变量 = 性质 + 违反形态 + 规范性断言。

#### INV-01 权威不放大（authority non-amplification）

- **性质**：`effective_authority ⊆ authority(chain)`。委派方授予的权限 ⊆ 委派方自己拥有的权限；权限不能通过委派链被放大。
- **违反形态**：直接放大（授出超出自身权限）、传递放大（多层委派累积放大）、**聚合放大**（多个独立合法的 child grant 聚合消耗同一有界起源权威——per-hop 非放大必要但不充分）。
- **规范性断言**：任何委派/下达/晋升动作后，`effective_authority(delegate) MUST ⊆ authority(chain)`；多个 child grant 对同一有界起源权威的聚合消耗 MUST 满足起源权威守恒（aggregate conservation）。

#### INV-02 溯源连续性（provenance continuity）

- **性质**：每个决策有连续可验证的溯源链（授权基础 → 委派 → 行使），身份绑定不可破坏。
- **违反形态**：溯源链断裂、重放已消费的委派、身份绑定破坏、特权洗权（privilege laundering，经中介节点伪装权限来源）。
- **规范性断言**：行使权威的每个决策 MUST 能追溯到一条连续的、未被消费的授权链；行使身份 MUST 绑定到授权链声明的身份。

#### INV-03 窄化继承（narrow-only constraint inheritance）

- **性质**：约束只能收窄，不能放宽。委派时施加的约束（deadline / max_autonomy / escalation_to / 范围）被继承，且下游只能进一步收窄。
- **违反形态**：下游约束移除/放宽。
- **规范性断言**：`constraints(delegate) MUST ⊆ constraints(delegator)`；下游约束变更 MUST NOT 放宽。

#### INV-04 传递撤销（transitive revocation）

- **性质**：撤销传播到所有派生权威（含未行使的、已再委托的）。
- **违反形态**：已撤销祖先委托（再委托后祖先撤销 → 下游派生权威未失效）、陈旧负面、状态缺失、已完成动作不可逆。
- **规范性断言**：撤销某节点，其下游子树 MUST **全部失效**（传递闭包），无论已行使与否；撤销**不可逆**，重新可行使 MUST 走新的授权基础（§6a.10）。当多个独立授权基础收敛到同一主体时，该失效是**按授权基础收敛**的（§6b.4）——作用于被撤销授权基础的子树，而非主体的全局权威。

#### INV-05 能力边界轴（capability boundary axis）

- **性质**：权威沿 agent → skill → tool → protected-resource 只减不增。
- **违反形态**：越界。
- **规范性断言**：`authority(resource) MUST ⊆ authority(tool) ⊆ authority(skill) ⊆ authority(agent)`。

### 6b.3 撤销新鲜度（机制中立）

本节是 §6a.9（最新权威头新鲜度）在委派链层的推广：§6a.9 约束单实例 FSM 的状态头新鲜度，本节约束委派链祖先撤销状态的新鲜度。

行使依赖可撤销祖先的权威前，执行边界 MUST 确立撤销状态满足配置的新鲜度要求；**可见撤销的缺失 MUST NOT 单独构成持续有效**；无法确立新鲜度即 fail-closed。机制中立：monotonic epoch / lease / version vector / signed status object / online introspection / 等价机制。

### 6b.4 按授权基础收敛的撤销（basis-scoped revocation，多根组合）

主体可能通过**多个相互独立的授权基础**持有相同（或重叠）的有效权威——例如 `P1 → A → B` 授 `{read, write}` 给 B，而 `P2 → C → B` 独立地授 `{read}` 给 B。INV-04（传递撤销）确立了「撤销某节点 → 其派生权威失效」；本节固定该失效的**作用域**：当多个独立授权基础收敛到同一主体时，撤销是**按授权基础收敛（basis-scoped）**&#x7684;，绝不是主体全局的。

**有效权威合成（MUST）**：主体的有效权威是其**当前有效的每个授权基础**可导出权威的并集：

> `EffectiveAuthority(B) = ⋃_{X ∈ B 的当前有效授权基础} authority_derivable(B, X)`

`authority_derivable(B, X)` 是 B 沿 `X → … → B` 路径派生的有效权威——basis-X 授予范围与该路径继承约束（INV-03）的交集（meet）。授权基础**当前有效**当且仅当：未被撤销（INV-04）、其撤销状态新鲜（§6b.3）、且携带授权根源 provenance（§6a.10）。

**按授权基础收敛的撤销（MUST）**：`revoke(basis-X)` 移除**恰恰好** basis-X 可导出的权威——不多（basis-X 下游派生的完整传递闭包，依 INV-04）、不少（独立由仍有效 basis-Y 导出的权威保持可行使）。撤销一条派生路径**不等于**撤销该主体持有的每一个独立授权基础。

**禁止的归约（MUST NOT）**：合规实现 MUST NOT 把主体的权威归约为单一的主体级全局状态——既不得用主体级全局 `revoked` 位（**过撤销**：摧毁由仍有效授权基础独立建立的权威），也不得用主体级全局 `authorized` 位（**欠撤销**：保留只属于已撤销谱系的权威）。权威状态 MUST 按授权基础/谱系收敛，使一个授权基础的失效既不坍缩也不保留另一个授权基础的权威。

**禁止跨基础保留（MUST NOT）**：存活的授权基础 MUST NOT 被用来保留只属于已撤销谱系的权威。并集是对每个授权基础各自可导出的权威求的——`revoke(basis-X)` 移除 basis-X 的贡献，即使另一个授权基础授予了重叠（但不完全相同）的范围。

**与 INV-04 的关系**：本节把 INV-04 的「整个下游子树」细化为**按授权基础相对**的——是被撤销授权基础的子树，而非主体的全局权威。INV-04 的不可逆性与 §6a.10 的「新授权基础」要求仍然成立：被撤销谱系权威的重新可行使 MUST 走一个新的、独立建立的授权基础，不得因某个无关授权基础的存活而被恢复。§6b.1 的 `effective_authority ⊆ authority(chain)` 是**按授权基础**成立的——每个授权基础的贡献受其自身起源权威链约束，并集只是组合这些按基础约束的贡献，不制造权威。这一多根组合区别于 INV-01 的聚合放大（多个子授权共同消耗**一个**起源的共享预算）：此处每个授权基础都是独立起源，各自受自身的守恒约束。

**判别性合规场景（V-STATE，conformance 向量 AV-16：attack 侧 write → DENY，legal 侧 read → ALLOW）**：`P1 → A → B` 授 `{read, write}`；`P2 → C → B` 独立授 `{read}`；`revoke(P1 → A)`。期望：B 的 `write` → DENY（write 仅通过被撤销授权基础存在，MUST NOT 借存活 `P2` 基础而存活——欠撤销）；B 的 `read` → ALLOW（read 独立由仍有效的 `P2 → C → B` 基础导出且满足其继承约束（INV-03）——过撤销）。主体级全局 `revoked` 位会在 `read → ALLOW` 一侧失败；主体级全局 `authorized` 位会在 `write → DENY` 一侧失败。

### 6b.5 对抗向量族（AV-01~16）

收敛标准 = `decision` + `matched_invariant` + `first_invalid_boundary`。完整向量表见独立 conformance 套件（`vectors/` + `conformance/CONFORMANCE.md`）。新增 AV-15（re-authorization provenance，§6a.10：attack 侧非授权根 re-authorize → DENY，legal 侧授权根重建 → ALLOW）、AV-16（multi-root basis-scoped revocation，§6b.4：attack 侧 write → DENY，legal 侧 read → ALLOW）。

