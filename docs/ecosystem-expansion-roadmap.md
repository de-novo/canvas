# Denovo Canvas Ecosystem Expansion Roadmap

**Last updated:** 2026-07-17  
**Current Phase:** M3.1 Surface Placement and Stacking (verified)  
**Next Milestone:** M4 Performance Layer

## Executive Summary

This roadmap outlines the strategic expansion of Denovo Canvas from a core 2D/3D editing SDK into a comprehensive ecosystem spanning multiple frameworks, BIM capabilities, real-time collaboration, and third-party integrations. The strategy maintains the framework-agnostic core while building targeted adapters and extensions.

**Strategic Principles:**
1. Core stability over feature proliferation
2. Framework-agnostic contracts with thin adapters
3. Progressive disclosure: simple by default, powerful when needed
4. License hygiene: AGPL/heavy dependencies remain optional
5. Verification-driven development with measurable acceptance criteria

---

## 1. Framework Adapters (M5 Expansion)

### Current State
- ✅ React adapter (`@de-novo/react-canvas`) implemented and verified
- ✅ Framework-agnostic core/web packages support vanilla usage
- ✅ Next.js App Router example demonstrates React integration

### Expansion Plan

#### 1.1 Vue Adapter (Priority: HIGH)
**Timing:** M5.1 (immediately after M4 Performance Layer)  
**Duration:** 6-8 weeks  
**Team:** 1-2 Vue specialists + 1 core team member

**Scope:**
- `@de-novo/vue-canvas` package with Composition API
- Reactive canvas binding via `useCanvas()` composable
- Component-based declarative API (`<Canvas>`, `<Tool>`, `<Layer>`)
- Vue 3.3+ with TypeScript support
- Nuxt 3 integration example

**Technical Approach:**
- Leverage existing `@de-novo/canvas` facade
- Use Vue's `watchEffect` for reactive scene updates
- Implement proper cleanup in `onBeforeUnmount`
- Support DevTools integration

**Acceptance Criteria:**
- Vue example renders 2D/3D scenes equal to vanilla
- Reactive scene updates work without framework leaks
- Component lifecycle matches React adapter capabilities
- Documentation covers Nuxt SSR considerations

**Resource Requirements:**
- Vue 3.3+ expertise in reactivity system
- Nuxt 3 module development (for SSR example)
- Testing infrastructure (Vue Test Utils + Vitest)

---

#### 1.2 Svelte Adapter (Priority: MEDIUM)
**Timing:** M5.2 (concurrent with Vue adapter)  
**Duration:** 4-6 weeks  
**Team:** 1 Svelte specialist + 0.5 core team member

**Scope:**
- `@de-novo/svelte-canvas` package
- Svelte 5 runes mode support
- `useCanvas()` action directive
- Declarative component API
- SvelteKit integration example

**Technical Approach:**
- Use Svelte actions for canvas mounting
- Leverage `$state` for reactive scene updates
- Implement proper cleanup in reactive statements
- Support SvelteKit SSR with browser-only mounting

**Acceptance Criteria:**
- Svelte example achieves feature parity with Vue
- Runes-based reactivity works without memory leaks
- SvelteKit SSR example demonstrates proper hydration
- Performance matches vanilla facade benchmarks

**Resource Requirements:**
- Svelte 5 runes expertise
- SvelteKit SSR knowledge
- Testing infrastructure (Svelte testing library)

---

#### 1.3 Solid Adapter (Priority: MEDIUM)
**Timing:** M5.3 (after Vue adapter verification)  
**Duration:** 4-5 weeks  
**Team:** 1 Solid specialist + 0.5 core team member

**Scope:**
- `@de-novo/solid-canvas` package
- Solid 1.8+ with TypeScript
- `useCanvas()` primitive
- Component API using Solid JSX
- SolidStart integration example

**Technical Approach:**
- Implement Solid primitives for canvas lifecycle
- Use `createEffect` for reactive updates
- Leverage `onCleanup` for proper teardown
- Support SolidStart SSR

**Acceptance Criteria:**
- Solid example matches adapter capabilities
- Fine-grained reactivity doesn't cause excessive re-renders
- SolidStart example demonstrates SSR pattern
- Memory usage remains comparable to vanilla

**Resource Requirements:**
- SolidJS reactivity system expertise
- SolidStart knowledge for SSR example
- Testing infrastructure (Solid testing library)

---

#### 1.4 Astro Integration (Priority: HIGH)
**Timing:** M5.1 (concurrent with Vue adapter)  
**Duration:** 3-4 weeks  
**Team:** 1 Astro specialist + 0.5 core team member

**Scope:**
- Official Astro integration guide
- `@de-novo/canvas-astro` wrapper package
- Client-side only hydration patterns
- Multiple framework demo (React + Vue in same Astro site)
- Content Collections + Canvas examples

**Technical Approach:**
- Create Astro component wrapper for vanilla facade
- Document client-side loading patterns
- Provide framework-specific examples
- Support View Transitions for canvas navigation

**Acceptance Criteria:**
- Astro documentation covers all major frameworks
- Multi-framework demo proves isolation
- Client hydration pattern is documented
- Performance guidelines for large canvases

**Resource Requirements:**
- Astro 3+ framework islands expertise
- Client-side hydration patterns knowledge
- Documentation and example development

---

#### 1.5 Angular Adapter (Priority: LOW)
**Timing:** M5.4 (long-term, after other adapters verified)  
**Duration:** 8-10 weeks  
**Team:** 1 Angular specialist + 1 core team member

**Scope:**
- `@de-novo/angular-canvas` package
- Angular 17+ standalone components
- Service-based canvas management
- Reactive forms integration for property editing
- Angular Universal SSR example

**Technical Approach:**
- Implement as standalone component + service pattern
- Use Angular signals for reactive updates
- Integrate with Angular forms for tool properties
- Support dependency injection for extensibility

**Acceptance Criteria:**
- Angular example matches adapter feature set
- Signals-based reactivity works efficiently
- Angular Universal SSR demonstrates proper hydration
- Zone.js integration doesn't cause performance issues

**Resource Requirements:**
- Angular 17+ signals and standalone components expertise
- Angular Universal SSR knowledge
- RxJS patterns for complex interactions
- Testing infrastructure (Angular Test Bed)

---

### Framework Adapter Summary

**Timeline:**
- **Q4 2026:** Vue + Astro adapters (M5.1)
- **Q1 2027:** Svelte + Solid adapters (M5.2-5.3)
- **Q2 2027:** Angular adapter (M5.4)

**Total Resource Investment:** ~3.5 FTE months over 8 months

**Risk Factors:**
- SSR hydration complexity varies significantly by framework
- Framework reactivity models may expose memory leaks
- Adapter testing matrix grows exponentially

**Success Metrics:**
- All adapters pass feature parity verification
- Framework examples render identical 2D/3D scenes
- Memory usage within 20% of vanilla baseline
- Documentation covers each framework's idioms

---

## 2. BIM Extensions (M7)

### Current State
- ✅ `@de-novo/canvas-bim` package structure exists
- ✅ License policy documented (AGPL isolation)
- ✅ BIM contracts defined in architecture

### Expansion Plan

#### 2.1 web-ifc Integration (Priority: HIGH)
**Timing:** M7.1 (after M6 persistence/server)  
**Duration:** 10-12 weeks  
**Team:** 2 BIM specialists + 1 core team member + 1 WASM specialist

**Scope:**
- IFC file parsing via `web-ifc` (MPL-2.0)
- Incremental parsing in Web Workers
- Geometry conversion to Denovo scene graph
- IFC metadata extraction and indexing
- Property tree navigation
- IFC-specific validation

**Technical Architecture:**
```
┌─────────────────────────────────────┐
│   @de-novo/canvas-bim package        │
├─────────────────────────────────────┤
│ • IFCParser (Web Worker)            │
│ • GeometryConverter                 │
│ • MetadataIndexer                   │
│ • PropertyTree                     │
│ • IFCValidationSchema               │
└─────────────────────────────────────┘
           ↓ depends on
┌─────────────────────────────────────┐
│   web-ifc (MPL-2.0)                 │
│   three-mesh-bvh (MIT)              │
└─────────────────────────────────────┘
```

**Implementation Details:**

**Phase 1: Core Parsing (4 weeks)**
- Web Worker wrapper around `web-ifc`
- Incremental parsing with progress reporting
- Basic geometry extraction (slabs, beams, columns)
- IFC metadata schema definition
- Error handling for malformed IFC files

**Phase 2: Geometry Conversion (4 weeks)**
- Convert IFC geometries to Denovo 3D nodes
- Handle IFC placements and coordinate systems
- Instancing support for repeated elements
- Material property extraction
- Level-of-detail generation

**Phase 3: Metadata & Properties (4 weeks)**
- Property tree navigation UI
- IFC type hierarchy indexing
- Searchable property database
- Custom property extraction
- Classification system integration (OmniClass, Uniclass)

**Acceptance Criteria:**
- Load 100MB+ IFC files without blocking main thread
- Parse IFC 2x3, IFC4, IFC4.3 schemas
- Extract geometry with <5% deviation from source
- Property tree supports drill-down to leaf properties
- Incremental loading shows progress >10% intervals
- Memory usage scales linearly with file size

**Resource Requirements:**
- `web-ifc` expertise and WASM debugging
- Three.js geometry manipulation
- BIM domain knowledge (IFC schema, common workflows)
- Web Worker optimization patterns
- Large file handling (>500MB IFC files)

---

#### 2.2 xeokit Bridge (Priority: MEDIUM)
**Timing:** M7.2 (concurrent with web-ifc Phase 2)  
**Duration:** 8-10 weeks  
**Team:** 1-2 BIM specialists + 1 core team member

**Scope:**
- Optional `@de-novo/canvas-xeokit` adapter (AGPL-3.0 isolation)
- Separate viewer mode for xeokit-rendered scenes
- Shared selection/metadata contracts between web-ifc and xeokit
- XKT file format support (xeokit's optimized format)
- Hybrid mode: Denovo UI + xeokit rendering

**Technical Approach:**
```
┌─────────────────────────────────────┐
│   @de-novo/canvas-xeokit (AGPL-3.0)  │
├─────────────────────────────────────┤
│ • XeokitRendererRuntime            │
│ • XKTLoader                         │
│ • BIMModelExplorer                  │
│ • SectionPlaneTool                  │
└─────────────────────────────────────┘
           ↓ implements same
┌─────────────────────────────────────┐
│   CanvasBIMRuntime interface        │
│   CanvasMetadataProvider contract   │
└─────────────────────────────────────┘
```

**Key Design Decisions:**
- xeokit remains **optional and AGPL-isolated**
- Core canvas never imports AGPL code
- xeokit implements same BIM contracts as web-ifc
- Users explicitly opt into AGPL license via package choice
- Clear license documentation in README

**Acceptance Criteria:**
- xeokit package has zero AGPL license leakage to core
- Implements same `CanvasBIMRuntime` interface as web-ifc
- Loads XKT files with performance parity to xeokit standalone
- Section planes work on both web-ifc and xeokit models
- License boundaries are tested and verified

**Resource Requirements:**
- xeokit SDK expertise
- AGPL license compliance understanding
- Interface contract design for BIM abstraction
- Performance testing for large models

---

#### 2.3 Section Planes & Measurements (Priority: HIGH)
**Timing:** M7.3 (after web-ifc Phase 2 complete)  
**Duration:** 6-8 weeks  
**Team:** 1 BIM specialist + 1 core tools developer

**Scope:**
- Section plane tool for 3D models
- 2D section view generation
- BIM-specific measurement tools (wall thickness, slab depth)
- Dimension annotations
- Area/volume calculations
- Section plane persistence

**Technical Implementation:**
```typescript
interface CanvasSectionPlaneTool {
  // Create section plane
  createSectionPlane(position: Vector3, normal: Vector3): CanvasSectionPlane;
  
  // Generate 2D section
  generateSectionView(plane: CanvasSectionPlane): Canvas2DScene;
  
  // Section plane editing
  updateSectionPlane(id: string, position: Vector3, normal: Vector3): void;
  
  // Section annotations
  addSectionAnnotation(planeId: string, annotation: CanvasAnnotation): void;
}
```

**BIM-Specific Measurements:**
- Wall thickness (automatic from layer structure)
- Slab depth/height
- Beam/column dimensions
- Room area from boundaries
- Volume calculations
- Grid-based measurements

**Acceptance Criteria:**
- Section planes work on both web-ifc and xeokit models
- 2D section views are editable Denovo 2D scenes
- Measurements update in real-time during editing
- Section state persists in document
- Performance: <100ms to generate section from 10k element model

**Resource Requirements:**
- Computational geometry expertise (plane intersections)
- BIM measurement domain knowledge
- 2D/3D coordinate transformation
- Performance optimization for large models

---

#### 2.4 BIM-Specific Tools (Priority: MEDIUM)
**Timing:** M7.4 (after section planes)  
**Duration:** 8-10 weeks  
**Team:** 1-2 BIM specialists + 1 UX developer

**Scope:**
- Object isolation/hide/show by IFC type
- Element filtering by properties
- Color coding by category/property
- BIM tree explorer (IFC hierarchy)
- Property editing with validation
- Classification system integration
- Quantity takeoff tools
- 4D simulation (time/phasing)

**Tool Architecture:**
```typescript
// BIM Tree Explorer
interface CanvasBIMExplorer {
  // Navigate IFC hierarchy
  getIFCProjects(): IFCProject[];
  getIFCSites(projectId: string): IFCSite[];
  getIFCBuildings(siteId: string): IFCBuilding[];
  getIFCStoreys(buildingId: string): IFCStorey[];
  
  // Filter by properties
  filterByProperty(property: string, value: any): CanvasNode[];
  
  // Color coding
  applyColorCoding(scheme: ColorCodingScheme): void;
}

// Quantity Takeoff
interface CanvasQuantityTakeoff {
  calculateQuantities(filter: QuantityFilter): QuantityReport;
  exportToCSV(report: QuantityReport): string;
  generateSchedule(report: QuantityReport): ScheduleNode;
}
```

**Acceptance Criteria:**
- BIM explorer supports 10k+ element models
- Property filtering completes in <500ms
- Color coding supports custom schemes
- Quantity takeoff accuracy within 1% of source
- 4D simulation supports basic phasing (not full MS Project integration)

**Resource Requirements:**
- BIM domain expertise (Revit, ArchiCAD workflows)
- UI/UX for complex hierarchical data
- Performance optimization for large datasets
- Quantity calculation algorithms

---

### BIM Extension Summary

**Timeline:**
- **Q3 2027:** web-ifc integration (M7.1)
- **Q3 2027:** xeokit bridge (M7.2) - concurrent
- **Q4 2027:** Section planes & measurements (M7.3)
- **Q1 2028:** BIM-specific tools (M7.4)

**Total Resource Investment:** ~5 FTE months over 6 months

**Risk Factors:**
- IFC parsing complexity and edge cases
- AGPL license contamination risks
- Performance with 500MB+ IFC files
- xeokit/web-ifc coordination complexity

**Success Metrics:**
- Load 100MB IFC files in <10s
- Parse accuracy >95% for common schemas
- Memory usage <2GB for 500MB IFC file
- AGPL isolation verified by legal review
- Section plane generation <100ms

---

## 3. Collaboration Features (M6+)

### Current State
- ✅ Command-based editing foundation (M2)
- ✅ Undo/redo history (M2)
- ✅ Patch-based persistence planned (M6)
- ❌ No real-time collaboration yet

### Expansion Plan

#### 3.1 Real-Time Collaboration Architecture (Priority: HIGH)
**Timing:** M6.1 (after M5 adapters verified)  
**Duration:** 12-16 weeks  
**Team:** 2-3 collaboration specialists + 1 core team member

**Scope:**
- CRDT (Conflict-free Replicated Data Type) integration
- Operational Transformation (OT) fallback consideration
- Awareness/cursor display for remote users
- Presence indicators
- Conflict resolution UI
- Permission boundaries

**Technical Architecture:**
```
┌─────────────────────────────────────┐
│   @de-novo/canvas-collab package    │
├─────────────────────────────────────┤
│ • CRDTDocumentSync                 │
│ • PresenceManager                  │
│ • ConflictResolver                 │
│ • PermissionEnforcer               │
└─────────────────────────────────────┘
           ↓ uses
┌─────────────────────────────────────┐
│   Yjs (MIT) or Automerge (MIT)     │
│   WebSocket transport abstraction  │
└─────────────────────────────────────┘
```

**CRDT vs OT Decision:**
- **Primary choice:** Yjs CRDT (MIT license)
- **Rationale:** Better for concurrent editing, easier integration
- **Fallback:** OT if CRDT proves insufficient for complex 3D transforms

**Implementation Phases:**

**Phase 1: CRDT Integration (4 weeks)**
- Yjs integration with Denovo document
- Map Denovo commands to Yjs transactions
- CRDT type selection for scene graph
- Basic sync via WebSocket abstraction

**Phase 2: Presence & Awareness (4 weeks)**
- Remote user cursor display
- User selection highlighting
- Presence indicators (who's viewing)
- Typing/activity indicators
- User identity management

**Phase 3: Conflict Resolution (4 weeks)**
- Automatic conflict resolution for non-overlapping edits
- UI for manual conflict resolution
- "Last write wins" for property conflicts
- Spatial conflict detection (same node edited)

**Phase 4: Permissions (4 weeks)**
- Role-based access control
- Per-document permissions
- Edit/view/comment roles
- Permission boundary enforcement

**Acceptance Criteria:**
- 5 users can edit simultaneously without corruption
- CRDT sync completes in <200ms for typical edits
- Conflict resolution UI covers 90% of conflict cases
- Permission boundaries prevent unauthorized edits
- Presence updates show within 500ms

**Resource Requirements:**
- CRDT expertise (Yjs or Automerge)
- Real-time architecture (WebSocket, SSE)
- Conflict resolution algorithms
- Security/permissions implementation
- Testing infrastructure for concurrent operations

---

#### 3.2 Conflict Resolution System (Priority: HIGH)
**Timing:** M6.2 (concurrent with Phase 3 of collaboration)  
**Duration:** 4-6 weeks  
**Team:** 1 collaboration specialist + 1 UX developer

**Scope:**
- Automatic conflict resolution strategies
- Manual conflict resolution UI
- Conflict history/audit trail
- Merge preview
- Conflict prevention (locking, reservations)

**Conflict Types:**
1. **Non-overlapping edits** (different nodes): Auto-merge
2. **Property conflicts** (same node, different properties): Last write wins
3. **Structural conflicts** (same node, transform): Manual resolution
4. **Parent-child conflicts** (node moved + parent moved): Manual resolution
5. **Delete-edit conflicts** (node deleted + edited): Manual resolution

**Resolution UI:**
```typescript
interface ConflictResolutionUI {
  // Show conflict dialog
  showConflict(conflict: Conflict): ResolutionChoice;
  
  // Preview merge result
  previewMerge(choice: ResolutionChoice): CanvasDocument;
  
  // Apply resolution
  applyResolution(choice: ResolutionChoice): void;
  
  // Conflict history
  getConflictHistory(): ConflictEvent[];
}
```

**Acceptance Criteria:**
- Auto-merge covers 80% of conflicts
- Manual resolution UI covers remaining 20%
- Conflict history is auditable
- Merge preview is accurate
- Resolution time <30s average

**Resource Requirements:**
- UX design for conflict scenarios
- Algorithm implementation for auto-merge
- Audit trail infrastructure
- Performance testing for conflict detection

---

#### 3.3 Permission System (Priority: MEDIUM)
**Timing:** M6.3 (after core collaboration verified)  
**Duration:** 6-8 weeks  
**Team:** 1 security specialist + 1 backend developer

**Scope:**
- Role-based access control (RBAC)
- Resource-level permissions
- Permission inheritance
- Audit logging
- Authentication integration points
- Authorization middleware

**Permission Model:**
```typescript
interface CanvasPermission {
  // Resource types
  resource: 'document' | 'layer' | 'node' | 'tool';
  resourceId: string;
  
  // Permissions
  actions: ('view' | 'edit' | 'delete' | 'comment' | 'admin')[];
  
  // User/role assignment
  subject: {
    type: 'user' | 'role' | 'team';
    id: string;
  };
  
  // Inheritance
  inheritsFrom?: string;
}

interface CanvasPermissionCheck {
  can(user: User, action: string, resource: Resource): boolean;
}

interface AuditLogger {
  logPermissionCheck(check: PermissionCheck): void;
  logPermissionChange(change: PermissionChange): void;
  getAuditLog(filter: AuditFilter): AuditEntry[];
}
```

**Integration Points:**
- Auth0
- Firebase Auth
- NextAuth.js
- Custom JWT providers
- LDAP/Active Directory (enterprise)

**Acceptance Criteria:**
- Permission checks complete in <10ms
- Permission inheritance works correctly
- Audit log is tamper-proof
- Integrates with major auth providers
- Permission changes propagate in <1s

**Resource Requirements:**
- Security/permissions expertise
- Backend development for auth integration
- Audit log infrastructure
- Performance optimization for permission checks

---

#### 3.4 Audit Logging (Priority: MEDIUM)
**Timing:** M6.4 (concurrent with permission system)  
**Duration:** 4-6 weeks  
**Team:** 1 backend developer + 1 security specialist

**Scope:**
- Comprehensive audit trail
- Immutable log storage
- Query interface
- Compliance reporting
- Data retention policies
- Export capabilities

**Audit Events:**
- Document access (view, edit, delete)
- Permission changes
- Collaboration events (joins, leaves)
- Conflict resolutions
- Tool activations
- Command executions

**Storage Strategy:**
- Append-only log (immutable)
- Time-series database for queries
- Separate from document storage
- Configurable retention policies
- Export to CSV/JSON for compliance

**Acceptance Criteria:**
- All significant events are logged
- Audit log is tamper-proof
- Query interface supports common filters
- Export capability for compliance
- Performance: <50ms to log event

**Resource Requirements:**
- Time-series database expertise (InfluxDB, TimescaleDB)
- Security/compliance knowledge
- Performance optimization for write-heavy workloads

---

### Collaboration Summary

**Timeline:**
- **Q2 2027:** Core collaboration + CRDT (M6.1)
- **Q2 2027:** Conflict resolution (M6.2) - concurrent
- **Q3 2027:** Permission system (M6.3)
- **Q3 2027:** Audit logging (M6.4) - concurrent

**Total Resource Investment:** ~4 FTE months over 4 months

**Risk Factors:**
- CRDT complexity and edge cases
- Performance with 10+ concurrent users
- Conflict resolution coverage
- Permission system complexity
- GDPR/compliance requirements

**Success Metrics:**
- 10 users can edit simultaneously without corruption
- Sync latency <200ms for typical edits
- Conflict resolution covers 90% of cases
- Permission checks <10ms
- Audit log covers 100% of significant events

---

## 4. Cross-Framework Mobility

### Current State
- ✅ Framework-agnostic core (M0)
- ✅ Document schema is renderer-independent
- ✅ React adapter exists (M5 partial)
- ❌ No cross-framework import/export yet

### Expansion Plan

#### 4.1 State Serialization (Priority: HIGH)
**Timing:** M6.5 (concurrent with collaboration)  
**Duration:** 6-8 weeks  
**Team:** 1 core team member + 1 serialization specialist

**Scope:**
- Canonical JSON serialization format
- Binary serialization option (MessagePack, CBOR)
- Version migration system
- Partial state export/import
- Validation schemas

**Technical Implementation:**
```typescript
interface CanvasStateSerializer {
  // Serialize to canonical JSON
  serialize(document: CanvasDocument): CanvasJSON;
  
  // Deserialize with validation
  deserialize(json: CanvasJSON): CanvasDocument;
  
  // Binary serialization
  serializeBinary(document: CanvasDocument): Uint8Array;
  deserializeBinary(bytes: Uint8Array): CanvasDocument;
  
  // Partial export
  exportSelection(document: CanvasDocument, selection: string[]): CanvasJSON;
  
  // Version migration
  migrate(json: CanvasJSON, from: string, to: string): CanvasJSON;
}
```

**Version Migration System:**
- Semantic versioning for document format
- Forward/backward migration scripts
- Migration testing infrastructure
- Deprecation warnings for old formats

**Acceptance Criteria:**
- Serialization is deterministic
- Binary format is 40-60% smaller than JSON
- Migration system handles breaking changes
- Validation catches malformed documents
- Export/import works across all frameworks

**Resource Requirements:**
- Serialization expertise (JSON Schema, MessagePack)
- Version migration strategy
- Testing infrastructure for edge cases
- Performance optimization for large documents

---

#### 4.2 Cross-Framework Import/Export (Priority: MEDIUM)
**Timing:** M6.6 (after state serialization)  
**Duration:** 8-10 weeks  
**Team:** 1 integration specialist + framework experts

**Scope:**
- Universal import/export API
- Framework-specific optimizations
- Asset bundle generation
- Export to popular formats (glTF, OBJ, DXF)
- Import from competitor formats (Figma, Sketch)

**Supported Formats:**

**Export Formats:**
- glTF/GLB (3D scenes)
- OBJ (geometry)
- DXF (2D CAD)
- SVG (2D vector)
- PNG/JPEG (raster screenshots)
- PDF (document export)

**Import Formats:**
- glTF/GLB
- OBJ
- DXF
- SVG
- Figma (via API)
- Sketch (via plugin)

**API Design:**
```typescript
interface CanvasImporter {
  importFromFile(file: File, options: ImportOptions): Promise<CanvasDocument>;
  importFromURL(url: string, options: ImportOptions): Promise<CanvasDocument>;
  importFromFigma(figmaId: string, token: string): Promise<CanvasDocument>;
}

interface CanvasExporter {
  exportToFormat(document: CanvasDocument, format: ExportFormat): Promise<Blob>;
  exportToFile(document: CanvasDocument, filename: string): Promise<void>;
  exportToPNG(canvas: CanvasElement): Promise<Blob>;
}
```

**Acceptance Criteria:**
- Import成功率 >90% for supported formats
- Export fidelity >95% for supported formats
- Cross-framework import/export works seamlessly
- Asset bundling is correct
- Error handling covers edge cases

**Resource Requirements:**
- File format expertise (glTF, DXF, SVG)
- API integration (Figma, Sketch)
- Asset management knowledge
- Testing infrastructure for file formats

---

#### 4.3 Universal Example Library (Priority: MEDIUM)
**Timing:** M6.7 (after import/export)  
**Duration:** 6-8 weeks  
**Team:** 1 documentation specialist + framework experts

**Scope:**
- Framework-agnostic example catalog
- Example code in all supported frameworks
- Interactive examples (CodeSandbox, StackBlitz)
- Migration guides between frameworks
- Best practices documentation

**Example Categories:**
1. **Basic viewers** (2D, 3D, BIM)
2. **Authoring tools** (transform, create, measure)
3. **Collaboration** (multi-user editing)
4. **Data visualization** (charts, graphs)
5. **CAD workflows** (precision, snapping)
6. **BIM workflows** (IFC, section planes)
7. **Performance** (large scenes, instancing)

**Interactive Examples:**
- CodeSandbox (React, Vue, Svelte)
- StackBlitz (Angular, Solid)
- Repl.it (vanilla)
- WebContainer (Astro)

**Documentation Structure:**
```markdown
# Example: Basic 3D Viewer

## Description
A simple 3D scene viewer with orbit controls.

## Frameworks
- [React](./react/basic-viewer/)
- [Vue](./vue/basic-viewer/)
- [Svelte](./svelte/basic-viewer/)
- [Solid](./solid/basic-viewer/)
- [Angular](./angular/basic-viewer/)
- [Astro](./astro/basic-viewer/)
- [Vanilla](./vanilla/basic-viewer/)

## Live Demo
[CodeSandbox Link]

## Key Concepts
- Scene initialization
- Camera controls
- Basic geometry
```

**Acceptance Criteria:**
- At least 50 examples across all frameworks
- All examples are runnable online
- Migration guides exist between frameworks
- Examples cover all major features
- Documentation is comprehensive

**Resource Requirements:**
- Technical writing expertise
- Framework expertise for all supported frameworks
- Interactive example platform setup
- Documentation maintenance

---

### Cross-Framework Mobility Summary

**Timeline:**
- **Q3 2027:** State serialization (M6.5)
- **Q4 2027:** Import/export (M6.6)
- **Q4 2027:** Example library (M6.7)

**Total Resource Investment:** ~3 FTE months over 4 months

**Risk Factors:**
- Serialization format stability
- Import/export format complexity
- Cross-framework compatibility issues
- Example maintenance overhead

**Success Metrics:**
- Serialization is deterministic and reversible
- Import success rate >90%
- Export fidelity >95%
- 50+ examples across all frameworks
- Migration guides cover all frameworks

---

## 5. Integration Partnerships

### Current State
- ✅ TanStack Query examples planned (M6)
- ✅ Server package exists (`@de-novo/canvas-server`)
- ❌ No cloud integrations yet

### Expansion Plan

#### 5.1 Cloud Storage Integration (Priority: HIGH)
**Timing:** M6.8 (concurrent with collaboration)  
**Duration:** 8-10 weeks  
**Team:** 1-2 integration specialists + backend developers

**Scope:**
- AWS S3 integration
- Google Cloud Storage integration
- Azure Blob Storage integration
- Cloudflare R2 integration
- Generic S3-compatible storage
- Storage abstraction layer

**Technical Architecture:**
```typescript
interface CanvasStorageAdapter {
  // Save document
  saveDocument(id: string, document: CanvasDocument): Promise<void>;
  
  // Load document
  loadDocument(id: string): Promise<CanvasDocument>;
  
  // Save assets
  saveAsset(id: string, asset: Blob): Promise<string>;
  
  // Load asset
  loadAsset(url: string): Promise<Blob>;
  
  // Delete
  deleteDocument(id: string): Promise<void>;
}

// AWS S3
class S3StorageAdapter implements CanvasStorageAdapter {
  constructor(config: S3Config);
}

// Google Cloud Storage
class GCSStorageAdapter implements CanvasStorageAdapter {
  constructor(config: GCSConfig);
}
```

**Storage Contracts:**
- Document storage (JSON)
- Asset storage (binary)
- Versioning support
- CDN integration
- Backup/restore

**Acceptance Criteria:**
- Integration with all major cloud providers
- Storage abstraction works seamlessly
- Performance: <500ms for save/load operations
- Versioning is supported
- CDN integration works correctly

**Resource Requirements:**
- AWS S3 expertise
- Google Cloud Storage expertise
- Azure Blob Storage expertise
- Cloudflare R2 expertise
- Backend development skills

---

#### 5.2 Database Integration (Priority: MEDIUM)
**Timing:** M6.9 (after cloud storage)  
**Duration:** 6-8 weeks  
**Team:** 1 backend developer + 1 database specialist

**Scope:**
- PostgreSQL integration
- MongoDB integration
- MySQL integration
- SQLite integration
- Database abstraction layer
- ORM/Query builder examples

**Supported Databases:**
- PostgreSQL (via Drizzle ORM)
- MongoDB (via Mongoose)
- MySQL (via Prisma)
- SQLite (via better-sqlite3)
- Supabase (PostgreSQL wrapper)
- PlanetScale (MySQL wrapper)

**Database Schema:**
```typescript
interface CanvasDatabaseSchema {
  // Documents table
  documents: {
    id: string;
    project_id: string;
    name: string;
    content: CanvasDocument;
    created_at: Date;
    updated_at: Date;
  };
  
  // Assets table
  assets: {
    id: string;
    document_id: string;
    type: 'image' | 'geometry' | 'texture';
    url: string;
    size: number;
    created_at: Date;
  };
  
  // Projects table
  projects: {
    id: string;
    name: string;
    owner_id: string;
    created_at: Date;
  };
}
```

**ORM Examples:**
- Drizzle ORM (PostgreSQL)
- Prisma (MySQL)
- Mongoose (MongoDB)
- TypeORM (multi-database)

**Acceptance Criteria:**
- Integration with all major databases
- Database abstraction works seamlessly
- Performance: <200ms for typical queries
- ORM examples are comprehensive
- Migration scripts are provided

**Resource Requirements:**
- Database expertise (PostgreSQL, MongoDB, MySQL)
- ORM expertise (Drizzle, Prisma, Mongoose)
- Migration planning skills
- Performance optimization

---

#### 5.3 Authentication Providers (Priority: MEDIUM)
**Timing:** M6.10 (concurrent with database)  
**Duration:** 4-6 weeks  
**Team:** 1 security specialist + 1 backend developer

**Scope:**
- Auth0 integration
- Firebase Auth integration
- NextAuth.js integration
- Clerk integration
- Custom JWT provider examples
- Auth abstraction layer

**Supported Providers:**
- Auth0
- Firebase Auth
- NextAuth.js (Auth.js)
- Clerk
- AWS Cognito
- Azure AD
- Google Identity Platform

**Auth Architecture:**
```typescript
interface CanvasAuthProvider {
  // Authenticate user
  authenticate(credentials: Credentials): Promise<AuthResult>;
  
  // Get current user
  getCurrentUser(): Promise<User | null>;
  
  // Logout
  logout(): Promise<void>;
  
  // Get permissions
  getPermissions(user: User): Permission[];
}

// Auth0 example
class Auth0Provider implements CanvasAuthProvider {
  constructor(config: Auth0Config);
}
```

**Integration Examples:**
- Next.js + Auth0
- Next.js + Clerk
- Vue + Firebase Auth
- React + NextAuth.js
- Svelte + Custom JWT

**Acceptance Criteria:**
- Integration with all major auth providers
- Auth abstraction works seamlessly
- Examples cover all frameworks
- Security best practices are followed
- Performance: <100ms for auth checks

**Resource Requirements:**
- Authentication expertise
- OAuth2/OpenID Connect knowledge
- Security best practices
- Framework-specific auth patterns

---

#### 5.4 CDN Services (Priority: LOW)
**Timing:** M6.11 (after core integrations)  
**Duration:** 4-6 weeks  
**Team:** 1 DevOps specialist + 1 backend developer

**Scope:**
- Cloudflare CDN integration
- AWS CloudFront integration
- Fastly CDN integration
- CDN asset optimization
- CDN caching strategies
- Edge computing examples

**CDN Features:**
- Asset delivery optimization
- Caching strategies for documents
- Edge computing for pre-processing
- Geographic distribution
- Cache invalidation

**Acceptance Criteria:**
- Integration with major CDN providers
- Asset delivery is optimized
- Caching strategies are effective
- Edge computing examples work
- Cache invalidation is correct

**Resource Requirements:**
- CDN expertise (Cloudflare, AWS CloudFront)
- Edge computing knowledge
- Performance optimization
- Cache strategy design

---

### Integration Partnerships Summary

**Timeline:**
- **Q3 2027:** Cloud storage (M6.8)
- **Q4 2027:** Database integration (M6.9)
- **Q4 2027:** Authentication providers (M6.10) - concurrent
- **Q1 2028:** CDN services (M6.11)

**Total Resource Investment:** ~3 FTE months over 6 months

**Risk Factors:**
- Integration complexity with cloud providers
- Performance optimization challenges
- Security/compliance requirements
- API changes from providers

**Success Metrics:**
- Integration with all major providers
- Performance meets targets (save <500ms, query <200ms)
- Examples cover all frameworks
- Security best practices followed

---

## 6. Plugin Ecosystem

### Current State
- ✅ Plugin contracts defined (M0)
- ✅ Tool registry exists (M3)
- ✅ Plugin lifecycle implemented
- ❌ No marketplace yet

### Expansion Plan

#### 6.1 Plugin Marketplace (Priority: MEDIUM)
**Timing:** M8.1 (after M7 BIM extensions)  
**Duration:** 12-16 weeks  
**Team:** 2-3 full-stack developers + 1 designer

**Scope:**
- Plugin marketplace website
- Plugin discovery and search
- Plugin installation via CLI
- Plugin rating and reviews
- Plugin analytics
- Plugin documentation hosting

**Marketplace Features:**
- Plugin directory
- Search and filtering
- Installation via CLI/API
- Version management
- Dependency resolution
- Security scanning
- Analytics dashboard

**Technical Architecture:**
```
┌─────────────────────────────────────┐
│   Plugin Marketplace Website         │
├─────────────────────────────────────┤
│ • Plugin directory                   │
│ • Search/filter                      │
│ • Installation instructions          │
│ • Reviews/ratings                    │
│ • Analytics dashboard               │
└─────────────────────────────────────┘
           ↓ uses
┌─────────────────────────────────────┐
│   Plugin Registry API                │
│ • Plugin metadata                    │
│ • Version manifests                  │
│ • Security reports                   │
│ • Download statistics                │
└─────────────────────────────────────┘
```

**CLI Integration:**
```bash
# Install plugin
denovo canvas install @de-novo/plugin-bim

# List plugins
denovo canvas plugin list

# Update plugin
denovo canvas update @de-novo/plugin-bim

# Remove plugin
denovo canvas remove @de-novo/plugin-bim
```

**Acceptance Criteria:**
- Marketplace website is functional
- Plugin installation works via CLI
- Plugin discovery is effective
- Security scanning is automated
- Analytics are comprehensive

**Resource Requirements:**
- Full-stack development (Next.js, Node.js)
- Database design (PostgreSQL)
- API development (REST, GraphQL)
- UI/UX design
- DevOps/infrastructure

---

#### 6.2 First-Party Plugins (Priority: HIGH)
**Timing:** M8.2 (concurrent with marketplace)  
**Duration:** 16-20 weeks  
**Team:** 3-5 plugin developers + domain specialists

**Scope:**
- Core plugins for common workflows
- Domain-specific plugins
- Framework-specific plugins
- Integration plugins
- Utility plugins

**Core Plugin Categories:**

**1. Authoring Plugins:**
- Advanced snapping
- Custom measurement tools
- Annotation systems
- Dimension tools
- Grid systems
- Work planes

**2. Import/Export Plugins:**
- glTF exporter
- OBJ importer
- DXF support
- SVG tools
- PDF export
- 3D format converters

**3. Visualization Plugins:**
- Heatmaps
- Charts/graphs overlay
- Label systems
- Color schemes
- Visual styles
- Themes

**4. Collaboration Plugins:**
- Comment threads
- Review mode
- Markup tools
- Version comparison
- Change tracking

**5. BIM Plugins:**
- IFC viewer
- Section planes
- Quantity takeoff
- Schedule generator
- 4D simulation

**6. Utility Plugins:**
- Performance profiler
- Scene validator
- Asset optimizer
- Backup tools
- Migration helpers

**Plugin API:**
```typescript
interface CanvasPlugin {
  // Plugin metadata
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  
  // Dependencies
  dependencies?: string[];
  
  // Setup
  setup(context: CanvasPluginContext): Promise<void>;
  
  // Cleanup
  cleanup(): Promise<void>;
}
```

**Acceptance Criteria:**
- At least 20 first-party plugins
- All plugins are well-documented
- Plugins are tested
- Plugins follow best practices
- Plugin API is stable

**Resource Requirements:**
- Plugin development expertise
- Domain knowledge for specialized plugins
- Testing infrastructure
- Documentation skills

---

#### 6.3 Third-Party Plugin Incentives (Priority: LOW)
**Timing:** M8.3 (after marketplace launch)  
**Duration:** 8-10 weeks  
**Team:** 1 developer relations specialist + 1 business lead

**Scope:**
- Plugin development kit (SDK)
- Plugin documentation
- Plugin templates
- Plugin examples
- Plugin support program
- Revenue sharing model

**Plugin SDK:**
```typescript
// Plugin development kit
import { definePlugin, defineTool, defineCommand } from '@de-novo/plugin-sdk';

// Define plugin
export default definePlugin({
  id: 'my-plugin',
  name: 'My Plugin',
  version: '1.0.0',
  
  async setup(context) {
    // Register tool
    context.registerTool(defineTool({
      id: 'my-tool',
      name: 'My Tool',
      handler: (input) => {
        // Tool implementation
      }
    }));
    
    // Register command
    context.registerCommand(defineCommand({
      id: 'my-command',
      name: 'My Command',
      execute: (context) => {
        // Command implementation
      }
    }));
  }
});
```

**Plugin Templates:**
- Basic tool plugin
- Import/export plugin
- Visualization plugin
- Collaboration plugin
- Framework-specific plugin

**Support Program:**
- Developer documentation
- Plugin testing infrastructure
- Code review for plugins
- Marketing support for quality plugins
- Revenue sharing for premium plugins

**Acceptance Criteria:**
- Plugin SDK is comprehensive
- Plugin documentation is excellent
- Plugin templates are useful
- Support program is active
- At least 10 third-party plugins exist

**Resource Requirements:**
- Developer relations expertise
- Technical writing skills
- Business development
- Community management

---

### Plugin Ecosystem Summary

**Timeline:**
- **Q2 2028:** Plugin marketplace (M8.1)
- **Q2 2028:** First-party plugins (M8.2) - concurrent
- **Q3 2028:** Third-party incentives (M8.3)

**Total Resource Investment:** ~6 FTE months over 6 months

**Risk Factors:**
- Marketplace complexity
- Plugin quality control
- Third-party adoption
- Revenue model sustainability
- Plugin API stability

**Success Metrics:**
- Marketplace is functional and usable
- 20+ first-party plugins
- 10+ third-party plugins
- Plugin SDK is comprehensive
- Plugin documentation is excellent

---

## Overall Roadmap Summary

### Timeline Overview

**2026:**
- ✅ **Q3:** M3.1 Surface Placement and Stacking (complete)
- 🔄 **Q4:** M4 Performance Layer
- 🔄 **Q4:** M5.1 Vue + Astro adapters

**2027:**
- 🔄 **Q1:** M5.2-5.3 Svelte + Solid adapters
- 🔄 **Q2:** M5.4 Angular adapter
- 🔄 **Q2:** M6.1 Core collaboration + CRDT
- 🔄 **Q2:** M6.2 Conflict resolution
- 🔄 **Q3:** M6.3 Permission system
- 🔄 **Q3:** M6.5 State serialization
- 🔄 **Q3:** M6.8 Cloud storage
- 🔄 **Q3:** M7.1 web-ifc integration
- 🔄 **Q3:** M7.2 xeokit bridge
- 🔄 **Q4:** M6.6 Import/export
- 🔄 **Q4:** M6.7 Example library
- 🔄 **Q4:** M6.9 Database integration
- 🔄 **Q4:** M6.10 Authentication providers
- 🔄 **Q4:** M7.3 Section planes & measurements
- 🔄 **Q4:** M7.4 BIM-specific tools

**2028:**
- 🔄 **Q1:** M6.11 CDN services
- 🔄 **Q1:** M8.1 Plugin marketplace
- 🔄 **Q2:** M8.2 First-party plugins
- 🔄 **Q3:** M8.3 Third-party incentives

### Resource Investment Summary

| Area | Duration | Team Size | Total FTE Months |
|------|----------|-----------|------------------|
| **Framework Adapters** | 8 months | 1-2 people | 3.5 |
| **BIM Extensions** | 6 months | 2-3 people | 5 |
| **Collaboration** | 4 months | 2-3 people | 4 |
| **Cross-Framework Mobility** | 4 months | 1-2 people | 3 |
| **Integration Partnerships** | 6 months | 1-2 people | 3 |
| **Plugin Ecosystem** | 6 months | 3-5 people | 6 |
| **Total** | 24 months | Varies | **24.5** |

### Priority Matrix

**High Priority (M5-M7):**
1. Vue adapter (M5.1)
2. Astro integration (M5.1)
3. web-ifc integration (M7.1)
4. Section planes (M7.3)
5. Core collaboration (M6.1)
6. State serialization (M6.5)
7. Cloud storage (M6.8)

**Medium Priority:**
1. Svelte adapter (M5.2)
2. Solid adapter (M5.3)
3. xeokit bridge (M7.2)
4. BIM-specific tools (M7.4)
5. Conflict resolution (M6.2)
6. Permission system (M6.3)
7. Import/export (M6.6)
8. Example library (M6.7)
9. Database integration (M6.9)
10. Authentication providers (M6.10)

**Low Priority (Long-term):**
1. Angular adapter (M5.4)
2. Audit logging (M6.4)
3. CDN services (M6.11)
4. Plugin marketplace (M8.1)
5. First-party plugins (M8.2)
6. Third-party incentives (M8.3)

### Risk Management

**Technical Risks:**
- **CRDT complexity:** Mitigate by starting with Yjs (well-documented)
- **BIM performance:** Mitigate by Web Worker + incremental parsing
- **License contamination:** Mitigate by strict package separation
- **Cross-framework compatibility:** Mitigate by framework-agnostic core

**Business Risks:**
- **Resource constraints:** Mitigate by phased rollout
- **Third-party adoption:** Mitigate by excellent developer experience
- **Plugin quality:** Mitigate by review process + guidelines
- **Market timing:** Mitigate by focusing on core value first

**Operational Risks:**
- **Documentation debt:** Mitigate by documentation-first approach
- **Testing complexity:** Mitigate by automated testing infrastructure
- **Version management:** Mitigate by semantic versioning + migration system
- **Support burden:** Mitigate by community-driven support

### Success Metrics

**Technical Metrics:**
- Performance targets met (save <500ms, query <200ms, sync <200ms)
- Test coverage >80% for new features
- Zero security vulnerabilities in core packages
- Framework adapter feature parity >95%

**Business Metrics:**
- 10+ third-party plugins within 6 months of marketplace launch
- Integration with all major cloud providers
- Support for 6+ frameworks
- 50+ examples in universal library

**Quality Metrics:**
- API stability: <1 breaking change per minor version
- Documentation coverage: 100% of public APIs documented
- TypeScript strict mode: 100% type safety
- Accessibility: WCAG 2.1 AA compliance

---

## Conclusion

This roadmap provides a comprehensive path for expanding Denovo Canvas from its current M3.1 state to a full-featured ecosystem spanning multiple frameworks, BIM capabilities, real-time collaboration, and third-party integrations.

**Key Success Factors:**
1. Maintain framework-agnostic core stability
2. Progressive disclosure: simple by default, powerful when needed
3. Verification-driven development with measurable acceptance criteria
4. License hygiene: isolate AGPL/heavy dependencies
5. Community-driven ecosystem through plugins and integrations

**Next Steps:**
1. Complete M4 Performance Layer
2. Begin M5.1 Vue + Astro adapters
3. Plan M6 collaboration architecture
4. Prepare for M7 BIM extensions

This roadmap is ambitious but achievable with focused execution and strategic prioritization. The phased approach ensures each milestone delivers value while building toward the complete ecosystem vision.
