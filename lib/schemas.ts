import { z } from 'zod';

// Esquema de validación estricta para la respuesta de Gemini AI
export const nutritionDataSchema = z.object({
  food_name: z.string().min(1, "El nombre de la comida es requerido"),
  calories: z.number().nonnegative("Las calorías no pueden ser negativas"),
  protein: z.number().nonnegative("La proteína no puede ser negativa"),
  carbs: z.number().nonnegative("Los carbohidratos no pueden ser negativos"),
  fat: z.number().nonnegative("Las grasas no pueden ser negativas"),
  sugar: z.number().nonnegative().optional(),
  fiber: z.number().nonnegative().optional(),
  sodium: z.number().nonnegative().optional(),
  confidence: z.enum(["Alta", "Media", "Baja"]).optional(),
  detected_items: z.array(z.string()).optional(),
  portion_note: z.string().optional(),
  error: z.string().optional(),
  model_used: z.string().optional()
});

// Tipo TypeScript inferido automáticamente desde el esquema de Zod
export type ValidatedNutritionData = z.infer<typeof nutritionDataSchema>;
