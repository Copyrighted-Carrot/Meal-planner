const nutritionTable = {
  "_meta": {
    "unit": "per_100g",
    "notes": "Approximate nutrition values (calories in kcal, protein/carbs/fat in grams). Use as seeded dataset for demo/portfolio. Values are estimated and should be cited if used in production.",
    "sources": ["IFCT (where available)", "USDA where equivalent item exists", "public nutrition tables and label averages"]
  },

  "idli": { "calories": 58, "protein": 2.5, "carbs": 12, "fat": 0.4 },
  "dosa": { "calories": 133, "protein": 3.2, "carbs": 17, "fat": 4.5 },
  "sambar": { "calories": 80, "protein": 3.0, "carbs": 10, "fat": 2.0 },
  "upma": { "calories": 180, "protein": 4.0, "carbs": 28, "fat": 5.0 },
  "poori": { "calories": 290, "protein": 6.0, "carbs": 30, "fat": 15.0 },
  "paratha": { "calories": 300, "protein": 6.0, "carbs": 40, "fat": 12.0 },
  "chapati": { "calories": 220, "protein": 7.0, "carbs": 40, "fat": 3.0 },
  "pav_bhaji": { "calories": 250, "protein": 6.0, "carbs": 35, "fat": 9.0 },
  "paneer_butter_masala": { "calories": 250, "protein": 12.0, "carbs": 8.0, "fat": 18.0 },
  "chole": { "calories": 164, "protein": 8.9, "carbs": 27.4, "fat": 2.6 },
  "rajma": { "calories": 140, "protein": 8.7, "carbs": 20.0, "fat": 0.5 },
  "biryani": { "calories": 210, "protein": 6.0, "carbs": 28.0, "fat": 8.0 },
  "pongal": { "calories": 160, "protein": 4.0, "carbs": 28.0, "fat": 2.5 },
  "rasam": { "calories": 30, "protein": 1.0, "carbs": 5.0, "fat": 0.5 },
  "vada": { "calories": 320, "protein": 9.0, "carbs": 30.0, "fat": 18.0 },
  "aloo_gobi": { "calories": 120, "protein": 2.2, "carbs": 12.0, "fat": 6.0 },
  "palak_paneer": { "calories": 190, "protein": 9.0, "carbs": 6.0, "fat": 14.0 },
  "butter_chicken": { "calories": 239, "protein": 14.0, "carbs": 6.0, "fat": 16.0 },
  "masala_dosa": { "calories": 168, "protein": 4.0, "carbs": 26.0, "fat": 5.0 },

  "rice_cooked": { "calories": 130, "protein": 2.4, "carbs": 28.0, "fat": 0.2 },
  "white_rice_raw": { "calories": 365, "protein": 6.7, "carbs": 80.0, "fat": 0.7 },
  "basmati_rice_cooked": { "calories": 121, "protein": 3.5, "carbs": 25.0, "fat": 0.4 },
  "wheat_flour": { "calories": 340, "protein": 12.0, "carbs": 72.0, "fat": 2.5 },
  "rava_semolina": { "calories": 360, "protein": 12.8, "carbs": 72.8, "fat": 1.1 },
  "besan_gram_flour": { "calories": 387, "protein": 22.0, "carbs": 58.9, "fat": 6.7 },

  "chicken_breast_cooked": { "calories": 165, "protein": 31.0, "carbs": 0.0, "fat": 3.6 },
  "mutton_cooked": { "calories": 294, "protein": 25.0, "carbs": 0.0, "fat": 20.0 },
  "fish_cooked": { "calories": 206, "protein": 22.0, "carbs": 0.0, "fat": 12.0 },

  "whole_milk": { "calories": 60, "protein": 3.2, "carbs": 4.8, "fat": 3.3 },
  "curd_plain": { "calories": 98, "protein": 3.5, "carbs": 4.7, "fat": 5.0 },
  "paneer_fresh": { "calories": 264, "protein": 18.3, "carbs": 1.2, "fat": 20.8 },

  "moong_dal_cooked": { "calories": 105, "protein": 7.0, "carbs": 19.0, "fat": 0.4 },
  "toor_dal_cooked": { "calories": 170, "protein": 9.3, "carbs": 27.0, "fat": 1.3 },
  "chickpeas_cooked": { "calories": 164, "protein": 8.9, "carbs": 27.4, "fat": 2.6 },

  "potato_cooked": { "calories": 87, "protein": 2.0, "carbs": 20.1, "fat": 0.1 },
  "onion_raw": { "calories": 40, "protein": 1.1, "carbs": 9.3, "fat": 0.1 },
  "tomato_raw": { "calories": 18, "protein": 0.9, "carbs": 3.9, "fat": 0.2 },
  "spinach_raw": { "calories": 23, "protein": 2.9, "carbs": 3.6, "fat": 0.4 },
  "cauliflower_cooked": { "calories": 23, "protein": 1.8, "carbs": 4.1, "fat": 0.3 },

  "mustard_oil": { "calories": 884, "protein": 0.0, "carbs": 0.0, "fat": 100.0 },
  "ghee": { "calories": 876, "protein": 0.0, "carbs": 0.0, "fat": 100.0 },
  "olive_oil": { "calories": 884, "protein": 0.0, "carbs": 0.0, "fat": 100.0 },

  "sugar": { "calories": 387, "protein": 0.0, "carbs": 100.0, "fat": 0.0 },
  "salt": { "calories": 0, "protein": 0.0, "carbs": 0.0, "fat": 0.0 },

  "banana_raw": { "calories": 89, "protein": 1.1, "carbs": 22.8, "fat": 0.3 },
  "apple_raw": { "calories": 52, "protein": 0.3, "carbs": 14.0, "fat": 0.2 },
  "coconut_dry": { "calories": 660, "protein": 6.9, "carbs": 23.7, "fat": 64.5 },

  "idli_rava": { "calories": 120, "protein": 4.0, "carbs": 22.0, "fat": 1.0 },
  "rava_upma": { "calories": 160, "protein": 4.5, "carbs": 28.0, "fat": 3.5 },

  "medu_vada": { "calories": 350, "protein": 10.0, "carbs": 35.0, "fat": 18.0 },
  "pakora_mixed": { "calories": 300, "protein": 8.0, "carbs": 28.0, "fat": 16.0 },

  "pav": { "calories": 265, "protein": 9.0, "carbs": 49.0, "fat": 3.5 },

  "sweets_gulab_jamun": { "calories": 300, "protein": 3.0, "carbs": 40.0, "fat": 12.0 },
  "jalebi": { "calories": 400, "protein": 1.5, "carbs": 58.0, "fat": 18.0 },

  "tea_milk_sugar": { "calories": 40, "protein": 1.0, "carbs": 5.0, "fat": 1.5 },
  "coffee_milk_sugar": { "calories": 30, "protein": 1.0, "carbs": 4.0, "fat": 1.0 }
};

module.exports = nutritionTable;
