# Code Style & Formatting

## Tooling
- **Formatter**: Prettier
- **Linter**: ESLint 9
- **Type checker**: TypeScript strict mode

## Formatting Rules
- Use consistent indentation (2 spaces - Prettier default)
- Semicolons at end of statements
- Single quotes for strings
- Trailing commas in multi-line arrays/objects
- Max line width per Prettier defaults

## Code Organization Within Files

### React Components
```typescript
// 1. Imports (external, internal, relative, types)
// 2. Interface/type definitions
// 3. Component function
// 4. Helper functions (if component-specific)
// 5. Export (prefer named exports)

interface ComponentProps {
  bookId: number;
  onUpdate?: (data: UpdateData) => void;
}

export function ComponentName({ bookId, onUpdate }: ComponentProps) {
  // hooks first
  const [state, setState] = useState();
  const { data } = trpc.books.get.useQuery({ bookId });

  // handlers
  const handleSubmit = () => { /* ... */ };

  // render
  return <div>...</div>;
}
```

### Server Router Procedures
```typescript
// Group by CRUD operation
// Always: input validation -> authorization -> business logic -> response
procedureName: protectedProcedure
  .input(z.object({ /* validated input */ }))
  .mutation(async ({ input, ctx }) => {
    // 1. Verify ownership/authorization
    // 2. Perform operation
    // 3. Return result
  }),
```

### Utility Modules
```typescript
// 1. Imports
// 2. Constants/configuration
// 3. Exported functions
// 4. Internal helper functions
```

## Comments
- Use comments to explain "why", not "what"
- Document non-obvious business logic
- Use JSDoc for exported functions that need explanation
- Don't add comments to self-explanatory code

## Error Messages
- User-facing errors: Clear, actionable language
- Developer errors: Include context (IDs, operation attempted)
- Use appropriate tRPC error codes: `NOT_FOUND`, `BAD_REQUEST`, `UNAUTHORIZED`, `FORBIDDEN`, `INTERNAL_SERVER_ERROR`

## Dependencies
- Prefer existing dependencies over adding new ones
- Key libraries already in use: Radix UI (components), lucide-react (icons), date-fns (dates), sonner (toasts), clsx + tailwind-merge (class merging)
- Check package.json before suggesting a new dependency
