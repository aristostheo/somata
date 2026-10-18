import AsyncStorage from "@react-native-async-storage/async-storage";
import { saveFoodDelivery } from "./nutrition";
import { createNutritionDelivery } from "./nutritionDelivery";
import { bumpUse, upsertFoodToCatalog } from "./foodCatalog";
export const consumePreviewNutritionHandoffs = createNutritionDelivery({
  storage: AsyncStorage,
  save: saveFoodDelivery,
  async afterSave(uid, rows, key) {
    if (key === "@pending_meal_builder_log_v1") return;
    for (const row of rows) {
      try {
        const catalog = await upsertFoodToCatalog({ ...row, submitterUid: uid });
        await bumpUse(catalog.id);
      } catch { /* Optional catalog enrichment cannot fail an acknowledged meal save. */ }
    }
  },
});
