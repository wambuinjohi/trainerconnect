# Search Integration Guide

This guide explains how to use the new search components and utilities in your application.

## Quick Start

### 1. Using the SearchBar Component

The `SearchBar` component is a ready-to-use search input with suggestions, history, and keyboard navigation.

```tsx
import { SearchBar } from '@/components/client/SearchBar'
import { useSearchHistory } from '@/hooks/use-search-history'

function MyComponent() {
  const [searchQuery, setSearchQuery] = useState('')
  const { recentSearches, popularSearches, addSearch } = useSearchHistory({ trainers })

  return (
    <SearchBar
      placeholder="Search trainers..."
      value={searchQuery}
      onChange={setSearchQuery}
      onSubmit={(query) => {
        addSearch(query)
        // Handle search submission
      }}
      suggestions={/* generated suggestions */}
      recentSearches={recentSearches}
      popularSearches={popularSearches}
    />
  )
}
```

### 2. Using Search History

Track and display user's recent searches and popular searches:

```tsx
import { useSearchHistory } from '@/hooks/use-search-history'

function MyComponent() {
  const { recentSearches, popularSearches, addSearch, clearHistory } = useSearchHistory({
    trainers: trainersList,
    limit: 10,
  })

  // Use recentSearches and popularSearches in dropdown
  // Call addSearch(query) when user performs a search
  // Call clearHistory() to reset search history
}
```

### 3. Basic Fuzzy Search

For simple fuzzy matching:

```tsx
import { fuzzyScore, generateSuggestions } from '@/lib/search-utils'

// Get a relevance score (0-1)
const score = fuzzyScore('JavaScript Developer', 'js dev')
console.log(score) // Higher score = better match

// Generate suggestions
const suggestions = generateSuggestions(trainers, 'java', 5)
```

### 4. Advanced Search

For complex search with filters and sorting:

```tsx
import { advancedSearch } from '@/lib/advanced-search'

const results = advancedSearch(trainers, {
  query: 'yoga instructor',
  minRating: 4,
  maxPrice: 5000,
  radius: 10,
  categoryIds: [1, 2],
  onlyAvailable: true,
  sortBy: 'relevance',
  sortOrder: 'desc',
})

// Results include item, score, and matched fields
results.forEach(result => {
  console.log(result.item.name, result.score, result.matchedFields)
})
```

## Components

### SearchBar

**Props:**
```typescript
interface SearchBarProps {
  placeholder?: string                    // Input placeholder text
  value: string                          // Current search query
  onChange: (value: string) => void      // Called when input changes
  onSubmit?: (value: string) => void     // Called when user submits search
  suggestions?: string[]                 // Auto-completion suggestions
  recentSearches?: string[]              // Recent search history
  popularSearches?: string[]             // Popular/trending searches
  isLoading?: boolean                    // Show loading state
  className?: string                     // Additional CSS classes
}
```

**Features:**
- Real-time debounced search (300ms)
- Keyboard navigation (arrow keys, Enter, Escape)
- Clear button to reset search
- Three categories of suggestions:
  - Direct matches (suggestions)
  - Recent searches
  - Popular searches
- Visual highlighting of matched text
- Accessible (ARIA labels, semantic HTML)

**Keyboard Shortcuts:**
- `↓` / `↑`: Navigate suggestions
- `Enter`: Select highlighted suggestion or submit
- `Escape`: Close suggestions dropdown

## Hooks

### useSearchHistory

**Options:**
```typescript
interface UseSearchHistoryOptions {
  trainers?: Array<{ name: string; discipline?: string }>  // Data for popular searches
  limit?: number  // Max recent searches to store (default: 10)
}
```

**Returns:**
```typescript
{
  recentSearches: string[]     // List of recent searches
  popularSearches: string[]    // Generated popular searches
  addSearch: (query: string) => void  // Add to history
  clearHistory: () => void     // Clear all history
}
```

**Storage:** Uses `localStorage` with key `"recent_searches"`

## Utilities

### search-utils.ts

#### fuzzyScore(haystack, needle): number
Returns a relevance score (0-1) for how well the needle matches the haystack.

```tsx
const score = fuzzyScore('JavaScript Developer', 'js')
// Returns: 0.63 (close match)
```

#### searchTrainers(trainers, query, options): Trainer[]
Filter and rank trainers based on query with fuzzy matching.

```tsx
const results = searchTrainers(trainers, 'yoga', { fuzzy: true, limit: 10 })
```

#### generateSuggestions(trainers, query, limit): string[]
Generate trainer name suggestions matching the query.

```tsx
const suggestions = generateSuggestions(trainers, 'jo', 5)
// Returns: ['John', 'Joanna', 'Joseph', ...]
```

#### highlightQuery(text, query): Array<{text, highlighted}>
Get text segments with highlighting information for rendering.

```tsx
const parts = highlightQuery('JavaScript Developer', 'script')
// Returns: [
//   { text: 'Java', highlighted: false },
//   { text: 'Script', highlighted: true },
//   { text: ' Developer', highlighted: false }
// ]
```

### advanced-search.ts

#### advancedSearch(items, options, searchFields): SearchResult[]
Comprehensive search with filtering, scoring, and sorting.

**Options:**
```typescript
interface AdvancedSearchOptions {
  query?: string              // Search text
  minRating?: number         // Minimum rating filter
  maxPrice?: number          // Maximum price filter
  radius?: number            // Distance radius in km
  categoryIds?: number[]     // Category filters
  onlyAvailable?: boolean    // Only show available items
  sortBy?: 'relevance' | 'rating' | 'price' | 'distance'
  sortOrder?: 'asc' | 'desc'
}
```

**Example:**
```tsx
const results = advancedSearch(
  trainers,
  {
    query: 'yoga',
    minRating: 4.5,
    maxPrice: 3000,
    sortBy: 'rating',
    sortOrder: 'desc',
  },
  ['name', 'discipline', 'specialties']
)
```

#### getSearchStats(results): SearchStats
Get statistics about search results.

```tsx
const stats = getSearchStats(results)
console.log(`Found ${stats.total} results`)
console.log(`Average relevance: ${stats.averageScore.toFixed(2)}`)
```

#### buildSearchQuery / parseSearchQuery
Convert between search options and query strings.

```tsx
const queryStr = buildSearchQuery({
  query: 'yoga',
  minRating: 4,
  maxPrice: 5000
})
// Returns: "q:yoga rating:4 price:5000"

const options = parseSearchQuery("q:yoga rating:4 price:5000")
// Returns: { query: 'yoga', minRating: 4, maxPrice: 5000 }
```

## Common Patterns

### 1. Search with Real-time Suggestions

```tsx
const [query, setQuery] = useState('')
const { recentSearches, popularSearches, addSearch } = useSearchHistory({ trainers })

const suggestions = useMemo(() => {
  if (!query) return []
  return trainers
    .filter(t => t.name.toLowerCase().includes(query.toLowerCase()))
    .map(t => t.name)
    .slice(0, 5)
}, [query, trainers])

return (
  <SearchBar
    value={query}
    onChange={setQuery}
    onSubmit={addSearch}
    suggestions={suggestions}
    recentSearches={recentSearches}
    popularSearches={popularSearches}
  />
)
```

### 2. Filter and Sort Results

```tsx
import { advancedSearch } from '@/lib/advanced-search'

const [filters, setFilters] = useState({})
const [sortBy, setSortBy] = useState('relevance')

const results = useMemo(() => {
  return advancedSearch(trainers, {
    ...filters,
    sortBy,
    sortOrder: 'desc',
  }, ['name', 'discipline'])
}, [trainers, filters, sortBy])
```

### 3. Highlight Search Results

```tsx
import { highlightQuery } from '@/lib/search-utils'

function SearchResult({ text, query }) {
  const parts = highlightQuery(text, query)
  return (
    <div>
      {parts.map((part, i) =>
        part.highlighted ? (
          <mark key={i} className="bg-yellow-200">{part.text}</mark>
        ) : (
          <span key={i}>{part.text}</span>
        )
      )}
    </div>
  )
}
```

## Performance Tips

1. **Use Debouncing:** The SearchBar already debounces at 300ms. Don't add additional debouncing.

2. **Memoize Suggestions:** Use `useMemo` to prevent unnecessary re-computation of suggestions.

3. **Limit Results:** Always set a `limit` parameter to prevent large result sets:
   ```tsx
   const suggestions = generateSuggestions(trainers, query, 5)
   ```

4. **Cache Popular Searches:** Popular searches are generated on-the-fly. Consider caching them:
   ```tsx
   const cachedPopular = useMemo(
     () => generateSuggestions(trainers, '', 10),
     [trainers]
   )
   ```

5. **Use Advanced Search for Complex Filters:** For multiple filters, use `advancedSearch` instead of chaining filter operations.

## Troubleshooting

### Suggestions not appearing
- Check that `suggestions`, `recentSearches`, and `popularSearches` are not empty
- Verify that the input is focused (click or type in the SearchBar)
- Check browser console for errors

### Search history not persisting
- Verify localStorage is enabled in the browser
- Check that `localStorage` key is `"recent_searches"`
- Clear browser data might have deleted the history

### Keyboard navigation not working
- Ensure the SearchBar is focused
- Check that suggestions dropdown is visible
- Verify there are suggestions to navigate

### Performance issues
- Check the size of the trainers array
- Consider paginating results if there are > 1000 items
- Profile the search algorithm using browser DevTools

## Migration from Old Code

If migrating from the old inline search implementation:

### Before:
```tsx
<div className="relative">
  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2" />
  <Input
    placeholder="Search..."
    value={searchQuery}
    onChange={(e) => setSearchQuery(e.target.value)}
  />
</div>
```

### After:
```tsx
<SearchBar
  placeholder="Search..."
  value={searchQuery}
  onChange={setSearchQuery}
  onSubmit={(query) => addSearch(query)}
  suggestions={suggestions}
  recentSearches={recentSearches}
  popularSearches={popularSearches}
/>
```

## Best Practices

1. ✅ **Always use debouncing** - Prevents excessive filtering
2. ✅ **Store search history** - Improves UX with recent searches
3. ✅ **Provide suggestions** - Helps users discover trainers
4. ✅ **Use fuzzy matching** - Allows typos and partial matches
5. ✅ **Rank by relevance** - Most relevant results first
6. ✅ **Accessibility first** - Include ARIA labels and keyboard support
7. ✅ **Optimize performance** - Memoize expensive computations
8. ✅ **Provide feedback** - Show loading states and result counts

## Examples

See the implementations in:
- `src/components/client/ClientDashboard.tsx` - Dashboard search
- `src/pages/Explore.tsx` - Explore page search

Both components demonstrate best practices and full integration of the search system.
