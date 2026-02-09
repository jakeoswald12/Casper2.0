# React Patterns & Frontend Rules

## React Version
- Using React 19 - leverage latest features
- Use functional components exclusively - no class components (except ErrorBoundary)
- Use hooks for all state and side effects

## State Management
- **Server state**: tRPC React Query hooks (`trpc.*.useQuery`, `trpc.*.useMutation`)
- **Client state**: Zustand stores for complex cross-component state
- **Local state**: `useState` for component-scoped state
- **Never** prop-drill more than 2-3 levels - use Zustand or Context instead

## tRPC Usage
```typescript
// Queries
const { data, isLoading } = trpc.books.list.useQuery({ userId });

// Mutations with cache invalidation
const utils = trpc.useUtils();
const mutation = trpc.books.create.useMutation({
  onSuccess: () => {
    utils.books.list.invalidate();
  },
});

// Optimistic updates for better UX
const mutation = trpc.books.update.useMutation({
  onMutate: async (newData) => {
    await utils.books.get.cancel();
    const previous = utils.books.get.getData();
    utils.books.get.setData(newData);
    return { previous };
  },
  onError: (err, newData, context) => {
    utils.books.get.setData(context?.previous);
  },
});
```

## Component Structure
- UI primitives live in `client/src/components/ui/` (Radix-based, shadcn/ui style)
- Feature components organized by domain: `editor/`, `chat/`, `sources/`, `summary/`, `export/`, `settings/`, `library/`
- Pages live in `client/src/pages/`
- Shared utilities in `client/src/lib/`

## Styling
- Tailwind CSS v4 with CSS custom properties for theming
- Use `cn()` utility (clsx + tailwind-merge) for conditional classes
- Dark mode via `class` strategy
- Design tokens: HSL color variables (`--primary`, `--background`, `--muted`, etc.)
- Font families: Inter (sans), JetBrains Mono (mono), Merriweather (serif)

## Routing
- Using `wouter` (lightweight React router) - not React Router
- Routes defined in `App.tsx`
- Key routes: `/`, `/dashboard`, `/studio/:bookId`, `/settings`, `/library`, `/pricing`

## Lexical Editor
- Rich text editor using Facebook's Lexical framework
- Custom nodes: `SectionMarkerNode` for chapter/section boundaries
- Custom plugins: `AIIntegrationPlugin`, `AutoSavePlugin`, `ToolbarPlugin`
- Editor state stored as JSON in database `manuscripts.content`
- Always debounce auto-save (default 1000ms)

## Performance
- Use `React.lazy()` for heavy components (ManuscriptEditor, ChatPanel, SourcesManager)
- `useMemo` for expensive computations (word counts, text processing)
- `useCallback` for callbacks passed to child components
- Debounce save operations to avoid excessive API calls

## Auth Pattern
- JWT token stored in localStorage
- Token sent via Authorization header on tRPC requests
- Redirect to login if unauthorized
- Auth state checked in App.tsx route guards
