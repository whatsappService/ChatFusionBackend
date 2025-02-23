const Business = require('../models/business');

exports.createBusiness = async (req, res) => {
    try {
        const business = await Business.create(req.body);
        res.status(201).json(business);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.getAllBusinesses = async (req, res) => {
    try {
        const businesses = await Business.findAll();
        res.json(businesses);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.getBusinessById = async (req, res) => {
    try {
        const business = await Business.findByPk(req.params.id);
        if (!business) return res.status(404).json({ error: 'Business not found' });
        res.json(business);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.updateBusiness = async (req, res) => {
    try {
        const business = await Business.findByPk(req.params.id);
        if (!business) return res.status(404).json({ error: 'Business not found' });

        await business.update(req.body);
        res.json(business);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.deleteBusiness = async (req, res) => {
    try {
        const business = await Business.findByPk(req.params.id);
        if (!business) return res.status(404).json({ error: 'Business not found' });

        await business.destroy();
        res.json({ message: 'Business deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};