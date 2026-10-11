import type { IconReading } from "@/lib/icon-reading";

export type ModelTier = "fast" | "balanced" | "strong";

export type CatalogModel = {
  id: string;
  parameters?: { id: string; values: { value: string }[] }[];
};

export type PickedModel = {
  tier: ModelTier;
  selection: { id: string; params?: { id: string; value: string }[] };
  reason: string;
};

const ROUTER_ID = "auto-smart";

const TIER_PREFERENCES: Record<ModelTier, string[]> = {
  fast: ["composer-2.5-fast", "composer-2.5", "composer"],
  balanced: ["composer-2.5", "claude-sonnet", "gpt-5"],
  strong: [ROUTER_ID, "claude-opus", "gpt-5", "composer-2.5"],
};

const DEFAULT_WITHOUT_CATALOG: Record<ModelTier, string> = {
  fast: "composer-2.5",
  balanced: "composer-2.5",
  strong: "auto",
};

const ROUTER_MODE: Record<ModelTier, string[]> = {
  fast: ["speed", "balanced"],
  balanced: ["balanced"],
  strong: ["intelligence", "balanced"],
};

export function tierFor(reading: IconReading): {
  tier: ModelTier;
  reason: string;
} {
  const top = reading.castings[reading.ranking[0]];
  const second = reading.castings[reading.ranking[1]];
  const margin = top.fit - second.fit;
  const positive = top.evidence.find((item) => item.weight > 0);
  const says = positive?.says ?? top.evidence[0]?.says ?? "";
  if (top.fit < 4 || margin <= 1) {
    return {
      tier: "strong",
      reason: `no clear structural match (top fit ${top.fit}, margin ${margin}${says ? `; ${says}` : ""})`,
    };
  }
  if (top.fit >= 6 && margin >= 3) {
    return {
      tier: "fast",
      reason: `clear winner (fit ${top.fit}, margin ${margin}${says ? `; ${says}` : ""})`,
    };
  }
  return {
    tier: "balanced",
    reason: `moderate match (fit ${top.fit}, margin ${margin}${says ? `; ${says}` : ""})`,
  };
}

function routerSelection(
  router: CatalogModel,
  tier: ModelTier
): PickedModel["selection"] | null {
  const optimizeFor = router.parameters?.find((p) => p.id === "optimize_for");
  if (!optimizeFor) {
    return null;
  }
  const allowed = new Set(optimizeFor.values.map((v) => v.value));
  const mode = ROUTER_MODE[tier].find((m) => allowed.has(m));
  return mode
    ? { id: router.id, params: [{ id: optimizeFor.id, value: mode }] }
    : null;
}

function selectFromCatalog(
  tier: ModelTier,
  catalog: CatalogModel[]
): PickedModel["selection"] | null {
  for (const prefix of TIER_PREFERENCES[tier]) {
    const model = catalog.find(
      (m) => m.id === prefix || m.id.startsWith(prefix)
    );
    if (!model) {
      continue;
    }
    if (model.id === ROUTER_ID) {
      const selection = routerSelection(model, tier);
      if (selection) {
        return selection;
      }
      continue;
    }
    return { id: model.id };
  }
  return null;
}

export function pickSuggestModel(
  reading: IconReading,
  catalog: CatalogModel[] | null
): PickedModel {
  const { tier, reason } = tierFor(reading);
  const selection = (catalog && selectFromCatalog(tier, catalog)) ?? {
    id: DEFAULT_WITHOUT_CATALOG[tier],
  };
  return { tier, selection, reason };
}
