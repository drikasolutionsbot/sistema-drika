import { describe, it, expect } from "vitest";
import { classifyTenantPlan, evaluatePlanAccess } from "@/lib/plans";

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

describe("classifyTenantPlan", () => {
  const now = new Date("2026-11-24T12:00:00Z").getTime();

  it("mantém clientes Free como Free mesmo com trial plan_expires_at no passado", () => {
    const res = classifyTenantPlan(
      { plan: "free", plan_expires_at: "2026-10-01T00:00:00Z" },
      now
    );
    expect(res.effectivePlan).toBe("free");
    expect(res.originalPlan).toBe("free");
    expect(res.isActivePaid).toBe(false);
    expect(res.isExpired).toBe(false);
  });

  it("classifica planos pagos ativos (Básico e Master) corretamente", () => {
    const proRes = classifyTenantPlan(
      { plan: "pro", plan_expires_at: "2026-12-10T00:00:00Z" },
      now
    );
    expect(proRes).toEqual({
      effectivePlan: "pro",
      originalPlan: "pro",
      isActivePaid: true,
      isExpired: false,
    });

    const masterLifetime = classifyTenantPlan(
      { plan: "master", plan_expires_at: null },
      now
    );
    expect(masterLifetime).toEqual({
      effectivePlan: "master",
      originalPlan: "master",
      isActivePaid: true,
      isExpired: false,
    });
  });

  it("classifica planos pagos com plan_expires_at vencido como expired", () => {
    const expiredPro = classifyTenantPlan(
      { plan: "pro", plan_expires_at: "2026-11-20T00:00:00Z" },
      now
    );
    expect(expiredPro).toEqual({
      effectivePlan: "expired",
      originalPlan: "pro",
      isActivePaid: false,
      isExpired: true,
    });

    const expiredMaster = classifyTenantPlan(
      { plan: "master", plan_expires_at: "2026-11-23T23:59:59Z" },
      now
    );
    expect(expiredMaster.effectivePlan).toBe("expired");
    expect(expiredMaster.originalPlan).toBe("master");
    expect(expiredMaster.isActivePaid).toBe(false);
    expect(expiredMaster.isExpired).toBe(true);
  });

  it("reconhece plan='expired' explícito e valores desconhecidos como free", () => {
    expect(classifyTenantPlan({ plan: "expired", plan_expires_at: null }, now)).toEqual({
      effectivePlan: "expired",
      originalPlan: "expired",
      isActivePaid: false,
      isExpired: true,
    });

    expect(classifyTenantPlan({ plan: null, plan_expires_at: null }, now).effectivePlan).toBe("free");
  });
});

