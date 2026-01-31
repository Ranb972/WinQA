# Mobile Responsiveness Fixes Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix all mobile responsiveness issues across the WinQA app - navigation menu behavior, logout access, layout cutoffs, and overall mobile polish.

**Architecture:** Modify the Navbar component to add accordion behavior for dropdown menus on mobile and improve the user profile section. Update page components and shared UI components to ensure proper mobile viewport fitting with responsive classes and appropriate breakpoints.

**Tech Stack:** Next.js 15, React, Tailwind CSS, Framer Motion, Clerk Authentication

---

## Task 1: Mobile Navigation - Add Collapsible Dropdown Submenus

**Files:**
- Modify: `components/Navbar.tsx:277-318`

**Problem:** Dropdown submenus (Testing Labs, Bug Log) are always expanded in mobile menu. They should be collapsed by default and expand on tap.

**Step 1: Add state for tracking expanded dropdowns**

Add new state after line 170 (`mobileMenuOpen` state):

```tsx
const [expandedMobileDropdowns, setExpandedMobileDropdowns] = useState<string[]>([]);

const toggleMobileDropdown = (label: string) => {
  setExpandedMobileDropdowns((prev) =>
    prev.includes(label) ? prev.filter((l) => l !== label) : [...prev, label]
  );
};
```

**Step 2: Update mobile dropdown rendering (lines 277-318)**

Replace the current mobile dropdown section with an interactive accordion:

```tsx
if (item.dropdown) {
  const isExpanded = expandedMobileDropdowns.includes(item.label);
  return (
    <div key={item.label} className="space-y-1">
      <button
        onClick={() => toggleMobileDropdown(item.label)}
        className={cn(
          'flex items-center justify-between w-full px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
          isActive
            ? 'bg-violet-600/20 text-violet-300'
            : 'text-slate-300 hover:bg-white/5'
        )}
      >
        <div className="flex items-center gap-2">
          {item.icon}
          <span>{item.label}</span>
        </div>
        <ChevronDown
          className={cn(
            'h-4 w-4 transition-transform duration-200',
            isExpanded && 'rotate-180'
          )}
        />
      </button>
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="pl-4 space-y-1 overflow-hidden"
          >
            {item.dropdown.map((dropItem) => (
              dropItem.disabled ? (
                <div
                  key={dropItem.href}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-slate-500 opacity-50 cursor-not-allowed"
                >
                  {dropItem.icon}
                  <span>{dropItem.label}</span>
                  {dropItem.badge && (
                    <span className="ml-auto text-xs bg-purple-500/20 text-purple-400 px-2 py-0.5 rounded-full">
                      {dropItem.badge}
                    </span>
                  )}
                </div>
              ) : (
                <Link
                  key={dropItem.href}
                  href={dropItem.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={cn(
                    'flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors',
                    pathname === dropItem.href.split('?')[0]
                      ? 'bg-violet-600/20 text-violet-300'
                      : 'text-slate-400 hover:bg-white/5 hover:text-slate-300'
                  )}
                >
                  {dropItem.icon}
                  <span>{dropItem.label}</span>
                </Link>
              )
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
```

**Step 3: Verify changes compile**

Run: `npm run build`
Expected: Build succeeds without errors

**Step 4: Commit**

```bash
git add components/Navbar.tsx
git commit -m "feat(mobile): add collapsible accordion dropdowns in mobile nav

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 2: Mobile Navigation - Improve User Profile/Logout Section

**Files:**
- Modify: `components/Navbar.tsx:340-352`

**Problem:** The user section exists but is minimal. Need to make it more prominent and clearly show logout option.

**Step 1: Import User hook**

Add to existing Clerk import at line 7:

```tsx
import { UserButton, useUser } from '@clerk/nextjs';
```

**Step 2: Update mobile user section (lines 340-352)**

Replace the current user section with an enhanced version:

```tsx
{/* User Section in Mobile */}
<div className="mt-4 pt-4 border-t border-slate-700/50">
  <div className="flex items-center gap-3 px-3 py-2">
    <UserButton
      appearance={{
        elements: {
          avatarBox: 'h-10 w-10 ring-2 ring-violet-500/30',
        },
      }}
      afterSignOutUrl="/"
    />
    <div className="flex-1 min-w-0">
      <p className="text-sm font-medium text-slate-200 truncate">
        Account
      </p>
      <p className="text-xs text-slate-500">
        Tap avatar to sign out
      </p>
    </div>
  </div>
</div>
```

**Step 3: Verify changes compile**

Run: `npm run build`
Expected: Build succeeds without errors

**Step 4: Commit**

```bash
git add components/Navbar.tsx
git commit -m "feat(mobile): improve user profile section with logout hint

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 3: Chat Interface - Fix Mobile Header Layout

**Files:**
- Modify: `components/ChatInterface.tsx:341-366`
- Modify: `components/ModelSelector.tsx:171-276`

**Problem:** ModelSelector and header controls get cut off on mobile. Need responsive layout.

**Step 1: Update ChatInterface header (lines 341-366)**

```tsx
{/* Header */}
<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 border-b border-slate-800">
  <div className="overflow-x-auto">
    <ModelSelector
      mode={mode}
      selectedModel={selectedModel}
      selectedModels={selectedModels}
      modelPreferences={modelPreferences}
      customProviders={customProviders}
      selectedCustomProviders={selectedCustomProviders}
      onModelChange={setSelectedModel}
      onModelsChange={setSelectedModels}
      onModeChange={setMode}
      onModelPreferenceChange={handleModelPreferenceChange}
      onCustomProvidersChange={setSelectedCustomProviders}
    />
  </div>

  <Button
    variant="ghost"
    size="sm"
    onClick={clearChat}
    className="text-slate-400 hover:text-rose-400 shrink-0 self-end sm:self-auto"
    disabled={messages.length === 0}
  >
    <Trash2 className="h-4 w-4 mr-2" />
    Clear
  </Button>
</div>
```

**Step 2: Update ModelSelector wrapper (line 172)**

```tsx
<div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
```

**Step 3: Update mode toggle buttons (lines 174-197)**

```tsx
{/* Mode Toggle */}
<div className="flex items-center gap-2 shrink-0">
  <button
    onClick={() => onModeChange?.('single')}
    className={cn(
      'px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap',
      mode === 'single'
        ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-600/30'
        : 'text-slate-400 hover:text-slate-300'
    )}
  >
    Single
  </button>
  <button
    onClick={() => onModeChange?.('multi')}
    className={cn(
      'px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap',
      mode === 'multi'
        ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-600/30'
        : 'text-slate-400 hover:text-slate-300'
    )}
  >
    Compare
  </button>
</div>
```

**Step 4: Update single model selector (lines 200-222)**

```tsx
{mode === 'single' && mounted && (
  <div className="flex items-center gap-2 min-w-0">
    <Select value={selectedModel} onValueChange={(v) => onModelChange?.(v as LLMProvider)}>
      <SelectTrigger className="w-full sm:w-48 bg-slate-900 border-slate-700">
        <SelectValue placeholder="Select model" />
      </SelectTrigger>
      <SelectContent className="bg-slate-900 border-slate-700">
        {providers.map((provider) => (
          <SelectItem
            key={provider}
            value={provider}
            className="text-slate-300 focus:bg-slate-800 focus:text-slate-100"
          >
            <span className={cn('px-2 py-0.5 rounded text-xs border', modelBadgeColors[provider])}>
              {modelDisplayNames[provider]}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
    <ModelGearPopover provider={selectedModel} />
  </div>
)}
```

**Step 5: Update multi model selector (lines 225-274)**

```tsx
{mode === 'multi' && (
  <div className="flex flex-wrap items-center gap-2 sm:gap-3">
    {/* Built-in providers */}
    {providers.map((provider) => (
      <div key={provider} className="flex items-center gap-1">
        <label className="flex items-center gap-1.5 sm:gap-2 cursor-pointer">
          <Checkbox
            checked={selectedModels.includes(provider)}
            onCheckedChange={(checked) =>
              handleMultiSelect(provider, checked as boolean)
            }
            className="border-slate-600 data-[state=checked]:bg-emerald-600 data-[state=checked]:border-emerald-600 h-4 w-4"
          />
          <span
            className={cn(
              'px-1.5 sm:px-2 py-0.5 rounded text-xs border whitespace-nowrap',
              modelBadgeColors[provider]
            )}
          >
            {modelDisplayNames[provider]}
          </span>
        </label>
        <ModelGearPopover provider={provider} />
      </div>
    ))}

    {/* Custom providers */}
    {customProviders.length > 0 && (
      <>
        <div className="w-px h-5 bg-slate-700 mx-1 hidden sm:block" />
        {customProviders.map((provider) => (
          <div key={provider.id} className="flex items-center gap-1">
            <label className="flex items-center gap-1.5 sm:gap-2 cursor-pointer">
              <Checkbox
                checked={selectedCustomProviders.includes(provider.id)}
                onCheckedChange={(checked) =>
                  handleCustomProviderSelect(provider.id, checked as boolean)
                }
                className="border-slate-600 data-[state=checked]:bg-violet-600 data-[state=checked]:border-violet-600 h-4 w-4"
              />
              <span className="px-1.5 sm:px-2 py-0.5 rounded text-xs border bg-violet-600/20 text-violet-400 border-violet-600/30 whitespace-nowrap truncate max-w-[100px] sm:max-w-none">
                {provider.name}
              </span>
            </label>
          </div>
        ))}
      </>
    )}
  </div>
)}
```

**Step 6: Verify changes compile**

Run: `npm run build`
Expected: Build succeeds without errors

**Step 7: Commit**

```bash
git add components/ChatInterface.tsx components/ModelSelector.tsx
git commit -m "feat(mobile): responsive chat header and model selector

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 4: Bug Log Page - Fix Mobile Layout Issues

**Files:**
- Modify: `app/bugs/page.tsx:278-300, 318-340, 430-487, 575-695`

**Problem:** Header buttons, filter dropdowns, bug cards with badges, and dialogs have layout issues on mobile.

**Step 1: Update header section (lines 278-300)**

```tsx
{/* Header */}
<MotionWrapper>
  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
    <div className="flex items-center gap-4">
      <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-rose-500 to-pink-600 flex items-center justify-center shrink-0">
        <Bug className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
      </div>
      <div className="min-w-0">
        <h1 className="text-xl sm:text-2xl md:text-3xl font-bold">
          <span className="gradient-text-primary">Bug Log</span>
        </h1>
        <p className="text-slate-400 text-sm sm:text-base mt-1 truncate">
          Track and manage AI response issues
        </p>
      </div>
    </div>
    <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="shrink-0">
      <Button onClick={openNewDialog} className="btn-primary w-full sm:w-auto">
        <Plus className="h-4 w-4 mr-2" />
        Add Bug
      </Button>
    </motion.div>
  </div>
</MotionWrapper>
```

**Step 2: Update filter dropdowns section (lines 318-386)**

```tsx
{/* Filter Dropdowns */}
<div className="flex flex-wrap items-center gap-2 sm:gap-3">
  <Filter className="h-4 w-4 text-slate-500 shrink-0" />
  {mounted && (
    <>
      <Select value={statusFilter} onValueChange={setStatusFilter}>
        <SelectTrigger className="w-28 sm:w-36 glass border-slate-700/50 text-sm">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent className="glass border-slate-700/50">
          <SelectItem value="all" className="text-slate-300 focus:bg-violet-600/20">
            All Status
          </SelectItem>
          <SelectItem value="Open" className="text-slate-300 focus:bg-violet-600/20">
            Open
          </SelectItem>
          <SelectItem value="Investigating" className="text-slate-300 focus:bg-violet-600/20">
            Investigating
          </SelectItem>
          <SelectItem value="Resolved" className="text-slate-300 focus:bg-violet-600/20">
            Resolved
          </SelectItem>
        </SelectContent>
      </Select>

      <Select value={severityFilter} onValueChange={setSeverityFilter}>
        <SelectTrigger className="w-24 sm:w-32 glass border-slate-700/50 text-sm">
          <SelectValue placeholder="Severity" />
        </SelectTrigger>
        <SelectContent className="glass border-slate-700/50">
          <SelectItem value="all" className="text-slate-300 focus:bg-violet-600/20">
            All
          </SelectItem>
          <SelectItem value="Low" className="text-slate-300 focus:bg-violet-600/20">
            Low
          </SelectItem>
          <SelectItem value="Medium" className="text-slate-300 focus:bg-violet-600/20">
            Medium
          </SelectItem>
          <SelectItem value="High" className="text-slate-300 focus:bg-violet-600/20">
            High
          </SelectItem>
        </SelectContent>
      </Select>

      <Select value={issueTypeFilter} onValueChange={setIssueTypeFilter}>
        <SelectTrigger className="w-28 sm:w-36 glass border-slate-700/50 text-sm">
          <SelectValue placeholder="Type" />
        </SelectTrigger>
        <SelectContent className="glass border-slate-700/50">
          <SelectItem value="all" className="text-slate-300 focus:bg-violet-600/20">
            All Types
          </SelectItem>
          <SelectItem value="Hallucination" className="text-slate-300 focus:bg-violet-600/20">
            Hallucination
          </SelectItem>
          <SelectItem value="Formatting" className="text-slate-300 focus:bg-violet-600/20">
            Formatting
          </SelectItem>
          <SelectItem value="Refusal" className="text-slate-300 focus:bg-violet-600/20">
            Refusal
          </SelectItem>
          <SelectItem value="Logic" className="text-slate-300 focus:bg-violet-600/20">
            Logic
          </SelectItem>
        </SelectContent>
      </Select>
    </>
  )}
</div>
```

**Step 3: Update bug card header row (lines 430-487)**

```tsx
{/* Header Row */}
<div
  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 cursor-pointer hover:bg-white/5 transition-colors"
  onClick={() =>
    setExpandedId(expandedId === bug._id ? null : bug._id)
  }
>
  <div className="flex flex-wrap items-center gap-2">
    <button
      onClick={(e) => {
        e.stopPropagation();
        openStatusDialog(bug);
      }}
    >
      <Badge
        className={cn(
          'border cursor-pointer hover:opacity-80 transition-opacity text-xs',
          statusColors[bug.status]
        )}
      >
        {bug.status}
      </Badge>
    </button>
    <Badge
      className={cn('border text-xs', issueTypeColors[bug.issue_type])}
    >
      {bug.issue_type}
    </Badge>
    <Badge className={cn('border text-xs', severityColors[bug.severity])}>
      {bug.severity}
    </Badge>
    <span className="text-xs sm:text-sm text-slate-300 truncate max-w-[120px] sm:max-w-none">
      {modelDisplayNames[bug.model_used as LLMProvider] || bug.model_used}
    </span>
  </div>

  <div className="flex items-center justify-between sm:justify-end gap-2 sm:gap-4">
    <span className="text-xs text-slate-500 truncate">
      {formatDate(bug.created_at)}
    </span>
    <div className="flex items-center gap-2">
      <Button
        variant="ghost"
        size="sm"
        onClick={(e) => {
          e.stopPropagation();
          handleDelete(bug._id);
        }}
        className="h-8 w-8 p-0 text-slate-400 hover:text-rose-400"
      >
        <Trash2 className="h-4 w-4" />
      </Button>
      {expandedId === bug._id ? (
        <ChevronUp className="h-4 w-4 text-slate-400" />
      ) : (
        <ChevronDown className="h-4 w-4 text-slate-400" />
      )}
    </div>
  </div>
</div>
```

**Step 4: Update Add Bug dialog (lines 575-695)**

```tsx
{/* Add New Bug Dialog */}
<Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
  <DialogContent className="glass border-slate-700/50 w-[95vw] max-w-2xl max-h-[85vh] overflow-y-auto mx-auto">
    <DialogHeader>
      <DialogTitle className="text-slate-100">Add Bug Report</DialogTitle>
      <DialogDescription className="text-slate-400">
        Document an AI response issue you&apos;ve encountered
      </DialogDescription>
    </DialogHeader>

    <div className="space-y-4 py-4">
      <div className="space-y-2">
        <label className="text-sm font-medium text-slate-300">Prompt Context *</label>
        <Textarea
          value={formData.prompt_context}
          onChange={(e) => setFormData({ ...formData, prompt_context: e.target.value })}
          placeholder="What prompt or context triggered this issue?"
          className="bg-slate-950/50 border-slate-700 text-slate-100 min-h-[80px]"
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-slate-300">Model Response *</label>
        <Textarea
          value={formData.model_response}
          onChange={(e) => setFormData({ ...formData, model_response: e.target.value })}
          placeholder="What was the problematic response?"
          className="bg-slate-950/50 border-slate-700 text-slate-100 min-h-[100px]"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-300">Model Used</label>
          {mounted && (
            <Select
              value={formData.model_used}
              onValueChange={(value) => setFormData({ ...formData, model_used: value })}
            >
              <SelectTrigger className="bg-slate-950/50 border-slate-700 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="glass border-slate-700/50">
                <SelectItem value="cohere" className="text-slate-300 focus:bg-violet-600/20">Cohere</SelectItem>
                <SelectItem value="gemini" className="text-slate-300 focus:bg-violet-600/20">Gemini</SelectItem>
                <SelectItem value="groq" className="text-slate-300 focus:bg-violet-600/20">Groq</SelectItem>
                <SelectItem value="openrouter" className="text-slate-300 focus:bg-violet-600/20">OpenRouter</SelectItem>
              </SelectContent>
            </Select>
          )}
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-300">Issue Type</label>
          {mounted && (
            <Select
              value={formData.issue_type}
              onValueChange={(value) => setFormData({ ...formData, issue_type: value as typeof formData.issue_type })}
            >
              <SelectTrigger className="bg-slate-950/50 border-slate-700 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="glass border-slate-700/50">
                <SelectItem value="Hallucination" className="text-slate-300 focus:bg-violet-600/20">Hallucination</SelectItem>
                <SelectItem value="Formatting" className="text-slate-300 focus:bg-violet-600/20">Formatting</SelectItem>
                <SelectItem value="Refusal" className="text-slate-300 focus:bg-violet-600/20">Refusal</SelectItem>
                <SelectItem value="Logic" className="text-slate-300 focus:bg-violet-600/20">Logic</SelectItem>
              </SelectContent>
            </Select>
          )}
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-300">Severity</label>
          {mounted && (
            <Select
              value={formData.severity}
              onValueChange={(value) => setFormData({ ...formData, severity: value as typeof formData.severity })}
            >
              <SelectTrigger className="bg-slate-950/50 border-slate-700 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="glass border-slate-700/50">
                <SelectItem value="Low" className="text-slate-300 focus:bg-violet-600/20">Low</SelectItem>
                <SelectItem value="Medium" className="text-slate-300 focus:bg-violet-600/20">Medium</SelectItem>
                <SelectItem value="High" className="text-slate-300 focus:bg-violet-600/20">High</SelectItem>
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-slate-300">Notes (optional)</label>
        <Textarea
          value={formData.user_notes}
          onChange={(e) => setFormData({ ...formData, user_notes: e.target.value })}
          placeholder="Any additional context or observations..."
          className="bg-slate-950/50 border-slate-700 text-slate-100"
        />
      </div>
    </div>

    <DialogFooter className="flex-col sm:flex-row gap-2">
      <Button
        variant="ghost"
        onClick={() => setDialogOpen(false)}
        className="text-slate-400 w-full sm:w-auto"
      >
        Cancel
      </Button>
      <Button
        onClick={handleCreateBug}
        disabled={isSubmitting}
        className="btn-primary w-full sm:w-auto"
      >
        {isSubmitting ? 'Creating...' : 'Create Bug Report'}
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

**Step 5: Verify changes compile**

Run: `npm run build`
Expected: Build succeeds without errors

**Step 6: Commit**

```bash
git add app/bugs/page.tsx
git commit -m "feat(mobile): responsive bug log page layout

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 5: Prompts Page - Fix Mobile Layout Issues

**Files:**
- Modify: `app/prompts/page.tsx:259-330, 400-537`

**Problem:** Header, filter section, and dialog have mobile layout issues.

**Step 1: Update header section (lines 259-282)**

```tsx
{/* Header */}
<MotionWrapper>
  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
    <div className="flex items-center gap-4">
      <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center shrink-0">
        <Library className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
      </div>
      <div className="min-w-0">
        <h1 className="text-xl sm:text-2xl md:text-3xl font-bold">
          <span className="gradient-text-primary">Prompt Library</span>
        </h1>
        <p className="text-slate-400 text-sm sm:text-base mt-1 truncate">
          Compare bad vs good prompts and learn best practices
        </p>
      </div>
    </div>
    <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="shrink-0">
      <Button onClick={openNewDialog} className="btn-primary w-full sm:w-auto">
        <Plus className="h-4 w-4 mr-2" />
        Add Prompt
      </Button>
    </motion.div>
  </div>
</MotionWrapper>
```

**Step 2: Update filters section (lines 284-330)**

```tsx
{/* Filters */}
<MotionWrapper delay={0.1}>
  <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-3 sm:gap-4 mb-6">
    <div className="relative flex-1 min-w-0 sm:min-w-[200px] sm:max-w-md">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
      <Input
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        placeholder="Search prompts..."
        className="pl-10 glass border-slate-700/50 text-slate-100 focus:border-violet-500/50 w-full"
      />
    </div>

    <Button
      variant={showFavoritesOnly ? 'default' : 'outline'}
      size="sm"
      onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
      className={cn(
        'transition-all shrink-0',
        showFavoritesOnly
          ? 'bg-gradient-to-r from-rose-500 to-pink-500 border-none text-white'
          : 'border-slate-700 text-slate-400 hover:text-slate-100 hover:border-violet-500/50'
      )}
    >
      <Heart className={cn('h-4 w-4 mr-2', showFavoritesOnly && 'fill-current')} />
      Favorites
    </Button>

    {allTags.length > 0 && (
      <div className="flex flex-wrap gap-2 w-full sm:w-auto">
        {allTags.map((tag) => (
          <Badge
            key={tag}
            onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
            className={cn(
              'cursor-pointer transition-all text-xs',
              selectedTag === tag
                ? 'bg-gradient-to-r from-violet-600 to-purple-600 text-white border-transparent'
                : 'bg-slate-800/50 text-slate-400 border-slate-700 hover:border-violet-500/50'
            )}
          >
            {tag}
          </Badge>
        ))}
      </div>
    )}
  </div>
</MotionWrapper>
```

**Step 3: Update dialog (lines 400-537)**

```tsx
{/* Dialog */}
<Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
  <DialogContent className="glass border-slate-700/50 w-[95vw] max-w-2xl max-h-[85vh] overflow-y-auto mx-auto">
    <DialogHeader>
      <DialogTitle className="text-slate-100">
        {editingPrompt ? 'Edit Prompt' : 'Add Prompt'}
      </DialogTitle>
      <DialogDescription className="text-slate-400">
        Document a bad prompt example and its improved version
      </DialogDescription>
    </DialogHeader>

    <div className="space-y-4 py-4">
      <div>
        <label className="text-sm font-medium text-slate-300 mb-1 block">
          Title *
        </label>
        <Input
          value={formData.title}
          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
          placeholder="e.g., Specific Instructions"
          className="bg-slate-950/50 border-slate-700 text-slate-100 focus:border-violet-500/50"
        />
      </div>

      <div>
        <label className="text-sm font-medium text-rose-400 mb-1 block">
          Bad Prompt *
        </label>
        <Textarea
          value={formData.bad_prompt_example}
          onChange={(e) =>
            setFormData({ ...formData, bad_prompt_example: e.target.value })
          }
          placeholder="The ineffective prompt..."
          className="bg-rose-950/20 border-rose-900/30 text-rose-300 placeholder:text-rose-400/50 min-h-[80px] sm:min-h-[100px]"
        />
      </div>

      <div>
        <label className="text-sm font-medium text-emerald-400 mb-1 block">
          Good Prompt *
        </label>
        <Textarea
          value={formData.good_prompt_example}
          onChange={(e) =>
            setFormData({ ...formData, good_prompt_example: e.target.value })
          }
          placeholder="The improved prompt..."
          className="bg-emerald-950/20 border-emerald-900/30 text-emerald-300 placeholder:text-emerald-400/50 min-h-[80px] sm:min-h-[100px]"
        />
      </div>

      <div>
        <label className="text-sm font-medium text-slate-300 mb-1 block">
          Explanation
        </label>
        <Textarea
          value={formData.explanation}
          onChange={(e) =>
            setFormData({ ...formData, explanation: e.target.value })
          }
          placeholder="Why is the good prompt better?"
          className="bg-slate-950/50 border-slate-700 text-slate-100 min-h-[60px] focus:border-violet-500/50"
        />
      </div>

      <div>
        <label className="text-sm font-medium text-slate-300 mb-1 block">
          Tags
        </label>
        <div className="flex flex-wrap gap-2 mb-2">
          {formData.tags.map((tag) => (
            <Badge
              key={tag}
              className="bg-violet-600/20 text-violet-400 border-violet-600/30 cursor-pointer text-xs"
              onClick={() => removeTag(tag)}
            >
              {tag} x
            </Badge>
          ))}
        </div>
        <div className="flex gap-2">
          <Input
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addTag(tagInput);
              }
            }}
            placeholder="Add tag..."
            className="bg-slate-950/50 border-slate-700 text-slate-100 flex-1 focus:border-violet-500/50"
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => addTag(tagInput)}
            className="border-slate-700 hover:border-violet-500/50 shrink-0"
          >
            Add
          </Button>
        </div>
        <div className="flex flex-wrap gap-1 mt-2">
          {suggestedTags
            .filter((t) => !formData.tags.includes(t))
            .map((tag) => (
              <Badge
                key={tag}
                className="bg-slate-800/50 text-slate-500 border-slate-700 cursor-pointer hover:border-violet-500/50 text-xs"
                onClick={() => addTag(tag)}
              >
                + {tag}
              </Badge>
            ))}
        </div>
      </div>
    </div>

    <DialogFooter className="flex-col sm:flex-row gap-2">
      <Button
        variant="ghost"
        onClick={() => setDialogOpen(false)}
        className="text-slate-400 hover:text-slate-100 w-full sm:w-auto"
      >
        Cancel
      </Button>
      <Button
        onClick={handleSubmit}
        disabled={isSubmitting}
        className="btn-primary w-full sm:w-auto"
      >
        {isSubmitting ? 'Saving...' : editingPrompt ? 'Update' : 'Create'}
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

**Step 4: Verify changes compile**

Run: `npm run build`
Expected: Build succeeds without errors

**Step 5: Commit**

```bash
git add app/prompts/page.tsx
git commit -m "feat(mobile): responsive prompts page layout

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 6: Code Testing Page - Fix Mobile Layout Issues

**Files:**
- Modify: `app/code-testing/page.tsx:418-452, 533-571`

**Problem:** Header with language selector, and model selector in Ask AI tab have layout issues on mobile.

**Step 1: Update header section (lines 418-452)**

```tsx
{/* Header */}
<MotionWrapper>
  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
    <div className="flex items-center gap-4">
      <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center shrink-0">
        <Code className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
      </div>
      <div className="min-w-0">
        <h1 className="text-xl sm:text-2xl md:text-3xl font-bold">
          <span className="gradient-text-primary">Code Testing Lab</span>
        </h1>
        <p className="text-slate-400 text-sm sm:text-base mt-1 truncate">
          Test and debug code with AI assistance
        </p>
      </div>
    </div>

    {/* Language Selector */}
    <Select value={language} onValueChange={(v) => setLanguage(v as SupportedLanguage)}>
      <SelectTrigger className="w-full sm:w-[150px] bg-slate-900/50 border-slate-700">
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="bg-slate-900 border-slate-700">
        {LANGUAGE_OPTIONS.map((opt) => (
          <SelectItem
            key={opt.value}
            value={opt.value}
            className="text-slate-300 focus:bg-slate-800"
          >
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  </div>
</MotionWrapper>
```

**Step 2: Update Ask AI tab model selector section (lines 533-591)**

```tsx
<div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
  <Select value={selectedModel} onValueChange={setSelectedModel}>
    <SelectTrigger className="w-full sm:w-[250px] bg-slate-900/50 border-slate-700">
      <SelectValue placeholder="Select model" />
    </SelectTrigger>
    <SelectContent className="bg-slate-900 border-slate-700">
      {MODEL_OPTIONS.map((opt) => (
        <SelectItem
          key={opt.value}
          value={opt.value}
          className="text-slate-300 focus:bg-slate-800"
        >
          <div className="flex flex-col">
            <span className="truncate">{opt.label}</span>
            <span className="text-xs text-slate-500">{opt.description}</span>
          </div>
        </SelectItem>
      ))}
      {enabledCustomProviders.length > 0 && (
        <>
          <div className="px-2 py-1.5 text-xs text-slate-500 border-t border-slate-700 mt-1">
            Custom Providers
          </div>
          {enabledCustomProviders.map((provider) => (
            <SelectItem
              key={provider.id}
              value={`custom:${provider.id}`}
              className="text-slate-300 focus:bg-slate-800"
            >
              <div className="flex flex-col">
                <span className="truncate">{provider.name}</span>
                <span className="text-xs text-slate-500 truncate">{provider.modelId}</span>
              </div>
            </SelectItem>
          ))}
        </>
      )}
    </SelectContent>
  </Select>

  <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="w-full sm:w-auto">
    <Button
      onClick={generateCode}
      disabled={!prompt.trim() || isGenerating}
      className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 w-full sm:w-auto"
    >
      {isGenerating ? (
        <>
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          Generating...
        </>
      ) : (
        <>
          <Bot className="h-4 w-4 mr-2" />
          Generate Code
        </>
      )}
    </Button>
  </motion.div>
</div>
```

**Step 3: Update pending code preview buttons (lines 609-636)**

```tsx
<div className="flex flex-col sm:flex-row gap-2 flex-wrap">
  <Button
    size="sm"
    onClick={handleUseCode}
    className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 w-full sm:w-auto"
  >
    <Check className="h-4 w-4 mr-2" />
    Use This Code
  </Button>
  <Button
    size="sm"
    variant="outline"
    onClick={handleAddToCurrent}
    className="border-slate-600 text-slate-300 hover:bg-slate-800 w-full sm:w-auto"
  >
    <Plus className="h-4 w-4 mr-2" />
    Add to Current
  </Button>
  <Button
    size="sm"
    variant="ghost"
    onClick={handleDiscard}
    className="text-slate-400 hover:text-slate-200 w-full sm:w-auto"
  >
    <X className="h-4 w-4 mr-2" />
    Discard
  </Button>
</div>
```

**Step 4: Verify changes compile**

Run: `npm run build`
Expected: Build succeeds without errors

**Step 5: Commit**

```bash
git add app/code-testing/page.tsx
git commit -m "feat(mobile): responsive code testing page layout

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 7: Global CSS - Add Mobile Utility Classes

**Files:**
- Modify: `app/globals.css`

**Problem:** Need utility classes for consistent mobile spacing and touch targets.

**Step 1: Add mobile utility classes at end of file**

```css
/* ========================================
   MOBILE RESPONSIVE UTILITIES
   ======================================== */

/* Ensure minimum touch target size (44px) */
.touch-target {
  min-height: 44px;
  min-width: 44px;
}

/* Safe area padding for notched devices */
.safe-area-inset {
  padding-left: env(safe-area-inset-left);
  padding-right: env(safe-area-inset-right);
  padding-bottom: env(safe-area-inset-bottom);
}

/* Prevent horizontal scroll */
.no-horizontal-scroll {
  overflow-x: hidden;
}

/* Mobile-friendly text truncation */
.mobile-truncate {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100%;
}

/* Mobile card container */
.mobile-card {
  width: 100%;
  max-width: 100%;
  overflow: hidden;
}

/* Responsive dialog */
@media (max-width: 640px) {
  .dropdown-menu {
    min-width: 160px;
    max-width: calc(100vw - 32px);
  }
}

/* Improved tap feedback */
@media (hover: none) {
  .btn-primary:active,
  .btn-secondary:active {
    transform: scale(0.98);
  }
}
```

**Step 2: Verify changes compile**

Run: `npm run build`
Expected: Build succeeds without errors

**Step 3: Commit**

```bash
git add app/globals.css
git commit -m "feat(mobile): add global mobile utility classes

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 8: Root Layout - Fix Main Content Padding

**Files:**
- Modify: `app/layout.tsx`

**Problem:** Main content padding needs adjustment for mobile navbar.

**Step 1: Read the current layout file to understand exact line numbers**

**Step 2: Update main content wrapper**

```tsx
<main className="pt-20 sm:pt-24 px-3 sm:px-4 md:px-6 pb-6 sm:pb-8 max-w-7xl mx-auto relative">
  {children}
</main>
```

**Step 3: Verify changes compile**

Run: `npm run build`
Expected: Build succeeds without errors

**Step 4: Commit**

```bash
git add app/layout.tsx
git commit -m "feat(mobile): adjust main content padding for mobile

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 9: Final Testing and Verification

**Step 1: Build the application**

Run: `npm run build`
Expected: Build succeeds without errors

**Step 2: Start development server**

Run: `npm run dev`
Expected: Server starts successfully

**Step 3: Manual testing checklist**

Test on mobile viewport (375px width) or Chrome DevTools mobile emulator:

- [ ] Mobile nav: Hamburger menu opens/closes
- [ ] Mobile nav: Dropdown sections are collapsed by default
- [ ] Mobile nav: Tapping dropdown expands/collapses with animation
- [ ] Mobile nav: User section shows avatar with "Tap to sign out" hint
- [ ] Mobile nav: Clicking UserButton opens Clerk menu with logout
- [ ] Chat Testing: Header fits on mobile without horizontal scroll
- [ ] Chat Testing: Model selector badges don't overflow
- [ ] Chat Testing: Compare mode checkboxes wrap properly
- [ ] Bug Log: Header and Add Bug button stack on mobile
- [ ] Bug Log: Filter dropdowns are appropriately sized
- [ ] Bug Log: Bug cards show badges without overflow
- [ ] Bug Log: Dialog is properly sized on mobile
- [ ] Prompts: Header and Add Prompt button stack on mobile
- [ ] Prompts: Search and filter section is responsive
- [ ] Prompts: Dialog is properly sized on mobile
- [ ] Code Testing: Header and language selector stack on mobile
- [ ] Code Testing: Ask AI model selector and button stack on mobile
- [ ] All pages: No horizontal scroll issues
- [ ] All pages: Buttons have adequate tap targets (44px minimum)

**Step 4: Commit all changes**

```bash
git add -A
git commit -m "feat: comprehensive mobile responsiveness improvements

- Add collapsible accordion dropdowns in mobile navigation
- Improve user profile section with logout accessibility
- Make ChatInterface header and ModelSelector responsive
- Fix Bug Log page mobile layout (header, filters, cards, dialogs)
- Fix Prompts page mobile layout (header, filters, dialogs)
- Fix Code Testing page mobile layout (header, model selector)
- Add global mobile utility CSS classes
- Adjust root layout padding for mobile

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Summary of Changes

| File | Changes |
|------|---------|
| `components/Navbar.tsx` | Collapsible dropdowns, improved user section |
| `components/ChatInterface.tsx` | Responsive header layout |
| `components/ModelSelector.tsx` | Responsive model badges and selectors |
| `app/bugs/page.tsx` | Responsive header, filters, cards, dialogs |
| `app/prompts/page.tsx` | Responsive header, filters, dialogs |
| `app/code-testing/page.tsx` | Responsive header, model selector |
| `app/globals.css` | Mobile utility classes |
| `app/layout.tsx` | Adjusted mobile padding |
