import fs from "fs";
import imagekit from "../config/imagekit.js";
import mongoose from "mongoose";
import Property from "../models/propertyModel.js";
import District from "../models/districtModel.js";
import Listing from "../models/listingModel.js";
import { serializeListing, PROPERTY_TYPE_LABELS } from "./appListingController.js";

// Admin form sends a district id, or "" for unassigned. Returns undefined when
// the field was not sent, null for unassigned, false when the id is unknown.
const districtFromBody = async (value) => {
    if (value === undefined) return undefined;
    if (!value) return null;
    if (!mongoose.isValidObjectId(value)) return false;
    return (await District.exists({ _id: value })) ? value : false;
};

const addproperty = async (req, res) => {
    try {
        const { title, location, price, beds, baths, sqft, type, availability, description, amenities, phone, googleMapLink } = req.body;

        const district = await districtFromBody(req.body.district);
        if (district === false) {
            return res.status(400).json({ message: "Unknown district", success: false });
        }

        const image1 = req.files.image1 && req.files.image1[0];
        const image2 = req.files.image2 && req.files.image2[0];
        const image3 = req.files.image3 && req.files.image3[0];
        const image4 = req.files.image4 && req.files.image4[0];

        const images = [image1, image2, image3, image4].filter((item) => item !== undefined);

        // Upload images to ImageKit and delete after upload
        const imageUrls = await Promise.all(
            images.map(async (item) => {
                const result = await imagekit.upload({
                    file: fs.readFileSync(item.path),
                    fileName: item.originalname,
                    folder: "Property",
                });
                fs.unlink(item.path, (err) => {
                    if (err) console.log("Error deleting the file: ", err);
                });
                return result.url;
            })
        );

        // Create a new product
        const product = new Property({
            title,
            location,
            price,
            beds,
            baths,
            sqft,
            type,
            availability,
            description,
            amenities,
            image: imageUrls,
            phone,
            googleMapLink: googleMapLink || '',
            district: district ?? null
        });

        // Save the product to the database
        await product.save();

        res.json({ message: "Product added successfully", success: true });
    } catch (error) {
        console.log("Error adding product: ", error);
        res.status(500).json({ message: "Server Error", success: false });
    }
};

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Admin-added listings store availability as "buy"/"rent", user listings as
// "For Sale"/"For Rent", app listings are mapped to "For Sale"/"For Rent"/"For Lease".
const AVAILABILITY_MATCH = {
    buy: /^(buy|sale|for sale)$/i,
    rent: /^(rent|for rent)$/i,
    lease: /^(lease|for lease)$/i,
};

const SORTS = {
    newest: { createdAt: -1, _id: -1 },
    price_asc: { price: 1, createdAt: -1, _id: -1 },
    price_desc: { price: -1, createdAt: -1, _id: -1 },
};

// ── Website feed: website properties + approved mobile-app listings ─────────
// App listings (Listing model) are public on the website only once an admin
// has approved them (status 'active'), exactly like website listings.

const WEBSITE_VISIBLE = { $or: [{ status: "active" }, { status: { $exists: false } }] };

const APP_AVAILABILITY = { sell: "For Sale", rent: "For Rent", lease: "For Lease" };

// Fields app listings need so the website filters (type, availability) work on them
const APP_FILTER_FIELDS = {
    source: "app",
    type: {
        $switch: {
            branches: Object.entries(PROPERTY_TYPE_LABELS).map(([value, label]) => ({
                case: { $eq: ["$propertyType", value] }, then: label,
            })),
            default: "Property",
        },
    },
    availability: {
        $switch: {
            branches: Object.entries(APP_AVAILABILITY).map(([value, label]) => ({
                case: { $eq: ["$listingType", value] }, then: label,
            })),
            default: "For Sale",
        },
    },
};

/** Maps an approved app listing to the shape the website uses for properties */
const appListingForWebsite = (doc) => {
    const s = serializeListing(Listing.hydrate(doc));
    return {
        _id: String(s.id),
        source: "app",
        title: s.title,
        description: s.description,
        location: [s.address, s.city, s.state].filter(Boolean).join(", "),
        price: s.price,
        priceLabel: s.priceLabel,
        unitPriceLabel: s.unitPriceLabel,
        image: s.media.filter((m) => m.type === "image").map((m) => m.url),
        beds: null,
        baths: null,
        sqft: s.areaSqft,
        areaLabel: s.area.label,
        type: PROPERTY_TYPE_LABELS[s.propertyType] || "Property",
        availability: APP_AVAILABILITY[s.listingType],
        listingType: s.listingType,
        khataNo: s.khataNo,
        khasraNo: s.khasraNo,
        amenities: [],
        isVerified: s.isVerified,
        district: s.district,
        googleMapLink: s.location ? `https://www.google.com/maps?q=${s.location.latitude},${s.location.longitude}` : "",
        createdAt: s.createdAt,
    };
};

// Fills district { _id, name, state } on website docs and the name/state on app docs
const attachDistricts = async (items) => {
    const ids = [...new Set(items.map((i) => String(i.district?.id ?? i.district ?? "")).filter(Boolean))];
    const byId = new Map((await District.find({ _id: { $in: ids } }).select("name state").lean())
        .map((d) => [String(d._id), d]));
    return items.map((item) => {
        const d = byId.get(String(item.district?.id ?? item.district ?? ""));
        if (item.source === "app") {
            const location = item.location || [d?.name, d?.state].filter(Boolean).join(", ");
            return { ...item, location, district: d ? { id: d._id, name: d.name, state: d.state } : null };
        }
        return { ...item, district: d ? { _id: d._id, name: d.name, state: d.state } : null };
    });
};

// Optional search filters for GET /api/products/list (used by the Search page):
// q, state, district, type, availability (buy|rent|lease), minPrice, maxPrice, beds (minimum), sort
const searchFilters = async (query) => {
    const filters = [];
    const state = typeof query.state === "string" ? query.state.trim() : "";
    if (state && !query.district) {
        const ids = await District.find({ state }).collation({ locale: "en", strength: 2 }).distinct("_id");
        filters.push({ district: { $in: ids } });
    }
    const q = typeof query.q === "string" ? query.q.trim().slice(0, 100) : "";
    if (q) {
        const pattern = new RegExp(escapeRegex(q), "i");
        // address/city/khata/khasra only exist on app listings
        filters.push({ $or: ["title", "location", "description", "address", "city", "khataNo", "khasraNo"].map((f) => ({ [f]: pattern })) });
    }
    if (query.district && mongoose.isValidObjectId(query.district)) {
        filters.push({ district: new mongoose.Types.ObjectId(String(query.district)) });
    }
    if (typeof query.type === "string" && query.type.trim()) {
        filters.push({ type: new RegExp(`^${escapeRegex(query.type.trim())}$`, "i") });
    }
    if (AVAILABILITY_MATCH[query.availability]) filters.push({ availability: AVAILABILITY_MATCH[query.availability] });

    const price = {};
    const minPrice = Number(query.minPrice);
    const maxPrice = Number(query.maxPrice);
    if (query.minPrice && Number.isFinite(minPrice)) price.$gte = minPrice;
    if (query.maxPrice && Number.isFinite(maxPrice)) price.$lte = maxPrice;
    if (Object.keys(price).length) filters.push({ price });

    const beds = parseInt(query.beds);
    if (beds > 0) filters.push({ beds: { $gte: beds } });
    return filters;
};

const listproperty = async (req, res) => {
    try {
        // Pagination parameters
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(100, parseInt(req.query.limit) || 20); // Default 20 per page
        const skip = (page - 1) * limit;

        // Only approved listings are public: active website properties (legacy
        // admin-added docs without a status too) plus active app listings.
        // ?source=website leaves app listings out (admin "All Properties" page).
        const includeApp = req.query.source !== "website";
        const filters = await searchFilters(req.query);

        const [result] = await Property.aggregate([
            { $match: WEBSITE_VISIBLE },
            { $addFields: { source: "website" } },
            ...(includeApp ? [{
                $unionWith: {
                    coll: Listing.collection.name,
                    pipeline: [{ $match: { status: "active" } }, { $addFields: APP_FILTER_FIELDS }],
                },
            }] : []),
            ...(filters.length ? [{ $match: { $and: filters } }] : []),
            {
                $facet: {
                    items: [{ $sort: SORTS[req.query.sort] || SORTS.newest }, { $skip: skip }, { $limit: limit }],
                    total: [{ $count: "n" }],
                },
            },
        ]);

        const totalProperties = result.total[0]?.n ?? 0;
        const totalPages = Math.ceil(totalProperties / limit);
        const property = await attachDistricts(
            result.items.map((doc) => (doc.source === "app" ? appListingForWebsite(doc) : doc))
        );

        res.json({
            property,
            success: true,
            pagination: {
                currentPage: page,
                totalPages,
                totalProperties,
                hasNextPage: page < totalPages,
                hasPreviousPage: page > 1,
                limit
            }
        });
    } catch (error) {
        console.log("Error listing products: ", error);
        res.status(500).json({ message: "Server Error", success: false });
    }
};

const removeproperty = async (req, res) => {
    try {
        const property = await Property.findByIdAndDelete(req.body.id);
        if (!property) {
            return res.status(404).json({ message: "Property not found", success: false });
        }
        return res.json({ message: "Property removed successfully", success: true });
    } catch (error) {
        console.log("Error removing product: ", error);
        return res.status(500).json({ message: "Server Error", success: false });
    }
};

const updateproperty = async (req, res) => {
    try {
        const { id, title, location, price, beds, baths, sqft, type, availability, description, amenities, phone, googleMapLink } = req.body;

        const property = await Property.findById(id);
        if (!property) {
            console.log("Property not found with ID:", id); // Debugging line
            return res.status(404).json({ message: "Property not found", success: false });
        }

        const district = await districtFromBody(req.body.district);
        if (district === false) {
            return res.status(400).json({ message: "Unknown district", success: false });
        }
        if (district !== undefined) property.district = district;

        if (!req.files) {
            // No new images provided
            property.title = title;
            property.location = location;
            property.price = price;
            property.beds = beds;
            property.baths = baths;
            property.sqft = sqft;
            property.type = type;
            property.availability = availability;
            property.description = description;
            property.amenities = amenities;
            property.phone = phone;
            property.googleMapLink = googleMapLink || '';
            // Keep existing images
            await property.save();
            return res.json({ message: "Property updated successfully", success: true });
        }

        const image1 = req.files.image1 && req.files.image1[0];
        const image2 = req.files.image2 && req.files.image2[0];
        const image3 = req.files.image3 && req.files.image3[0];
        const image4 = req.files.image4 && req.files.image4[0];

        const images = [image1, image2, image3, image4].filter((item) => item !== undefined);

        // Upload images to ImageKit and delete after upload
        const imageUrls = await Promise.all(
            images.map(async (item) => {
                const result = await imagekit.upload({
                    file: fs.readFileSync(item.path),
                    fileName: item.originalname,
                    folder: "Property",
                });
                fs.unlink(item.path, (err) => {
                    if (err) console.log("Error deleting the file: ", err);
                });
                return result.url;
            })
        );

        property.title = title;
        property.location = location;
        property.price = price;
        property.beds = beds;
        property.baths = baths;
        property.sqft = sqft;
        property.type = type;
        property.availability = availability;
        property.description = description;
        property.amenities = amenities;
        property.image = imageUrls;
        property.phone = phone;
        property.googleMapLink = googleMapLink || '';

        await property.save();
        res.json({ message: "Property updated successfully", success: true });
    } catch (error) {
        console.log("Error updating product: ", error);
        res.status(500).json({ message: "Server Error", success: false });
    }
};

const singleproperty = async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose.isValidObjectId(id)) {
            return res.status(404).json({ message: "Property not found", success: false });
        }
        const property = await Property.findById(id);
        if (!property) {
            // Not a website property — maybe an approved mobile-app listing
            const listing = await Listing.findOne({ _id: id, status: "active" }).lean();
            if (!listing) return res.status(404).json({ message: "Property not found", success: false });
            const [appProperty] = await attachDistricts([appListingForWebsite(listing)]);
            return res.json({ property: appProperty, success: true });
        }
        // Block public access to listings that are not yet approved or have been
        // rejected/expired. Legacy docs without a status field are always visible.
        if (property.status && property.status !== 'active') {
            return res.status(404).json({ message: "Property not found", success: false });
        }
        res.json({ property, success: true });
    } catch (error) {
        console.log("Error fetching property:", error);
        res.status(500).json({ message: "Server Error", success: false });
    }
};

export { addproperty, listproperty, removeproperty, updateproperty , singleproperty};