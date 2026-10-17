const { aggregatePlanIngredients, parseIngredient, parseQuantity } = require('../utils/groceryAggregation');

const groceries = (...ingredients) => aggregatePlanIngredients([{ breakfast: { ingredients } }]);
const item = (name, amount) => expect.objectContaining({ name, amount, checked: false });

describe('grocery quantity parsing', () => {
    test.each([
        ['1/2', 0.5], ['1 / 2', 0.5], ['1 1/2', 1.5], ['1½', 1.5], ['1 ½', 1.5],
        ['½', 0.5], ['⅝', 0.625], ['⅓', 1 / 3], ['.25', 0.25], ['2.5', 2.5],
        ['two', 2], ['a', 1], ['half', 0.5], ['0', 0], [3, 3],
    ])('parses %s without truncation', (input, result) => {
        expect(parseQuantity(input)).toBe(result);
    });
    test.each(['', '1/0', '0/0', '1 1/0', '1-2', '2 x 400', '-1', '1e3', 'Infinity',
        'NaN', '12abc', '1.2.3', '9007199254740992', null, undefined, Infinity, NaN])(
        'does not guess unsupported quantity %s', input => expect(parseQuantity(input)).toBeNull());
    test.each([
        ['1/2 cup rice', 'rice', 120, 'ml'], ['1 1/2 cups rice', 'rice', 360, 'ml'],
        ['1½ cups rice', 'rice', 360, 'ml'], ['rice 1/2 cup', 'rice', 120, 'ml'],
        ['rice (1 cup)', 'rice', 240, 'ml'], ['a cup of rice', 'rice', 240, 'ml'],
        ['500g flour', 'flour', 500, 'g'], ['2 red onions', 'red onions', 2, 'count'],
        ['tomatoes 3', 'tomatoes', 3, 'count'], ['salt a pinch', 'salt', 1, 'pinch'],
        ['an apple', 'apple', 1, 'count'], ['an ounce butter', 'butter', 28.349523125, 'g'],
        ['half a cup rice', 'rice', 120, 'ml'], ['quarter of a cup rice', 'rice', 60, 'ml'],
        ['half of a teaspoon salt', 'salt', 2.5, 'ml'], ['rice half a cup', 'rice', 120, 'ml'],
        ['1 tsp. salt', 'salt', 5, 'ml'], ['salt 1 tsp.', 'salt', 5, 'ml'],
    ])('recognizes ingredient measurement %s', (input, name, quantity, unit) => {
        expect(parseIngredient(input)).toMatchObject({ name, quantity, unit });
    });
    test.each(['salt', 'salt to taste', 'salt (pinch)', '1-2 cups rice', '1 to 2 cups rice',
        '2 x 400g tomatoes', '2 × 400g tomatoes', '2 (400g) cans tomatoes', '2 400g cans tomatoes',
        '1/0 cup rice', '1e3 g flour', '-2 eggs', 'Infinity g salt', 'rice - 2 cups',
        'rice 1 2 cups', '2 cans x 400g tomatoes', '2 fl oz milk', '2 cans (400 g each) tomatoes',
        '2 cans tomatoes (400 g)', 'one and a half cups rice', '1 and 1/2 cups rice',
        'three quarters cup rice', 'one half cup rice', '2 dozen eggs', 'rice one and a half cups',
        '2 cups and 1/2 cup rice', 'rice 2 cups plus 1 tbsp', '1 cup + 2 tbsp rice'])('preserves uncertain text: %s', input => {
        expect(parseIngredient(input)).toMatchObject({ name: input, quantity: null });
        expect(groceries(input)).toEqual([item(input, 'quantity unknown')]);
    });
});

describe('authoritative plan aggregation', () => {
    test('includes breakfast, lunch, dinner and snacks, including repeated meals', () => {
        const meal = { ingredients: ['1/2 cup rice'] };
        const plan = [{ breakfast: meal, lunch: meal, dinner: meal, snack: meal }];
        const before = JSON.stringify(plan);
        expect(aggregatePlanIngredients(plan)).toEqual([item('rice', '480 ml')]);
        expect(JSON.stringify(plan)).toBe(before);
    });
    test('normalizes mass aliases and compatible imperial units', () => {
        expect(groceries('1 kilogram flour', '500 grams flour', '500 gm flour')).toEqual([item('flour', '2 kg')]);
        expect(groceries('1 lb potatoes', '16 ounces potatoes')).toEqual([item('potatoes', '907.18474 g')]);
    });
    test('normalizes volume aliases using the established recipe convention', () => {
        expect(groceries('1 litre stock', '500 milliliters stock')).toEqual([item('stock', '1.5 L')]);
        expect(groceries('1 cup milk', '1 tablespoon milk', '3 teaspoons milk')).toEqual([item('milk', '270 ml')]);
    });
    test('normalizes count aliases and plural named units without inventing volume', () => {
        expect(groceries('2 pieces carrot', '1 pc carrot', '3 counts carrot')).toEqual([item('carrot', 'x6')]);
        expect(groceries('1 bunch herbs', '2 bunches herbs')).toEqual([item('herbs', '3 bunch')]);
        expect(groceries('2 glasses water')).toEqual([item('water', '2 glass')]);
    });
    test('does not mix volume, weight, count, package units or missing quantities', () => {
        const result = groceries('100 g rice', '1 cup rice', '2 rice', '1 packet rice', 'rice');
        expect(result).toHaveLength(5);
        expect(result).toEqual(expect.arrayContaining(['100 g', '240 ml', 'x2', '1 packet', 'quantity unknown'].map(amount => item('rice', amount))));
        expect(new Set(result.map(entry => entry.key)).size).toBe(5);
    });
    test('sums fractional quantities without rounding small amounts to zero', () => {
        expect(groceries('⅓ tsp salt', '⅔ tsp salt')).toEqual([item('salt', '5 ml')]);
        expect(groceries('0.001 g saffron')).toEqual([item('saffron', '0.001 g')]);
        expect(groceries('1/1000000 g saffron')).toEqual([item('saffron', '0.000001 g')]);
        expect(groceries('0.1 apple', '0.2 apple')).toEqual([item('apple', 'x0.3')]);
    });
    test('normalizes names conservatively and produces stable keys and order', () => {
        const inputs = ['1 cup Rice', '2 cups rice', '1 g rice flour', '1 g brown  sugar', '2 g brown sugar'];
        const result = groceries(...inputs);
        expect(result).toEqual(groceries(...inputs.reverse()));
        expect(result).toHaveLength(3);
        expect(result).toEqual(expect.arrayContaining([item('Rice', '720 ml'), item('rice flour', '1 g'), item('brown sugar', '3 g')]));
        expect(groceries('1 cup RICE')[0].key).toBe(groceries('2 cups rice')[0].key);
    });
    test('does not guess singular ingredients, density or package sizes', () => {
        expect(groceries('2 tomatoes', '1 tomato')).toHaveLength(2);
        expect(groceries('1 can tomatoes', '100 g tomatoes')).toHaveLength(2);
        expect(groceries('1 cup flour', '240 g flour')).toHaveLength(2);
    });
    test('keeps unknown inputs visible and never substitutes x1 or invalid numeric output', () => {
        const result = groceries('salt', 'salt', 'pepper to taste', '1/0 cup rice', '1-2 cups milk');
        expect(result).toHaveLength(4);
        expect(result.every(entry => entry.amount === 'quantity unknown')).toBe(true);
        expect(JSON.stringify(result)).not.toMatch(/NaN|Infinity|x1/);
    });
    test('keeps overflowing quantities explicitly unknown', () => {
        expect(groceries('9007199254740991 kg flour')).toEqual([item('9007199254740991 kg flour', 'quantity unknown')]);
        expect(groceries('9007199254740991 eggs', '1 eggs')).toEqual([item('eggs', 'quantity unknown')]);
        expect(parseQuantity(`0.${'0'.repeat(330)}1`)).toBeNull();
    });
    test('supports legacy comma-separated ingredient strings without losing snacks', () => {
        expect(aggregatePlanIngredients([{ snack: { ingredients: '1 apple, 2 apples\n1/2 cup yogurt' } }]))
            .toEqual(expect.arrayContaining([item('apple', 'x1'), item('apples', 'x2'), item('yogurt', '120 ml')]));
    });
    test('handles empty slots and malformed non-string values without crashing', () => {
        expect(aggregatePlanIngredients(null)).toEqual([]);
        expect(aggregatePlanIngredients([null, {}, { breakfast: null, snack: { ingredients: [null, 4, '', '  '] } }])).toEqual([]);
    });
});
