const BASE = (
  process.env.COMMERCE_API_BASE || "https://commerce.thecanbrand.com/api"
)
  .replace(/\/marketplace-orders\/?$/, "")
  .replace(/\/$/, "");
let cached = "",
  expires = 0;
export async function token(force = false) {
  if (!force && cached && Date.now() < expires) return cached;
  const email = process.env.COMMERCE_EMAIL || process.env.AUTH_EMAIL,
    password = process.env.COMMERCE_PASSWORD || process.env.AUTH_PASSWORD,
    fallback = process.env.BEARER_TOKEN;
  let value;
  if (email && password) {
    const res = await fetch(`${BASE}/users/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
      signal: AbortSignal.timeout(20000),
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`Commerce login failed (${res.status})`);
    const data = await res.json();
    value = data.token || data.accessToken || data.bearerToken;
  } else value = fallback;
  if (!value)
    throw new Error("Configure COMMERCE_EMAIL and COMMERCE_PASSWORD in .env");
  cached = value.startsWith("Bearer ") ? value : `Bearer ${value}`;
  expires = Date.now() + 3500000;
  return cached;
}
export async function commerce(path, retry = true) {
  const res = await fetch(BASE + path, {
    headers: { Authorization: await token(), "Cache-Control": "no-cache" },
    cache: "no-store",
    signal: AbortSignal.timeout(25000),
  });
  if (res.status === 401 && retry) {
    await token(true);
    return commerce(path, false);
  }
  if (!res.ok) throw new Error(`Commerce request failed (${res.status})`);
  return res.json();
}
export async function paginate(path, get = commerce) {
  const records = new Map();
  let received = 0;
  const cap = Number(process.env.MAX_SYNC_PAGES || 100);
  for (let page = 1; page <= cap; page++) {
    const result = await get(`${path}&page=${page}&limit=100`);
    if (!Array.isArray(result.data))
      throw new Error("Unexpected Commerce list response");
    for (const row of result.data) {
      if (!row._id) throw new Error("Record missing ID");
      records.set(row._id, row);
    }
    received += result.data.length;
    const total = Number(result.totalItems);
    if (
      (Number.isFinite(total) && received >= total) ||
      (!Number.isFinite(total) && result.data.length < 100)
    )
      return [...records.values()];
    if (!result.data.length)
      throw new Error("Pagination ended before totalItems");
  }
  throw new Error("Sync page limit reached; increase MAX_SYNC_PAGES");
}
export function normalizeOrder(row) {
  const vendor =
    typeof row.vendor === "string" ? row.vendor : row.vendor?.name || "";
  return {
    id: row._id,
    orderId: row.orderId || row._id,
    vendor,
    vendorKey: vendor.trim().toLowerCase(),
    customer:
      typeof row.customer === "string"
        ? row.customer
        : row.customerProfile?.name || "",
    portalStatus: row.orderStatus || "Unknown",
    amount: Number(row.totalAmount || 0),
    items: (row.items || [])
      .map(
        (i) =>
          `${i.quantity} × ${typeof i.product === "string" ? i.product : i.product?.productName || ""}`,
      )
      .join("; "),
    updatedAt: row.updatedAt || "",
    createdAt: row.createdAt || "",
  };
}
export function normalizeReturn(row) {
  return {
    id: row._id,
    orderKey: row.order?._id || "",
    orderId: row.order?.orderId || "",
    vendor: row.order?.vendor?.name || "",
    vendorKey: (row.order?.vendor?.name || "").trim().toLowerCase(),
    customer: row.order?.customerProfile?.name || "",
    portalStatus: row.status || "Unknown",
    reason: row.returnReason || "",
    dueAt: row.sla?.dueAt || "",
    updatedAt: row.updatedAt || "",
  };
}

export function decodePhone(value) {
  if (value == null) return "";
  const text = String(value).trim();
  const phone = /^\+?[\d\s().-]{7,25}$/;
  if (phone.test(text)) return text;
  if (/^[A-Za-z0-9+/]+={0,2}$/.test(text)) {
    const decoded = Buffer.from(text, "base64").toString("utf8").trim();
    if (phone.test(decoded)) return decoded;
  }
  return "";
}

export function normalizeContacts(detail, id) {
  detail = detail.data || detail;
  return {
    id,
    vendorPhone: decodePhone(detail.vendor?.phone),
    customerPhone: decodePhone(detail.customerProfile?.phone || detail.customer?.phone || detail.customerPhone || detail.phone),
    checkedAt: new Date().toISOString(),
  };
}

export async function fetchContacts(
  orders,
  returns,
  states = {},
  get = commerce,
) {
  const ids = [
    ...new Set([
      ...orders.map((o) => o._id),
      ...returns.map((r) => r.order?._id),
    ]),
  ].filter((id) => /^[a-f0-9]{24}$/i.test(id || ""));
  const staleBefore = Date.now() - 7 * 86400000;
  const requested = Number(process.env.CONTACTS_PER_SYNC || 20);
  const limit = Number.isFinite(requested)
    ? Math.max(1, Math.min(40, requested))
    : 20;
  const candidates = ids
    .filter((id) => !states[id] || Date.parse(states[id]) < staleBefore)
    .sort((a, b) => (Date.parse(states[a]) || 0) - (Date.parse(states[b]) || 0))
    .slice(0, limit);
  const contacts = [];
  let cursor = 0,
    failures = 0;
  await Promise.all(
    Array.from({ length: Math.min(4, candidates.length) }, async () => {
      while (cursor < candidates.length) {
        const id = candidates[cursor++];
        try {
          contacts.push(
            normalizeContacts(await get(`/marketplace-orders/${id}`), id),
          );
        } catch {
          failures++;
        }
      }
    }),
  );
  return {
    contacts,
    failures,
    remaining:
      ids.filter((id) => !states[id]).length -
      contacts.filter((c) => !states[c.id]).length,
  };
}
