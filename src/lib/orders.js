import { supabase, isSupabaseConfigured } from "./supabase.js";

/**
 * @param {object} payload
 * @param {string} payload.customer_name
 * @param {string} payload.customer_phone
 * @param {string} payload.customer_email
 * @param {string} payload.customer_city
 * @param {string} payload.customer_address
 * @param {string} [payload.notes]
 * @param {{ product_id: string, quantity: number }[]} payload.items
 */
export async function createOrder(payload) {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Store is not configured. Please try again later.");
  }

  const { data, error } = await supabase.rpc("create_order", {
    p_customer_name: payload.customer_name,
    p_customer_phone: payload.customer_phone,
    p_customer_email: payload.customer_email,
    p_customer_city: payload.customer_city,
    p_customer_address: payload.customer_address,
    p_notes: payload.notes ?? "",
    p_items: payload.items,
  });

  if (error) throw error;
  return data;
}

/** @param {object} order @param {'created' | 'cancelled'} [event] */
export function orderEmailPayload(order, event = "created") {
  const items = order.items || order.order_items || [];
  return {
    event,
    order_number: order.order_number,
    total: order.total,
    customer_name: order.customer_name,
    customer_email: order.customer_email,
    customer_phone: order.customer_phone,
    customer_city: order.customer_city,
    customer_address: order.customer_address,
    notes: order.notes,
    items: items.map((i) => ({
      name: i.name || i.product_name,
      quantity: i.quantity,
    })),
  };
}

/** @param {object} orderData @param {'created' | 'cancelled'} [event] */
export async function notifyOrderEmail(orderData, event = "created") {
  if (!isSupabaseConfigured || !supabase) return;

  try {
    await supabase.functions.invoke("send-order-email", {
      body: orderEmailPayload(orderData, event),
    });
  } catch {
    // Non-blocking — order change is already saved
  }
}

/** @param {object} orderData */
export async function notifyAdminOrder(orderData) {
  return notifyOrderEmail(orderData, "created");
}

/** @returns {Promise<object[]>} */
export async function fetchOrders() {
  const { data, error } = await supabase
    .from("orders")
    .select("*, order_items(*)")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

/** @param {string} id @param {string} status */
export async function updateOrderStatus(id, status) {
  const { error } = await supabase
    .from("orders")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

/** @param {string} id */
export async function deleteOrder(id) {
  const { error } = await supabase.from("orders").delete().eq("id", id);
  if (error) throw error;
}

/** @param {object[]} orders @param {'1d' | '7d' | '30d' | 'all'} [revenuePeriod] */
export function orderMetrics(orders, revenuePeriod = "all") {
  const periodMs = {
    "1d": 24 * 60 * 60 * 1000,
    "7d": 7 * 24 * 60 * 60 * 1000,
    "30d": 30 * 24 * 60 * 60 * 1000,
    all: null,
  };

  const cutoff =
    revenuePeriod === "all" || !periodMs[revenuePeriod]
      ? null
      : Date.now() - periodMs[revenuePeriod];

  const inPeriod = (order) =>
    cutoff === null || new Date(order.created_at).getTime() >= cutoff;

  const periodOrders = orders.filter(inPeriod);
  const activeOrders = periodOrders.filter((o) => o.status !== "cancelled");

  const totalRevenue = activeOrders.reduce((s, o) => s + Number(o.total), 0);
  const totalOrders = periodOrders.length;
  const pendingOrders = orders.filter((o) =>
    ["pending", "confirmed", "processing"].includes(o.status)
  ).length;
  const completedOrders = orders.filter((o) => o.status === "delivered").length;
  const cancelledOrders = orders.filter((o) => o.status === "cancelled").length;

  return {
    totalOrders,
    totalRevenue,
    pendingOrders,
    completedOrders,
    cancelledOrders,
    periodOrders,
  };
}

/** @param {object[]} orders @param {string} query */
export function filterOrdersBySearch(orders, query) {
  const q = query.trim().toLowerCase();
  if (!q) return orders;
  return orders.filter(
    (o) =>
      o.order_number.toLowerCase().includes(q) ||
      o.customer_name.toLowerCase().includes(q) ||
      o.customer_email.toLowerCase().includes(q) ||
      o.customer_phone.includes(q)
  );
}
