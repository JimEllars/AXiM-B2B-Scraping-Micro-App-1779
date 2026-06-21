import { ensureTab, appendRow, updateRow, findRowIndexById, getRows } from '../lib/googleSheets';

const TAB = 'Orders';
const HEADERS = ['id', 'email', 'industry', 'location', 'size', 'keywords', 'leads_count', 'status', 'created_at', 'updated_at'];

export const orderService = {
  async createOrder(orderData) {
    await ensureTab(TAB, HEADERS);
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const row = [
      id,
      orderData.email,
      orderData.industry,
      orderData.location,
      orderData.size,
      orderData.keywords,
      0,
      'PENDING',
      now,
      now
    ];
    await appendRow(`${TAB}!A:Z`, row);
    return id;
  },

  async updateOrderStatus(id, status, leadsCount = 0) {
    const rowIndex = await findRowIndexById(TAB, id);
    if (rowIndex === -1) return;

    const existingRows = await getRows(`${TAB}!A${rowIndex}:J${rowIndex}`);
    if (!existingRows.length) return;

    const row = [...existingRows[0]];
    row[6] = leadsCount; // leads_count
    row[7] = status; // status
    row[9] = new Date().toISOString(); // updated_at

    await updateRow(`${TAB}!A${rowIndex}:J${rowIndex}`, row);
  },

  async getRecentOrders(limit = 10) {
    try {
      const rows = await getRows(`${TAB}!A2:J100`);
      return rows
        .map(row => ({
          id: row[0],
          email: row[1],
          industry: row[2],
          location: row[3],
          status: row[7],
          timestamp: row[8]
        }))
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
        .slice(0, limit);
    } catch (e) {
      return [];
    }
  }
};