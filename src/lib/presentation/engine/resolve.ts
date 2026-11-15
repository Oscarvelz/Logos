/**
 * Anchor resolution for the engine — an ADAPTER over the registry's own
 * resolver (src/lib/presentation/anchors.ts), not a second resolver.
 *
 * The registry owns the law and the logic: one declared locator per anchor,
 * exactly-once semantics, ambiguity is a miss, contract anchors resolve by
 * their web↔shell contract names, store anchors by their named probes. This
 * module only routes each record to the registry function for its kind and
 * shapes the answer for the runner/player:
 *
 * - `web` → resolveWeb against the (injectable) root;
 * - `contract` / `manifest` → resolveContract against the (injectable)
 *   contract environment — the shell probe, the bridge, the latest pushed
 *   state. On the fiction stage the host passes the stage's contract stub
 *   as this environment, by the same ids (FENCE-DESIGN §7 clause 6);
 * - `store` → resolveStore against the (injectable) named probes.
 *
 * Resolution is LATE and LIVE — at the moment a step is about to render,
 * never pre-resolved for a scene, never cached across steps. There is NO
 * fallback locator and NO coordinate fallback, ever: if the one declared
 * resolution misses, the step has failed and the runner applies the §7
 * fail-safe (optional → skip + log; required → the scene ends cleanly).
 *
 * A record's `precondition` (registry §5 — unfold the owning card, start
 * playback so the pin exists, …) is a DECLARED resolution step: the runner
 * offers it to the host's `performPrecondition` hook before resolving, and
 * a hook that answers false makes the step a miss. The resolver itself
 * never improvises one.
 */
import {
  anchorRecordFor,
  resolveContract,
  resolveStore,
  resolveWeb,
  type AnchorRecord,
  type ContractEnv,
  type ElementLike,
  type Resolution,
  type RootLike,
  type StoreProbes,
} from '../anchors.ts'
import type { PresentationStep } from './types.ts'

export type { ContractEnv, StoreProbes }

/** The least a resolved web element must offer the player. Real DOM elements qualify. */
export interface AnchorElementLike extends ElementLike {
  click?: () => void
  focus?: () => void
  scrollIntoView?: (options?: { behavior?: string; block?: string; inline?: string }) => void
  getBoundingClientRect?: () => { top: number; bottom: number; left: number; right: number; width: number; height: number }
  addEventListener?: (type: string, listener: () => void, options?: { capture?: boolean }) => void
  removeEventListener?: (type: string, listener: () => void, options?: { capture?: boolean }) => void
}

export type AnchorResolution =
  | { status: 'resolved'; record: AnchorRecord; target: unknown }
  | { status: 'miss'; record: AnchorRecord | null; anchorId: string; reason: string }

export interface AnchorResolverOptions {
  /** The root web anchors resolve against (the document/app root, or a stage subtree). */
  root?: RootLike | (() => RootLike | null | undefined) | null
  /** The contract environment (shell probe / bridge / pushed state, or the stage stub). */
  contractEnv?: ContractEnv | (() => ContractEnv | null | undefined) | null
  /** Named store probes, integrator-wired. */
  storeProbes?: StoreProbes | (() => StoreProbes | null | undefined) | null
}

export interface AnchorResolver {
  resolve: (step: Pick<PresentationStep, 'anchorId' | 'payload'>) => AnchorResolution
  resolveById: (anchorId: string, param?: string) => AnchorResolution
}

function fromResolution<T>(record: AnchorRecord, result: Resolution<T>): AnchorResolution {
  if (result.ok) return { status: 'resolved', record, target: result.value }
  return { status: 'miss', record, anchorId: record.id, reason: result.reason }
}

export function createAnchorResolver(options: AnchorResolverOptions = {}): AnchorResolver {
  const pick = <T,>(source: T | (() => T | null | undefined) | null | undefined): T | null => {
    if (source === null || source === undefined) return null
    if (typeof source === 'function') return (source as () => T | null | undefined)() ?? null
    return source as T
  }

  function resolveById(anchorId: string, param?: string): AnchorResolution {
    // Family-aware (integration amendment, 1.4.166): a concrete
    // family id resolves through its template record, the captured
    // segment becoming the param when the step carries none.
    const found = anchorRecordFor(anchorId)
    if (!found) return { status: 'miss', record: null, anchorId, reason: 'not-in-registry' }
    const record = found.record
    const effParam = param ?? found.param

    switch (record.kind) {
      case 'web': {
        const root = pick<RootLike>(options.root as RootLike | (() => RootLike | null | undefined) | null)
        if (!root) return { status: 'miss', record, anchorId, reason: 'no-root' }
        return fromResolution(record, resolveWeb(root, record, effParam))
      }
      case 'contract':
      case 'manifest': {
        const env = pick<ContractEnv>(options.contractEnv as ContractEnv | (() => ContractEnv | null | undefined) | null) ?? {
          supported: false,
        }
        return fromResolution(record, resolveContract(record, env))
      }
      case 'store': {
        const probes = pick<StoreProbes>(options.storeProbes as StoreProbes | (() => StoreProbes | null | undefined) | null) ?? {}
        return fromResolution(record, resolveStore(record, probes))
      }
    }
  }

  return {
    resolveById,
    resolve: (step) => resolveById(step.anchorId, step.payload?.param),
  }
}

/**
 * The default contract environment from the live page: the shell is
 * supported when the LogosAndroid bridge carries `bubbleState` (the same
 * probe lib/bubble.ts's `bubbleSupported()` makes). Pushed state is not
 * readable back from the page, so push-field anchors need the host to pass
 * its own environment (the fiction stage's stub does); without one they
 * miss honestly rather than guess.
 */
export function liveContractEnv(): ContractEnv {
  const bridge = (globalThis as { LogosAndroid?: Record<string, unknown> }).LogosAndroid ?? null
  return { supported: typeof bridge?.bubbleState === 'function', bridge }
}
