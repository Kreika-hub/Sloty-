# Graph Report - .  (2026-07-30)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 2392 nodes · 6229 edges · 113 communities (89 shown, 24 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 92 edges (avg confidence: 0.64)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `ea7fda27`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- live-browser.js
- checks.mjs
- db.js
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
- detect-html.mjs
- live-server.mjs
- el
- hook-before-edit.mjs
- insert-ui.mjs
- live-wrap.mjs
- design-parser.mjs
- initGlobalBar
- live-accept.mjs
- live-copy-edit-agent.mjs
- parseRgb
- detect-text.mjs
- workbox-4874b91b.js
- workbox-98d2c6d7.js
- context.mjs
- detect-antipatterns.mjs
- live-poll.mjs
- live-manual-edit-evidence.mjs
- handleManualEditActivity
- captureElementToBlob
- parseRgb
- manual-edit-routes.mjs
- runHook
- readLiveServerInfo
- context-signals.mjs
- impeccable-paths.mjs
- live.mjs
- renderGroupedTemplate
- onAnnotDown
- package.json
- StrategyHandler
- Router
- StrategyHandler
- Router
- parseAnyColor
- refreshParamsPanel
- sampleCssBackground
- checkQuality
- .constructor
- .constructor
- resolveContext
- GENERIC_FONTS
- critique-storage.mjs
- scheduleLazyVisualContrast
- pin.mjs
- ui-core.mjs
- session-store.mjs
- Using Agent Skills Skill
- checkHeroEyebrow
- collectBrowserFindings
- palette.mjs
- resolveWorkspaceProjectRoot
- documentRefForElement
- CacheTimestampsModel
- CacheTimestampsModel
- cli
- discoverTargetCandidates
- checkElementTextOverflowDOM
- serializeFindings
- normalizeGitHubEvent
- browser-script-parts.mjs
- acceptedDomAlreadyClean
- isGeneratedFile
- Impeccable Frontend Skill
- Polish Reference
- detect.mjs
- NetworkOnly
- NetworkOnly
- normalize-fonts.js
- read_file.js
- Route
- Route
- idea-refine.sh
- Index HTML
- PWA Maskable Icon
- Sloty Logo Negro
- bcv-rate/index.ts
- notify-new-payment/index.ts
- Product Register Reference
- Guard PIN Screen
- Login Screen
- Main Screen
- PWA Icon 192x192
- WhatsApp Icon
- Sloty Logo V2 (Yellow Outline)
- Register Screen
- Resident Screen
- Welcome Screen

## God Nodes (most connected - your core abstractions)
1. `el()` - 42 edges
2. `runHook()` - 36 edges
3. `setLiveState()` - 29 edges
4. `detectHtml()` - 28 edges
5. `initGlobalBar()` - 28 edges
6. `main()` - 27 edges
7. `collectBrowserFindings()` - 26 edges
8. `buildInsertConfigureRow()` - 26 edges
9. `handleKeyDown()` - 26 edges
10. `showToast()` - 25 edges

## Surprising Connections (you probably didn't know these)
- `Index HTML` --conceptually_related_to--> `Sloty Product`  [INFERRED]
  index.html → PRODUCT.md
- `collectVisualContrastReasons()` --indirect_call--> `x()`  [INFERRED]
  .cursor/skills/impeccable/scripts/detector/browser/injected/index.mjs → .cursor/skills/impeccable/scripts/modern-screenshot.umd.js
- `collectVisualContrastCandidates()` --indirect_call--> `el()`  [INFERRED]
  .cursor/skills/impeccable/scripts/detector/browser/injected/index.mjs → .cursor/skills/impeccable/scripts/live-browser.js
- `textSamplePoints()` --indirect_call--> `x()`  [INFERRED]
  .cursor/skills/impeccable/scripts/detector/browser/injected/index.mjs → .cursor/skills/impeccable/scripts/modern-screenshot.umd.js
- `renderBrowserFindings()` --indirect_call--> `el()`  [INFERRED]
  .cursor/skills/impeccable/scripts/detector/browser/injected/index.mjs → .cursor/skills/impeccable/scripts/live-browser.js

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Agent Skills Framework** — agents_skills_using_agent_skills_skill, agents_skills_spec_driven_development_skill, agents_skills_planning_and_task_breakdown_skill, agents_skills_test_driven_development_skill, agents_skills_performance_optimization_skill, agents_skills_security_and_hardening_skill, agents_skills_shipping_and_launch_skill [EXTRACTED 1.00]
- **Application Screens** — welcome_screen, login_screen, register_screen, guard_pin_screen, resident_screen, main_screen [EXTRACTED 1.00]
- **Impeccable Design System Reference** — cursor_skills_impeccable_reference_polish, cursor_skills_impeccable_reference_product, cursor_skills_impeccable_reference_quieter, cursor_skills_impeccable_reference_shape, cursor_skills_impeccable_reference_typeset [EXTRACTED 1.00]
- **Sloty Brand Identity Assets** — public_logo_jpg, public_sloty_logo_v2_png, public_icons_sloty_logo_negro_png, public_icons_maskable_icon_512x512_png [INFERRED 0.85]

## Communities (113 total, 24 thin omitted)

### Community 0 - "live-browser.js"
Cohesion: 0.03
Nodes (125): addManualContextText(), applyGlobalBarLabelState(), applyPlaceholderSizingStyles(), applySvelteComponentVariantStyle(), bindEditBadgeProxy(), bufferToBase64(), buildCollapsible(), buildColorModels() (+117 more)

### Community 1 - "checks.mjs"
Cohesion: 0.05
Nodes (80): borderColorsFromStyle(), borderWidthsFromStyle(), checkBorders(), checkClippedOverflow(), checkCreamPalette(), checkElementBorders(), checkElementBordersDOM(), checkElementClippedOverflow() (+72 more)

### Community 2 - "db.js"
Cohesion: 0.09
Nodes (60): getSession(), getUserRole(), login(), setDevRole(), cleanQueue(), defaultState, enqueueSync(), getBuildingPlan() (+52 more)

### Community 3 - "index.mjs"
Cohesion: 0.06
Nodes (68): addBrowserFindings(), addVisualContrastFindings(), addVisualContrastResult(), analyzeVisualContrast(), analyzeVisualContrastCandidate(), blendRgba(), browserColorsClose(), browserDesignSystemConfig() (+60 more)

### Community 4 - "setLiveState"
Cohesion: 0.09
Nodes (71): abortSvelteComponentInjection(), applyEditing(), buildCyclingRow(), buildInsertPlaceholderSnapshotFromDom(), buildLocatorForLeaf(), buildSavingRow(), cancelEditing(), cancelEditingToPicking() (+63 more)

### Community 5 - "design-system.mjs"
Cohesion: 0.09
Nodes (54): addColorObject(), addDesignColor(), addRoundedScale(), addRoundedToken(), addSidecarColors(), addSidecarRadii(), addTypographyFonts(), addTypographySizes() (+46 more)

### Community 6 - "modern-screenshot.umd.js"
Cohesion: 0.09
Nodes (52): ae(), be(), bt(), Ce(), Ct(), de(), dt(), _e() (+44 more)

### Community 7 - "css-cascade.mjs"
Cohesion: 0.07
Nodes (30): applyStaticDeclaration(), buildBorderOverrideMap(), buildStaticStyleMap(), collectStaticCssRules(), compareStaticPriority(), cssPropToCamel(), expandStaticBoxValues(), expandStaticDeclaration() (+22 more)

### Community 8 - "resumeSession"
Cohesion: 0.09
Nodes (52): applyOriginalAttrsToSvelteAnchor(), applySavedSessionMeta(), clampVariantIndex(), clearHandled(), commitAcceptedSvelteComponentToDom(), cycleVariant(), elementMatchesOriginalMarkup(), ensureInsertPlaceholder() (+44 more)

### Community 9 - "live-inject.mjs"
Cohesion: 0.08
Nodes (48): detectCsp(), INLINE_HEADER_SIGNALS, LAYOUT_EXTS, MONOREPO_HELPER_SIGNALS, NUXT_ROUTE_RULES_SIGNALS, NUXT_SECURITY_SIGNALS, SCAN_EXTS, SKIP_DIRS (+40 more)

### Community 10 - "hook-lib.mjs"
Cohesion: 0.07
Nodes (49): ACK_EXTS, applyConfigSource(), applyDetectorConfigSource(), clampByte(), cloneDefaultConfig(), CO_SCAN_STYLE_NAMES, coLocatedStylesheets(), colorIgnoreKey() (+41 more)

### Community 11 - "live-commit-manual-edits.mjs"
Cohesion: 0.11
Nodes (49): allEntryIds(), argVal(), buildRepairBatch(), candidatesForEntry(), changedFilesSinceSnapshot(), clearAppliedEntries(), collectApplyOwnedFiles(), collectRollbackFiles() (+41 more)

### Community 12 - "impeccable-config.mjs"
Cohesion: 0.10
Nodes (47): applyDetectionConfigSource(), clampByte(), cleanIgnoreValueDisplay(), cloneDetectionConfig(), cloneRawDetectionConfig(), colorIgnoreKey(), DEFAULT_DETECTION_CONFIG, DETECTOR_CONFIG_KEYS (+39 more)

### Community 13 - "showToast"
Cohesion: 0.07
Nodes (54): applyConfigureBarChrome(), armPageChatForTyping(), attachSteerFocusDebug(), attachSteerFocusGuard(), clearSteerAwaitTimer(), clearSteerFocusRecoverTimer(), collapsePageChat(), configureVoiceContext() (+46 more)

### Community 14 - "manual-apply.mjs"
Cohesion: 0.09
Nodes (40): addOpToManualApplyChunk(), APPLY_EVENT_HARD_TIMEOUT_MS, APPLY_EVENT_SOFT_DEADLINE_MS, buildManualApplyAgentAction(), clearManualApplyTransaction(), collectManualApplyFiles(), compactManualApplyBatch(), compactManualApplyCandidates() (+32 more)

### Community 15 - "svelte-component.mjs"
Cohesion: 0.10
Nodes (44): applyLegacyDeferredAcceptsOnStartup(), appendCssToSvelteStyle(), appendSanitizedCssRule(), applyDeferredSvelteComponentAccepts(), bakeParamValuesInCss(), buildInsertVariantStub(), buildPropContract(), buildPropsScript() (+36 more)

### Community 16 - "detect-antipatterns-browser.js"
Cohesion: 0.08
Nodes (39): browserColorsClose(), browserDesignSystemConfig(), browserHasDirectText(), browserPrimaryFont(), browserRadiusTokens(), browserSampleText(), checkBorders(), checkBrowserDesignSystemSources() (+31 more)

### Community 17 - "hook-admin.mjs"
Cohesion: 0.13
Nodes (41): ACTIONS, addIgnoreFile(), addIgnoreRule(), addIgnoreValue(), DETECTOR_CONFIG_KEYS, detectorSection(), fileHasImpeccableHookMarker(), HOOK_MANIFEST_TARGETS (+33 more)

### Community 18 - "detect-html.mjs"
Cohesion: 0.12
Nodes (34): mergeDesignSystemFindings(), detectUrl(), runVisualContrastFallback(), serializeDesignSystemForBrowser(), runRegexMatchers(), runTextContentAnalyzers(), buildStaticWindow(), collectStaticCssText() (+26 more)

### Community 19 - "live-server.mjs"
Cohesion: 0.10
Nodes (37): acknowledgePendingEvent(), activeSessionSummaries(), agentPollingConnected(), annotRoot, args, broadcast(), broadcastAgentPollingIfChanged(), cancelQueuedAnonymousExitEvents() (+29 more)

### Community 20 - "el"
Cohesion: 0.10
Nodes (39): actionLabel(), bindConfigureCountPillTooltip(), bindConfigureInlineControlHover(), bindConfigureModifierPillHover(), buildConfigureActionControl(), buildConfigureCountControl(), buildConfigureRow(), buildConfigureSubmitButton() (+31 more)

### Community 21 - "hook-before-edit.mjs"
Cohesion: 0.12
Nodes (37): allow(), bumpCursorDenial(), deny(), detectProposedHtml(), done(), escapeRegExp(), findingSignature(), firstMatch() (+29 more)

### Community 22 - "insert-ui.mjs"
Cohesion: 0.08
Nodes (22): FORBIDDEN_MANUAL_EDIT_TEXT_CHARS, INSERT_POSITIONS, isValidId(), isValidVariantId(), validateAnnotationFields(), validateEvent(), validateInsertGenerate(), validateManualEditEvent() (+14 more)

### Community 23 - "live-wrap.mjs"
Cohesion: 0.13
Nodes (35): argVal(), buildInsertWrapperLines(), computeInsertLine(), INSERT_POSITIONS, insertCli(), isInsertPosition(), resolveElementMatch(), buildSvelteComponentCssAuthoring() (+27 more)

### Community 24 - "design-parser.mjs"
Cohesion: 0.15
Nodes (33): buildColor(), CANONICAL_SECTIONS, collectBullets(), collectColorValues(), collectParagraphs(), detectFormat(), extractColors(), extractComponents() (+25 more)

### Community 25 - "initGlobalBar"
Cohesion: 0.11
Nodes (35): barPaletteForTheme(), brandMarkSvg(), buildDesignHeader(), cursorForInsertAxis(), designPanelCss(), detectPageTheme(), ensureAgentPollTooltip(), fetchAgentPollingStatus() (+27 more)

### Community 26 - "live-accept.mjs"
Cohesion: 0.14
Nodes (32): acceptCli(), argVal(), buildCarbonizeReplacement(), decodeHtmlAttr(), deindentContent(), detectCommentSyntax(), escapeRegExp(), expandReplaceRange() (+24 more)

### Community 27 - "live-copy-edit-agent.mjs"
Cohesion: 0.14
Nodes (31): applyMockWrites(), buildCopyEditBatchPrompt(), checkFrameworkSourceSyntax(), chooseCopyEditAgent(), COMMAND_AUTH_CACHE, commandAuthed(), commandExists(), compactBatchForPrompt() (+23 more)

### Community 28 - "parseRgb"
Cohesion: 0.14
Nodes (31): analyzeVisualContrast(), analyzeVisualContrastCandidate(), checkColors(), checkElementAIPaletteDOM(), checkElementColors(), checkElementColorsDOM(), checkElementGlow(), checkElementGlowDOM() (+23 more)

### Community 29 - "detect-text.mjs"
Cohesion: 0.13
Nodes (21): CSS_IN_JS_EXTENSIONS, detectText(), extFromFilePath(), extractCSSinJS(), extractStyleBlocks(), isNeutralBorderColor(), PAGE_ANALYZER_EXTS, REGEX_ANALYZERS (+13 more)

### Community 30 - "workbox-4874b91b.js"
Cohesion: 0.10
Nodes (20): cacheDonePromiseForTransaction(), CacheFirst, cacheMatchIgnoreParams(), Deferred, executeQuotaErrorCallbacks(), get(), getCursorAdvanceMethods(), getIdbProxyableTypes() (+12 more)

### Community 31 - "workbox-98d2c6d7.js"
Cohesion: 0.10
Nodes (20): cacheDonePromiseForTransaction(), CacheFirst, cacheMatchIgnoreParams(), Deferred, executeQuotaErrorCallbacks(), get(), getCursorAdvanceMethods(), getIdbProxyableTypes() (+12 more)

### Community 32 - "context.mjs"
Cohesion: 0.13
Nodes (25): buildUpdateDirective(), compareSemver(), computeUpdateDirective(), DESIGN_NAMES, FALLBACK_DIRS, fetchLatestSkillVersion(), findMonorepoRoot(), hasFallbackWorkspaceChildren() (+17 more)

### Community 33 - "detect-antipatterns.mjs"
Cohesion: 0.18
Nodes (24): confirm(), detectCli(), formatFindings(), formatFindingSummary(), handleStdin(), printUsage(), createBrowserDetector(), buildImportGraph() (+16 more)

### Community 34 - "live-poll.mjs"
Cohesion: 0.18
Nodes (24): completionAckForAcceptResult(), completionTypeForAcceptResult(), augmentEventWithAcceptHandling(), buildAcceptScriptArgs(), buildPollReplyPayload(), EVENT_TYPES_NEEDING_AGENT_REPLY, fetchNextEvent(), fetchServerStatus() (+16 more)

### Community 35 - "live-manual-edit-evidence.mjs"
Cohesion: 0.15
Nodes (25): analyzeSourceHint(), buildCandidatesForOp(), buildContextHintsByRef(), collectSearchFiles(), countOps(), decodeBasicHtml(), escapeRegExp(), findContextMatches() (+17 more)

### Community 36 - "handleManualEditActivity"
Cohesion: 0.18
Nodes (25): clearStoredManualApplyState(), fetchPendingCount(), handleManualEditActivity(), hidePendingApplyDock(), manualApplyLoadingText(), manualApplyStateKey(), manualEditEventForCurrentPage(), numberOrNull() (+17 more)

### Community 37 - "captureElementToBlob"
Cohesion: 0.13
Nodes (20): averageRgb01(), captureChromeNodes(), captureElementFromRenderedAncestor(), captureElementToBlob(), compileShader(), cssColorToRgb01(), dominantRgb01(), findBackdropAncestor() (+12 more)

### Community 38 - "parseRgb"
Cohesion: 0.22
Nodes (20): checkColors(), checkElementAIPaletteDOM(), checkElementColors(), checkElementColorsDOM(), checkElementGlow(), checkElementGlowDOM(), checkElementIconTileDOM(), checkGlow() (+12 more)

### Community 39 - "manual-edit-routes.mjs"
Cohesion: 0.21
Nodes (17): args, cwd, pageUrlFilter, remaining, buildManualEditEvidence(), createManualEditRoutes(), sendJson(), summarizePendingManualEditBatch() (+9 more)

### Community 40 - "runHook"
Cohesion: 0.16
Nodes (19): appendDesignSystemNote(), bumpEditCount(), dedupeAgainstCache(), depthIsSet(), ensureFile(), ensureSession(), findingCacheKey(), isNativePlatform() (+11 more)

### Community 41 - "readLiveServerInfo"
Cohesion: 0.21
Nodes (17): isLiveServerPidReachable(), readLiveServerInfo(), completeCli(), completeThroughServer(), parseArgs(), readServerInfo(), collectManualApplyFiles(), manualApplyReplyCommand() (+9 more)

### Community 42 - "context-signals.mjs"
Cohesion: 0.19
Nodes (17): extractPlatform(), extractRegister(), extractSectionValue(), loadContext(), safeRead(), cli(), COMMON_DEV_PORTS, devServerSignals() (+9 more)

### Community 43 - "impeccable-paths.mjs"
Cohesion: 0.22
Nodes (18): resolveProjectRoot(), firstExisting(), getDesignSidecarCandidates(), getDesignSidecarPath(), getImpeccableDir(), getLegacyLiveAnnotationsDir(), getLegacyLiveConfigPath(), getLegacyLiveServerPath() (+10 more)

### Community 44 - "live.mjs"
Cohesion: 0.19
Nodes (15): resolveTargetSelection(), parseTargetOptions(), parseTargetPath(), TargetArgError, __dirname, ensureServerRunning(), globToRegex(), globToRegex() (+7 more)

### Community 45 - "renderGroupedTemplate"
Cohesion: 0.15
Nodes (19): cursorBlockMessage(), clampGroupedToBudget(), clampToBudget(), cleanIgnoreValueDisplay(), directiveFooter(), extractFindingIgnoreValue(), extractFindingIgnoreValueRaw(), extractMotionIgnoreValue() (+11 more)

### Community 46 - "onAnnotDown"
Cohesion: 0.18
Nodes (19): applyPlaceholderDimensions(), beginEditPin(), buildAnnotationsForCapture(), buildPinElement(), cancelEditingPin(), finalizeEditingPin(), initAnnotOverlay(), localCoords() (+11 more)

### Community 47 - "package.json"
Cohesion: 0.11
Nodes (18): date-fns, dependencies, date-fns, @supabase/supabase-js, vite, vite-plugin-pwa, name, private (+10 more)

### Community 48 - "StrategyHandler"
Cohesion: 0.26
Nodes (3): StaleWhileRevalidate, StrategyHandler, toRequest()

### Community 50 - "StrategyHandler"
Cohesion: 0.26
Nodes (3): StaleWhileRevalidate, StrategyHandler, toRequest()

### Community 52 - "parseAnyColor"
Cohesion: 0.19
Nodes (14): borderColorsFromStyle(), borderWidthsFromStyle(), checkCreamPalette(), checkElementGptBorderShadow(), checkElementGptBorderShadowDOM(), checkGptThinBorderWideShadow(), colorsNearlyMatch(), creamFromClassList() (+6 more)

### Community 53 - "refreshParamsPanel"
Cohesion: 0.19
Nodes (17): applyParamDefaults(), applyParamValue(), buildParamsPanel(), closedClipPath(), formatRangeValue(), getVisibleVariantEl(), hideParamsPanel(), openTunePopover() (+9 more)

### Community 54 - "sampleCssBackground"
Cohesion: 0.18
Nodes (16): blendRgba(), clampByte(), firstCssUrl(), getLayerValue(), loadVisualContrastImage(), parseObjectPosition(), parsePositionPair(), parsePositionToken() (+8 more)

### Community 55 - "checkQuality"
Cohesion: 0.12
Nodes (21): checkElementOversizedH1(), checkElementOversizedH1DOM(), checkElementQuality(), checkElementQualityDOM(), checkOversizedH1(), checkQuality(), checkRepeatedSectionKickers(), checkRepeatedSectionKickersDOM() (+13 more)

### Community 56 - ".constructor"
Cohesion: 0.29
Nodes (3): CacheExpiration, dontWaitFor(), ExpirationPlugin

### Community 57 - ".constructor"
Cohesion: 0.29
Nodes (3): CacheExpiration, dontWaitFor(), ExpirationPlugin

### Community 58 - "resolveContext"
Cohesion: 0.16
Nodes (14): contextSourcePath(), contextSourceStatus(), firstExisting(), isCandidateProjectRoot(), isPathInside(), isPathInsideOrEqual(), nearestPackageRootBetween(), resolveCandidateContextSummary() (+6 more)

### Community 59 - "GENERIC_FONTS"
Cohesion: 0.16
Nodes (16): checkPageTypography(), resolveSerif(), firstOverusedGoogleFont(), checkPageTypography(), checkTypography(), resolveSerif(), BRAND_FONT_DOMAINS, GENERIC_FONTS (+8 more)

### Community 60 - "critique-storage.mjs"
Cohesion: 0.32
Nodes (11): kebab(), listSnapshotsForSlug(), main(), nowFilenameStamp(), parseFrontmatter(), readLatestSnapshot(), readTrend(), serializeFrontmatter() (+3 more)

### Community 61 - "scheduleLazyVisualContrast"
Cohesion: 0.18
Nodes (13): addBrowserFindings(), addVisualContrastFindings(), addVisualContrastResult(), clearOverlays(), detachOverlay(), disconnectLazyVisualContrastObserver(), postExtensionError(), rememberVisualContrastAnalysis() (+5 more)

### Community 62 - "pin.mjs"
Cohesion: 0.23
Nodes (11): CODEX_HARNESSES, commandPrefixForSkillsDir(), __dirname, findHarnessDirs(), generatePinnedSkill(), HARNESS_DIRS, loadCommandMetadata(), pin() (+3 more)

### Community 63 - "ui-core.mjs"
Cohesion: 0.23
Nodes (10): createLiveBrowserDomHelpers(), activeElementDeep(), appendStyleToLiveUiRoot(), appendToLiveUiRoot(), escapeCssIdent(), getLiveUiElementById(), LIVE_CHROME_MOUNT_CONTRACT, LIVE_UI_COMPONENT_IDS (+2 more)

### Community 64 - "session-store.mjs"
Cohesion: 0.27
Nodes (9): applyEvent(), baseSnapshot(), COMPLETED_PHASES, getJournalPath(), getSnapshotPath(), rebuildSnapshotFromJournal(), safeSessionId(), toPendingEvent() (+1 more)

### Community 65 - "Using Agent Skills Skill"
Cohesion: 0.22
Nodes (11): Performance Optimization Skill, Planning and Task Breakdown Skill, Security and Hardening Skill, Shipping and Launch Skill, Source-Driven Development Skill, Spec-Driven Development Skill, Test-Driven Development Skill, Using Agent Skills Skill (+3 more)

### Community 66 - "checkHeroEyebrow"
Cohesion: 0.40
Nodes (5): checkElementHeroEyebrow(), checkElementHeroEyebrowDOM(), checkHeroEyebrow(), isAccentColor(), resolveVarRefs()

### Community 67 - "collectBrowserFindings"
Cohesion: 0.13
Nodes (19): browserFindingsFromMap(), checkElementMotion(), checkElementMotionDOM(), checkHtmlPatterns(), checkLayout(), checkMotion(), checkPageLayout(), checkPageQualityDOM() (+11 more)

### Community 68 - "palette.mjs"
Cohesion: 0.24
Nodes (7): args, buildWeights(), hashUnit(), pickSeed(), seed, SEEDS, weightedPick()

### Community 69 - "resolveWorkspaceProjectRoot"
Cohesion: 0.29
Nodes (10): escapeRegExp(), isExcludedByWorkspacePattern(), MONOREPO_FALLBACK_PROJECT_DIRS, nearestProjectLikeRoot(), normalizeWorkspacePattern(), projectRootFromDoubleStarPattern(), projectRootFromWorkspacePattern(), resolveWorkspaceProjectRoot() (+2 more)

### Community 70 - "documentRefForElement"
Cohesion: 0.11
Nodes (23): canRestoreManualEditElement(), copyEditContainerContext(), copyEditLeafContext(), directMixedTextRestoreNodes(), documentRefClassSuffix(), documentRefForElement(), documentRefIdSuffix(), documentRefSegment() (+15 more)

### Community 73 - "cli"
Cohesion: 0.29
Nodes (8): buildMissingTargetDirective(), buildResolvedContextDirective(), buildTargetSelectionDirective(), cli(), hasTargetOption(), parseCliOptions(), pathExistsForTarget(), shouldWarnMissingTarget()

### Community 74 - "discoverTargetCandidates"
Cohesion: 0.36
Nodes (8): directChildDirs(), discoverRootsForPattern(), discoverTargetCandidates(), expandSimplePattern(), findTargetExample(), isIgnoredWorkspaceDiscoveryDir(), walkDirs(), WORKSPACE_DISCOVERY_IGNORED_DIRS

### Community 75 - "checkElementTextOverflowDOM"
Cohesion: 0.32
Nodes (8): checkElementTextOverflowDOM(), classSelector(), clippedByInset(), clippedByRect(), expandBoxShorthand(), firstMetricLengthPx(), isScreenReaderOnlyTextStyle(), metricLengthPx()

### Community 76 - "serializeFindings"
Cohesion: 0.33
Nodes (7): buildSelectorSegment(), generateSelector(), isLikelyHashedClass(), postSerializedFindings(), renderBrowserFindings(), scanResultMeta(), serializeFindings()

### Community 77 - "normalizeGitHubEvent"
Cohesion: 0.38
Nodes (7): applyPatchText(), envProjectDir(), looksLikeApplyPatch(), normalizeGitHubEvent(), normalizeHookEvent(), parseGitHubToolArgs(), resolveProjectCwd()

### Community 78 - "browser-script-parts.mjs"
Cohesion: 0.33
Nodes (6): assembleLiveBrowserScript(), assertLiveBrowserScriptParts(), LIVE_BROWSER_SCRIPT_PARTS, readLiveBrowserScriptParts(), resolveLiveBrowserScriptParts(), loadBrowserScripts()

### Community 79 - "acceptedDomAlreadyClean"
Cohesion: 0.53
Nodes (6): acceptedDomAlreadyClean(), ensureAcceptedDomClean(), findAcceptedRuntimeWrappers(), reloadAfterMissingAcceptedDom(), restoreAcceptedDomFromSnapshot(), scheduleAcceptCleanup()

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

### Community 87 - "normalize-fonts.js"
Cohesion: 0.50
Nodes (3): code, fs, replaces

### Community 88 - "read_file.js"
Cohesion: 0.50
Nodes (3): content, fs, lines

## Knowledge Gaps
- **130 isolated node(s):** `idea-refine.sh script`, `COMMON_DEV_PORTS`, `SOURCE_DIRS`, `PRODUCT_NAMES`, `DESIGN_NAMES` (+125 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **24 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `el()` connect `el` to `live-browser.js`, `checks.mjs`, `collectBrowserFindings`, `index.mjs`, `design-system.mjs`, `setLiveState`, `css-cascade.mjs`, `serializeFindings`, `showToast`, `detect-html.mjs`, `refreshParamsPanel`, `initGlobalBar`, `GENERIC_FONTS`, `parseRgb`?**
  _High betweenness centrality (0.210) - this node is a cross-community bridge._
- **Why does `buffer` connect `live-inject.mjs` to `detect-antipatterns.mjs`, `manual-edit-routes.mjs`, `runHook`, `isGeneratedFile`, `live-server.mjs`, `hook-before-edit.mjs`?**
  _High betweenness centrality (0.103) - this node is a cross-community bridge._
- **Why does `handleStdin()` connect `detect-antipatterns.mjs` to `live-inject.mjs`, `detect-html.mjs`, `detect-text.mjs`?**
  _High betweenness centrality (0.093) - this node is a cross-community bridge._
- **Are the 16 inferred relationships involving `el()` (e.g. with `collectVisualContrastCandidates()` and `renderBrowserFindings()`) actually correct?**
  _`el()` has 16 INFERRED edges - model-reasoned connections that need verification._
- **Are the 7 inferred relationships involving `initGlobalBar()` (e.g. with `hideAgentPollTooltip()` and `onDetectMessage()`) actually correct?**
  _`initGlobalBar()` has 7 INFERRED edges - model-reasoned connections that need verification._
- **What connects `idea-refine.sh script`, `COMMON_DEV_PORTS`, `SOURCE_DIRS` to the rest of the system?**
  _130 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `live-browser.js` be split into smaller, more focused modules?**
  _Cohesion score 0.03014271653543307 - nodes in this community are weakly interconnected._