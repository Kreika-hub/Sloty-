# Graph Report - Sloty-  (2026-08-20)

## Corpus Check
- 204 files · ~436,934 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 3493 nodes · 7542 edges · 211 communities (180 shown, 31 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 97 edges (avg confidence: 0.65)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `4e6f43f9`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- live-browser.js
- checks.mjs
- admin.js
- index.mjs
- setLiveState
- design-system.mjs
- modern-screenshot.umd.js
- css-cascade.mjs
- resumeSession
- live-inject.mjs
- hook-lib.mjs
- live-commit-manual-edits.mjs
- impeccable-config.mjs
- showToast
- manual-apply.mjs
- svelte-component.mjs
- detect-antipatterns-browser.js
- hook-admin.mjs
- detect-antipatterns.mjs
- live-server.mjs
- el
- hook-before-edit.mjs
- insert-ui.mjs
- live-wrap.mjs
- design-parser.mjs
- documentRefForElement
- live-accept.mjs
- live-copy-edit-agent.mjs
- parseRgb
- inline-ignores.mjs
- workbox-4874b91b.js
- workbox-98d2c6d7.js
- context.mjs
- SAFE_TAGS
- live-poll.mjs
- live-manual-edit-evidence.mjs
- handleManualEditActivity
- isScreenReaderOnlyTextStyle
- db.js
- manual-edit-routes.mjs
- ensureFile
- readLiveServerInfo
- context-signals.mjs
- impeccable-paths.mjs
- live.mjs
- renderGroupedTemplate
- onAnnotDown
- scripts
- StrategyHandler
- Router
- StrategyHandler
- Router
- parseAnyColor
- refreshParamsPanel
- sampleCssBackground
- resolveLengthPx
- .constructor
- .constructor
- resolveContext
- GENERIC_FONTS
- critique-storage.mjs
- collectVisualContrastCandidates
- pin.mjs
- ui-core.mjs
- session-store.mjs
- Using Agent Skills Skill
- detect-html.mjs
- collectBrowserFindings
- palette.mjs
- resolveWorkspaceProjectRoot
- colorize.md
- CacheTimestampsModel
- CacheTimestampsModel
- UX Writing
- discoverTargetCandidates
- Code Review and Quality
- serializeFindings
- Git Workflow and Versioning
- Browser Testing with DevTools
- acceptedDomAlreadyClean
- document.md
- isGeneratedFile
- Impeccable Frontend Skill
- Polish Reference
- detect.mjs
- NetworkOnly
- NetworkOnly
- main.js
- parseRgb
- Route
- Route
- idea-refine.sh
- readConfig
- Index HTML
- PWA Maskable Icon
- Sloty Logo Negro
- bcv-rate/index.ts
- notify-new-payment/index.ts
- Product Register Reference
- initGlobalBar
- sanitize.js
- Guard PIN Screen
- Login Screen
- Main Screen
- PWA Icon 192x192
- WhatsApp Icon
- Sloty Logo V2 (Yellow Outline)
- Register Screen
- Resident Screen
- Welcome Screen
- API and Interface Design
- CI/CD and Automation
- Deprecation and Migration
- Frontend UI Engineering
- Context Engineering
- Incremental Implementation
- onboard.md
- Code Simplification
- Debugging and Error Recovery
- Documentation and ADRs
- The Toolkit
- Delight Techniques
- ReOrder: Keep Your Regulars Ordering Direct
- Interview Me
- Interaction Design
- Doubt-Driven Development
- Idea Refine
- Process
- live.md
- Optimization Strategy
- StaticElement
- event-validation.mjs
- Amplify the Design
- extract_needs.cjs
- Refinement & Evaluation Criteria
- animate.md
- Simplify the Design
- Hardening Dimensions
- critique.md
- Nielsen's 10 Heuristics
- Handle `generate`
- adapt.md
- Responsive Design
- Generate Combined Critique Report
- Step 3: Ask strategic questions (for PRODUCT.md)
- Ideation Frameworks Reference
- Common Cognitive Load Violations
- Technical Implementation
- Persona-Based Design Testing
- Extract Flow
- Init Flow
- iOS platform
- Improve Layout Systematically
- modify_guard.cjs
- captureElementToBlob
- guard.js
- test-db.js
- patch_recent_movs.js
- Android platform
- Implement Animations
- Generate Report
- Cognitive Load Assessment
- /impeccable hooks
- layout.md
- CSP detection (first-time only)
- print_raw_sub_form.cjs
- Plan Adaptation Strategy
- Diagnostic Scan
- extract.js
- Adaptation Strategies
- 4. Plan three variants: identity first, then mode, then axes
- Handle fallback
- extract_specifics.cjs
- modify_guard_sections.cjs
- move_to_backup.js
- read_sections.cjs
- search_lines.cjs
- Heuristics Scoring Guide
- debug.cjs
- find_line_numbers.cjs
- modify_guard.js
- normalize-fonts.js
- print_actions_sub.cjs
- print_after_closure.cjs
- print_exit_amount_block.cjs
- print_exit_and_payment_forms.cjs
- print_exit_form_top.cjs
- print_head.cjs
- print_pay_const.cjs
- print_rate_usage.cjs
- print_sub_and_closure.cjs
- read.js
- scratch_backup/read_sections.js
- rules/graphify.md
- workflows/graphify.md
- patch_guard.js
- readWorkspacePatterns
- read_file.js
- apply_escape.js
- apply_escape.mjs
- resolveProjectRoot
- applyDeferredSvelteComponentAccepts
- normalizeGitHubEvent

## God Nodes (most connected - your core abstractions)
1. `el()` - 42 edges
2. `initAdmin()` - 42 edges
3. `runHook()` - 36 edges
4. `getParkingState()` - 33 edges
5. `escapeHTML()` - 30 edges
6. `setLiveState()` - 29 edges
7. `detectHtml()` - 28 edges
8. `main()` - 28 edges
9. `initGlobalBar()` - 28 edges
10. `collectBrowserFindings()` - 26 edges

## Surprising Connections (you probably didn't know these)
- `parseYamlSubset()` --indirect_call--> `raw()`  [INFERRED]
  .cursor/skills/impeccable/scripts/detector/design-system.mjs → src/utils/sanitize.js
- `collectStaticDesignSystemFindings()` --indirect_call--> `raw()`  [INFERRED]
  .cursor/skills/impeccable/scripts/detector/design-system.mjs → src/utils/sanitize.js
- `parseYamlSubset()` --indirect_call--> `raw()`  [INFERRED]
  .cursor/skills/impeccable/scripts/lib/design-parser.mjs → src/utils/sanitize.js
- `splitSections()` --indirect_call--> `raw()`  [INFERRED]
  .cursor/skills/impeccable/scripts/lib/design-parser.mjs → src/utils/sanitize.js
- `splitSubsections()` --indirect_call--> `raw()`  [INFERRED]
  .cursor/skills/impeccable/scripts/lib/design-parser.mjs → src/utils/sanitize.js

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Agent Skills Framework** — agents_skills_using_agent_skills_skill, agents_skills_spec_driven_development_skill, agents_skills_planning_and_task_breakdown_skill, agents_skills_test_driven_development_skill, agents_skills_performance_optimization_skill, agents_skills_security_and_hardening_skill, agents_skills_shipping_and_launch_skill [EXTRACTED 1.00]
- **Application Screens** — welcome_screen, login_screen, register_screen, guard_pin_screen, resident_screen, main_screen [EXTRACTED 1.00]
- **Impeccable Design System Reference** — cursor_skills_impeccable_reference_polish, cursor_skills_impeccable_reference_product, cursor_skills_impeccable_reference_quieter, cursor_skills_impeccable_reference_shape, cursor_skills_impeccable_reference_typeset [EXTRACTED 1.00]
- **Sloty Brand Identity Assets** — public_logo_jpg, public_sloty_logo_v2_png, public_icons_sloty_logo_negro_png, public_icons_maskable_icon_512x512_png [INFERRED 0.85]

## Communities (211 total, 31 thin omitted)

### Community 0 - "live-browser.js"
Cohesion: 0.03
Nodes (125): addManualContextText(), applyGlobalBarLabelState(), applyPlaceholderSizingStyles(), applySvelteComponentVariantStyle(), bindEditBadgeProxy(), bufferToBase64(), buildCollapsible(), buildColorModels() (+117 more)

### Community 1 - "checks.mjs"
Cohesion: 0.05
Nodes (86): isNeutralBorderColor(), borderColorsFromStyle(), borderWidthsFromStyle(), checkBorders(), checkClippedOverflow(), checkCreamPalette(), checkElementBorders(), checkElementBordersDOM() (+78 more)

### Community 2 - "admin.js"
Cohesion: 0.15
Nodes (38): getExchangeRate(), getParkingState(), logAudit(), showToast(), checkExpiringSubscriptions(), loadHomeMetrics(), renderHome(), initFinanceActions() (+30 more)

### Community 3 - "index.mjs"
Cohesion: 0.06
Nodes (68): addBrowserFindings(), addVisualContrastFindings(), addVisualContrastResult(), analyzeVisualContrast(), analyzeVisualContrastCandidate(), blendRgba(), browserColorsClose(), browserDesignSystemConfig() (+60 more)

### Community 4 - "setLiveState"
Cohesion: 0.09
Nodes (71): abortSvelteComponentInjection(), applyEditing(), buildCyclingRow(), buildInsertPlaceholderSnapshotFromDom(), buildLocatorForLeaf(), buildSavingRow(), cancelEditing(), cancelEditingToPicking() (+63 more)

### Community 5 - "design-system.mjs"
Cohesion: 0.09
Nodes (50): addColorObject(), addDesignColor(), addRoundedScale(), addRoundedToken(), addSidecarColors(), addSidecarRadii(), addTypographyFonts(), addTypographySizes() (+42 more)

### Community 6 - "modern-screenshot.umd.js"
Cohesion: 0.09
Nodes (52): ae(), be(), bt(), Ce(), Ct(), de(), dt(), _e() (+44 more)

### Community 7 - "css-cascade.mjs"
Cohesion: 0.10
Nodes (30): applyStaticDeclaration(), buildBorderOverrideMap(), buildStaticStyleMap(), collectStaticCssRules(), compareStaticPriority(), cssPropToCamel(), expandStaticBoxValues(), expandStaticDeclaration() (+22 more)

### Community 8 - "resumeSession"
Cohesion: 0.09
Nodes (52): applyOriginalAttrsToSvelteAnchor(), applySavedSessionMeta(), clampVariantIndex(), clearHandled(), commitAcceptedSvelteComponentToDom(), cycleVariant(), elementMatchesOriginalMarkup(), ensureInsertPlaceholder() (+44 more)

### Community 9 - "live-inject.mjs"
Cohesion: 0.07
Nodes (54): detectCsp(), INLINE_HEADER_SIGNALS, LAYOUT_EXTS, MONOREPO_HELPER_SIGNALS, NUXT_ROUTE_RULES_SIGNALS, NUXT_SECURITY_SIGNALS, SCAN_EXTS, SKIP_DIRS (+46 more)

### Community 10 - "hook-lib.mjs"
Cohesion: 0.06
Nodes (57): ACK_EXTS, applyConfigSource(), applyDetectorConfigSource(), clampByte(), cleanIgnoreValueDisplay(), CO_SCAN_STYLE_NAMES, coLocatedStylesheets(), colorIgnoreKey() (+49 more)

### Community 11 - "live-commit-manual-edits.mjs"
Cohesion: 0.11
Nodes (48): allEntryIds(), argVal(), buildRepairBatch(), candidatesForEntry(), changedFilesSinceSnapshot(), collectApplyOwnedFiles(), collectRollbackFiles(), commitManualEdits() (+40 more)

### Community 12 - "impeccable-config.mjs"
Cohesion: 0.10
Nodes (47): applyDetectionConfigSource(), clampByte(), cleanIgnoreValueDisplay(), cloneDetectionConfig(), cloneRawDetectionConfig(), colorIgnoreKey(), DEFAULT_DETECTION_CONFIG, DETECTOR_CONFIG_KEYS (+39 more)

### Community 13 - "showToast"
Cohesion: 0.07
Nodes (54): applyConfigureBarChrome(), armPageChatForTyping(), attachSteerFocusDebug(), attachSteerFocusGuard(), clearSteerAwaitTimer(), clearSteerFocusRecoverTimer(), collapsePageChat(), configureVoiceContext() (+46 more)

### Community 14 - "manual-apply.mjs"
Cohesion: 0.10
Nodes (36): addOpToManualApplyChunk(), APPLY_EVENT_HARD_TIMEOUT_MS, APPLY_EVENT_SOFT_DEADLINE_MS, buildManualApplyAgentAction(), clearManualApplyTransaction(), collectManualApplyFiles(), compactManualApplyBatch(), compactManualApplyCandidates() (+28 more)

### Community 15 - "svelte-component.mjs"
Cohesion: 0.11
Nodes (39): appendCssToSvelteStyle(), appendSanitizedCssRule(), bakeParamValuesInCss(), buildInsertVariantStub(), buildPropContract(), buildPropsScript(), buildVariantStub(), componentSessionDir() (+31 more)

### Community 16 - "detect-antipatterns-browser.js"
Cohesion: 0.08
Nodes (37): checkBorders(), checkClippedOverflow(), checkElementBorders(), checkElementBordersDOM(), checkElementClippedOverflow(), checkElementClippedOverflowDOM(), checkElementItalicSerif(), checkElementItalicSerifDOM() (+29 more)

### Community 17 - "hook-admin.mjs"
Cohesion: 0.12
Nodes (43): ACTIONS, addIgnoreFile(), addIgnoreRule(), addIgnoreValue(), DETECTOR_CONFIG_KEYS, detectorSection(), fileHasImpeccableHookMarker(), HOOK_MANIFEST_TARGETS (+35 more)

### Community 18 - "detect-antipatterns.mjs"
Cohesion: 0.14
Nodes (30): confirm(), detectCli(), formatFindings(), formatFindingSummary(), handleStdin(), printUsage(), loadDesignSystemForCwd(), parseFrontmatter() (+22 more)

### Community 19 - "live-server.mjs"
Cohesion: 0.09
Nodes (43): assembleLiveBrowserScript(), assertLiveBrowserScriptParts(), LIVE_BROWSER_SCRIPT_PARTS, readLiveBrowserScriptParts(), resolveLiveBrowserScriptParts(), acknowledgePendingEvent(), activeSessionSummaries(), agentPollingConnected() (+35 more)

### Community 20 - "el"
Cohesion: 0.10
Nodes (39): actionLabel(), bindConfigureCountPillTooltip(), bindConfigureInlineControlHover(), bindConfigureModifierPillHover(), buildConfigureActionControl(), buildConfigureCountControl(), buildConfigureRow(), buildConfigureSubmitButton() (+31 more)

### Community 21 - "hook-before-edit.mjs"
Cohesion: 0.10
Nodes (47): allow(), bumpCursorDenial(), cursorBlockMessage(), deny(), detectProposedHtml(), done(), escapeRegExp(), findingSignature() (+39 more)

### Community 22 - "insert-ui.mjs"
Cohesion: 0.09
Nodes (13): canCreateInsert(), clampPlaceholderSize(), computeInsertPosition(), groupSiblingRows(), hitSiblingInsertGap(), horizontalOverlap(), insertCreateDisabledReason(), insertLineCoords() (+5 more)

### Community 23 - "live-wrap.mjs"
Cohesion: 0.13
Nodes (35): argVal(), buildInsertWrapperLines(), computeInsertLine(), INSERT_POSITIONS, insertCli(), isInsertPosition(), resolveElementMatch(), buildSvelteComponentCssAuthoring() (+27 more)

### Community 24 - "design-parser.mjs"
Cohesion: 0.15
Nodes (33): buildColor(), CANONICAL_SECTIONS, collectBullets(), collectColorValues(), collectParagraphs(), detectFormat(), extractColors(), extractComponents() (+25 more)

### Community 25 - "documentRefForElement"
Cohesion: 0.11
Nodes (23): canRestoreManualEditElement(), copyEditContainerContext(), copyEditLeafContext(), directMixedTextRestoreNodes(), documentRefClassSuffix(), documentRefForElement(), documentRefIdSuffix(), documentRefSegment() (+15 more)

### Community 26 - "live-accept.mjs"
Cohesion: 0.14
Nodes (32): acceptCli(), argVal(), buildCarbonizeReplacement(), decodeHtmlAttr(), deindentContent(), detectCommentSyntax(), escapeRegExp(), expandReplaceRange() (+24 more)

### Community 27 - "live-copy-edit-agent.mjs"
Cohesion: 0.14
Nodes (31): applyMockWrites(), buildCopyEditBatchPrompt(), checkFrameworkSourceSyntax(), chooseCopyEditAgent(), COMMAND_AUTH_CACHE, commandAuthed(), commandExists(), compactBatchForPrompt() (+23 more)

### Community 28 - "parseRgb"
Cohesion: 0.19
Nodes (22): checkColors(), checkElementAIPaletteDOM(), checkElementColors(), checkElementColorsDOM(), checkElementGlow(), checkElementGlowDOM(), checkElementIconTile(), checkElementIconTileDOM() (+14 more)

### Community 29 - "inline-ignores.mjs"
Cohesion: 0.40
Nodes (9): addRules(), applyInlineIgnores(), getSet(), hasDirectives(), isInlineIgnored(), normalizeRule(), parseInlineIgnores(), parseRuleList() (+1 more)

### Community 30 - "workbox-4874b91b.js"
Cohesion: 0.10
Nodes (20): cacheDonePromiseForTransaction(), CacheFirst, cacheMatchIgnoreParams(), Deferred, executeQuotaErrorCallbacks(), get(), getCursorAdvanceMethods(), getIdbProxyableTypes() (+12 more)

### Community 31 - "workbox-98d2c6d7.js"
Cohesion: 0.10
Nodes (20): cacheDonePromiseForTransaction(), CacheFirst, cacheMatchIgnoreParams(), Deferred, executeQuotaErrorCallbacks(), get(), getCursorAdvanceMethods(), getIdbProxyableTypes() (+12 more)

### Community 32 - "context.mjs"
Cohesion: 0.16
Nodes (20): buildMissingTargetDirective(), buildResolvedContextDirective(), buildTargetSelectionDirective(), buildUpdateDirective(), cli(), compareSemver(), computeUpdateDirective(), DESIGN_NAMES (+12 more)

### Community 33 - "SAFE_TAGS"
Cohesion: 0.22
Nodes (11): checkElementMotion(), checkElementMotionDOM(), checkLayout(), checkMotion(), checkPageLayout(), isCardLike(), isCardLikeDOM(), isCardLikeFromProps() (+3 more)

### Community 34 - "live-poll.mjs"
Cohesion: 0.16
Nodes (26): completionAckForAcceptResult(), completionTypeForAcceptResult(), augmentEventWithAcceptHandling(), buildAcceptScriptArgs(), buildPollReplyPayload(), DEFAULT_EVENT_LEASE_MS, EVENT_TYPES_NEEDING_AGENT_REPLY, fetchNextEvent() (+18 more)

### Community 35 - "live-manual-edit-evidence.mjs"
Cohesion: 0.16
Nodes (26): analyzeSourceHint(), buildCandidatesForOp(), buildContextHintsByRef(), buildManualEditEvidence(), collectSearchFiles(), countOps(), decodeBasicHtml(), escapeRegExp() (+18 more)

### Community 36 - "handleManualEditActivity"
Cohesion: 0.18
Nodes (25): clearStoredManualApplyState(), fetchPendingCount(), handleManualEditActivity(), hidePendingApplyDock(), manualApplyLoadingText(), manualApplyStateKey(), manualEditEventForCurrentPage(), numberOrNull() (+17 more)

### Community 37 - "isScreenReaderOnlyTextStyle"
Cohesion: 0.47
Nodes (6): clippedByInset(), clippedByRect(), expandBoxShorthand(), firstMetricLengthPx(), isScreenReaderOnlyTextStyle(), metricLengthPx()

### Community 38 - "db.js"
Cohesion: 0.10
Nodes (37): configured, dummyState, initialQueueCount, prefix1, queueCountAfterArrayMock, queueCountAfterMock, queueCountAfterValid, retrievedState (+29 more)

### Community 39 - "manual-edit-routes.mjs"
Cohesion: 0.18
Nodes (21): clearAppliedEntries(), args, cwd, pageUrlFilter, remaining, compactManualLogText(), summarizeManualApplyFailures(), summarizeManualDiagnostics() (+13 more)

### Community 40 - "ensureFile"
Cohesion: 0.53
Nodes (6): bumpEditCount(), dedupeAgainstCache(), ensureFile(), ensureSession(), findingCacheKey(), rememberFindings()

### Community 41 - "readLiveServerInfo"
Cohesion: 0.21
Nodes (17): isLiveServerPidReachable(), readLiveServerInfo(), completeCli(), completeThroughServer(), parseArgs(), readServerInfo(), collectManualApplyFiles(), manualApplyReplyCommand() (+9 more)

### Community 42 - "context-signals.mjs"
Cohesion: 0.23
Nodes (14): extractPlatform(), extractRegister(), extractSectionValue(), cli(), COMMON_DEV_PORTS, devServerSignals(), gatherSignals(), gitSignals() (+6 more)

### Community 43 - "impeccable-paths.mjs"
Cohesion: 0.20
Nodes (17): CRITIQUE_DIR, firstExisting(), getDesignSidecarCandidates(), getDesignSidecarPath(), getImpeccableDir(), getLegacyLiveConfigPath(), getLiveAnnotationsDir(), getLiveConfigPath() (+9 more)

### Community 44 - "live.mjs"
Cohesion: 0.32
Nodes (11): loadContext(), resolveTargetSelection(), safeRead(), __dirname, ensureServerRunning(), globToRegex(), liveCli(), missingLiveContext() (+3 more)

### Community 45 - "renderGroupedTemplate"
Cohesion: 0.25
Nodes (11): clampGroupedToBudget(), clampToBudget(), directiveFooter(), formatFindingIgnoreCommand(), formatFindingLine(), quoteCommandArg(), relativize(), renderCleanAck() (+3 more)

### Community 46 - "onAnnotDown"
Cohesion: 0.18
Nodes (19): applyPlaceholderDimensions(), beginEditPin(), buildAnnotationsForCapture(), buildPinElement(), cancelEditingPin(), finalizeEditingPin(), initAnnotOverlay(), localCoords() (+11 more)

### Community 47 - "scripts"
Cohesion: 0.10
Nodes (19): dependencies, @supabase/supabase-js, vite, vite-plugin-pwa, name, private, scripts, build (+11 more)

### Community 48 - "StrategyHandler"
Cohesion: 0.26
Nodes (3): StaleWhileRevalidate, StrategyHandler, toRequest()

### Community 50 - "StrategyHandler"
Cohesion: 0.26
Nodes (3): StaleWhileRevalidate, StrategyHandler, toRequest()

### Community 52 - "parseAnyColor"
Cohesion: 0.14
Nodes (20): borderColorsFromStyle(), borderWidthsFromStyle(), browserColorsClose(), checkCreamPalette(), checkElementGptBorderShadow(), checkElementGptBorderShadowDOM(), checkGptThinBorderWideShadow(), checkQuality() (+12 more)

### Community 53 - "refreshParamsPanel"
Cohesion: 0.19
Nodes (17): applyParamDefaults(), applyParamValue(), buildParamsPanel(), closedClipPath(), formatRangeValue(), getVisibleVariantEl(), hideParamsPanel(), openTunePopover() (+9 more)

### Community 54 - "sampleCssBackground"
Cohesion: 0.18
Nodes (16): blendRgba(), clampByte(), firstCssUrl(), getLayerValue(), loadVisualContrastImage(), parseObjectPosition(), parsePositionPair(), parsePositionToken() (+8 more)

### Community 55 - "resolveLengthPx"
Cohesion: 0.15
Nodes (15): checkElementHeroEyebrow(), checkElementHeroEyebrowDOM(), checkElementQualityDOM(), checkHeroEyebrow(), checkRepeatedSectionKickers(), checkRepeatedSectionKickersDOM(), checkRepeatedSectionKickersFromDoc(), cleanInlineText() (+7 more)

### Community 56 - ".constructor"
Cohesion: 0.29
Nodes (3): CacheExpiration, dontWaitFor(), ExpirationPlugin

### Community 57 - ".constructor"
Cohesion: 0.29
Nodes (3): CacheExpiration, dontWaitFor(), ExpirationPlugin

### Community 58 - "resolveContext"
Cohesion: 0.14
Nodes (16): contextSourcePath(), contextSourceStatus(), findMonorepoRoot(), firstExisting(), hasGitBoundary(), isPathInside(), isPathInsideOrEqual(), nearestPackageRootBetween() (+8 more)

### Community 59 - "GENERIC_FONTS"
Cohesion: 0.16
Nodes (16): checkPageTypography(), firstOverusedGoogleFont(), checkStaticPageTypography(), checkPageTypography(), checkTypography(), resolveSerif(), BRAND_FONT_DOMAINS, GENERIC_FONTS (+8 more)

### Community 60 - "critique-storage.mjs"
Cohesion: 0.32
Nodes (11): kebab(), listSnapshotsForSlug(), main(), nowFilenameStamp(), parseFrontmatter(), readLatestSnapshot(), readTrend(), serializeFrontmatter() (+3 more)

### Community 61 - "collectVisualContrastCandidates"
Cohesion: 0.11
Nodes (23): addBrowserFindings(), addVisualContrastFindings(), addVisualContrastResult(), analyzeVisualContrast(), analyzeVisualContrastCandidate(), checkElementTextOverflowDOM(), classSelector(), clearOverlays() (+15 more)

### Community 62 - "pin.mjs"
Cohesion: 0.23
Nodes (11): CODEX_HARNESSES, commandPrefixForSkillsDir(), __dirname, findHarnessDirs(), generatePinnedSkill(), HARNESS_DIRS, loadCommandMetadata(), pin() (+3 more)

### Community 63 - "ui-core.mjs"
Cohesion: 0.23
Nodes (10): createLiveBrowserDomHelpers(), activeElementDeep(), appendStyleToLiveUiRoot(), appendToLiveUiRoot(), escapeCssIdent(), getLiveUiElementById(), LIVE_CHROME_MOUNT_CONTRACT, LIVE_UI_COMPONENT_IDS (+2 more)

### Community 64 - "session-store.mjs"
Cohesion: 0.24
Nodes (10): getLegacyLiveSessionsDir(), applyEvent(), baseSnapshot(), COMPLETED_PHASES, getJournalPath(), getSnapshotPath(), rebuildSnapshotFromJournal(), safeSessionId() (+2 more)

### Community 65 - "Using Agent Skills Skill"
Cohesion: 0.32
Nodes (8): Performance Optimization Skill, Planning and Task Breakdown Skill, Security and Hardening Skill, Shipping and Launch Skill, Source-Driven Development Skill, Spec-Driven Development Skill, Test-Driven Development Skill, Using Agent Skills Skill

### Community 66 - "detect-html.mjs"
Cohesion: 0.10
Nodes (39): mergeDesignSystemFindings(), detectUrl(), runVisualContrastFallback(), serializeDesignSystemForBrowser(), CSS_IN_JS_EXTENSIONS, detectText(), extFromFilePath(), extractCSSinJS() (+31 more)

### Community 67 - "collectBrowserFindings"
Cohesion: 0.18
Nodes (14): browserDesignSystemConfig(), browserFindingsFromMap(), browserHasDirectText(), browserPrimaryFont(), browserRadiusTokens(), browserSampleText(), checkBrowserDesignSystemSources(), checkElementDesignSystemDOM() (+6 more)

### Community 68 - "palette.mjs"
Cohesion: 0.24
Nodes (7): args, buildWeights(), hashUnit(), pickSeed(), seed, SEEDS, weightedPick()

### Community 69 - "resolveWorkspaceProjectRoot"
Cohesion: 0.33
Nodes (9): escapeRegExp(), isExcludedByWorkspacePattern(), MONOREPO_FALLBACK_PROJECT_DIRS, normalizeWorkspacePattern(), projectRootFromDoubleStarPattern(), projectRootFromWorkspacePattern(), resolveWorkspaceProjectRoot(), segmentMatches() (+1 more)

### Community 70 - "colorize.md"
Cohesion: 0.06
Nodes (32): Accent Color Application, Accessibility, Alpha Is A Design Smell, Assess Color Opportunity, Background & Surfaces, Balance & Refinement, Borders & Accents, Building Functional Palettes (+24 more)

### Community 73 - "UX Writing"
Cohesion: 0.06
Nodes (31): Apply Clarity Principles, Assess Current Copy, Avoid Redundant Copy, Button & CTA Text, Confirmation Dialogs, Confirmation Dialogs: Use Sparingly, Consistency: The Terminology Problem, Don't Blame the User (+23 more)

### Community 74 - "discoverTargetCandidates"
Cohesion: 0.23
Nodes (12): directChildDirs(), discoverRootsForPattern(), discoverTargetCandidates(), expandSimplePattern(), findTargetExample(), hasFallbackWorkspaceChildren(), isCandidateProjectRoot(), isIgnoredWorkspaceDiscoveryDir() (+4 more)

### Community 75 - "Code Review and Quality"
Cohesion: 0.07
Nodes (29): 1. Correctness, 2. Readability & Simplicity, 3. Architecture, 4. Security, 5. Performance, Change Descriptions, Change Sizing, Code Review and Quality (+21 more)

### Community 76 - "serializeFindings"
Cohesion: 0.25
Nodes (9): buildSelectorSegment(), generateSelector(), isElementHidden(), isLikelyHashedClass(), postSerializedFindings(), renderBrowserFindings(), scanResultMeta(), serializeFindings() (+1 more)

### Community 77 - "Git Workflow and Versioning"
Cohesion: 0.07
Nodes (26): 1. Commit Early, Commit Often, 2. Atomic Commits, 3. Descriptive Messages, 4. Keep Concerns Separate, 5. Size Your Changes, Branch Naming, Branching Strategy, Change Summaries (+18 more)

### Community 78 - "Browser Testing with DevTools"
Cohesion: 0.08
Nodes (24): Accessibility Verification with DevTools, Available Tools, Browser Testing with DevTools, Clean Console Standard, Common Rationalizations, Console Analysis Patterns, Content Boundary Markers, For Network Issues (+16 more)

### Community 79 - "acceptedDomAlreadyClean"
Cohesion: 0.53
Nodes (6): acceptedDomAlreadyClean(), ensureAcceptedDomClean(), findAcceptedRuntimeWrappers(), reloadAfterMissingAcceptedDom(), restoreAcceptedDomFromSnapshot(), scheduleAcceptCleanup()

### Community 80 - "document.md"
Cohesion: 0.08
Nodes (24): Component translation rules, Narrative mapping, Pitfalls, Scan mode (approach C: auto-extract, then confirm descriptive language), Schema, Seed mode, Step 1: Confirm seed mode, Step 1: Find the design assets (+16 more)

### Community 81 - "isGeneratedFile"
Cohesion: 0.70
Nodes (4): hasGeneratedHeader(), HEADER_MARKERS, isGeneratedFile(), isGitIgnored()

### Community 82 - "Impeccable Frontend Skill"
Cohesion: 0.40
Nodes (5): Impeccable Frontend Skill, Impeccable Audit Reference, Impeccable Brand Register, Impeccable Codex Reference, Impeccable Craft Reference

### Community 83 - "Polish Reference"
Cohesion: 0.50
Nodes (4): Polish Reference, Quieter Design Reference, Shape Design Brief Reference, Typography Reference

### Community 84 - "detect.mjs"
Cohesion: 0.50
Nodes (3): candidates, detectorPath, __dirname

### Community 87 - "main.js"
Cohesion: 0.13
Nodes (32): getSession(), getUserRole(), login(), logout(), setDevRole(), invalidateBCVCache(), supabase, unsubscribeGlobalRealtime() (+24 more)

### Community 88 - "parseRgb"
Cohesion: 0.25
Nodes (18): checkColors(), checkElementAIPaletteDOM(), checkElementColors(), checkElementColorsDOM(), checkElementGlow(), checkElementGlowDOM(), checkGlow(), parseColorResolved() (+10 more)

### Community 92 - "readConfig"
Cohesion: 0.28
Nodes (8): cloneDefaultConfig(), detectorSection(), hookSection(), readConfig(), safeReadJson(), writeAuditLog(), main(), readStdin()

### Community 101 - "initGlobalBar"
Cohesion: 0.11
Nodes (35): barPaletteForTheme(), brandMarkSvg(), buildDesignHeader(), cursorForInsertAxis(), designPanelCss(), detectPageTheme(), ensureAgentPollTooltip(), fetchAgentPollingStatus() (+27 more)

### Community 102 - "sanitize.js"
Cohesion: 0.11
Nodes (18): t1, t2, t3, adminMainOutput, guardModalOutput, headerOutput, resOutput, state (+10 more)

### Community 114 - "API and Interface Design"
Cohesion: 0.08
Nodes (23): 1. Contract First, 2. Consistent Error Semantics, 3. Validate at Boundaries, 4. Prefer Addition Over Modification, 5. Predictable Naming, API and Interface Design, Common Rationalizations, Core Principles (+15 more)

### Community 115 - "CI/CD and Automation"
Cohesion: 0.08
Nodes (23): Automation Beyond CI, Basic CI Pipeline, Build Cop Role, CI/CD and Automation, CI Optimization, Common Rationalizations, Dependabot / Renovate, Deployment Strategies (+15 more)

### Community 116 - "Deprecation and Migration"
Cohesion: 0.08
Nodes (23): Adapter Pattern, Code Is a Liability, Common Rationalizations, Compulsory vs Advisory Deprecation, Core Principles, Database Schema Migrations (Expand/Contract), Deprecation and Migration, Deprecation Planning Starts at Design Time (+15 more)

### Community 117 - "Frontend UI Engineering"
Cohesion: 0.08
Nodes (23): Accessibility (WCAG 2.1 AA), ARIA Labels, Avoid the AI Aesthetic, Color, Common Rationalizations, Component Architecture, Component Patterns, Design System Adherence (+15 more)

### Community 118 - "Context Engineering"
Cohesion: 0.09
Nodes (22): Anti-Patterns, Common Rationalizations, Confusion Management, Context Engineering, Context Packing Strategies, Level 1: Rules Files, Level 2: Specs and Architecture, Level 3: Relevant Source Files (+14 more)

### Community 119 - "Incremental Implementation"
Cohesion: 0.09
Nodes (22): Common Rationalizations, Contract-First Slicing, Implementation Rules, Increment Checklist, Incremental Implementation, Overview, Red Flags, Risk-First Slicing (+14 more)

### Community 120 - "onboard.md"
Cohesion: 0.09
Nodes (22): Assess Onboarding Needs, Context Over Ceremony, Contextual Help, Design Onboarding Experiences, Documentation & Help, Empty State Design, Feature Discovery & Adoption, Guided Tours & Walkthroughs (+14 more)

### Community 121 - "Code Simplification"
Cohesion: 0.09
Nodes (21): 1. Preserve Behavior Exactly, 2. Follow Project Conventions, 3. Prefer Clarity Over Cleverness, 4. Maintain Balance, 5. Scope to What Changed, Code Simplification, Common Rationalizations, Language-Specific Guidance (+13 more)

### Community 122 - "Debugging and Error Recovery"
Cohesion: 0.09
Nodes (21): Build Failure Triage, Common Rationalizations, Debugging and Error Recovery, Error-Specific Patterns, Instrumentation Guidelines, Overview, Red Flags, Runtime Error Triage (+13 more)

### Community 123 - "Documentation and ADRs"
Cohesion: 0.10
Nodes (20): ADR Lifecycle, ADR Template, API Documentation, Architecture Decision Records (ADRs), Changelog Maintenance, Common Rationalizations, Document Known Gotchas, Documentation and ADRs (+12 more)

### Community 124 - "The Toolkit"
Cohesion: 0.10
Nodes (20): Animate complex properties, Assess What "Extraordinary" Means Here, For data-heavy interfaces, For functional UI, For performance-critical UI, For visual/marketing surfaces, Implement with Discipline, Interact with the device (+12 more)

### Community 125 - "Delight Techniques"
Cohesion: 0.11
Nodes (18): Appropriate to Context, Assess Delight Opportunities, Celebration Moments, Compound Over Time, Delight Amplifies, Never Blocks, Delight Principles, Delight Techniques, Easter Eggs & Hidden Delights (+10 more)

### Community 126 - "ReOrder: Keep Your Regulars Ordering Direct"
Cohesion: 0.11
Nodes (17): Example 1: Vague Early-Stage Concept (Full 3-Phase Session), Example 2: Feature Idea Within an Existing Product (Codebase-Aware), Example 3: Process/Workflow Idea (Non-Product), Ideation Session Examples, Key Assumptions to Validate, MVP Scope, Not Doing (and Why), Open Questions (+9 more)

### Community 127 - "Interview Me"
Cohesion: 0.11
Nodes (17): Common Rationalizations, Example, Interaction with Other Skills, Interview Me, Loading Constraints, Output, Overview, Red Flags (+9 more)

### Community 128 - "Interaction Design"
Cohesion: 0.11
Nodes (17): CSS Anchor Positioning, Destructive Actions: Undo > Confirm, Dropdown & Overlay Positioning, Fixed Positioning Fallback, Focus Rings: Do Them Right, Form Design: The Non-Obvious, Gesture Discoverability, Interaction Design (+9 more)

### Community 129 - "Doubt-Driven Development"
Cohesion: 0.12
Nodes (15): Common Rationalizations, Cross-model escalation, Doubt-Driven Development, Interaction with Other Skills, Loading Constraints, Overview, Red Flags, Step 1: CLAIM — Surface what stands (+7 more)

### Community 130 - "Idea Refine"
Cohesion: 0.13
Nodes (14): Anti-patterns to Avoid, Detailed Instructions, How It Works, Idea Refine, Output, Phase 1: Understand & Expand (Divergent), Phase 2: Evaluate & Converge, Phase 3: Sharpen & Ship (+6 more)

### Community 131 - "Process"
Cohesion: 0.13
Nodes (14): 1. Define "working" before instrumenting, 2. Pick the right signal for each question, 3. Structured logging, 4. Metrics, 5. Distributed tracing, 6. Alerting, 7. Verify the telemetry itself, Common Rationalizations (+6 more)

### Community 132 - "live.md"
Cohesion: 0.14
Nodes (13): Cleanup, Exit, Handle `accept`, Handle `discard`, Handle `manual_edit_apply`, Handle `prefetch`, Handle `steer`, Poll loop (+5 more)

### Community 133 - "Optimization Strategy"
Cohesion: 0.14
Nodes (13): Animation Performance, Assess Performance Issues, Core Web Vitals Optimization, Cumulative Layout Shift (CLS < 0.1), First Input Delay (FID < 100ms) / INP (< 200ms), Largest Contentful Paint (LCP < 2.5s), Loading Performance, Network Optimization (+5 more)

### Community 135 - "event-validation.mjs"
Cohesion: 0.26
Nodes (12): FORBIDDEN_MANUAL_EDIT_TEXT_CHARS, INSERT_POSITIONS, isValidId(), isValidVariantId(), validateAnnotationFields(), validateEvent(), validateInsertGenerate(), validateManualEditEvent() (+4 more)

### Community 136 - "Amplify the Design"
Cohesion: 0.15
Nodes (12): Amplify the Design, Assess Current State, Color Amplification, Composition Boldness, Design-System Lock, Motion & Animation, Plan Amplification, Register (+4 more)

### Community 137 - "extract_needs.cjs"
Cohesion: 0.25
Nodes (7): adminLines, fs, guardLines, incStart, incSubmitStart, startConfirm, startPause

### Community 138 - "Refinement & Evaluation Criteria"
Cohesion: 0.17
Nodes (11): 1. User Value, 2. Feasibility, 3. Differentiation, Assumption Audit, Core Evaluation Dimensions, Decision Framework, Might Be True (Nice to Have), Must Be True (Dealbreakers) (+3 more)

### Community 139 - "animate.md"
Cohesion: 0.20
Nodes (7): Assess Adaptation Challenge, Implement & Verify, Assess Animation Opportunities, Plan Animation Strategy, Register, Verify Quality, Recommended Actions

### Community 140 - "Simplify the Design"
Cohesion: 0.17
Nodes (11): Assess Current State, Code Simplification, Content Simplification, Document Removed Complexity, Information Architecture, Interaction Simplification, Layout Simplification, Plan Simplification (+3 more)

### Community 141 - "Hardening Dimensions"
Cohesion: 0.17
Nodes (11): Accessibility Resilience, Assess Hardening Needs, Edge Cases & Boundary Conditions, Error Handling, Hardening Dimensions, Input Validation & Sanitization, Internationalization (i18n), Performance Resilience (+3 more)

### Community 142 - "critique.md"
Cohesion: 0.18
Nodes (10): Action Summary, Ask the User, Assessment A: Design Review, Assessment B: Detector + Browser Evidence, Assessment Orchestration, Hard Invariants, Persist the Snapshot, Purpose (+2 more)

### Community 143 - "Nielsen's 10 Heuristics"
Cohesion: 0.18
Nodes (11): 10. Help and Documentation, 1. Visibility of System Status, 2. Match Between System and Real World, 3. User Control and Freedom, 4. Consistency and Standards, 5. Error Prevention, 6. Recognition Rather Than Recall, 7. Flexibility and Efficiency of Use (+3 more)

### Community 144 - "Handle `generate`"
Cohesion: 0.18
Nodes (11): 1. Read the screenshot (if present), 2. Wrap the element, 3. Load the action's reference, 5. Apply the freeform prompt (if present), 6. Write all variants in a single edit, 7. Parameters (composition-sized, 0–4 per variant), 8. Signal done, Aborting an in-flight session (+3 more)

### Community 145 - "adapt.md"
Cohesion: 0.20
Nodes (9): Assess Adaptation Challenge, Content Adaptation, Implement Adaptations, Layout Adaptation Techniques, Navigation Adaptation, Reference Material, Responsive Breakpoints, Touch Adaptation (+1 more)

### Community 146 - "Responsive Design"
Cohesion: 0.20
Nodes (10): Breakpoints: Content-Driven, Detect Input Method, Not Just Screen Size, Layout Adaptation Patterns, Mobile-First: Write It Right, Picture Element for Art Direction, Responsive Design, Responsive Images: Get It Right, Safe Areas: Handle the Notch (+2 more)

### Community 147 - "Generate Combined Critique Report"
Cohesion: 0.20
Nodes (10): Anti-Patterns Verdict, Design Health Score, Generate Combined Critique Report, Minor Observations, Overall Impression, Persona Red Flags, Priority Issues, Questions to Consider (+2 more)

### Community 148 - "Step 3: Ask strategic questions (for PRODUCT.md)"
Cohesion: 0.20
Nodes (10): Accessibility & Inclusion, Brand & Personality, Conversion & proof (brand register only), Interview mode, not confirmation mode, Minimum viable interview, Platform (ask right after register), Positioning, Register (ask first; it shapes everything below) (+2 more)

### Community 149 - "Ideation Frameworks Reference"
Cohesion: 0.22
Nodes (8): Analogous Inspiration, Constraint-Based Ideation, First Principles Thinking, How Might We (HMW), Ideation Frameworks Reference, Jobs to Be Done (JTBD), Pre-mortem, SCAMPER

### Community 150 - "Common Cognitive Load Violations"
Cohesion: 0.22
Nodes (9): 1. The Wall of Options, 2. The Memory Bridge, 3. The Hidden Navigation, 4. The Jargon Barrier, 5. The Visual Noise Floor, 6. The Inconsistent Pattern, 7. The Multi-Task Demand, 8. The Context Switch (+1 more)

### Community 151 - "Technical Implementation"
Cohesion: 0.25
Nodes (8): Accessibility, CSS Animations, JavaScript Animation, Motion Materials, Perceived Performance, Performance, Technical Implementation, Timing & Easing

### Community 152 - "Persona-Based Design Testing"
Cohesion: 0.25
Nodes (8): 1. Impatient Power User: "Alex", 2. Confused First-Timer: "Jordan", 3. Accessibility-Dependent User: "Sam", 4. Deliberate Stress Tester: "Riley", 5. Distracted Mobile User: "Casey", Persona-Based Design Testing, Project-Specific Personas, Selecting Personas

### Community 153 - "Extract Flow"
Cohesion: 0.25
Nodes (7): Extract Flow, Step 1: Discover the Design System, Step 2: Identify Patterns, Step 3: Plan Extraction, Step 4: Extract & Enrich, Step 5: Migrate, Step 6: Document

### Community 154 - "Init Flow"
Cohesion: 0.25
Nodes (7): Init Flow, Step 1: Load current state, Step 2: Explore the codebase, Step 4: Write PRODUCT.md, Step 5: Decide on DESIGN.md, Step 6: Configure live mode (when code exists), Step 7: Recommend starting points, then wrap up

### Community 155 - "iOS platform"
Cohesion: 0.25
Nodes (8): Color & materials, Components & controls, iOS platform, Layout & structure, Motion, The iOS slop test, Touch targets, Typography

### Community 156 - "Improve Layout Systematically"
Cohesion: 0.25
Nodes (8): Break Card Grid Monotony, Choose the Right Layout Tool, Create Visual Rhythm, Establish a Spacing System, Improve Layout Systematically, Manage Depth & Elevation, Optical Adjustments, Strengthen Visual Hierarchy

### Community 157 - "modify_guard.cjs"
Cohesion: 0.25
Nodes (7): content, fs, newActions, newPayForm, newSubForm, oldActions, oldSubForm

### Community 158 - "captureElementToBlob"
Cohesion: 0.13
Nodes (20): averageRgb01(), captureChromeNodes(), captureElementFromRenderedAncestor(), captureElementToBlob(), compileShader(), cssColorToRgb01(), dominantRgb01(), findBackdropAncestor() (+12 more)

### Community 159 - "guard.js"
Cohesion: 0.29
Nodes (14): getSyncQueueCount(), hasFeature(), logNotification(), updateParkingState(), initGuard(), renderPushBanner(), subscribeToPushNotifications(), urlBase64ToUint8Array() (+6 more)

### Community 160 - "test-db.js"
Cohesion: 0.25
Nodes (6): __dirname, env, envContent, envPath, __filename, supabase

### Community 161 - "patch_recent_movs.js"
Cohesion: 0.33
Nodes (5): code, codeNorm, fs, replacementNorm, targetNorm

### Community 162 - "Android platform"
Cohesion: 0.29
Nodes (7): Android platform, Color & theming, Components & motion, Layout & structure, The Android slop test, Touch targets, Typography

### Community 163 - "Implement Animations"
Cohesion: 0.29
Nodes (7): Delight Moments, Entrance Animations, Feedback & Guidance, Implement Animations, Micro-interactions, Navigation & Flow, State Transitions

### Community 164 - "Generate Report"
Cohesion: 0.29
Nodes (7): Audit Health Score, Detailed Findings by Severity, Executive Summary, Generate Report, Patterns & Systemic Issues, Platform Conformance Verdict, Positive Findings

### Community 165 - "Cognitive Load Assessment"
Cohesion: 0.29
Nodes (7): Cognitive Load Assessment, Cognitive Load Checklist, Extraneous Load: Bad Design, Germane Load: Learning Effort, Intrinsic Load: The Task Itself, The Working Memory Rule, Three Types of Cognitive Load

### Community 166 - "/impeccable hooks"
Cohesion: 0.29
Nodes (6): Constraints, Failure modes, Flow, /impeccable hooks, Intentional findings, Routing

### Community 167 - "layout.md"
Cohesion: 0.29
Nodes (6): Assess Current Layout, Live-mode signature params, Plan Layout Improvements, Register, Two isolated assessments (required), Verify Layout Improvements

### Community 168 - "CSP detection (first-time only)"
Cohesion: 0.29
Nodes (7): append-arrays, append-string, Consent prompt template, CSP detection (first-time only), Drift-heal warning, First-time setup (config missing or invalid), Troubleshooting

### Community 169 - "print_raw_sub_form.cjs"
Cohesion: 0.33
Nodes (5): content, fs, idxCl, idxPay, idxSub

### Community 170 - "Plan Adaptation Strategy"
Cohesion: 0.33
Nodes (6): Desktop Adaptation (Mobile → Desktop), Email Adaptation (Web → Email), Mobile Adaptation (Desktop → Mobile), Plan Adaptation Strategy, Print Adaptation (Screen → Print), Tablet Adaptation (Hybrid Approach)

### Community 171 - "Diagnostic Scan"
Cohesion: 0.33
Nodes (6): 1. Accessibility (VoiceOver / TalkBack), 2. Performance, 3. Appearance & Theming, 4. Platform Conformance (CRITICAL), 5. Adaptivity, Diagnostic Scan

### Community 172 - "extract.js"
Cohesion: 0.40
Nodes (3): content, fs, lines

### Community 173 - "Adaptation Strategies"
Cohesion: 0.40
Nodes (5): Adaptation Strategies, Orientation & foldables, Phone → Tablet (iPad / large screens), Platform → platform (iOS ↔ Android), Web → native (porting a website or web app)

### Community 174 - "4. Plan three variants: identity first, then mode, then axes"
Cohesion: 0.40
Nodes (5): 4. Plan three variants: identity first, then mode, then axes, Phase A: Extract the identity (non-skippable), Phase B: Pick mode (default vs departure), Phase C: Plan three variants, Phase D: Squint test

### Community 175 - "Handle fallback"
Cohesion: 0.40
Nodes (5): Handle fallback, Step 1: Identify where the element actually lives, Step 2: Show three variants in the DOM for preview, Step 3: On accept, write to true source, Step 4: On discard, clean up the served file

### Community 176 - "extract_specifics.cjs"
Cohesion: 0.40
Nodes (3): content, fs, lines

### Community 177 - "modify_guard_sections.cjs"
Cohesion: 0.40
Nodes (4): content, fs, idxEnd, idxStart

### Community 178 - "move_to_backup.js"
Cohesion: 0.40
Nodes (4): BACKUP_DIR, fs, path, TARGET_FILES

### Community 179 - "read_sections.cjs"
Cohesion: 0.40
Nodes (4): content, lines, sections, fs

### Community 180 - "search_lines.cjs"
Cohesion: 0.40
Nodes (3): content, fs, lines

### Community 181 - "Heuristics Scoring Guide"
Cohesion: 0.50
Nodes (4): Heuristics Scoring Guide, Issue Severity (P0–P3), Reference Material, Score Summary

### Community 182 - "debug.cjs"
Cohesion: 0.50
Nodes (3): fs, textAdmin, textGuard

### Community 183 - "find_line_numbers.cjs"
Cohesion: 0.50
Nodes (3): content, fs, lines

### Community 184 - "modify_guard.js"
Cohesion: 0.50
Nodes (3): content, fs, newExitBlockSub

### Community 185 - "normalize-fonts.js"
Cohesion: 0.50
Nodes (3): code, fs, replaces

### Community 186 - "print_actions_sub.cjs"
Cohesion: 0.50
Nodes (3): content, fs, lines

### Community 187 - "print_after_closure.cjs"
Cohesion: 0.50
Nodes (3): content, fs, lines

### Community 188 - "print_exit_amount_block.cjs"
Cohesion: 0.50
Nodes (3): content, fs, lines

### Community 189 - "print_exit_and_payment_forms.cjs"
Cohesion: 0.50
Nodes (3): content, fs, lines

### Community 190 - "print_exit_form_top.cjs"
Cohesion: 0.50
Nodes (3): content, fs, lines

### Community 191 - "print_head.cjs"
Cohesion: 0.50
Nodes (3): content, fs, lines

### Community 192 - "print_pay_const.cjs"
Cohesion: 0.50
Nodes (3): content, fs, lines

### Community 193 - "print_rate_usage.cjs"
Cohesion: 0.50
Nodes (3): content, fs, lines

### Community 194 - "print_sub_and_closure.cjs"
Cohesion: 0.50
Nodes (3): content, fs, lines

### Community 195 - "read.js"
Cohesion: 0.50
Nodes (3): content, fs, lines

### Community 196 - "scratch_backup/read_sections.js"
Cohesion: 0.50
Nodes (3): content, lines, sections

### Community 200 - "readWorkspacePatterns"
Cohesion: 0.32
Nodes (8): parseYamlFlowList(), readJson(), readLernaWorkspaces(), readPackageWorkspaces(), readPnpmWorkspaces(), readWorkspacePatterns(), stripYamlInlineComment(), unquoteYamlValue()

### Community 208 - "resolveProjectRoot"
Cohesion: 0.29
Nodes (7): resolveProjectRoot(), getLegacyLiveAnnotationsDir(), getLegacyLiveServerPath(), parseTargetOptions(), parseTargetPath(), TargetArgError, resolveLiveTarget()

### Community 209 - "applyDeferredSvelteComponentAccepts"
Cohesion: 0.32
Nodes (8): applyLegacyDeferredAcceptsOnStartup(), applyDeferredSvelteComponentAccepts(), deferredAcceptsPath(), findSvelteComponentManifest(), manifestPathForSession(), readDeferredAccepts(), readManifest(), writeDeferredAccept()

### Community 210 - "normalizeGitHubEvent"
Cohesion: 0.47
Nodes (6): applyPatchText(), envProjectDir(), looksLikeApplyPatch(), normalizeGitHubEvent(), normalizeHookEvent(), parseGitHubToolArgs()

## Knowledge Gaps
- **950 isolated node(s):** `idea-refine.sh script`, `COMMON_DEV_PORTS`, `SOURCE_DIRS`, `PRODUCT_NAMES`, `DESIGN_NAMES` (+945 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **31 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `el()` connect `el` to `live-browser.js`, `SAFE_TAGS`, `detect-html.mjs`, `index.mjs`, `checks.mjs`, `design-system.mjs`, `setLiveState`, `css-cascade.mjs`, `initGlobalBar`, `serializeFindings`, `showToast`, `detect-antipatterns-browser.js`, `refreshParamsPanel`, `GENERIC_FONTS`, `collectVisualContrastCandidates`?**
  _High betweenness centrality (0.143) - this node is a cross-community bridge._
- **Why does `raw()` connect `sanitize.js` to `design-parser.mjs`, `admin.js`, `design-system.mjs`, `guard.js`?**
  _High betweenness centrality (0.080) - this node is a cross-community bridge._
- **Why does `collectStaticDesignSystemFindings()` connect `design-system.mjs` to `detect-antipatterns.mjs`, `el`, `detect-html.mjs`, `sanitize.js`?**
  _High betweenness centrality (0.060) - this node is a cross-community bridge._
- **Are the 16 inferred relationships involving `el()` (e.g. with `collectVisualContrastCandidates()` and `renderBrowserFindings()`) actually correct?**
  _`el()` has 16 INFERRED edges - model-reasoned connections that need verification._
- **What connects `idea-refine.sh script`, `COMMON_DEV_PORTS`, `SOURCE_DIRS` to the rest of the system?**
  _950 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `live-browser.js` be split into smaller, more focused modules?**
  _Cohesion score 0.03014271653543307 - nodes in this community are weakly interconnected._
- **Should `checks.mjs` be split into smaller, more focused modules?**
  _Cohesion score 0.045715778474399164 - nodes in this community are weakly interconnected._