import { describe, it, expect } from "vitest";
import { evaluatePlanAccess } from "@/lib/plans";

describe("evaluatePlanAccess", () => {
  it("mantém gateways próprias (0% taxa) por padrão para planos pagos ativos", () => {
    const future = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString();
    const res = evaluatePlanAccess({ plan: "pro", plan_expires_at: future, use_split_wallet: false });
    expect(res.isPaid).toBe(true);
    expect(res.isFree).toBe(false);
    expect(res.canUseOwnGateways).toBe(true);
    expect(res.usesSplitWallet).toBe(false);
    expect(res.optedInSplitWallet).toBe(false);
  });

  it("ativa Carteira & Split Global quando assinante pago escolhe use_split_wallet=true", () => {
    const future = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString();
    const res = evaluatePlanAccess({ plan: "master", plan_expires_at: future, use_split_wallet: true });
    expect(res.isPaid).toBe(true);
    expect(res.isFree).toBe(false);
    expect(res.canUseOwnGateways).toBe(false);
    expect(res.usesSplitWallet).toBe(true);
    expect(res.optedInSplitWallet).toBe(true);
  });

  it("mantém opt-in Split para plano pago vitalício (sem plan_expires_at)", () => {
    const res = evaluatePlanAccess({ plan: "pro", plan_expires_at: null, use_split_wallet: true });
    expect(res.isPaid).toBe(true);
    expect(res.canUseOwnGateways).toBe(false);
    expect(res.usesSplitWallet).toBe(true);
    expect(res.optedInSplitWallet).toBe(true);
  });

  it("não marca optedInSplitWallet para planos Free ou expirados > 48h", () => {
    const freeRes = evaluatePlanAccess({ plan: "free", plan_expires_at: null, use_split_wallet: false });
    expect(freeRes.isFree).toBe(true);
    expect(freeRes.usesSplitWallet).toBe(true);
    expect(freeRes.optedInSplitWallet).toBe(false);

    const expiredOld = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();
    const expRes = evaluatePlanAccess({ plan: "pro", plan_expires_at: expiredOld, use_split_wallet: true });
    expect(expRes.isFree).toBe(true);
    expect(expRes.isGraceExpired).toBe(true);
    expect(expRes.usesSplitWallet).toBe(true);
    expect(expRes.optedInSplitWallet).toBe(false);
  });

  it("mantém cliente Free com Carteira & Split obrigatórios mesmo quando isSystemFree=true", () => {
    const freeRes = evaluatePlanAccess({ plan: "free", plan_expires_at: null, use_split_wallet: false }, true);
    expect(freeRes.isFree).toBe(true);
    expect(freeRes.isPaid).toBe(false);
    expect(freeRes.canUseOwnGateways).toBe(false);
    expect(freeRes.usesSplitWallet).toBe(true);
    expect(freeRes.optedInSplitWallet).toBe(false);
  });
});
