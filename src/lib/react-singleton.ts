// This file ensures all components use the same React instance
// to prevent "Cannot read properties of null (reading 'useRef')" errors
import React from 'react';

// Explicitly export React to ensure it's available globally
export default React;
export const {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
  useContext,
  useReducer,
  useLayoutEffect,
  useDebugValue,
  useDeferredValue,
  useTransition,
  useId,
  useSyncExternalStore,
  useInsertionEffect,
  useOptimistic,
  useActionState,
} = React;
