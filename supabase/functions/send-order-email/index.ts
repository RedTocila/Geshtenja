import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const ADMIN_EMAIL = Deno.env.get("ADMIN_ORDER_EMAIL") || Deno.env.get("ADMIN_EMAIL");
const FROM_EMAIL = Deno.env.get("ORDER_FROM_EMAIL") || "Geshtenja <orders@geshtenja.com>";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function escapeHtml(value: string) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function itemName(item: { name?: string; product_name?: string }) {
  return item.name || item.product_name || "Item";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const event = body.event === "cancelled" ? "cancelled" : "created";
    const {
      order_number,
      total,
      customer_name,
      customer_email,
      customer_phone,
      customer_city,
      customer_address,
      notes,
      items,
    } = body;

    if (!ADMIN_EMAIL || !RESEND_API_KEY) {
      return new Response(JSON.stringify({ ok: true, skipped: "email not configured" }), {
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const itemsRows = (items || [])
      .map(
        (i: { name?: string; product_name?: string; quantity: number }) =>
          `<tr><td>${escapeHtml(itemName(i))}</td><td>${i.quantity}</td></tr>`,
      )
      .join("");

    const phoneDigits = String(customer_phone ?? "").replace(/[^\d+]/g, "");
    const phoneLink = phoneDigits ? `<a href="tel:${phoneDigits}">${escapeHtml(customer_phone)}</a>` : escapeHtml(customer_phone);
    const emailLink = customer_email
      ? `<a href="mailto:${escapeHtml(customer_email)}">${escapeHtml(customer_email)}</a>`
      : "";

    const addressBlock = [customer_city, customer_address].filter(Boolean).join(", ");
    const notesBlock = notes
      ? `<p><strong>Notes:</strong> ${escapeHtml(notes)}</p>`
      : "";

    const isCancelled = event === "cancelled";
    const headline = isCancelled ? `Order cancelled: ${order_number}` : `New order: ${order_number}`;
    const subject = isCancelled ? `Cancelled order ${order_number}` : `New order ${order_number} — call to confirm`;
    const callout = isCancelled
      ? `<p style="background:#fef2f2;border-left:4px solid #ef4444;padding:12px 16px;margin:0 0 20px;">
          This order was cancelled. No further action needed unless the customer contacts you.
        </p>`
      : `<p style="background:#ecfdf5;border-left:4px solid #10b981;padding:12px 16px;margin:0 0 20px;">
          <strong>Call the customer to confirm this purchase.</strong>
        </p>`;

    const html = `
      <div style="font-family:system-ui,sans-serif;max-width:560px;color:#111827;line-height:1.5">
        <h2 style="margin:0 0 16px">${escapeHtml(headline)}</h2>
        ${callout}
        <h3 style="margin:24px 0 8px;font-size:14px;text-transform:uppercase;letter-spacing:.04em;color:#6b7280">Customer</h3>
        <p style="margin:0 0 16px">
          <strong>${escapeHtml(customer_name)}</strong><br/>
          Phone: ${phoneLink}<br/>
          Email: ${emailLink}<br/>
          ${addressBlock ? `Address: ${escapeHtml(addressBlock)}` : ""}
        </p>
        ${notesBlock}
        <h3 style="margin:24px 0 8px;font-size:14px;text-transform:uppercase;letter-spacing:.04em;color:#6b7280">Items</h3>
        <table style="width:100%;border-collapse:collapse;margin-bottom:16px">
          <thead>
            <tr>
              <th style="text-align:left;border-bottom:1px solid #e5e7eb;padding:8px 0">Product</th>
              <th style="text-align:right;border-bottom:1px solid #e5e7eb;padding:8px 0">Qty</th>
            </tr>
          </thead>
          <tbody>${itemsRows}</tbody>
        </table>
        <p style="margin:0;font-size:18px;font-weight:600">
          Total: €${Number(total).toFixed(2)} · Cash on Delivery
        </p>
      </div>
    `;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [ADMIN_EMAIL],
        subject,
        html,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(err);
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
