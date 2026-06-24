import { ensureTab, appendRow, updateRow, findRowIndexById, getRows } from '../lib/googleSheets';

let cacheData = null;
let lastCacheTime = 0;
const TAB = 'Orders';
const HEADERS = ['id', 'email', 'industry', 'location', 'size', 'keywords', 'leads_count', 'status', 'created_at', 'updated_at'];

export const orderService = {
  async createOrder(orderData) {
    await ensureTab(TAB, HEADERS);
    const id = crypto.randomUUID();
    const nowString = new Date().toISOString();
    const row = [
      id,
      orderData.email,
      orderData.industry,
      orderData.location,
      orderData.size,
      orderData.keywords,
      0,
      'PENDING',
      nowString,
      nowString
    ];
    await appendRow(`${TAB}!A:Z`, row);

    // Lazy cleanup of old PENDING records
    (async () => {
      try {
        const rows = await getRows(`${TAB}!A2:J1000`);
        const nowTime = new Date();
        for (let i = 0; i < rows.length; i++) {
          const r = rows[i];
          if (r[7] === 'PENDING') {
            const timestamp = new Date(r[8]);
            const hoursDiff = (nowTime - timestamp) / (1000 * 60 * 60);
            if (hoursDiff > 2) {
              const rowIndex = i + 2; // +1 for 0-index, +1 for header
              const updatedRow = [...r];
              updatedRow[7] = 'ABANDONED';
              updatedRow[9] = new Date().toISOString();
              await updateRow(`${TAB}!A${rowIndex}:J${rowIndex}`, updatedRow);
            }
          }
        }
      } catch (e) {
        console.error("Lazy cleanup failed", e);
      }
    })();

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
      const now = new Date();
      if (cacheData && (Date.now() - lastCacheTime < 15000)) {
        return cacheData;
      }

      const rows = await getRows(`${TAB}!A2:J100`);

      const processedRows = rows
        .map(row => {
          let status = row[7];
          const timestamp = new Date(row[8]);

          // Flag as ABANDONED if PENDING and older than 2 hours
          if (status === 'PENDING') {
            const hoursDiff = (now - timestamp) / (1000 * 60 * 60);
            if (hoursDiff > 2) {
              status = 'ABANDONED';
            }
          }

          return {
            id: row[0],
            email: row[1],
            industry: row[2],
            location: row[3],
            status,
            timestamp: row[8]
          };
        })
        .filter(order => order.status !== 'ABANDONED') // Filter out abandoned from recent orders display
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
        .slice(0, limit);

      cacheData = processedRows;
      lastCacheTime = Date.now();
      return processedRows;
    } catch (e) {
      return [];
    }
  }
};
