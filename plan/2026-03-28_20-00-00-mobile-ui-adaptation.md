# Plan: Comprehensive Mobile UI Adaptation

## Goal
- Fully adapt all frontend pages and components for mobile devices (320px-480px width)
- Ensure all features are accessible and usable on mobile with optimized touch interactions
- Design a coherent mobile-specific UI layer on top of the existing desktop design system
- Maintain backward compatibility with desktop layouts

## Scope
- In:
  - All 13 frontend pages (Login, Register, Dashboard, Characters, Outline, Writing, Export, Prompts, ProjectWizard, AdminUsers, Settings, NotFound, RouteError)
  - All UI components (Modal, Drawer, Toast, ProgressBar, Badge, Confirm, CopyFallback)
  - All layout components (AppShell, WizardNextBar, MarkdownEditor, ProjectSwitcher)
  - All writing components (ChapterListPanel, ChapterVirtualList, WritingToolbar, BatchGenerationModal, CreateChapterDialog, AiGenerateDrawer, GenerationHistoryDrawer, PromptInspectorDrawer)
- Out:
  - Backend API changes
  - New feature development
  - Desktop-only UI redesign

## Assumptions / Dependencies
- Tailwind CSS breakpoints: sm(640px), md(768px), lg(1024px), xl(1280px)
- Mobile target: 320px-480px viewport width (portrait orientation)
- Tablet target: 481px-768px (both orientations)
- All changes use existing Tailwind + CSS variable system
- No new dependencies required

## Phases

### Phase 1: Foundation & Global (MOB-001 to MOB-003)
1. Global mobile CSS utilities (touch targets, safe areas, scrollbar hiding on mobile)
2. AppShell header mobile compact mode + mobile user info
3. ToastProvider responsive width fix

### Phase 2: Core UI Components (MOB-004 to MOB-006)
4. Modal full-screen on mobile (<640px)
5. Drawer bottom sheet enhancement + mobile drag handle
6. MarkdownEditor viewport-aware height

### Phase 3: Writing Page (MOB-007 to MOB-012)
7. ChapterListPanel mobile redesign (responsive height + compact items)
8. WritingPage mobile layout overhaul (editor UX + toolbar)
9. BatchGenerationModal mobile full-screen mode
10. CreateChapterDialog mobile optimization
11. GenerationHistoryDrawer mobile bottom-sheet conversion
12. PromptInspectorDrawer mobile bottom-sheet conversion

### Phase 4: Content Pages (MOB-013 to MOB-017)
13. OutlinePage mobile improvements (generation modal + form layout)
14. CharactersPage mobile drawer optimization
15. PromptsPage mobile form layout
16. ExportPage mobile spacing + touch-friendly controls
17. ProjectWizardPage mobile refinement

### Phase 5: Polish (MOB-018 to MOB-020)
18. CopyFallbackModal & ConfirmProvider mobile fix
19. Mobile touch targets & tap area standardization
20. Final comprehensive mobile review & regression

## Tests & Verification
- Each issue -> Chrome DevTools mobile emulation (iPhone SE 375px, iPhone 14 390px, Samsung Galaxy 360px)
- Layout verification: no horizontal scroll, no overflow clipping, all buttons reachable
- Interaction verification: all modals/drawers openable, all forms submittable
- Build verification: `npm run build` passes after each phase

## Issue CSV
- Path: issues/2026-03-28_20-00-00-mobile-ui-adaptation.csv
- Must share the same timestamp/slug as this plan.

## Tools / MCP
- codex exec (full-access mode, gpt-5.2, xhigh thinking) for implementation
- codex exec (full-access mode, gpt-5.2, xhigh thinking) for code review
- Chrome DevTools MCP for visual verification (if available)
- manual browser testing for interaction verification

## Acceptance Checklist
- [ ] All pages render without horizontal scroll on 375px viewport
- [ ] All modals/drawers are accessible and dismissible on mobile
- [ ] All forms are submittable with touch input
- [ ] All buttons have minimum 44px touch targets
- [ ] Writing page fully functional on mobile (chapter nav, editor, AI features)
- [ ] Toast notifications don't overflow on mobile
- [ ] Safe area insets respected on notched devices
- [ ] Desktop layout unchanged (no regressions)
- [ ] Build passes (`npm run build`)

## Risks / Blockers
- Complex WritingPage layout may need significant restructuring
- Drawer-to-bottom-sheet conversion may affect animation performance
- Some components may need conditional rendering logic for mobile vs desktop

## Rollback / Recovery
- Each issue is one commit; can revert individual commits if needed
- All changes are CSS/layout only; no data model changes

## Checkpoints
- Commit after: each individual issue (MOB-001 through MOB-020)
- Phase review after: Phase 3 (Writing Page is most complex)
- Final regression after: Phase 5

## References
- frontend/src/index.css:1-376 (global styles + theme system)
- frontend/tailwind.config.js:1-38 (Tailwind configuration)
- frontend/src/components/layout/AppShell.tsx:1-474 (main layout)
- frontend/src/pages/WritingPage.tsx (most complex page)
- frontend/src/components/writing/ (writing components)
