# Graph Report - .  (2026-05-11)

## Corpus Check
- Corpus is ~35,382 words - fits in a single context window. You may not need a graph.

## Summary
- 579 nodes · 1032 edges · 43 communities (41 shown, 2 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Cluster 0|Cluster 0]]
- [[_COMMUNITY_Cluster 1|Cluster 1]]
- [[_COMMUNITY_Cluster 2|Cluster 2]]
- [[_COMMUNITY_Cluster 3|Cluster 3]]
- [[_COMMUNITY_Cluster 4|Cluster 4]]
- [[_COMMUNITY_Cluster 5|Cluster 5]]
- [[_COMMUNITY_Cluster 6|Cluster 6]]
- [[_COMMUNITY_Cluster 7|Cluster 7]]
- [[_COMMUNITY_Cluster 8|Cluster 8]]
- [[_COMMUNITY_Cluster 9|Cluster 9]]
- [[_COMMUNITY_Cluster 10|Cluster 10]]
- [[_COMMUNITY_Cluster 11|Cluster 11]]
- [[_COMMUNITY_Cluster 12|Cluster 12]]
- [[_COMMUNITY_Cluster 13|Cluster 13]]
- [[_COMMUNITY_Cluster 14|Cluster 14]]
- [[_COMMUNITY_Cluster 15|Cluster 15]]
- [[_COMMUNITY_Cluster 16|Cluster 16]]
- [[_COMMUNITY_Cluster 17|Cluster 17]]
- [[_COMMUNITY_Cluster 18|Cluster 18]]
- [[_COMMUNITY_Cluster 19|Cluster 19]]
- [[_COMMUNITY_Cluster 20|Cluster 20]]
- [[_COMMUNITY_Cluster 21|Cluster 21]]
- [[_COMMUNITY_Cluster 22|Cluster 22]]
- [[_COMMUNITY_Cluster 23|Cluster 23]]
- [[_COMMUNITY_Cluster 24|Cluster 24]]
- [[_COMMUNITY_Cluster 25|Cluster 25]]
- [[_COMMUNITY_Cluster 26|Cluster 26]]
- [[_COMMUNITY_Cluster 27|Cluster 27]]
- [[_COMMUNITY_Cluster 28|Cluster 28]]
- [[_COMMUNITY_Cluster 29|Cluster 29]]
- [[_COMMUNITY_Cluster 30|Cluster 30]]
- [[_COMMUNITY_Cluster 31|Cluster 31]]
- [[_COMMUNITY_Cluster 32|Cluster 32]]
- [[_COMMUNITY_Cluster 33|Cluster 33]]
- [[_COMMUNITY_Cluster 34|Cluster 34]]
- [[_COMMUNITY_Cluster 35|Cluster 35]]
- [[_COMMUNITY_Cluster 36|Cluster 36]]
- [[_COMMUNITY_Cluster 38|Cluster 38]]
- [[_COMMUNITY_Cluster 39|Cluster 39]]

## God Nodes (most connected - your core abstractions)
1. `cn()` - 276 edges
2. `buttonVariants` - 9 edges
3. `Button()` - 8 edges
4. `updateVCRequest()` - 7 edges
5. `Separator()` - 6 edges
6. `slideImageUrl()` - 6 edges
7. `RequestDetail()` - 5 edges
8. `DeckBuilderPage()` - 5 edges
9. `useSidebar()` - 5 edges
10. `useFormField()` - 5 edges

## Surprising Connections (you probably didn't know these)
- `AlertDialogOverlay()` --calls--> `cn()`  [EXTRACTED]
  components/ui/alert-dialog.tsx → lib/utils.ts
- `AlertDialogContent()` --calls--> `cn()`  [EXTRACTED]
  components/ui/alert-dialog.tsx → lib/utils.ts
- `AlertDialogHeader()` --calls--> `cn()`  [EXTRACTED]
  components/ui/alert-dialog.tsx → lib/utils.ts
- `AlertDialogFooter()` --calls--> `cn()`  [EXTRACTED]
  components/ui/alert-dialog.tsx → lib/utils.ts
- `AlertDialogTitle()` --calls--> `cn()`  [EXTRACTED]
  components/ui/alert-dialog.tsx → lib/utils.ts

## Communities (43 total, 2 thin omitted)

### Community 0 - "Cluster 0"
Cohesion: 0.05
Nodes (23): AccordionContent(), AccordionItem(), AccordionTrigger(), Badge(), badgeVariants, Checkbox(), HoverCardContent(), InputOTP() (+15 more)

### Community 1 - "Cluster 1"
Cohesion: 0.07
Nodes (36): Action, ActionType, actionTypes, addToRemoveQueue(), dispatch(), genId(), listeners, memoryState (+28 more)

### Community 2 - "Cluster 2"
Cohesion: 0.07
Nodes (34): useIsMobile(), Input(), Sidebar(), SidebarContent(), SidebarContext, SidebarContextProps, SidebarFooter(), SidebarGroup() (+26 more)

### Community 3 - "Cluster 3"
Cohesion: 0.12
Nodes (25): cn(), Avatar(), AvatarFallback(), AvatarImage(), Card(), CardAction(), CardContent(), CardDescription() (+17 more)

### Community 4 - "Cluster 4"
Cohesion: 0.1
Nodes (19): AlertDialogAction(), AlertDialogCancel(), AlertDialogContent(), AlertDialogDescription(), AlertDialogFooter(), AlertDialogHeader(), AlertDialogOverlay(), AlertDialogTitle() (+11 more)

### Community 5 - "Cluster 5"
Cohesion: 0.12
Nodes (21): clearDraftDeck(), CONCERN_OPTIONS, DeckBuilderPage(), DEFAULT_RECOMMENDATIONS, DraftDeckState, draftDeckStorageKey(), GalleryMode, getDisplayName() (+13 more)

### Community 6 - "Cluster 6"
Cohesion: 0.14
Nodes (17): ConsultationReceiptPage(), formatDate(), getDisplayName(), ReceiptState, RequestDetail(), STATUS_COLORS, STATUS_ORDER, statusLabel() (+9 more)

### Community 7 - "Cluster 7"
Cohesion: 0.12
Nodes (15): Command(), CommandDialog(), CommandGroup(), CommandInput(), CommandItem(), CommandList(), CommandSeparator(), CommandShortcut() (+7 more)

### Community 8 - "Cluster 8"
Cohesion: 0.14
Nodes (14): listAllSlides(), listRecordingDecks(), RecordingDeck, SlideItem, DraftDeckState, draftDeckStorageKey(), formatTime(), getDisplayName() (+6 more)

### Community 9 - "Cluster 9"
Cohesion: 0.12
Nodes (11): Menubar(), MenubarCheckboxItem(), MenubarContent(), MenubarItem(), MenubarLabel(), MenubarRadioItem(), MenubarSeparator(), MenubarShortcut() (+3 more)

### Community 10 - "Cluster 10"
Cohesion: 0.12
Nodes (11): createVCRequest(), PhotoUploadResponse, uploadPhoto(), fadeIn, FormData, FormErrors, spring, stagger (+3 more)

### Community 11 - "Cluster 11"
Cohesion: 0.12
Nodes (9): DropdownMenuCheckboxItem(), DropdownMenuContent(), DropdownMenuItem(), DropdownMenuLabel(), DropdownMenuRadioItem(), DropdownMenuSeparator(), DropdownMenuShortcut(), DropdownMenuSubContent() (+1 more)

### Community 12 - "Cluster 12"
Cohesion: 0.12
Nodes (9): ContextMenuCheckboxItem(), ContextMenuContent(), ContextMenuItem(), ContextMenuLabel(), ContextMenuRadioItem(), ContextMenuSeparator(), ContextMenuShortcut(), ContextMenuSubContent() (+1 more)

### Community 13 - "Cluster 13"
Cohesion: 0.17
Nodes (11): authHeaders(), createRecordingDeck(), deleteRecordingDeck(), getVCRequest(), listVCRequests(), sendConsultation(), updateVCRequest(), VCRequestListResponse (+3 more)

### Community 14 - "Cluster 14"
Cohesion: 0.2
Nodes (11): FormControl(), FormDescription(), FormFieldContext, FormFieldContextValue, FormItem(), FormItemContext, FormItemContextValue, FormLabel() (+3 more)

### Community 15 - "Cluster 15"
Cohesion: 0.19
Nodes (13): Carousel(), CarouselApi, CarouselContent(), CarouselContext, CarouselContextProps, CarouselItem(), CarouselNext(), CarouselOptions (+5 more)

### Community 16 - "Cluster 16"
Cohesion: 0.18
Nodes (12): Item(), ItemActions(), ItemContent(), ItemDescription(), ItemFooter(), ItemGroup(), ItemHeader(), ItemMedia() (+4 more)

### Community 17 - "Cluster 17"
Cohesion: 0.2
Nodes (7): BorderBeam(), BorderBeamProps, ShimmerButton, ShimmerButtonProps, fadeUp, springTransition, staggerContainer

### Community 18 - "Cluster 18"
Cohesion: 0.18
Nodes (11): Field(), FieldContent(), FieldDescription(), FieldError(), FieldGroup(), FieldLabel(), FieldLegend(), FieldSeparator() (+3 more)

### Community 19 - "Cluster 19"
Cohesion: 0.17
Nodes (11): AnimationType, AnimationVariant, defaultContainerVariants, defaultItemAnimationVariants, defaultItemVariants, motionElements, MotionElementType, staggerTimings (+3 more)

### Community 20 - "Cluster 20"
Cohesion: 0.24
Nodes (9): InputGroup(), InputGroupAddon(), inputGroupAddonVariants, InputGroupButton(), inputGroupButtonVariants, InputGroupInput(), InputGroupText(), InputGroupTextarea() (+1 more)

### Community 21 - "Cluster 21"
Cohesion: 0.22
Nodes (8): ChartConfig, ChartContainer(), ChartContext, ChartContextProps, ChartLegendContent(), ChartTooltipContent(), THEMES, useChart()

### Community 22 - "Cluster 22"
Cohesion: 0.18
Nodes (6): DrawerContent(), DrawerDescription(), DrawerFooter(), DrawerHeader(), DrawerOverlay(), DrawerTitle()

### Community 23 - "Cluster 23"
Cohesion: 0.18
Nodes (7): Sheet(), SheetContent(), SheetDescription(), SheetFooter(), SheetHeader(), SheetOverlay(), SheetTitle()

### Community 24 - "Cluster 24"
Cohesion: 0.18
Nodes (7): SelectContent(), SelectItem(), SelectLabel(), SelectScrollDownButton(), SelectScrollUpButton(), SelectSeparator(), SelectTrigger()

### Community 25 - "Cluster 25"
Cohesion: 0.24
Nodes (8): VCRequestListItem, formatDate(), getSubmittedDate(), StaffDashboard(), STATUS_COLORS, STATUS_FILTERS, STATUS_ORDER, statusLabel()

### Community 26 - "Cluster 26"
Cohesion: 0.22
Nodes (9): NavigationMenu(), NavigationMenuContent(), NavigationMenuIndicator(), NavigationMenuItem(), NavigationMenuLink(), NavigationMenuList(), NavigationMenuTrigger(), navigationMenuTriggerStyle (+1 more)

### Community 27 - "Cluster 27"
Cohesion: 0.29
Nodes (5): AuroraText, AuroraTextProps, fadeUp, springTransition, staggerContainer

### Community 28 - "Cluster 28"
Cohesion: 0.29
Nodes (7): Empty(), EmptyContent(), EmptyDescription(), EmptyHeader(), EmptyMedia(), emptyMediaVariants, EmptyTitle()

### Community 29 - "Cluster 29"
Cohesion: 0.25
Nodes (6): BreadcrumbEllipsis(), BreadcrumbItem(), BreadcrumbLink(), BreadcrumbList(), BreadcrumbPage(), BreadcrumbSeparator()

### Community 30 - "Cluster 30"
Cohesion: 0.33
Nodes (4): _geist, _geistMono, metadata, ThemeProvider()

### Community 31 - "Cluster 31"
Cohesion: 0.38
Nodes (5): ButtonGroup(), ButtonGroupSeparator(), ButtonGroupText(), buttonGroupVariants, Separator()

### Community 32 - "Cluster 32"
Cohesion: 0.33
Nodes (4): fadeUp, springTransition, staggerContainer, steps

### Community 33 - "Cluster 33"
Cohesion: 0.33
Nodes (5): { chromium }, draftSlides, fs, path, results

### Community 34 - "Cluster 34"
Cohesion: 0.5
Nodes (4): Alert(), AlertDescription(), AlertTitle(), alertVariants

### Community 35 - "Cluster 35"
Cohesion: 0.5
Nodes (4): BlurFade(), BlurFadeProps, getFilter(), MarginType

### Community 36 - "Cluster 36"
Cohesion: 0.4
Nodes (3): fadeUp, springTransition, staggerContainer

## Knowledge Gaps
- **104 isolated node(s):** `config`, `nextConfig`, `_geist`, `_geistMono`, `metadata` (+99 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **2 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `cn()` connect `Cluster 3` to `Cluster 0`, `Cluster 1`, `Cluster 2`, `Cluster 4`, `Cluster 5`, `Cluster 7`, `Cluster 9`, `Cluster 11`, `Cluster 12`, `Cluster 14`, `Cluster 15`, `Cluster 16`, `Cluster 17`, `Cluster 18`, `Cluster 19`, `Cluster 20`, `Cluster 21`, `Cluster 22`, `Cluster 23`, `Cluster 24`, `Cluster 26`, `Cluster 28`, `Cluster 29`, `Cluster 31`, `Cluster 34`?**
  _High betweenness centrality (0.676) - this node is a cross-community bridge._
- **Why does `SheetContent()` connect `Cluster 23` to `Cluster 2`, `Cluster 3`, `Cluster 5`?**
  _High betweenness centrality (0.023) - this node is a cross-community bridge._
- **Why does `SheetHeader()` connect `Cluster 23` to `Cluster 2`, `Cluster 3`, `Cluster 5`?**
  _High betweenness centrality (0.023) - this node is a cross-community bridge._
- **What connects `config`, `nextConfig`, `_geist` to the rest of the system?**
  _104 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Cluster 0` be split into smaller, more focused modules?**
  _Cohesion score 0.05 - nodes in this community are weakly interconnected._
- **Should `Cluster 1` be split into smaller, more focused modules?**
  _Cohesion score 0.07 - nodes in this community are weakly interconnected._
- **Should `Cluster 2` be split into smaller, more focused modules?**
  _Cohesion score 0.07 - nodes in this community are weakly interconnected._