const { createHash } = require('crypto');

const SLOTS = ['breakfast', 'lunch', 'dinner', 'snack'];
const FRACTIONS = {
    '½': '1/2', '⅓': '1/3', '⅔': '2/3', '¼': '1/4', '¾': '3/4',
    '⅕': '1/5', '⅖': '2/5', '⅗': '3/5', '⅘': '4/5', '⅙': '1/6',
    '⅚': '5/6', '⅛': '1/8', '⅜': '3/8', '⅝': '5/8', '⅞': '7/8',
};
const WORDS = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5,
    six: 6, seven: 7, eight: 8, nine: 9, ten: 10, half: 0.5, quarter: 0.25 };
const QUANTITY = `(?:\\d+\\s+\\d+\\s*/\\s*\\d+|\\d+\\s*/\\s*\\d+|\\d+(?:\\.\\d+)?|\\.\\d+|${Object.keys(WORDS).sort((a, b) => b.length - a.length).join('|')})`;
const units = new Map();
const addUnit = (aliases, dimension, unit, factor = 1) => {
    aliases.split(' ').forEach(alias => units.set(alias, { dimension, unit, factor }));
};
addUnit('g gm gms gram grams', 'weight', 'g');
addUnit('kg kgs kilo kilos kilogram kilograms', 'weight', 'g', 1000);
addUnit('lb lbs pound pounds', 'weight', 'g', 453.59237);
addUnit('oz ounce ounces', 'weight', 'g', 28.349523125);
addUnit('ml milliliter milliliters millilitre millilitres', 'volume', 'ml');
addUnit('l liter liters litre litres', 'volume', 'ml', 1000);
// Preserve the application's recipe convention: cup = 240 ml, tbsp = 15 ml,
// tsp = 5 ml. Generic spoons, glasses and bowls have no assumed volume.
addUnit('cup cups', 'volume', 'ml', 240);
addUnit('tbsp tbs tablespoon tablespoons', 'volume', 'ml', 15);
addUnit('tsp teaspoon teaspoons', 'volume', 'ml', 5);
addUnit('x count counts pc pcs piece pieces', 'count', 'count');
[
    ['bunch bunches', 'bunch'], ['pinch pinches', 'pinch'],
    ['handful handfuls', 'handful'], ['packet packets', 'packet'],
    ['pack packs', 'pack'], ['can cans', 'can'], ['slice slices', 'slice'],
    ['spoon spoons', 'spoon'], ['glass glasses', 'glass'], ['bowl bowls', 'bowl'],
    ['clove cloves', 'clove'], ['sprig sprigs', 'sprig'], ['stick sticks', 'stick'],
    ['jar jars', 'jar'], ['bottle bottles', 'bottle'], ['bag bags', 'bag'],
].forEach(([aliases, unit]) => addUnit(aliases, 'named', unit));

const clean = value => value.normalize('NFC').trim().replace(/\s+/g, ' ');
const identity = value => clean(value).toLowerCase();
const supportedNumber = value => Number.isFinite(value) && value >= 0 && value <= Number.MAX_SAFE_INTEGER;
const expandFractions = value => value.replace(/(\d)([½⅓⅔¼¾⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞])/g, '$1 $2')
    .replace(/[½⅓⅔¼¾⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞]/g, fraction => FRACTIONS[fraction]).replace(/⁄/g, '/');

function parseQuantity(input) {
    if (typeof input === 'number') return supportedNumber(input) ? input : null;
    if (typeof input !== 'string') return null;
    const text = clean(expandFractions(input)).toLowerCase();
    if (Object.prototype.hasOwnProperty.call(WORDS, text)) return WORDS[text];
    let value;
    const fraction = text.match(/^(?:(\d+)\s+)?(\d+)\s*\/\s*(\d+)$/);
    if (fraction) {
        const [whole, numerator, denominator] = [fraction[1] || '0', fraction[2], fraction[3]].map(Number);
        if (![whole, numerator, denominator].every(supportedNumber) || denominator === 0) return null;
        value = whole + numerator / denominator;
    } else if (/^(?:\d+(?:\.\d+)?|\.\d+)$/.test(text)) {
        value = Number(text);
        if (value === 0 && /[1-9]/.test(text)) return null;
    } else return null;
    return supportedNumber(value) ? value : null;
}

function parseIngredient(input) {
    if (typeof input !== 'string' || !input.trim()) return null;
    const original = clean(input);
    const text = clean(expandFractions(original))
        .replace(/\b(half|quarter)\s+(?:of\s+)?(?:a|an)\s+/gi, '$1 ');
    const unknown = () => ({ name: original, quantity: null, unit: null, dimension: 'unknown', original });
    const measured = (name, quantityText, unitText = 'count') => {
        const quantity = parseQuantity(quantityText);
        const measure = units.get(unitText.toLowerCase());
        if (!name.trim() || quantity === null || !measure || !supportedNumber(quantity * measure.factor)) return unknown();
        return { name: clean(name), quantity: quantity * measure.factor,
            unit: measure.unit, dimension: measure.dimension, original };
    };

    // Ranges and package sizes require a choice/interpretation we cannot make.
    // Keep the complete source text instead of silently taking its first number.
    if (/\d\s*(?:[-–—+×*]|to|x)\s*\d/i.test(text)
        || /\b(?:x|×|\*)\s*\d/i.test(text)
        || /\d\s*\(\s*\d/.test(text)
        || /\b(?:one|two|three|four|five|six|seven|eight|nine|ten|\d+)\s+(?:and|half|quarters?|dozens?)\b/i.test(text)
        || /\+|\b(?:and|plus|to)\s+(?:\d|\.\d|(?:a|an|one|two|three|four|five|six|seven|eight|nine|ten|half|quarter)\b)/i.test(text)
        || /\b(?:fl|fluid)\s+(?:oz|ounces?)\b/i.test(text)) return unknown();

    const parentheses = text.match(/^(.*?)\s*\(([^()]*)\)$/);
    if (parentheses) {
        const measure = parentheses[2].match(new RegExp(`^(${QUANTITY})\\s*(?:([a-z]+)\\.?)?$`, 'i'));
        // "Rice (1 cup)" is a measurement; "2 cans rice (400 g)" is a
        // package-size annotation and must not become a guessed total.
        if (measure && !new RegExp(`^${QUANTITY}(?=\\s|[a-z]|$)`, 'i').test(parentheses[1])) {
            return measured(parentheses[1], measure[1], measure[2]);
        }
    }
    if (/\(\s*\d/.test(text)) return unknown();

    const prefix = text.match(new RegExp(`^(${QUANTITY})(?=\\s|[a-z]|$)(.*)$`, 'i'));
    if (prefix) {
        const remainder = prefix[2].trim();
        const withUnit = remainder.match(/^([a-z]+)\b\.?\s*(.*)$/i);
        if (withUnit && units.has(withUnit[1].toLowerCase())) {
            return measured(withUnit[2].replace(/^of\s+/i, ''), prefix[1], withUnit[1]);
        }
        // A plain explicit count can describe a multiword ingredient. Adjacent
        // numeric fragments, signs and multipliers are not ingredient names.
        if (/^\s/.test(prefix[2]) && /^[\p{L}]/u.test(remainder)
            && !/^(?:to|x|and|of|a|an|half|halves|quarter|quarters|dozen|dozens)\b/i.test(remainder)) return measured(remainder, prefix[1]);
        return unknown();
    }

    const suffix = text.match(new RegExp(`^(.*?)\\s+(${QUANTITY})\\s*(?:([a-z]+)\\.?)?$`, 'i'));
    if (suffix && !/[\d/+×*−–—-]\s*$/.test(suffix[1])) return measured(suffix[1], suffix[2], suffix[3]);
    return unknown();
}

const numberText = quantity => String(Number(quantity.toPrecision(12)));
function amountText(quantity, unit) {
    if (quantity === null) return 'quantity unknown';
    if (unit === 'g' && quantity >= 1000) return `${numberText(quantity / 1000)} kg`;
    if (unit === 'ml' && quantity >= 1000) return `${numberText(quantity / 1000)} L`;
    if (unit === 'count') return `x${numberText(quantity)}`;
    return `${numberText(quantity)} ${unit}`;
}

function aggregatePlanIngredients(plan) {
    const buckets = new Map();
    for (const day of Array.isArray(plan) ? plan : []) {
        for (const slot of SLOTS) {
            const raw = day?.[slot]?.ingredients;
            const ingredients = Array.isArray(raw) ? raw : typeof raw === 'string' ? raw.split(/[,\n]/) : [];
            for (const ingredient of ingredients) {
                const parsed = parseIngredient(ingredient);
                if (!parsed) continue;
                const bucketKey = JSON.stringify([identity(parsed.name), parsed.dimension, parsed.unit]);
                if (!buckets.has(bucketKey)) buckets.set(bucketKey, { name: parsed.name, unit: parsed.unit, quantities: [] });
                const bucket = buckets.get(bucketKey);
                // Display and summation are independent of ingredient/meal order.
                if (parsed.name < bucket.name) bucket.name = parsed.name;
                if (parsed.quantity !== null) bucket.quantities.push(parsed.quantity);
            }
        }
    }
    return [...buckets.entries()].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([bucketKey, bucket]) => {
        const total = bucket.quantities.length
            ? bucket.quantities.sort((a, b) => a - b).reduce((sum, value) => sum + value, 0)
            : null;
        return {
            key: createHash('sha256').update(bucketKey).digest('hex'),
            name: bucket.name,
            amount: amountText(total !== null && supportedNumber(total) ? total : null, bucket.unit),
            checked: false,
        };
    });
}

module.exports = { aggregatePlanIngredients, parseIngredient, parseQuantity };
