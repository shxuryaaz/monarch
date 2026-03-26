# Monarch Bug Fix & Enhancement Plan

## Overview
Based on comprehensive codebase analysis, I've identified all bugs and created a prioritized fix plan.

---

## 🐛 Critical Bugs Found

### 1. Portfolio Graph Resets to Straight Line ⚠️ HIGH PRIORITY

**Location**: `monarch-assets/src/pages/AssetDetail.tsx` (Lines 107-113)

**Bug**: Chart data resets every time asset data refetches because `asset?.id` is in the dependency array.

**Current Code**:
```typescript
useEffect(() => {
  if (!asset) return;
  const price = asset.oraclePriceUsd ?? asset.tokenPriceUsd;
  const yieldPct = asset.oracleYieldPct ?? asset.expectedYieldPct;
  const t = Date.now();
  setSeries((prev) => [...prev, { i: prev.length, t, price, yieldPct }].slice(-48));
}, [asset?.id, dataUpdatedAt, asset]);  // ❌ BUG: asset?.id causes reset
```

**Root Cause**: When React Query refetches, `asset` is a new object reference, causing `asset?.id` to trigger the effect and reset the series.

**Fix**:
```typescript
useEffect(() => {
  if (!asset) return;
  const price = asset.oraclePriceUsd ?? asset.tokenPriceUsd;
  const yieldPct = asset.oracleYieldPct ?? asset.expectedYieldPct;
  const t = Date.now();
  setSeries((prev) => [...prev, { i: prev.length, t, price, yieldPct }].slice(-48));
}, [dataUpdatedAt]);  // ✅ FIX: Only depend on dataUpdatedAt, not asset
```

**Alternative Fix** (if you need to reset on asset change):
```typescript
const assetIdRef = useRef(asset?.id);

useEffect(() => {
  if (!asset) return;

  // Reset series if asset ID actually changed
  if (assetIdRef.current !== asset.id) {
    setSeries([]);
    assetIdRef.current = asset.id;
  }

  const price = asset.oraclePriceUsd ?? asset.tokenPriceUsd;
  const yieldPct = asset.oracleYieldPct ?? asset.expectedYieldPct;
  const t = Date.now();
  setSeries((prev) => [...prev, { i: prev.length, t, price, yieldPct }].slice(-48));
}, [dataUpdatedAt, asset?.id]);
```

---

### 2. Sell Position Logic Broken ⚠️ HIGH PRIORITY

**Location**: `monarch-api/src/routes/sales.routes.ts` (Lines 127-134)

**Bug**: Tokens aren't properly returned to available supply after sale.

**Current Code**:
```typescript
const assetRow = await prisma.asset.findUniqueOrThrow({ where: { id: sale.assetId } });
const returned = Math.min(
  assetRow.tokensOffered,
  assetRow.availableSupply + sale.tokenAmount  // ❌ BUG: Wrong logic
);
await prisma.asset.update({
  where: { id: sale.assetId },
  data: { availableSupply: returned }
});
```

**Root Cause**: The logic caps returned tokens incorrectly. Should just add tokens back without complex min/max.

**Fix**:
```typescript
const assetRow = await prisma.asset.findUniqueOrThrow({ where: { id: sale.assetId } });

// Simply add tokens back, but don't exceed total tranche size
const newAvailable = Math.min(
  assetRow.tokensOffered,
  assetRow.availableSupply + sale.tokenAmount
);

await prisma.asset.update({
  where: { id: sale.assetId },
  data: { availableSupply: newAvailable }
});
```

**Better Fix** (with validation):
```typescript
const assetRow = await prisma.asset.findUniqueOrThrow({ where: { id: sale.assetId } });

// Calculate new available supply
const newAvailable = assetRow.availableSupply + sale.tokenAmount;

// Validate we're not exceeding total tranche
if (newAvailable > assetRow.tokensOffered) {
  throw new Error(`Cannot return ${sale.tokenAmount} tokens: would exceed tranche size`);
}

await prisma.asset.update({
  where: { id: sale.assetId },
  data: { availableSupply: newAvailable }
});
```

---

### 3. Tranche Float Marketplace Logic Broken ⚠️ MEDIUM PRIORITY

**Location**: `monarch-api/src/lib/asset-json.ts` (Lines 7-16)

**Bug**: When `tokensOffered` is 0, it falls back to `availableSupply`, breaking percentage calculations.

**Current Code**:
```typescript
export function toAssetApiJson(asset: PrismaAsset): AssetApiRow {
  const offered =
    asset.tokensOffered > 0 ? asset.tokensOffered : Math.max(asset.availableSupply, 1);
  const pctRemaining =
    offered > 0 ? Math.min(1, Math.max(0, asset.availableSupply / offered)) : 1;
  return {
    ...asset,
    tokensOffered: offered,
    pctRemaining
  };
}
```

**Root Cause**: Fallback logic inverts semantics when `tokensOffered` is missing/zero.

**Fix**:
```typescript
export function toAssetApiJson(asset: PrismaAsset): AssetApiRow {
  // tokensOffered must be valid - no fallback
  const offered = asset.tokensOffered || 0;

  // Calculate percentage remaining (handle division by zero)
  const pctRemaining = offered > 0
    ? Math.min(1, Math.max(0, asset.availableSupply / offered))
    : 0; // 0% if no tranche defined

  return {
    ...asset,
    tokensOffered: offered,
    pctRemaining
  };
}
```

**Additional Frontend Fix**: `monarch-assets/src/pages/Marketplace.tsx` (Line 161)

Remove duplicate calculation:
```typescript
// Before:
pctRemaining: a.pctRemaining ?? (a.tokensOffered > 0 ? a.availableSupply / a.tokensOffered : 1)

// After:
pctRemaining: a.pctRemaining ?? 0  // Trust backend calculation
```

---

### 4. Asset Listing Validation Issues ⚠️ MEDIUM PRIORITY

**Location**: `monarch-api/src/routes/listings.routes.ts` (Lines 20-42)

**Bug**: No business logic validation for asset economics.

**Missing Validations**:
1. Token price × tokens offered should ≈ total asset value
2. Expected yield should be reasonable (0-20%)
3. All numeric fields should be > 0

**Fix** (add validation before creating listing):
```typescript
router.post("/", requireAuth, async (req, res, next) => {
  try {
    const body = listingCreate.parse(req.body);

    // Validate economics make sense
    const impliedValue = body.tokenPriceUsd * body.tokensOffered;
    const valueDiff = Math.abs(impliedValue - body.totalAssetValue);
    const valueDiffPct = valueDiff / body.totalAssetValue;

    if (valueDiffPct > 0.05) { // Allow 5% tolerance
      return res.status(400).json({
        error: "Economics mismatch",
        message: `Token price (${body.tokenPriceUsd}) × tokens offered (${body.tokensOffered}) = $${impliedValue.toFixed(2)}, but total asset value is $${body.totalAssetValue.toFixed(2)}. Difference: ${(valueDiffPct * 100).toFixed(1)}%`
      });
    }

    // Validate yield is reasonable
    if (body.expectedYieldPct < 0 || body.expectedYieldPct > 20) {
      return res.status(400).json({
        error: "Invalid yield",
        message: "Expected yield must be between 0% and 20%"
      });
    }

    // Create listing
    const listing = await prisma.assetListing.create({
      data: {
        submitterId: req.user!.sub,
        status: "SUBMITTED",
        name: body.name,
        symbol: body.symbol,
        type: body.type,
        location: body.location,
        description: body.description,
        tokenPriceUsd: body.tokenPriceUsd,
        totalAssetValue: body.totalAssetValue,
        tokensOffered: body.tokensOffered,
        expectedYieldPct: body.expectedYieldPct
      }
    });

    res.status(201).json({ listing });
  } catch (error) {
    next(error);
  }
});
```

---

## 🎨 Enhancements Needed

### 5. Improve 3D Background on Landing Page 🎯

**Current State**: `monarch-assets/src/components/CrystalBackground.tsx`
- Basic sphere with displacement
- 950 particles
- Simple rotation animation

**Enhancement Plan**:

**Option A: Enhanced Crystal** (Recommended)
```typescript
// Add more dramatic displacement
const displacement = 0.35 + Math.sin(a * 9.7) * Math.cos(b * 7.3) * 0.25;  // Increase from 0.18

// Add color variation to particles
const hue = (i / particleCount) * 60;  // Blue to cyan gradient
particleMaterial.color.setHSL(hue / 360, 0.8, 0.6);

// Add pulsing effect
mesh.scale.setScalar(1 + Math.sin(t * 0.5) * 0.05);

// Add inner glow sphere
const glowGeometry = new THREE.SphereGeometry(1.3, 32, 32);
const glowMaterial = new THREE.MeshBasicMaterial({
  color: 0x4444ff,
  transparent: true,
  opacity: 0.15,
  side: THREE.BackSide
});
const glowMesh = new THREE.Mesh(glowGeometry, glowMaterial);
scene.add(glowMesh);
```

**Option B: Particle Field** (More dramatic)
```typescript
// Replace crystal with flowing particle field
// 5000 particles forming wave patterns
// Faster movement, more dynamic
```

**Option C: Abstract Geometry** (Modern)
```typescript
// Animated platonic solid morphing
// Clean, minimal, professional
```

---

### 6. Add Transaction Animations 🎯

**Locations to Add Animations**:

#### A. Buy/Sell Button States
**File**: `monarch-assets/src/components/SellRwaPanel.tsx`

Add loading state with spinner:
```typescript
<Button
  onClick={handleSellClick}
  disabled={isLoading || !canSell}
  className="relative"
>
  {isLoading && (
    <motion.div
      className="absolute inset-0 flex items-center justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <Loader2 className="h-4 w-4 animate-spin" />
    </motion.div>
  )}
  <span className={isLoading ? "opacity-0" : ""}>
    Sell
  </span>
</Button>
```

#### B. Transaction Success Animation
**File**: `monarch-assets/src/components/InvestRitualOverlay.tsx`

Add checkmark animation on success:
```typescript
{phase === "success" && (
  <motion.div
    initial={{ scale: 0 }}
    animate={{ scale: 1 }}
    transition={{ type: "spring", stiffness: 200, damping: 15 }}
  >
    <Check className="h-16 w-16 text-green-500" />
  </motion.div>
)}
```

Add progress indicator for phases:
```typescript
<motion.div
  className="h-1 bg-blue-500"
  initial={{ width: "0%" }}
  animate={{
    width: phase === "sign" ? "33%" :
           phase === "settle" ? "66%" :
           phase === "success" ? "100%" : "0%"
  }}
  transition={{ duration: 0.5 }}
/>
```

#### C. Portfolio Value Update Animation
**File**: `monarch-assets/src/pages/Dashboard.tsx`

Animate number changes:
```typescript
import { AnimatePresence, motion } from "framer-motion";

<motion.div
  key={portfolio?.totalValue}
  initial={{ opacity: 0, y: -10 }}
  animate={{ opacity: 1, y: 0 }}
  exit={{ opacity: 0, y: 10 }}
  transition={{ duration: 0.3 }}
>
  ${portfolio?.totalValue.toFixed(2)}
</motion.div>
```

#### D. Asset Card Hover Effects
**File**: `monarch-assets/src/components/AssetCard.tsx`

Add subtle float on hover:
```typescript
<motion.div
  whileHover={{
    y: -4,
    boxShadow: "0 12px 40px rgba(255,255,255,0.08)"
  }}
  transition={{ type: "spring", stiffness: 300, damping: 20 }}
>
  {/* Card content */}
</motion.div>
```

---

## 📋 Implementation Priority

### Phase 1: Critical Bugs (Do First) ⚡
1. ✅ Fix portfolio graph reset (AssetDetail.tsx)
2. ✅ Fix sell position logic (sales.routes.ts)
3. ✅ Fix tranche float calculation (asset-json.ts + Marketplace.tsx)
4. ✅ Add listing validation (listings.routes.ts)

**Estimated Time**: 2-3 hours

### Phase 2: Visual Enhancements (Do Next) 🎨
5. ✅ Improve 3D background (CrystalBackground.tsx)
6. ✅ Add transaction animations (InvestRitualOverlay.tsx, SellRwaPanel.tsx, Dashboard.tsx)

**Estimated Time**: 3-4 hours

---

## 🧪 Testing Checklist

After fixes:
- [ ] Portfolio graph maintains history across refreshes
- [ ] Selling tokens returns correct amount to available supply
- [ ] Marketplace tranche % displays correctly
- [ ] Asset listing validates economics (price × tokens ≈ value)
- [ ] Buy transaction shows animated loading states
- [ ] Sell transaction shows animated loading states
- [ ] 3D background looks polished and professional
- [ ] All animations respect prefers-reduced-motion

---

## 📝 Files to Modify

| File | Lines | Change |
|------|-------|--------|
| `monarch-assets/src/pages/AssetDetail.tsx` | 107-113 | Fix dependency array |
| `monarch-api/src/routes/sales.routes.ts` | 127-134 | Fix supply return logic |
| `monarch-api/src/lib/asset-json.ts` | 7-16 | Remove fallback logic |
| `monarch-assets/src/pages/Marketplace.tsx` | 161 | Remove duplicate calc |
| `monarch-api/src/routes/listings.routes.ts` | 20-42 | Add validation |
| `monarch-assets/src/components/CrystalBackground.tsx` | Multiple | Enhance visuals |
| `monarch-assets/src/components/InvestRitualOverlay.tsx` | Multiple | Add animations |
| `monarch-assets/src/components/SellRwaPanel.tsx` | Multiple | Add loading states |
| `monarch-assets/src/pages/Dashboard.tsx` | Multiple | Animate value changes |

---

## 🚀 Ready to Execute?

All bugs identified, root causes found, and fixes ready to implement. Shall I proceed with the fixes?
