import OpenAI from 'openai';
import ListingTranslation from '../models/listingTranslationModel.js';
import logger from '../utils/logger.js';

// Translates the seller-written text of one listing (GET /list-property/:id?lang=).
// Results are stored in listing_translations; the translator only runs on a miss.

export const LANGUAGES = {
    en: 'English', hi: 'Hindi', bn: 'Bengali', te: 'Telugu', mr: 'Marathi',
    ta: 'Tamil', gu: 'Gujarati', kn: 'Kannada', pa: 'Punjabi', or: 'Odia',
};

const FIELDS = ['title', 'description', 'address', 'price_label'];

// Script of the seller's text → language (Devanagari is taken as Hindi); no script match → English
const SCRIPTS = [
    [/[ঀ-৿]/, 'bn'], [/[ఀ-౿]/, 'te'], [/[஀-௿]/, 'ta'], [/[઀-૿]/, 'gu'],
    [/[ಀ-೿]/, 'kn'], [/[਀-੿]/, 'pa'], [/[଀-୿]/, 'or'], [/[ऀ-ॿ]/, 'hi'],
];

export const detectSourceLang = (...texts) => {
    const text = texts.filter(Boolean).join(' ');
    return SCRIPTS.find(([re]) => re.test(text))?.[1] || 'en';
};

export const parseLang = (value) => {
    if (value === undefined || value === null || value === '') return 'en';
    const lang = String(value).trim().toLowerCase();
    return Object.hasOwn(LANGUAGES, lang) ? lang : null;
};

const translate = async (texts, lang) => {
    const apiKey = process.env.GITHUB_MODELS_API_KEY?.trim();
    if (!apiKey) throw new Error('GITHUB_MODELS_API_KEY is not set');
    const client = new OpenAI({ baseURL: 'https://models.github.ai/inference', apiKey });
    const response = await client.chat.completions.create({
        model: 'openai/gpt-4.1',
        temperature: 0.2,
        response_format: { type: 'json_object' },
        messages: [
            {
                role: 'system',
                content: `Translate the JSON values into ${LANGUAGES[lang]}. Keep the keys. Keep numbers, currency symbols, ` +
                    'khata/khasra numbers and place names accurate (transliterate names, do not change them). ' +
                    'Reply with the JSON object only.',
            },
            { role: 'user', content: JSON.stringify(texts) },
        ],
    }, { timeout: 30_000 });
    const out = JSON.parse(response.choices[0].message.content);
    return Object.fromEntries(Object.keys(texts).map((k) => [k, typeof out[k] === 'string' && out[k].trim() ? out[k].trim() : texts[k]]));
};

/**
 * Stored translation of a listing, or a new one (saved). `source` has
 * { title, description, address, price_label }. Returns null if the translator fails.
 */
export const getTranslation = async (listingId, lang, source) => {
    const stored = await ListingTranslation.findOne({ listing_id: listingId, lang }).lean();
    if (stored) return stored;

    const texts = Object.fromEntries(FIELDS.filter((k) => source[k]).map((k) => [k, source[k]]));
    try {
        const translated = await translate(texts, lang);
        return await ListingTranslation.findOneAndUpdate(
            { listing_id: listingId, lang },
            { $set: translated },
            { upsert: true, new: true, setDefaultsOnInsert: true },
        ).lean();
    } catch (error) {
        logger.error?.(`Listing translation failed (${listingId}, ${lang}): ${error.message}`);
        return null;
    }
};

export const deleteTranslations = (listingId) => ListingTranslation.deleteMany({ listing_id: listingId });
