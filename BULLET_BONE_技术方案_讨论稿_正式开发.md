# BULLET BONE 技术方案（讨论稿）

**版本：v1.1**  
**基线策划案：** `BULLET_BONE_骨塔传说_策划案_v1.xlsx`  
**文档状态：** 持续讨论与迭代，尚未冻结为最终实施方案  
**目标引擎：** Unreal Engine 5.8  
**主要技术栈：** Paper2D、PaperZD、Gameplay Ability System、Lua（框架待团队确认）、UMG、C++；Blueprint 仅作为资产载体

---


# 1. 技术架构问题总览

本文档用于定义 BULLET BONE 项目的技术架构、系统边界、核心运行时模型和 UE4/Paper2D 落地范围。

本文档不是策划功能逐条翻译，也不负责决定具体业务数值和内容规模。格挡、骨蚀印记、芯片、词条、特质、武器品质等策划机制只作为架构使用场景，用于检验公共技术框架是否具备足够的表达能力、组合能力和扩展能力。

本章只定义技术方案必须回答的**具体架构问题（What）**。问题按“共同解决游戏的哪一部分”聚类，而不是按底层 API、插件或类名平铺。每个问题必须同时满足：

- 不是单一业务规则，而是会影响多个系统或模块；
- 涉及职责边界、生命周期、状态所有权、模块依赖或公共基础设施；
- 足够具体，能够在后续章节中形成独立技术决策；
- 本章不提前给出具体类、插件、算法或实现结论。

## 1.1 问题状态

- **已回答**：对应正文已经形成明确的推荐方向、边界或架构结论；仍可能存在实现验证。
- **部分回答**：已有分析或候选方向，但关键选型、边界或验证尚未完成。
- **未回答**：目前只有问题，还没有足以指导实施的结论。

问题编号沿用 v0.6，作为稳定引用标识。此次只调整问题所属模块，不更改既有编号。

## 1.2 Gameplay 基础框架

解决整个游戏业务代码如何组织、运行和共享状态的问题。

- **A1 [部分回答]** UE5.8、Paper2D、PaperZD、GAS、Lua、UMG、Blueprint 与 C++ 如何组成统一技术栈；Lua 与 TypeScript 方案在 Agent 驱动、非程序成员验证环境、脚本工具链和 UE5.8 兼容性上的取舍是什么。
- **A2 [已回答]** C++、Lua、Blueprint、配置数据和资源资产分别承担哪些职责，哪些逻辑不得跨层重复实现。
- **A3 [未回答]** Lua VM 生命周期如何与 GameInstance、World、Level 和 UObject 生命周期衔接。
- **A4 [未回答]** Lua 对象如何绑定 Actor、ActorComponent 和 UObject，以及 UObject 销毁后 Lua 引用如何失效与释放。
- **A5 [部分回答]** Lua 热重载、模块初始化顺序、模块依赖和高频 C++/Lua 调用边界如何统一管理。
- **C1 [已回答]** Application、Run、NodeMap、Room、Encounter 和 Actor 分别拥有哪些状态与生命周期。
- **C2 [部分回答]** Run 状态由什么层级持有，并如何避免散落在 Player、GameMode、Level Blueprint 和各类 Manager 中。
- **C3 [已回答]** Room 生命周期与 Encounter 生命周期如何分离，房间类型差异如何在共享流程框架下表达。
- **C4 [已回答]** Subsystem、Manager Actor、ActorComponent、UObject 和 Lua Module 分别适合承载哪些能力。
- **C5 [已回答]** 模块之间何时直接调用，何时使用局部回调、GAS GameplayEvent 或跨系统领域消息。
- **C6 [已回答]** 如何避免全局 EventManager、全局 Singleton 和万能 Manager 形成新的耦合中心。
- **D1 [已回答]** 静态 Definition、局内 Instance、Runtime State、Save Record 和 View Data 如何区分。
- **D2 [已回答]** 每类状态的唯一真源属于哪个运行时层级，缓存和 UI 投影如何避免成为第二真源。

## 1.3 GAS 与玩法驱动框架

解决角色属性、能力、效果、状态和玩法规则由什么统一机制驱动的问题。

- **B1 [已回答]** GAS 在 Paper2D 项目中负责哪些公共 Gameplay 能力，哪些系统明确不应进入 GAS。
- **B2 [部分回答]** GameplayAbility、GameplayTag、GameplayEffect、GameplayEvent 和 GameplayCue 如何与 Lua 业务层衔接。
- **B3 [已回答]** GAS Ability 如何驱动 PaperZD 动画、动画通知和状态切换，以及 Ability 状态与动画状态谁是唯一真源。

## 1.4 玩家角色与 3C

解决玩家移动、瞄准、射击、相机和直接操作反馈如何形成完整控制体验的问题。

- **F1 [未回答]** 玩家、射击和移动采用哪一个二维逻辑平面，所有 3C 计算如何统一在该平面完成。
- **F2 [未回答]** Sprite 朝向、Pivot、Pixel Per Unit、Tile 尺寸、世界单位和角色碰撞尺寸如何形成统一资产规范。
- **F3 [部分回答]** 玩家、武器、墙体、弹丸、特效和世界 UI 如何建立统一深度、排序和遮挡规则。
- **F4 [部分回答]** 玩家 Capsule、PaperTileMap、弹丸、格挡区域和交互触发区如何划分碰撞通道与查询规则。
- **F5 [部分回答]** 输入映射、Gameplay 输入、UI 输入、输入焦点和 Ability 激活之间如何分层。
- **F6 [未回答]** 鼠标或手柄瞄准如何转换为稳定二维世界方向，并与相机运动和分辨率变化解耦。
- **G1 [已回答]** Hitscan 与实体 Projectile 如何共享发射参数、命中上下文、伤害上下文和效果触发链。
- **G2 [部分回答]** 高速 Projectile 的 Sweep、连续碰撞、子步进、穿透、反射和边界销毁如何形成统一弹丸框架。
- **H3 [已回答]** 相机跟随、房间边界、瞄准偏移、震屏、缩放和不同分辨率适配如何统一管理。
- **H4 [已回答]** 玩家动画、Sprite、VFX、音频、相机和后处理如何消费 Gameplay 状态而不反向持有业务真源。

## 1.5 怪物与战斗遭遇

解决单个 NPC/Monster 如何行动，以及一场战斗如何生成、推进和结束的问题。

- **G5 [已回答]** 单个敌人的感知、决策和移动，与 Encounter 的生成、波次、存活计数、清场和 Boss 阶段如何分层。
- **G6 [部分回答]** Paper2D 敌人应使用 NavMesh、房间网格寻路还是 Steering，以及导航数据如何与房间模板衔接。

## 1.6 Run 与关卡流程

解决一局游戏的内容如何生成、空间如何选择、房间如何推进以及随机结果如何复现的问题。

- **D6 [已回答]** 节点地图数据模型、节点连接、节点状态和节点 UI 展示如何分离。
- **D7 [已回答]** 节点地图生成、房间模板选择、战斗空间生成、敌人布置和奖励布置分别属于哪一级生成系统。
- **D8 [已回答]** 节点地图、房间、掉落、商店、事件和战斗随机如何使用隔离 Seed 流，并从同一 RunSeed 派生。
- **D9 [已回答]** Gameplay 随机与纯表现随机如何隔离，避免新增特效随机改变地图、掉落或商店结果。
- **D10 [部分回答]** 固定 Seed 需要复现哪些结果，随机流状态需要记录到什么层级。
- **E1 [已回答]** 人工房间模板、运行时 PaperTileMap、模块化 Chunk 和第三方 PCG 工具分别解决什么层级的地图生产问题。
- **E2 [已回答]** 房间模板如何被选择、Streaming 加载、激活和卸载，并与 Run 和 Room 生命周期衔接。
- **E3 [已回答]** 房间采用何种加载粒度与组织方式；当前确定以独立小关卡作为 Streaming 单元。

## 1.7 掉落、奖励与局内物品

解决战斗和房间结果如何转换为可生成、可拾取、可保存于 Run 的物品实例。

- **G7 [已回答]** DropRequest、DropResolver、RewardSpec、RewardSpawner、Pickup 和 RunInventory 如何形成数据到世界表现的完整链路。

## 1.8 UI 与交互界面

解决 HUD、节点地图、商店、事件、结算和局外页面如何读取状态并组织界面生命周期。

- **H5 [已回答]** HUD、背包、商店、节点地图、事件选择和结算 UI 如何读取 Gameplay 状态并刷新表现；是否需要额外的 MVVM/Presenter 状态投影层。
- **H6 [已回答]** UMG Widget、Lua UI 逻辑、输入焦点、界面栈、Ticker 和事件绑定生命周期如何与房间切换和游戏暂停衔接。

## 1.9 数据、配置与内容生产

解决策划、美术和程序如何共同生产、引用、校验并加载可运行内容。

- **D3 [已回答]** DataTable、PrimaryDataAsset、GameplayTag、软资源引用和 Stable ID 如何组成统一内容定义体系。
- **D4 [未回答]** 策划 Excel、Lua 配置、DataTable/DataAsset 和运行时 Definition 之间的数据导入与生成链路如何组织。
- **D5 [部分回答]** 内容 ID、跨表引用、软引用、GameplayTag 和房间模板如何在编辑器与打包前统一校验。

## 1.10 存档与局外状态

解决跨 Run、跨进程的数据如何持久化并重新映射到内容定义与运行时实例。

- **I1 [已回答]** 局外 Meta 数据与可选 Run 数据如何分别持久化，并如何映射回运行时 Definition 和 Instance。
- **I2 [已回答]** 存档版本、字段迁移、Stable ID 变化和配置删除如何保持数据兼容。

## 1.11 公共运行时基础设施

解决多个游戏模块共同依赖、但不属于某个单一玩法系统的运行时能力。

- **G3 [已回答]** 玩家弹丸、敌人弹丸、命中特效、飘字、掉落物和临时音频组件如何共享对象池生命周期契约。
- **G4 [已回答]** 池化对象回收和复用时，Delegate、Timer、Collision、Tick、Lua 状态和 Gameplay 状态如何彻底重置。
- **E4 [已回答]** 软引用、异步加载、资源预加载、资源释放和对象池预热如何形成统一资源生命周期。
- **H1 [已回答]** Hit Stop、Pause、Global Time Dilation、Custom Time Dilation 和局部慢放请求如何避免互相覆盖。
- **H2 [部分回答]** Gameplay、UI、音频、Timer 和 Projectile 分别遵循什么时间域。
- **H7 [已回答]** 后处理与音效是否需要项目级独立系统，还是直接复用 UE 与 GAS 的原生表现能力。

## 1.12 工程支持

解决团队如何调试、验证、优化、构建和并行开发项目。

- **J1 [已回答]** 运行时如何观测 RunContext、RoomState、EncounterState、ASC、GameplayTag、随机流、对象池和 AI 状态。
- **J2 [已回答]** 固定 Seed、跳转节点、进入房间、生成敌人、授予物品、强制掉落和状态 Dump 等调试能力应由什么统一入口提供。
- **J3 [已回答]** 哪些配置、资源引用、图结构和存档结构需要自动化验证，验证在哪些开发和构建阶段执行。
- **J4 [未回答]** 同屏敌人、弹丸、特效、Widget 和房间资源的目标容量分别是什么，哪些路径必须视为高频路径。
- **J5 [已回答]** Projectile Tick、Lua 反射调用、Sprite Overdraw、UMG Tick、同步加载和频繁 Spawn/Destroy 如何统一纳入性能架构。
- **J6 [未回答]** 第三方插件、Lua、PaperZD、GAS、软引用和配置资产在 Cook 与 Shipping Build 中如何验证兼容性。
- **J7 [部分回答]** 公共框架、战斗、关卡、UI、资源、工具和业务模块之间暴露哪些稳定接口，以支持多人并行开发。

## 1.13 现有技术方案评审

- **K1 [部分回答]** 原“UE4技术方案”中的每一项应归入哪个架构问题，哪些内容可以保留，哪些需要替换、拆分或提升。

# 2. 当前决策状态摘要

## 2.1 已形成方向

- Gameplay Ability System 可以直接用于 Paper2D，不需要自研完整 Attribute、Modifier 和 Buff 框架。
- PaperZD 与 GAS 的主要断点在动画表现层，需要开发少量自定义 AbilityTask。
- C++ 负责稳定框架、高频逻辑、生命周期和 Lua API；Lua 负责主要业务编排；Blueprint 负责资源装配与少量表现。
- 不建立“所有事件都必须进入全局 EventManager”的架构。
- 游戏运行时至少划分为 Application、Run、Room/Encounter 和 Actor 四个层级。
- 节点地图是单个房间关卡集合起来的拓扑数据层，与具体战斗空间解耦。
- 节点地图使用独立图数据和规则校验；具体拓扑参数由策划设计后续确定。
- 单个战斗房间采用手工制作的小关卡模板，作为独立 Streaming 单元。
- 房间内部沿用常规关卡工作流：用触发器、生成区域和 POI 声明可填充位置，运行时注入敌人、奖励和少量局部变化。
- 首版不采用完整运行时程序化生成战斗空间，也不采用大量模块 Chunk 拼接作为主生产方式。
- 已完成节点不可返回；进入新节点后可以卸载旧房间，不要求恢复旧房间场景状态。
- 静态定义、局内实例、运行时状态、存档记录和 UI 展示数据必须分层。
- 所有随机结果必须由 RunSeed 派生并可复现。
- Hitscan 和 Projectile 可以共享上层射击接口，但底层不必强制统一为一种实现。
- 需要统一对象池、时间控制、资源加载、调试验证等基础设施。

## 2.2 当前最关键的待确认项

- Lua 框架最终选择：当前首选候选为 UnLua，需团队评审并完成 UE5.8 PoC。
- PaperZD 与 UnLua 在 UE5.8 下的源码编译、Editor、Cook 和 Shipping 兼容性。
- PaperZD 具体版本。
- GAS Ability 主要使用 C++、Blueprint 还是 Lua 实现。
- 游戏逻辑采用 XY 平面还是 XZ 平面。
- 目标平台、目标分辨率、帧率和性能基线。
- AI 使用 NavMesh、房间网格寻路还是纯 Steering。
- 是否允许 Run 中途存档。
- UI 是否采用 Lua Presenter/MVVM 风格。

---

---


---

# 3. Gameplay 基础框架

本章对应问题：A1–A5、C1–C6、D1–D2。

## 3.1 技术栈与语言职责（A1–A5）

### 3.1.1 已确定的项目前提

本项目计划使用 **Unreal Engine 5.8**。选择较新的正式引擎版本，除了获得最新的编辑器和运行时能力，也考虑到 UE5.8 对 Agent/MCP 工作流更友好。Paper2D 作为 2D 玩法与资源框架，能够复用的引擎能力优先直接复用，不另行搭建平行体系。

项目的脚本与资产分工遵循以下强约束：

- Gameplay 与流程逻辑优先写在脚本层。
- Lua 取代 Blueprint Event Graph 的业务逻辑生态位。
- Blueprint 只作为资源资产、默认值、UMG 布局、PaperZD 资源装配和关卡模板的可视化载体；原则上不允许业务 Event Graph。
- C++ 主要用于引擎接入、脚本桥接和明确需要原生实现的底层能力；是否将某段 Lua 迁移到 C++，优先由实际性能或引擎接口约束决定。
- 技术方案需要支持 Agent 直接阅读、生成、修改和审查主要 Gameplay 代码，避免关键逻辑隐藏在二进制 Blueprint 图中。

这意味着当前的总体方向不是传统的“C++ Framework 主导、Lua 补充业务”，而是：

```text
UE5.8 / Paper2D / GAS 等引擎能力
                ↓
        Lua 可调用的稳定接口
                ↓
     Lua Gameplay、流程和可执行规则
                ↓
  PaperZD / UMG / Sprite / Room 等资产表现
```

### 3.1.2 选择脚本方案时的团队工作流目标

脚本方案不仅需要提高程序迭代速度，还需要让策划和美术能够在自己的环境中快速运行和验证游戏：

- 非程序成员不安装 Visual Studio、Windows C++ SDK 或完整编译环境。
- 程序编译项目 C++ Editor Target，并将项目 `Binaries`、插件 `Binaries` 与对应 `.modules` 文件直接提交到项目仓库。
- 策划和美术拉取同一项目仓库后，使用统一的 UE5.8 版本直接打开 `.uproject`，不执行 C++ 编译。
- C++ 接口未变化时，策划和美术仅通过 Lua、配置和资产修改即可持续 PIE 验证。
- C++ 接口变化时，由程序重新编译并提交匹配的 Editor 二进制。

项目模块 DLL 位于项目目录，例如：

```text
BulletBone/
├── Binaries/Win64/
│   ├── UnrealEditor-BulletBone.dll
│   └── UnrealEditor.modules
├── Plugins/*/Binaries/Win64/
├── Source/
├── Script/
├── Content/
└── BulletBone.uproject
```

当前团队规模下，不拆分“程序仓库”和“策划/美术仓库”。源码、Lua、配置、资产和预编译二进制保留在同一版本关系中，降低 Content、Lua 与 C++ API 版本错配的风险。

需要建立的最小协作规范包括：

- 所有成员使用完全一致的 UE5.8 Build。
- DLL 与 `.modules` 成套提交。
- C++ 接口变化必须伴随新的 Editor 二进制。
- 指定程序成员或 CI 负责提交二进制，避免多人同时覆盖不可合并的 DLL。
- 策划和美术不得依赖尚未提交二进制的新 C++ API。

### 3.1.3 Lua 与 TypeScript 的决策维度

当前最终语言方案仍需团队成员确认。Lua 与 TypeScript 的比较不只看语言本身，还需要同时考虑以下因素。

#### Lua 方案

Lua 的主要优势：

- 脚本文件可由运行时直接加载，不需要 TypeScript 编译步骤。
- 非程序成员的环境可以压缩为“拉取项目、修改文本、Reload、PIE 验证”。
- 配置、Gameplay 和工具脚本可以共享同一种语言与热重载链路。
- 运行时和工具链较轻，不要求 Node.js、npm、`node_modules`、`tsc` 或额外 Watch 进程。
- 适合策划直接编写结构化规则或小型可执行配置。

Lua 的主要代价：

- 缺少 TypeScript 级别的静态类型约束。
- 大型工程中的重构、接口发现和错误前置能力较弱。
- 需要项目自行补充类型注解、Schema 校验、模块规范和 Agent 可读的 API 文档。

#### TypeScript / PuerTS 方案

PuerTS 在 Unreal 中当前主要提供 JavaScript/TypeScript 运行方案，并能生成 TypeScript 声明以类型化访问引擎 API。它对 Agent 驱动开发的优势在于静态类型、IDE 补全、批量重构和接口约束更强。

它对当前团队工作流的额外成本包括：

- 策划和美术环境需要 Node.js 或项目封装的 TypeScript 构建工具。
- `.ts` 通常需要先转换为运行时 JS，再进行 Reload。
- 需要维护依赖、类型声明、构建脚本和 Watch 流程。
- 对非程序成员而言，比直接编辑 Lua 多一层可失败的构建步骤。

因此，用于最终决策的核心权衡是：

```text
Lua：最短的非程序验证链路与较低环境成本
TS：更强的静态类型、IDE 与 Agent 代码修改可靠性
```

如果团队把“策划和美术开箱验证”置于更高优先级，Lua 更有优势；如果未来工程规模和长期重构安全性优先级显著提高，可重新评估 PuerTS。

### 3.1.4 UE Lua 框架候选

#### UnLua：当前首选候选

UnLua 的公开能力与项目目标最匹配：

- 通过 UE 反射访问 `UCLASS`、`UPROPERTY`、`UFUNCTION`、`USTRUCT` 和 `UENUM`，常规接口不要求逐个编写胶水代码。
- 支持覆盖 Blueprint Event、Animation Notify 和 Input Event。
- 提供反射外类型的静态导出方式，并针对 UFunction、容器和结构体访问进行了优化。
- 编程模型尽量贴近 UE，适合让 Lua 直接承载 Actor、Component、UI 和 Gameplay 业务。

当前建议将 **UnLua 作为 A1 的默认候选**，但在团队确认前仍保持“部分回答”，并通过 UE5.8 PoC 验证实际兼容性。

#### sluaunreal：保留比较，不作为当前首选

sluaunreal 具有成熟项目验证、反射调用、静态代码生成和 CppBinding 等能力。但其公开说明对新版 UE 的支持承诺较保守；最新 Release 明确完整适配到 UE5.4，而仓库 README 对其他 UE5 版本仍提示支持资源有限。

它并非不可用，但采用 UE5.8 时更可能需要团队自行维护兼容分支，因此不优先于 UnLua。

#### LuaMachine 等沙箱型方案

这类方案更适合 Mod、受控脚本或显式白名单 API，并不以 Lua 全面接管 UE Gameplay 编程模型为核心目标。对本项目会增加大量 API 封装工作，不进入当前首选范围。

### 3.1.5 UnLua 的 PoC 验收条件

在团队最终冻结 UnLua 前，需要完成最小技术验证：

1. UE5.8 Development Editor 源码编译通过。
2. Cook 与 Shipping Build 可完成，并正确打包 Lua 文件。
3. 不依赖 Blueprint Event Graph 即可完成 Actor/Component 的 Lua 业务绑定。
4. Lua 能访问 Paper2D、PaperZD、UMG 与 GAS 的项目所需接口。
5. PIE 多次启动和退出后，不残留失效 UObject、Delegate、Timer 或协程引用。
6. Lua 单文件和模块热重载能够给出清晰的错误文件与行号。
7. 策划或美术在无 C++ 编译环境中，使用仓库内预编译 Editor DLL 可直接打开项目并完成 Lua/资产验证。
8. Agent 可以仅通过文本代码完成一个最小角色移动、射击或房间流程修改，不需要编辑 Blueprint 图。

### 3.1.6 C++、Lua 与 Blueprint 的职责边界

#### Lua 默认负责

- GameplayAbility 的业务流程编排。
- Run、Room 和 Encounter 的业务状态机。
- 武器特殊规则。
- 芯片、词条、特质等组合玩法。
- 商店、掉落、事件与局内流程。
- AI 决策层。
- UI Presenter 与界面交互。
- 教学、剧情和开发期工具逻辑。

#### C++ 默认负责

- 引擎模块与 UnLua 启动、绑定和生命周期接口。
- GAS 宿主、AttributeSet 以及 Lua 不宜直接维护的 Spec/Context 封装。
- PaperZD 与 GAS 之间必要的原生适配。
- UE 原生 API 尚未可靠暴露给 Lua 时的桥接。
- 对 UObject 生命周期、线程、异步和底层资源所有权有强约束的代码。
- 已经通过 Profiling 证明 Lua 方案不能满足要求的热点路径。

项目不预先假定 Projectile、对象池、Room 生命周期等所有底层都必须使用 C++；应优先验证 UE 原生组件与 UnLua 调用是否足够。只有在性能、生命周期安全或引擎接口限制明确存在时，再将该部分固化为 C++ 底座。

#### Blueprint 只负责资产表达

允许：

- Sprite、Flipbook、PaperZD 动画资产与资源引用。
- UMG 布局和纯界面动画。
- 材质、VFX、音频与默认资产参数。
- 房间模板、Spawn Point 和编辑器可视化摆放。
- 作为 C++/Lua 类的资源派生壳。

禁止：

- Event Graph 业务逻辑。
- Gameplay 状态机和属性计算。
- Run、Room、Encounter、AI、掉落或存档流程。
- Tick 驱动的业务逻辑。
- 跨系统事件中转。

### 3.1.7 DataTable 与 Lua 配置的关系

“策划可以直接写 Lua 配置”是 Lua 工作流的附加优势，但不意味着 Lua 应取代 DataTable。

DataTable 可以表达大多数同构、表格型和纯数据内容，包括：

- 武器与敌人基础数值。
- 品质、价格、权重与掉率。
- 房间、商店和节点参数。
- 简单条件参数和效果列表。
- GameplayTag 与软资源引用。

Lua 配置更适合：

- Schema 仍在频繁变化、暂时不希望每次增加字段都修改 C++ `USTRUCT` 的内容。
- 嵌套结构或行间差异过大，DataTable 会产生大量 Optional 字段的内容。
- 规则已经接近流程或条件代码，继续数据化会演变成自研脚本语言的内容。
- 需要脱离 Editor 直接修改并热重载的结构化规则。

推荐原则暂不在 A1 中冻结，留给 D4 进一步决策：

```text
同构、纯数据、批量编辑     → DataTable
复杂资源型 Definition       → DataAsset（按需）
流程、状态机、复杂规则       → Lua
```

若使用 Lua 配置，应要求配置模块加载时只返回数据表，不得注册事件、创建 UObject、启动 Timer 或修改全局状态；字段类型、Stable ID 和引用关系仍需 Schema 校验。

### 3.1.8 A1 当前结论与未决事项

当前已确定：

- 引擎版本使用 UE5.8。
- Paper2D 作为 2D 玩法与资源框架，优先复用 UE 原生能力。
- Lua 是当前首选脚本语言方向。
- Blueprint 不承担业务逻辑，只承担资产表达与可视化装配。
- 策划和美术通过仓库内预编译项目/插件 Editor 二进制直接运行项目，不自行编译 C++。
- 项目源码、Lua、Content 和 Editor 二进制暂时保留在同一仓库。
- Lua 配置是可选能力，但 DataTable 仍是主要静态配置候选之一。

仍需团队确认：

- 最终采用 UnLua，还是重新评估 PuerTS/TypeScript。
- UnLua 在 UE5.8 下的实际编译、热重载、Cook、Shipping 和非程序工作区验证结果。
- Lua 与 DataTable 在 D4 中的最终配置边界。

因此 A1 状态仍为 **部分回答**；现阶段已经具备团队评审和 PoC 决策所需的信息，但尚未形成最终框架选型。

### 3.1.9 参考资料

- Epic Games：《Unreal Engine 5.8 Release Notes》：https://dev.epicgames.com/documentation/unreal-engine/unreal-engine-5-8-release-notes
- Tencent UnLua README：https://github.com/Tencent/UnLua/blob/master/README_EN.md
- Tencent sluaunreal README：https://github.com/Tencent/sluaunreal
- Tencent sluaunreal Releases：https://github.com/Tencent/sluaunreal/releases
- Tencent PuerTS README：https://github.com/Tencent/puerts

---

---

## 3.2 运行时分层与生命周期（C1–C3）

### 7.1 Application 层

生命周期跨越整个进程。

推荐使用 `UGameInstanceSubsystem`：

```text
UGameInstance
├── UGameDataSubsystem
├── USaveGameSubsystem
├── UAssetLoadSubsystem
├── UAudioSubsystem
├── UMetaProgressSubsystem
└── UGameConfigSubsystem
```

#### GameDataSubsystem

负责：

- Definition 注册。
- DataTable 和 PrimaryDataAsset 访问。
- ID 查询。
- 配置校验入口。
- 数据缓存。

#### SaveGameSubsystem

负责：

- 存档槽。
- 读写。
- 版本迁移。
- 原子写入。
- 损坏恢复。
- 默认值补全。

#### AssetLoadSubsystem

负责：

- Soft Reference 异步加载。
- 房间预加载。
- 对象池预热。
- 资源句柄生命周期。
- 场景切换加载队列。

#### MetaProgressSubsystem

负责：

- 局外货币。
- 永久解锁。
- 永久成长。
- 已解锁武器和内容池。
- 局外设置。

Application 层不应保存当前房间敌人或当前弹匣等短生命周期状态。

### 7.2 Run 层

一次 Roguelike 游戏过程需要独立的 Run Context。

建议数据结构：

```cpp
struct FRunContext
{
    int32 RunSeed;
    FRunProgress Progress;
    FRunInventory Inventory;
    FRunMapGraph MapGraph;
    FRunStatistics Statistics;
    FRunGenerationState GenerationState;
};
```

#### Run 层负责

- RunSeed。
- 当前楼层。
- 当前节点。
- 节点地图。
- 当前路径。
- 当前武器实例。
- 当前芯片和局内特质。
- 当前金币、临时资源。
- 随机流状态。
- Run 统计。
- 已访问房间。
- Run 结算。

#### Run 层宿主选择

可能方案：

1. `UGameInstanceSubsystem`
2. `UWorldSubsystem`
3. `ARunManager`
4. `AGameState` 或自定义 UObject

单机项目不需要为了联网语义把数据放进 PlayerState。

当前建议：

- 纯数据由 `URunSubsystem` 或 `URunContextObject` 持有。
- 需要参与 World 生命周期或拥有 Actor 引用的部分由 `ARunManager` 持有。
- 不把所有内容都塞进一个 Manager Actor。

最终宿主需根据 UE4 版本和 Lua 框架能力确定。

### 7.3 Room 层

每个房间需要统一控制器：

```text
ARoomController
├── RoomDefinition
├── RoomRuntimeState
├── URoomLogicBase
├── AEncounterController
├── AEnemySpawner
├── ARewardSpawner
├── ADoorController
└── CameraBoundary
```

推荐房间状态机：

```text
Unloaded
→ Loading
→ Entering
→ Preparing
→ Active
→ Cleared
→ Reward
→ Completed
→ Unloading
```

战斗房的 `Active` 对应 Combat；商店房和事件房可以复用同一生命周期，但 RoomLogic 不同。

#### RoomLogic

```text
URoomLogicBase
├── UCombatRoomLogic
├── UShopRoomLogic
├── UEventRoomLogic
├── URestRoomLogic
└── UTreasureRoomLogic
```

RoomController 负责状态机和生命周期正确性；Lua RoomLogic 负责业务。

### 7.4 Encounter 层

Encounter 是战斗房内部的一次战斗遭遇。

负责：

- 敌人生成。
- 波次切换。
- 当前存活敌人计数。
- 精英和 Boss 阶段。
- 清场判定。
- 房门锁定和解锁。
- 奖励触发。
- 失败和重置。
- 战斗统计。

推荐：

```text
AEncounterController
├── EncounterDefinition
├── SpawnGroups
├── AliveEnemySet
├── EncounterState
└── EncounterEvents
```

不要让 RoomController 直接实现所有敌人波次业务。

### 7.5 Actor 层

Actor 层包含：

- Player Character。
- Enemy Character。
- Weapon Actor/Component。
- Projectile。
- Pickup。
- Chest。
- Interactive Actor。
- World Effect。

Actor 负责局部状态，不保存跨房间和跨 Run 的真源数据。

---

## 3.3 系统宿主选择（C4）

### 8.1 Subsystem

适合：

- 明确绑定 Engine、GameInstance 或 World 生命周期。
- 全局唯一或每 World 唯一服务。
- 不需要关卡中摆放。
- 无复杂空间表现。

例如：

- GameDataSubsystem。
- SaveGameSubsystem。
- AssetLoadSubsystem。
- ActorPoolSubsystem。
- GameTimeSubsystem。

### 8.2 Manager Actor

适合：

- 需要存在于 World。
- 需要 Tick。
- 需要引用场景 Actor。
- 需要空间位置或编辑器可视化。
- 生命周期与当前关卡或房间相关。

例如：

- RoomController。
- EncounterController。
- CameraRig。

### 8.3 ActorComponent

适合：

- 明确依附某 Actor。
- 可复用角色能力。
- 与宿主生命周期一致。

例如：

- AbilitySystemComponent。
- WeaponComponent。
- InteractionComponent。
- HealthPresentationComponent。

不建议创建大量没有复用价值、只是为了“模块化”的 Component。

### 8.4 UObject

适合：

- 纯逻辑对象。
- 无空间表现。
- 需要 GC 管理。
- Definition、Instance 和 Strategy。

例如：

- WeaponInstance。
- RoomLogic。
- DropRule。
- ShotExecutor。
- ItemInstance。

### 8.5 Lua Module

适合：

- 业务规则。
- 配置到逻辑的映射。
- 低频流程。
- 热重载内容。

Lua Module 不应替代所有 UObject 生命周期。

---

## 3.4 模块通信与事件边界（C5–C6）

### 9.1 不建立统一全局 EventManager

原表提出：

```text
EventManager 注册和管理所有 Delegate
```

这会使所有调用都穿过一个全局中转层，容易形成：

- 事件名冲突。
- 生命周期和解绑困难。
- 事件来源不可追踪。
- 调试堆栈丢失。
- 模块依赖表面解耦、实际耦合。
- 高频战斗事件产生脚本开销。

### 9.2 四类通信方式

#### 直接调用

适用于明确所有权关系：

```text
Weapon → Projectile
RoomController → EncounterController
Inventory → ItemInstance
```

#### 局部回调

适用于对象间临时关系：

```text
Projectile.OnHit
Enemy.OnDeath
Pickup.OnCollected
Room.OnCleared
```

可用 C++ Delegate、Blueprint Event、接口或 Lua Callback。

#### GameplayEvent

适用于 GAS 战斗流程：

```text
Event.Combat.Hit
Event.Combat.Kill
Event.Projectile.Blocked
Event.Projectile.Reflected
```

#### 领域消息

仅用于跨系统低频消息：

```text
RunStarted
NodeSelected
RoomEntered
RoomCompleted
RunEnded
MetaProgressChanged
SaveCompleted
```

领域消息可由 Lua 消息总线承载，但需要：

- 固定命名。
- 明确 Payload。
- 自动解绑。
- 订阅者生命周期检查。
- 禁止用于逐帧和逐弹事件。

---

---

## 3.5 运行时数据模型与状态真源（D1–D2）

### 10.1 五类数据必须区分

#### Definition

静态定义，项目内容的一部分。

例如：

- WeaponDefinition。
- ChipDefinition。
- TraitDefinition。
- RoomDefinition。
- EnemyDefinition。
- DropTableDefinition。

#### Instance

一次 Run 中生成的实例。

例如：

- 一把带随机品质和词条的武器。
- 玩家当前持有的芯片。
- 商店当前生成的库存项。

#### Runtime State

运行中不断变化的状态。

例如：

- 当前弹匣。
- 当前冷却。
- 当前房间敌人。
- 当前印记持续时间。
- 当前 Ability 激活状态。

#### Save Record

可序列化数据。

例如：

- 解锁 ID。
- RunSeed。
- 当前节点。
- 武器实例 ID 和词条 ID。
- 局外货币。

#### View Data

UI 展示数据。

例如：

- 武器名称。
- 图标。
- 当前属性文本。
- Tooltip。
- 可购买状态。

UI 不应直接保存 Gameplay 真源状态。

### 10.2 DataTable 与 PrimaryDataAsset

#### DataTable

适合：

- 大量批量数值。
- 权重表。
- 价格表。
- 掉落规则。
- 策划需要 Excel 编辑的数据。

#### PrimaryDataAsset

适合：

- 复杂资源引用。
- 软引用。
- 多态 Definition。
- 需要 Asset Manager 管理的内容。
- 房间、武器、敌人等复杂对象。

#### GameplayTag

适合：

- 分类。
- 状态。
- 条件。
- 过滤。
- 内容标签。

### 10.3 Stable ID

所有可进入存档或跨表引用的内容必须有稳定 ID。

禁止使用：

- 数组下标。
- UObject 内存地址。
- 显示名称。
- 中文名称。
- 可变路径作为唯一存档标识。

建议：

```text
Weapon.Revolver
Weapon.SMG
Chip.ChainReaction
Room.Combat.Wasteland.001
Enemy.Gunner.Basic
```

### 10.4 配置校验

打包前自动检查：

- ID 唯一。
- ID 引用有效。
- Soft Reference 有效。
- DataTable Row 完整。
- GameplayTag 已注册。
- 掉落权重合法。
- 房间存在出生点和出口。
- EnemyDefinition 有 ActorClass。
- 资源路径可加载。
- 存档字段可迁移。

---


# 4. GAS 与玩法驱动框架

本章对应问题：B1–B3。

## 4.1 GAS 的职责边界（B1）

### 4.1 GAS 不依赖 3D 骨骼角色

Gameplay Ability System 的核心由以下对象组成：

- `UAbilitySystemComponent`
- `UAttributeSet`
- `UGameplayAbility`
- `UGameplayEffect`
- `FGameplayTag`
- `UGameplayCue`
- `FGameplayEventData`

这些对象依赖的是 Actor 和 ActorComponent，而不是 SkeletalMesh 或 AnimMontage。因此 Paper2D Actor 可以正常使用 GAS。

GAS 可用于：

- 玩家和敌人的生命值。
- 基础攻击和伤害倍率。
- 射速、换弹速度、移动速度。
- 护甲、减伤和真实伤害。
- 格挡状态和格挡冷却。
- 觉醒资源和持续时间。
- 印记层数和衰减状态。
- Buff、Debuff、控制和免疫。
- Ability 激活和取消。
- 状态标签与互斥。
- 战斗事件。
- 表现触发。

### 4.2 建议替换原 AttributeComp 方案

原表提出：

```text
AttributeComp
ModifierList
AttrChanged Delegate
```

这相当于自行实现 GAS 的一个子集。

如果已经决定引入 GAS，应避免双轨制：

```text
GAS 管理部分属性
AttributeComp 管理另一部分属性
ModifierList 再管理 Buff
```

双轨会导致：

- 属性读取来源不唯一。
- Buff 顺序不一致。
- UI 监听两套事件。
- 存档和复制语义混乱。
- 词条不知道修改哪一层。
- 临时值和最终值难以追踪。

推荐使用：

```text
AbilitySystemComponent
├── CombatAttributeSet
├── WeaponAttributeSet
├── DefenseAttributeSet
└── ResourceAttributeSet
```

是否拆成多个 AttributeSet 应根据字段数量决定，不需要为了形式过度拆分。

### 4.3 GAS 的边界

GAS 应负责 Gameplay，不应负责所有游戏系统。

不建议放入 GAS 的内容：

- 节点地图图结构。
- 房间模板选择。
- 商店库存。
- Run 路径。
- 房间加载。
- SaveGame。
- 资源预加载。
- 配置数据管理。
- 纯 UI 页面导航。
- 音频总线和全局设置。

### 4.4 GameplayTag 规范

建议建立层次化标签：

```text
State.Player.Rolling
State.Player.Blocking
State.Player.Reloading
State.Player.Awakened
State.Player.Dead

State.Enemy.Elite
State.Enemy.Boss
State.Enemy.Dead
State.Enemy.Invulnerable

Ability.Player.Fire
Ability.Player.Reload
Ability.Player.Roll
Ability.Player.Block
Ability.Player.Counter
Ability.Player.Awaken

Event.Combat.Hit
Event.Combat.Damage
Event.Combat.Kill
Event.Projectile.Blocked
Event.Projectile.Reflected
Event.Room.Cleared

Damage.Projectile
Damage.Explosion
Damage.Reflected
Damage.True
Damage.Melee

Effect.Buff
Effect.Debuff
Effect.Cooldown
Effect.Mark
```

标签应该由统一表管理，不允许 Lua 和 Blueprint 随意拼接字符串。

---

## 4.2 Lua 与 GAS 的接口边界（B2）

### 6.1 不建议 Lua 直接操作复杂 Spec

GAS 内部对象包括：

- `FGameplayEffectSpec`
- `FGameplayEffectContextHandle`
- `FGameplayAbilitySpec`
- `FGameplayEventData`
- Prediction Key 等。

这些对象对 Lua 暴露过深会导致绑定复杂、版本敏感和生命周期不清。

建议 C++ 提供稳定 Facade：

```cpp
ApplyEffectById(Target, EffectId, Context);
RemoveEffectByHandle(Handle);
GrantAbilityById(AbilityId);
RemoveAbilityById(AbilityId);
AddLooseTag(Tag);
RemoveLooseTag(Tag);
HasTag(Tag);
SendGameplayEvent(Tag, Payload);
GetAttribute(AttributeId);
SetBaseAttribute(AttributeId, Value);
```

Lua 使用：

- Stable ID。
- GameplayTag。
- 轻量 Payload。
- UObject 弱引用或框架包装引用。

### 6.2 Lua Ability 的推荐方式

存在三种路线。

#### 路线 A：Ability 类主要写 C++

优点：

- 最稳定。
- GAS 支持最好。
- 调试和性能最好。

缺点：

- 业务迭代慢。
- 需要频繁编译。

#### 路线 B：Ability 类写 Blueprint，Lua 调用

优点：

- 接近 GAS 原生工作流。
- PaperZD 资源装配方便。

缺点：

- 复杂业务会分散在 Blueprint 和 Lua。
- 热重载边界不清。

#### 路线 C：C++ Ability Shell + Lua 业务

推荐作为优先评估方向。

```text
UGameplayAbility_LuaBase
├── ActivateAbility → Lua OnActivate
├── EndAbility → Lua OnEnd
├── CancelAbility → Lua OnCancel
└── AbilityTask 仍由 C++ 提供
```

这样 GAS 生命周期由 C++ 保证，具体业务由 Lua 编排。

需要验证当前 Lua 框架是否能稳定继承和覆写 GameplayAbility。

---

## 4.3 GAS 与 PaperZD 的动画适配（B3）

### 5.1 主要问题

GAS 自带的常见流程大量依赖：

- AnimMontage。
- SkeletalMesh。
- AnimNotify。
- Root Motion。
- `AbilityTask_PlayMontageAndWait`。

PaperZD 使用自己的动画状态机和动画序列，因此 GAS 的属性、效果、标签和事件可以直接使用，但动画驱动流程不能直接照搬 Montage 方案。

### 5.2 推荐适配层

建议开发以下自定义 AbilityTask：

```text
UAbilityTask_PlayPaperZDAnimation
UAbilityTask_WaitPaperZDNotify
UAbilityTask_WaitAnimationState
UAbilityTask_WaitFacingDirection
UAbilityTask_WaitProjectileHit
UAbilityTask_WaitInputRelease2D
```

典型流程：

```text
GameplayAbility 激活
    ↓
创建 PlayPaperZDAnimation Task
    ↓
通知 PaperZD 播放动画
    ↓
等待 Notify / 完成 / 中断
    ↓
在 Notify 时执行发射、位移或判定
    ↓
结束 Ability
```

### 5.3 动画状态与 Ability 状态的关系

不建议让 PaperZD AnimBP 自己决定 Gameplay 状态。

推荐：

```text
GAS / GameplayTag 是状态真源
PaperZD AnimBP 根据状态真源选择动画
```

例如：

```text
State.Player.Reloading
```

由 Ability 添加和移除，AnimBP 只是读取该状态并播放对应动画。

这样避免：

- 动画播放了但 Ability 未激活。
- Ability 结束了但动画状态仍未退出。
- Lua 和 AnimBP 各自维护一个“正在换弹”布尔值。
- 中断流程无法统一。

---

---


# 5. 玩家角色与 3C

本章对应问题：F1–F6、G1–G2、H3–H4。

## 5.1 Paper2D 坐标、碰撞与角色资产规范（F1–F4）

### 15.1 必须冻结世界平面

需要确定游戏逻辑运行在：

- XY 平面，Z 作为深度。
- 或 XZ 平面，Y 作为深度。

这一选择影响：

- CharacterMovement。
- NavMesh。
- 重力。
- Camera。
- ProjectileMovement。
- Sprite 朝向。
- TileMap 碰撞。
- 鼠标射线转换。
- 排序轴。

不能在项目中混用。

### 15.2 逻辑平面与视觉深度隔离

所有 Gameplay 计算应限制在二维平面：

- 移动方向。
- 射击方向。
- 距离。
- AI 追踪。
- 爆炸半径。
- 格挡扇区。

视觉深度仅用于排序，不参与 Gameplay 距离。

### 15.3 碰撞规范

需统一 Collision Channel：

```text
Player
Enemy
PlayerProjectile
EnemyProjectile
WorldStatic
Pickup
Interactable
BlockField
Trigger
```

需要明确：

- 玩家是否使用 Capsule。
- 敌人是否使用 Capsule 或 Box。
- 弹丸碰撞形状。
- TileMap Collision Thickness。
- Projectile 是否 Sweep。
- 高频弹丸是否启用子步进。
- 格挡区域使用 Shape Query 还是独立 Collision Component。
- Hit 与 Overlap 的分工。

### 15.4 像素与世界单位

需要确定：

- Pixel Per Unit。
- Sprite Pivot。
- 角色脚底锚点。
- Tile 尺寸。
- 角色碰撞尺寸。
- 摄像机 Ortho Width。
- 目标分辨率。
- 是否 Pixel Perfect。
- Sprite 缩放是否允许非整数。

这些参数应形成项目规范，不应由每个美术资源单独决定。

---

## 5.2 深度排序与遮挡（F3）

俯视角 Paper2D 必须解决脚底排序。

建议：

- 使用角色脚底世界坐标作为排序依据。
- Sprite Pivot 统一放在脚底。
- 设置统一 Translucency Sort Axis。
- 将地面、角色、墙前景、特效和 UI 分层。
- 墙体需要前景遮挡或透明处理。
- 武器 Sprite 与角色 Sprite 可能需要独立层级。
- 世界空间血条不参与角色深度排序。

建议定义逻辑层：

```text
Ground
GroundDecoration
Pickup
Actor
Projectile
ActorForeground
VFX
WorldUI
```

如果动态排序不足，应提供自定义 SortingPriority 计算。

---

## 5.3 输入与瞄准（F5–F6）

需要确认 UE4 版本对 Enhanced Input 的支持情况。

输入应抽象为 Action：

```text
Move
Aim
Fire
Reload
Roll
Block
Interact
Awaken
Pause
```

输入层不直接写业务，应调用 Ability 或 Gameplay Command。

需要处理：

- 键鼠。
- 手柄。
- 输入缓冲。
- 按下、保持、释放。
- UI 输入模式切换。
- Pause 时输入。
- Ability 阻塞。
- 按键重绑定。

格挡和反击如果共用按键，需要由当前 GameplayTag 和 Ability 状态决定，而不是 Input Component 中写业务分支。

---

---

## 5.4 武器、弹丸与命中框架（G1–G2）

### 17.1 上层统一，底层分型

推荐统一输入：

```cpp
struct FShotSpec
{
    FVector2D Origin;
    FVector2D Direction;
    float Range;
    float Speed;
    int32 ProjectileCount;
    float Spread;
    FGameplayTagContainer Tags;
    FDamageSpec Damage;
};
```

执行器：

```text
IShotExecutor
├── HitscanExecutor
└── ProjectileExecutor
```

### 17.2 Hitscan

适合：

- 即时命中武器。
- 超高速子弹。
- 不需要弹反和空间运动的攻击。

流程：

```text
Fire
→ LineTrace / ShapeTrace
→ HitContext
→ DamageSpec
→ GameplayEvent
```

### 17.3 Projectile

适合：

- 可见飞行。
- 弹跳。
- 追踪。
- 穿透。
- 弹反。
- 格挡吸收。
- 敌方弹幕。

### 17.4 高速 Projectile 模拟 Hitscan

技术上可行，但需关注：

- 单帧跨越目标。
- Continuous Collision。
- Sweep。
- ProjectileMovement 子步进。
- 高速反射误差。
- 每帧 Tick 开销。
- 对象池重置。
- 弹丸寿命和边界销毁。

因此不建议为了统一外观强制所有射击都使用高速实体弹丸。

### 17.5 HitContext

不论 Hitscan 还是 Projectile，都应统一产生：

```cpp
struct FHitContext
{
    AActor* Source;
    AActor* Target;
    FVector HitLocation;
    FVector HitNormal;
    FGameplayTagContainer DamageTags;
    bool bCritical;
    bool bReflected;
    int32 PenetrationIndex;
};
```

后续伤害、吸血、印记、词条和特效都从 HitContext 派生。

---

## 5.5 相机系统（H3）

原方案仅写“原生 Camera 组件”不足。

相机需要负责：

- 跟随。
- 平滑。
- 鼠标瞄准方向偏移。
- 房间边界。
- Boss 房缩放。
- 屏幕震动。
- Hit Stop 表现。
- 低血量效果。
- 分辨率适配。
- Ortho Width。
- 相机外弹丸清理边界。
- Pixel Perfect 或整数缩放。

建议：

```text
APlayerCameraManager
+ CameraRig Actor
+ Room CameraBoundary
```

不要让玩家 Character 自己处理所有房间相机规则。

---

## 5.6 玩家动画与反馈状态投影（H4）

玩家动画、Sprite、局部 VFX、音频、相机反馈与后处理统一从 Gameplay 状态和事件读取，不反向保存玩家业务状态。具体 GAS—PaperZD 适配见 4.3；时间和全局表现服务见第 11 章。


# 6. 怪物与战斗遭遇

本章对应问题：G5–G6。

## 6.1 AI、导航与 Encounter 分层（G5–G6）

### 19.1 可选技术路线

#### UE 原生路线

- AIController。
- Behavior Tree。
- Blackboard。
- NavMesh。
- EQS。

#### 轻量路线

- Lua 状态机。
- Steering。
- Line of Sight。
- 房间网格寻路。
- 简单避障。

### 19.2 推荐方向

当前敌人数量和类型有限，建议：

```text
AIController
+ C++ 感知和移动接口
+ Lua 状态机或简化 Behavior Tree
+ NavMesh 或房间网格
```

不一定需要完整 EQS。

### 19.3 必须验证的问题

- Paper2D CharacterMovement 是否与 NavMesh 正常配合。
- 逻辑平面是否导致 NavMesh 投影问题。
- TileMap Collision 是否参与 NavMesh。
- 远程敌人是否需要找射击位。
- 动态障碍是否影响导航。
- 分裂怪生成点是否合法。
- Boss 是否使用专用状态机而非通用 BT。

### 19.4 AI 不应自行判断房间完成

敌人死亡只上报 EncounterController，由 EncounterController 判断是否清场。

---


# 7. Run 与关卡流程

本章对应问题：D6–D10、E1–E3。

## 7.1 Seed 流与可复现性（D8–D10）

### 11.1 统一 RunSeed

肉鸽项目必须支持复现。

禁止：

- `FMath::Rand()`。
- Blueprint Random 节点随意调用。
- Lua `math.random()`。
- 特效随机和 Gameplay 随机共用同一序列。

建议：

```text
RunSeed
├── MapRandomStream
├── RoomRandomStream
├── DropRandomStream
├── ShopRandomStream
├── EventRandomStream
├── EnemyRandomStream
└── CombatRandomStream
```

每个随机流由 RunSeed 和固定 Salt 派生。

### 11.2 拆分随机流的原因

如果所有系统共用一个随机流，则新增一次特效随机可能改变后续商店和地图结果。

拆流后可以：

- 复现 Bug。
- 固定地图但更换掉落。
- 自动测试。
- 打印随机过程。
- 将来支持分享 Seed。
- 防止表现逻辑污染 Gameplay。

### 11.3 随机日志

开发模式建议记录：

```text
RunSeed
StreamName
RollIndex
InputRange
Result
Caller
```

无需正式版本全量保留，但调试版本应可开启。

---

---

## 7.2 节点地图与房间关卡的关系（D6–D7）

### 12.1 问题定义

本轮讨论首先对“节点地图”和“关卡生成”的关系进行了重新界定：

- 节点地图不是另一种战斗地图，而是多个单房间关卡组成的拓扑。
- 节点负责表达一局中的路线、连接和推进状态。
- 房间负责提供玩家实际进入并完成战斗、事件或奖励流程的空间。

因此，两者属于同一套 Run 关卡系统的两个层级：

```text
节点拓扑
    ↓ 选择当前节点
房间内容单元
    ↓ Streaming 加载
房间内 Gameplay
```

节点图不依赖 Paper2D TileMap 或场景对象。场景对象被卸载后，节点推进状态仍由 Run 层持有。

### 12.2 本轮没有冻结的内容

本轮只确定技术架构，不替代策划设计。以下问题仍由后续关卡与肉鸽设计决定，不阻塞当前架构：

- 整张节点图何时生成。
- 玩家能看到多少未来节点信息。
- 商店、事件、精英等节点的数量和连续限制。
- 节点何时绑定具体房间模板。
- 路线是否汇流、每层节点数和分叉数量。
- 失败、重试和具体随机复现规则。

这些参数会影响生成规则，但不会改变“独立拓扑数据 + Streaming 房间单元”的总体架构。

### 12.3 已确定的数据边界

节点地图至少需要独立保存：

- 节点标识。
- 节点类型。
- 节点之间的连接。
- 当前是否可进入、已完成或已跳过。
- 与当前节点对应的房间内容引用或选择条件。

具体字段、生成算法和 UI 布局规则后续再确定。节点地图 UI 只读取和显示拓扑，不负责生成或修改拓扑。

---

## 7.3 战斗空间生产方案的决策过程（E1）

### 13.1 候选方向

讨论中对比了两类主要方案。

#### 方案一：完整运行时程序化生成

运行时生成 Tile、墙体、障碍、出入口和战斗空间结构。

潜在优势：

- 理论变化量较大。
- 可以减少手工制作完整房间的数量。

主要代价：

- 需要额外建立空间生成、连通性、碰撞、出生安全和战斗可读性验证体系。
- 射击、弹幕和格挡对距离、视野、障碍与生成点关系敏感，生成结果“不同”不等于“可玩”。
- 策划和美术难以直接对一个确定空间进行细致调试。
- 项目周期与团队规模不足以支撑完整生成工具链和长期调参。

#### 方案二：小关卡模板为主，辅以有限随机化

由策划和美术手工制作完整战斗空间，运行时只选择房间并向预设位置填充内容。

房间资产中不必写死每次出现的具体敌人或奖励，而是布置职责明确的语义标记，例如：

- 玩家入口和出口。
- 遭遇触发区域。
- 敌人生成点或生成区域。
- 奖励和宝箱 POI。
- 可选机关、障碍和可破坏物插槽。
- 相机边界与战斗边界。

运行时可以在这些合法位置中决定：

- 敌人组合和生成位置。
- 奖励内容。
- 是否启用某些局部机关或障碍。
- 少量房间规则变化。

讨论中进一步确认，这并不是一种特殊的“程序化房间生成技术”，而是常规手工关卡工作流的数据驱动版本：空间由关卡作者保证，具体刷新内容由触发器和 POI 延迟注入。

### 13.2 判断依据

最终选择主要基于以下因素：

- **战斗质量：** 手工房间更容易保证射击距离、弹幕可读性、格挡空间和敌人出生安全。
- **内容验证：** 策划和美术可以直接打开并运行单个房间，不依赖完整 Run 流程。
- **团队效率：** 不需要先建设程序化空间生成器和大量自动验证工具。
- **职责解耦：** 房间空间、遭遇内容和节点拓扑可以分别生产和迭代。
- **有限随机性已经足够：** 房间选择、敌人组合、POI 和局部开关可以提供变化，不必随机生成整个空间。
- **Agent 友好：** Agent 可以修改拓扑规则、遭遇配置和内容填充逻辑，而无需自动生成复杂二进制关卡资产。

### 13.3 排除和保留的方向

本版本排除：

- 完整逐 Tile 的运行时程序化战斗空间生成。
- 将大量模块 Chunk 拼接作为首版房间生产的主路线。
- 在一个大关卡中预放全部房间并通过显隐切换。

模块化 Chunk 并非永久禁止。如果后续手工房间数量成为明确生产瓶颈，可以作为提高变化度的增量方案重新评估，但它不进入首版架构基线。

---

## 7.4 Streaming 房间组织与生命周期（E2–E3）

### 14.1 最终架构结论

关卡系统采用：

> **独立节点拓扑 + 手工小关卡模板 + Streaming 加载 + 房间内有限随机化。**

其职责关系为：

```text
节点拓扑
    决定路线和当前目标

房间选择逻辑
    从满足节点条件的模板中选择内容单元

Streaming 管理
    加载当前房间并卸载上一房间

房间流程
    管理进入、遭遇、完成、奖励和离开

内容填充逻辑
    在触发器、生成区域和 POI 上注入本次敌人、奖励与局部变化
```

### 14.2 房间加载粒度

每个手工小关卡是一个独立的 Streaming 内容单元，而不是：

- 把整局所有房间同时放在一个大场景中；
- 把一个战斗房间拆成大量运行时自由拼接块；
- 把房间仅做成普通 Actor 后附着大量子对象。

具体使用 UE5.8 中哪一种 Streaming 资产形式和 API，可以在实施 PoC 中确定；但“独立小关卡作为加载单元”的架构边界已经确定。

### 14.3 不可返回带来的简化

团队已经确定已完成节点不可返回。因此：

- 进入下一节点后可以卸载上一房间。
- 不需要长期保留旧房间中的敌人、掉落、可破坏物和机关状态。
- 不需要为自由回溯建立房间快照恢复系统。
- 奖励是否已结算、节点是否完成等事实仍保存在 Run 层，而不是依赖场景对象存在。

不可返回并不自动决定失败重试规则；如果未来允许重试当前房间，需要单独定义当前房间的重置边界，但不会改变 Streaming 房间架构。

### 14.4 当前结论与后续设计的边界

已形成技术结论：

- 节点地图是独立拓扑数据。
- 手工小关卡是战斗空间的主要生产单位。
- 房间通过 Streaming 按当前节点加载和卸载。
- 房间内部通过触发器、生成区域和 POI 进行有限随机化。
- 已完成节点不可返回。
- 不做完整运行时程序化战斗空间生成。

仍待策划设计或实现 PoC 决定：

- 节点图具体生成规则。
- 房间与节点具体绑定时机。
- 房间内允许随机化的内容范围。
- UE5.8 下最终采用的 Streaming API 与编辑器工作流。

---

---


# 8. 掉落、奖励与局内物品

本章对应问题：G7，并引用 G3–G4 的公共对象池契约。

## 8.1 掉落解析与世界拾取（G7）

原方案中“DropItemWorldSubsystem + IDropable + 掉落代理 Actor”的方向需要调整。

### 25.1 数据与表现分离

推荐流程：

```text
DropRequest
    ↓
DropResolver
    ↓
RewardSpec
    ↓
RewardSpawner
    ↓
World Pickup Actor
```

#### RewardSpec

纯数据：

- Item ID。
- 数量。
- 品质。
- 词条。
- Source。
- Spawn Rule。
- Seed。

#### World Pickup

只负责：

- 世界表现。
- 碰撞。
- 拾取。
- 超时。
- 吸附。
- 回收对象池。

不需要包装一个“原始可掉落 Actor”。

### 25.2 生命周期

- 掉落解析属于 Gameplay/Run 规则。
- 世界掉落实例属于当前 Room。
- 离开 Room 时由 Room 或 Pool 回收。
- 拾取后将数据交给 Run Inventory。

---

---


# 9. UI 与交互界面

本章对应问题：H5–H6。

## 9.1 UI 数据驱动与生命周期（H5–H6）

### 9.1.1 讨论目标

本轮讨论聚焦两个问题：

1. UE 自带 UMG MVVM 是否应成为项目默认 UI 框架；
2. Lua UI 层需要建设到什么程度，才能满足数据驱动、快速迭代和 Agent 友好的要求。

### 9.1.2 已讨论方案

#### 方案一：全面采用 UE UMG MVVM

UE MVVM 可以提供 ViewModel、FieldNotify 和编辑器绑定能力，适合字段稳定、界面复杂、多控件共享同一展示状态的场景。

但其标准工作流通常要求由 C++ 或 Blueprint 定义可反射的 ViewModel 字段。对本项目而言，这意味着新增或修改 UI 字段可能需要修改 C++ Schema、重新编译 Editor 模块并重新分发二进制，与“Lua 优先、脚本改完即可验证”的目标冲突。Lua 和 TypeScript 可以调用已有 ViewModel 的 Setter，但不适合直接动态定义 UE 可识别的 FieldNotify 字段。

因此，UE MVVM 可以作为局部工具，但不适合作为当前项目的默认基础框架。

#### 方案二：Lua 侧实现完整响应式 UI 框架

Lua 可以自行实现 Observable State、字段绑定、依赖追踪、Dirty Queue、Computed、双向绑定等机制，从功能上复现 MVVM 的主要目的。

但当前项目没有证据表明需要完整响应式框架。提前建设这套能力会增加框架维护、调试和学习成本，并可能演变成自研前端框架。

因此，不采用“先完整复刻 MVVM”的方案。

#### 方案三：Lua 薄绑定层

Lua 仅负责：

- 获取 Widget 引用；
- 基础 Getter / Setter；
- 订阅和解绑状态变化；
- 界面创建、显示、隐藏和销毁；
- 必要的统一 UI Ticker；
- 将 Gameplay 数据转换为控件需要的展示格式。

简单界面直接更新控件；只有复杂度真实出现后，才局部增加 Observable、字段绑定或中间状态对象。

### 9.1.3 GAS 与 HUD 的连接方式

HUD 不需要额外复制一份 Gameplay 状态。GAS 已经为角色属性和状态提供变化通知：

```text
GAS Attribute / GameplayTag / GameplayEffect
        ↓
Lua UI 逻辑订阅变化
        ↓
UMG Widget
```

适合由 GAS 直接驱动的内容包括：

- 生命、护盾、能量等 Attribute；
- Buff、Debuff、无敌、眩晕和死亡等 GameplayTag；
- GameplayEffect 生命周期；
- Ability 冷却和状态。

非 GAS 数据仍由对应 Gameplay 系统提供同类的变化通知，例如背包、商店、节点地图、Run 进度和结算统计。不要为了统一 UI 接口而把所有状态强行塞入 GAS。

### 9.1.4 刷新策略

UI 刷新分为两类：

- **事件刷新**：适用于属性变化、物品增删、商店库存、节点开放、Buff 增删和界面打开时的完整刷新；
- **Ticker 刷新**：适用于冷却进度、倒计时、血条缓动、准星、世界坐标跟随和数字滚动等连续表现。

当前只要求提供统一 Ticker 的注册和注销能力，不预先建设复杂的多频率调度或响应式依赖图。后续存在明确性能问题时再扩展。

### 9.1.5 UMG、Lua 与 Blueprint 边界

- **UMG**：负责控件树、布局、视觉资源和 Widget Animation；
- **Lua**：负责界面逻辑、数据读取、刷新、按钮响应和生命周期；
- **Gameplay 系统**：持有真实状态并处理命令；
- **Blueprint Event Graph**：不承载业务逻辑。

UI 到 Gameplay 的写入统一采用命令或公开接口，不通过双向绑定直接修改 Gameplay 状态。

### 9.1.6 生命周期约束

Lua UI 层需要统一处理：

- Widget 创建与 Lua 对象绑定；
- Show / Hide；
- Gameplay 与 UI 输入模式切换；
- 暂停状态和焦点；
- GAS、Gameplay 事件与 Delegate 的订阅；
- Ticker 注册；
- Hide 或 Destroy 时的解绑与注销；
- 房间切换和 PIE 结束时避免残留回调。

监听的自动解绑比是否采用 MVVM 模式更重要，是首版必须保证的基础能力。

### 9.1.7 最终结论

> 不将 UE UMG MVVM 作为全局默认 UI 框架。Lua 侧先提供最薄的 UI 绑定、Getter / Setter、事件订阅、生命周期和 Ticker 能力。HUD 直接订阅 GAS 的属性、Tag 和 Effect 变化，其他 UI 订阅对应 Gameplay 系统事件；只有当复杂界面确实出现多视图共享状态、复杂筛选或大量独立 UI 状态时，再局部增加响应式绑定或采用 UE MVVM。

该方案优先保证：

- Lua 修改后可立即验证；
- 不因新增 UI 字段频繁修改 C++ Schema；
- Agent 能直接读取和修改文本逻辑；
- 不提前承担完整 MVVM 框架的建设成本。

---


# 10. 数据、配置与内容生产

本章对应问题：D3–D5。运行时数据模型见 3.5。

## 10.1 内容定义体系（D3）

DataTable、PrimaryDataAsset、GameplayTag、软资源引用与 Stable ID 的具体职责沿用 3.5 中“数据与内容定义架构”的结论。后续本章将专门补充 Excel/Lua/DataAsset 的导入链路、编辑器校验和 Cook 前验证。

## 10.2 内容导入与生成链路（D4）

**状态：未回答。** 需要后续确定策划 Excel、Lua 配置、DataTable/DataAsset 与运行时 Definition 的生成和更新流程。

## 10.3 内容校验（D5）

**状态：部分回答。** 当前已经明确需要校验 Stable ID、跨表引用、软引用、GameplayTag、房间模板和资源可加载性；具体工具和执行时机仍待确认。


# 11. 存档与局外状态

本章对应问题：I1–I2。

## 11.1 存档架构与版本兼容（I1–I2）

### 26.1 存档分类

#### MetaSave

- 局外货币。
- 解锁内容。
- 永久成长。
- 设置。
- 统计。

#### RunSave

可选：

- RunSeed。
- 当前节点。
- RunInventory。
- 武器实例。
- 当前生命。
- 随机流位置。
- 已完成节点。

是否支持中途保存待确认。

### 26.2 版本

```cpp
int32 SaveVersion;
```

读取时：

```text
Load
→ 校验版本
→ 迁移
→ 补默认值
→ 校验引用
→ 使用
```

### 26.3 原子写入

推荐：

```text
写临时文件
→ 校验成功
→ 替换正式文件
→ 保留备份
```

处理：

- 写入中断。
- 存档损坏。
- ID 已删除。
- 字段新增。
- 开发版本清档。

---

---


# 12. 公共运行时基础设施

本章对应问题：G3–G4、E4、H1–H2、H7。

## 12.1 对象池与复用契约（G3–G4）

### 18.1 需要池化的对象

- 玩家弹丸。
- 敌人弹丸。
- 命中特效。
- 爆炸特效。
- 飘字。
- 掉落物。
- 骨片。
- 临时 AudioComponent。
- 临时范围判定 Actor。

### 18.2 推荐架构

```text
UActorPoolSubsystem
    PoolKey → FActorPool
```

对象实现接口：

```text
OnAcquireFromPool
OnReleaseToPool
ResetPoolState
```

池化对象回收时必须重置：

- Transform。
- 速度。
- Collision。
- Tick。
- Timer。
- Delegate。
- GameplayTag。
- Lua 状态。
- Owner/Instigator。
- VFX。
- Audio。
- 已命中目标集合。

对象池不应只是隐藏 Actor；必须完整重置状态。

---

## 12.2 资源加载与预热（E4）

### 24.1 Soft Reference

配置中涉及的 Sprite、Flipbook、音频、特效、Room Level 等应使用 Soft Reference，避免启动时加载全部资源。

### 24.2 AssetLoadSubsystem

负责：

- 异步加载。
- 加载句柄。
- 取消。
- 缓存。
- 房间预加载。
- 对象池预热。
- 加载失败回退。
- Loading 状态。

### 24.3 预加载策略

进入节点前可以预加载：

- 房间 Level。
- 房间敌人资源。
- 房间专属特效。
- 当前可能掉落的物品图标。
- Boss 音频。

避免首次出现敌人或首次开枪产生卡顿。

---

---

## 12.3 时间控制（H1–H2）

格挡和命中反馈涉及：

- Hit Stop。
- 全局慢放。
- 局部慢放。
- UI 不受慢放。
- 音频 Pitch。
- 连续请求叠加。
- Pause。
- Camera Shake。

建议：

```text
UGameTimeSubsystem
```

统一管理时间请求：

```cpp
RequestHitStop(Duration, Priority);
RequestTimeScale(Scale, Duration, Priority);
CancelTimeRequest(Handle);
```

必须定义：

- 多个慢放请求如何合并。
- 高优先级是否覆盖低优先级。
- 玩家和敌人是否同速。
- Projectile 是否受影响。
- UI 和 Timer 使用哪种时间。
- 恢复时是否插值。

禁止业务代码直接互相覆盖 `GlobalTimeDilation`。

---

## 12.4 后处理与音效（H7）

### 27.1 决策过程

讨论中曾考虑为全屏后处理、相机反馈、音乐和音效分别建设项目级管理系统，用于处理触发、叠加、优先级、并发和跨房间状态。进一步梳理后认为，这会重复封装 UE 和 GAS 已有能力，并在项目尚未出现复杂协调需求时提前引入额外状态层。

UE 已经提供：

- Post Process Volume、Camera Post Process、Post Process Material 和动态材质参数；
- Camera Shake、Niagara、Sprite 材质等局部与相机表现能力；
- Sound Wave、Sound Cue、MetaSound、Sound Class、Sound Mix、Submix、Concurrency 和 Attenuation；
- 资产级持续时间、混合、并发、衰减和音频路由配置。

GAS 已经提供 GameplayCue，可由 GameplayAbility、GameplayEffect、GameplayTag 和 GameplayEvent 语义化触发角色表现、相机反馈、后处理和音效。

### 27.2 最终结论

后处理与音效**不建设项目级独立系统**，直接复用 UE 和 GAS：

- Gameplay 表现优先由 GameplayCue 触发；
- UI 音效和非 GAS 流程表现由对应 UI 或流程事件直接触发；
- 局部角色、武器和怪物表现由对应对象及其资产负责；
- 全屏后处理、相机反馈、音效并发、衰减、混音和分类优先通过 UE 原生资产与组件配置完成；
- 音乐、环境音和房间切换直接跟随 Run、房间或界面流程控制，不额外建立统一接管全部声音的 Audio Manager；
- 不建立万能 Presentation Manager，也不让 Lua 重复实现 UE 的混合、并发和音频路由。

只有当后续实际出现 UE 原生能力无法直接解决的跨效果互斥、复杂优先级或全局状态协调需求时，才针对具体问题补充最薄的一层协调逻辑。

### 27.3 选择依据

- 优先复用引擎和 GAS 的成熟能力；
- 避免为了统一命名而增加无实际状态所有权的中间系统；
- 表现资产可以由美术和音频人员直接调整验证；
- Lua 只负责业务触发和流程判断，不承担底层表现调度；
- 保持 Gameplay 与具体资源解耦，同时避免重复建设通用表现框架。

---

---


# 13. 工程支持

本章对应问题：J1–J7。

## 13.1 调试、验证与自动化（J1–J3）

### 28.1 开发命令

建议提供：

```text
SetRunSeed
PrintRunSeed
GenerateRunMap
JumpToNode
EnterRoom
CompleteRoom
SpawnEnemy
KillAllEnemies
GrantWeapon
GrantChip
GrantTrait
ApplyEffect
SetAttribute
ForceDrop
DumpASC
DumpGameplayTags
DumpRunState
ReloadLua
ReloadConfig
```

### 28.2 配置验证

编辑器或启动时检查：

- ID。
- 引用。
- 权重。
- GameplayTag。
- RoomDefinition。
- SpawnPoint。
- 资源。
- 存档迁移。

### 28.3 自动化测试

至少应覆盖：

- 同 Seed 节点图一致。
- 节点图必定可达。
- 房间选择不会超出标签约束。
- 掉落权重归一化。
- Save/Load 往返一致。
- 对象池重置无残留。
- Ability 中断后 Tag 清理。
- Room 清场后门解锁。
- Lua 热重载后旧回调释放。

---

## 13.2 性能架构与容量边界（J4–J5）

Paper2D 不代表没有性能风险。

重点关注：

- 大量 Projectile Tick。
- 碰撞 Sweep。
- Lua 高频调用。
- Translucent Sprite Overdraw。
- VFX 和屏幕粒子。
- UMG Tick。
- 动态文本和飘字。
- 房间加载。
- PaperTileMap 碰撞。
- 对象池状态重置。
- GAS Effect 数量和 Tag 查询。
- 音频并发。

建议性能规则：

- 禁止普通 Widget 每帧 Tick 更新数值。
- 禁止弹丸在 Lua 中逐帧处理运动。
- 高频命中路径尽量在 C++。
- 对象池提前预热。
- 数据表和软引用查询缓存。
- 不在战斗中同步加载资源。
- 不频繁 Spawn/Destroy 高频 Actor。

---

---

## 13.3 Cook、Shipping Build 与插件兼容（J6）

**状态：未回答。** 需要在确定 UE4、PaperZD 和 Lua 版本后形成独立验证矩阵。

## 13.4 模块接口与并行开发（J7）

**状态：部分回答。** 当前已有语言边界和宿主选择原则，仍需按团队分工冻结公共接口和依赖方向。


# 14. 现有技术方案评审

本章对应问题：K1。

## 14.1 原 UE4 技术方案逐项评审（K1）

### 30.1 2D 角色 3C

原方向：

```text
PaperZD + 2DCharacterMovement + EnhancedInput + Camera
```

方向基本正确，但需要补充：

- 具体 CharacterMovement 方案。
- 世界平面。
- 输入版本兼容。
- Ability 与移动状态关系。
- 相机边界。
- 2D 排序。
- 碰撞和 Sprite Pivot。

“UCharacterMovement2D 原生移动”这一命名需要核实，UE4 原生通常是 `UCharacterMovementComponent`，PaperZD 或项目插件可能提供扩展类。

### 30.2 武器系统

原方向：

```text
DataTable + Weapon + Projectile + ShootRule + Pool
```

可保留，但需要提升：

- `FShotSpec`。
- Hitscan/Projectile Executor。
- HitContext。
- WeaponDefinition / WeaponInstance / WeaponRuntime 分层。
- GAS Effect 与词条接入。
- 对象池统一管理。
- Lua 和 C++ 的职责边界。

### 30.3 背包系统

原方案：

```text
BackpackComp 管理武器、芯片
特质放 PlayerState
```

需要重构。

单机项目不需要沿用联网 PlayerState 语义。建议：

- 当前 Actor 操作状态在 Character/Component。
- RunInventory 在 RunContext。
- 局外解锁在 MetaProgress。
- UI 通过 Presenter 读取。

### 30.4 属性系统

原方案应由 GAS 替代，不再自研 ModifierList。

局外货币不应放入战斗 AttributeSet。

### 30.5 掉落系统

可保留 WorldSubsystem 或 Room 服务管理实例，但应改为：

```text
DropResolver → RewardSpec → RewardSpawner → Pickup
```

不使用掉落代理包装原 Actor。

### 30.6 芯片和词条

不单独讨论具体业务类。

技术上应通过：

- GameplayAbility。
- GameplayEffect。
- GameplayTag。
- Lua Hook。
- Definition/Instance。
- 标准战斗事件。

表达不同业务。

### 30.7 关卡生成

原表为空，是当前最大缺口之一。

首版方案：

- 自研节点图。
- 人工房间模板。
- Seed 选择。
- Streaming Level。
- RoomController。
- EncounterController。

### 30.8 UI/HUD

原表为空。

需补充：

- GAS 属性监听。
- GameplayTag 监听。
- Run Presenter。
- Lua Widget 生命周期。
- 输入焦点。
- 分辨率和像素规范。

### 30.9 后处理与音效

原表为空。

最终结论：不建设独立后处理或音频系统。玩法表现优先通过 GAS GameplayCue 触发，UI 与流程表现使用对应事件；后处理、Camera Shake、音效并发、混音、衰减和分类直接复用 UE 原生能力。只有出现明确的跨效果协调需求时才增加局部薄封装。

### 30.10 存档

原方案过于简单。

需增加：

- MetaSave/RunSave。
- SaveVersion。
- Migration。
- 原子写入。
- 损坏恢复。
- Stable ID。

### 30.11 数据表管理器

使用 GameInstanceSubsystem 方向正确，但应升级为 GameDataSubsystem，不局限于 DataTable。

### 30.12 EventManager

不建议作为所有 Delegate 的统一中转。

替换为：

- 直接调用。
- 局部回调。
- GAS GameplayEvent。
- Lua 领域消息。

---

---


# 15. 附录与实施管理

## 15.1 当前整体模块图
```text
GameInstance
├── GameDataSubsystem
├── SaveGameSubsystem
├── AssetLoadSubsystem
├── AudioSubsystem
└── MetaProgressSubsystem

World
├── RunSubsystem / RunManager
│   ├── RunContext
│   ├── RunMapGraph
│   ├── RunInventory
│   ├── RandomStreams
│   └── RunStatistics
│
├── RoomController
│   ├── RoomLogic
│   ├── EncounterController
│   ├── EnemySpawner
│   ├── RewardSpawner
│   └── DoorController
│
├── ActorPoolSubsystem
├── GameTimeSubsystem
└── CameraRig

Player
├── AbilitySystemComponent
├── AttributeSet
├── WeaponComponent
├── InteractionComponent
├── PaperZD Animation
└── Lua Gameplay

Enemy
├── AbilitySystemComponent
├── AttributeSet
├── AIController
├── PaperZD Animation
└── Lua Behavior
```

---

## 15.2 推荐实施顺序
### 阶段 1：技术验证

- UE4 + PaperZD + GAS 能否共存。
- Lua Ability Shell。
- 自定义 PaperZD AbilityTask。
- 2D 平面、碰撞和相机。
- Projectile 与格挡判定。
- NavMesh 或替代导航。
- Streaming Level 房间加载。

### 阶段 2：框架底座

- GameDataSubsystem。
- RunContext。
- RoomController。
- EncounterController。
- GameplayTag 规范。
- 对象池。
- RandomStream。
- AssetLoadSubsystem。
- SaveGameSubsystem。

### 阶段 3：垂直切片

- 一个房间。
- 一个玩家。
- 一种敌人。
- 一把武器。
- 一次 Ability。
- 一次格挡。
- 一次掉落。
- 一次房间完成。
- 一次节点选择。

### 阶段 4：业务并行

在框架接口稳定后，程序成员并行开发武器、敌人、房间、UI 和局外系统。

---

## 15.3 待确认问题清单
以下内容在确认前不应写死进最终方案：

1. UE4 精确版本。
2. PaperZD 精确版本。
3. Lua 框架。
4. GAS Ability 的主要脚本方式。
5. 逻辑平面。
6. CharacterMovement 实现。
7. Streaming Level 或 Level Instance。
8. NavMesh 或网格导航。
9. Pixel Perfect 需求。
10. 目标平台。
11. 目标分辨率。
12. 目标帧率。
13. 同屏最大敌人数。
14. 同屏最大弹丸数。
15. Run 是否支持中途存档。
16. 是否需要开发期 Lua 热重载。
17. 是否需要配置热重载。
18. UI 是否统一 Lua Presenter。
19. 是否需要 Seed 分享。
20. 是否需要回放或高光记录。

---

## 15.4 文档维护规则
后续每次讨论达成结论后，直接更新固定主文件 `BULLET_BONE_技术方案_讨论稿.md`。

Excel 只在需要面向全体成员同步阶段性结论时更新，不要求每次技术讨论都生成。

维护要求：

- Markdown 是完整、自包含、可直接交给程序团队使用的技术设计文档。
- 不依赖聊天记录才能理解。
- 每个方案说明推荐原因、UE 落点、边界和风险。
- 未确认内容明确标记为“待确认”。
- 被否决方案保留简要理由，避免后续重复讨论。
- Excel 用于策划案内的技术方案同步和项目执行查阅。
- Markdown 维护内部版本记录；Excel 仅在阶段性同步时标注对应技术方案版本。
- 原版策划 Sheet 不随意重排或删除。
- 普通迭代直接修改主文件并增加变更记录；仅在里程碑评审、对外同步或重大结构调整前另存快照。

---

---


# 16. 版本记录

## v1.1

- 将 H7 更新为“已回答”。
- 明确后处理与音效不建设项目级独立系统，直接复用 UE 原生表现、相机与音频能力。
- 明确 Gameplay 表现优先由 GAS GameplayCue 触发，UI 和非 GAS 流程表现由对应事件触发。
- 放弃统一 Camera Presentation、AudioSubsystem 或万能 Presentation Manager 的预设方案。
- 保留按需扩展原则：只有实际出现跨效果互斥、复杂优先级或全局状态协调需求时，才增加局部薄封装。
- 文档改为固定主文件持续更新；Excel 仅在阶段性面向全体成员同步时生成。

## v0.9

- 将“节点地图”和“关卡生成”统一为同一套 Run 关卡系统的两个层级：节点拓扑与可 Streaming 的单房间内容单元。
- 保留完整决策过程，对比完整运行时程序化生成与手工小关卡辅以有限随机化两类路线。
- 明确采用“独立节点拓扑 + 手工小关卡模板 + Streaming 加载 + 房间内有限随机化”。
- 明确房间内触发器、生成区域和 POI 属于常规关卡工作流的数据驱动内容填充，而非完整程序化房间生成。
- 排除首版逐 Tile 程序化生成、大量 Chunk 拼接作为主路线，以及整局房间预放在同一大关卡中的方案。
- 记录团队已确定的不可返回规则，以及它对房间卸载和状态恢复架构的简化。
- 将节点具体生成规则、节点信息可见度、房间绑定时机等保留为策划设计或实施细节，不再作为架构结论的阻塞项。

## v0.8

- 补充 A1 技术栈选型的完整决策支持材料，但保持 A1 为“部分回答”，等待团队意见与 PoC。
- 目标引擎由 UE4 待确认更新为 UE5.8。
- 明确 Lua 优先、Blueprint 零业务逻辑、C++ 按引擎约束与实际瓶颈下沉的项目原则。
- 补充 UnLua、sluaunreal、PuerTS/TypeScript 的比较和 UnLua 的 UE5.8 PoC 验收条件。
- 补充策划/美术无 C++ 编译环境的工作流：项目 Editor DLL 与 `.modules` 直接提交同一仓库。
- 补充 DataTable 与 Lua 配置的能力边界，并将最终配置划分保留给 D4 决策。

## v0.7

- 按游戏部分而不是底层技术名词重新聚类问题与正文。
- 一级章节调整为 Gameplay 基础框架、GAS 与玩法驱动、玩家 3C、怪物与 Encounter、Run 与关卡、掉落、UI、内容生产、存档、公共基础设施和工程支持。
- 保留 v0.6 问题编号作为稳定引用，只改变归属和正文位置。
- 将对象池、资源加载、时间控制和全局音频后处理统一归入公共运行时基础设施。
- 将运行时数据模型与内容生产管线拆分，避免 Data Model 与配置工具混为一谈。

## v0.6

- 将 56 个具体架构问题按游戏技术层级划分为 A–K 十一个问题组。
- 为每个问题增加稳定编号，例如 D6 表示“数据、内容配置与随机性”下的第六个问题。
- 重组全部答案正文，使正文一级章节与 A–K 问题组一一对应。
- 在每个答案章节中标注对应问题编号，并将原有专题内容归入相应问题组。
- 将整体模块图、实施顺序、待确认清单和维护规则移至独立附录，避免与架构答案混排。
- 后续迭代以问题编号为最小修改单元，不再依赖宽泛大标题定位内容。

## v0.5

- 为第一章 56 个具体架构问题增加“已回答 / 部分回答 / 未回答”状态。
- 状态根据后续章节当前实际覆盖程度判定，不以“是否提到”为标准。
- 增加状态定义，区分已经形成架构结论、只有候选方向以及尚未展开的问题。

## v0.4

- 重写第一章问题清单，采用“非业务、属于架构、足够具体、可独立决策”的筛选标准。
- 将原有宽泛问题域拆解为 56 个具体架构问题。
- 单独补充 Lua VM 与 UObject 生命周期、GAS/PaperZD 适配、Seed 流隔离、输入、时间域、相机、UI、弹丸、对象池、AI/Encounter、资源加载、房间切换、内容校验、运行时可观测性和 Shipping Build 等问题。
- 第一章仍只定义 What，不写实现答案。

## v0.3

- 重写第一章“文档目的”，将其严格限定为架构与技术问题域清单。
- 补充技术栈、模块分层、生命周期、宿主、通信、Gameplay、数据、内容、流程、关卡、资源、2D 世界、战斗基础设施、表现、持久化、随机、开发基础设施、性能和团队协作等问题域。
- 删除第一章中可能提前导向具体实现或业务异常处理的内容，具体技术决策继续留在后续章节。

## v0.2

- 将原 v0.1 提纲扩展为可独立使用的详细技术设计文档。
- 补充 GAS 与 Paper2D/PaperZD/Lua 的完整边界。
- 补充 Application、Run、Room、Encounter 和 Actor 分层。
- 补充节点地图和战斗房间生成方案。
- 补充数据、随机、对象池、弹丸、AI、相机、时间、UI、资源和存档架构。
- 补充原“UE4技术方案”的逐项评审。
- 补充模块图、实施顺序和待确认清单。
