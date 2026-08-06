/**
 * Generates standard list/get/create/update/delete handlers for a given
 * Mongoose model. Used for the admin management modules (Factory, Order,
 * Supplier) so each doesn't need hand-written boilerplate.
 */
function crudFactory(Model, { searchFields = [] } = {}) {
  return {
    list: async (req, res) => {
      try {
        const { search, page = 1, limit = 20, sort = '-createdAt' } = req.query;
        const query = {};
        if (search && searchFields.length) {
          query.$or = searchFields.map((f) => ({ [f]: { $regex: search, $options: 'i' } }));
        }
        const pageNum = Math.max(parseInt(page, 10) || 1, 1);
        const limitNum = Math.min(parseInt(limit, 10) || 20, 200);

        const [items, total] = await Promise.all([
          Model.find(query).sort(sort).skip((pageNum - 1) * limitNum).limit(limitNum),
          Model.countDocuments(query),
        ]);
        res.json({ success: true, data: items, pagination: { page: pageNum, limit: limitNum, total } });
      } catch (err) {
        res.status(500).json({ success: false, message: 'Failed to fetch records', error: err.message });
      }
    },

    getOne: async (req, res) => {
      const item = await Model.findById(req.params.id);
      if (!item) return res.status(404).json({ success: false, message: 'Record not found' });
      res.json({ success: true, data: item });
    },

    create: async (req, res) => {
      try {
        const item = await Model.create(req.body);
        res.status(201).json({ success: true, data: item });
      } catch (err) {
        res.status(400).json({ success: false, message: 'Create failed', error: err.message });
      }
    },

    update: async (req, res) => {
      try {
        const item = await Model.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
        if (!item) return res.status(404).json({ success: false, message: 'Record not found' });
        res.json({ success: true, data: item });
      } catch (err) {
        res.status(400).json({ success: false, message: 'Update failed', error: err.message });
      }
    },

    remove: async (req, res) => {
      const item = await Model.findByIdAndDelete(req.params.id);
      if (!item) return res.status(404).json({ success: false, message: 'Record not found' });
      res.json({ success: true, message: 'Record deleted' });
    },
  };
}

module.exports = crudFactory;
