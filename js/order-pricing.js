(function () {
  function futureDate(days = 14) {
    const date = new Date(Date.now() + days * 86400000);
    return date.toISOString().slice(0, 10);
  }

  async function getEstimate(order) {
    if (!window.supabaseClient) return null;
    const payload = {
      productPriceCny: Number(order.productPriceCny),
      quantity: Number(order.quantity || 1),
      category: order.category,
      manualWeightKg: order.category === "manual" ? Number(order.manualWeightKg) : null,
      origin: "PVG",
      destination: "IKA",
      departureDate: futureDate(14),
    };

    try {
      const { data, error } = await window.supabaseClient.functions.invoke("order-quote", { body: payload });
      if (error || !data?.ok) return null;
      return {
        totalToman: Number(data.estimatedTotalToman) || null,
        expiresAt: new Date(Date.now() + (Number(data.validForMinutes) || 30) * 60000).toISOString(),
      };
    } catch (error) {
      console.warn("Silent order pricing unavailable", error);
      return null;
    }
  }

  window.OrderPricing = { getEstimate };
})();
