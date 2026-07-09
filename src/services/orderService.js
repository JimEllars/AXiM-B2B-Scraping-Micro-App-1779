export const orderService = {
  async createOrder(orderData) {
    const id = crypto.randomUUID();
    return id;
  },

  async updateOrderStatus(id, status, leadsCount = 0) {
    // Spreadsheet logic removed
    return;
  },

  async getRecentOrders(limit = 10) {
    // Spreadsheet logic removed
    return [];
  }
};
