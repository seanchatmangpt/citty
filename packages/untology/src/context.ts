import { createContext } from 'unctx'
import type { Store } from 'n3'

export interface OntologyContext {
  store: Store
  prefixes: Record<string, string>
  defaultFormat: 'turtle' | 'ntriples' | 'nquads' | 'trig'
}

export const ontologyContext = createContext<OntologyContext>('untology:context')

export function useOntology() {
  const ctx = ontologyContext.use()
  if (!ctx) {
    throw new Error('No ontology context available. Did you call loadGraph() first?')
  }
  return ctx
}

export function hasOntology(): boolean {
  return ontologyContext.tryUse() !== undefined
}

export function withOntology<T>(context: Partial<OntologyContext>, fn: () => T): T {
  return ontologyContext.call(context as OntologyContext, fn)
}