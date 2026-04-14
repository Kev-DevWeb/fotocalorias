import { z } from 'zod';

// Esquema de validación estricta para la respuesta de Gemini AI
export const nutritionDataSchema = z.object({
  food_name: z.string().min(1, "El nombre de la comida es requerido"),
  calories: z.coerce.number().nonnegative("Las calorías no pueden ser negativas"),
  protein: z.coerce.number().nonnegative("La proteína no puede ser negativa"),
  carbs: z.coerce.number().nonnegative("Los carbohidratos no pueden ser negativos"),
  fat: z.coerce.number().nonnegative("Las grasas no pueden ser negativas"),
  sugar: z.coerce.number().nonnegative().optional(),
  fiber: z.coerce.number().nonnegative().optional(),
  sodium: z.coerce.number().nonnegative().optional(),
  confidence: z.string().optional(),
  detected_items: z.array(z.string()).optional(),
  portion_note: z.string().optional(),
  error: z.string().optional(),
  model_used: z.string().optional()
});

// Tipo TypeScript inferido automáticamente desde el esquema de Zod
export type ValidatedNutritionData = z.infer<typeof nutritionDataSchema>;
