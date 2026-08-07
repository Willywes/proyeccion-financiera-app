/**
 * Categorías iniciales. Se siembran una sola vez, la primera vez que se abre
 * la base. El usuario puede editarlas, archivarlas o agregar las suyas.
 */

import type { SQLiteDatabase } from 'expo-sqlite';
import type { MovementType } from '../domain/types';

interface SeedCategory {
  name: string;
  type: MovementType;
  color: string;
  icon: string;
}

/**
 * Categoría a la que se imputan los pagos de cuotas por defecto.
 * Debe existir en `DEFAULT_CATEGORIES` con `type: 'expense'`.
 */
export const DEBT_CATEGORY_NAME = 'Créditos y cuotas';

const DEFAULT_CATEGORIES: SeedCategory[] = [
  // Ingresos
  { name: 'Sueldo', type: 'income', color: '#059669', icon: '💼' },
  { name: 'Honorarios', type: 'income', color: '#10b981', icon: '🧾' },
  { name: 'Ventas', type: 'income', color: '#14b8a6', icon: '🛍️' },
  { name: 'Arriendos', type: 'income', color: '#0ea5e9', icon: '🏘️' },
  { name: 'Inversiones', type: 'income', color: '#6366f1', icon: '📈' },
  { name: 'Bonos y aguinaldos', type: 'income', color: '#8b5cf6', icon: '🎁' },
  { name: 'Otros ingresos', type: 'income', color: '#64748b', icon: '➕' },

  // Egresos
  { name: 'Arriendo o dividendo', type: 'expense', color: '#e11d48', icon: '🏠' },
  { name: 'Cuentas básicas', type: 'expense', color: '#f97316', icon: '💡' },
  { name: 'Internet y teléfono', type: 'expense', color: '#0ea5e9', icon: '📶' },
  { name: 'Supermercado', type: 'expense', color: '#f59e0b', icon: '🛒' },
  { name: 'Comida fuera', type: 'expense', color: '#fb923c', icon: '🍔' },
  { name: 'Transporte', type: 'expense', color: '#3b82f6', icon: '🚌' },
  { name: 'Salud', type: 'expense', color: '#ec4899', icon: '💊' },
  { name: 'Educación', type: 'expense', color: '#8b5cf6', icon: '🎓' },
  { name: DEBT_CATEGORY_NAME, type: 'expense', color: '#b45309', icon: '💳' },
  { name: 'Suscripciones', type: 'expense', color: '#a855f7', icon: '📺' },
  { name: 'Ropa', type: 'expense', color: '#d946ef', icon: '👕' },
  { name: 'Entretención', type: 'expense', color: '#f43f5e', icon: '🎬' },
  { name: 'Mascotas', type: 'expense', color: '#84cc16', icon: '🐾' },
  { name: 'Hogar', type: 'expense', color: '#78716c', icon: '🛠️' },
  { name: 'Ahorro', type: 'expense', color: '#0d9488', icon: '🏦' },
  { name: 'Imprevistos', type: 'expense', color: '#dc2626', icon: '⚠️' },
  { name: 'Otros gastos', type: 'expense', color: '#64748b', icon: '➖' },
];

export async function seedDefaults(db: SQLiteDatabase): Promise<void> {
  const existing = await db.getFirstAsync<{ total: number }>(
    'SELECT COUNT(*) AS total FROM categories',
  );
  if ((existing?.total ?? 0) > 0) return;

  await db.withTransactionAsync(async () => {
    for (const category of DEFAULT_CATEGORIES) {
      await db.runAsync(
        `INSERT INTO categories (name, type, color, icon, is_default)
         VALUES (?, ?, ?, ?, 1)`,
        [category.name, category.type, category.color, category.icon],
      );
    }
  });
}
